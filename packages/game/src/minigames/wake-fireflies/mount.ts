// Wake the fireflies (FR-03): sleeping fireflies light up one at a time and the child taps
// each one to wake it. No no-go, no failure screen, no score; the same chime for every tap.
//
// Plain Canvas 2D with our own requestAnimationFrame loop, so that the onset of each lit
// firefly is the timestamp of the rAF callback that draws it, and the response is the
// native pointerdown event.timeStamp on the same time origin (research/03 section 2.3).

import {
  CALIBRATION_TRIALS,
  N_SLOTS,
  PRACTICE_TRIALS,
  RESPONSE_WINDOW_MS,
  WAIT_MS_MAX,
  WAIT_MS_MIN,
  buildSchedule,
  mulberry32,
  summarise,
  toContractTrial,
} from "./logic";
import { isPrimaryPointer } from "../../pointer";
import { createChime } from "./audio";
import { STRINGS } from "./strings";
import type { RawTrial, ScheduledTrial, WakeFirefliesResult } from "./types";

export const RESULT_VERSION = "0.1.0";

export interface WakeFirefliesOptions {
  seed?: number;
  /** Number of measured trials. Defaults to the contract value (10); dev builds may lower it. */
  trials?: number;
  /** performance.now() value used as the session origin; defaults to when the measured block starts. */
  sessionStartMs?: number;
  onComplete?: (result: WakeFirefliesResult) => void;
}

export interface WakeFirefliesHandle {
  destroy: () => void;
}

// Layout of the sleeping fireflies, as fractions of the surface (upper two thirds, away from Luma).
const SLOTS: ReadonlyArray<readonly [number, number]> = [
  [0.22, 0.3],
  [0.5, 0.2],
  [0.78, 0.3],
  [0.35, 0.52],
  [0.68, 0.5],
];
if (SLOTS.length !== N_SLOTS) throw new Error("SLOTS must match N_SLOTS");

const WAKE_ANIM_MS = 700; // design choice: woken firefly flies up to the moon
const SLEEP_ANIM_MS = 400; // design choice: unanswered firefly dims back, no sound
const PHASE_PAUSE_MS = 1800; // design choice: bubble shown between practice and measured block
const END_HOLD_MS = 2500; // design choice: celebration before onComplete

type Stage = "intro" | "practice" | "between" | "real" | "end";

type TrialState =
  | { kind: "wait"; until: number }
  | { kind: "lit"; onset: number | null; litAt: number }
  | { kind: "woken"; since: number }
  | { kind: "asleep"; since: number };

interface Woken {
  fromX: number;
  fromY: number;
  at: number;
  seed: number;
}

