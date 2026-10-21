// One short chime, the same for every woken firefly (FR-05). Synthesised with Web Audio,
// so there is no audio file to licence. The AudioContext is created and resumed inside the
// first pointerdown (iOS Safari only allows audio after a user gesture). Silent if audio
// is unavailable; the game never depends on sound.

export interface Chime {
  unlock: () => void;
  play: () => void;
  close: () => void;
}

export function createChime(): Chime {
  let ctx: AudioContext | null = null;

  return {
    unlock() {
      if (ctx) return;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      void ctx.resume().catch(() => {});
    },
    play() {
      if (!ctx || ctx.state !== "running") return;
      const t0 = ctx.currentTime;
      // Two soft sine notes a fifth apart (E6, B6), quick attack, short decay.
      for (const [freq, delay] of [
        [1318.5, 0],
        [1975.5, 0.07],
      ] as const) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, t0 + delay);
        gain.gain.linearRampToValueAtTime(0.18, t0 + delay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + delay + 0.45);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0 + delay);
        osc.stop(t0 + delay + 0.5);
      }
    },
    close() {
      void ctx?.close().catch(() => {});
      ctx = null;
    },
  };
}
