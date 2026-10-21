// Browser only. three.js touches the DOM, so the 3D scene module is imported inside mountRoutePlanner and never at
// module load: pages that import @adhdcheck/game for other games do not pull three.
import type { RoutePlannerResult } from "./types";

export { BETWEEN_MS, IDLE_TIMEOUT_MS, PRACTICE_INTRO_MS, RESULT_VERSION } from "./runner";

export interface RoutePlannerOptions {
  /** URL prefix of the self-hosted sound samples. Default "/games/bridge-wait" (shared with Bridge Wait). */
  assetBase?: string;
  onComplete?: (result: RoutePlannerResult) => void;
}
export interface RoutePlannerHandle {
  destroy: () => void;
}

export async function mountRoutePlanner(parent: HTMLElement, opts: RoutePlannerOptions = {}): Promise<RoutePlannerHandle> {
  const { createRoutePlannerScene } = await import("./scene");
  return createRoutePlannerScene(parent, { assetBase: opts.assetBase ?? "/games/bridge-wait", onComplete: opts.onComplete });
}
