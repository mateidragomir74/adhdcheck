// Lantern Watch trial runner: the render-loop wiring around logic.ts, with no rendering and no DOM, so it is
// unit-tested. The scene calls frame(ts) at the top of every requestAnimationFrame callback, BEFORE it renders,
// with the callback timestamp. A stimulus shown in frame(ts) (onStimulus) is drawn by the render call of that
// same callback, so ts is its onset (research/03 section 2.3 item 4). pointerDown() takes the pointerdown
// event.timeStamp, never a click and never the time the handler runs.
//
// Sequence: start tap, "Wake the fireflies" calibration (FR-03) with its own two practice fireflies, the go/no-go
// practice (not recorded, FR-02), then task.blocks blocks with a child-paced break between blocks, then done.
// Calibration follows the rules of mini-game 0, PR #27 (../wake-fireflies/logic.ts): its waits, its practice
// count, its response window, its trial mapping (hit or omission, omission at 0, 0) and its summary.
import { START_ENABLE_MS } from "../../pointer";
import type { Trial } from "@adhdcheck/contracts";
import {
  buildCalibrationSchedule,
  buildSchedule,
  classify,
  type CalibrationTrial,
  type ScheduledTrial,
  type TaskConfig,
  type TrialType,
} from "./logic";
import type { OffTargetTap } from "./session";
import { PRACTICE_TRIALS as CALIB_PRACTICE_TRIALS, RESPONSE_WINDOW_MS, toContractTrial } from "../wake-fireflies/logic";

// TODO: design choices, no sourced value (research/03 and 04 give none of these).
// The three instructions (calibration, practice, first block) wait for a tap on the Start button, with no timer
// (Hatem, 2026-10-21: the children need time to read). After that tap each keeps the intro delay it had before
// (the values below), so a second tap of a double tap never lands in a measured trial. The short "Here we go again!"
// before blocks 2 and 3 still runs on a timer from its start, because the child has just tapped to continue.
// TODO: design choices, no sourced value (research/03 and 04 give none of these).
export const CALIB_INTRO_MS = 2600;
export const PRACTICE_INTRO_MS = 2600;
export const BLOCK_INTRO_MS = 2400;
/** The break between blocks lasts at least this long; then a tap on the play button continues. */
export const BREAK_MIN_MS = 4000;
/** How long a phase change (end of a calibration round without a hit, end of the task) waits for a tap that was
 * stamped inside the last trial's window but is delivered after the frame that closed it. TODO: design choice,
 * no sourced value. */
export const LATE_TAP_GRACE_MS = 100;
/** Practice: two fireflies and two moths, fixed order and lanterns, task timing, never recorded. */
export const PRACTICE: ReadonlyArray<{ type: "go" | "nogo"; lantern: number }> = [
  { type: "go", lantern: 1 },
  { type: "nogo", lantern: 0 },
  { type: "go", lantern: 2 },
  { type: "nogo", lantern: 1 },
];

export type RunState = "intro" | "calib-intro" | "calib-practice" | "calib" | "practice-intro" | "practice" | "block-intro" | "trials" | "break" | "done";
export type Phase = "calibration" | "practice" | "task";

export interface ActiveTrial {
  phase: Phase;
  type: TrialType;
  block: number;
  lantern: number;
  isiMs: number;
  /** Index within its phase (calibration 0..n-1, practice 0..3, task 0..blocks*trials-1). */
  taskIndex: number;
  onset: number | null;
  hiddenAt: number | null;
  responded: boolean;
  rtMs: number | null;
  x: number;
  y: number;
}

export interface RunData {
  trials: Trial[];
  off_target_taps: OffTargetTap[];
  /** Session-relative end time: from the first measured frame (t0) to the done frame. */
  duration_ms: number;
  /** Frame timestamp of the session start (page time origin), for started_at. */
  t0: number;
}

export interface RunnerConfig {
  task: TaskConfig;
  seed: number;
  anticipationMs: number | null;
}

export interface RunnerHooks {
  onState?: (s: RunState, ts: number) => void;
  /** Inside frame(ts): draw the stimulus now; ts is its onset. */
  onStimulus?: (ts: number, trial: ActiveTrial) => void;
  onHide?: (ts: number, trial: ActiveTrial) => void;
  /** The first on-target tap of a trial (hit, commission or calibration tap). */
  onResponse?: (tMs: number, trial: ActiveTrial) => void;
  onBreakReady?: (ts: number) => void;
  onComplete?: (data: RunData) => void;
}

