import {
  buildPracticeSchedule,
  buildSchedule,
  classifyTrial,
  STIMULUS_MS,
  summarise,
} from "./logic";
import type {
  Outcome,
  ScheduledTrial,
  StormWatchResult,
  StormWatchTrialRecord,
  Tap,
  TrialType,
} from "./types";

export type RunState =
  | "intro"
  | "practice-intro"
  | "practice-trial-isi"
  | "practice-trial-stimulus"
  | "practice-trial-feedback"
  | "between"
  | "block-intro"
  | "trial-isi"
  | "trial-stimulus"
  | "celebration"
  | "done";

export interface RunnerHooks {
  onStateChange: (state: RunState, text?: string) => void;
  onStimulusOnset: (trial: ScheduledTrial, isPractice: boolean) => void;
  onStimulusEnd: (trial: ScheduledTrial, isPractice: boolean) => void;
  onDistractorTrigger: (trial: ScheduledTrial) => void;
  onHit: () => void;
  onCommission: () => void;
  onTapFeedback: (x: number, y: number) => void;
  onComplete: (result: StormWatchResult) => void;
}

export interface RunnerOptions {
  seed?: number;
  trialsPerBlock?: number;
  stimulusMs?: number;
  skipPractice?: boolean;
}

// Snappy reading lockouts: protects against accidental double-tap skips while keeping warmup brief
export const MIN_READ_DELAY_MS = 1200;
export const MIN_FEEDBACK_DELAY_MS = 900;

export class StormWatchRunner {
  state: RunState = "intro";
  private readonly seed: number;
  private readonly trialsPerBlock: number;
  private readonly stimulusMs: number;
  private readonly skipPractice: boolean;

  private schedule: ScheduledTrial[] = [];
  private practiceSchedule: ScheduledTrial[] = [];
  private trialIndex = 0;
  private practiceIndex = 0;

  private stateStartTime = 0;
  private currentStimulusOnsetMs = 0;
  private currentTaps: Tap[] = [];
  private records: StormWatchTrialRecord[] = [];

  private t0 = 0; // session start time
  private distractorFired = false;
  private respondedThisTrial = false;
  private lastPracticeOutcome: Outcome | null = null;

  constructor(
    private readonly hooks: RunnerHooks,
    opts: RunnerOptions = {},
  ) {
    this.seed = opts.seed ?? 1042;
    this.trialsPerBlock = opts.trialsPerBlock ?? 40;
    this.stimulusMs = opts.stimulusMs ?? STIMULUS_MS;
    this.skipPractice = opts.skipPractice ?? false;

    this.schedule = buildSchedule({
      seed: this.seed,
      trialsPerBlock: this.trialsPerBlock,
      stimulusMs: this.stimulusMs,
    });
    this.practiceSchedule = buildPracticeSchedule();
  }

  start(tMs?: number): void {
    const now = tMs ?? (typeof performance !== "undefined" ? performance.now() : 0);
    if (this.t0 === 0 && now > 0) this.t0 = now;
    const relT = this.t0 > 0 ? now - this.t0 : 0;
    if (this.skipPractice) {
      this.trialIndex = 0;
      this.transitionTo("block-intro", relT);
    } else {
      this.practiceIndex = 0;
      this.transitionTo("practice-intro", relT);
    }
  }

  getCurrentTrial(): ScheduledTrial | null {
    if (
      this.state === "trial-isi" ||
      this.state === "trial-stimulus"
    ) {
      return this.schedule[this.trialIndex] ?? null;
    }
    if (
      this.state === "practice-trial-isi" ||
      this.state === "practice-trial-stimulus" ||
      this.state === "practice-trial-feedback"
    ) {
      return this.practiceSchedule[this.practiceIndex] ?? null;
    }
    return null;
  }

  getRecords(): StormWatchTrialRecord[] {
    return [...this.records];
  }

  getLastPracticeOutcome(): Outcome | null {
    return this.lastPracticeOutcome;
  }

