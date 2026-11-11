// Mr. Peeping Tom - stalker director.
// Stable @minecraft/server 2.11.0 only (no Beta APIs / experiments needed).
//
// Performance budget (anti-lag):
//   * one director pass per player every 10 ticks (0.5 s)
//   * at most one raycast + a few getBlock calls per pass
//   * area scans (lights / doors / leaves) run through system.runJob, spread over many ticks
//   * environmental events fire at most once every 12-45 s per player
import { world, system, BlockPermutation, EasingType, SignSide } from "@minecraft/server";

const TOM = "custom:mr_peeping_tom";
const TICK = 10;
let beat = 0; // director pass counter (one pass = 0.5 s)
const WRATH_KEY = "ppt:wrath";
const OWNER_KEY = "ppt:owner";

// ------------------------------------------------------------------ utils --
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const secs = (s) => Math.round(s * 20);
const now = () => system.currentTick;
const v3 = (x, y, z) => ({ x, y, z });
const add = (a, b) => v3(a.x + b.x, a.y + b.y, a.z + b.z);
const sub = (a, b) => v3(a.x - b.x, a.y - b.y, a.z - b.z);
const mul = (a, s) => v3(a.x * s, a.y * s, a.z * s);
const len = (a) => Math.hypot(a.x, a.y, a.z);
const flat = (a) => {
  const l = Math.hypot(a.x, a.z) || 1;
  return v3(a.x / l, 0, a.z / l);
};
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const fl = (a) => v3(Math.floor(a.x), Math.floor(a.y), Math.floor(a.z));

function safe(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}

function getBlock(dim, x, y, z) {
  return safe(() => dim.getBlock({ x: Math.floor(x), y: Math.floor(y), z: Math.floor(z) }));
}

const SOLID_EXCEPTIONS = /grass_block|rooted_dirt|mushroom_block|sandstone|stem$|_planks|_log|_wood$/;
const PASSABLE =
  /grass|fern|flower|tulip|orchid|allium|bluet|daisy|poppy|dandelion|torch|sign|banner|carpet|snow_layer|vine|button|lever|rail|sapling|bush|roots|sprouts|mushroom|lily|cornflower|rose|peony|lilac|seagrass|kelp|web|pressure_plate|tripwire|redstone_wire|wheat|carrots|potatoes|beetroot|reeds|pitcher|leaf_litter|petals|wildflowers|firefly|sculk_vein|glow_lichen|moss_carpet|scaffolding|ladder/;

function isSolid(b) {
  if (!b || b.isAir || b.isLiquid) return false;
  const id = b.typeId;
  if (SOLID_EXCEPTIONS.test(id)) return true;
  return !PASSABLE.test(id);
}
function isFree(b) {
  return !!b && !isSolid(b) && b.typeId !== "minecraft:lava";
}

/** Find a spot to stand on near (x, ?, z), scanning down from y+up to y-down. */
function findStand(dim, x, y, z, up = 6, down = 10) {
  let free = 0;
  for (let yy = Math.floor(y) + up; yy >= Math.floor(y) - down; yy--) {
    const b = getBlock(dim, x, yy, z);
    if (!b) return undefined;
    if (isSolid(b)) {
      if (free >= 2 && !/magma|lava|fire|cactus|campfire/.test(b.typeId)) {
        return { loc: v3(Math.floor(x) + 0.5, yy + 1, Math.floor(z) + 0.5), tall: free >= 3 };
      }
      free = 0;
    } else if (b.typeId === "minecraft:lava") free = 0;
    else free++;
  }
  return undefined;
}

// --------------------------------------------------------------- wrath ----
function getWrath(p) {
  const w = p.getDynamicProperty(WRATH_KEY);
  return typeof w === "number" ? w : 0;
}
function tierOf(w) {
  return w >= 8 ? 3 : w >= 4 ? 2 : 1;
}
const TIER_MSG = {
  2: "§8§oYou hear something moving inside the walls...",
  3: "§4§oHe is no longer polite.",
};
function setWrath(p, value) {
  const before = tierOf(getWrath(p));
  const w = Math.max(0, Math.min(12, value));
  p.setDynamicProperty(WRATH_KEY, w);
  const after = tierOf(w);
  if (after > before && TIER_MSG[after]) safe(() => p.onScreenDisplay.setActionBar(TIER_MSG[after]));
}
function addWrath(p, d) {
  setWrath(p, getWrath(p) + d);
}

// -------------------------------------------------------- player state ----
/** @type {Map<string, any>} */
const STATE = new Map();

function stateOf(p) {
  let st = STATE.get(p.id);
  if (!st) {
    const t = now();
    st = {
      tomId: undefined,
      cd: t + secs(rand(45, 90)),
      mode: "",
      pose: "",
      size: "tall",
      seen: 0,
      seenWrathNight: false,
      huntStart: 0,
      huntCD: t + secs(60),
      hurt: 0,
      busyUntil: 0,
      scareCD: t + secs(90),
      cornerCD: t + secs(240),
      envNext: t + secs(rand(25, 40)),
      voiceNext: t + secs(rand(30, 60)),
      tapNext: t + secs(rand(60, 120)),
      droneNext: 0,
      darkNext: 0,
      petNext: 0,
      glitchNext: 0,
      creepNext: t + secs(10),
      signCD: t + secs(120),
      oreCD: t + secs(120),
      lightCD: t,
      observeEnd: 0,
      doorHits: 0,
      wasNight: isNightTime(), // no free wrath just for joining at night
      surveying: false,
      distractedUntil: 0,
      doorsOn: false,
    };
    STATE.set(p.id, st);
    // fresh session: clear any leftover Tom bound to this player
    safe(() => {
      for (const e of p.dimension.getEntities({ type: TOM, location: p.location, maxDistance: 160 })) {
        if (e.getDynamicProperty(OWNER_KEY) === p.id) e.remove();
      }
    });
  }
  return st;
}

