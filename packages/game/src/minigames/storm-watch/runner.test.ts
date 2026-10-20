import { describe, expect, it, vi } from "vitest";
import { StormWatchRunner } from "./runner";
import type { StormWatchResult } from "./types";

describe("Storm Watch - Runner State Machine", () => {
  it("progresses through practice and trials, emitting complete result", () => {
    let completedResult: StormWatchResult | null = null;
    const hooks = {
      onStateChange: vi.fn(),
      onStimulusOnset: vi.fn(),
      onStimulusEnd: vi.fn(),
      onDistractorTrigger: vi.fn(),
      onHit: vi.fn(),
      onCommission: vi.fn(),
      onTapFeedback: vi.fn(),
      onComplete: (r: StormWatchResult) => {
        completedResult = r;
      },
    };

    // Use small trial count for fast testing: 4 trials per block (8 total)
    const runner = new StormWatchRunner(hooks, {
      seed: 42,
      trialsPerBlock: 4,
      skipPractice: true,
      stimulusMs: 100,
    });

    expect(runner.state).toBe("intro");

    // Start via start button
    runner.start(100);
    expect(runner.state).toBe("block-intro");

    // Advance through time
    let time = 100;

    // Advance past block-intro (2500ms)
    time += 2600;
    runner.frame(time);
    expect(runner.state).toBe("trial-isi");

    // Run 8 trials
    for (let i = 0; i < 8; i++) {
      // Advance past ISI (max 2000ms)
      time += 2200;
      runner.frame(time);
      expect(runner.state).toBe("trial-stimulus");

      // Tap on stimulus
      runner.pointerDown(time + 40, 250, 250);

      // Advance past stimulus catch
      time += 300;
      runner.frame(time);

      if (i === 3) {
        // Between blocks
        expect(runner.state).toBe("between");
        time += 3100;
        runner.frame(time); // to block-intro
        time += 2500;
        runner.frame(time); // to trial-isi
      }
    }

    // Now celebration state
    expect(runner.state).toBe("celebration");
    time += 5000;
    runner.frame(time);

    expect(runner.state).toBe("done");
    expect(completedResult).not.toBeNull();
    expect(completedResult!.trials.length).toBe(8);
    expect(completedResult!.summary.nTrials).toBe(8);
  });

  it("prevents rapid double-click skip of practice intro before MIN_READ_DELAY_MS", () => {
    const hooks = {
      onStateChange: vi.fn(),
      onStimulusOnset: vi.fn(),
      onStimulusEnd: vi.fn(),
      onDistractorTrigger: vi.fn(),
      onHit: vi.fn(),
      onCommission: vi.fn(),
      onTapFeedback: vi.fn(),
      onComplete: vi.fn(),
    };

    const runner = new StormWatchRunner(hooks, {
      seed: 42,
      skipPractice: false,
    });

    expect(runner.state).toBe("intro");

    // Canvas click in intro is ignored
    runner.pointerDown(100, 200, 200);
    expect(runner.state).toBe("intro");

    // Start explicitly via start button
    runner.start(100);
    expect(runner.state).toBe("practice-intro");

    // Immediate second click (e.g. 500ms in) should be LOCKED OUT (< 1200ms)
    runner.pointerDown(600, 200, 200);
    expect(runner.state).toBe("practice-intro");

    // Another premature click at 900ms in
    runner.pointerDown(1000, 200, 200);
    expect(runner.state).toBe("practice-intro");

    // Click after 1200ms has elapsed is accepted!
    runner.pointerDown(1400, 200, 200);
    expect(runner.state).toBe("practice-trial-isi");
  });

  it("enforces single response per stimulus to prevent tapping multiple times", () => {
    const hits: number[] = [];
    const hooks = {
      onStateChange: vi.fn(),
      onStimulusOnset: vi.fn(),
      onStimulusEnd: vi.fn(),
      onDistractorTrigger: vi.fn(),
      onHit: () => {
        hits.push(Date.now());
      },
      onCommission: vi.fn(),
      onTapFeedback: vi.fn(),
      onComplete: vi.fn(),
    };

    const runner = new StormWatchRunner(hooks, {
      seed: 42,
      skipPractice: true,
      trialsPerBlock: 2,
    });

    runner.start(100); // from intro to block-intro
    runner.frame(2600); // to trial-isi
    runner.frame(4800); // to trial-stimulus

    expect(runner.state).toBe("trial-stimulus");

    // Tap 3 times rapidly on the same stimulus
    runner.pointerDown(4850, 250, 250, true);
    runner.pointerDown(4870, 250, 250, true);
    runner.pointerDown(4900, 250, 250, true);

    // Only one hit should have fired!
    expect(hits.length).toBe(1);
  });

  it("requires targeting stimulus in its radius: off-target taps do not trigger hit", () => {
    let hitCount = 0;
    const hooks = {
      onStateChange: vi.fn(),
      onStimulusOnset: vi.fn(),
      onStimulusEnd: vi.fn(),
      onDistractorTrigger: vi.fn(),
      onHit: () => {
        hitCount++;
      },
      onCommission: vi.fn(),
      onTapFeedback: vi.fn(),
      onComplete: vi.fn(),
    };

    const runner = new StormWatchRunner(hooks, {
      seed: 42,
      skipPractice: true,
      trialsPerBlock: 2,
    });

    runner.start(100);
    runner.frame(2600); // to trial-isi
    runner.frame(4800); // to trial-stimulus

    expect(runner.state).toBe("trial-stimulus");

    // Off-target tap far from stimulus (isHitOnStimulus = false)
    runner.pointerDown(4850, 50, 50, false);
    // Should NOT have triggered hit!
    expect(hitCount).toBe(0);

    // Another off-target tap
    runner.pointerDown(4880, 800, 600, false);
    expect(hitCount).toBe(0);

    // Targeted tap within stimulus radius (isHitOnStimulus = true)
    runner.pointerDown(4910, 420, 310, true);
    expect(hitCount).toBe(1);
  });
});