export async function mountWakeFireflies(parent: HTMLElement, opts: WakeFirefliesOptions = {}): Promise<WakeFirefliesHandle> {
  const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
  const nTrials = opts.trials ?? CALIBRATION_TRIALS;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

  const canvas = document.createElement("canvas");
  canvas.style.cssText = "display:block;width:100%;height:100%;touch-action:none;user-select:none;-webkit-user-select:none;cursor:pointer";
  canvas.setAttribute("aria-label", "Wake the fireflies game");
  canvas.setAttribute("role", "img");
  parent.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");

  let w = 0;
  let h = 0;
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const chime = createChime();
  const practice = buildSchedule({ seed: seed ^ 0x5eed, count: PRACTICE_TRIALS });
  const measured = buildSchedule({ seed, count: nTrials });
  const stars = makeStars(seed);

  let stage: Stage = "intro";
  let stageSince = 0;
  let schedule: ScheduledTrial[] = practice;
  let idx = 0;
  let trial: TrialState = { kind: "wait", until: 0 };
  let sessionStart = opts.sessionStartMs ?? 0;
  let current: RawTrial | null = null;
  const raws: RawTrial[] = [];
  const woken: Woken[] = [];
  let completed = false;
  let endHold: number | undefined;
  let frame = 0;
  let lastNow = 0;

  const fireflyR = () => Math.max(18, Math.min(40, Math.min(w, h) * 0.045));
  // Generous hit area for small fingers: at least 44 CSS px radius (88 px across).
  const hitR = () => Math.max(44, fireflyR() * 2.4);
  const slotXY = (slot: number) => {
    const s = SLOTS[slot] ?? SLOTS[0]!;
    return [s[0] * w, s[1] * h] as const;
  };
  const moon = () => [w * 0.86, h * 0.1] as const;

  function startStage(next: Stage, now: number) {
    stage = next;
    stageSince = now;
    if (next === "practice" || next === "real") {
      schedule = next === "practice" ? practice : measured;
      idx = 0;
      if (next === "real" && opts.sessionStartMs === undefined) sessionStart = now;
      trial = { kind: "wait", until: now + (schedule[0]?.waitMs ?? WAIT_MS_MIN) };
    }
  }

  function nextTrial(now: number) {
    if (stage === "real" && current) raws.push(current);
    current = null;
    idx += 1;
    if (idx < schedule.length) {
      trial = { kind: "wait", until: now + (schedule[idx]?.waitMs ?? WAIT_MS_MIN) };
    } else if (stage === "practice") {
      startStage("between", now);
    } else {
      finish(now);
    }
  }

  function finish(now: number) {
    startStage("end", now);
    // Celebration: the sleepers wake too and join the others at the moon.
    for (let s = 0; s < N_SLOTS; s++) {
      const [x, y] = slotXY(s);
      woken.push({ fromX: x, fromY: y, at: now + s * 120, seed: woken.length + 1 });
    }
    const trials = raws.map((r) => toContractTrial(r, sessionStart, RESPONSE_WINDOW_MS));
    const result: WakeFirefliesResult = {
      id: "wake-fireflies",
      version: RESULT_VERSION,
      params: {
        n_trials: nTrials,
        practice_trials: PRACTICE_TRIALS,
        seed,
        wait_ms_min: WAIT_MS_MIN,
        wait_ms_max: WAIT_MS_MAX,
        response_window_ms: RESPONSE_WINDOW_MS,
      },
      trials,
      calibration: summarise(trials),
    };
    endHold = window.setTimeout(() => {
      if (!completed) {
        completed = true;
        opts.onComplete?.(result);
      }
    }, END_HOLD_MS);
  }

  const onPointerDown = (e: PointerEvent) => {
    if (!isPrimaryPointer(e)) return; // a second finger is not a response
    const t = e.timeStamp;
    chime.unlock();
    if (stage === "intro") {
      startStage("practice", lastNow || performance.now());
      return;
    }
    if ((stage !== "practice" && stage !== "real") || trial.kind !== "lit" || trial.onset === null) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const [sx, sy] = slotXY(schedule[idx]?.slot ?? 0);
    if (Math.hypot(x - sx, y - sy) > hitR()) return; // taps elsewhere are ignored (no reaction)
    if (t < trial.onset) return; // cannot happen with a shared time origin; kept as a guard
    if (current) {
      current.tapMs = t;
      current.x = x;
      current.y = y;
    }
    chime.play();
    woken.push({ fromX: sx, fromY: sy, at: t, seed: woken.length + 1 });
    trial = { kind: "woken", since: t };
  };
  canvas.addEventListener("pointerdown", onPointerDown);

  function update(now: number) {
    if (stage === "between" && now - stageSince >= PHASE_PAUSE_MS) startStage("real", now);
    if (stage !== "practice" && stage !== "real") return;

    if (trial.kind === "wait" && now >= trial.until) {
      // Lit from this frame on; the onset is set in draw(), in the callback that draws it.
      trial = { kind: "lit", onset: null, litAt: now };
      current = { i: idx, onsetMs: 0, tapMs: null, x: 0, y: 0 };
    } else if (trial.kind === "lit" && trial.onset !== null && now - trial.onset >= RESPONSE_WINDOW_MS) {
      trial = { kind: "asleep", since: now };
    } else if (trial.kind === "woken" && now - trial.since >= WAKE_ANIM_MS) {
      nextTrial(now);
    } else if (trial.kind === "asleep" && now - trial.since >= SLEEP_ANIM_MS) {
      nextTrial(now);
    }
  }

  function draw(now: number) {
    drawBackground(ctx!, w, h, stars, now, reduceMotion);
    const [mx, my] = moon();
    const r = fireflyR();
    const activeSlot = stage === "practice" || stage === "real" ? schedule[idx]?.slot : undefined;

    // Sleeping fireflies (all slots), dim.
    for (let s = 0; s < N_SLOTS; s++) {
      if (stage === "end") break;
      if (s === activeSlot && trial.kind === "lit") continue;
      const [x, y] = slotXY(s);
      drawSleeper(ctx!, x, y, r);
    }

    // Woken fireflies gather around the moon.
    for (const f of woken) {
      const k = reduceMotion ? 1 : easeOut(Math.max(0, Math.min(1, (now - f.at) / WAKE_ANIM_MS)));
      const rnd = mulberry32(f.seed * 7919);
      const ang = rnd() * Math.PI * 2 + (reduceMotion ? 0 : now / 2400) * (rnd() > 0.5 ? 1 : -1);
      const rad = Math.min(w, h) * (0.06 + rnd() * 0.06);
      const tx = mx + Math.cos(ang) * rad;
      const ty = my + Math.sin(ang) * rad * 0.7;
      const x = f.fromX + (tx - f.fromX) * k;
      const y = f.fromY + (ty - f.fromY) * k;
      drawGlow(ctx!, x, y, r * (1 - 0.45 * k), 0.95);
    }

    // The lit firefly. Its onset is the timestamp of this callback: the frame that draws it.
    if (activeSlot !== undefined && trial.kind === "lit") {
      if (trial.onset === null) {
        trial.onset = now;
        if (current) current.onsetMs = now;
      }
      const [x, y] = slotXY(activeSlot);
      drawGlow(ctx!, x, y, r, 1);
      if (stage === "practice") drawHint(ctx!, x, y, hitR(), now, reduceMotion);
    }
    if (activeSlot !== undefined && trial.kind === "asleep") {
      const [x, y] = slotXY(activeSlot);
      drawGlow(ctx!, x, y, r, 1 - (now - trial.since) / SLEEP_ANIM_MS);
    }

    // Luma and the speech bubble.
    const lumaS = Math.max(0.7, Math.min(1.6, Math.min(w, h) / 520));
    const lx = Math.max(70 * lumaS, w * 0.14);
    const ly = h - 80 * lumaS;
    const happy = stage === "end";
    drawLuma(ctx!, lx, ly, lumaS, now, reduceMotion, happy);
    const text =
      stage === "intro"
        ? STRINGS.start
        : stage === "between"
          ? STRINGS.realIntro
          : stage === "end"
            ? STRINGS.done
            : stage === "practice" && idx === 0 && trial.kind === "wait"
              ? STRINGS.practiceIntro
              : null;
    if (text) drawBubble(ctx!, text, lx + 52 * lumaS, ly - 70 * lumaS, Math.min(w - lx - 70 * lumaS, 420), lumaS);
    if (stage === "intro") drawPlay(ctx!, w / 2, h * 0.42, Math.max(44, Math.min(w, h) * 0.09), now, reduceMotion);
  }

  const loop = (now: number) => {
    lastNow = now;
    update(now);
    draw(now);
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);

  return {
    destroy() {
      // A game closed during the end hold never reports a result.
      completed = true;
      window.clearTimeout(endHold);
      cancelAnimationFrame(frame);
      canvas.removeEventListener("pointerdown", onPointerDown);
      ro.disconnect();
      chime.close();
      canvas.remove();
    },
  };
}

