// Real Darkness — behavior script
// Fog is fully automatic: visibility comes from sky light (sun/moon, moon phase, special
// days/nights, how exposed the player is to the sky) and from nearby light sources
// (distance to the nearest one and how many there are).
import { world, system, EquipmentSlot, PlayerPermissionLevel, BlockPermutation, BlockTypes, BlockVolume, MoonPhase } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

const NS = "realdarkness";
const FOG_TAG = "realdarkness";
const SETTINGS_ITEM = "realdarkness:settings";
const SCAN_RADIUS = 12;      // horizontal blocks counted as "near" (25x13x25 box, ~8k blocks)
const SCAN_HEIGHT = 6;       // vertical half-height of the scan box
// Vanilla light levels of light-emitting items (held light uses these values).
const LIGHT_ITEMS = {
  "minecraft:torch": 14,
  "minecraft:soul_torch": 10,
  "minecraft:redstone_torch": 7,
  "minecraft:copper_torch": 14,
  "minecraft:lantern": 15,
  "minecraft:soul_lantern": 10,
  "minecraft:glowstone": 15,
  "minecraft:sea_lantern": 15,
  "minecraft:shroomlight": 15,
  "minecraft:lit_pumpkin": 15,
  "minecraft:beacon": 15,
  "minecraft:campfire": 15,
  "minecraft:soul_campfire": 10,
  "minecraft:lava_bucket": 15,
  "minecraft:end_rod": 14,
  "minecraft:ochre_froglight": 15,
  "minecraft:verdant_froglight": 15,
  "minecraft:pearlescent_froglight": 15,
  "minecraft:crying_obsidian": 10,
  "minecraft:glow_berries": 14,
  "minecraft:glow_lichen": 7,
  "minecraft:magma": 3,
};

// Light-emitting placed blocks (all count, lava and fire included). Unknown ids are dropped at load.
const LIGHT_BLOCKS = [
  "minecraft:torch", "minecraft:soul_torch", "minecraft:redstone_torch", "minecraft:copper_torch",
  "minecraft:lantern", "minecraft:soul_lantern", "minecraft:glowstone", "minecraft:sea_lantern",
  "minecraft:shroomlight", "minecraft:lit_pumpkin", "minecraft:beacon", "minecraft:campfire",
  "minecraft:soul_campfire", "minecraft:lava", "minecraft:flowing_lava", "minecraft:fire",
  "minecraft:soul_fire", "minecraft:end_rod", "minecraft:ochre_froglight", "minecraft:verdant_froglight",
  "minecraft:pearlescent_froglight", "minecraft:crying_obsidian", "minecraft:magma", "minecraft:glow_lichen",
  "minecraft:lit_furnace", "minecraft:lit_blast_furnace", "minecraft:lit_smoker", "minecraft:lit_redstone_lamp",
  "minecraft:respawn_anchor", "minecraft:conduit", "minecraft:sea_pickle", "minecraft:cave_vines_head_with_berries",
  "minecraft:cave_vines_body_with_berries", "minecraft:enchanting_table", "minecraft:ender_chest",
  "minecraft:brewing_stand", "minecraft:amethyst_cluster", "minecraft:candle", "minecraft:lit_candle",
].filter((id) => { try { return !!BlockTypes.get(id); } catch (e) { return false; } });

// ---------- settings (world-wide) ----------
function getSettings() {
  const fog = world.getDynamicProperty(`${NS}:fog`);
  const held = world.getDynamicProperty(`${NS}:held_light`);
  return { fog: fog === undefined ? true : !!fog, heldLight: held === undefined ? true : !!held };
}

function saveSettings(s) {
  world.setDynamicProperty(`${NS}:fog`, s.fog);
  world.setDynamicProperty(`${NS}:held_light`, s.heldLight);
}

