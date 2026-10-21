export { mountLanternWatch, taskFor } from "./mount";
export type { LanternWatchHandle, LanternWatchOptions } from "./mount";
// Renamed on export: Bridge Wait already exports buildSchedule and the package index re-exports both games.
export {
  ANTICIPATION_MS,
  DEFAULT_TASK,
  LANTERNS,
  buildCalibrationSchedule as buildLanternCalibrationSchedule,
  buildSchedule as buildLanternSchedule,
  classify as classifyLanternTrial,
} from "./logic";
export type { TaskConfig } from "./logic";
export { TASK_VERSION, buildSessionMetrics, calibrationBlock, taskBlock } from "./session";
export { LanternWatchRunner } from "./runner";
export type { RunData } from "./runner";
