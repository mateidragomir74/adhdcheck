// Storm Watch audio synthesis via Web Audio API + self-hosted bridge-wait samples.
// Uses /games/bridge-wait/audio/arrive-sparkle.mp3 for magical catch chime, with Web Audio fallbacks.

export class StormWatchAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sparkleBuffer: AudioBuffer | null = null;
  private rainNode: AudioNode | null = null;
  private rainGain: GainNode | null = null;
  private closed = false;

  constructor() {
    this.preloadSparkle();
  }

  private preloadSparkle(): void {
    if (typeof window === "undefined") return;
    fetch("/games/bridge-wait/audio/arrive-sparkle.mp3")
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => {
        if (this.ctx) {
          void this.ctx.decodeAudioData(buf, (decoded) => {
            this.sparkleBuffer = decoded;
          });
        }
      })
      .catch(() => undefined);
  }

  /** Call from pointerdown handler. Safe to call repeatedly. */
  unlock(): void {
    if (this.closed) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.preloadSparkle();
      }
      if (this.ctx.state === "suspended") {
        void this.ctx.resume();
      }
    } catch {
      // Audio failure is non-fatal
    }
  }

  private running(): AudioContext | null {
    if (this.closed || !this.ctx) return null;
    if (this.ctx.state !== "running") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Successful catch sound: uses the arrive-sparkle.mp3 from bridge-wait,
   * with sweet chime synth fallback.
   */
  catchSuccess(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;

    if (this.sparkleBuffer) {
      try {
        const source = ctx.createBufferSource();
        source.buffer = this.sparkleBuffer;
        const gain = ctx.createGain();
        gain.gain.value = 1.0;
        source.connect(gain);
        gain.connect(this.master);
        source.start();
        return;
      } catch {}
    }

    // Synthesized magical sparkle chime fallback
    const now = ctx.currentTime;
    const notes = [659.25, 880, 1046.5, 1318.5]; // E5, A5, C6, E6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.04);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.exponentialRampToValueAtTime(0.3, now + idx * 0.04 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.04 + 0.38);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(now + idx * 0.04);
      osc.stop(now + idx * 0.04 + 0.4);
    });
  }

  /**
   * Firefly sound: magical sparkling chime twinkle
   */
  fireflyChirp(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const notes = [783.99, 1046.5, 1318.5, 1567.98]; // G5, C6, E6, G6
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.28, now + idx * 0.05 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.master!);

      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.38);
    });
  }

  /**
   * Shadow cricket sound: authentic nature cricket chirp rhythm ("cri-cri-cri")
   */
  cricketChirp(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    for (let c = 0; c < 3; c++) {
      const cStart = now + c * 0.11;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(4500, cStart);
      osc.frequency.exponentialRampToValueAtTime(4100, cStart + 0.06);

      filter.type = "bandpass";
      filter.frequency.setValueAtTime(4400, cStart);
      filter.Q.value = 4.0;

      gain.gain.setValueAtTime(0.001, cStart);
      gain.gain.exponentialRampToValueAtTime(0.22, cStart + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, cStart + 0.06);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);

      osc.start(cStart);
      osc.stop(cStart + 0.07);
    }
  }

  /**
   * Wrong tap sound (when tapping the shadow cricket):
   * A distinct, clearly audible cartoon comic "bonk / boing-thud" sound.
   * Clear and audible on all speakers without being harsh or shaming.
   */
  wrongTap(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const dur = 0.22;

    // Dual oscillator: triangle + square for a clean cartoon wooden "bonk"
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(110, now + dur);

    osc2.type = "square";
    osc2.frequency.setValueAtTime(190, now);
    osc2.frequency.exponentialRampToValueAtTime(70, now + dur);

    // Filter to keep it round and pleasant, not piercing
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(900, now);
    filter.frequency.exponentialRampToValueAtTime(250, now + dur);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + dur + 0.02);
    osc2.stop(now + dur + 0.02);
  }

  /** Soft neutral tap feedback for touch/click */
  tap(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.04);

    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Cross-modal stimulus: Gentle dual-tone owl hoot ("whoo-whoo")
   */
  owlHoot(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;

    const hoots = [
      { start: now + 0.02, dur: 0.2, freq: 380, endFreq: 330 },
      { start: now + 0.26, dur: 0.28, freq: 440, endFreq: 380 },
    ];

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    filter.connect(this.master);

    hoots.forEach(({ start, dur, freq, endFreq }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, start);
      osc.frequency.exponentialRampToValueAtTime(endFreq, start + dur);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.38, start + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(start);
      osc.stop(start + dur + 0.02);
    });
  }

  /**
   * Distractor stimulus: Powerful, highly distracting multi-stage thunder
   * 1. Sharp electric snap/crackle upfront
   * 2. Deep sub-bass physical boom (85Hz -> 28Hz)
   * 3. Booming rolling low-pass thunder rumble
   */
  thunder(): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const dur = 1.8;

    // 1. Initial sharp electric crackle snap
    const snapLen = 0.05;
    const snapBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * snapLen), ctx.sampleRate);
    const snapData = snapBuffer.getChannelData(0);
    for (let i = 0; i < snapData.length; i++) {
      snapData[i] = (Math.random() * 2 - 1) * Math.exp(-i / (snapData.length * 0.25));
    }
    const snapSource = ctx.createBufferSource();
    snapSource.buffer = snapBuffer;
    const snapFilter = ctx.createBiquadFilter();
    snapFilter.type = "highpass";
    snapFilter.frequency.setValueAtTime(2200, now);
    const snapGain = ctx.createGain();
    snapGain.gain.setValueAtTime(0.7, now);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + snapLen);
    snapSource.connect(snapFilter);
    snapFilter.connect(snapGain);
    snapGain.connect(this.master);
    snapSource.start(now);

    // 2. Heavy sub-bass boom (85Hz -> 28Hz)
    const subOsc = ctx.createOscillator();
    subOsc.type = "triangle";
    subOsc.frequency.setValueAtTime(85, now + 0.02);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + dur);
    const subGain = ctx.createGain();
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.exponentialRampToValueAtTime(0.8, now + 0.08);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    subOsc.connect(subGain);
    subGain.connect(this.master);
    subOsc.start(now);
    subOsc.stop(now + dur + 0.05);

    // 3. Deep rolling thunder rumble
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.025 * white) / 1.025;
      lastOut = output[i]!;
      output[i]! *= 4.5;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(160, now);
    filter.frequency.linearRampToValueAtTime(320, now + 0.25);
    filter.frequency.exponentialRampToValueAtTime(50, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.7, now + 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    whiteNoise.start(now);
    whiteNoise.stop(now + dur + 0.05);
  }

  /** Luma creature babble when speaking */
  babble(durationMs: number): void {
    const ctx = this.running();
    if (!ctx || !this.master) return;
    const start = ctx.currentTime + 0.04;
    const end = start + Math.max(0, durationMs - 200) / 1000;
    const notes = [440, 523, 587, 659, 784];

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    filter.connect(this.master);

    let t = start;
    let k = 0;
    while (t < end) {
      const len = 0.08 + ((k * 31) % 4) * 0.015;
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const f = notes[(k * 2) % notes.length] as number;
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.linearRampToValueAtTime(f * 1.1, t + len);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.1, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + len);

      osc.connect(gain);
      gain.connect(filter);

      osc.start(t);
      osc.stop(t + len + 0.02);
      t += len + (k % 3 === 2 ? 0.11 : 0.03);
      k += 1;
    }
  }

  startRain(): void {
    const ctx = this.running();
    if (!ctx || !this.master || this.rainNode) return;
    try {
      const bufferSize = ctx.sampleRate * 2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (last + 0.05 * white) / 1.05;
        last = data[i]!;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;

      this.rainGain = ctx.createGain();
      this.rainGain.gain.setValueAtTime(0.0001, ctx.currentTime);
      this.rainGain.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.6);

      noise.connect(filter);
      filter.connect(this.rainGain);
      this.rainGain.connect(this.master);

      noise.start();
      this.rainNode = noise;
    } catch {}
  }

  stopRain(): void {
    if (this.rainGain && this.ctx) {
      try {
        this.rainGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.5);
      } catch {}
    }
    setTimeout(() => {
      if (this.rainNode) {
        try {
          (this.rainNode as AudioBufferSourceNode).stop();
          this.rainNode.disconnect();
        } catch {}
        this.rainNode = null;
      }
    }, 600);
  }

  close(): void {
    this.closed = true;
    this.stopRain();
    if (this.ctx) {
      void this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }
}
