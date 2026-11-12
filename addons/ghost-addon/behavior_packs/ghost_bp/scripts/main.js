import { world, system } from "@minecraft/server";

const GHOST_TYPE = "ghost:ghost";
const SCARE_RANGE = 6;        // blocks: distance at which a ghost scares a player
const SCARE_COOLDOWN = 100;   // ticks (5 seconds) between scares per player
const CHECK_INTERVAL = 10;    // ticks between checks

const lastScare = new Map();  // playerId -> tick of last scare

system.runInterval(() => {
  const now = system.currentTick;

  for (const player of world.getAllPlayers()) {
    const ghosts = player.dimension.getEntities({
      type: GHOST_TYPE,
      location: player.location,
      maxDistance: SCARE_RANGE,
    });
    if (ghosts.length === 0) continue;

    const last = lastScare.get(player.id) ?? -Infinity;
    if (now - last < SCARE_COOLDOWN) continue;
    lastScare.set(player.id, now);

    // Heavy scare: blind + darkness, loud sound, particle burst at the nearest ghost.
    player.addEffect("blindness", 60, { amplifier: 1, showParticles: false });
    player.addEffect("darkness", 100, { amplifier: 1, showParticles: false });
    player.playSound("mob.ghast.scream", { volume: 2.0, pitch: 0.6 });
    player.dimension.spawnParticle("minecraft:huge_explosion_emitter", ghosts[0].location);
    player.sendMessage("§cผีกำลังตามคุณอยู่!");
  }

  // Clean up players who left the world.
  for (const id of lastScare.keys()) {
    if (!world.getAllPlayers().some((p) => p.id === id)) lastScare.delete(id);
  }
}, CHECK_INTERVAL);
