# Wake the fireflies (FR-03), PR notes

Mini-game 0 of research/04 section 5, the calibration block: sleeping fireflies light up one at a time and the child taps each one to wake it. Simple taps only, no no-go. It gives a per-device reaction-time floor that the other mini-games can use instead of an absolute cut-off (research/03 section 2.3, item 2).

## Contract

Unlike the other mini-games, calibration is already in `SessionMetrics` v1, so this mini-game emits contract types directly (no local result shape to map later):

- `trials`: contract `Trial` objects with `type: "calibration"`, `block: 0`, session-relative `stimulus_onset_ms`, outcome `hit` or `omission`.
- `calibration`: the contract block `{ median_rt_ms, n }`. `n` is the number of calibration trials run (FR-03 acceptance: `n` equals `task.calibration_trials`, 10). The median uses hits only.
- `calibration` is `null` when no firefly was tapped, because the contract has no way to say "no median". TODO team (Person 2): how the session should carry that case.
- An omission has no tap position; it carries `x: 0, y: 0` like the research/04 section 7.1 sketch (same open point as in the setup PR).

The wrapper `WakeFirefliesResult` (`id`, `version`, `params`, `trials`, `calibration`) is only for the dev route and for whoever assembles the session.

## Timing

- Own `requestAnimationFrame` loop on a Canvas 2D. The onset is the timestamp of the rAF callback that draws the lit firefly; the response is the native `pointerdown` `event.timeStamp` (research/03 section 2.3, method 4). No `click`, `touch-action: none`.
- Window is start-inclusive and end-exclusive: a tap at the onset frame is a hit with rt 0; a tap at onset + window is an omission.
- Only taps on the lit firefly count (hit radius at least 44 CSS px, so 88 px across). Taps elsewhere get no reaction and are not recorded. TODO team: whether calibration taps elsewhere should go to `off_target_taps`.

## Why Canvas 2D and not three.js

Planned a Phaser scene, chose a plain Canvas 2D because the task is 30 seconds of simple taps, it needs no engine, it keeps the bundle small, and owning the rAF loop gives the exact onset frame. It can be moved to the 3D look of Bridge Wait later if the team wants one visual style.

## Child experience

- Intro: Luma, a speech bubble, a big play button. The first tap also unlocks audio (iOS Safari).
- Practice: 2 trials, same loop, a soft ring around the lit firefly shows where to tap. Never recorded.
- Each woken firefly plays the same short chime and flies up to the moon (FR-05). An unanswered firefly simply dims back, with no sound. No failure screen, no score, no number.
- End: every firefly gathers at the moon, Luma bobs happily, then `onComplete` after 2.5 s.
- `prefers-reduced-motion`: no star twinkle, no drift, no bobbing; woken fireflies appear at the moon directly.

## Design choices and TODOs (no sourced value)

- 10 measured trials: contract value. 2 practice trials, wait 800 to 2000 ms (jittered), response window 3000 ms, wake animation 700 ms, end hold 2500 ms: TODO design choices.
- Texts in `strings.ts`: TODO texts owner review.
- Sound: two synthesised sine notes, no file. Silent if audio is blocked; the game never depends on sound.
- TODO on the demo tablet: onset timing, audio unlock, and a tab hidden mid-trial (the rAF loop stops, so the trial ends as an omission when the tab returns).

## How it was checked

- 12 logic tests written first and seen failing, then passing (`logic.test.ts`), including contract validation with `TrialSchema` and `CalibrationSchema`.
- Played end to end in a headless browser at 1024x768 and 390x844 by tapping every firefly position; the dev panel result was parsed with the contract schemas (10 trials, `n: 10`, a median).
- Dev route: `/play/wake-fireflies` (dev query parameters `?seed=` and `?trials=` in development only). Like the other harness pages it returns 404 in production unless `GAME_HARNESS=1` (review G3).
- Only the primary pointer counts (review G5, `isPrimaryPointer`).
