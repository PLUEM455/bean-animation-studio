import { world, system } from "@minecraft/server";

const SNAKE = "horror:giant_anaconda";
const RANGE = 40; // blocks: heartbeat starts when an anaconda is this close
const near = new Map(); // player id -> { dist, next } (next = tick of the next heartbeat)

// Bloodbath-style: once the anaconda kills a player it vanishes (it can spawn again later).
world.afterEvents.entityDie.subscribe(
  (ev) => {
    const killer = ev.damageSource.damagingEntity;
    if (killer?.typeId !== SNAKE) return;
    try {
      killer.triggerEvent("horror:vanish");
    } catch (e) {
      // killer already unloaded/removed
    }
  },
  { entityTypes: ["minecraft:player"] }
);

world.afterEvents.playerLeave.subscribe((ev) => near.delete(ev.playerId));

// Every 10 ticks: find the closest anaconda; darkness while it is staring (mark_variant 1 = stalking).
function scan(player) {
  let snake;
  try {
    snake = player.dimension.getEntities({ type: SNAKE, location: player.location, maxDistance: RANGE, closest: 1 })[0];
  } catch (e) {
    return undefined;
  }
  if (!snake) return undefined;
  const a = player.location, b = snake.location;
  const dist = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  const stalking = snake.getComponent("minecraft:mark_variant")?.value === 1;
  if (stalking && dist < 24) player.addEffect("darkness", 60, { amplifier: 0, showParticles: false });
  const prev = near.get(player.id);
  return { dist, next: prev ? prev.next : system.currentTick };
}

// Every 2 ticks: heartbeat that speeds up and gets louder as the anaconda gets closer.
system.runInterval(() => {
  const tick = system.currentTick;
  for (const player of world.getAllPlayers()) {
    if (tick % 10 === 0) {
      const s = scan(player);
      if (s) near.set(player.id, s);
      else near.delete(player.id);
    }
    const s = near.get(player.id);
    if (!s || tick < s.next) continue;
    const t = Math.min(1, s.dist / RANGE); // 0 = touching, 1 = edge of range
    player.playSound("giant_anaconda.heartbeat", { volume: 1.0 - 0.6 * t, pitch: 1.1 - 0.15 * t });
    s.next = tick + Math.round(8 + 22 * t); // 8..30 ticks between beats (~150..40 bpm)
  }
}, 2);
