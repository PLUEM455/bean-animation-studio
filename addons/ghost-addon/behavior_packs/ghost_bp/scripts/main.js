import { world, system, EntityDamageCause } from "@minecraft/server";

// ---- Agreed design values ---------------------------------------------------
const PEEK_RANGE = 16;      // ghost peeks from at most 16 blocks away
const LOOK_DOT = 0.96;      // view cone (about 16 degrees) that counts as "looking at" the ghost
const NEXT_PEEK_MIN = 20;   // ticks: random gap before the next peek (1 s technical guard, not a design cooldown)
const NEXT_PEEK_MAX = 200;  // ticks: up to 10 s
const BUSY_TIMEOUT = 600;   // ticks: safety reset if a reaction never reports it finished

const MAIN = "foleypeep:mr_foleypeep";
const GIANT = "foleypeep:giant";
const MIMIC = "foleypeep:mimic";
const POSE = { IDLE: 0, PEEK: 1, ATTACK: 2, JUMPSCARE: 3 };
const SND = {
  peek: "foleypeep.peek",
  caught: "foleypeep.caught",
  fakeLaugh: "foleypeep.fake_laugh",
  attack: "foleypeep.attack",
  doubleFake: "foleypeep.double_fake",
  chase: "foleypeep.chase",
  behind: "foleypeep.behind",
  ambient: "foleypeep.ambient",
};

const owned = new Set();   // ids of entities this script spawned or adopted
const states = new Map();  // playerId -> per-player ghost state

// ---- Helpers ----------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const mul = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const flat = (a) => norm({ x: a.x, y: 0, z: a.z });