// ---------- night profile / special nights (silent, no messages) ----------
const PHASE_PROFILE = {
  [MoonPhase.FullMoon]: "full",
  [MoonPhase.WaningGibbous]: "gibbous",
  [MoonPhase.WaxingGibbous]: "gibbous",
  [MoonPhase.FirstQuarter]: "quarter",
  [MoonPhase.LastQuarter]: "quarter",
  [MoonPhase.WaningCrescent]: "crescent",
  [MoonPhase.WaxingCrescent]: "crescent",
  [MoonPhase.NewMoon]: "new",
};

function rollFullMoon() {
  const count = Number(world.getDynamicProperty(`${NS}:fullmoon_count`) ?? 0) + 1;
  world.setDynamicProperty(`${NS}:fullmoon_count`, count);
  if (count % 12 === 0) return "loykrathong"; // every 12th full moon
  const r = Math.random();
  if (r < 0.10) return "blood";   // lunar eclipse 10%
  if (r < 0.25) return "super";   // supermoon 15%
  if (r < 0.40) return "micro";   // micromoon 15%
  if (r < 0.50) return "honey";   // honey moon 10%
  return "full";                  // includes blue moon 5% (no visible effect)
}

// Profile of the night that starts on `day` (decided once, stored in the world).
function nightProfile(day) {
  if (world.getDynamicProperty(`${NS}:night_day`) === day) {
    return String(world.getDynamicProperty(`${NS}:night_profile`));
  }
  let profile = PHASE_PROFILE[world.getMoonPhase()] ?? "full";
  if (profile === "full") profile = rollFullMoon();
  world.setDynamicProperty(`${NS}:night_day`, day);
  world.setDynamicProperty(`${NS}:night_profile`, profile);
  return profile;
}

// Day phenomena, decided once per day (silent):
// after a new-moon night: total eclipse 10%, annular eclipse 10%; otherwise halo 10%, haze 10%.
function dayEvent(day) {
  if (world.getDynamicProperty(`${NS}:day_event_day`) !== day) {
    const prevNew = world.getDynamicProperty(`${NS}:night_day`) === day - 1 &&
      world.getDynamicProperty(`${NS}:night_profile`) === "new";
    const r = Math.random();
    let ev = "";
    if (prevNew && r < 0.10) ev = "eclipse_total";
    else if (prevNew && r < 0.20) ev = "eclipse_annular";
    else if (!prevNew && r < 0.10) ev = "halo";
    else if (!prevNew && r < 0.20) ev = "haze";
    world.setDynamicProperty(`${NS}:day_event_day`, day);
    world.setDynamicProperty(`${NS}:day_event`, ev);
  }
  return String(world.getDynamicProperty(`${NS}:day_event`) ?? "");
}

// Eclipse stage 0..3 around noon (5400-6600): ramp in, peak, ramp out (~1 real minute).
function eclipseStage(t) {
  if (t < 5400 || t >= 6600) return 0;
  if (t < 5600 || t >= 6400) return 1;
  if (t < 5800 || t >= 6200) return 2;
  return 3;
}

// Current world state: { kind: "day" | "golden" | "night" | "eclipse" | "halo" | "haze", profile }
function worldState() {
  const t = world.getTimeOfDay();
  const day = world.getDay();
  if (t >= 13000 && t < 23000) return { kind: "night", profile: nightProfile(day) };
  if (t >= 12000) return { kind: "golden", profile: "" };
  const ev = dayEvent(day);
  if (ev.startsWith("eclipse")) {
    const k = eclipseStage(t);
    if (k) return { kind: "eclipse", profile: `${ev}_${k}` };
  }
  if ((ev === "halo" || ev === "haze") && t >= 1000 && t < 11000) return { kind: ev, profile: "" };
  return { kind: "day", profile: "" };
}

