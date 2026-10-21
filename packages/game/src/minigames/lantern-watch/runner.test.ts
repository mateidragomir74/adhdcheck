import { describe, expect, it } from "vitest";
import { SessionMetricsSchema, type Trial } from "@adhdcheck/contracts";
import { buildSchedule, DEFAULT_TASK, type TaskConfig } from "./logic";
import { RESPONSE_WINDOW_MS } from "../wake-fireflies/logic";
import { BREAK_MIN_MS, LATE_TAP_GRACE_MS, LanternWatchRunner, type ActiveTrial, type RunData, type RunState } from "./runner";
import { buildSessionMetrics } from "./session";

const FRAME = 1000 / 60;

// t: the event.timeStamp; deliver: when the event reaches the page (default t). A busy main thread delivers a
// pointer event after the frame callback that already closed the trial the event belongs to.
type Tap = { t: number; lantern: number | null; x?: number; y?: number; deliver?: number };
type Child = (trial: ActiveTrial, onset: number) => Tap[];

/** Drives the runner like the scene does: pending pointer events are dispatched before each frame callback. */
function sim(opts: { task?: TaskConfig; child?: Child; breakTapDelay?: number; anticipationMs?: number | null; seed?: number } = {}) {
  const shown: { trial: ActiveTrial; onset: number }[] = [];
  const hidden: { trial: ActiveTrial; at: number }[] = [];
  const states: { s: RunState; ts: number }[] = [];
  let pending: Tap[] = [];
  let data: RunData | null = null;
  let atComplete: Trial[] | null = null; // a copy of the records at the moment onComplete fires
  const child: Child = opts.child ?? ((tr, onset) => (tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }]));
  const r = new LanternWatchRunner(
    { task: opts.task ?? DEFAULT_TASK, seed: opts.seed ?? 42, anticipationMs: opts.anticipationMs ?? null },
    {
      onState: (s, ts) => {
        states.push({ s, ts });
        if (s === "break") pending.push({ t: ts + (opts.breakTapDelay ?? BREAK_MIN_MS + 100), lantern: null });
      },
      onStimulus: (ts, trial) => {
        shown.push({ trial, onset: ts });
        pending.push(...child(trial, ts));
      },
      onHide: (ts, trial) => hidden.push({ trial, at: ts }),
      onComplete: (d) => {
        data = d;
        atComplete = structuredClone(d.trials);
      },
    },
  );
  let ts = 1000;
  r.pointerDown(ts - 5, 0, 0, null); // the start tap
  for (let k = 0; k < 400_000 && !data; k++) {
    ts += FRAME;
    pending.sort((a, b) => (a.deliver ?? a.t) - (b.deliver ?? b.t));
    while (pending.length && ((pending[0] as Tap).deliver ?? (pending[0] as Tap).t) <= ts) {
      const p = pending.shift() as Tap;
      r.pointerDown(p.t, p.x ?? 100, p.y ?? 200, p.lantern);
    }
    r.frame(ts);
  }
  if (!data) throw new Error(`run never finished, state ${r.state}`);
  return { data: data as RunData, atComplete: atComplete as unknown as Trial[], shown, hidden, states, runner: r, addTap: (t: Tap) => (pending = [...pending, t]) };
}

