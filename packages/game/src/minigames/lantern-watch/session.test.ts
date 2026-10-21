import { describe, expect, it } from "vitest";
import { ScoreResultSchema, SessionMetricsSchema, type Trial } from "@adhdcheck/contracts";
import { scoreSession } from "@adhdcheck/scoring";
import { DEFAULT_TASK } from "./logic";
import { TASK_VERSION, buildSessionMetrics, calibrationBlock, taskBlock } from "./session";

// Synthetic session: identifiers and values are made up for tests.
const SESSION = "0b6f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4";
const CHILD = "1c2d3e4f-5a6b-4c7d-9e8f-0a1b2c3d4e5f";
const DEVICE = {
  user_agent: "synthetic-test-agent",
  pointer_type: "touch" as const,
  screen_w: 1024,
  screen_h: 768,
  device_pixel_ratio: 2,
  est_refresh_hz: 60,
  cross_origin_isolated: false,
  timer_clock: "event.timeStamp",
};

function trials(): Trial[] {
  const out: Trial[] = [];
  let t = 1000;
  for (let k = 0; k < 10; k++) {
    out.push({ i: out.length, block: 0, type: "calibration", stimulus_onset_ms: t, responded: true, rt_ms: 300 + k * 10, outcome: "hit", x: 500, y: 300 });
    t += 1500;
  }
  out.push({ i: out.length, block: 0, type: "go", stimulus_onset_ms: t, responded: true, rt_ms: 420, outcome: "hit", x: 510, y: 320 });
  out.push({ i: out.length, block: 0, type: "go", stimulus_onset_ms: t + 1700, responded: false, rt_ms: null, outcome: "omission", x: 0, y: 0 });
  out.push({ i: out.length, block: 0, type: "nogo", stimulus_onset_ms: t + 3400, responded: false, rt_ms: null, outcome: "correct_reject", x: 0, y: 0 });
  out.push({ i: out.length, block: 0, type: "nogo", stimulus_onset_ms: t + 5100, responded: true, rt_ms: 380, outcome: "commission", x: 200, y: 330 });
  return out;
}

function build() {
  return buildSessionMetrics({
    sessionId: SESSION,
    childId: CHILD,
    startedAt: "2026-10-20T10:00:00.123Z",
    durationMs: 30000.5,
    task: DEFAULT_TASK,
    device: DEVICE,
    trials: trials(),
    offTargetTaps: [{ t_ms: 800.2, during: "isi" }],
  });
}

describe("buildSessionMetrics (FR-10)", () => {
  it("returns an object the contract's zod schema accepts", () => {
    const m = build();
    expect(SessionMetricsSchema.safeParse(m).success).toBe(true);
  });

  it("declares in task exactly the parameters the engine ran (FR-04)", () => {
    expect(taskBlock(DEFAULT_TASK)).toEqual({
      type: "go_nogo",
      version: TASK_VERSION,
      blocks: 3,
      go_probability: 0.8,
      stimulus_ms: 500,
      isi_ms_min: 900,
      isi_ms_max: 1500,
      calibration_trials: 10,
    });
    expect(build().task).toEqual(taskBlock(DEFAULT_TASK));
  });

  it("has calibration.n equal to task.calibration_trials and the median of the calibration RTs (FR-03)", () => {
    const m = build();
    expect(m.calibration.n).toBe(m.task.calibration_trials);
    expect(m.calibration.median_rt_ms).toBe(345); // RTs 300..390 step 10: median of 340 and 350
  });

  it("calibrationBlock ignores go and no-go trials", () => {
    expect(calibrationBlock(trials())).toEqual({ median_rt_ms: 345, n: 10 });
  });

  it("refuses to build when no calibration RT exists", () => {
    expect(() => calibrationBlock(trials().filter((t) => t.type !== "calibration"))).toThrow();
  });

  it("refuses a payload the contract rejects (the check can fail)", () => {
    const bad = trials();
    (bad[0] as Record<string, unknown>).extra = 1;
    expect(() =>
      buildSessionMetrics({
        sessionId: SESSION,
        childId: CHILD,
        startedAt: "2026-10-20T10:00:00.123Z",
        durationMs: 1,
        task: DEFAULT_TASK,
        device: DEVICE,
        trials: bad,
        offTargetTaps: [],
      }),
    ).toThrow();
    expect(() =>
      buildSessionMetrics({
        sessionId: "not-a-uuid",
        childId: CHILD,
        startedAt: "2026-10-20T10:00:00.123Z",
        durationMs: 1,
        task: DEFAULT_TASK,
        device: DEVICE,
        trials: trials(),
        offTargetTaps: [],
      }),
    ).toThrow();
  });
});

describe("the scorer accepts a Lantern Watch session", () => {
  it("returns a ScoreResult that validates", () => {
    const m = build();
    const r = scoreSession(m);
    expect(ScoreResultSchema.safeParse(r).success).toBe(true);
    expect(r.session_id).toBe(SESSION);
  });
});
