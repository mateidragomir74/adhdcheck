// Browser only. three.js touches the DOM, so the 3D scene module is imported inside mountLanternWatch and never
// at module load: pages that import @adhdcheck/game for other games do not pull three.
import type { SessionMetrics } from "@adhdcheck/contracts";
import { ANTICIPATION_MS, DEFAULT_TASK, type TaskConfig } from "./logic";

export interface LanternWatchOptions {
  /** Pseudonymous child id (UUID) written into SessionMetrics.child_id (NFR-02). */
  childId: string;
  seed?: number;
  /** Dev runs only: fewer blocks or trials per block. The task block of the payload always matches what ran. */
  blocks?: number;
  trialsPerBlock?: number;
  /** Dev runs only (screenshots): a longer stimulus. Reported as task.stimulus_ms in the payload. */
  stimulusMs?: number;
  /** URL prefix of the self-hosted sound samples. Default "/games/bridge-wait" (shared with Bridge Wait). */
  assetBase?: string;
  /** The game begins by itself, with no in-game "Tap to start": the play page has its own start tap (full screen
   * and orientation are asked inside it). The standalone page leaves this off. */
  autoStart?: boolean;
  /** An AudioContext the caller already created and resumed inside a user gesture (see GameAudio). */
  audioContext?: AudioContext;
  onComplete?: (metrics: SessionMetrics) => void;
  /** The first calibration hit is recorded: ending early now yields valid metrics (the "Next game" button may appear). */
  onCanEndEarly?: () => void;
  /** endEarly() found nothing valid to hand back (no calibration firefly tapped yet). */
  onUnusable?: () => void;
  /** The payload could not be built (should not happen: it means a contract violation). */
  onError?: (err: unknown) => void;
}
export interface LanternWatchHandle {
  destroy: () => void;
  /** Ends the game now and hands back the trials already recorded through onComplete (or onUnusable). */
  endEarly: () => void;
}

export function taskFor(opts: Pick<LanternWatchOptions, "blocks" | "trialsPerBlock" | "stimulusMs">): TaskConfig {
  const pos = (v: number | undefined, d: number) => (v !== undefined && Number.isInteger(v) && v > 0 ? v : d);
  return {
    ...DEFAULT_TASK,
    blocks: pos(opts.blocks, DEFAULT_TASK.blocks),
    trialsPerBlock: pos(opts.trialsPerBlock, DEFAULT_TASK.trialsPerBlock),
    stimulusMs: pos(opts.stimulusMs, DEFAULT_TASK.stimulusMs),
  };
}

export async function mountLanternWatch(parent: HTMLElement, opts: LanternWatchOptions): Promise<LanternWatchHandle> {
  const { createLanternWatchScene } = await import("./scene");
  return createLanternWatchScene(parent, {
    seed: opts.seed ?? Date.now() & 0x7fffffff,
    task: taskFor(opts),
    childId: opts.childId,
    anticipationMs: ANTICIPATION_MS,
    assetBase: opts.assetBase ?? "/games/bridge-wait",
    autoStart: opts.autoStart === true,
    audioContext: opts.audioContext,
    onComplete: opts.onComplete,
    onUnusable: opts.onUnusable,
    onCanEndEarly: opts.onCanEndEarly,
    onError: opts.onError,
  });
}