describe("LanternWatchRunner, a child who taps every firefly and no moth", () => {
  const { data, shown, hidden, states } = sim();

  it("records 10 calibration trials then 144 task trials, practice excluded", () => {
    expect(data.trials).toHaveLength(154);
    expect(data.trials.slice(0, 10).every((t) => t.type === "calibration")).toBe(true);
    expect(data.trials.slice(10).every((t) => t.type !== "calibration")).toBe(true);
    expect(shown.filter((s) => s.trial.phase === "practice").length).toBeGreaterThan(0);
    expect(data.trials.map((t) => t.i)).toEqual(data.trials.map((_, k) => k));
  });

  it("classifies every trial: calibration and go hit, no-go correct_reject", () => {
    for (const t of data.trials) {
      if (t.type === "nogo") expect(t.outcome).toBe("correct_reject");
      else expect(t.outcome).toBe("hit");
    }
    expect(data.trials.filter((t) => t.type === "nogo")).toHaveLength(30);
    expect(data.off_target_taps).toEqual([]);
  });

  it("takes RT as tap time minus the onset frame timestamp", () => {
    for (const t of data.trials) if (t.responded) expect(t.rt_ms).toBeCloseTo(400, 6);
  });

  it("keeps every task stimulus on screen for 500 ms or more, hidden on the first frame after (NFR-22)", () => {
    const task = hidden.filter((h) => h.trial.phase === "task");
    expect(task).toHaveLength(144);
    for (const h of task) {
      const on = h.at - (h.trial.onset as number);
      expect(on).toBeGreaterThanOrEqual(500);
      expect(on).toBeLessThan(500 + FRAME + 1e-6);
    }
  });

  it("uses session-relative onsets, increasing, starting at or after 0", () => {
    const on = data.trials.map((t) => t.stimulus_onset_ms);
    expect(on[0]).toBeGreaterThanOrEqual(0);
    for (let k = 1; k < on.length; k++) expect(on[k]).toBeGreaterThan(on[k - 1] as number);
  });

  it("paces each task trial as stimulus plus its ISI", () => {
    const task = shown.filter((s) => s.trial.phase === "task");
    for (let k = 1; k < 48; k++) {
      const prev = task[k - 1] as { trial: ActiveTrial; onset: number };
      const gap = (task[k] as { onset: number }).onset - prev.onset;
      expect(gap).toBeGreaterThanOrEqual(500 + prev.trial.isiMs);
      expect(gap).toBeLessThan(500 + prev.trial.isiMs + FRAME + 1e-6);
    }
  });

  it("goes calibration, practice, then 3 blocks with a break between blocks, then done", () => {
    const seq = states.map((s) => s.s).filter((s, k, a) => s !== a[k - 1]);
    expect(seq).toEqual([
      "calib-intro",
      "calib-practice",
      "calib",
      "practice-intro",
      "practice",
      "block-intro",
      "trials",
      "break",
      "block-intro",
      "trials",
      "break",
      "block-intro",
      "trials",
      "done",
    ]);
  });

  it("builds a SessionMetrics the contract accepts", () => {
    const m = buildSessionMetrics({
      sessionId: "0b6f1c2e-3d4a-4b5c-8d6e-7f8091a2b3c4",
      childId: "1c2d3e4f-5a6b-4c7d-9e8f-0a1b2c3d4e5f",
      startedAt: "2026-10-20T10:00:00.000Z",
      durationMs: data.duration_ms,
      task: DEFAULT_TASK,
      device: {
        user_agent: "synthetic",
        pointer_type: "touch",
        screen_w: 1024,
        screen_h: 768,
        device_pixel_ratio: 1,
        est_refresh_hz: 60,
        cross_origin_isolated: false,
        timer_clock: "event.timeStamp",
      },
      trials: data.trials,
      offTargetTaps: data.off_target_taps,
    });
    expect(SessionMetricsSchema.safeParse(m).success).toBe(true);
    expect(m.calibration).toEqual({ median_rt_ms: 400, n: 10 });
  });
});

