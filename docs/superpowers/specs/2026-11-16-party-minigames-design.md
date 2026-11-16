# Party Minigames (เกมปาร์ตี้มินิเกมตลก) — Design

Status: DRAFT, awaiting approval. No code written yet.
Marker: **[call]** = my decision, not stated by the user. Everything else is from the user.

## 1. Intent
A silly local party game for 1–4 people sharing ONE tablet (landscape). Short random minigames, always funny, never serious. Web first (HTML5 + Phaser, static hosting), later wrapped as an Android app with Capacitor.

## 2. Goals / Non-goals / Anti-goals
Goals
- 15+ minigames, randomly picked, with a local competitive ranking.
- Tutorial card before each game: illustrated, dismissible, can be toggled on/off at any time.
- 1–4 players, each in their own screen corner.
- Only two control types: drag joystick (move) and one button. A game that doesn't use one of them must not show it.
- Beautiful themed graphics, smooth animation.
- No in-app purchases, no ads.

Non-goals (v1): online play, accounts/cloud leaderboard, gamepad/keyboard shipping support, i18n framework, PWA/offline service worker, the Capacitor wrapper itself (only keep it possible).

Anti-goals: serious/grim tone; tiny touch targets; text-wall tutorials; controls that hide the action.

## 3. Constraints
- Target device: tablet, landscape only **(user)**. Up to 8 simultaneous touches (4 joysticks + 4 buttons).
- Static hosting (GitHub Pages / Cloudflare Pages): no server code; relative asset base so it works under a sub-path and inside Capacitor.
- Local data only (localStorage).

## 4. Approaches considered
- **A. Vite + TypeScript + Phaser 3 — CHOSEN by user.** Shared core + one module per minigame.
- B. Plain JS + Phaser from CDN, no build: fastest start, but unmanageable at 15+ games and awkward for Capacitor.
- C. Vite + plain JS: same structure as A, fewer compile-time checks.

## 5. Screen & controls
- Logical canvas 1280×720, scale-to-fit, letterboxed. Arena fills the whole screen; controls are translucent overlays in the four corners.
- Seats: P1 top-left, P2 top-right, P3 bottom-left, P4 bottom-right. **[call]** UI is not rotated toward players (all upright) in v1.
- Each corner zone (~300×300 logical px) holds a **fixed-position** joystick (side nearest the screen edge) and the button (side nearest the centre), mirrored for right-side players. **[call]** Fixed, not floating, to avoid drift and cross-zone stealing.
- Multi-touch: enable ≥8 Phaser pointers. A touch is bound to a seat zone at touch-down and stays bound until release; it never moves to another seat. Joystick and button are separate hit areas inside the zone.
- Browser hygiene: `touch-action:none`, no zoom/scroll/context menu, fullscreen button, wake-lock where available.
- Control check (milestone 2): a hidden "ทดสอบการควบคุม" scene where all 4 players move dots and press buttons at once, covering joystick+button, joystick-only and button-only layouts. The user tests it on a real tablet and approves before more games are added.

## 6. Architecture
```
src/
  main.ts            Phaser boot, scale, scene registry
  core/              match flow, game pool, input zones/joystick, scoring, audio, settings, storage
  ui/                menu, lobby (pick 1–4 players), tutorial overlay, pause, results, ranking
  games/<id>/        one module per minigame (index.ts exports MiniGameDef)
```
```ts
interface MiniGameDef {
  id: string; title: string;            // Thai title
  minPlayers: number; maxPlayers: 4;
  controls: { joystick: boolean; button: false | { label: string; icon: string } };
  durationSec: number;
  tutorial: TutorialSlide[];            // 2–3 slides, each drawn by code (vector) + one short Thai line
  create(scene, ctx): MiniGameInstance; // ctx: players[], per-seat input {axis, button}, rng, finish(ranking)
}
```
- Core hides any control the game declares unused.
- A game returns a placement list (ties allowed); the core turns it into points.
- Game pool = registered games whose `minPlayers ≤ player count`. **[call]** No AI bots in v1: a solo player only gets games that make sense alone (score-attack style); the rest need 2+ players.
- Tests: Vitest for pure logic (joystick math, seat/touch binding, scoring, ranking, pool filtering); Playwright multi-touch smoke test via CDP touch events. Game feel is verified by hand on a tablet.