// ---------- automatic fog ----------
// Brightness of the sky (sun/moon) for the current state, 0..1.
const NIGHT_SKY = { new: 0.0, crescent: 0.04, quarter: 0.09, gibbous: 0.14, full: 0.2, super: 0.3, micro: 0.12, blood: 0.02, honey: 0.2, loykrathong: 0.35 };
const ECLIPSE_SKY = { eclipse_total_1: 0.6, eclipse_total_2: 0.3, eclipse_total_3: 0.02, eclipse_annular_1: 0.8, eclipse_annular_2: 0.6, eclipse_annular_3: 0.45 };
const STATE_SKY = { day: 1.0, golden: 0.45, halo: 0.9, haze: 0.4 };
const NIGHT_TINT = { blood: "blood", honey: "honey", loykrathong: "loykrathong" };
const STATE_TINT = { golden: "golden", halo: "halo", haze: "haze", eclipse: "eclipse" };

// Fog end distances (must match tools/make_fogs.py). Last step = no fog.
const FOG_STEPS = [6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 64, 80, 96];
const NO_FOG = FOG_STEPS.length;

function skyBrightness(st) {
  if (st.kind === "night") return NIGHT_SKY[st.profile] ?? 0.3;
  if (st.kind === "eclipse") return ECLIPSE_SKY[st.profile] ?? 0.5;
  return STATE_SKY[st.kind] ?? 1.0;
}

// Light sources near the player: nearest distance and count (held items of all players count too).
function nearbyLights(player) {
  const loc = player.location;
  let nearest = Infinity;
  let count = 0;
  const from = { x: Math.floor(loc.x) - SCAN_RADIUS, y: Math.floor(loc.y) - SCAN_HEIGHT, z: Math.floor(loc.z) - SCAN_RADIUS };
  const to = { x: Math.floor(loc.x) + SCAN_RADIUS, y: Math.floor(loc.y) + SCAN_HEIGHT, z: Math.floor(loc.z) + SCAN_RADIUS };
  try {
    const list = player.dimension.getBlocks(new BlockVolume(from, to), { includeTypes: LIGHT_BLOCKS });
    for (const p of list.getBlockLocationIterator()) {
      const d = Math.hypot(p.x + 0.5 - loc.x, p.y + 0.5 - loc.y, p.z + 0.5 - loc.z);
      if (d <= SCAN_RADIUS) { count++; if (d < nearest) nearest = d; }
    }
  } catch (e) { /* unloaded area */ }
  for (const other of world.getAllPlayers()) {
    if (other.dimension.id !== player.dimension.id || heldItem(other).level <= 0) continue;
    const d = other.id === player.id ? 0 : Math.hypot(other.location.x - loc.x, other.location.y - loc.y, other.location.z - loc.z);
    if (d <= SCAN_RADIUS) { count++; if (d < nearest) nearest = d; }
  }
  return { nearest, count };
}

// Raw visibility 0..1 for a player right now (before smoothing).
function rawVisibility(player, st) {
  let sky = 0;
  try { sky = player.dimension.getSkyLightLevel(player.getHeadLocation()); } catch (e) { /* out of world */ }
  const skyVis = skyBrightness(st) * Math.min(1, sky / 12);
  const { nearest, count } = nearbyLights(player);
  const closeness = nearest === Infinity ? 0 : Math.max(0, 1 - nearest / SCAN_RADIUS);
  const amount = Math.min(1, count / 10);
  const lightVis = Math.pow(closeness, 1.5) * (0.35 + 0.65 * amount);
  return 1 - (1 - skyVis) * (1 - lightVis);
}

// Visibility -> fog step (curve keeps dark places narrow; NO_FOG only when really bright).
function stepFor(vis) {
  if (vis >= 0.97) return NO_FOG;
  return Math.min(NO_FOG - 1, Math.max(0, Math.round(Math.pow(vis, 1.3) * (NO_FOG - 1))));
}

function fogTint(st, player) {
  let sky = 0;
  try { sky = player.dimension.getSkyLightLevel(player.getHeadLocation()); } catch (e) { /* ignore */ }
  if (sky < 5) return "black"; // caves: plain darkness
  if (st.kind === "night") return NIGHT_TINT[st.profile] ?? "black";
  return STATE_TINT[st.kind] ?? "black";
}

