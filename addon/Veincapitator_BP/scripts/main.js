import { world, system } from "@minecraft/server";
import { toolKindFor, toolMatches, collectVein, extraBudget } from "./veinCore.js";
import { readSettings, writeSetting, clampLimit, LIMIT_MIN, LIMIT_MAX } from "./settings.js";

// Breaking a block: find the connected blocks of the same type and break them too.
// Runs in system.run so we read the item and durability after the game has applied its own hit.
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const { player, block, brokenBlockPermutation, dimension } = ev;
  const brokenId = brokenBlockPermutation?.type?.id;
  if (!toolKindFor(brokenId)) return;

  const start = { x: block.location.x, y: block.location.y, z: block.location.z };

  system.run(() => {
    const settings = readSettings(player);
    if (!settings.enabled) return;
    if (settings.sneak && !player.isSneaking) return;

    const kind = toolKindFor(brokenId);
    const inv = player.getComponent("minecraft:inventory")?.container;
    if (!inv) return;
    const slot = player.selectedSlotIndex;
    const item = inv.getItem(slot);
    if (!item || !toolMatches(item.typeId, kind)) return;

    const dur = item.getComponent("minecraft:durability");
    const remaining = dur ? dur.maxDurability - dur.damage : Infinity;
    const budget = extraBudget(settings.limit, remaining);
    if (budget <= 0) return;

    const matches = (p) => {
      try {
        return dimension.getBlock(p)?.typeId === brokenId;
      } catch {
        return false; // position outside loaded/valid world
      }
    };
    const vein = collectVein(start, matches, budget);
    if (vein.length === 0) return;

    // "destroy" makes setblock drop the items like a normal break.
    for (const p of vein) {
      dimension.runCommand(`setblock ${p.x} ${p.y} ${p.z} air destroy`);
    }
    if (dur) {
      dur.damage += vein.length;
      inv.setItem(slot, item);
    }
  });
});

// Chat commands: !vein on|off | limit <n> | sneak on|off | status
world.beforeEvents.chatSend.subscribe((ev) => {
  const text = ev.message.trim();
  if (!/^!vein(\s|$)/i.test(text)) return;
  ev.cancel = true;
  const player = ev.sender;
  const args = text.split(/\s+/).slice(1).map((s) => s.toLowerCase());
  system.run(() => handleCommand(player, args));
});

function handleCommand(player, [cmd, val]) {
  const say = (msg) => player.sendMessage(`§a[Veincapitator]§r ${msg}`);
  const usage = `ใช้: !vein on|off | limit <${LIMIT_MIN}-${LIMIT_MAX}> | sneak on|off | status`;
  const onOff = (v) => (v === "on" ? true : v === "off" ? false : undefined);

  switch (cmd) {
    case "on":
    case "off":
      writeSetting(player, "enabled", cmd === "on");
      return say(`เปิดใช้งาน: ${cmd === "on" ? "ใช่" : "ไม่"}`);

    case "sneak": {
      const v = onOff(val);
      if (v === undefined) return say(usage);
      writeSetting(player, "sneak", v);
      return say(`ต้องย่อตัว (sneak) ก่อนทำงาน: ${v ? "ใช่" : "ไม่"}`);
    }

    case "limit": {
      if (!/^\d+$/.test(val ?? "")) return say(usage);
      const n = clampLimit(val);
      writeSetting(player, "limit", n);
      return say(`จำนวนบล็อกสูงสุดต่อครั้ง: ${n}`);
    }

    case "status": {
      const s = readSettings(player);
      return say(`เปิด: ${s.enabled ? "ใช่" : "ไม่"} | จำนวนสูงสุด: ${s.limit} | ต้องย่อตัว: ${s.sneak ? "ใช่" : "ไม่"}`);
    }

    default:
      return say(usage);
  }
}
