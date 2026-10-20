import { describe, expect, it } from "vitest";
import {
  buildPracticeSchedule,
  buildSchedule,
  classifyTrial,
  computeDPrime,
  PRACTICE_TRIALS,
  STIMULUS_MS,
  summarise,
  TRIALS_PER_BLOCK,
} from "./logic";
import type { ScheduledTrial, StormWatchTrialRecord, Tap } from "./types";

describe("Storm Watch - Logic & Schedule", () => {
  it("buildSchedule creates exactly 80 trials (2 blocks of 40) with declared ratios", () => {
    const schedule = buildSchedule({ seed: 1042 });
    expect(schedule.length).toBe(80);

    const block0 = schedule.filter((t) => t.block === 0);
    const block1 = schedule.filter((t) => t.block === 1);
    expect(block0.length).toBe(TRIALS_PER_BLOCK);
    expect(block1.length).toBe(TRIALS_PER_BLOCK);

    // Block kinds
    const calmBlock = schedule.filter((t) => t.blockKind === "calm");
    const stormBlock = schedule.filter((t) => t.blockKind === "storm");
    expect(calmBlock.length).toBe(40);
    expect(stormBlock.length).toBe(40);

    // No distractors in calm block
    expect(calmBlock.every((t) => !t.hasDistractor)).toBe(true);
    // Distractors present in storm block
    const stormDistractors = stormBlock.filter((t) => t.hasDistractor);
    expect(stormDistractors.length).toBeGreaterThan(15);

    // Exact count check for go (24), go_audio (8), nogo (8) per block
    for (const b of [block0, block1]) {
      const go = b.filter((t) => t.type === "go");
      const goAudio = b.filter((t) => t.type === "go_audio");
      const nogo = b.filter((t) => t.type === "nogo");
      expect(go.length).toBe(24);
      expect(goAudio.length).toBe(8);
      expect(nogo.length).toBe(8);
      expect(go.length + goAudio.length).toBe(32); // 80% of 40
    }
  });

  it("counterbalances block order based on seed parity", () => {
    const evenSchedule = buildSchedule({ seed: 42 }); // even: calm then storm
    expect(evenSchedule[0]?.blockKind).toBe("calm");
    expect(evenSchedule[40]?.blockKind).toBe("storm");

    const oddSchedule = buildSchedule({ seed: 43 }); // odd: storm then calm
    expect(oddSchedule[0]?.blockKind).toBe("storm");
    expect(oddSchedule[40]?.blockKind).toBe("calm");
  });

  it("is deterministic with the same seed", () => {
    const s1 = buildSchedule({ seed: 999 });
    const s2 = buildSchedule({ seed: 999 });
    expect(s1).toEqual(s2);
  });

  it("builds 4 practice trials (2 go, 1 nogo, 1 go_audio)", () => {
    const practice = buildPracticeSchedule();
    expect(practice.length).toBe(PRACTICE_TRIALS);
    expect(practice.filter((t) => t.type === "go").length).toBe(2);
    expect(practice.filter((t) => t.type === "nogo").length).toBe(1);
    expect(practice.filter((t) => t.type === "go_audio").length).toBe(1);
  });
});