/* ---------- drawing helpers (pure canvas, CSS pixel space) ---------- */

type Star = { x: number; y: number; r: number; tw: number };

function makeStars(seed: number): Star[] {
  const rnd = mulberry32(seed ^ 0x57a2);
  return Array.from({ length: 70 }, () => ({ x: rnd(), y: rnd() * 0.65, r: 0.6 + rnd() * 1.3, tw: rnd() * 6.28 }));
}

const easeOut = (k: number) => 1 - (1 - k) ** 3;

function drawBackground(c: CanvasRenderingContext2D, w: number, h: number, stars: Star[], now: number, still: boolean) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0b1430");
  g.addColorStop(1, "#1c2c5e");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  // Stars: low contrast and slow so they never compete with the lit firefly.
  for (const s of stars) {
    c.globalAlpha = still ? 0.45 : 0.3 + 0.2 * Math.sin(now / 1600 + s.tw);
    c.fillStyle = "#dfe6ff";
    c.beginPath();
    c.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    c.fill();
  }
  c.globalAlpha = 1;

  // Moon, where the woken fireflies gather.
  const mx = w * 0.86;
  const my = h * 0.1;
  const mr = Math.max(16, Math.min(w, h) * 0.04);
  const mg = c.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 3);
  mg.addColorStop(0, "rgba(238,241,255,0.25)");
  mg.addColorStop(1, "rgba(238,241,255,0)");
  c.fillStyle = mg;
  c.beginPath();
  c.arc(mx, my, mr * 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#eef1ff";
  c.beginPath();
  c.arc(mx, my, mr, 0, Math.PI * 2);
  c.fill();

  // Forest silhouette.
  c.fillStyle = "#081024";
  c.beginPath();
  c.moveTo(0, h);
  const step = Math.max(40, w / 18);
  for (let x = 0, k = 0; x <= w + step; x += step, k++) {
    const top = h * (0.8 + (k % 3 === 0 ? -0.06 : k % 2 ? -0.02 : 0.01));
    c.lineTo(x - step / 2, top);
    c.lineTo(x, h * 0.86);
  }
  c.lineTo(w, h);
  c.closePath();
  c.fill();
}