function tomOf(st) {
  if (!st.tomId) return undefined;
  const e = safe(() => world.getEntity(st.tomId));
  if (!e || !e.isValid) {
    st.tomId = undefined;
    return undefined;
  }
  return e;
}

function isNightTime() {
  const t = world.getTimeOfDay();
  return t >= 12600 && t < 23300;
}

// -------------------------------------------------------------- senses ----
/** visible: in view cone + line of sight. direct: looking straight at him. */
function sight(p, tom) {
  const head = p.getHeadLocation();
  const tgt = add(tom.location, v3(0, tom.getProperty("ppt:pose") === "crawl" ? 0.6 : 1.9, 0));
  const v = sub(tgt, head);
  const d = len(v);
  if (d > 80) return { visible: false, direct: false, d };
  const c = dot(v, p.getViewDirection()) / d;
  if (c < 0.55) return { visible: false, direct: false, d };
  const hit = safe(() =>
    p.dimension.getBlockFromRay(head, mul(v, 1 / d), {
      maxDistance: Math.max(0.5, d - 0.8),
      includeLiquidBlocks: false,
      includePassableBlocks: false,
    })
  );
  if (hit) return { visible: false, direct: false, d };
  return { visible: true, direct: c > 0.975 || (d < 6 && c > 0.9), d };
}

function healthFrac(p) {
  const h = p.getComponent("minecraft:health");
  return h ? h.currentValue / h.effectiveMax : 1;
}

function isolated(p) {
  return !world.getAllPlayers().some((o) => o.id !== p.id && o.dimension.id === p.dimension.id && len(sub(o.location, p.location)) < 40);
}

function headroom(dim, loc) {
  const b1 = getBlock(dim, loc.x, loc.y + 1, loc.z);
  const b2 = getBlock(dim, loc.x, loc.y + 2, loc.z);
  if (isSolid(b1)) return 1;
  if (isSolid(b2)) return 2;
  return 3;
}

function ceilingAbove(dim, loc, max = 7) {
  for (let i = 2; i <= max; i++) {
    if (isSolid(getBlock(dim, loc.x, loc.y + i, loc.z))) return i;
  }
  return 0;
}

// -------------------------------------------------------------- visuals ----
function setPose(tom, st, pose) {
  if (st.pose === pose) return;
  st.pose = pose;
  safe(() => tom.setProperty("ppt:pose", pose));
}
function setMode(tom, st, mode) {
  if (st.mode === mode) return;
  st.mode = mode;
  safe(() => tom.triggerEvent("ppt:" + mode));
}
function setSize(tom, st, size) {
  if (st.size === size) return;
  st.size = size;
  safe(() => tom.triggerEvent("ppt:size_" + size));
}
function particle(dim, id, loc) {
  safe(() => dim.spawnParticle(id, loc));
}
function sound(p, id, loc, volume = 1, pitch = 1) {
  safe(() => p.playSound(id, loc ? { location: loc, volume, pitch } : { volume, pitch }));
}

// ------------------------------------------------------------- spawning ----
function spotAround(p, minD, maxD, hidden, tries = 8) {
  const dim = p.dimension;
  const view = flat(p.getViewDirection());
  const head = p.getHeadLocation();
  let fallback;
  for (let i = 0; i < tries; i++) {
    // prefer behind / beside the player
    const yaw = Math.atan2(view.z, view.x) + Math.PI + rand(-1.4, 1.4);
    const r = rand(minD, maxD);
    const x = p.location.x + Math.cos(yaw) * r;
    const z = p.location.z + Math.sin(yaw) * r;
    const s = findStand(dim, x, p.location.y, z, 7, 10);
    if (!s) continue;
    if (!hidden) return s;
    const v = sub(add(s.loc, v3(0, 1.9, 0)), head);
    const d = len(v);
    const ray = safe(() =>
      dim.getBlockFromRay(head, mul(v, 1 / d), { maxDistance: d - 0.5, includeLiquidBlocks: false, includePassableBlocks: false })
    );
    const outOfView = dot(v, p.getViewDirection()) / d < 0.3;
    if (ray || outOfView) return s;
    fallback = fallback || s;
  }
  return fallback;
}

function spawnTom(p, st, night, tier) {
  const dim = p.dimension;
  const band = !night ? [30, 50] : tier === 1 ? [22, 35] : tier === 2 ? [14, 28] : [10, 22];
  const s = spotAround(p, band[0], band[1], true, 10);
  if (!s) {
    st.cd = now() + secs(10);
    return undefined;
  }
  const tom = safe(() => dim.spawnEntity(TOM, s.loc));
  if (!tom) {
    st.cd = now() + secs(10);
    return undefined;
  }
  tom.setDynamicProperty(OWNER_KEY, p.id);
  st.tomId = tom.id;
  st.mode = "";
  st.pose = "";
  st.size = "tall";
  st.seen = 0;
  st.hurt = 0;
  st.doorsOn = false;
  st.huntStart = 0;
  if (!night) {
    setMode(tom, st, "observe");
    setPose(tom, st, "peek");
    st.observeEnd = now() + secs(rand(50, 110));
  } else {
    setMode(tom, st, "stalk");
    setPose(tom, st, "stalk");
  }
  if (!s.tall) setSize(tom, st, "hunch");
  safe(() => tom.teleport(s.loc, { facingLocation: p.getHeadLocation() }));
  return tom;
}