describe("Storm Watch - Classification", () => {
  const goTrial: ScheduledTrial = {
    i: 0,
    block: 0,
    blockKind: "calm",
    type: "go",
    treeLocation: 1,
    isiMs: 1000,
    stimulusMs: STIMULUS_MS,
    hasDistractor: false,
  };

  const nogoTrial: ScheduledTrial = {
    i: 1,
    block: 0,
    blockKind: "calm",
    type: "nogo",
    treeLocation: 2,
    isiMs: 1000,
    stimulusMs: STIMULUS_MS,
    hasDistractor: false,
  };

  it("classifies valid tap on go as hit", () => {
    const taps: Tap[] = [{ tMs: 1350, x: 100, y: 100 }];
    const res = classifyTrial(goTrial, taps, 1000);
    expect(res.outcome).toBe("hit");
    expect(res.rtMs).toBe(350);
    expect(res.responded).toBe(true);
  });

  it("classifies no tap on go as omission", () => {
    const res = classifyTrial(goTrial, [], 1000);
    expect(res.outcome).toBe("omission");
    expect(res.rtMs).toBeNull();
    expect(res.responded).toBe(false);
  });

  it("classifies tap < 150ms on go as anticipation", () => {
    const taps: Tap[] = [{ tMs: 1080, x: 100, y: 100 }];
    const res = classifyTrial(goTrial, taps, 1000);
    expect(res.outcome).toBe("anticipation");
    expect(res.rtMs).toBe(80);
    expect(res.responded).toBe(true);
  });

  it("classifies no tap on nogo as correct_reject", () => {
    const res = classifyTrial(nogoTrial, [], 1000);
    expect(res.outcome).toBe("correct_reject");
    expect(res.responded).toBe(false);
  });

  it("classifies tap on nogo as commission", () => {
    const taps: Tap[] = [{ tMs: 1250, x: 100, y: 100 }];
    const res = classifyTrial(nogoTrial, taps, 1000);
    expect(res.outcome).toBe("commission");
    expect(res.rtMs).toBe(250);
    expect(res.responded).toBe(true);
  });
});

describe("Storm Watch - Summarise & Distractor Cost", () => {
  it("calculates summary, distractor cost and audio performance accurately", () => {
    const mockTrials: StormWatchTrialRecord[] = [];

    // Create 40 calm trials: 32 go, 8 nogo
    for (let i = 0; i < 40; i++) {
      const isNogo = i < 8;
      const isAudio = !isNogo && i < 16;
      mockTrials.push({
        i,
        block: 0,
        blockKind: "calm",
        type: isNogo ? "nogo" : isAudio ? "go_audio" : "go",
        treeLocation: 1,
        stimulusOnsetMs: i * 2000,
        responded: !isNogo,
        rtMs: isNogo ? null : 300,
        outcome: isNogo ? "correct_reject" : "hit",
        hasDistractor: false,
        taps: isNogo ? [] : [{ tMs: i * 2000 + 300, x: 0, y: 0 }],
      });
    }

    // Create 40 storm trials: same, but with 4 omissions and 2 commissions
    for (let i = 40; i < 80; i++) {
      const idx = i - 40;
      const isNogo = idx < 8;
      const isAudio = !isNogo && idx < 16;
      const isOmission = !isNogo && idx < 12; // 4 omissions
      const isCommission = isNogo && idx < 2; // 2 commissions

      mockTrials.push({
        i,
        block: 1,
        blockKind: "storm",
        type: isNogo ? "nogo" : isAudio ? "go_audio" : "go",
        treeLocation: 1,
        stimulusOnsetMs: i * 2000,
        responded: isCommission || (!isNogo && !isOmission),
        rtMs: isOmission || (isNogo && !isCommission) ? null : 400,
        outcome: isNogo
          ? isCommission
            ? "commission"
            : "correct_reject"
          : isOmission
            ? "omission"
            : "hit",
        hasDistractor: true,
        distractorType: "bird",
        taps: [],
      });
    }

    const summary = summarise(mockTrials);
    expect(summary.nTrials).toBe(80);
    expect(summary.blockCalm.omissions).toBe(0);
    expect(summary.blockCalm.commissions).toBe(0);
    expect(summary.blockStorm.omissions).toBe(4);
    expect(summary.blockStorm.commissions).toBe(2);

    // Distractor cost: storm omission rate - calm omission rate > 0
    expect(summary.distractorCost.omissionRateDelta).toBeGreaterThan(0);
    expect(summary.distractorCost.commissionRateDelta).toBeGreaterThan(0);

    // Audio performance
    expect(summary.audioPerformance.nAudioTrials).toBe(16);
    expect(summary.audioPerformance.nVisualGoTrials).toBe(48);
  });

  it("computes d-prime", () => {
    const dpHigh = computeDPrime(0.95, 0.05);
    const dpLow = computeDPrime(0.6, 0.4);
    expect(dpHigh).toBeGreaterThan(dpLow);
    expect(dpHigh).toBeGreaterThan(2.0);
  });
});
