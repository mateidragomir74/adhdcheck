import { z } from "zod";

// SessionMetrics v1 (game to backend).
// Source of truth: docs/02-specification-cahier-des-charges.md, section 7.1
// (copied from research/03-tech-stack.md, section 11.1). Strict: unknown fields are rejected.
// Units: all times in milliseconds (DOMHighResTimeStamp, session-relative); rt_ms is null when responded is false.

const ms = z.number().nonnegative();

export const TaskSchema = z.strictObject({
  type: z.literal("go_nogo"),
  version: z.string(),
  blocks: z.number().int().nonnegative(),
  go_probability: z.number().min(0).max(1),
  stimulus_ms: ms,
  isi_ms_min: ms,
  isi_ms_max: ms,
  calibration_trials: z.number().int().nonnegative(),
});

export const DeviceSchema = z.strictObject({
  user_agent: z.string(),
  pointer_type: z.enum(["touch", "mouse", "pen"]),
  screen_w: z.number().nonnegative(),
  screen_h: z.number().nonnegative(),
  device_pixel_ratio: z.number().positive(),
  est_refresh_hz: z.number().positive(),
  cross_origin_isolated: z.boolean(),
  timer_clock: z.string(),
});

export const TrialSchema = z.strictObject({
  i: z.number().int().nonnegative(),
  block: z.number().int().nonnegative(),
  type: z.enum(["go", "nogo", "calibration"]),
  stimulus_onset_ms: ms,
  responded: z.boolean(),
  rt_ms: ms.nullable(),
  outcome: z.enum(["hit", "omission", "correct_reject", "commission", "anticipation"]),
  x: z.number(),
  y: z.number(),
});

export const OffTargetTapSchema = z.strictObject({
  t_ms: ms,
  during: z.enum(["isi", "stimulus"]),
});

export const CalibrationSchema = z.strictObject({
  median_rt_ms: ms,
  n: z.number().int().nonnegative(),
});

// PC-02 (docs/02 section 10.3, accepted by Hatem 2026-10-20): the results of the mini-games played after Lantern
// Watch. One entry per mini-game with `id`, `version`, `params` and `trials` or `results`. Lantern Watch and its
// calibration stay in `trials`, `calibration` and `task`, so the scorer input does not change. `params`, `trials`
// and `results` are plain JSON whose shape belongs to each mini-game (packages/game/src/minigames/<id>/types.ts).
// A mini-game that could not run is recorded as `results: { status: "skipped", reason }` with version "none"
// (not part of PC-02's text: an implementation choice that the PR flags). The other blocks PC-02 mentions,
// `motion` and `context`, are NOT added: `context` needs the R5 privacy review first, and no motion is captured yet.
export const MINIGAME_IDS = ["star-path", "bridge-wait", "treasure-choice", "route-planner"] as const;

// Plain JSON with a bounded depth. zod's own z.json() recurses, so a payload nested a few thousand levels deep
// (about 10 KB) overflows the stack and the upload route answered 500. This check walks the value with an explicit
// stack, so the cost is the size of the body, which the route already limits. MAX_JSON_DEPTH is a safety bound, not a
// measured value: the deepest result of a mini-game today is a puzzle record with its taps and cells, 4 levels.
export const MAX_JSON_DEPTH = 8;

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };

function isBoundedJson(value: unknown): value is Json {
  const stack: Array<[unknown, number]> = [[value, 1]];
  for (let top = stack.pop(); top !== undefined; top = stack.pop()) {
    const [v, depth] = top;
    if (v === null || typeof v === "string" || typeof v === "boolean") continue;
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return false;
      continue;
    }
    if (typeof v !== "object" || depth > MAX_JSON_DEPTH) return false;
    if (Array.isArray(v)) {
      for (const item of v) stack.push([item, depth + 1]);
      continue;
    }
    const proto: unknown = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) return false;
    for (const item of Object.values(v)) stack.push([item, depth + 1]);
  }
  return true;
}

const BoundedJson = z.custom<Json>(isBoundedJson, { message: "bad_json" });

// Most records a mini-game can put in `trials`, so an upload cannot carry more than the game can play. Each value is
// what the game's own constants give (tied to them by packages/game/src/minigames/trial-caps.test.ts): Star Path
// (N_STARS - START_LENGTH + 1) lengths times MAX_FAILURES_PER_LENGTH sequences, Bridge Wait N_TRIALS, Treasure Choice
// N_CHOICES, Route Planner PUZZLES.length.
export const MINIGAME_MAX_TRIALS = {
  "star-path": 16,
  "bridge-wait": 24,
  "treasure-choice": 10,
  "route-planner": 4,
} as const satisfies Record<(typeof MINIGAME_IDS)[number], number>;

export const MiniGameEntrySchema = z
  .strictObject({
    id: z.enum(MINIGAME_IDS),
    version: z.string(),
    params: z.record(z.string(), BoundedJson),
    trials: z.array(BoundedJson).optional(),
    results: z.record(z.string(), BoundedJson).optional(),
  })
  .refine((e) => e.trials !== undefined || e.results !== undefined, { message: "trials_or_results_required" })
  .refine((e) => e.trials === undefined || e.trials.length <= MINIGAME_MAX_TRIALS[e.id], { message: "too_many_trials" });

export const MiniGamesSchema = z
  .array(MiniGameEntrySchema)
  .max(MINIGAME_IDS.length)
  .refine((a) => new Set(a.map((e) => e.id)).size === a.length, { message: "duplicate_minigame" });

export const SessionMetricsSchema = z.strictObject({
  schema_version: z.literal("1.0"),
  session_id: z.uuid(),
  child_id: z.uuid(),
  started_at: z.iso.datetime(),
  duration_ms: ms,
  task: TaskSchema,
  device: DeviceSchema,
  trials: z.array(TrialSchema),
  off_target_taps: z.array(OffTargetTapSchema),
  calibration: CalibrationSchema,
  minigames: MiniGamesSchema.optional(),
});

export type SessionMetrics = z.infer<typeof SessionMetricsSchema>;
export type Device = z.infer<typeof DeviceSchema>;
export type Trial = z.infer<typeof TrialSchema>;
export type MiniGameEntry = z.infer<typeof MiniGameEntrySchema>;
export type MiniGameId = (typeof MINIGAME_IDS)[number];