export type TapKind = "start" | "ready" | "response" | "off-target" | "continue" | "ignored";

export class LanternWatchRunner {
  state: RunState = "intro";
  private readyRequested = false;
  private readyAtMs = 0;
  private readonly task: TaskConfig;
  private readonly anticipationMs: number | null;
  private readonly hooks: RunnerHooks;
  private readonly calib: CalibrationTrial[];
  private readonly calibPractice: CalibrationTrial[];
  private calibRecords: Trial[] = [];
  private readonly schedule: ScheduledTrial[];
  private readonly records: Trial[] = [];
  private readonly offTarget: OffTargetTap[] = [];
  private startRequested = false;
  private continueRequested = false;
  private breakReady = false;
  private t0 = 0;
  private since = 0;
  private idx = -1;
  private block = 0;
  private cur: ActiveTrial | null = null;
  // The last trial that closed without a response, kept open to events stamped inside its window but delivered
  // after the frame that closed it (a busy main thread), in every state, because the frame that closes the last
  // trial of a phase also changes the state. The response is written into arr[idx]; it is a no-op when that
  // array no longer holds the record (a calibration round that was thrown away). It is dropped when an event
  // stamped after its window arrives (events come in time order), and replaced by the next close.
  private lastClosed: { trial: ActiveTrial; windowMs: number; arr: Trial[]; idx: number; build(prev: Trial, tMs: number, x: number, y: number): Trial } | null = null;
  // End of the wait for a late tap: at the end of a calibration round without a hit, and at the end of the task.
  private settleUntil: number | null = null;
  private finishAt: number | null = null;
  // End of the window of the last trial while finishAt is set: only taps stamped after it are the wait's own (R7-1).
  private finishWindowEnd = 0;

  constructor(cfg: RunnerConfig, hooks: RunnerHooks = {}) {
    this.task = cfg.task;
    this.anticipationMs = cfg.anticipationMs;
    this.hooks = hooks;
    this.calib = buildCalibrationSchedule(cfg.task.calibrationTrials, cfg.seed);
    this.calibPractice = buildCalibrationSchedule(CALIB_PRACTICE_TRIALS, (cfg.seed ^ 0x5bd1e995) >>> 0);
    this.schedule = buildSchedule(cfg.task, cfg.seed);
  }

  /** Frame timestamp at which the current state began (animation only). */
  get stateStartMs(): number {
    return this.since;
  }

  /** Index of the block now running or about to start (0-based). */
  get blockIndex(): number {
    return this.block;
  }

  current(): ActiveTrial | null {
    return this.cur;
  }

  /** Off-target taps are recorded in the go/no-go blocks only; PR #27 does not record them in calibration. */
  private measured(): boolean {
    return this.state === "trials";
  }

  // A tap stamped inside the window of the trial that just closed is that trial's response.
  private lateResponse(tMs: number, x: number, y: number, lantern: number | null): boolean {
    const late = this.lastClosed;
    if (!late) return false;
    const onset = late.trial.onset as number;
    if (tMs >= onset + late.windowMs) {
      this.lastClosed = null; // time order: nothing stamped inside that window can still arrive
      return false;
    }
    const c = this.cur;
    if (lantern !== late.trial.lantern || tMs < onset || (c && c.onset !== null && tMs >= c.onset)) return false;
    const live = (late.arr === this.records || late.arr === this.calibRecords) && late.arr[late.idx] !== undefined;
    this.lastClosed = null;
    if (!live) return false;
    late.arr[late.idx] = late.build(late.arr[late.idx] as Trial, tMs, x, y);
    return true;
  }

