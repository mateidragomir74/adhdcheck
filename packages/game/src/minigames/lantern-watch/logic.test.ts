import { describe, expect, it } from "vitest";
import {
  DEFAULT_TASK,
  LANTERNS,
  buildCalibrationSchedule,
  buildSchedule,
  classify,
  estimateRefreshHz,
  hitRadius,
  median,
  normalizePointerType,
} from "./logic";
import { WAIT_MS_MAX, WAIT_MS_MIN } from "../wake-fireflies/logic";

describe("Lantern Watch task parameters (research/03 section 11.1, research/04 section 5)", () => {
  it("declares the contract v1 values", () => {
    expect(DEFAULT_TASK).toEqual({
      blocks: 3,
      trialsPerBlock: 48,
      goProbability: 0.8,
      stimulusMs: 500,
      isiMsMin: 900,
      isiMsMax: 1500,
      calibrationTrials: 10,
    });
  });
});

describe("buildSchedule (seeded, fixed go/no-go counts per block)", () => {
  const s = buildSchedule(DEFAULT_TASK, 1234);

  it("has 3 blocks of 48 trials, 144 in all", () => {
    expect(s).toHaveLength(144);
    for (let b = 0; b < 3; b++) expect(s.filter((t) => t.block === b)).toHaveLength(48);
    expect(s.map((t) => t.block)).toEqual([...s.map((t) => t.block)].sort((a, b) => a - b));
  });

  it("has exactly 38 go and 10 no-go in every block", () => {
    for (let b = 0; b < 3; b++) {
      const block = s.filter((t) => t.block === b);
      expect(block.filter((t) => t.type === "go")).toHaveLength(38);
      expect(block.filter((t) => t.type === "nogo")).toHaveLength(10);
    }
  });

  it("draws every ISI in [900, 1500) ms and every lantern in range", () => {
    for (const t of s) {
      expect(t.isiMs).toBeGreaterThanOrEqual(900);
      expect(t.isiMs).toBeLessThan(1500);
      expect(Number.isInteger(t.lantern)).toBe(true);
      expect(t.lantern).toBeGreaterThanOrEqual(0);
      expect(t.lantern).toBeLessThan(LANTERNS);
    }
  });

  it("replays exactly from the same seed and differs with another", () => {
    expect(buildSchedule(DEFAULT_TASK, 1234)).toEqual(s);
    expect(buildSchedule(DEFAULT_TASK, 99)).not.toEqual(s);
  });

  it("shuffles the order (no-go trials are not all at the end of a block)", () => {
    const block0 = s.filter((t) => t.block === 0).map((t) => t.type);
    expect(block0.slice(38)).not.toEqual(Array(10).fill("nogo"));
  });

  it("sizes a dev run of 1 block of 10 trials to 8 go and 2 no-go", () => {
    const d = buildSchedule({ ...DEFAULT_TASK, blocks: 1, trialsPerBlock: 10 }, 5);
    expect(d).toHaveLength(10);
    expect(d.filter((t) => t.type === "go")).toHaveLength(8);
    expect(d.filter((t) => t.type === "nogo")).toHaveLength(2);
  });
});

describe("buildCalibrationSchedule (Wake the fireflies, rules of PR #27)", () => {
  it("has calibration_trials entries with #27's wait range, never the same lantern twice in a row", () => {
    const c = buildCalibrationSchedule(DEFAULT_TASK.calibrationTrials, 1234);
    expect(c).toHaveLength(10);
    for (const t of c) {
      expect(t.waitMs).toBeGreaterThanOrEqual(WAIT_MS_MIN);
      expect(t.waitMs).toBeLessThan(WAIT_MS_MAX);
      expect(t.lantern).toBeLessThan(LANTERNS);
    }
    for (let k = 1; k < c.length; k++) expect(c[k]?.lantern).not.toBe(c[k - 1]?.lantern);
    expect(buildCalibrationSchedule(10, 1234)).toEqual(c);
  });
});

describe("classify (FR-09: the five contract outcomes)", () => {
  it("hit: go answered", () => expect(classify("go", true, 420, 150)).toBe("hit"));
  it("omission: go not answered", () => expect(classify("go", false, null, 150)).toBe("omission"));
  it("correct_reject: no-go not answered", () => expect(classify("nogo", false, null, 150)).toBe("correct_reject"));
  it("commission: no-go answered", () => expect(classify("nogo", true, 420, 150)).toBe("commission"));
  it("anticipation: answered faster than the threshold, go or no-go", () => {
    expect(classify("go", true, 90, 150)).toBe("anticipation");
    expect(classify("nogo", true, 90, 150)).toBe("anticipation");
  });
  it("boundary: an RT equal to the threshold is not an anticipation", () => {
    expect(classify("go", true, 150, 150)).toBe("hit");
  });
  it("no threshold set (TODO thresholds.v0.json): never anticipation", () => {
    expect(classify("go", true, 1, null)).toBe("hit");
    expect(classify("nogo", true, 1, null)).toBe("commission");
  });
  it("calibration trials: hit when answered, omission when not", () => {
    expect(classify("calibration", true, 300, null)).toBe("hit");
    expect(classify("calibration", false, null, null)).toBe("omission");
  });
});

describe("median", () => {
  it("odd, even, empty", () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("estimateRefreshHz", () => {
  it("is 1000 / median frame interval", () => {
    expect(estimateRefreshHz([16.7, 16.6, 16.7, 50, 16.7])).toBeCloseTo(1000 / 16.7, 5);
  });
  it("is null with no frames", () => {
    expect(estimateRefreshHz([])).toBeNull();
  });
});

describe("normalizePointerType", () => {
  it("keeps the three contract values and maps anything else to the fallback", () => {
    expect(normalizePointerType("touch", "mouse")).toBe("touch");
    expect(normalizePointerType("pen", "mouse")).toBe("pen");
    expect(normalizePointerType("mouse", "touch")).toBe("mouse");
    expect(normalizePointerType("", "touch")).toBe("touch");
    expect(normalizePointerType(undefined, "mouse")).toBe("mouse");
  });
});

describe("hitRadius (R3-L5)", () => {
  it("keeps the 34 px floor when there is room", () => {
    expect(hitRadius(20, 400)).toBe(34);
    expect(hitRadius(50, 400)).toBe(50);
  });
  it("never exceeds half the gap between two lanterns, so hit areas never overlap", () => {
    expect(hitRadius(100, 100)).toBe(48);
  });
  it("lets non-overlap win over the floor when the lanterns are closer than 72 px", () => {
    expect(hitRadius(50, 60)).toBe(28);
    expect(hitRadius(50, 60)).toBeLessThan(34);
  });
});
