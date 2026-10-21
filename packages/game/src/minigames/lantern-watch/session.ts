// Builds the SessionMetrics v1 payload (FR-10) from what the runner recorded. The result is parsed with the
// contract's own zod schema before it is returned, so the game can never hand the upload an invalid object.
import {
  SessionMetricsSchema,
  type Device,
  type SessionMetrics,
  type Trial,
} from "@adhdcheck/contracts";
import { summarise } from "../wake-fireflies/logic";
import type { TaskConfig } from "./logic";

/** `task.version` of this engine. Bump when the trial loop or a parameter changes. */
export const TASK_VERSION = "0.1.0";

export type OffTargetTap = SessionMetrics["off_target_taps"][number];

export function taskBlock(cfg: TaskConfig): SessionMetrics["task"] {
  return {
    type: "go_nogo",
    version: TASK_VERSION,
    blocks: cfg.blocks,
    go_probability: cfg.goProbability,
    stimulus_ms: cfg.stimulusMs,
    isi_ms_min: cfg.isiMsMin,
    isi_ms_max: cfg.isiMsMax,
    calibration_trials: cfg.calibrationTrials,
  };
}

/**
 * FR-03, with the summary of mini-game 0 (PR #27, ../wake-fireflies/logic.ts summarise): n is the number of
 * calibration trials run, the median uses hits only. #27 returns null when nothing was hit; the contract
 * cannot carry that, so building refuses (the runner repeats a calibration round with no hit).
 */
export function calibrationBlock(trials: readonly Trial[]): SessionMetrics["calibration"] {
  const c = summarise(trials.filter((t) => t.type === "calibration"));
  if (c === null) throw new Error("no calibration response recorded");
  return c;
}

export interface SessionInput {
  sessionId: string;
  childId: string;
  startedAt: string;
  durationMs: number;
  task: TaskConfig;
  device: Device;
  trials: Trial[];
  offTargetTaps: OffTargetTap[];
}

export function buildSessionMetrics(input: SessionInput): SessionMetrics {
  return SessionMetricsSchema.parse({
    schema_version: "1.0",
    session_id: input.sessionId,
    child_id: input.childId,
    started_at: input.startedAt,
    duration_ms: input.durationMs,
    task: taskBlock(input.task),
    device: input.device,
    trials: input.trials,
    off_target_taps: input.offTargetTaps,
    calibration: calibrationBlock(input.trials),
  });
}
