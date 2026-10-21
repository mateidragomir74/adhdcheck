import { afterEach, describe, expect, it, vi } from "vitest";
import { GameAudio } from "./audio";

// R3-L7 follow-up: the play page creates the AudioContext inside its start tap and hands it to the game; the
// game must use that one and never create a second.
function fakeCtx() {
  return {
    state: "suspended",
    currentTime: 0,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn() })),
    decodeAudioData: vi.fn(() => Promise.resolve({})),
    createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(8) })),
    createBufferSource: vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), buffer: null, loop: false })),
    createBiquadFilter: vi.fn(() => ({ connect: vi.fn(), frequency: { value: 0 } })),
    close: vi.fn(() => Promise.resolve()),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("GameAudio with an injected AudioContext", () => {
  it("reuses it: no second context is created, and it is resumed", () => {
    const Ctor = vi.fn();
    vi.stubGlobal("window", { AudioContext: Ctor });
    const injected = fakeCtx();
    const audio = new GameAudio("/x", injected as unknown as AudioContext);
    audio.unlock();
    audio.unlock();
    expect(Ctor).not.toHaveBeenCalled();
    expect(injected.resume).toHaveBeenCalled();
  });

  it("still creates its own context when none is injected (Bridge Wait)", () => {
    const made = fakeCtx();
    const Ctor = vi.fn(function () {
      return made;
    });
    vi.stubGlobal("window", { AudioContext: Ctor });
    new GameAudio("/x").unlock();
    expect(Ctor).toHaveBeenCalledTimes(1);
  });
});