## 7. Tutorial & settings
- Before each game: card with 2–3 illustrated slides, close button, "เข้าใจแล้ว!" **[call]** Game starts when every active player has tapped ready, or via a skip-all button.
- Setting "ป้ายสอน": ทุกครั้ง / ครั้งแรกของแต่ละเกม / ปิด **[call]**. Reachable from the main menu and the in-game pause button (small, top centre). "ดูวิธีเล่น" in pause reopens the current game's card.
- Other settings: sound effects on/off, music on/off, rounds per match (3/5/10, default 5 **[call]**), reset ranking (with confirm).

## 8. Scoring & ranking
- A match = N rounds. Per round, placement points: 1st→N players, 2nd→N−1, … **[call]** (ties share the higher value).
- Results screen after each round (funny reactions per rank), match winner at the end.
- Four player slots have editable name + bean colour. Ranking is local (localStorage) **[call]**: per name — matches, match wins, total points, and best-game tallies; ranking screen sorted by wins then points; max 20 profiles.

## 9. Look & feel
- Cartoon "bean" characters **[call]**, thick outlines, bright palette, squash/stretch tweens, screen shake, confetti, particle pops.
- Everything drawn in code (Phaser Graphics → generated textures): no art files to license, tiny download. Sound effects synthesized with WebAudio **[call]**.
- Target 60 fps on a mid-range tablet; cap device pixel ratio at 2; pool particles/objects.
- Thai UI text kept in one `strings.ts`. Font: self-hosted OFL Thai font, e.g. Itim or Mali **[call]** (open to the user choosing).

## 10. Minigame roster (proposed; the first six are the user's ideas, my interpretation of each **[call]**)
| # | Game | Controls | Idea |
|---|------|----------|------|
| 1 | ตะกร้ารับของ | joystick | catch good items in a basket, dodge junk; solo-capable |
| 2 | ระเบิดส่งต่อ | joystick + button | hot-potato bomb; button throws it to the nearest player; 2+ |
| 3 | รถชนลานแคบ | joystick + button | bumper cars on a tiny arena, button = boost; last on the arena wins |
| 4 | ดึงสะพานหนี | joystick + button | race across a wobbly bridge; button yanks the rope to shake others off |
| 5 | หนีน้ำขึ้น | joystick + button | climb platforms to escape rising water; button jumps |
| 6 | เบิกตาสีตาม | joystick | call-out colour; run to the matching floor tile |
| 7 | แย่งส้วม | joystick | musical chairs with toilets |
| 8 | ผลักลงบ่อโคลน | joystick + button | sumo push in a mud ring |
| 9 | ตบยุง | joystick + button | move hand over mosquitoes, button slaps |
| 10 | แข่งจับไก่ | joystick | herd chickens into your coop |
| 11 | พิซซ่าโยนแป้ง | button | hold-and-release timing to fling dough highest |
| 12 | หลบมะเขือเทศ | joystick | dodge the splat storm; solo-capable |
| 13 | สายพานซูชิ | joystick + button | grab only the sushi your order card shows |
| 14 | กระโดดเชือกยักษ์ | button | jump-rope timing; solo-capable |
| 15 | ไฟเขียวไฟแดง | joystick | freeze when the light turns red |
| 16 | (spare slot) | | pick the funniest from playtests |

## 11. Delivery order
1. Core (menu, lobby, game pool, tutorial, settings, scoring, ranking, input zones) + games 1–3 (they cover joystick-only and joystick+button; button-only is covered by the control-check scene).
2. Control check on a real tablet with 4 players → user approval.
3. Games 4–15+ in batches, playtest and tweak.
4. Deploy (GitHub Pages or Cloudflare Pages); Capacitor wrapper later.

## 12. Left to the builder
Exact tuning (speeds, durations, point balance), animation details, tutorial art per game, hosting target choice, Capacitor config.
