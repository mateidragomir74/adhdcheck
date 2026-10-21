import { describe, expect, it } from "vitest";
import { SessionMetricsSchema } from "@adhdcheck/contracts";
import { DEFAULT_TASK } from "./logic";
import { LanternWatchRunner, type ActiveTrial, type RunData, type RunState } from "./runner";
import { buildSessionMetrics } from "./session";

// Ending Lantern Watch early (the visible "Next game" button): the trials already recorded are kept.
const FRAME = 1000 / 60;
const DEVICE = {
  user_agent: "test",
  pointer_type: "touch" as const,
  screen_w: 800,
  screen_h: 600,
  device_pixel_ratio: 1,
  est_refresh_hz: 60,
  cross_origin_isolated: false,
  timer_clock: "performance.now",
};

/** Plays like a child who taps every firefly after 400 ms and ignores moths, until `stop` says so. */
function drive(stop: (r: LanternWatchRunner, ts: number) => boolean, opts: { tapCalibration?: boolean } = {}) {
  const tapCalibration = opts.tapCalibration ?? true;
  let completed: RunData | null = null;
  const states: RunState[] = [];
  const pending: Array<{ t: number; lantern: number | null }> = [];
  const readyAt: number[] = [];
  const r: LanternWatchRunner = new LanternWatchRunner(
    { task: DEFAULT_TASK, seed: 42, anticipationMs: null },
    {
      onState: (s, ts) => {
        states.push(s);
        if (s === "break") pending.push({ t: ts + 10_000, lantern: null });
        if (s === "calib-intro" || s === "practice-intro" || (s === "block-intro" && r.blockIndex === 0)) readyAt.push(ts + 5000);
      },
      onStimulus: (ts, trial: ActiveTrial) => {
        const isCalibration = trial.phase === "calibration";
        if (trial.type !== "nogo" && (!isCalibration || tapCalibration)) pending.push({ t: ts + 400, lantern: trial.lantern });
      },
      onComplete: (d) => (completed = d),
    },
  );
  let ts = 1000;
  r.pointerDown(ts - 5, 0, 0, null);
  for (let k = 0; k < 400_000 && !stop(r, ts) && !completed; k++) {
    ts += FRAME;
    while (readyAt.length && (readyAt[0] as number) <= ts) r.ready(readyAt.shift() as number);
    while (pending.length && (pending[0] as { t: number }).t <= ts) {
      const p = pending.shift() as { t: number; lantern: number | null };
      r.pointerDown(p.t, 100, 200, p.lantern);
    }
    r.frame(ts);
  }
  return { r, ts, completed: () => completed, states };
}

const build = (d: RunData) =>
  buildSessionMetrics({
    sessionId: "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
    childId: "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
    startedAt: new Date(1_700_000_000_000 + d.t0).toISOString(),
    durationMs: d.duration_ms,
    task: DEFAULT_TASK,
    device: DEVICE,
    trials: d.trials,
    offTargetTaps: d.off_target_taps,
  });