const fogState = new Map(); // player.id -> { vis, step, id }

// Smooth and stable: visibility eases toward the target (EMA), the step changes at most
// one per update, and a small dead zone stops flickering between two steps.
function updateFog(player, s, st) {
  const prev = fogState.get(player.id);
  let want = "";
  let step = NO_FOG;
  let vis = 1;
  if (s.fog && player.dimension.id === "minecraft:overworld") {
    const raw = rawVisibility(player, st);
    vis = prev ? prev.vis + (raw - prev.vis) * 0.35 : raw;
    const target = stepFor(vis);
    const exact = Math.pow(Math.min(vis, 0.999), 1.3) * (NO_FOG - 1);
    step = !prev ? target
      : target === prev.step || (target !== NO_FOG && prev.step !== NO_FOG && Math.abs(exact - prev.step) < 0.6) ? prev.step
      : prev.step + Math.sign(target - prev.step);
    if (step < NO_FOG) want = `${NS}:${fogTint(st, player)}_${step}`;
  }
  if (prev && prev.id === want) { prev.vis = vis; prev.step = step; return; }
  const fs = player.fogSettings;
  while (fs.getTags().includes(FOG_TAG)) fs.pop(FOG_TAG);
  if (want) fs.push(want, FOG_TAG);
  fogState.set(player.id, { vis, step, id: want });
}

// Each player is updated once per second, spread over different ticks so the work never piles up.
let lastState = { kind: "day", profile: "" };
system.runInterval(() => {
  const slot = system.currentTick % 20;
  const players = world.getAllPlayers();
  if (!players.length) return;
  const due = players.filter((_, i) => (i * 7) % 20 === slot);
  if (!due.length) return;
  const s = getSettings();
  const st = worldState();
  lastState = st;
  for (const player of due) {
    try { updateFog(player, s, st); } catch (e) { /* player not ready */ }
  }
}, 1);

// ---------- held light (head + 4 points ~4 blocks away) ----------
const OFFSETS = [[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]];
const placed = new Map();      // player.id -> { dim, level, base, blocks: [{x,y,z}] }
const extinguished = new Map(); // player.id -> item signature at the time the light went out

function heldItem(player) {
  const eq = player.getComponent("minecraft:equippable");
  if (!eq) return { level: 0, sig: "" };
  let level = 0;
  const ids = [];
  for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
    const item = eq.getEquipment(slot);
    ids.push(item?.typeId ?? "");
    if (item) level = Math.max(level, LIGHT_ITEMS[item.typeId] ?? 0);
  }
  return { level, sig: ids.join("|") };
}

function isOurLight(dim, pos, level) {
  try {
    const b = world.getDimension(dim).getBlock(pos);
    return !!b && b.typeId === `minecraft:light_block_${level}`;
  } catch (e) { return false; }
}

function removeGroup(playerId) {
  const rec = placed.get(playerId);
  if (!rec) return;
  for (const pos of rec.blocks) {
    try {
      const b = world.getDimension(rec.dim).getBlock(pos);
      if (b && b.typeId === `minecraft:light_block_${rec.level}`) b.setType("minecraft:air");
    } catch (e) { /* chunk unloaded */ }
  }
  placed.delete(playerId);
}

// Turn the held light off until the player swaps items (re-lights it).
function extinguish(player) {
  removeGroup(player.id);
  extinguished.set(player.id, heldItem(player).sig);
}

