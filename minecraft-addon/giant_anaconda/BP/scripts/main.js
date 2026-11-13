import { world } from "@minecraft/server";

// Bloodbath-style: once the anaconda kills a player it vanishes (it can spawn again later).
world.afterEvents.entityDie.subscribe(
  (ev) => {
    const killer = ev.damageSource.damagingEntity;
    if (killer?.typeId !== "horror:giant_anaconda") return;
    try {
      killer.triggerEvent("horror:vanish");
    } catch (e) {
      // killer already unloaded/removed
    }
  },
  { entityTypes: ["minecraft:player"] }
);