describe("LanternWatchRunner, errors and off-target taps", () => {
  const small: TaskConfig = { ...DEFAULT_TASK, blocks: 1, trialsPerBlock: 10 };

  it("records omissions with no RT and the x/y convention 0, 0", () => {
    const { data } = sim({ task: small, child: (tr, on) => (tr.phase === "task" ? [] : [{ t: on + 350, lantern: tr.lantern }]) });
    const go = data.trials.filter((t) => t.type === "go");
    expect(go).toHaveLength(8);
    for (const t of go) expect(t).toMatchObject({ responded: false, rt_ms: null, outcome: "omission", x: 0, y: 0 });
  });

  it("records a tap on a moth as a commission with its RT and tap position", () => {
    const { data } = sim({
      task: small,
      child: (tr, on) => [{ t: on + 300, lantern: tr.lantern, x: 321, y: 123 }],
    });
    const nogo = data.trials.filter((t) => t.type === "nogo");
    expect(nogo).toHaveLength(2);
    for (const t of nogo) expect(t).toMatchObject({ responded: true, outcome: "commission", x: 321, y: 123 });
    for (const t of nogo) expect(t.rt_ms).toBeCloseTo(300, 6);
  });

  it("counts a late go tap inside the ISI as the trial's response", () => {
    const { data } = sim({ task: small, child: (tr, on) => (tr.type === "nogo" ? [] : [{ t: on + 800, lantern: tr.lantern }]) });
    for (const t of data.trials.filter((x) => x.type === "go")) expect(t.outcome).toBe("hit");
  });

  it("logs a tap on the wrong lantern during the stimulus as off-target 'stimulus', and an empty-sky tap in the ISI as 'isi'", () => {
    const { data } = sim({
      task: small,
      child: (tr, on) =>
        tr.phase === "task" && tr.taskIndex === 0
          ? [
              { t: on + 100, lantern: (tr.lantern + 1) % 3 },
              { t: on + 700, lantern: null },
              { t: on + 750, lantern: tr.lantern },
            ]
          : tr.type === "nogo"
            ? []
            : [{ t: on + 400, lantern: tr.lantern }],
    });
    const first = data.trials[10];
    expect(first?.responded).toBe(true); // the on-target tap at 750 ms, inside the ISI
    expect(first?.rt_ms).toBeCloseTo(750, 6);
    const during = data.off_target_taps.map((o) => o.during);
    expect(during[0]).toBe("stimulus");
    expect(during[1]).toBe("isi");
    for (const o of data.off_target_taps) expect(o.t_ms).toBeGreaterThanOrEqual(0);
  });

  it("classifies anticipations against the threshold when one is configured", () => {
    const { data } = sim({ task: small, anticipationMs: 150, child: (tr, on) => [{ t: on + 60, lantern: tr.lantern }] });
    for (const t of data.trials.filter((x) => x.type !== "calibration")) expect(t.outcome).toBe("anticipation");
  });

  it("calibration follows PR #27: a firefly left untapped for RESPONSE_WINDOW_MS is an omission at 0, 0", () => {
    let n = 0;
    const { data } = sim({
      task: small,
      // Calibration: skip the 2nd and 5th measured fireflies; tap everything else.
      child: (tr, on) => {
        if (tr.phase === "calibration" && (n++ === 1 || n === 5)) return [];
        return tr.type === "nogo" ? [] : [{ t: on + 400, lantern: tr.lantern }];
      },
    });
    const cal = data.trials.filter((t) => t.type === "calibration");
    expect(cal).toHaveLength(10);
    expect(cal.filter((t) => t.outcome === "omission")).toHaveLength(2);
    for (const t of cal.filter((x) => x.outcome === "omission")) expect(t).toMatchObject({ responded: false, rt_ms: null, x: 0, y: 0 });
  });

  it("calibration taps away from the lit lantern are not recorded (PR #27 rule)", () => {
    const { data } = sim({
      task: small,
      child: (tr, on) =>
        tr.phase === "calibration" ? [{ t: on + 100, lantern: null }, { t: on + 400, lantern: tr.lantern }] : tr.type === "nogo" ? [] : [{ t: on + 400, lantern: tr.lantern }],
    });
    expect(data.off_target_taps).toEqual([]);
  });

  it("repeats the calibration round when no firefly at all was tapped, recording only the last round", () => {
    let round = 0;
    const { data, states } = sim({
      task: small,
      child: (tr, on) => {
        if (tr.phase === "calibration") return round >= 10 ? [{ t: on + 300, lantern: tr.lantern }] : (round++, []);
        return tr.type === "nogo" ? [] : [{ t: on + 400, lantern: tr.lantern }];
      },
    });
    const cal = data.trials.filter((t) => t.type === "calibration");
    expect(cal).toHaveLength(10);
    expect(cal.every((t) => t.outcome === "hit")).toBe(true);
    expect(states.filter((s) => s.s === "calib").length).toBe(2);
  });

  it("does not leave a break before BREAK_MIN_MS, even on a tap", () => {
    const two: TaskConfig = { ...DEFAULT_TASK, blocks: 2, trialsPerBlock: 5 };
    // The simulated child taps once, too early: the tap is ignored and the run waits in the break.
    expect(() => sim({ task: two, breakTapDelay: 200 })).toThrow(/state break/);
    // The same run with the tap after BREAK_MIN_MS finishes.
    expect(sim({ task: two }).data.trials).toHaveLength(20);
  });
});

