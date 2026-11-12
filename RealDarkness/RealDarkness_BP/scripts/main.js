// Real Darkness — behavior script
// Fog is fully automatic. Daylight under open sky: no fog. Night and caves: fog width comes
// only from nearby light sources (their strength, distance and how many there are).
// Moon phase and special days/nights only change the fog colour.
import { world, system, EquipmentSlot, PlayerPermissionLevel, BlockPermutation, BlockTypes, BlockVolume, MoonPhase } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

const NS = "realdarkness";
const FOG_TAG = "realdarkness";
const SETTINGS_ITEM = "realdarkness:settings";
const SCAN_RADIUS = 16;      // covers the 2R zone of the brightest lights (R = level / 2)
const SCAN_HEIGHT = 8;       // vertical half-height of the scan box
const RESCAN_MOVE = 2;       // rescan after moving this many blocks
const RESCAN_TICKS = 60;     // or at least every 3 seconds (placing/breaking lights rescans at once)
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

// Light-emitting placed blocks and their vanilla light levels (lava and fire included).
// Unknown ids are dropped at load.
const LIGHT_LEVELS_ALL = {
  "minecraft:torch": 14, "minecraft:soul_torch": 10, "minecraft:redstone_torch": 7, "minecraft:copper_torch": 14,
  "minecraft:lantern": 15, "minecraft:soul_lantern": 10, "minecraft:glowstone": 15, "minecraft:sea_lantern": 15,
  "minecraft:shroomlight": 15, "minecraft:lit_pumpkin": 15, "minecraft:beacon": 15, "minecraft:campfire": 15,
  "minecraft:soul_campfire": 10, "minecraft:lava": 15, "minecraft:flowing_lava": 15, "minecraft:fire": 15,
  "minecraft:soul_fire": 10, "minecraft:end_rod": 14, "minecraft:ochre_froglight": 15, "minecraft:verdant_froglight": 15,
  "minecraft:pearlescent_froglight": 15, "minecraft:crying_obsidian": 10, "minecraft:magma": 3, "minecraft:glow_lichen": 7,
  "minecraft:lit_furnace": 13, "minecraft:lit_blast_furnace": 13, "minecraft:lit_smoker": 13, "minecraft:lit_redstone_lamp": 15,
  "minecraft:respawn_anchor": 15, "minecraft:conduit": 15, "minecraft:sea_pickle": 6,
  "minecraft:cave_vines_head_with_berries": 14, "minecraft:cave_vines_body_with_berries": 14,
  "minecraft:enchanting_table": 7, "minecraft:ender_chest": 7, "minecraft:amethyst_cluster": 5,
};
// Built on first use (after the world has loaded): scripts start in early execution, where
// BlockTypes lookups are not allowed, which made this list empty before.
/** @type {Record<string, number> | undefined} */
let LIGHT_LEVELS;
/** @type {string[]} */
let LIGHT_BLOCKS = [];
function lightLevels() {
  if (!LIGHT_LEVELS) {
    LIGHT_LEVELS = {};
    for (const [id, level] of Object.entries(LIGHT_LEVELS_ALL)) {
      try { if (BlockTypes.get(id)) LIGHT_LEVELS[id] = level; } catch (e) { /* unknown id */ }
    }
    LIGHT_BLOCKS = Object.keys(LIGHT_LEVELS);
  }
  return LIGHT_LEVELS;
}
const MAX_SOURCES = 64; // cap per scan (e.g. lava lakes) to keep it light

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
// Day under open sky: no fog. Night, caves and total-eclipse peak: width depends ONLY on
// light sources — with none, darkness closes in right next to the player.
// Moon/special nights/days only change the fog colour.
const NIGHT_TINT = { blood: "blood", honey: "honey", loykrathong: "loykrathong" };
const STATE_TINT = { golden: "golden", halo: "halo", haze: "haze", eclipse: "eclipse" };
const DAY_KINDS = ["day", "golden", "halo", "haze", "eclipse"];

// Fog end distances (must match tools/make_fogs.py). Index NO_FOG = no fog.
const FOG_STEPS = [6, 7, 8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 40, 50, 64];
const NO_FOG = FOG_STEPS.length;
const TINT_STEP = 13; // daytime colour-only fog (golden hour, halo, haze, eclipse ramp)

// ---- light sources (cached scan, cheap per-update distance math) ----
// Each light has a lit radius R = level / 2 and an influence zone out to 2R.
// Inside R: full effect. Between R and 2R: fades linearly. Beyond 2R: nothing.
const scanCache = new Map(); // player.id -> { x, y, z, tick, dim, blocks: [{x,y,z,level}] }

