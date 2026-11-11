# Real Darkness — Minecraft Bedrock Add-on (design)

Target: Minecraft Bedrock v26.62 (from user screenshot).

## Goal
- Day: unchanged.
- Night (overworld): as dark as the engine allows, using black distance fog that also hides the far view.
- Held light: holding a light item (torch, lantern, ...) lights the area around the player; light level = the item's vanilla light level.
- Sun/moon: brighter, nicer textures, no extra world light.
- Settings item: toggle fog, fog density (thin/medium/thick), toggle held light. Operators only. Settings are world-wide.

## Packs (shipped as one `.mcaddon`)
| Pack | Contents |
|---|---|
| `RealDarkness_BP` | script (`scripts/main.js`), settings item, crafting recipe |
| `RealDarkness_RP` | fog definitions, settings item texture, en_US/th_TH text |
| `RealDarkness_Sky_RP` | sun/moon textures (separate so it can be turned off in world settings) |

Sun/moon toggle in the menu: not possible — no script API swaps textures at runtime (searched; only Vibrant Visuals lighting/atmospherics are scriptable). Agreed fallback: separate resource pack.

## Night fog
- Every 20 ticks: read `world.getTimeOfDay()`.
  - 12000–13000 and 23000–24000 → `realdarkness:dusk`
  - 13000–23000 → `realdarkness:night_<density>`
  - otherwise → no fog
- Only in `minecraft:overworld`. Uses `player.fogSettings.push/remove` with tag `realdarkness`.
- Fog off in settings → our fog removed.

## Held light
- Every 2 ticks per player: main hand + off hand item; brightest known light level wins.
- Place `minecraft:light_block_<N>` (per-level ids since 1.21.20) at the player's head block if it is air; remove previous one when the player moves or stops holding the item.
- Never overwrite non-air blocks; only removes blocks it placed (still a light block of the same level).

## Settings item `realdarkness:settings`
- Recipe: 8 iron ingots around 1 coal (shaped `###/#C#/###`).
- Given once on first spawn (player dynamic property flag).
- Use → if `playerPermissionLevel >= Operator` show `ModalFormData`, else message "no permission".
- Stored in world dynamic properties.

## Versions
- `@minecraft/server` 2.11.0, `@minecraft/server-ui` 2.3.0 (latest stable on npm; rc builds tracked the 26.60 previews).
- `min_engine_version` 1.26.60.

## Verification
- Done here: JSON parse, TypeScript `checkJs` on the script, `.mcaddon` zip contents.
- Not possible here: in-game behaviour (no Minecraft in the container). User tests in game.
