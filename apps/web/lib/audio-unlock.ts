// The play page's start tap is a user gesture, the only moment iOS Safari lets an AudioContext start. Create and
// resume it there, play one silent sample (the old WebKit trick that finishes the unlock), and hand it to the
// game, which reuses it instead of making its own after the gesture has passed. Returns null without Web Audio.
type Win = { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };

export function createUnlockedAudioContext(win: Win = window as unknown as Win): AudioContext | null {
  try {
    const Ctor = win.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    void ctx.resume().catch(() => undefined);
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
    return ctx;
  } catch {
    return null;
  }
}
