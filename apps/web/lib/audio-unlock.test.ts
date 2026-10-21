import { describe, expect, it, vi } from "vitest";
import { createUnlockedAudioContext } from "./audio-unlock";

// R3-L7 follow-up: the page's start tap is the user gesture, so the AudioContext is created and resumed there.
function fakeWindow(opts: { webkitOnly?: boolean } = {}) {
  const made: FakeCtx[] = [];
  class FakeCtx {
    state = "suspended";
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    started = 0;
    createBuffer = vi.fn(() => ({}));
    createBufferSource = vi.fn(() => ({ buffer: null as unknown, connect: vi.fn(), start: () => void (this.started += 1) }));
    constructor() {
      made.push(this);
    }
  }
  const win = opts.webkitOnly ? { webkitAudioContext: FakeCtx } : { AudioContext: FakeCtx };
  return { win: win as never, made };
}

describe("createUnlockedAudioContext", () => {
  it("creates one context, resumes it in the same call and plays a silent sample", () => {
    const { win, made } = fakeWindow();
    const ctx = createUnlockedAudioContext(win) as unknown as (typeof made)[number];
    expect(made).toHaveLength(1);
    expect(ctx).toBe(made[0]);
    expect(made[0]?.resume).toHaveBeenCalledTimes(1);
    expect(made[0]?.started).toBe(1);
  });
  it("falls back to webkitAudioContext", () => {
    const { win, made } = fakeWindow({ webkitOnly: true });
    expect(createUnlockedAudioContext(win)).toBe(made[0]);
  });
  it("returns null when there is no Web Audio, or when creating one throws", () => {
    expect(createUnlockedAudioContext({} as never)).toBeNull();
    expect(createUnlockedAudioContext({ AudioContext: class { constructor() { throw new Error("no"); } } } as never)).toBeNull();
  });
});