/** Twist into black smoke, then disappear. */
function vanish(p, st, tom, cdSeconds, line) {
  if (!tom || st.busyUntil > now()) return;
  const dim = tom.dimension;
  st.busyUntil = now() + 26;
  setMode(tom, st, "freeze");
  setPose(tom, st, "vanish");
  const loc = tom.location;
  sound(p, "ppt.smoke", loc, 1.0);
  if (line) sound(p, "ppt.voice.vanish", loc, 1.0);
  particle(dim, "ppt:black_smoke", add(loc, v3(0, 1, 0)));
  system.runTimeout(() => {
    safe(() => {
      if (tom.isValid) {
        particle(dim, "ppt:black_smoke", add(tom.location, v3(0, 0.8, 0)));
        tom.remove();
      }
    });
    st.tomId = undefined;
    st.busyUntil = 0;
  }, 24);
  st.cd = now() + secs(cdSeconds);
  st.huntStart = 0;
  st.seen = 0;
}

function startHunt(p, st, tom, tier) {
  if (now() < st.huntCD || st.busyUntil > now()) return;
  const dim = p.dimension;
  st.huntStart = now();
  st.huntCD = now() + secs(tier === 3 ? 35 : 55);
  st.doorHits = 0;
  // Tier 3 ceiling ambush: whisper "Look up." then drop from above, behind the player.
  const ceil = tier === 3 ? ceilingAbove(dim, p.location) : 0;
  if (ceil >= 4) {
    sound(p, "ppt.voice.lookup", add(p.getHeadLocation(), v3(0, 1.5, 0)), 1.0);
    st.busyUntil = now() + 22;
    system.runTimeout(() => {
      safe(() => {
        if (!tom.isValid || !p.isValid) return;
        const back = add(p.location, mul(flat(p.getViewDirection()), -2.2));
        const spot = v3(back.x, p.location.y + ceil - 2.4, back.z);
        if (isFree(getBlock(dim, spot.x, spot.y + 1, spot.z))) {
          tom.teleport(spot, { facingLocation: p.getHeadLocation() });
          setPose(tom, st, "climb");
          particle(dim, "ppt:soot", add(spot, v3(0, 2.2, 0)));
        }
        st.busyUntil = 0;
        beginChase(p, st, tom, tier);
      });
    }, 20);
    return;
  }
  beginChase(p, st, tom, tier);
}

function beginChase(p, st, tom, tier) {
  if (!st.huntStart) st.huntStart = now();
  setMode(tom, st, "hunt");
  setSize(tom, st, "hunch");
  setPose(tom, st, "sprint");
  if (tier >= 2 && !st.doorsOn) {
    st.doorsOn = true;
    safe(() => tom.triggerEvent("ppt:doors_on"));
  }
  sound(p, "ppt.breath", tom.location, 1.0);
}

// ------------------------------------------------------------ jumpscare ----
function jumpscare(p, st, tom, damaged) {
  if (!tom || !tom.isValid || now() < st.scareCD) return;
  const tier = tierOf(getWrath(p));
  st.scareCD = now() + secs(tier === 3 ? 50 : 80);
  st.busyUntil = now() + 34;
  const dim = p.dimension;
  const head = p.getHeadLocation();
  const fwd = flat(p.getViewDirection());
  const front = add(p.location, mul(fwd, 1.35));
  if (isFree(getBlock(dim, front.x, front.y, front.z)) && isFree(getBlock(dim, front.x, front.y + 1, front.z))) {
    safe(() => tom.teleport(front, { facingLocation: head }));
  }
  setMode(tom, st, "freeze");
  setPose(tom, st, "scare");
  const face = add(tom.location, v3(0, 1.95, 0));
  safe(() =>
    p.camera.setCamera("minecraft:free", {
      location: sub(head, mul(fwd, 0.15)),
      facingLocation: face,
      easeOptions: { easeTime: 0.12, easeType: EasingType.OutQuad },
    })
  );
  safe(() => p.runCommand("camerashake add @s 1.8 1.5 rotational"));
  safe(() => p.runCommand("camerashake add @s 0.6 1.5 positional"));
  safe(() => p.camera.fade({ fadeColor: { red: 0.25, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.05, holdTime: 0.05, fadeOutTime: 0.35 } }));
  sound(p, "ppt.screech", undefined, 1.0);
  sound(p, "ppt.voice.chuckle", undefined, 1.0);
  system.runTimeout(() => {
    safe(() => {
      if (!p.isValid) return;
      p.camera.fade({ fadeColor: { red: 0, green: 0, blue: 0 }, fadeTime: { fadeInTime: 0.1, holdTime: 0.3, fadeOutTime: 0.8 } });
    });
    system.runTimeout(() => {
      safe(() => {
        if (!p.isValid) return;
        p.camera.clear();
        p.addEffect("blindness", secs(2.5), { amplifier: 0, showParticles: false });
        p.addEffect("slowness", secs(4), { amplifier: 1, showParticles: false });
      });
      st.busyUntil = 0;
      const t = st.tomId ? safe(() => world.getEntity(st.tomId)) : undefined;
      if (t && t.isValid) vanish(p, st, t, tier === 3 ? rand(45, 90) : rand(80, 160), false);
    }, 6);
  }, 24);
  if (damaged) addWrath(p, 1);
}

