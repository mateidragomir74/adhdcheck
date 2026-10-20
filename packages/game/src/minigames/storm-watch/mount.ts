import type { StormWatchResult } from "./types";

export interface StormWatchOptions {
  seed?: number;
  trialsPerBlock?: number;
  stimulusMs?: number;
  skipPractice?: boolean;
  onComplete?: (result: StormWatchResult) => void;
}

export interface StormWatchHandle {
  destroy: () => void;
}

export async function mountStormWatch(
  parent: HTMLElement,
  opts: StormWatchOptions = {},
): Promise<StormWatchHandle> {
  const { createStormWatchScene } = await import("./scene");
  return createStormWatchScene(parent, opts);
}
