// Wake the fireflies (FR-03), the calibration block of research/04 section 5.
// Trials and the calibration summary use the SessionMetrics v1 contract types directly
// (packages/contracts), so nothing here redefines a shape that crosses a boundary.
// Local times are milliseconds on the performance.now() timebase; they become
// session-relative in the contract Trial.

import type { SessionMetrics, Trial } from "@adhdcheck/contracts";

/** The contract calibration block (SessionMetrics v1). */
export type Calibration = SessionMetrics["calibration"];

export interface ScheduleConfig {
  seed: number;
  count: number;
}

export interface ScheduledTrial {
  i: number;
  /** Pause before the firefly lights up. TODO: design choice, no sourced value. */
  waitMs: number;
  /** Which sleeping firefly lights up (index into the slot layout). */
  slot: number;
}

/** One measured trial before it is turned into a contract Trial. */
export interface RawTrial {
  i: number;
  /** rAF timestamp of the frame that drew the lit firefly. */
  onsetMs: number;
  /** event.timeStamp of the first pointerdown on the lit firefly, or null. */
  tapMs: number | null;
  /** Tap position in CSS pixels relative to the game surface; 0 when there was no tap. */
  x: number;
  y: number;
}

export interface WakeFirefliesResult {
  id: "wake-fireflies";
  version: string;
  params: {
    n_trials: number;
    practice_trials: number;
    seed: number;
    /** TODO: design choice, no sourced value. */
    wait_ms_min: number;
    /** TODO: design choice, no sourced value. */
    wait_ms_max: number;
    /** TODO: design choice, no sourced value. */
    response_window_ms: number;
  };
  /** Contract trials, `type: "calibration"`, session-relative onsets. */
  trials: Trial[];
  /** Contract calibration block; null when no firefly was tapped (not enough data). */
  calibration: Calibration | null;
}