function updateHeldLight(player, s) {
  const { level: rawLevel, sig } = heldItem(player);
  if (extinguished.has(player.id)) {
    if (extinguished.get(player.id) === sig) { removeGroup(player.id); return; }
    extinguished.delete(player.id);
  }
  const level = s.heldLight ? rawLevel : 0;
  const head = player.getHeadLocation();
  const base = { x: Math.floor(head.x), y: Math.floor(head.y), z: Math.floor(head.z) };
  const dim = player.dimension.id;
  const rec = placed.get(player.id);

  if (rec && rec.level === level && rec.dim === dim && rec.base.x === base.x && rec.base.y === base.y && rec.base.z === base.z) {
    // Same spot: if anything removed one of our light blocks, the whole group goes out.
    if (rec.blocks.some((p) => !isOurLight(dim, p, level))) extinguish(player);
    return;
  }
  removeGroup(player.id);
  if (level <= 0) return;

  const blocks = [];
  const permutation = BlockPermutation.resolve(`minecraft:light_block_${level}`);
  for (const [dx, dz] of OFFSETS) {
    const pos = { x: base.x + dx, y: base.y, z: base.z + dz };
    const block = player.dimension.getBlock(pos);
    if (!block || !block.isAir) continue;
    block.setPermutation(permutation);
    blocks.push(pos);
  }
  if (blocks.length) placed.set(player.id, { dim, level, base, blocks });
}

system.runInterval(() => {
  const s = getSettings();
  for (const player of world.getAllPlayers()) {
    try { updateHeldLight(player, s); } catch (e) { /* player not ready */ }
  }
}, 4);

// Other add-ons can put the held light out: /scriptevent realdarkness:extinguish
// (run as / targeting a player, or from the console to affect everyone).
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id === `${NS}:debug`) {
    // /scriptevent realdarkness:debug — prints what the add-on is doing right now
    const s = getSettings();
    const st = worldState();
    const p = sourceEntity?.typeId === "minecraft:player" ? /** @type {import("@minecraft/server").Player} */ (sourceEntity) : undefined;
    let extra = "";
    if (p) {
      const { nearest, count } = nearbyLights(p);
      extra = ` sky=${p.dimension.getSkyLightLevel(p.getHeadLocation())} lights=${count} nearest=${nearest === Infinity ? "-" : nearest.toFixed(1)}` +
        ` step=${fogState.get(p.id)?.step ?? "-"} fogStack=[${p.fogSettings.getStack().join(", ")}]`;
    }
    const msg = `[RealDarkness] time=${world.getTimeOfDay()} day=${world.getDay()} state=${st.kind} ${st.profile} ` +
      `fog=${s.fog} heldLight=${s.heldLight}` + extra;
    if (p) p.sendMessage(msg); else world.sendMessage(msg);
    return;
  }
  if (id !== `${NS}:extinguish`) return;
  const targets = sourceEntity?.typeId === "minecraft:player" ? [sourceEntity] : world.getAllPlayers();
  for (const p of targets) extinguish(/** @type {import("@minecraft/server").Player} */ (p));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  removeGroup(playerId);
  extinguished.delete(playerId);
  fogState.delete(playerId);
});

// ---------- settings item ----------
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  fogState.delete(player.id);
  if (player.getDynamicProperty(`${NS}:got_item`)) return;
  system.run(() => {
    player.runCommand(`give @s ${SETTINGS_ITEM} 1`);
    player.setDynamicProperty(`${NS}:got_item`, true);
  });
});

world.afterEvents.itemUse.subscribe(({ source: player, itemStack }) => {
  if (itemStack.typeId !== SETTINGS_ITEM) return;
  if (player.playerPermissionLevel < PlayerPermissionLevel.Operator) {
    player.sendMessage({ translate: "realdarkness.msg.no_permission" });
    return;
  }
  const s = getSettings();
  new ModalFormData()
    .title({ translate: "realdarkness.form.title" })
    .toggle({ translate: "realdarkness.form.fog" }, { defaultValue: s.fog })
    .toggle({ translate: "realdarkness.form.held_light" }, { defaultValue: s.heldLight })
    .show(player)
    .then((res) => {
      if (res.canceled || !res.formValues) return;
      const [fog, heldLight] = res.formValues;
      saveSettings({ fog: !!fog, heldLight: !!heldLight });
      fogState.clear(); // re-apply fog for everyone
      player.sendMessage({ translate: "realdarkness.msg.saved" });
    });
});
