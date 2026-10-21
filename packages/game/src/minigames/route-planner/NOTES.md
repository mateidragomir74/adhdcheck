# Route Planner (FR-64), PR notes

Optional mini-game, row 6 of research/04 section 5 (outside the 15 minute core): plan a path that collects 4 seeds
in the fewest moves; 4 puzzles; measures extra moves and planning time (IA5). Luma hops one lily pad per tap.

## Parameters

| Parameter | Value | Source |
|---|---|---|
| Puzzles | 4 measured, 4 seeds each | research/04 section 5 |
| Measures | extra moves (moves minus the fewest possible), planning time (first move minus board onset) | research/04 section 5 |
| Board | 5 x 5 squares, rocks block a square | TODO, design choice |
| Puzzles themselves | found by a search over random boards: on boards 1 and 2 walking to the nearest seed is already a fewest-moves route, on boards 3 and 4 it costs 2 and 3 extra moves | TODO, design choice (logic.test.ts checks the gaps) |
| Moves | one square up, down, left or right per tap | TODO, design choice |
| Practice | 1 board with 2 seeds, not recorded, hand points along a fewest-moves route | design choice (practice before every measured task) |
| Idle timeout | a board ends unsolved after 30 s without a tap | TODO, design choice |
| Square spacing, camera | 0.94 world units, camera 62 degrees above the water, fov 34 (portrait) or 30 (landscape) | design choice, sized so the smallest tap area is at least 48 CSS px (board3d.test.ts) |

## Result shape and PC-02

`RoutePlannerResult` (types.ts) is local, shaped like the PC-02 proposal (`id`, `version`, `params`, `puzzles`) plus a
`summary`, as Bridge Wait and Star Path do. research/04 lists no `route_planner` entry in the proposed `minigames`
block yet, so packages/contracts is untouched. `RESULT_VERSION` stays 0.1.0: logic.ts, runner.ts and types.ts are
unchanged by the 3D rebuild, so the result shape and every value are computed exactly as before.

Per puzzle: fewest moves, moves, extra moves, solved, onset (the `requestAnimationFrame` timestamp of the frame
that first draws the board), first move and planning time, and every tap (`pointerdown` `event.timeStamp`, the
square, and `move`, `blocked` for a rock next to Luma, or `off` for anything else). A board that ends on the idle
timeout records `extraMoves: null` and counts in `summary.nUnsolved` (review ledger G1).

## 3D rebuild (2026-10-20)

Replaces the flat DOM board (view.ts, removed) with a three.js scene in the Bridge Wait world, at the same bar as
Bridge Wait and Treasure Choice.

**Planned a new world, found the Bridge Wait one already reused by Treasure Choice and Star Path, chose to import it**
(`buildWorld`, `buildLuma`, `GameAudio`, `Particles`) so the river, Luma and the toon style are one and the same in
every mini-game. One change to Bridge Wait: `buildWorld` takes an optional `{ lilyPads: false }`, because its
decorative pads sit exactly where this board goes and would read as pads to tap. The default is unchanged and the
seeded random stream is consumed the same way, so Bridge Wait and Treasure Choice draw the same scene (all their
tests pass unchanged; Bridge Wait checked by screenshot).

- **Board.** 5 x 5 squares on the river in front of the bridge. An open square is a lily pad (notched, veined, each
  turned by a fixed angle so the notches do not line up), a blocked square is a cluster of three grey stones with
  foam, whose broken outline keeps it from reading as a pad. A seed is a glowing golden seed in a small pink lotus.
  Row 0 is the back (towards the bridge), as in the 2D board.
- **Onset.** `onBoard` runs inside `runner.frame(ts)` and builds the whole board at full size (no fade or pop-in),
  so the frame whose timestamp is the onset is the frame that first draws the board. Luma then glides from where
  it hovered onto the start pad in 460 ms; the runner already places Luma on the start square, so a tap during the
  glide is judged from the start square as before.