function scanLights(player) {
  const loc = player.location;
  const c = scanCache.get(player.id);
  const now = system.currentTick;
  if (c && c.dim === player.dimension.id && now - c.tick < RESCAN_TICKS &&
      Math.abs(c.x - loc.x) < RESCAN_MOVE && Math.abs(c.y - loc.y) < RESCAN_MOVE && Math.abs(c.z - loc.z) < RESCAN_MOVE) {
    return c.blocks;
  }
  const levels = lightLevels();
  const blocks = [];
  const from = { x: Math.floor(loc.x) - SCAN_RADIUS, y: Math.floor(loc.y) - SCAN_HEIGHT, z: Math.floor(loc.z) - SCAN_RADIUS };
  const to = { x: Math.floor(loc.x) + SCAN_RADIUS, y: Math.floor(loc.y) + SCAN_HEIGHT, z: Math.floor(loc.z) + SCAN_RADIUS };
  if (LIGHT_BLOCKS.length) try {
    const list = player.dimension.getBlocks(new BlockVolume(from, to), { includeTypes: LIGHT_BLOCKS });
    for (const p of list.getBlockLocationIterator()) {
      const level = levels[player.dimension.getBlock(p)?.typeId ?? ""] ?? 0;
      if (level > 0) blocks.push({ x: p.x + 0.5, y: p.y + 0.5, z: p.z + 0.5, level });
      if (blocks.length >= MAX_SOURCES) break;
    }
  } catch (e) { /* unloaded area */ }
  scanCache.set(player.id, { x: loc.x, y: loc.y, z: loc.z, tick: now, dim: player.dimension.id, blocks });
  return blocks;
}

// Strength 0..1 of one light at distance d.
function lightEffect(d, level) {
  const r = level / 2;
  const base = level / 15;
  if (d <= r) return base;
  if (d >= 2 * r) return 0;
  return base * (1 - (d - r) / r);
}

// Lights affecting the player: list of { d, level } (placed blocks + held items of every player).
function nearbyLights(player) {
  const loc = player.location;
  const out = [];
  for (const b of scanLights(player)) {
    const d = Math.hypot(b.x - loc.x, b.y - loc.y, b.z - loc.z);
    if (d < b.level) out.push({ d, level: b.level });
  }
  for (const other of world.getAllPlayers()) {
    if (other.dimension.id !== player.dimension.id) continue;
    const level = heldItem(other).level;
    if (level <= 0) continue;
    const d = other.id === player.id ? 0 : Math.hypot(other.location.x - loc.x, other.location.y - loc.y, other.location.z - loc.z);
    if (d < level) out.push({ d, level: Math.min(15, level + 1) }); // held light a bit brighter
  }
  return out;
}

function skyLight(player) {
  try { return player.dimension.getSkyLightLevel(player.getHeadLocation()); } catch (e) { return 0; }
}

// Is the player in daylight (day state, under open sky, not at the dark peak of a total eclipse)?
function inDaylight(player, st) {
  if (!DAY_KINDS.includes(st.kind)) return false;
  if (st.profile === "eclipse_total_3") return false;
  return skyLight(player) >= 12;
}

// Visibility 0..1: strongest light reaching the player, plus a bonus for other lights around.
function rawVisibility(player) {
  let best = 0;
  let total = 0;
  for (const { d, level } of nearbyLights(player)) {
    const e = lightEffect(d, level);
    best = Math.max(best, e);
    total += e;
  }
  if (best <= 0) return 0;
  const extra = Math.min(1, (total - best) / 3);
  return Math.min(1, best * (0.75 + 0.25 * extra));
}

// At night/in caves the fog never disappears completely: brightest = 64 blocks.
function stepFor(vis) {
  return Math.min(NO_FOG - 1, Math.max(0, Math.round(Math.pow(vis, 1.3) * (NO_FOG - 1))));
}

function fogTint(st, player) {
  if (skyLight(player) < 5) return "black"; // caves: plain darkness
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
    const daylight = inDaylight(player, st);
    const raw = daylight ? 1 : rawVisibility(player);
    vis = prev ? prev.vis + (raw - prev.vis) * (raw > prev.vis ? 0.9 : 0.6) : raw;
    let target = daylight ? NO_FOG : stepFor(vis);
    if (daylight && STATE_TINT[st.kind] && skyLight(player) >= 5) target = TINT_STEP; // colour only
    const exact = Math.pow(Math.min(vis, 0.999), 1.3) * (NO_FOG - 1);
    step = !prev ? target
      : target === prev.step || (!daylight && target !== NO_FOG && prev.step !== NO_FOG && Math.abs(exact - prev.step) < 0.6) ? prev.step
      : target > prev.step ? target // light opens the fog at once
      : prev.step - Math.min(prev.step - target, 3); // darkness creeps back in, up to 3 steps per update
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
  const slot = system.currentTick % 10;
  const players = world.getAllPlayers();
  if (!players.length) return;
  const due = players.filter((_, i) => (i * 3) % 10 === slot);
  if (!due.length) return;
  const s = getSettings();
  const st = worldState();
  lastState = st;
  for (const player of due) {
    try { updateFog(player, s, st); } catch (e) { /* player not ready */ }
  }
}, 1);

// ---------- held light (one point at the player's head, like a real torch) ----------
const OFFSETS = [[0, 0]];
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
      const src = nearbyLights(p);
      extra = ` sky=${skyLight(p)} daylight=${inDaylight(p, st)} lights=${src.length} vis=${rawVisibility(p).toFixed(2)}` +
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

world.afterEvents.playerPlaceBlock.subscribe(({ block }) => {
  if (lightLevels()[block.typeId]) scanCache.clear(); // rescan everyone
});
world.afterEvents.playerBreakBlock.subscribe(({ brokenBlockPermutation }) => {
  if (lightLevels()[brokenBlockPermutation.type.id]) scanCache.clear();
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  scanCache.delete(playerId);
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