function safe(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
const alive = (e) => safe(() => !!e && e.isValid) === true;

function stateOf(player) {
  let s = states.get(player.id);
  if (!s) {
    const now = system.currentTick;
    s = { ghost: undefined, busy: false, busyUntil: 0, nextPeek: now + randInt(NEXT_PEEK_MIN, NEXT_PEEK_MAX), peekSoundAt: 0, nextFace: 0, nextClean: 0 };
    states.set(player.id, s);
  }
  return s;
}

function spawnOwned(dim, type, loc) {
  const e = dim.spawnEntity(type, loc);
  owned.add(e.id);
  return e;
}
const setPose = (e, pose) => safe(() => e.setProperty("foleypeep:pose", pose));
const face = (e, player) => safe(() => e.teleport(e.location, { facingLocation: player.getHeadLocation() }));
const sound = (dim, id, loc, volume = 1, pitch = 1) => safe(() => dim.playSound(id, loc, { volume, pitch }));

function vanish(e, soundId) {
  if (!alive(e)) return;
  const loc = e.location;
  if (soundId) sound(e.dimension, soundId, loc);
  safe(() => e.dimension.spawnParticle("minecraft:large_explosion", { x: loc.x, y: loc.y + 1.5, z: loc.z }));
  owned.delete(e.id);
  safe(() => e.remove());
}

// Run fn every tick until it returns true (or throws).
function every(fn) {
  const id = system.runInterval(() => {
    let stop = true;
    try {
      stop = fn();
    } catch {
      stop = true;
    }
    if (stop) system.clearRun(id);
  }, 1);
}
const after = (ticks, fn) => system.runTimeout(() => safe(fn), ticks);

// How directly the player is looking at a point (1 = dead centre).
function lookDot(player, point) {
  const to = sub(point, player.getHeadLocation());
  return { d: len(to), dot: dot(norm(to), player.getViewDirection()) };
}
function isLookingAt(player, e, range = PEEK_RANGE) {
  const { d, dot: k } = lookDot(player, add(e.location, { x: 0, y: 1.8, z: 0 }));
  return d <= range && d >= 0.3 && k >= LOOK_DOT;
}

const blockAt = (dim, loc) => safe(() => dim.getBlock(loc));
function passable(dim, loc) {
  const b = blockAt(dim, loc);
  return !!b && (b.isAir || b.isLiquid);
}
function solid(dim, loc) {
  const b = blockAt(dim, loc);
  return !!b && !b.isAir && !b.isLiquid;
}

// Random spot around the player with 3 blocks of air or water (so water, high places and
// corners all work). needCover = only spots next to a solid block (door frames, corners, walls).
function findSpot(player, minD, maxD, needCover) {
  const dim = player.dimension;
  const p = player.location;
  for (let i = 0; i < 24; i++) {
    const a = rand(0, Math.PI * 2);
    const dist = rand(minD, maxD);
    const x = Math.floor(p.x + Math.cos(a) * dist);
    const z = Math.floor(p.z + Math.sin(a) * dist);
    const y0 = Math.floor(p.y) + randInt(-3, 6);
    for (let y = y0; y < y0 + 4; y++) {
      if (!passable(dim, { x, y, z }) || !passable(dim, { x, y: y + 1, z }) || !passable(dim, { x, y: y + 2, z })) continue;
      if (needCover && ![[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => solid(dim, { x: x + dx, y: y + 1, z: z + dz }))) continue;
      const spot = { x: x + 0.5, y, z: z + 0.5 };
      if (len(sub(spot, p)) > maxD) continue;
      // Do not appear right where the player is already looking.
      if (lookDot(player, add(spot, { x: 0, y: 1.8, z: 0 })).dot > 0.8) continue;
      return spot;
    }
  }
  return undefined;
}

function hit(player, by, damage) {
  safe(() => player.applyDamage(damage, { cause: EntityDamageCause.entityAttack, damagingEntity: by }));
  safe(() => player.addEffect("blindness", 50, { amplifier: 0, showParticles: false }));
  safe(() => player.addEffect("darkness", 120, { amplifier: 0, showParticles: false }));
  safe(() => player.addEffect("slowness", 40, { amplifier: 1, showParticles: false }));
  safe(() => player.runCommand("camerashake add @s 0.8 0.6 positional"));
  safe(() =>
    player.camera.fade({ fadeColor: { red: 0.35, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.15, fadeOutTime: 0.5 } })
  );
}

// Move e toward the player by up to `step` blocks, stopping `gap` blocks short. Returns distance left.
function stepToward(e, player, step, gap) {
  const to = sub(player.location, e.location);
  const d = len(to);
  const move = Math.min(step, Math.max(0, d - gap));
  safe(() => e.teleport(add(e.location, mul(norm(to), move)), { facingLocation: player.getHeadLocation() }));
  return d - move;
}

// Rush at the player over `ticks` ticks, then call onArrive(reached).
function lunge(e, player, ticks, pose, soundId, onArrive) {
  setPose(e, pose);
  if (soundId) sound(e.dimension, soundId, e.location);
  let t = ticks;
  every(() => {
    if (!alive(e) || !alive(player)) {
      onArrive(false);
      return true;
    }
    stepToward(e, player, Math.max(0.4, len(sub(player.location, e.location)) / Math.max(1, t)), 1.2);
    if (--t <= 0) {
      onArrive(true);
      return true;
    }
    return false;
  });
}

// Walk/float at the player; hit when close, give up after maxTicks.
function hunt(e, player, speed, maxTicks, damage, chaseVolume, done) {
  let t = 0;
  every(() => {
    if (!alive(e) || !alive(player)) {
      vanish(e);
      done();
      return true;
    }
    if (t % 40 === 0) sound(e.dimension, SND.chase, e.location, chaseVolume);
    if (stepToward(e, player, speed, 1.4) <= 1.5) {
      setPose(e, POSE.JUMPSCARE);
      sound(player.dimension, SND.attack, player.location);
      hit(player, e, damage);
      after(10, () => {
        vanish(e);
        done();
      });
      return true;
    }
    if (++t > maxTicks) {
      vanish(e, SND.fakeLaugh);
      done();
      return true;
    }
    return false;
  });
}

// ---- The 8 agreed reactions (equal chance) ----------------------------------
const REACTIONS = [
  // 1. Just vanish.
  (player, g, done) => {
    vanish(g, SND.caught);
    done();
  },

  // 2. Fake attack, then vanish.
  (player, g, done) =>
    lunge(g, player, 12, POSE.ATTACK, SND.fakeLaugh, () => {
      vanish(g);
      done();
    }),

  // 3. Real attack: chase, then hit.
  (player, g, done) => {
    setPose(g, POSE.ATTACK);
    hunt(g, player, 0.3, 160, 6, 1, done);
  },

  // 4. Double fake: fake attack, vanish, then come back in the player's face for real.
  (player, g, done) =>
    lunge(g, player, 12, POSE.ATTACK, SND.fakeLaugh, () => {
      vanish(g);
      after(randInt(40, 100), () => {
        if (!alive(player)) return done();
        const pos = add(player.location, mul(flat(player.getViewDirection()), 1.3));
        const e = spawnOwned(player.dimension, MAIN, pos);
        setPose(e, POSE.JUMPSCARE);
        face(e, player);
        sound(player.dimension, SND.doubleFake, player.location);
        after(4, () => hit(player, e, 6));
        after(24, () => {
          vanish(e);
          done();
        });
      });
    }),

  // 5. Many at once (3 to 5), they all rush; one of them really hits.
  (player, g, done) => {
    vanish(g);
    const crowd = [];
    const n = randInt(3, 5);
    for (let i = 0; i < n; i++) {
      const spot = findSpot(player, 5, 10, false);
      if (!spot) continue;
      const e = spawnOwned(player.dimension, MAIN, spot);
      setPose(e, POSE.PEEK);
      face(e, player);
      sound(e.dimension, SND.peek, spot, 0.8);
      crowd.push(e);
    }
    if (crowd.length === 0) return done();
    let left = crowd.length;
    after(50, () =>
      crowd.forEach((e, i) =>
        lunge(e, player, 10, POSE.ATTACK, i === 0 ? SND.attack : i === 1 ? SND.fakeLaugh : undefined, (reached) => {
          if (reached && i === 0) hit(player, e, 6);
          vanish(e);
          if (--left === 0) done();
        })
      )
    );
  },

  // 6. Giant form: stares from the distance, then rushes.
  (player, g, done) => {
    vanish(g);
    const pos = add(player.location, mul(flat(player.getViewDirection()), rand(9, 12)));
    const e = spawnOwned(player.dimension, GIANT, pos);
    setPose(e, POSE.IDLE);
    face(e, player);
    sound(player.dimension, SND.attack, pos, 1.5, 0.5);
    after(60, () =>
      lunge(e, player, 14, POSE.JUMPSCARE, SND.attack, (reached) => {
        if (reached) hit(player, e, 8);
        after(8, () => {
          vanish(e);
          done();
        });
      })
    );
  },

  // 7. Player-like form: walks up slowly from behind.
  (player, g, done) => {
    vanish(g);
    const pos = sub(player.location, mul(flat(player.getViewDirection()), rand(7, 9)));
    const e = spawnOwned(player.dimension, MIMIC, pos);
    setPose(e, POSE.IDLE);
    face(e, player);
    hunt(e, player, 0.07, 300, 5, 0.6, done);
  },

  // 8. Vanish, then appear right behind the player; turning around triggers the jumpscare.
  (player, g, done) => {
    vanish(g);
    after(randInt(20, 50), () => {
      if (!alive(player)) return done();
      const pos = sub(player.location, mul(flat(player.getViewDirection()), 1.3));
      const e = spawnOwned(player.dimension, MAIN, pos);
      setPose(e, POSE.PEEK);
      face(e, player);
      sound(player.dimension, SND.behind, player.location);
      let t = 0;
      every(() => {
        if (!alive(e) || !alive(player)) {
          vanish(e);
          done();
          return true;
        }
        if (t % 5 === 0) face(e, player);
        if (isLookingAt(player, e, 4)) {
          setPose(e, POSE.JUMPSCARE);
          sound(player.dimension, SND.attack, player.location);
          hit(player, e, 6);
          after(10, () => {
            vanish(e);
            done();
          });
          return true;
        }
        if (++t > 80) {
          vanish(e);
          done();
          return true;
        }
        return false;
      });
    });
  },
];

function react(player, s, g, now) {
  s.busy = true;
  s.busyUntil = now + BUSY_TIMEOUT;
  s.ghost = undefined;
  let finished = false;
  const done = () => {
    if (finished) return;
    finished = true;
    s.busy = false;
    s.nextPeek = system.currentTick + randInt(NEXT_PEEK_MIN, NEXT_PEEK_MAX);
  };
  try {
    REACTIONS[randInt(0, REACTIONS.length - 1)](player, g, done);
  } catch {
    vanish(g);
    done();
  }
}

function spawnPeek(player, s, now) {
  const spot = findSpot(player, 6, PEEK_RANGE, true) ?? findSpot(player, 6, PEEK_RANGE, false);
  const g = spot && safe(() => spawnOwned(player.dimension, MAIN, spot));
  if (!g) {
    s.nextPeek = now + 40;
    return;
  }
  setPose(g, POSE.PEEK);
  face(g, player);
  s.ghost = g;
  s.peekSoundAt = now + randInt(20, 80);
}

// Entities left over from a reload or placed with /summon or a spawn egg:
// a free Mr. Foleypeep becomes this player's peeking ghost, anything else is removed.
function adoptOrClean(player, s) {
  const found = safe(() => player.dimension.getEntities({ location: player.location, maxDistance: 64, families: ["foleypeep"] })) ?? [];
  for (const e of found) {
    if (owned.has(e.id)) continue;
    if (e.typeId === MAIN && !s.busy && !alive(s.ghost)) {
      owned.add(e.id);
      s.ghost = e;
      setPose(e, POSE.PEEK);
      s.peekSoundAt = system.currentTick + 20;
    } else {
      safe(() => e.remove());
    }
  }
}

// ---- Main loop: peeking and "player looked at me" ---------------------------
system.runInterval(() => {
  const now = system.currentTick;
  for (const player of world.getAllPlayers()) {
    const s = stateOf(player);
    if (now >= s.nextClean) {
      s.nextClean = now + 40;
      adoptOrClean(player, s);
    }
    if (s.busy) {
      if (now <= s.busyUntil) continue;
      s.busy = false;
    }
    const g = s.ghost;
    if (!alive(g)) {
      s.ghost = undefined;
      if (now >= s.nextPeek) spawnPeek(player, s, now);
      continue;
    }
    if (g.dimension.id !== player.dimension.id || len(sub(g.location, player.location)) > PEEK_RANGE + 8) {
      vanish(g);
      s.ghost = undefined;
      s.nextPeek = now + randInt(NEXT_PEEK_MIN, NEXT_PEEK_MAX);
      continue;
    }
    if (now >= s.nextFace) {
      s.nextFace = now + 10;
      face(g, player);
    }
    if (now >= s.peekSoundAt) {
      sound(g.dimension, SND.peek, g.location, 0.7);
      s.peekSoundAt = now + randInt(60, 140);
    }
    if (isLookingAt(player, g)) react(player, s, g, now);
  }
}, 2);

// ---- Dread ambience: louder the closer any Foleypeep is ---------------------
system.runInterval(() => {
  for (const player of world.getAllPlayers()) {
    const near = safe(() => player.dimension.getEntities({ location: player.location, maxDistance: PEEK_RANGE, families: ["foleypeep"] })) ?? [];
    if (near.length === 0) continue;
    let d = PEEK_RANGE;
    for (const e of near) d = Math.min(d, len(sub(e.location, player.location)));
    safe(() => player.playSound(SND.ambient, { volume: 0.15 + 0.85 * (1 - d / PEEK_RANGE) }));
  }
}, 40);

world.afterEvents.playerLeave.subscribe((ev) => states.delete(ev.playerId));