describe("LanternWatchRunner, a tap delivered after the frame that closed its trial (R3-L3)", () => {
  // The third go trial of the task: the tap is stamped inside its response window, delivered two frames late.
  let seen = 0;
  let lateWindow = 0;
  const lateGo: Child = (tr, onset) => {
    if (tr.type === "nogo") return [];
    if (tr.phase !== "task") return [{ t: onset + 400, lantern: tr.lantern }];
    seen += 1;
    const window = DEFAULT_TASK.stimulusMs + tr.isiMs;
    if (seen === 3) lateWindow = window;
    return seen === 3
      ? [{ t: onset + window - 5, lantern: tr.lantern, deliver: onset + window + FRAME * 1.5 }]
      : [{ t: onset + 400, lantern: tr.lantern }];
  };
  const { data } = sim({ child: lateGo });

  it("records the tap as a response to its own trial, not an omission", () => {
    const task = data.trials.filter((t) => t.type !== "calibration");
    const late = task.filter((t) => t.responded && (t.rt_ms as number) > 900);
    expect(late).toHaveLength(1);
    expect(late[0]?.outcome).toBe("hit");
    // R6-5: the response time is the timestamp of the tap minus the onset, not the time the event was delivered.
    expect(late[0]?.rt_ms).toBeCloseTo(lateWindow - 5, 6);
    expect(task.filter((t) => t.type === "go" && !t.responded)).toHaveLength(0);
  });

  it("does not log it as an off-target tap in the gap", () => {
    expect(data.off_target_taps).toEqual([]);
  });

  it("still builds a valid payload", () => {
    expect(() =>
      buildSessionMetrics({
        sessionId: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b",
        childId: "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
        startedAt: "2026-10-20T10:00:00.000Z",
        durationMs: data.duration_ms,
        task: DEFAULT_TASK,
        device: {
          user_agent: "t",
          pointer_type: "touch",
          screen_w: 800,
          screen_h: 600,
          device_pixel_ratio: 1,
          est_refresh_hz: 60,
          cross_origin_isolated: false,
          timer_clock: "performance.now",
        },
        trials: data.trials,
        offTargetTaps: data.off_target_taps,
      }),
    ).not.toThrow();
  });
});

