// Lifecycle of the mounted game, with a minimal fake DOM (vitest runs in node). No tap is needed after
// the intro: every firefly that is not tapped falls asleep, so the game reaches its end by time alone.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountWakeFireflies } from "./mount";

type Listener = (e: unknown) => void;

function fakeEnvironment() {
  const listeners = new Map<string, Listener>();
  const frames: Array<(t: number) => void> = [];
  const noop = () => undefined;
  const gradient = { addColorStop: noop };
  const ctx = new Proxy(
    {},
    {
      get: (_t, key) =>
        key === "createRadialGradient" || key === "createLinearGradient"
          ? () => gradient
          : key === "measureText"
            ? () => ({ width: 10 })
            : noop,
      set: () => true,
    },
  );
  const canvas = {
    style: {} as Record<string, string>,
    width: 0,
    height: 0,
    setAttribute: noop,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    addEventListener: (type: string, fn: Listener) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
    remove: noop,
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("requestAnimationFrame", (fn: (t: number) => void) => frames.push(fn));
  vi.stubGlobal("cancelAnimationFrame", noop);
  vi.stubGlobal("window", {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
    devicePixelRatio: 1,
  });
  const parent = { appendChild: noop } as unknown as HTMLElement;
  return {
    parent,
    tap: (timeStamp: number) =>
      listeners.get("pointerdown")?.({ timeStamp, isPrimary: true, pointerType: "touch", button: 0, clientX: 1, clientY: 1 }),
    // Runs queued animation frames up to the given time, 16 ms apart.
    runFrames(from: number, to: number) {
      for (let t = from; t <= to; t += 16) {
        const fn = frames.shift();
        if (!fn) break;
        fn(t);
      }
    },
  };
}

describe("mountWakeFireflies lifecycle", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("reports the result once when left to finish", async () => {
    const env = fakeEnvironment();
    const onComplete = vi.fn();
    await mountWakeFireflies(env.parent, { seed: 7, trials: 1, onComplete });
    env.runFrames(0, 32);
    env.tap(40);
    env.runFrames(48, 60_000);
    vi.advanceTimersByTime(10_000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("never reports a result after it has been destroyed during the end hold", async () => {
    const env = fakeEnvironment();
    const onComplete = vi.fn();
    const handle = await mountWakeFireflies(env.parent, { seed: 7, trials: 1, onComplete });
    env.runFrames(0, 32);
    env.tap(40);
    env.runFrames(48, 60_000);
    handle.destroy();
    vi.advanceTimersByTime(10_000);
    expect(onComplete).not.toHaveBeenCalled();
  });
});