describe("LanternWatchRunner.endEarly", () => {
  it("returns null when no calibration firefly was tapped yet: the contract cannot carry a calibration without a median", () => {
    const early = drive((r) => r.state === "calib" && r.current()?.onset != null && r.current()?.taskIndex === 3, { tapCalibration: false });
    expect(early.r.state).toBe("calib");
    expect(early.r.endEarly(early.ts)).toBeNull();
  });

  it("returns null before the first measured frame (the intro and the calibration instruction)", () => {
    const intro = new LanternWatchRunner({ task: DEFAULT_TASK, seed: 42, anticipationMs: null });
    expect(intro.endEarly(10)).toBeNull();
    const calibIntro = drive((r) => r.state === "calib-intro");
    expect(calibIntro.r.endEarly(calibIntro.ts)).toBeNull();
  });

  it("during the calibration round with a hit: keeps the calibration trials already closed, and they build a valid SessionMetrics", () => {
    const d = drive((r) => r.state === "calib" && r.current()?.taskIndex === 4 && r.current()?.onset != null);
    const data = d.r.endEarly(d.ts);
    expect(data).not.toBeNull();
    const kept = (data as RunData).trials;
    expect(kept.length).toBeGreaterThan(0);
    expect(kept.length).toBeLessThanOrEqual(4); // the trial in flight is not counted
    expect(kept.every((t) => t.type === "calibration")).toBe(true);
    expect(kept.map((t) => t.i)).toEqual(kept.map((_, k) => k));
    expect(SessionMetricsSchema.safeParse(build(data as RunData)).success).toBe(true);
  });

  it("in the middle of the task: keeps the calibration and the task trials closed so far", () => {
    const d = drive((r) => r.state === "trials" && r.current()?.taskIndex === 7 && r.current()?.onset != null);
    const data = d.r.endEarly(d.ts) as RunData;
    const task = data.trials.filter((t) => t.type !== "calibration");
    expect(task).toHaveLength(7);
    expect(data.trials.some((t) => t.type === "calibration")).toBe(true);
    expect(data.trials.map((t) => t.i)).toEqual(data.trials.map((_, k) => k)); // unique, in order
    expect(data.duration_ms).toBeCloseTo(d.ts - data.t0, 3);
    expect(SessionMetricsSchema.safeParse(build(data)).success).toBe(true);
  });

  it("freezes the run: a second call, a later frame or a late tap change nothing, and onComplete is not called", () => {
    const d = drive((r) => r.state === "trials" && r.current()?.taskIndex === 3 && r.current()?.onset != null);
    const data = d.r.endEarly(d.ts) as RunData;
    const before = JSON.stringify(data);
    expect(d.r.state).toBe("done");
    expect(d.r.endEarly(d.ts + 50)).toBeNull();
    d.r.frame(d.ts + 5000);
    d.r.pointerDown(d.ts + 5001, 1, 1, 0);
    expect(JSON.stringify(data)).toBe(before);
    expect(d.completed()).toBeNull();
  });

  it("returns null once the run completed by itself", () => {
    const d = drive(() => false);
    expect(d.completed()).not.toBeNull();
    expect(d.r.endEarly(d.ts + 1)).toBeNull();
  });
});

// I-1: the "Next game" button is shown only once ending early can produce valid metrics (a calibration hit is recorded).
describe("LanternWatchRunner.canEndEarly", () => {
  it("is false before the first calibration hit, in the intro, the instruction and the calibration round", () => {
    const intro = new LanternWatchRunner({ task: DEFAULT_TASK, seed: 42, anticipationMs: null });
    expect(intro.canEndEarly()).toBe(false);
    const instruction = drive((r) => r.state === "calib-intro");
    expect(instruction.r.canEndEarly()).toBe(false);
    const noTaps = drive((r) => r.state === "calib" && r.current()?.taskIndex === 5 && r.current()?.onset != null, { tapCalibration: false });
    expect(noTaps.r.state).toBe("calib");
    expect(noTaps.r.canEndEarly()).toBe(false);
  });

  it("becomes true exactly when endEarly can return valid data, and then stays true until the run is frozen", () => {
    const d = drive((r) => r.canEndEarly());
    expect(d.r.canEndEarly()).toBe(true);
    const data = d.r.endEarly(d.ts);
    expect(data).not.toBeNull();
    expect(data?.trials.some((t) => t.type === "calibration" && t.outcome === "hit")).toBe(true);
    expect(d.r.canEndEarly()).toBe(false); // done
  });

  it("is true after calibration (practice and task states) and false once the run completed", () => {
    const mid = drive((r) => r.state === "trials" && r.current()?.taskIndex === 2 && r.current()?.onset != null);
    expect(mid.r.canEndEarly()).toBe(true);
    const full = drive(() => false);
    expect(full.completed()).not.toBeNull();
    expect(full.r.canEndEarly()).toBe(false);
  });
});