describe("LanternWatchRunner, a late tap on the last trial of a calibration round that restarts (R4-1)", () => {
  // Round 1: nothing tapped on trials 1 to 9, the 10th is tapped inside its window but delivered 1.5 frames late.
  // Since R5-1 the round waits for that tap, which is its only hit, so the round is kept; either way the tap
  // must never write into a different round or leave an empty slot.
  let round1 = 0;
  const child: Child = (tr, onset) => {
    if (tr.phase === "calibration") {
      round1 += 1;
      if (round1 < 10) return [];
      if (round1 === 10) return [{ t: onset + RESPONSE_WINDOW_MS - 5, lantern: tr.lantern, deliver: onset + RESPONSE_WINDOW_MS + FRAME * 1.5 }];
    }
    return tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }];
  };
  const { data } = sim({ child });

  it("leaves no empty slot in the recorded trials", () => {
    expect(data.trials.every((t) => t !== undefined)).toBe(true);
    expect(data.trials).toHaveLength(154);
    expect(data.trials.map((t) => t.i)).toEqual(data.trials.map((_, k) => k));
  });

  it("still builds a valid payload", () => {
    expect(() =>
      buildSessionMetrics({
        sessionId: "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b",
        childId: "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
        startedAt: "2026-10-20T10:00:00.000Z",
        durationMs: data.duration_ms,
        task: DEFAULT_TASK,
        device: { user_agent: "t", pointer_type: "touch", screen_w: 800, screen_h: 600, device_pixel_ratio: 1, est_refresh_hz: 60, cross_origin_isolated: false, timer_clock: "performance.now" },
        trials: data.trials,
        offTargetTaps: data.off_target_taps,
      }),
    ).not.toThrow();
  });
});

describe("LanternWatchRunner, every tap stamped inside its window and delivered 1.5 frames late (R5-1)", () => {
  // Every firefly tap of the calibration and of the task is stamped 5 ms before its window closes and reaches the
  // page 1.5 frames after the frame that closed the trial. The trials that end a phase (the last calibration
  // round, the last trial of each block, the last trial of the task) change the state in that same frame; the
  // new state must not swallow the tap.
  const everyLate: Child = (tr, onset) => {
    if (tr.type === "nogo") return [];
    if (tr.phase === "practice") return [{ t: onset + 400, lantern: tr.lantern }];
    const window = tr.phase === "calibration" ? RESPONSE_WINDOW_MS : DEFAULT_TASK.stimulusMs + tr.isiMs;
    return [{ t: onset + window - 5, lantern: tr.lantern, deliver: onset + window + FRAME * 1.5 }];
  };
  const { data } = sim({ child: everyLate });

  it("R6-5 gives each late tap the response time of its own timestamp, tap minus onset", () => {
    for (const t of data.trials.filter((x) => x.type === "calibration")) expect(t.rt_ms).toBeCloseTo(RESPONSE_WINDOW_MS - 5, 6);
    // Task fireflies: rt = stimulus + ISI - 5, so rt + 5 - stimulus is the ISI, inside the configured range.
    const task = data.trials.filter((x) => x.type === "go");
    expect(task.length).toBeGreaterThan(0);
    for (const t of task) {
      const isi = (t.rt_ms as number) + 5 - DEFAULT_TASK.stimulusMs;
      expect(isi).toBeGreaterThanOrEqual(DEFAULT_TASK.isiMsMin - 1e-6);
      expect(isi).toBeLessThanOrEqual(DEFAULT_TASK.isiMsMax + 1e-6);
    }
  });

  it("loses no trial: every firefly trial of the calibration and the task has its response", () => {
    expect(data.trials).toHaveLength(154);
    const lost = data.trials.filter((t) => t.type !== "nogo" && !t.responded);
    expect(lost.map((t) => t.i)).toEqual([]);
  });

  it("logs no off-target tap for them", () => {
    expect(data.off_target_taps).toEqual([]);
  });

  it("does not restart a calibration round whose only hit is the late tap on its last trial", () => {
    let n = 0;
    const lastOnly: Child = (tr, onset) => {
      if (tr.phase === "calibration") {
        n += 1;
        return n === 10 ? [{ t: onset + RESPONSE_WINDOW_MS - 5, lantern: tr.lantern, deliver: onset + RESPONSE_WINDOW_MS + FRAME * 1.5 }] : [];
      }
      return tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }];
    };
    const r = sim({ child: lastOnly });
    expect(r.states.filter((s) => s.s === "calib")).toHaveLength(1);
    const cal = r.data.trials.filter((t) => t.type === "calibration");
    expect(cal).toHaveLength(10);
    expect(cal[9]?.outcome).toBe("hit");
  });
});