// --------------------------------------------- environmental interactions --
const LIGHT = /(^minecraft:(torch|soul_torch|copper_torch|lantern|soul_lantern|campfire|soul_campfire))$|copper_lantern$/;
const DOOR = /_door$|^minecraft:wooden_door$|_trapdoor$|^minecraft:trapdoor$|fence_gate$/;
const NOT_DOOR = /iron_door|iron_trapdoor/;
const LEAVES = /leaves$/;
const GLASS = /glass/;

function survey(p, st, cb) {
  if (st.surveying) return;
  st.surveying = true;
  const dim = p.dimension;
  const c = fl(p.location);
  const res = { lights: [], doors: [], leaves: [] };
  function* job() {
    let n = 0;
    for (let dx = -14; dx <= 14; dx++) {
      for (let dz = -14; dz <= 14; dz++) {
        for (let dy = -5; dy <= 7; dy++) {
          const b = getBlock(dim, c.x + dx, c.y + dy, c.z + dz);
          if (b && !b.isAir && !b.isLiquid) {
            const id = b.typeId;
            const loc = v3(c.x + dx, c.y + dy, c.z + dz);
            if (LIGHT.test(id) && res.lights.length < 24) res.lights.push(loc);
            else if (DOOR.test(id) && !NOT_DOOR.test(id) && res.doors.length < 16 && Math.abs(dx) <= 12 && Math.abs(dz) <= 12)
              res.doors.push(loc);
            else if (LEAVES.test(id) && res.leaves.length < 40 && Math.random() < 0.35) res.leaves.push(loc);
          }
          if (++n % 200 === 0) yield;
        }
      }
    }
    st.surveying = false;
    if (p.isValid) safe(() => cb(res));
  }
  system.runJob(job());
}

function extinguish(p, st, lights, tier) {
  const dim = p.dimension;
  const max = tier === 1 ? 1 : tier === 2 ? 3 : 5;
  let n = 0;
  for (const loc of lights.sort(() => Math.random() - 0.5)) {
    if (n >= max) break;
    const b = getBlock(dim, loc.x, loc.y, loc.z);
    if (!b) continue;
    const id = b.typeId;
    const center = add(loc, v3(0.5, 0.5, 0.5));
    if (/campfire/.test(id)) {
      if (b.permutation.getState("extinguished")) continue;
      safe(() => b.setPermutation(b.permutation.withState("extinguished", true)));
    } else {
      safe(() => dim.runCommand(`setblock ${loc.x} ${loc.y} ${loc.z} air destroy`));
    }
    particle(dim, "ppt:black_smoke_small", center);
    safe(() => dim.playSound("random.fizz", center, { volume: 0.6, pitch: 0.7 }));
    n++;
  }
  return n > 0;
}

function toggleDoor(dim, loc) {
  let b = getBlock(dim, loc.x, loc.y, loc.z);
  if (!b) return;
  if (b.permutation.getState("upper_block_bit") === true) {
    b = getBlock(dim, loc.x, loc.y - 1, loc.z);
    if (!b) return;
  }
  const open = !!b.permutation.getState("open_bit");
  safe(() => b.setPermutation(b.permutation.withState("open_bit", !open)));
  const up = getBlock(dim, b.location.x, b.location.y + 1, b.location.z);
  if (up && DOOR.test(up.typeId) && up.permutation.getState("upper_block_bit") === true) {
    safe(() => up.setPermutation(up.permutation.withState("open_bit", !open)));
  }
  safe(() => dim.playSound(open ? "random.door_close" : "random.door_open", b.location, { volume: 1, pitch: rand(0.7, 0.9) }));
}

function rattleDoor(p, doors) {
  const dim = p.dimension;
  const loc = pick(doors);
  toggleDoor(dim, loc);
  system.runTimeout(() => toggleDoor(dim, loc), 9);
  if (Math.random() < 0.5) {
    system.runTimeout(() => toggleDoor(dim, loc), 22);
    system.runTimeout(() => toggleDoor(dim, loc), 30);
  }
}

function rustle(p, leaves) {
  const dim = p.dimension;
  const picks = leaves.sort(() => Math.random() - 0.5).slice(0, 4);
  for (const l of picks) particle(dim, "ppt:falling_leaves", add(l, v3(0.5, 0, 0.5)));
  if (picks.length) sound(p, "ppt.twig", add(picks[0], v3(0.5, 0.5, 0.5)), 1.0, rand(0.8, 1.1));
}

const SIGN_TEXT = ["I can see you.", "Warm house, friend.", "Look at the ceiling.", "Why did you run?", "I'm watching.", "Nice house.", "Look up."];
const SIGN_TEXT_T3 = ["Let me in.", "I was here.\nYou were asleep.", "Don't turn around."];

function placeSign(p, tier) {
  const dim = p.dimension;
  const view = flat(p.getViewDirection());
  for (let i = 0; i < 6; i++) {
    const yaw = Math.atan2(view.z, view.x) + Math.PI + rand(-1.2, 1.2);
    const r = rand(3, 8);
    const s = findStand(dim, p.location.x + Math.cos(yaw) * r, p.location.y, p.location.z + Math.sin(yaw) * r, 3, 4);
    if (!s) continue;
    const b = getBlock(dim, s.loc.x, s.loc.y, s.loc.z);
    if (!b || !b.isAir) continue;
    const toP = sub(p.location, s.loc);
    const ang = (Math.atan2(-toP.x, toP.z) * 180) / Math.PI;
    const dir = (((Math.round(ang / 22.5) % 16) + 16) % 16);
    const ok = safe(() => {
      b.setPermutation(BlockPermutation.resolve("minecraft:standing_sign", { ground_sign_direction: dir }));
      return true;
    });
    if (!ok) continue;
    const text = pick(tier === 3 ? SIGN_TEXT.concat(SIGN_TEXT_T3) : SIGN_TEXT);
    safe(() => {
      const sign = b.getComponent("minecraft:sign");
      sign.setText(text, SignSide.Front);
      sign.setText(text, SignSide.Back);
    });
    safe(() => dim.playSound("dig.wood", s.loc, { volume: 0.4, pitch: 0.6 }));
    return true;
  }
  return false;
}