  pointerDown(tMs: number, x: number, y: number, lantern: number | null): TapKind {
    if (this.lateResponse(tMs, x, y, lantern)) return "response";
    switch (this.state) {
      case "intro":
        if (this.startRequested) return "ignored";
        this.startRequested = true;
        return "start";
      case "calib-intro":
      case "practice-intro":
      case "block-intro":
        return "ignored"; // only the Start button leaves an instruction: the scene calls ready() for it
      case "break":
        if (this.continueRequested || tMs - this.since < BREAK_MIN_MS) return "ignored";
        this.continueRequested = true;
        return "continue";
      case "calib-practice":
      case "calib":
      case "practice":
      case "trials": {
        const c = this.cur;
        if (c && c.onset !== null && tMs >= c.onset && !c.responded && lantern === c.lantern) {
          const window = c.type === "calibration" ? RESPONSE_WINDOW_MS : this.task.stimulusMs + c.isiMs;
          const inWindow = tMs < c.onset + window;
          if (inWindow) {
            c.responded = true;
            c.rtMs = tMs - c.onset;
            c.x = x;
            c.y = y;
            this.hooks.onResponse?.(tMs, c);
            return "response";
          }
        }
        // R7-1: in the wait after the last trial (finishAt set) a tap stamped after that trial's window is not an ISI tap;
        // one stamped inside the window but delivered late still is.
        if (this.measured() && tMs >= this.t0 && !(this.finishAt !== null && tMs >= this.finishWindowEnd)) {
          const visible = !!c && c.onset !== null && tMs >= c.onset && (c.hiddenAt === null || tMs < c.hiddenAt);
          this.offTarget.push({ t_ms: tMs - this.t0, during: visible ? "stimulus" : "isi" });
          return "off-target";
        }
        return "ignored";
      }
      default:
        return "ignored";
    }
  }

  frame(ts: number): void {
    switch (this.state) {
      case "intro":
        if (this.startRequested) {
          this.t0 = ts;
          this.setState("calib-intro", ts);
        }
        return;
      case "calib-intro":
        if (this.readyRequested && ts - this.readyAtMs >= CALIB_INTRO_MS) {
          this.idx = -1;
          this.setState("calib-practice", ts);
          this.nextCalibration(ts);
        }
        return;
      case "calib-practice":
      case "calib":
        this.frameCalibration(ts);
        return;
      case "practice-intro":
        if (this.readyRequested && ts - this.readyAtMs >= PRACTICE_INTRO_MS) {
          this.idx = -1;
          this.setState("practice", ts);
          this.nextTimed(ts);
        }
        return;
      case "block-intro":
        if (this.waitsForReady() ? this.readyRequested && ts - this.readyAtMs >= BLOCK_INTRO_MS : ts - this.since >= BLOCK_INTRO_MS) {
          this.setState("trials", ts);
          this.nextTimed(ts);
        }
        return;
      case "practice":
      case "trials":
        this.frameTimed(ts);
        return;
      case "break":
        if (!this.breakReady && ts - this.since >= BREAK_MIN_MS) {
          this.breakReady = true;
          this.hooks.onBreakReady?.(ts);
        }
        if (this.continueRequested) {
          this.block += 1;
          this.setState("block-intro", ts);
        }
        return;
      default:
        return;
    }
  }

  /** True when the Start button of the current instruction accepts a tap: it has been on screen START_ENABLE_MS. */
  canReady(ts: number): boolean {
    return this.waitsForReady() && !this.readyRequested && ts - this.since >= START_ENABLE_MS;
  }

  /** The child tapped the Start button of an instruction. A tap stamped before the instruction appeared is ignored. */
  ready(tMs: number): TapKind {
    if (!this.waitsForReady() || this.readyRequested || tMs < this.since + START_ENABLE_MS) return "ignored";
    this.readyRequested = true;
    this.readyAtMs = tMs;
    return "ready";
  }

  /** True while the state shows an instruction that waits for the child's tap on the Start button. */
  waitsForReady(): boolean {
    return this.state === "calib-intro" || this.state === "practice-intro" || (this.state === "block-intro" && this.block === 0);
  }

  private setState(s: RunState, ts: number) {
    this.readyRequested = false;
    this.state = s;
    this.since = ts;
    this.hooks.onState?.(s, ts);
  }

