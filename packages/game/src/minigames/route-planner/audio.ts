// Route Planner sounds synthesised with Web Audio (no file): a soft water "plip" when Luma lands on a lily pad.
// The other sounds are the Bridge Wait CC0 samples (GameAudio, ../bridge-wait/ASSETS.md). The AudioContext is
// created and resumed only inside a user gesture (iOS Safari rule), via unlock(). Without audio every method is a
// silent no-op, and no sound ever marks a move as good or bad: every landing sounds the same.
export class PadTones {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private closed = false;

  unlock(): void {
    if (this.closed) return;
    try {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === "suspended") void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  /** A short falling sine with a fast decay: a drop on still water. `k` varies the pitch a little per hop. */
  plip(k: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running" || !this.master) return;
    const now = ctx.currentTime;
    const f0 = 760 + (k % 3) * 70;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.42, now + 0.09);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.16, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g);
    g.connect(this.master);
    o.start(now);
    o.stop(now + 0.2);
  }

  close(): void {
    this.closed = true;
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }
}