function transmuteOre(p) {
  const dim = p.dimension;
  const c = p.location;
  let done = 0;
  for (let i = 0; i < 40 && done < 3; i++) {
    const yaw = rand(0, Math.PI * 2);
    const r = rand(15, 24);
    const x = Math.floor(c.x + Math.cos(yaw) * r);
    const z = Math.floor(c.z + Math.sin(yaw) * r);
    const y = Math.floor(c.y + rand(-6, 6));
    const b = getBlock(dim, x, y, z);
    if (!b) continue;
    const deep = b.typeId === "minecraft:deepslate";
    if (!deep && b.typeId !== "minecraft:stone") continue;
    // only blocks the player could actually find (touching cave air)
    const exposed = [
      [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
    ].some(([a, bb, cc]) => {
      const n = getBlock(dim, x + a, y + bb, z + cc);
      return !!n && n.isAir;
    });
    if (!exposed) continue;
    const diamond = Math.random() < 0.3;
    const id = deep ? (diamond ? "minecraft:deepslate_diamond_ore" : "minecraft:deepslate_gold_ore") : diamond ? "minecraft:diamond_ore" : "minecraft:gold_ore";
    safe(() => b.setType(id));
    done++;
  }
  return done > 0;
}

function footprints(p, tom) {
  const dim = p.dimension;
  const start = tom ? tom.location : add(p.location, mul(flat(p.getViewDirection()), -12));
  const dir = flat(sub(p.location, start));
  const side = v3(-dir.z, 0, dir.x);
  const total = Math.min(16, Math.floor(len(sub(p.location, start)) / 0.8) - 2);
  for (let i = 0; i < total; i++) {
    system.runTimeout(() => {
      safe(() => {
        const base = add(add(start, mul(dir, i * 0.8)), mul(side, i % 2 ? 0.18 : -0.18));
        for (let dy = 1; dy >= -3; dy--) {
          const below = getBlock(dim, base.x, base.y + dy - 1, base.z);
          const at = getBlock(dim, base.x, base.y + dy, base.z);
          if (isSolid(below) && isFree(at)) {
            particle(dim, "ppt:footprint", v3(base.x, Math.floor(base.y + dy) + 0.02, base.z));
            if (i % 3 === 0) safe(() => dim.playSound("ppt.step", base, { volume: 0.5, pitch: 0.8 }));
            break;
          }
        }
      });
    }, i * 6);
  }
}

function phantomTap(p) {
  const dir = flat(p.getViewDirection());
  const ang = Math.atan2(dir.z, dir.x) + Math.PI + rand(-1.0, 1.0);
  const loc = add(p.getHeadLocation(), v3(Math.cos(ang) * 2.2, rand(-0.3, 0.6), Math.sin(ang) * 2.2));
  sound(p, "ppt.knock", loc, 0.9, rand(0.9, 1.05));
}

function petParanoia(p, tom) {
  const dim = p.dimension;
  const target = add(tom.location, v3(0, 1.6, 0));
  for (const type of ["minecraft:wolf", "minecraft:cat"]) {
    const list = safe(() => dim.getEntities({ type, location: p.location, maxDistance: 16 })) || [];
    for (const pet of list) {
      const tame = safe(() => pet.getComponent("minecraft:tameable"));
      if (!tame || !tame.isTamed) continue;
      safe(() => pet.lookAt(target));
      if (Math.random() < 0.4) safe(() => dim.playSound(type === "minecraft:wolf" ? "mob.wolf.growl" : "mob.cat.hiss", pet.location, { volume: 0.8 }));
    }
  }
}

function heldGlitch(p, st, tom) {
  const inv = p.getComponent("minecraft:inventory");
  const item = safe(() => inv && inv.container && inv.container.getItem(p.selectedSlotIndex));
  if (!item || !/^minecraft:(compass|clock|recovery_compass|lodestone_compass)$/.test(item.typeId)) return;
  if (len(sub(tom.location, p.location)) > 48) return;
  if (now() < st.glitchNext) return;
  st.glitchNext = now() + 30;
  const glyphs = "§k|||§r §8" + pick(["N̷̛ E̵̕ S̷ W̸", "1̶2̵:̸0̴0̸", "W̸ S̷ E̵ N̷̛", "?̷?̵:̸?̴?̸", "H̷E̵ ̷I̵S̷ ̸H̵E̷R̷E̸"]) + " §k|||";
  safe(() => p.onScreenDisplay.setActionBar(glyphs));
  sound(p, "ppt.glitch", undefined, 0.45, rand(0.8, 1.3));
  if (Math.random() < 0.25) safe(() => p.runCommand("camerashake add @s 0.15 0.5 rotational"));
}

function runEnvironment(p, st, tom, tier, night) {
  const t = now();
  const dim = p.dimension;
  const underground = safe(() => dim.getSkyLightLevel(p.getHeadLocation())) === 0 && p.location.y < 60;
  /** @type {[string, number][]} */
  const options = [];
  options.push(["tap", 3]);
  options.push(["survey", 6]); // doors / lights / leaves decided after the scan
  options.push(["footprints", tom ? 2 : 0]);
  options.push(["whisper", 2]);
  if (t >= st.signCD) options.push(["sign", 1]);
  if (underground && t >= st.oreCD) options.push(["ore", 2]);
  const total = options.reduce((a, o) => a + o[1], 0);
  let r = Math.random() * total;
  let choice = "tap";
  for (const [name, w] of options) {
    r -= w;
    if (r <= 0) {
      choice = name;
      break;
    }
  }
  switch (choice) {
    case "tap":
      phantomTap(p);
      break;
    case "footprints":
      footprints(p, tom);
      break;
    case "whisper":
      if (tom) sound(p, "ppt.voice.night", tom.location, 1.0);
      break;
    case "sign":
      if (placeSign(p, tier)) st.signCD = t + secs(rand(180, 300));
      break;
    case "ore":
      if (transmuteOre(p)) st.oreCD = t + secs(rand(150, 240));
      break;
    case "survey":
      survey(p, st, (res) => {
        const acts = [];
        if (res.doors.length) acts.push("door", "door");
        if (res.lights.length && now() >= st.lightCD) acts.push("light");
        if (res.leaves.length && dim.id === "minecraft:overworld") acts.push("leaves");
        const a = acts.length ? pick(acts) : "tap";
        if (a === "door") rattleDoor(p, res.doors);
        else if (a === "light") {
          if (extinguish(p, st, res.lights, tier)) st.lightCD = now() + secs(tier === 3 ? 45 : 75);
        } else if (a === "leaves") rustle(p, res.leaves);
        else phantomTap(p);
      });
      break;
  }
}

// -------------------------------------------------------------- director --
function update(p) {
  const dim = p.dimension;
  const st = stateOf(p);
  const t = now();
  let tom = tomOf(st);

  if (dim.id === "minecraft:the_end") {
    if (tom) safe(() => tom.remove());
    st.tomId = undefined;
    return;
  }
  if (tom && tom.dimension.id !== dim.id) {
    safe(() => tom.remove());
    tom = undefined;
    st.tomId = undefined;
    st.cd = t + secs(rand(20, 40));
  }

  const nether = dim.id === "minecraft:nether";
  const night = nether || isNightTime();
  if (!nether) {
    if (night && !st.wasNight) {
      addWrath(p, 1);
      st.seenWrathNight = false;
    }
    st.wasNight = night;
  }
  const tier = tierOf(getWrath(p));
  if (p.isSleeping) return;

  // ---- no Tom around: maybe (re)appear
  if (!tom) {
    if (t < st.cd || st.busyUntil > t) return;
    if (!night && Math.random() > 0.45) {
      st.cd = t + secs(rand(60, 140));
      return;
    }
    tom = spawnTom(p, st, night, tier);
    if (!tom) return;
    st.cd = t + secs(30);
  }
  if (st.busyUntil > t) return;

  const tl = tom.location;
  const s = sight(p, tom);
  const d = s.d;

  if (d > 72) {
    safe(() => tom.remove());
    st.tomId = undefined;
    st.cd = t + secs(rand(8, 20));
    return;
  }

  // ---- body sensors (pose / hitbox) ----
  const inWater = tom.isInWater;
  if (inWater) {
    setPose(tom, st, "swim");
    if (beat % 2 === 0) particle(dim, "ppt:black_bubbles", add(tl, v3(0, 0.6, 0)));
  } else if (tom.isClimbing && st.mode !== "observe") {
    setPose(tom, st, "climb");
    if (beat % 2 === 0) particle(dim, "ppt:soot", add(add(tl, mul(flat(tom.getViewDirection()), 0.45)), v3(0, 1.3, 0)));
  } else {
    const hr = headroom(dim, tl);
    const pr = headroom(dim, p.location);
    if (hr === 1 || (st.mode === "hunt" && pr === 1 && d < 12)) {
      setSize(tom, st, "crawl");
      setPose(tom, st, "crawl");
    } else if (st.mode === "hunt") {
      setSize(tom, st, "hunch");
      setPose(tom, st, "sprint");
    } else {
      setSize(tom, st, hr === 2 ? "hunch" : "tall");
      if (st.pose !== "peek") setPose(tom, st, st.mode === "observe" ? "peek" : "stalk");
    }
  }

  // ---- pets & held items react whenever he is near
  if (t >= st.petNext) {
    st.petNext = t + secs(3);
    if (d < 36) petParanoia(p, tom);
  }
  heldGlitch(p, st, tom);

  // ================= DAY: pure observer =================
  if (!night) {
    setMode(tom, st, "observe");
    if (st.pose !== "swim" && st.pose !== "climb") setPose(tom, st, "peek");
    if (d < 15 || s.direct || (s.visible && ++st.seen >= 4)) {
      vanish(p, st, tom, rand(40, 90), false);
      return;
    }
    if (!s.visible) st.seen = 0;
    if (t >= st.voiceNext && d > 18 && Math.random() < 0.08) {
      sound(p, "ppt.voice.day", tl, 1.0);
      st.voiceNext = t + secs(rand(60, 120));
    }
    if (t >= st.observeEnd && !s.visible) vanish(p, st, tom, rand(90, 200), false);
    return;
  }

  // ================= NIGHT =================
  const band = tier === 1 ? [20, 35] : tier === 2 ? [12, 28] : [8, 22];

  // ambience that keeps the tension up
  if (tier >= 2 && t >= st.droneNext) {
    st.droneNext = t + secs(23);
    sound(p, "ppt.drone", undefined, tier === 3 ? 0.7 : 0.45);
  }
  if (tier === 3 && t >= st.darkNext) {
    st.darkNext = t + secs(14);
    safe(() => p.addEffect("darkness", secs(5), { amplifier: 0, showParticles: false }));
  }
  if (t >= st.voiceNext && st.mode !== "hunt") {
    st.voiceNext = t + secs(rand(40, 85));
    sound(p, "ppt.voice.night", tl, 1.0);
  }
  if (t >= st.tapNext && st.mode !== "hunt") {
    st.tapNext = t + secs(rand(60, 120));
    phantomTap(p);
  }
  if (t >= st.envNext && st.mode !== "hunt") {
    const iv = tier === 1 ? [25, 45] : tier === 2 ? [18, 32] : [12, 24];
    st.envNext = t + secs(rand(iv[0], iv[1]));
    runEnvironment(p, st, tom, tier, night);
  }

  // ---------------- hunting ----------------
  if (st.mode === "hunt") {
    if (t - st.huntStart > secs(22)) {
      vanish(p, st, tom, rand(40, 80), false); // lost you... for now
      return;
    }
    if (d < 16 && beat % 2 === 0) safe(() => p.playSound("mob.warden.heartbeat", { volume: d < 8 ? 1 : 0.6 }));
    if (d < 10 && beat % 6 === 0) sound(p, "ppt.breath", tl, 0.9);
    smashAhead(p, st, tom, tier);
    return;
  }

  // ---------------- stalking ----------------
  if (s.visible) {
    st.seen++;
    if (st.seen >= 6 && !st.seenWrathNight) {
      st.seenWrathNight = true;
      addWrath(p, 1);
    }
    if (tier === 1) {
      setPose(tom, st, "peek");
      if (st.seen >= 3) vanish(p, st, tom, rand(25, 60), false);
    } else if (tier === 2) {
      setMode(tom, st, "freeze");
      setPose(tom, st, "peek");
      if (d < 10 && st.seen >= 2) startHunt(p, st, tom, tier);
      else if (st.seen >= 6) vanish(p, st, tom, rand(20, 40), false);
    } else {
      if (st.seen >= 2) {
        if (t >= st.huntCD) startHunt(p, st, tom, tier);
        else vanish(p, st, tom, rand(10, 25), false);
      }
    }
    return;
  }
  st.seen = 0;
  setMode(tom, st, "stalk");
  if (st.pose === "peek") setPose(tom, st, "stalk");

  // creep closer every time you look away
  if (t >= st.creepNext) {
    const iv = tier === 1 ? [10, 16] : tier === 2 ? [7, 12] : [5, 9];
    st.creepNext = t + secs(rand(iv[0], iv[1]));
    if (d > band[0] + 3 || d > band[1]) {
      const sp = spotAround(p, band[0], Math.max(band[0] + 2, Math.min(d - 3, band[1])), true, 6);
      if (sp) {
        safe(() => tom.teleport(sp.loc, { facingLocation: p.getHeadLocation() }));
        if (Math.random() < 0.5) particle(dim, "ppt:black_smoke_small", add(sp.loc, v3(0, 1, 0)));
      }
    }
  }

  // dark-corner face-to-face encounter
  if (tier >= 2 && t >= st.cornerCD && t >= st.scareCD) {
    const light = safe(() => dim.getLightLevel(p.getHeadLocation())) ?? 15;
    if (light <= 3 && Math.random() < (tier === 3 ? 0.03 : 0.015)) {
      st.cornerCD = t + secs(rand(240, 360));
      jumpscare(p, st, tom, false);
      return;
    }
  }

  // opportunistic attack (never a fair fight)
  if (t >= st.huntCD && d < 40) {
    const weak = healthFrac(p) <= 0.5;
    const alone = isolated(p);
    // he is not in view at this point, so "distracted" = busy fighting/mining, or fumbling in the dark
    const distracted = t < st.distractedUntil || (safe(() => dim.getLightLevel(p.getHeadLocation())) ?? 15) <= 5;
    let chance = 0;
    if (tier === 1) chance = weak && alone && distracted ? 0.03 : 0;
    else if (tier === 2) chance = (weak && alone) || (distracted && alone) ? 0.035 : weak ? 0.015 : 0;
    else chance = weak ? 0.09 : distracted ? 0.05 : 0.012;
    if (Math.random() < chance) startHunt(p, st, tom, tier);
  }
}

/** Tier 2+: claw through wooden doors, Tier 3: smash glass between him and you. */
function smashAhead(p, st, tom, tier) {
  if (tier < 2) return;
  const dim = tom.dimension;
  const dir = flat(sub(p.location, tom.location));
  for (const step of [0.8, 1.5]) {
    for (const dy of [0, 1, 2]) {
      const at = add(tom.location, add(mul(dir, step), v3(0, dy, 0)));
      const b = getBlock(dim, at.x, at.y, at.z);
      if (!b || b.isAir) continue;
      const id = b.typeId;
      const l = b.location;
      if (tier === 3 && GLASS.test(id)) {
        safe(() => dim.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`));
        safe(() => dim.playSound("random.glass", l, { volume: 1.2, pitch: 0.8 }));
        return;
      }
      if (DOOR.test(id) && !NOT_DOOR.test(id) && /_door$|wooden_door/.test(id)) {
        st.doorHits++;
        safe(() => dim.playSound("random.wood_click", l, { volume: 1, pitch: 0.5 }));
        if (st.doorHits >= (tier === 3 ? 2 : 4)) {
          st.doorHits = 0;
          safe(() => dim.runCommand(`setblock ${l.x} ${l.y} ${l.z} air destroy`));
        }
        return;
      }
    }
  }
}

// ---------------------------------------------------------------- events --
function ownerOf(tom) {
  const id = safe(() => tom.getDynamicProperty(OWNER_KEY));
  if (typeof id !== "string") return undefined;
  return world.getAllPlayers().find((p) => p.id === id);
}

// Unkillable: damage_sensor cancels all damage and fires "ppt:hurt".
world.afterEvents.dataDrivenEntityTrigger.subscribe(
  (ev) => {
    const tom = ev.entity;
    if (!tom.isValid || ev.eventId !== "ppt:hurt") return;
    const p = ownerOf(tom);
    if (!p) return;
    const st = stateOf(p);
    if (st.tomId !== tom.id) return;
    const tier = tierOf(getWrath(p));
    const night = p.dimension.id === "minecraft:nether" || isNightTime();
    st.hurt++;
    if (!night) {
      vanish(p, st, tom, rand(60, 120), false);
      return;
    }
    const limit = tier === 1 ? 3 : tier === 2 ? 5 : 7;
    if (st.hurt >= limit) {
      addWrath(p, 2);
      vanish(p, st, tom, rand(120, 240), true); // banished... for now
    } else if (st.mode !== "hunt" && tier >= 2) {
      startHunt(p, st, tom, tier);
    }
  },
  { entityTypes: [TOM], eventTypes: ["ppt:hurt"] }
);

// He lands a hit -> jumpscare, then he is gone.
world.afterEvents.entityHitEntity.subscribe((ev) => {
  const a = ev.damagingEntity;
  const h = ev.hitEntity;
  if (!a || !h || !a.isValid || !h.isValid) return;
  if (a.typeId === TOM && h.typeId === "minecraft:player") {
    const p = world.getAllPlayers().find((x) => x.id === h.id);
    if (!p) return;
    const st = stateOf(p);
    if (st.tomId === a.id) jumpscare(p, st, a, true);
  } else if (a.typeId === "minecraft:player" && h.typeId !== TOM) {
    const st = STATE.get(a.id);
    if (st) st.distractedUntil = now() + secs(8);
  }
});

// Fighting other mobs / mining = distracted.
world.afterEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  if (!e || e.typeId !== "minecraft:player") return;
  const src = ev.damageSource && ev.damageSource.damagingEntity;
  if (src && src.typeId === TOM) return;
  const st = STATE.get(e.id);
  if (st) st.distractedUntil = now() + secs(8);
});
world.afterEvents.playerBreakBlock.subscribe((ev) => {
  const st = STATE.get(ev.player.id);
  if (st) st.distractedUntil = now() + secs(6);
});

// Natural spawns: never in The End, never more than one per player.
world.afterEvents.entitySpawn.subscribe((ev) => {
  const e = ev.entity;
  if (!e || !e.isValid || e.typeId !== TOM) return;
  system.run(() => {
    safe(() => {
      if (!e.isValid) return;
      if (e.dimension.id === "minecraft:the_end") return e.remove();
      if (typeof e.getDynamicProperty(OWNER_KEY) === "string") return;
      const p = world
        .getAllPlayers()
        .filter((x) => x.dimension.id === e.dimension.id)
        .sort((a, b) => len(sub(a.location, e.location)) - len(sub(b.location, e.location)))[0];
      if (!p || len(sub(p.location, e.location)) > 72) return e.remove();
      const st = stateOf(p);
      if (tomOf(st)) return e.remove();
      e.setDynamicProperty(OWNER_KEY, p.id);
      st.tomId = e.id;
      st.mode = "";
      st.pose = "";
      st.size = "tall";
    });
  });
});

world.afterEvents.playerLeave.subscribe((ev) => {
  const st = STATE.get(ev.playerId);
  if (st && st.tomId) safe(() => world.getEntity(st.tomId)?.remove());
  STATE.delete(ev.playerId);
});

// Debug / admin: /scriptevent ppt:<cmd> [value]
system.afterEvents.scriptEventReceive.subscribe((ev) => {
  const src = ev.sourceEntity;
  const p = src && src.typeId === "minecraft:player" ? world.getAllPlayers().find((x) => x.id === src.id) : world.getAllPlayers()[0];
  if (!p) return;
  const st = stateOf(p);
  switch (ev.id) {
    case "ppt:wrath":
      setWrath(p, Number(ev.message) || 0);
      p.sendMessage(`§7[Peeping Tom] wrath = ${getWrath(p)} (tier ${tierOf(getWrath(p))})`);
      break;
    case "ppt:summon":
      st.cd = 0;
      st.busyUntil = 0;
      break;
    case "ppt:scare": {
      st.scareCD = 0;
      let tom = tomOf(st);
      if (!tom) tom = spawnTom(p, st, true, 3);
      if (tom) jumpscare(p, st, tom, false);
      break;
    }
    case "ppt:hunt": {
      const tom = tomOf(st);
      st.huntCD = 0;
      if (tom) startHunt(p, st, tom, tierOf(getWrath(p)));
      break;
    }
    case "ppt:info":
      p.sendMessage(`§7[Peeping Tom] wrath ${getWrath(p)} tier ${tierOf(getWrath(p))} present ${!!tomOf(st)} mode ${st.mode}`);
      break;
    case "ppt:clear": {
      const tom = tomOf(st);
      if (tom) safe(() => tom.remove());
      st.tomId = undefined;
      st.cd = now() + secs(600);
      break;
    }
  }
});

system.runInterval(() => {
  beat++;
  for (const p of world.getAllPlayers()) {
    try {
      update(p);
    } catch (e) {
      // keep the director alive no matter what
    }
  }
}, TICK);
