// JJK Addon entry: AI loop, passives, damage rules (Infinity, Heavenly Restriction, dodges).
import { world, system, EntityDamageCause } from '@minecraft/server';
import { gojoThink, gojoPassives, infinityOn } from './mobs/gojo.js';
import { tojiThink, tojiPassives, tojiDodge } from './mobs/toji.js';
import { recordAttacker, isScriptHit, prune, hurt, knock, dirTo, chest, safeTeleport } from './game/combat.js';
import { px, sfx } from './game/fx.js';
import { PX, SFX } from './game/ids.js';
import { add, sub, scale, perpY, dot } from './core/vec.js';

const DIMS = ['overworld', 'nether', 'the_end'];
const TYPES = ['jjk:gojo', 'jjk:toji'];

function mobs() {
  const out = [];
  for (const id of DIMS) {
    let dim;
    try { dim = world.getDimension(id); } catch { continue; }
    for (const type of TYPES) {
      try { out.push(...dim.getEntities({ type })); } catch { /* ignore */ }
    }
  }
  return out;
}

const dead = (e) => (e.getComponent('minecraft:health')?.currentValue ?? 1) <= 0;

// AI + passives, every 4 ticks
system.runInterval(() => {
  const list = mobs();
  for (const e of list) {
    try {
      if (!e.isValid || dead(e)) continue;
      if (e.typeId === 'jjk:gojo') { gojoPassives(e); gojoThink(e); }
      else { tojiPassives(e); tojiThink(e); }
    } catch (err) { console.warn(`[jjk] think: ${err}`); }
  }
  if (system.currentTick % 200 === 0) prune(new Set(list.map((e) => e.id)));
}, 4);

// Infinity (Gojo) and superhuman senses (Toji) against projectiles, every 2 ticks
const held = new Map(); // projectile id -> ticks held by Infinity
system.runInterval(() => {
  for (const e of mobs()) {
    if (!e.isValid || dead(e)) continue;
    let near;
    try { near = e.dimension.getEntities({ location: e.location, maxDistance: 4 }); } catch { continue; }
    for (const p of near) {
      if (p.id === e.id || !p.getComponent('minecraft:projectile')) continue;
      if (e.typeId === 'jjk:gojo') {
        if (!infinityOn(e)) continue;
        const n = (held.get(p.id) ?? 0) + 1;
        held.set(p.id, n);
        if (n <= 12) { // ~1 s frozen in the air, then gravity takes it
          try { p.clearVelocity(); } catch { /* ignore */ }
          if (n === 1) { px(e.dimension, PX.infinity, p.location); sfx(e.dimension, SFX.infinity, p.location, 0.8); }
        }
      } else {
        let v;
        try { v = p.getVelocity(); } catch { continue; }
        if (dot(v, sub(e.location, p.location)) > 0) tojiDodge(e, p);
      }
    }
  }
  if (held.size > 256) held.clear();
}, 2);

// Damage rules — before-events are read-only: only edit damage/cancel here, defer the rest.
world.beforeEvents.entityHurt.subscribe((ev) => {
  const e = ev.hurtEntity;
  const cause = ev.damageSource.cause;
  if (e.typeId === 'jjk:gojo') {
    const attacker = ev.damageSource.damagingEntity;
    if (attacker && infinityOn(e)) {
      if (cause === EntityDamageCause.projectile) { ev.cancel = true; return; }
      if (Math.random() < 0.08) { // Six Eyes: read the attack and slip away
        ev.cancel = true;
        system.run(() => {
          if (!e.isValid || !attacker.isValid) return;
          const side = scale(perpY(dirTo(attacker.location, e.location)), Math.random() < 0.5 ? 1.5 : -1.5);
          px(e.dimension, PX.blink, chest(e));
          safeTeleport(e, add(e.location, side), attacker.location);
        });
        return;
      }
      ev.damage *= 0.2; // Infinity: blows barely reach him
      system.run(() => { if (e.isValid) px(e.dimension, PX.infinity, chest(e)); });
    }
  } else if (e.typeId === 'jjk:toji') {
    if (cause === EntityDamageCause.fall) { ev.cancel = true; return; }
    ev.damage *= 0.7; // Heavenly Restriction
  }
});

world.afterEvents.entityHurt.subscribe((ev) => {
  const victim = ev.hurtEntity, attacker = ev.damageSource.damagingEntity;
  if (!attacker) return;
  if (TYPES.includes(victim.typeId)) recordAttacker(victim, attacker);
  // Black Flash on Gojo's ordinary melee hits (script punches roll their own)
  if (attacker.typeId === 'jjk:gojo' && ev.damageSource.cause === EntityDamageCause.entityAttack &&
      !isScriptHit(victim.id) && victim.isValid && Math.random() < 0.15) {
    hurt(attacker, victim, ev.damage * 1.5);
    px(victim.dimension, PX.blackFlash, chest(victim));
    sfx(victim.dimension, SFX.blackFlash, chest(victim), 1.4);
    knock(victim, dirTo(attacker.location, victim.location), 1.4, 0.35);
  }
});
