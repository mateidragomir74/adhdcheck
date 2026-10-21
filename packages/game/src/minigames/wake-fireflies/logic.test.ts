import { describe, expect, it } from "vitest";
import { CalibrationSchema, TrialSchema, type Trial } from "@adhdcheck/contracts";
import {
  CALIBRATION_TRIALS,
  N_SLOTS,
  RESPONSE_WINDOW_MS,
  WAIT_MS_MAX,
  WAIT_MS_MIN,
  buildSchedule,
  classifyResponse,
  summarise,
  toContractTrial,
} from "./logic";

const hit = (i: number, rt: number): Trial => ({
  i,
  block: 0,
  type: "calibration",
  stimulus_onset_ms: 1000 * i,
  responded: true,
  rt_ms: rt,
  outcome: "hit",
  x: 10,
  y: 20,
});
const miss = (i: number): Trial => ({
  i,
  block: 0,
  type: "calibration",
  stimulus_onset_ms: 1000 * i,
  responded: false,
  rt_ms: null,
  outcome: "omission",
  x: 0,
  y: 0,
});

describe("buildSchedule", () => {
  it("has the contract number of calibration trials (10)", () => {
    expect(CALIBRATION_TRIALS).toBe(10);
    expect(buildSchedule({ seed: 1, count: CALIBRATION_TRIALS })).toHaveLength(10);
  });

  it("is reproducible from the seed and changes with it", () => {
    const a = buildSchedule({ seed: 42, count: 10 });
    expect(buildSchedule({ seed: 42, count: 10 })).toEqual(a);
    expect(buildSchedule({ seed: 43, count: 10 })).not.toEqual(a);
  });

  it("keeps waits in range, slots valid, and never lights the same firefly twice in a row", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const s = buildSchedule({ seed, count: 10 });
      s.forEach((t, k) => {
        expect(t.i).toBe(k);
        expect(t.waitMs).toBeGreaterThanOrEqual(WAIT_MS_MIN);
        expect(t.waitMs).toBeLessThan(WAIT_MS_MAX);
        expect(t.slot).toBeGreaterThanOrEqual(0);
        expect(t.slot).toBeLessThan(N_SLOTS);
        if (k > 0) expect(t.slot).not.toBe(s[k - 1]?.slot);
      });
    }
  });
});

describe("classifyResponse", () => {
  it("a tap at the onset frame is a hit with rt 0 (start-inclusive)", () => {
    expect(classifyResponse(500, 500, 3000)).toEqual({ responded: true, rt_ms: 0, outcome: "hit" });
  });

  it("a tap inside the window is a hit with rt from the onset", () => {
    expect(classifyResponse(500, 812.5, 3000)).toEqual({ responded: true, rt_ms: 312.5, outcome: "hit" });
  });

  it("no tap, or a tap at or after the window end, is an omission", () => {
    const omission = { responded: false, rt_ms: null, outcome: "omission" };
    expect(classifyResponse(500, null, 3000)).toEqual(omission);
    expect(classifyResponse(500, 3500, 3000)).toEqual(omission);
    expect(classifyResponse(500, 3499.9, 3000)).toEqual({ responded: true, rt_ms: 2999.9, outcome: "hit" });
  });

  it("a tap before the onset never counts as a response", () => {
    expect(classifyResponse(500, 499, 3000).outcome).toBe("omission");
  });
});

describe("toContractTrial", () => {
  it("returns a valid contract trial of type calibration with a session-relative onset", () => {
    const t = toContractTrial({ i: 3, onsetMs: 10_500, tapMs: 10_800, x: 120, y: 340 }, 10_000, RESPONSE_WINDOW_MS);
    expect(TrialSchema.parse(t)).toEqual(t);
    expect(t).toMatchObject({ i: 3, block: 0, type: "calibration", stimulus_onset_ms: 500, rt_ms: 300, outcome: "hit", x: 120, y: 340 });
  });

  it("an omission has rt_ms null and still passes the contract", () => {
    const t = toContractTrial({ i: 0, onsetMs: 2000, tapMs: null, x: 0, y: 0 }, 1000, RESPONSE_WINDOW_MS);
    expect(TrialSchema.parse(t)).toEqual(t);
    expect(t).toMatchObject({ responded: false, rt_ms: null, outcome: "omission" });
  });
});

describe("summarise", () => {
  it("n equals the number of calibration trials and the median uses hits only (acceptance FR-03)", () => {
    const trials = [hit(0, 300), miss(1), hit(2, 250), hit(3, 400), miss(4), hit(5, 280), hit(6, 310), hit(7, 290), hit(8, 260), hit(9, 1000)];
    const c = summarise(trials);
    expect(c).not.toBeNull();
    expect(CalibrationSchema.parse(c)).toEqual(c);
    expect(c?.n).toBe(CALIBRATION_TRIALS);
    // hits sorted: 250 260 280 290 300 310 400 1000 -> median (290 + 300) / 2
    expect(c?.median_rt_ms).toBe(295);
  });

  it("odd number of hits takes the middle value", () => {
    expect(summarise([hit(0, 300), hit(1, 100), hit(2, 200)])?.median_rt_ms).toBe(200);
  });

  it("returns null when no firefly was tapped (not enough data)", () => {
    expect(summarise([miss(0), miss(1)])).toBeNull();
  });
});