// R6-2, R6-3, R6-4
function lastTaskTrialIsGo(seed: number) {
  return buildSchedule(DEFAULT_TASK, seed).at(-1)?.type === "go";
}
// A seed whose last task trial is a firefly (seed 42 ends on a moth, so it never exercises the wait at the task end).
const GO_SEED = Array.from({ length: 500 }, (_, k) => k + 1).find(lastTaskTrialIsGo) as number;
const LAST_INDEX = DEFAULT_TASK.blocks * DEFAULT_TASK.trialsPerBlock - 1;

describe("LanternWatchRunner, the task-end wait for a late tap (R6-2, R6-3)", () => {
  // The last task trial is a firefly; its tap is stamped 5 ms before the window closes and delivered 1.5 frames late.
  const lateLast: Child = (tr, onset) => {
    if (tr.type === "nogo") return [];
    if (tr.phase === "task" && tr.taskIndex === LAST_INDEX) {
      const window = DEFAULT_TASK.stimulusMs + tr.isiMs;
      return [{ t: onset + window - 5, lantern: tr.lantern, deliver: onset + window + FRAME * 1.5 }];
    }
    return [{ t: onset + 400, lantern: tr.lantern }];
  };

  it("uses a seed whose last task trial is a firefly, unlike seed 42", () => {
    expect(GO_SEED).toBeGreaterThan(0);
    expect(lastTaskTrialIsGo(42)).toBe(false);
  });

  it("R6-2 has the response of the last trial in the records at the moment onComplete fires", () => {
    const r = sim({ seed: GO_SEED, child: lateLast });
    const last = r.atComplete.at(-1) as Trial;
    expect(last.type).toBe("go");
    expect(last.responded).toBe(true);
    expect(last.outcome).toBe("hit");
    expect(r.atComplete.filter((t) => t.type !== "nogo" && !t.responded)).toEqual([]);
  });

  it("R6-3 a tap stamped inside the last window but delivered after completion does not rewrite the records", () => {
    const quiet: Child = (tr, onset) => (tr.type === "nogo" || (tr.phase === "task" && tr.taskIndex === LAST_INDEX) ? [] : [{ t: onset + 400, lantern: tr.lantern }]);
    const r = sim({ seed: GO_SEED, child: quiet });
    const lastShown = r.shown.at(-1) as { trial: ActiveTrial; onset: number };
    const before = JSON.stringify(r.data.trials);
    expect(r.data.trials.at(-1)?.responded).toBe(false);
    const kind = r.runner.pointerDown(lastShown.onset + 300, 100, 200, lastShown.trial.lantern);
    expect(kind).not.toBe("response");
    expect(JSON.stringify(r.data.trials)).toBe(before);
  });
});