  pointerDown(tMs: number, x: number, y: number, isHitOnStimulus = true): void {
    if (this.t0 === 0) this.t0 = tMs;
    const relT = tMs - this.t0;

    this.hooks.onTapFeedback(x, y);

    if (this.state === "intro") {
      // Must click the "I'm Ready! ▶" button; canvas clicks during intro do not start the game
      return;
    }

    if (this.state === "practice-intro") {
      // Prevent accidental double-tap message skipping: child must view instruction for at least MIN_READ_DELAY_MS
      if (relT - this.stateStartTime < MIN_READ_DELAY_MS) return;
      this.transitionTo("practice-trial-isi");
      return;
    }

    if (this.state === "practice-trial-feedback") {
      // Prevent accidental skip of feedback message
      if (relT - this.stateStartTime < MIN_FEEDBACK_DELAY_MS) return;
      this.advancePracticeFeedback(relT);
      return;
    }

    if (this.state === "between") {
      if (relT - this.stateStartTime < 1000) return;
      this.transitionTo("block-intro");
      return;
    }

    if (this.state === "block-intro") {
      if (relT - this.stateStartTime < 1000) return;
      this.transitionTo("trial-isi");
      return;
    }

    if (
      this.state === "practice-trial-isi" ||
      this.state === "trial-isi"
    ) {
      // Off-target / premature taps during ISI
      this.currentTaps.push({ tMs: relT, x, y, onTarget: false });
      return;
    }

    if (
      this.state === "practice-trial-stimulus" ||
      this.state === "trial-stimulus"
    ) {
      // If tap is off-target (not in the radius of the creature), record as off-target and do not trigger hit
      if (!isHitOnStimulus) {
        this.currentTaps.push({ tMs: relT, x, y, onTarget: false });
        return;
      }

      // Enforce single-response per trial: cannot tap 3 times the same stimulus!
      if (this.respondedThisTrial) return;
      this.respondedThisTrial = true;

      this.currentTaps.push({ tMs: relT, x, y, onTarget: true });

      const current = this.getCurrentTrial();
      if (current) {
        if (current.type === "go" || current.type === "go_audio") {
          this.hooks.onHit(); // Catch firefly or owl!
        } else if (current.type === "nogo") {
          this.hooks.onCommission(); // Tapped cricket!
        }
      }
    }
  }

  private advancePracticeFeedback(relT: number): void {
    this.practiceIndex++;
    if (this.practiceIndex < this.practiceSchedule.length) {
      this.transitionTo("practice-trial-isi", relT);
    } else {
      this.transitionTo("between", relT);
    }
  }

  frame(ts: number): void {
    if (this.t0 === 0) this.t0 = ts;
    const relT = ts - this.t0;

    switch (this.state) {
      case "practice-intro": {
        if (relT - this.stateStartTime >= 2200) {
          this.transitionTo("practice-trial-isi", relT);
        }
        break;
      }
      case "practice-trial-isi": {
        const cur = this.practiceSchedule[this.practiceIndex];
        if (cur && relT - this.stateStartTime >= cur.isiMs) {
          this.transitionTo("practice-trial-stimulus", relT);
        }
        break;
      }
      case "practice-trial-stimulus": {
        const cur = this.practiceSchedule[this.practiceIndex];
        // If caught, allow 450ms celebratory catch flight into jar before feedback
        const timeLimit = this.respondedThisTrial ? 450 : (cur?.stimulusMs ?? 3600);
        if (relT - this.stateStartTime >= timeLimit) {
          if (cur) {
            if (cur.type === "go" || cur.type === "go_audio") {
              this.lastPracticeOutcome = this.respondedThisTrial ? "hit" : "omission";
            } else if (cur.type === "nogo") {
              this.lastPracticeOutcome = this.respondedThisTrial ? "commission" : "correct_reject";
            }
          }
          this.transitionTo("practice-trial-feedback", relT);
        }
        break;
      }
      case "practice-trial-feedback": {
        if (relT - this.stateStartTime >= 1200) {
          this.advancePracticeFeedback(relT);
        }
        break;
      }
      case "between": {
        if (relT - this.stateStartTime >= 1500) {
          this.transitionTo("block-intro", relT);
        }
        break;
      }
      case "block-intro": {
        if (relT - this.stateStartTime >= 1400) {
          this.transitionTo("trial-isi", relT);
        }
        break;
      }
      case "trial-isi": {
        const cur = this.schedule[this.trialIndex];
        if (cur) {
          if (cur.hasDistractor && !this.distractorFired && relT - this.stateStartTime >= cur.isiMs * 0.35) {
            this.distractorFired = true;
            this.hooks.onDistractorTrigger(cur);
          }
          if (relT - this.stateStartTime >= cur.isiMs) {
            this.transitionTo("trial-stimulus", relT);
          }
        }
        break;
      }
      case "trial-stimulus": {
        const cur = this.schedule[this.trialIndex];
        // If child caught the firefly, allow 600ms for swoop trajectory into jar
        const timeLimit = this.respondedThisTrial ? Math.min(cur?.stimulusMs ?? STIMULUS_MS, 600) : (cur?.stimulusMs ?? STIMULUS_MS);
        if (cur && relT - this.stateStartTime >= timeLimit) {
          this.finishTrial(relT);
        }
        break;
      }
      case "celebration": {
        if (relT - this.stateStartTime >= 4000) {
          this.finishRun();
        }
        break;
      }
    }
  }