- **Taps.** Native `pointerdown` on the game container, `event.timeStamp`; the scene casts the finger from the
  camera onto the plane of the pad tops (`board3d.pickCell`), so the tap area of a square is the whole square.
  Smallest tap area measured by `minCellPx`: 92 px at 1024 x 768, 57 px at 390 x 844, 50 px at 844 x 390 (tests).
- **While the child plans, nothing on the board moves.** The pads Luma can reach with one tap carry a static white
  ring (the 2D faint ring, kept): it shows where a tap goes, never which way is shortest. After a tap Luma hops
  (squash and stretch, wings), lands with the same soft synthesised plip every time, the pad dips and a ripple
  spreads; a seed flies into Luma with a sparkle and its lotus closes into the pad. A rock tapped next to Luma only
  wobbles, silently. Off-board taps change nothing.
- **Solved board.** When the last seed reaches Luma: Luma hops for joy, a wave of gold light runs across the pads
  outward from Luma, the rising jingle plays and the bubble says `between`. Identical for every route.
- **Idle timeout.** The bubble says `tryNext` ("Let's try the next one."), Luma waves, no sound. Fixes ledger G7
  ("All seeds collected!" was shown after a timeout). No failure screen.
- **Between boards** the board sinks into the river and Luma flies up; the next board appears whole.
- **Start and end.** Luma, drawn larger, hovers over the river among drifting fireflies; play button on start;
  firefly bursts and the `done` line at the end. No score, number or star count anywhere.
- **Phone portrait.** The upper part of the screen shows a far bank (round trees, bushes, two steady lanterns)
  where the river bends away, rather than an empty strip of water. Riverside reeds and bushes frame the board;
  all static.
- **Reduced motion.** `prefers-reduced-motion` turns off the drifting fireflies, the burst motion, the hover bob,
  the ripples and the camera sway; hops stay (they are the response to the tap).
- **Data attributes** on the game container, for the harness only (layout, no measurement data): `data-phase`,
  `data-practice`, `data-board-index`, `data-board`, `data-cells` (screen centre of each square), `data-cell-px`.
  React StrictMode double mount (ledger G6): only the scene that wrote them last clears them.

Game-feel tips applied are the Bridge Wait ones (../bridge-wait/NOTES.md, sources there): squash and stretch,
short anticipation, easing everywhere, layered sound, few particles, secondary motion, show not tell (practice
hand), reward without score, no flashing near the stimuli, nothing teleports.

## Checked

- Unit tests: the 16 existing logic and runner tests unchanged and passing; new `board3d.test.ts` (square to world
  and back, whole board on screen below the bubble band, tap picking under every square, at least 48 CSS px per
  square at 390 x 844, 844 x 390, 1024 x 768, 768 x 1024, 1440 x 900) and `strings.test.ts` (solved and
  timed-out boards get different calm lines, no judgement word, number or em-dash). Both seen failing first
  (module missing, `betweenLine` not a function; then `-0` cells, a board drawn too high, and 45.8 px squares on a
  landscape phone, fixed by the camera numbers above).
- Headless Chromium (SwiftShader, about 8 fps) at 1024 x 768 and 390 x 844: intro, practice intro, practice board
  with the hand, a board, in progress, solved, timed out, end. Synthetic run: board 1 in the fewest moves
  (9 of 9, extra 0), board 2 with a detour (12 of 10, extra 2), board 3 left alone until the timeout (extra null),
  board 4 in the fewest moves; summary total extra 2, unsolved 1, off taps 0.
- Not yet: the demo tablet (frame rate, context loss, real fingers).

## TODO

- Texts owner review of strings.ts (`practiceIntro` and `done` were reworded from squares and a garden to lily
  pads and the river; `tryNext` is new).
- Team decision: whether a child who is stuck but keeps tapping should also get a way to move on (today only 30 s
  without any tap ends a board).
- Listen to the plip and confirm it sounds neutral; measure the frame rate on the demo tablet.