function drawSleeper(c: CanvasRenderingContext2D, x: number, y: number, r: number) {
  c.fillStyle = "rgba(180,188,224,0.22)";
  c.beginPath();
  c.ellipse(x - r * 0.75, y - r * 0.35, r * 0.6, r * 0.35, -0.5, 0, Math.PI * 2);
  c.ellipse(x + r * 0.75, y - r * 0.35, r * 0.6, r * 0.35, 0.5, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#3a4580";
  c.beginPath();
  c.arc(x, y, r * 0.55, 0, Math.PI * 2);
  c.fill();
  // Closed eyes.
  c.strokeStyle = "rgba(223,230,255,0.6)";
  c.lineWidth = Math.max(1.2, r * 0.07);
  c.lineCap = "round";
  for (const dx of [-0.2, 0.2]) {
    c.beginPath();
    c.arc(x + dx * r, y - r * 0.05, r * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
    c.stroke();
  }
}

function drawGlow(c: CanvasRenderingContext2D, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0) return;
  c.globalAlpha = Math.max(0, Math.min(1, alpha));
  const g = c.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, "rgba(253,230,138,0.95)");
  g.addColorStop(0.35, "rgba(251,191,36,0.45)");
  g.addColorStop(1, "rgba(251,191,36,0)");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r * 3, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fde68a";
  c.beginPath();
  c.arc(x, y, r * 0.75, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

/** Practice only: a soft ring around the lit firefly shows where to tap (show, do not tell). */
function drawHint(c: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, still: boolean) {
  const k = still ? 0.5 : (now % 1400) / 1400;
  c.strokeStyle = `rgba(253,230,138,${0.7 * (1 - k)})`;
  c.lineWidth = 3;
  c.beginPath();
  c.arc(x, y, r * (0.7 + 0.4 * k), 0, Math.PI * 2);
  c.stroke();
}

function drawPlay(c: CanvasRenderingContext2D, x: number, y: number, r: number, now: number, still: boolean) {
  const s = still ? 1 : 1 + 0.04 * Math.sin(now / 500);
  c.fillStyle = "#fbbf24";
  c.beginPath();
  c.arc(x, y, r * s, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#1f1400";
  c.beginPath();
  c.moveTo(x - r * 0.28, y - r * 0.4);
  c.lineTo(x + r * 0.45, y);
  c.lineTo(x - r * 0.28, y + r * 0.4);
  c.closePath();
  c.fill();
}

function drawLuma(c: CanvasRenderingContext2D, x: number, y: number, s: number, now: number, still: boolean, happy: boolean) {
  const bob = still ? 0 : Math.sin(now / (happy ? 180 : 700)) * (happy ? 6 : 3) * s;
  c.save();
  c.translate(x, y + bob);
  c.scale(s, s);
  // Wings.
  c.fillStyle = "rgba(199,210,254,0.8)";
  c.beginPath();
  c.ellipse(-16, -30, 15, 9, -0.45, 0, Math.PI * 2);
  c.ellipse(16, -30, 15, 9, 0.45, 0, Math.PI * 2);
  c.fill();
  // Glow belly and body.
  c.fillStyle = "rgba(253,230,138,0.35)";
  c.beginPath();
  c.arc(0, 4, 26, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#4c5fb8";
  c.beginPath();
  c.arc(0, -16, 18, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#fbbf24";
  c.beginPath();
  c.arc(0, 4, 15, 0, Math.PI * 2);
  c.fill();
  // Eyes.
  for (const dx of [-6.5, 6.5]) {
    c.fillStyle = "#fff";
    c.beginPath();
    c.arc(dx, -18, 4, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#0b1430";
    c.beginPath();
    c.arc(dx + 0.7, -17.3, 1.9, 0, Math.PI * 2);
    c.fill();
  }
  // Smile and antennae.
  c.strokeStyle = "#fff";
  c.lineWidth = 2;
  c.lineCap = "round";
  c.beginPath();
  c.arc(0, -11, happy ? 5 : 3.5, 0.15 * Math.PI, 0.85 * Math.PI);
  c.stroke();
  c.strokeStyle = "#4c5fb8";
  c.beginPath();
  c.moveTo(-6, -32);
  c.quadraticCurveTo(-10, -44, -16, -46);
  c.moveTo(6, -32);
  c.quadraticCurveTo(10, -44, 16, -46);
  c.stroke();
  c.restore();
}

function drawBubble(c: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, s: number) {
  const size = Math.round(Math.max(16, Math.min(24, 18 * s)));
  c.font = `700 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const pad = size * 0.8;
  const lines = wrap(c, text, Math.max(140, maxW - pad * 2));
  const lh = size * 1.3;
  const bw = Math.min(maxW, Math.max(...lines.map((l) => c.measureText(l).width)) + pad * 2);
  const bh = lines.length * lh + pad * 1.4;
  const bx = x;
  const by = y - bh;
  c.fillStyle = "rgba(255,255,255,0.95)";
  roundRect(c, bx, by, bw, bh, size * 0.9);
  c.fill();
  c.beginPath();
  c.moveTo(bx + 14, by + bh - 2);
  c.lineTo(bx - 4, by + bh + 14);
  c.lineTo(bx + 32, by + bh - 2);
  c.fill();
  c.fillStyle = "#1f1b3a";
  c.textBaseline = "top";
  lines.forEach((l, k) => c.fillText(l, bx + pad, by + pad * 0.7 + k * lh));
}

function wrap(c: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    const test = line ? `${line} ${word}` : word;
    if (c.measureText(test).width > maxW && line) {
      out.push(line);
      line = word;
    } else line = test;
  }
  if (line) out.push(line);
  return out;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
