// Real Darkness — behavior script
import { world, system, EquipmentSlot, PlayerPermissionLevel, BlockPermutation } from "@minecraft/server";
import { ModalFormData } from "@minecraft/server-ui";

const NS = "realdarkness";
const FOG_TAG = "realdarkness";
const SETTINGS_ITEM = "realdarkness:settings";
const DENSITIES = ["thin", "medium", "thick"];

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

// ---------- night fog ----------
const currentFog = new Map(); // player.id -> fog id or ""

function wantedFog(player, s) {
  if (!s.fog || player.dimension.id !== "minecraft:overworld") return "";
  const t = world.getTimeOfDay();
  if (t >= 13000 && t < 23000) return `${NS}:night_${DENSITIES[s.density]}`;
  if (t >= 12000) return `${NS}:dusk`;
  return "";
}

function updateFog(player, s) {
  const want = wantedFog(player, s);
  if ((currentFog.get(player.id) ?? "") === want) return;
  const fs = player.fogSettings;
  while (fs.getTags().includes(FOG_TAG)) fs.pop(FOG_TAG);
  if (want) fs.push(want, FOG_TAG);
  currentFog.set(player.id, want);
}

system.runInterval(() => {
  const s = getSettings();
  for (const player of world.getAllPlayers()) {
    try { updateFog(player, s); } catch (e) { /* player not ready */ }
  }
}, 20);

// ---------- held light ----------
const placedLight = new Map(); // player.id -> { dim, x, y, z, level }

function heldLevel(player) {
  const eq = player.getComponent("minecraft:equippable");
  if (!eq) return 0;
  let level = 0;
  for (const slot of [EquipmentSlot.Mainhand, EquipmentSlot.Offhand]) {
    const item = eq.getEquipment(slot);
    if (item) level = Math.max(level, LIGHT_ITEMS[item.typeId] ?? 0);
  }
  return level;
}

function removeLight(rec) {
  try {
    const block = world.getDimension(rec.dim).getBlock(rec);
    if (block && block.typeId === `minecraft:light_block_${rec.level}`) block.setType("minecraft:air");
  } catch (e) { /* chunk unloaded */ }
}

function updateHeldLight(player, s) {
  const prev = placedLight.get(player.id);
  const level = s.heldLight ? heldLevel(player) : 0;
  const head = player.getHeadLocation();
  const pos = { x: Math.floor(head.x), y: Math.floor(head.y), z: Math.floor(head.z) };
  const dim = player.dimension.id;

  if (prev && prev.level === level && prev.dim === dim && prev.x === pos.x && prev.y === pos.y && prev.z === pos.z) return;
  if (prev) { removeLight(prev); placedLight.delete(player.id); }
  if (level <= 0) return;

  const block = player.dimension.getBlock(pos);
  if (!block || !block.isAir) return;
  block.setPermutation(BlockPermutation.resolve(`minecraft:light_block_${level}`));
  placedLight.set(player.id, { dim, ...pos, level });
}

system.runInterval(() => {
  const s = getSettings();
  for (const player of world.getAllPlayers()) {
    try { updateHeldLight(player, s); } catch (e) { /* player not ready */ }
  }
}, 2);

world.afterEvents.playerLeave.subscribe(({ playerId }) => {
  const rec = placedLight.get(playerId);
  if (rec) removeLight(rec);
  placedLight.delete(playerId);
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
      player.sendMessage({ translate: "realdarkness.msg.saved" });
    });
});
