import type { Trial } from "@adhdcheck/contracts";
import type { Calibration, RawTrial, ScheduleConfig, ScheduledTrial } from "./types";

export const CALIBRATION_TRIALS = 10; // SessionMetrics v1 `calibration_trials: 10` (research/04 section 5)
export const PRACTICE_TRIALS = 2; // TODO: design choice (skill: practice round before every measured task)
export const WAIT_MS_MIN = 800; // TODO: design choice, no sourced value
export const WAIT_MS_MAX = 2000; // TODO: design choice, no sourced value
export const RESPONSE_WINDOW_MS = 3000; // TODO: design choice, no sourced value
export const N_SLOTS = 5; // sleeping fireflies on screen (layout choice)

// Seeded PRNG, same as research/04 section 7.1, so a seed reproduces the schedule.
export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jittered waits so the child cannot anticipate the light; never the same firefly twice in a row. */
export function buildSchedule(cfg: ScheduleConfig): ScheduledTrial[] {
  const rnd = mulberry32(cfg.seed);
  const out: ScheduledTrial[] = [];
  let prev = -1;
  for (let i = 0; i < cfg.count; i++) {
    // Pick among the other N_SLOTS - 1 slots, uniformly.
    let slot = Math.floor(rnd() * (prev < 0 ? N_SLOTS : N_SLOTS - 1));
    if (prev >= 0 && slot >= prev) slot += 1;
    prev = slot;
    out.push({ i, waitMs: WAIT_MS_MIN + rnd() * (WAIT_MS_MAX - WAIT_MS_MIN), slot });
  }
  return out;
}

/** Window is start-inclusive and end-exclusive: a tap at the onset frame is a hit with rt 0. */
export function classifyResponse(
  onsetMs: number,
  tapMs: number | null,
  windowMs: number,
): Pick<Trial, "responded" | "rt_ms" | "outcome"> {
  if (tapMs !== null && tapMs >= onsetMs && tapMs < onsetMs + windowMs) {
    return { responded: true, rt_ms: tapMs - onsetMs, outcome: "hit" };
  }
  return { responded: false, rt_ms: null, outcome: "omission" };
}

export function toContractTrial(raw: RawTrial, sessionStartMs: number, windowMs: number): Trial {
  const r = classifyResponse(raw.onsetMs, raw.tapMs, windowMs);
  return {
    i: raw.i,
    block: 0,
    type: "calibration",
    stimulus_onset_ms: raw.onsetMs - sessionStartMs,
    responded: r.responded,
    rt_ms: r.rt_ms,
    outcome: r.outcome,
    // The contract needs a position on every trial; an omission has none, so it carries 0, 0
    // like the research/04 section 7.1 sketch (open point in the setup PR).
    x: r.responded ? raw.x : 0,
    y: r.responded ? raw.y : 0,
  };
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? (s[m] as number) : ((s[m - 1] as number) + (s[m] as number)) / 2;
}

/**
 * The SessionMetrics calibration block: n is the number of calibration trials run
 * (FR-03 acceptance: n equals task.calibration_trials); the median uses hits only.
 * Null when no firefly was tapped, because the contract has no way to say "no median".
 */
export function summarise(trials: Trial[]): Calibration | null {
  const rts = trials.filter((t) => t.outcome === "hit" && t.rt_ms !== null).map((t) => t.rt_ms as number);
  if (rts.length === 0) return null;
  return { median_rt_ms: median(rts), n: trials.length };
}
