import { describe, expect, it, vi } from "vitest";
import type { SessionMetrics } from "@adhdcheck/contracts";
import { PLAY_STRINGS } from "./strings";
import { createSessionGame, sessionGame } from "./game";

const CHILD = "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
const OFF = { camera: false, microphone: false };
const el = () => ({ textContent: "" as string | null, className: "absolute inset-0", replaceChildren() {} }) as unknown as HTMLElement;
const tick = () => new Promise((r) => setTimeout(r, 0));

type Opts = { onComplete?: (m: SessionMetrics) => void; onUnusable?: () => void; onCanEndEarly?: () => void; onError?: (e: unknown) => void };
function fakeMount() {
  const destroy = vi.fn();
  const endEarly = vi.fn();
  let opts: Opts = {};
  const mount = vi.fn(async (_el: HTMLElement, o: Opts) => {
    opts = o;
    return { destroy, endEarly };
  });
  return { destroy, endEarly, mount, opts: () => opts };
}

describe("sessionGame (the game a play link runs)", () => {
  it("is wired to Lantern Watch, so the page no longer shows the 'not ready' screen", () => {
    expect(sessionGame).not.toBeNull();
  });

  it("shows the calm fallback and records nothing when the 3D game cannot mount (no DOM, no WebGL here)", async () => {
    const target = { textContent: "" as string | null, className: "absolute inset-0", replaceChildren() {} };
    let settled = false;
    const run = sessionGame?.(target as unknown as HTMLElement, CHILD, OFF);
    void run?.promise.then(
      () => (settled = true),
      () => (settled = true),
    );
    // The game module (three.js) loads lazily; give it time, then give the promise a chance to settle.
    for (let k = 0; k < 100 && target.textContent !== PLAY_STRINGS.unavailable; k++) await new Promise((r) => setTimeout(r, 50));
    await new Promise((r) => setTimeout(r, 100));
    expect(target.textContent).toBe(PLAY_STRINGS.unavailable);
    expect(settled).toBe(false); // no SessionMetrics, so the flow never uploads anything
  });
});

// R3-L1: leaving the page mid-task must stop the render loop, WebGL, audio and listeners.
describe("createSessionGame destroy (R3-L1)", () => {
  it("destroys the mounted game when the page leaves while it runs", async () => {
    const { destroy, mount } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    expect(destroy).not.toHaveBeenCalled();
    run.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys a game that finishes mounting after the page already left", async () => {
    const { destroy, mount } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    run.destroy(); // before the lazy import and mount settle
    await tick();
    await tick();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the game once when it completes, and again destroying is harmless", async () => {
    const { destroy, mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    const metrics = { session_id: "x" } as unknown as SessionMetrics;
    opts().onComplete?.(metrics);
    await expect(run.promise).resolves.toBe(metrics);
    run.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("R4-7 never resolves a result that arrives after the page left (destroyed)", async () => {
    const { mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    run.destroy();
    opts().onComplete?.({ session_id: "late" } as unknown as SessionMetrics);
    const outcome = await Promise.race([run.promise.then(() => "resolved"), new Promise((r) => setTimeout(() => r("pending"), 30))]);
    expect(outcome).toBe("pending");
  });

  it("R4-7 gives the game the audio context created in the start tap, and no other", async () => {
    const { mount } = fakeMount();
    const ctx = { state: "running" } as unknown as AudioContext;
    createSessionGame(async () => mount)(el(), CHILD, OFF, ctx);
    await tick();
    expect(mount.mock.calls[0]?.[1]).toMatchObject({ audioContext: ctx });
  });

  it("asks the game to start by itself, so the child taps start once (the page's start button is the tap, R3-L7)", async () => {
    const { mount } = fakeMount();
    createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    expect(mount.mock.calls[0]?.[1]).toMatchObject({ childId: CHILD, autoStart: true });
  });
});

// The visible "Next game" button during Lantern Watch: end the game now and keep the trials already recorded.
describe("createSessionGame endEarly (Next game)", () => {
  it("asks the mounted game to end, and resolves with the partial metrics it hands back", async () => {
    const { endEarly, mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    run.endEarly?.();
    expect(endEarly).toHaveBeenCalledTimes(1);
    const partial = { session_id: "partial" } as unknown as SessionMetrics;
    opts().onComplete?.(partial);
    await expect(run.promise).resolves.toBe(partial);
  });

  it("resolves with null when the game has nothing valid to hand back (no calibration firefly tapped)", async () => {
    const { mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    run.endEarly?.();
    opts().onUnusable?.();
    await expect(run.promise).resolves.toBeNull();
  });

  it("remembers a request made before the game finished mounting and applies it once mounted", async () => {
    const { endEarly, mount } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    run.endEarly?.();
    expect(endEarly).not.toHaveBeenCalled();
    await tick();
    await tick();
    expect(endEarly).toHaveBeenCalledTimes(1);
  });

  it("does nothing after the page left", async () => {
    const { endEarly, mount } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    await tick();
    run.destroy();
    run.endEarly?.();
    expect(endEarly).not.toHaveBeenCalled();
  });
});

// I-1: the Next game button of Lantern Watch appears only when the game says ending early gives valid metrics.
describe("createSessionGame canEndEarly (I-1)", () => {
  it("resolves only when the game reports a calibration hit, and never when it fails to mount", async () => {
    const { mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    let ready = false;
    void run.canEndEarly?.then(() => (ready = true));
    await tick();
    await tick();
    expect(run.canEndEarly).toBeDefined();
    expect(ready).toBe(false);
    opts().onCanEndEarly?.();
    await tick();
    expect(ready).toBe(true);

    const failing = createSessionGame(async () => {
      throw new Error("no WebGL");
    })(el(), CHILD, OFF);
    let failedReady = false;
    void failing.canEndEarly?.then(() => (failedReady = true));
    await tick();
    await tick();
    expect(failedReady).toBe(false);
  });

  it("does not resolve after the page left", async () => {
    const { mount, opts } = fakeMount();
    const run = createSessionGame(async () => mount)(el(), CHILD, OFF);
    let ready = false;
    void run.canEndEarly?.then(() => (ready = true));
    await tick();
    run.destroy();
    opts().onCanEndEarly?.();
    await tick();
    expect(ready).toBe(false);
  });
});