  // ---- calibration (PR #27 rules): dark wait, then the firefly is lit until tapped or RESPONSE_WINDOW_MS ----
  private nextCalibration(ts: number) {
    this.idx += 1;
    const practice = this.state === "calib-practice";
    const list = practice ? this.calibPractice : this.calib;
    const c = list[this.idx];
    if (!c) {
      this.cur = null;
      this.idx = -1;
      if (practice) {
        this.setState("calib", ts);
        this.nextCalibration(ts);
        return;
      }
      // No hit yet, but the last trial may still receive a late tap that makes one: wait for it.
      if (!this.calibRecords.some((t) => t.outcome === "hit") && this.lastClosed?.arr === this.calibRecords) {
        this.settleUntil = ts + LATE_TAP_GRACE_MS;
        return;
      }
      this.finishCalibrationRound(ts);
      return;
    }
    this.cur = this.makeTrial(practice ? "practice" : "calibration", "calibration", 0, c.lantern, c.waitMs, this.idx);
    this.since = ts; // start of the dark wait
  }

  private finishCalibrationRound(ts: number) {
    if (!this.calibRecords.some((t) => t.outcome === "hit")) {
      // No firefly tapped at all: the contract cannot carry a calibration without a median (#27 returns null),
      // so the round is run again and only the new round is recorded. TODO team: design choice.
      this.calibRecords = [];
      this.lastClosed = null; // a late tap of the discarded round must not reach the new one
      this.setState("calib", ts);
      this.nextCalibration(ts);
      return;
    }
    const base = this.records.length;
    this.records.push(...this.calibRecords.map((t, i) => ({ ...t, i: base + i })));
    // A late tap for the last calibration trial now lands in the copy, not in the round it was copied from.
    if (this.lastClosed?.arr === this.calibRecords) {
      this.lastClosed.arr = this.records;
      this.lastClosed.idx += base;
    }
    this.setState("practice-intro", ts);
  }

  private frameCalibration(ts: number) {
    const c = this.cur;
    if (!c) {
      if (this.settleUntil !== null && ts >= this.settleUntil) {
        this.settleUntil = null;
        this.finishCalibrationRound(ts);
      }
      return;
    }
    if (c.onset === null) {
      if (ts - this.since >= c.isiMs) this.show(c, ts);
      return;
    }
    if (c.responded || ts - c.onset >= RESPONSE_WINDOW_MS) {
      this.hide(c, ts);
      if (c.phase === "calibration") {
        const at = this.calibRecords.length;
        const build = (tapMs: number | null, x: number, y: number) =>
          toContractTrial({ i: at, onsetMs: c.onset as number, tapMs, x, y }, this.t0, RESPONSE_WINDOW_MS);
        this.calibRecords.push(build(c.responded ? (c.onset as number) + (c.rtMs as number) : null, c.x, c.y));
        this.lastClosed = c.responded
          ? null
          : { trial: c, windowMs: RESPONSE_WINDOW_MS, arr: this.calibRecords, idx: at, build: (_prev, tMs, x, y) => build(tMs, x, y) };
      } else this.lastClosed = null;
      this.nextCalibration(ts);
    }
  }

  // ---- practice and task: stimulus for stimulusMs, response window stimulus + ISI ----
  private nextTimed(ts: number) {
    this.idx += 1;
    if (this.state === "practice") {
      const p = PRACTICE[this.idx];
      if (!p) {
        this.cur = null;
        this.idx = -1;
        this.block = 0;
        this.setState("block-intro", ts);
        return;
      }
      const isiMs = (this.task.isiMsMin + this.task.isiMsMax) / 2;
      this.cur = this.makeTrial("practice", p.type, 0, p.lantern, isiMs, this.idx);
      this.show(this.cur, ts);
      return;
    }
    const s = this.schedule[this.idx];
    if (!s || s.block !== this.block) {
      this.idx -= 1; // stays on the last trial of the block; the next block starts after the break
      this.cur = null;
      if (s) {
        this.breakReady = false;
        this.continueRequested = false;
        this.setState("break", ts);
      } else if (this.lastClosed) {
        this.finishAt = ts + LATE_TAP_GRACE_MS; // the last trial may still receive a late tap
        this.finishWindowEnd = (this.lastClosed.trial.onset as number) + this.lastClosed.windowMs;
      } else {
        this.complete(ts);
      }
      return;
    }
    this.cur = this.makeTrial("task", s.type, s.block, s.lantern, s.isiMs, this.idx);
    this.show(this.cur, ts);
  }

