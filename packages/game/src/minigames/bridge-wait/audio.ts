// Game sound through the Web Audio API. The AudioContext is created and resumed only inside a user gesture
// (iOS Safari rule), via unlock(), which the scene calls from every pointerdown. The game works muted: the
// visual cue (bridge lanterns) is always drawn, and every method here is a silent no-op without audio.
//
// The go chime and the river are synthesised (no file, no decode step, identical every time). The other
// sounds are CC0 Kenney samples converted to MP3 (ASSETS.md), self-hosted under <assetBase>/audio/.
// Nothing tonal plays during the wait: only the steady river noise, so no sound can be mistaken for the chime.

export type SampleName = "start" | "step0" | "step1" | "step2" | "sparkle" | "ready" | "done";

const FILES: Record<SampleName, string> = {
  start: "start-pluck.mp3",
  step0: "step-wood-0.mp3",
  step1: "step-wood-1.mp3",
  step2: "step-wood-2.mp3",
  sparkle: "arrive-sparkle.mp3",
  ready: "jingle-ready.mp3",
  done: "jingle-done.mp3",
};

export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private raw = new Map<SampleName, ArrayBuffer>();
  private buffers = new Map<SampleName, AudioBuffer>();
  private river: AudioBufferSourceNode | null = null;
  private closed = false;

  /** audioContext: one the caller created and resumed inside a user gesture; it is used instead of making a new one. */
  constructor(
    private readonly assetBase: string,
    audioContext?: AudioContext,
  ) {
    if (audioContext) this.adopt(audioContext);
  }

  private adopt(ctx: AudioContext): void {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);
  }

  /** Fetch the sample files early (no gesture needed). Decoding waits for unlock(). */
  prefetch(): void {
    for (const [name, file] of Object.entries(FILES) as [SampleName, string][]) {
      fetch(`${this.assetBase}/audio/${file}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((buf) => {
          this.raw.set(name, buf);
          this.decodePending();
        })
        .catch(() => undefined); // a missing sample only means that sound is silent
    }
  }

  /** Call from inside a pointerdown handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.closed) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.adopt(new Ctor());
      }
      const ctx = this.ctx as AudioContext;
      this.decodePending();
      const ready = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
      void ready.then(() => this.startRiver()).catch(() => undefined);
    } catch {
      this.ctx = null; // audio unavailable: the game still works with the visual cue
    }
  }

  private decodePending() {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const [name, buf] of this.raw) {
      this.raw.delete(name);
      // decodeAudioData detaches the buffer, so each raw buffer is decoded once.
      ctx
        .decodeAudioData(buf)
        .then((b) => this.buffers.set(name, b))
        .catch(() => undefined);
    }
  }

  private running(): AudioContext | null {
    const ctx = this.ctx;
    return ctx && ctx.state === "running" && this.master ? ctx : null;
  }

  /** The go chime: a soft two-partial bell. Called in the frame that draws the lantern cue. */
  chime(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const partials: [number, number, number][] = [
      [880, 0.22, 0.9],
      [1320, 0.12, 0.7],
      [2640, 0.04, 0.35],
    ];
    for (const [f, peak, decay] of partials) {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak, now + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);
      g.connect(this.master);
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      o.connect(g);
      o.start(now);
      o.stop(now + decay + 0.05);
    }
  }

  /** Wordless creature babble while Luma talks, confined to durationMs. */
  babble(durationMs: number): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + 0.05;
    const end = start + Math.max(0, durationMs - 250) / 1000;
    const notes = [523, 587, 659, 698, 784, 659, 587];
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1800;
    filter.connect(this.master);
    let t = start;
    let k = 0;
    while (t < end) {
      const len = 0.07 + ((k * 37) % 5) * 0.012;
      const o = ctx.createOscillator();
      o.type = "triangle";
      const f = notes[(k * 3) % notes.length] as number;
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 1.12, t + len);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.07, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(g);
      g.connect(filter);
      o.start(t);
      o.stop(t + len + 0.02);
      t += len + (k % 4 === 3 ? 0.13 : 0.035);
      k += 1;
    }
  }

  play(name: SampleName, gain = 0.7): void {
    const ctx = this.running();
    const buf = this.buffers.get(name);
    if (!ctx || !buf || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  /** Steady low river noise (no events, no pitch). Starts once audio is running. */
  startRiver(): void {
    const ctx = this.running();
    if (!ctx || !this.master || this.river) return;
    const len = ctx.sampleRate * 3;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // Brown noise: integrated white noise, leaky so it stays bounded.
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 700;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.05, ctx.currentTime + 2);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start();
    this.river = src;
  }

  close(): void {
    this.closed = true;
    try {
      this.river?.stop();
    } catch {
      // already stopped
    }
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