  private finishTrial(nowRelT: number): void {
    const cur = this.schedule[this.trialIndex];
    if (cur) {
      this.hooks.onStimulusEnd(cur, false);

      const classification = classifyTrial(
        cur,
        this.currentTaps,
        this.currentStimulusOnsetMs,
        cur.stimulusMs,
      );

      this.records.push({
        i: cur.i,
        block: cur.block,
        blockKind: cur.blockKind,
        type: cur.type,
        treeLocation: cur.treeLocation,
        stimulusOnsetMs: this.currentStimulusOnsetMs,
        responded: classification.responded,
        rtMs: classification.rtMs,
        outcome: classification.outcome,
        hasDistractor: cur.hasDistractor,
        distractorType: cur.distractorType,
        taps: [...this.currentTaps],
      });
    }

    this.trialIndex++;
    if (this.trialIndex >= this.schedule.length) {
      this.transitionTo("celebration", nowRelT);
    } else if (this.trialIndex === this.trialsPerBlock) {
      this.transitionTo("between", nowRelT);
    } else {
      this.transitionTo("trial-isi", nowRelT);
    }
  }

  private finishRun(): void {
    this.state = "done";
    const summary = summarise(this.records);
    const result: StormWatchResult = {
      id: "storm-watch",
      version: "0.1.0",
      params: {
        blocks: 2,
        trials_per_block: this.trialsPerBlock,
        go_probability: 0.8,
        stimulus_ms: this.stimulusMs,
        isi_ms_min: 800,
        isi_ms_max: 1300,
        distractor_block_order: this.schedule[0]?.blockKind === "storm" ? 0 : 1,
        audio_cue_fraction: 0.25,
        seed: this.seed,
        practice_trials: this.skipPractice ? 0 : this.practiceSchedule.length,
      },
      trials: this.records,
      summary,
    };
    this.hooks.onComplete(result);
  }

  private transitionTo(newState: RunState, relT: number = 0): void {
    this.state = newState;
    this.stateStartTime = relT;
    this.distractorFired = false;
    this.respondedThisTrial = false;

    if (newState === "trial-isi" || newState === "practice-trial-isi") {
      this.currentTaps = [];
    }

    if (newState === "trial-stimulus") {
      this.currentStimulusOnsetMs = relT;
      const cur = this.schedule[this.trialIndex];
      if (cur) this.hooks.onStimulusOnset(cur, false);
    } else if (newState === "practice-trial-stimulus") {
      this.currentStimulusOnsetMs = relT;
      const cur = this.practiceSchedule[this.practiceIndex];
      if (cur) this.hooks.onStimulusOnset(cur, true);
    } else if (newState === "practice-trial-feedback") {
      const cur = this.practiceSchedule[this.practiceIndex];
      if (cur) this.hooks.onStimulusEnd(cur, true);
    }

    this.hooks.onStateChange(newState);
  }
}