  /**
   * The child (or an adult) ended Lantern Watch before the end (the "Next game" button). Returns what was recorded
   * so far, copied: the closed calibration trials and the closed task trials; the trial in flight is not counted.
   * Returns null when nothing valid can be built (SessionMetrics v1 needs a calibration median, so at least one
   * calibration hit), when the run is over already or was ended already. The run is frozen afterwards (state "done"),
   * and onComplete is not called: the caller owns the result.
   */
  /** Records that ending early would keep: the calibration round in progress, or everything recorded after it. */
  private endEarlySource(): Trial[] | null {
    if (this.state === "done") return null;
    const inCalibration = this.state === "calib";
    const afterCalibration = this.state !== "intro" && this.state !== "calib-intro" && this.state !== "calib-practice" && !inCalibration;
    if (!(inCalibration || afterCalibration)) return null;
    const source = inCalibration ? this.calibRecords : this.records;
    return source.some((t) => t.type === "calibration" && t.outcome === "hit") ? source : null;
  }

  /** True when endEarly() would return valid data: a calibration hit is recorded (a closed trial) and the run is not over. */
  canEndEarly(): boolean {
    return this.endEarlySource() !== null;
  }

  endEarly(ts: number): RunData | null {
    const source = this.endEarlySource();
    if (!source) return null;
    const data: RunData = {
      trials: source.map((t) => ({ ...t })),
      off_target_taps: this.offTarget.map((o) => ({ ...o })),
      duration_ms: ts - this.t0,
      t0: this.t0,
    };
    this.lastClosed = null;
    this.cur = null;
    this.settleUntil = null;
    this.finishAt = null;
    this.state = "done";
    this.hooks.onState?.("done", ts);
    return data;
  }

  private complete(ts: number) {
    this.lastClosed = null; // the records are handed over below; nothing may rewrite them afterwards
    this.setState("done", ts);
    this.hooks.onComplete?.({
      trials: this.records,
      off_target_taps: this.offTarget,
      duration_ms: ts - this.t0,
      t0: this.t0,
    });
  }

  private frameTimed(ts: number) {
    const c = this.cur;
    if (!c && this.finishAt !== null && ts >= this.finishAt) {
      this.finishAt = null;
      this.complete(ts);
      return;
    }
    if (!c || c.onset === null) return;
    if (c.hiddenAt === null && ts - c.onset >= this.task.stimulusMs) this.hide(c, ts);
    if (ts - c.onset >= this.task.stimulusMs + c.isiMs) {
      if (c.phase === "task") this.record(c);
      this.nextTimed(ts);
    }
  }

  private makeTrial(phase: Phase, type: TrialType, block: number, lantern: number, isiMs: number, taskIndex: number): ActiveTrial {
    return { phase, type, block, lantern, isiMs, taskIndex, onset: null, hiddenAt: null, responded: false, rtMs: null, x: 0, y: 0 };
  }

  private show(c: ActiveTrial, ts: number) {
    c.onset = ts;
    this.hooks.onStimulus?.(ts, c);
  }

  private hide(c: ActiveTrial, ts: number) {
    if (c.hiddenAt !== null) return;
    c.hiddenAt = ts;
    this.hooks.onHide?.(ts, c);
  }

  private record(c: ActiveTrial) {
    const onset = c.onset as number;
    const at = this.records.length;
    this.lastClosed = c.responded
      ? null
      : {
          trial: c,
          windowMs: this.task.stimulusMs + c.isiMs,
          arr: this.records,
          idx: at,
          build: (prev, tMs, x, y) => {
            const rt = tMs - onset;
            return { ...prev, responded: true, rt_ms: rt, outcome: classify(c.type, true, rt, this.anticipationMs), x, y };
          },
        };
    this.records.push({
      i: this.records.length,
      block: c.block,
      type: c.type,
      stimulus_onset_ms: onset - this.t0,
      responded: c.responded,
      rt_ms: c.responded ? c.rtMs : null,
      outcome: classify(c.type, c.responded, c.rtMs, this.anticipationMs),
      // Contract fields are required; a trial with no response uses 0, 0 (the convention of
      // packages/contracts/src/fixtures/session-metrics.valid.ts). x, y: CSS px from the game's top-left.
      x: c.responded ? c.x : 0,
      y: c.responded ? c.y : 0,
    });
  }
}
