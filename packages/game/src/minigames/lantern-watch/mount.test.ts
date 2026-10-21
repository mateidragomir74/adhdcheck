import { beforeEach, describe, expect, it, vi } from "vitest";

// R5-2: mountLanternWatch passes the caller's AudioContext on to the scene. A context created and resumed
// inside the user gesture is what lets the sound play on iOS; dropping it fails silently, so this guards it.
const createLanternWatchScene = vi.fn(async () => ({ destroy: () => {} }));
vi.mock("./scene", () => ({ createLanternWatchScene }));

import { mountLanternWatch } from "./mount";

const CHILD = "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";

describe("mountLanternWatch", () => {
  beforeEach(() => createLanternWatchScene.mockClear());

  it("hands the injected audioContext to the scene", async () => {
    const audioContext = { synthetic: true } as unknown as AudioContext;
    await mountLanternWatch({} as HTMLElement, { childId: CHILD, audioContext });
    const opts = (createLanternWatchScene.mock.calls[0] as unknown[])[1] as { audioContext?: AudioContext };
    expect(opts.audioContext).toBe(audioContext);
  });

  it("passes no audioContext when the caller gave none", async () => {
    await mountLanternWatch({} as HTMLElement, { childId: CHILD });
    const opts = (createLanternWatchScene.mock.calls[0] as unknown[])[1] as { audioContext?: AudioContext };
    expect(opts.audioContext).toBeUndefined();
  });

  it("passes the child id, the shared asset base and autoStart off by default", async () => {
    await mountLanternWatch({} as HTMLElement, { childId: CHILD });
    const opts = (createLanternWatchScene.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(opts).toMatchObject({ childId: CHILD, assetBase: "/games/bridge-wait", autoStart: false });
  });
});
