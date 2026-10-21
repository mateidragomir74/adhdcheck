# Lantern Watch (FR-04 to FR-10) with Wake the fireflies (FR-03), PR notes

Mini-game 1 of research/04 section 5, the scored go/no-go task, on the Bridge Wait world. Three lanterns stand on the bridge; one lights at a time. A gold lantern with a small glowing firefly means tap. A blue-violet lantern with a big moth means do not tap. This is the only game that fills the `sessionGame` slot of `/play/[code]`, so its output is `SessionMetrics` v1, parsed with the contract schema before it leaves the game.

## Sequence

Start tap (also unlocks audio on iOS), "Wake the fireflies" intro, 2 calibration practice fireflies with the hand (not recorded), 10 calibration trials, go/no-go intro, 4 practice trials (firefly, moth, firefly, moth; hand on fireflies only; not recorded), then `task.blocks` blocks. Between blocks: a rest screen; after `BREAK_MIN_MS` a play button appears and the child continues when ready. End: firefly fireworks, Luma celebrates, then the payload is handed to the page after `CELEBRATE_MS`.

## Parameters

| Parameter | Value | Source |
|---|---|---|
| blocks | 3 | research/03 section 11.1, research/04 section 5 |
| trials per block | 48 (38 go, 10 no-go, fixed counts, seeded Fisher-Yates) | research/04 section 5 and 7.1 |
| go_probability | 0.8 | research/03 section 11.1 (itself a design choice there) |
| stimulus_ms | 500 | research/03 section 11.1, section 2.3 item 5 |
| ISI | uniform 900 to 1500 ms after each stimulus | research/03 section 11.1, research/04 section 5 |
| response window | stimulus + ISI (a late tap during the ISI still counts) | research/04 section 7.1 |
| calibration_trials | 10 | contract v1, research/04 section 5 |
| calibration wait, window, practice count | 800 to 2000 ms, 3000 ms, 2 | PR #27 (`../wake-fireflies/logic.ts`), TODO design choices there |
| lanterns | 3 | TODO design choice |
| go/no-go practice | 4 trials, fixed | TODO design choice |
| intros, break minimum, celebration | 2600, 2600, 2400, 4000, 3500 ms | TODO design choices |
| anticipation threshold | none (`ANTICIPATION_MS = null`) | TODO: FR-09 says device baseline, parameter in `thresholds.v0.json`, which does not exist |

## Contract mapping and conventions

- `trials`: calibration first (`type: "calibration"`, `block: 0`), then go/no-go trials (`block` 0 to blocks-1). `i` runs 0..n-1 over the whole array. Practice trials are never in `trials` (FR-02).
- Times are session-relative to the frame that starts the calibration intro (t0). `started_at` is `performance.timeOrigin + t0`.
- Omission and correct reject carry `x: 0, y: 0`, the convention of `packages/contracts/src/fixtures/session-metrics.valid.ts` and of PR #27. Answered trials carry the tap in CSS px from the game's top-left.
- `off_target_taps`: go/no-go blocks only. `during` is `stimulus` while the lantern is lit, else `isi`. A second tap on the same lit lantern is off-target (as the research/04 7.1 sketch). Calibration taps away from the firefly are not recorded, to match PR #27 (TODO team, its open point).
- `calibration`: PR #27's `summarise`: n = calibration trials run, median of hits only. If a whole calibration round has no hit, the round is run again and only the new round is recorded, because the contract cannot carry a calibration without a median. TODO team: design choice.
- `device`: `buildDeviceInfo` from packages/sensors; `pointer_type` from the first measured pointerdown; `est_refresh_hz` = 1000 / median rAF interval.
- `session_id`: `crypto.randomUUID`, or a version 4 UUID from `getRandomValues` outside a secure context.

## Reuse of PR #27 (Wake the fireflies)

One calibration implementation: the rules live in `../wake-fireflies/logic.ts` (waits, practice count, response window, `toContractTrial`, `summarise`). Lantern Watch draws that calibration in the 3D scene, so the child sees one world, while `/play/wake-fireflies` stays the 2D dev route of #27. Only the lantern choice is ours (3 lanterns instead of 5 fireflies, never the same twice in a row, the rule #27 uses).

## Timing

Same method as Bridge Wait: one rAF loop; `runner.frame(ts)` runs first and may light a lantern, then the same callback renders, so the onset is the frame that first draws it. The hide happens on the first frame at or after 500 ms (NFR-22, tested). Responses: native `pointerdown` on the game root, `event.timeStamp`, primary pointer only, never click.

## Child experience and colour-blind safety

- Go and no-go differ in luminance (bright gold against darker blue-violet), hue on the blue-yellow axis that protan and deutan vision keep, and shape (a small round glowing firefly against a wide-winged moth), so no single channel carries the signal.
- A caught firefly flies to Luma with the same short chime and sparkle every time. A tap on a moth gets no reaction at all: no sound, no mark. No score, no counter, no failure screen, no timer.
- The practice hand taps fireflies only. A hand under a moth read as "tap it" in the first screenshot round, so it was removed.
- Decorative fireflies and the camera drift run only on the start, rest and end screens.
- `prefers-reduced-motion`: no hops, no wing beats, no fireworks motion, no drift.

## Sensors

`consent` is accepted but nothing is started: packages/sensors has no capture yet and SessionMetrics v1 has no camera or microphone block (PC-04 proposed). the camera and microphone are never requested.

## Open TODOs

Storm Watch (mini-game 2) is not in this PR. Texts in `strings.ts`: texts owner review. Demo tablet: frame rate, timing probe (FR-06), audio unlock, tab hidden mid-trial. Anticipation threshold. Full-task duration with breaks (FR-13 demo round is a separate mode, not built here).
