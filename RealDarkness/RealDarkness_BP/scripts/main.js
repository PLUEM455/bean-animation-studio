// Real Darkness — behavior script
import { world, system, EquipmentSlot, PlayerPermissionLevel, BlockPermutation, MoonPhase, BiomeTypes } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";
import { getBiomeLighting } from "@minecraft/server-graphics";

const NS = "realdarkness";
const FOG_TAG = "realdarkness";
const SETTINGS_ITEM = "realdarkness:settings";
const DENSITIES = ["thin", "medium", "thick", "pitch"];

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

// ---------- settings (world-wide) ----------
function getSettings() {
  const fog = world.getDynamicProperty(`${NS}:fog`);
  const density = world.getDynamicProperty(`${NS}:density`);
  const held = world.getDynamicProperty(`${NS}:held_light`);
  return {
    fog: fog === undefined ? true : !!fog,
    density: typeof density === "number" && DENSITIES[density] ? density : 1,
    heldLight: held === undefined ? true : !!held,
  };
}

function saveSettings(s) {
  world.setDynamicProperty(`${NS}:fog`, s.fog);
  world.setDynamicProperty(`${NS}:density`, s.density);
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

// Solar eclipse: day after a new-moon night, 10%, around noon for ~1 real minute.
function eclipseToday(day) {
  if (world.getDynamicProperty(`${NS}:eclipse_check_day`) !== day) {
    const prevNew = world.getDynamicProperty(`${NS}:night_day`) === day - 1 &&
      world.getDynamicProperty(`${NS}:night_profile`) === "new";
    world.setDynamicProperty(`${NS}:eclipse_check_day`, day);
    world.setDynamicProperty(`${NS}:eclipse`, prevNew && Math.random() < 0.10);
  }
  return world.getDynamicProperty(`${NS}:eclipse`) === true;
}

// Current world state: { kind: "day" | "dusk" | "night" | "eclipse", profile }
function worldState() {
  const t = world.getTimeOfDay();
  const day = world.getDay();
  if (t >= 13000 && t < 23000) return { kind: "night", profile: nightProfile(day) };
  if (t >= 12000) return { kind: "dusk", profile: "" };
  if (t >= 5400 && t < 6600 && eclipseToday(day)) return { kind: "eclipse", profile: "" };
  return { kind: "day", profile: "" };
}

// ---------- fog ----------
const currentFog = new Map(); // player.id -> fog id or ""

function wantedFog(player, s, st) {
  if (!s.fog || player.dimension.id !== "minecraft:overworld") return "";
  if (st.kind === "night") return `${NS}:${DENSITIES[s.density]}_${st.profile}`;
  if (st.kind === "dusk") return `${NS}:dusk`;
  if (st.kind === "eclipse") return `${NS}:eclipse`;
  return "";
}

function updateFog(player, s, st) {
  const want = wantedFog(player, s, st);
  if ((currentFog.get(player.id) ?? "") === want) return;
  const fs = player.fogSettings;
  while (fs.getTags().includes(FOG_TAG)) fs.pop(FOG_TAG);
  if (want) fs.push(want, FOG_TAG);
  currentFog.set(player.id, want);
}

// ---------- Vibrant Visuals lighting (only visible with Vibrant Visuals on) ----------
const MOON_LUX = { new: 0.0001, crescent: 0.05, quarter: 0.12, gibbous: 0.25, full: 0.4, super: 0.6, micro: 0.25, blood: 0.02, honey: 0.4, loykrathong: 0.7 };
const MOON_COLOR = { blood: { red: 0.8, green: 0.15, blue: 0.1 }, honey: { red: 1, green: 0.8, blue: 0.45 }, loykrathong: { red: 1, green: 0.85, blue: 0.65 } };
const AMBIENT_LUX = [0.01, 0.005, 0.002, 0.0001]; // per darkness level
let lightingKey = "";

function updateLighting(s, st) {
  const key = st.kind === "night" ? `${st.profile}_${s.density}` : "default";
  if (key === lightingKey) return;
  lightingKey = key;
  for (const biome of BiomeTypes.getAll()) {
    try {
      const l = getBiomeLighting(biome);
      if (key === "default") {
        l.resetAmbientIlluminance(); l.resetMoonIlluminance(); l.resetMoonColor();
      } else {
        l.setAmbientIlluminance(AMBIENT_LUX[s.density]);
        l.setMoonIlluminance(MOON_LUX[st.profile] ?? 0.4);
        if (MOON_COLOR[st.profile]) l.setMoonColor(MOON_COLOR[st.profile]); else l.resetMoonColor();
      }
    } catch (e) { /* biome without lighting data */ }
  }
}

system.runInterval(() => {
  const s = getSettings();
  const st = worldState();
  updateLighting(s, st);
  for (const player of world.getAllPlayers()) {
    try { updateFog(player, s, st); } catch (e) { /* player not ready */ }
  }
}, 20);

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
}, 2);

// Other add-ons can put the held light out: /scriptevent realdarkness:extinguish
// (run as / targeting a player, or from the console to affect everyone).
system.afterEvents.scriptEventReceive.subscribe(({ id, sourceEntity }) => {
  if (id !== `${NS}:extinguish`) return;
  const targets = sourceEntity?.typeId === "minecraft:player" ? [sourceEntity] : world.getAllPlayers();
  for (const p of targets) extinguish(/** @type {import("@minecraft/server").Player} */ (p));
});

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  removeGroup(playerId);
  extinguished.delete(playerId);
  currentFog.delete(playerId);
});

// ---------- settings item ----------
world.afterEvents.playerSpawn.subscribe(({ player, initialSpawn }) => {
  if (!initialSpawn) return;
  currentFog.delete(player.id);
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
    .dropdown(
      { translate: "realdarkness.form.density" },
      DENSITIES.map((d) => ({ translate: `realdarkness.form.density.${d}` })),
      { defaultValueIndex: s.density }
    )
    .toggle({ translate: "realdarkness.form.held_light" }, { defaultValue: s.heldLight })
    .show(player)
    .then((res) => {
      if (res.canceled || !res.formValues) return;
      const [fog, density, heldLight] = res.formValues;
      saveSettings({ fog: !!fog, density: Number(density), heldLight: !!heldLight });
      currentFog.clear(); // re-apply fog for everyone
      lightingKey = "";   // re-apply lighting
      player.sendMessage({ translate: "realdarkness.msg.saved" });
    });
});