describe("LanternWatchRunner, a stray tap in the wait after the last trial (R7-1)", () => {
  const quietLast = (stray: boolean): Child => (tr, onset) => {
    if (tr.type === "nogo") return [];
    if (tr.phase === "task" && tr.taskIndex === LAST_INDEX) {
      const window = DEFAULT_TASK.stimulusMs + tr.isiMs;
      // lantern null: not the last trial's lantern, so it cannot be its late response; stamped after its window
      return stray ? [{ t: onset + window + 30, lantern: null }] : [];
    }
    return [{ t: onset + 400, lantern: tr.lantern }];
  };

  it("R7-1 records no off-target tap and leaves the duration unchanged when the last trial is unanswered", () => {
    const base = sim({ seed: GO_SEED, child: quietLast(false) });
    const tapped = sim({ seed: GO_SEED, child: quietLast(true) });
    expect(base.data.trials.at(-1)?.responded).toBe(false);
    expect(tapped.data.off_target_taps).toHaveLength(base.data.off_target_taps.length);
    expect(tapped.data.duration_ms).toBe(base.data.duration_ms);
  });

  it("R7-1b a real tap stamped inside the last window but delivered after it closed is still recorded", () => {
    const late: Child = (tr, onset) => {
      if (tr.type === "nogo") return [];
      if (tr.phase === "task" && tr.taskIndex === LAST_INDEX) {
        const window = DEFAULT_TASK.stimulusMs + tr.isiMs;
        return [{ t: onset + window - 5, lantern: null, deliver: onset + window + FRAME * 1.5 }];
      }
      return [{ t: onset + 400, lantern: tr.lantern }];
    };
    const base = sim({ seed: GO_SEED, child: quietLast(false) });
    const r = sim({ seed: GO_SEED, child: late });
    expect(r.data.off_target_taps).toHaveLength(base.data.off_target_taps.length + 1);
    expect(r.data.duration_ms).toBe(base.data.duration_ms);
  });

  it("R7-1 control: a tap in an ordinary ISI of the task is still recorded as off-target", () => {
    const child: Child = (tr, onset) => {
      const out: ReturnType<Child> = tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }];
      if (tr.phase === "task" && tr.taskIndex === 3) out.push({ t: onset + DEFAULT_TASK.stimulusMs + 100, lantern: null });
      return out;
    };
    const r = sim({ seed: GO_SEED, child });
    expect(r.data.off_target_taps.filter((o) => o.during === "isi")).toHaveLength(1);
  });
});

describe("LanternWatchRunner, guards on a late tap (R4-1, R6-4)", () => {
  const cal = (trials: Trial[]) => trials.filter((t) => t.type === "calibration");

  it("a tap delivered after the grace that followed a discarded calibration round writes nothing", () => {
    let n = 0;
    const child: Child = (tr, onset) => {
      if (tr.phase === "calibration") {
        n += 1;
        if (n < 10) return [];
        if (n === 10) return [{ t: onset + RESPONSE_WINDOW_MS - 5, lantern: tr.lantern, deliver: onset + RESPONSE_WINDOW_MS + LATE_TAP_GRACE_MS + 200 }];
        return [{ t: onset + 300, lantern: tr.lantern }]; // round 2
      }
      return tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }];
    };
    const r = sim({ child });
    expect(r.states.filter((s) => s.s === "calib")).toHaveLength(2); // round 1 was discarded
    const round = cal(r.data.trials);
    expect(round).toHaveLength(10);
    expect(round.every((t) => t.outcome === "hit")).toBe(true);
    const onsets = round.map((t) => t.stimulus_onset_ms);
    expect([...onsets].sort((a, b) => a - b)).toEqual(onsets); // no slot was rewritten with an old onset
    expect(round.map((t) => t.rt_ms)).toEqual(round.map(() => 300));
  });

  it("a second tap in the same window does not write twice", () => {
    let n = 0;
    let firstTap = 0;
    const child: Child = (tr, onset) => {
      if (tr.phase === "task" && tr.type === "go") {
        n += 1;
        if (n === 2) {
          const window = DEFAULT_TASK.stimulusMs + tr.isiMs;
          firstTap = window - 20;
          return [
            { t: onset + window - 20, lantern: tr.lantern, deliver: onset + window + FRAME * 1.5 },
            { t: onset + window - 4, lantern: tr.lantern, deliver: onset + window + FRAME * 1.6 },
          ];
        }
      }
      return tr.type === "nogo" ? [] : [{ t: onset + 400, lantern: tr.lantern }];
    };
    const r = sim({ child });
    const written = r.data.trials.filter((t) => t.type === "go" && t.responded && (t.rt_ms as number) > 900);
    expect(written).toHaveLength(1);
    expect(written[0]?.rt_ms).toBeCloseTo(firstTap, 6);
  });
});
