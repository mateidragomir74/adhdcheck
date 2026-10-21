// Lantern Watch in 3D (three.js), on the same river, bridge and Luma as Bridge Wait. Browser only: imported
// lazily by mount.ts.
//
// Timing (research/03 section 2.3 item 4): one requestAnimationFrame loop. Each callback first calls
// runner.frame(ts); when a stimulus is due, the runner calls onStimulus inside that call, which lights the
// lantern and places the firefly or the moth; the same callback then renders, so ts is the onset of the frame
// that first draws it. Responses come from a native pointerdown listener on the game root
// (event.timeStamp, never click).
import {
  Color,
  CylinderGeometry,
  DataTexture,
  DirectionalLight,
  Fog,
  HemisphereLight,
  type Material,
  Mesh,
  MeshToonMaterial,
  NearestFilter,
  PerspectiveCamera,
  PointLight,
  type PointsMaterial,
  type Float32BufferAttribute,
  RedFormat,
  Scene,
  Vector3,
  WebGLRenderer,
  type Group,
} from "three";
import type { SessionMetrics } from "@adhdcheck/contracts";
import { buildDeviceInfo } from "@adhdcheck/sensors";
import { GameAudio } from "../bridge-wait/audio";
import { buildLuma, makeOutlineMaterial, outline, type LumaRig } from "../bridge-wait/luma";
import { Particles } from "../bridge-wait/scene";
import { WATER_Y, buildWorld, type World } from "../bridge-wait/world";
import { isPrimaryPointer } from "../../pointer";
import { CreatureView, endStimulus, startStimulus, syncCreatures } from "./creature";
import { forwardPointerDown } from "./input";
import { estimateRefreshHz, hitRadius, normalizePointerType, type PointerKind, type TaskConfig } from "./logic";
import { buildFirefly, buildLanterns, buildMoth, GLASS_OFF, GO_GLASS, GO_HALO, NOGO_GLASS, NOGO_HALO, type Lantern } from "./props";
import { LanternWatchRunner, type ActiveTrial, type RunData, type RunState } from "./runner";
import { buildSessionMetrics } from "./session";
import { STRINGS } from "./strings";
import { buildUi } from "./ui";

export interface SceneOptions {
  seed: number;
  task: TaskConfig;
  childId: string;
  anticipationMs: number | null;
  assetBase: string;
  autoStart: boolean;
  /** Created and resumed by the play page inside its start tap; the game uses it instead of making its own. */
  audioContext?: AudioContext;
  onComplete?: (metrics: SessionMetrics) => void;
  /** Called once, in a frame, when the first calibration hit is recorded: from then on endEarly() yields valid metrics. */
  onCanEndEarly?: () => void;
  /** endEarly() was called but nothing valid can be built (no calibration firefly tapped yet): no metrics. */
  onUnusable?: () => void;
  onError?: (err: unknown) => void;
}

/** Celebration shown before the session is handed back to the page. TODO: design choice. */
export const CELEBRATE_MS = 3500;
const FLIGHT_MS = 620;
const LIGHT_ON = 4.2;
const FIREFLY_SCALE = 1.55;

/** Luma sits on a big lily pad in the near river, front left, watching the lanterns. Portrait: closer to the
 * middle and nearer the camera, so Luma stays whole on a narrow screen and fills the lower half. */
const LUMA_LANDSCAPE = new Vector3(-1.95, WATER_Y + 0.05, 2.5);
const LUMA_PORTRAIT = new Vector3(-1.05, WATER_Y + 0.05, 3.6);
const MOTH_SCALE = 0.74;
const VIEW_DIR = new Vector3(0, 0.34, 1).normalize();

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3);
const easeInOut = (t: number) => {
  const x = Math.min(Math.max(t, 0), 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};

function uuidV4(): string {
  const c = globalThis.crypto;
  if (typeof c.randomUUID === "function") return c.randomUUID();
  // Non-secure context (for example a tablet on a LAN address): RFC 9562 version 4 from getRandomValues.
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = ((b[6] as number) & 0x0f) | 0x40;
  b[8] = ((b[8] as number) & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

type LumaMode = "idle" | "wave" | "talk" | "hop" | "celebrate" | "rest";

export function createLanternWatchScene(parent: HTMLElement, opts: SceneOptions): { destroy: () => void; endEarly: () => void } {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const owner = Math.random().toString(36).slice(2);
  parent.dataset.lwOwner = owner;
  const ui = buildUi(parent);
  const audio = new GameAudio(opts.assetBase, opts.audioContext);
  audio.prefetch();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    audio.close();
    ui.destroy();
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  ui.root.prepend(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new Scene();
  scene.fog = new Fog(0x8e68b4, 26, 75);
  const camera = new PerspectiveCamera(38, 1, 0.1, 200);

  const grad = new DataTexture(new Uint8Array([95, 165, 220, 255]), 4, 1, RedFormat);
  grad.minFilter = grad.magFilter = NearestFilter;
  grad.needsUpdate = true;
  const outlineMat = makeOutlineMaterial();

  scene.add(new HemisphereLight(0xc4ccff, 0x4a3a6e, 2.1));
  const moonLight = new DirectionalLight(0xfff0dc, 2.2);
  moonLight.position.set(-6, 10, 8);
  scene.add(moonLight);
  const rim = new DirectionalLight(0xff9ec8, 0.8);
  rim.position.set(8, 4, -6);
  scene.add(rim);

  const world: World = buildWorld(scene, grad, outlineMat, { postLamps: false });
  const lanterns: Lantern[] = buildLanterns(grad, outlineMat, world.glow);
  for (const l of lanterns) scene.add(l.root);
  const lampLight = new PointLight(0xffc457, 0, 6, 2);
  scene.add(lampLight);

  // Luma's lily pad.
  const pad = new Mesh(new CylinderGeometry(1, 1, 0.06, 28, 1, false, 0.5, Math.PI * 2 - 0.7), new MeshToonMaterial({ color: new Color(0x3fae6a), gradientMap: grad }));
  pad.scale.set(0.85, 1, 0.72);
  const lumaPos = LUMA_LANDSCAPE.clone();
  const placePad = () => pad.position.set(lumaPos.x, WATER_Y + 0.02, lumaPos.z);
  placePad();
  pad.rotation.y = 0.6;
  outline(pad, outlineMat, 1.03);
  scene.add(pad);

  const luma: LumaRig = buildLuma(grad, outlineMat);
  luma.root.scale.setScalar(0.92);
  scene.add(luma.root);

  const firefly = buildFirefly(outlineMat, world.glow);
  firefly.root.visible = false;
  scene.add(firefly.root);
  const moth = buildMoth(grad, outlineMat);
  moth.root.visible = false;
  scene.add(moth.root);

  const sparkles = new Particles(160, 0.22, world.glow);
  const fireworks = new Particles(800, 0.62, world.glow);
  scene.add(sparkles.points, fireworks.points);
  const SPARK = [new Color(0xffffff), new Color(0xfff0a8), new Color(0xfff27a)];
  const FIRE = [new Color(0xffd66b), new Color(0xfff27a), new Color(0x8ff0d8), new Color(0xffb05a), new Color(0xd2ff8a)];
  const WHITE = new Color(0xffffff);

  // ---- visual state (never used for measurement) ----
  let mode: LumaMode = "wave";
  let modeStart = 0;
  let lastState: RunState = "intro";
  let lit: { lantern: number; type: ActiveTrial["type"]; start: number } | null = null;
  let flight: { from: Vector3; start: number } | null = null;
  const creature = new CreatureView();
  const showCreatures = () => syncCreatures(creature, moth.root, firefly.root);
  let handTarget: { lantern: number; mode: "press" | "hold" } | null = null;
  let decorTarget = 1;
  let decorLevel = 0;
  let nextFirework = 0;
  let happyUntil = 0;
  let completeAt = -1;
  let canEndSignalled = false;
  let endRequested = false; // endEarly(): handled in the next frame, where the frame timestamp is known
  let endedEarly = false; // the result is handed back at once, with no celebration
  let metrics: SessionMetrics | null = null;
  let lastTs = 0;
  let raf = 0;
  let lost = false;
  let destroyed = false;
  let pointerKind: PointerKind | null = null;
  const intervals: number[] = [];

  const setMode = (m: LumaMode, ts: number) => {
    mode = m;
    modeStart = ts;
  };

  const lanternOff = (k: number) => {
    const l = lanterns[k];
    if (!l) return;
    l.glass.color.copy(GLASS_OFF);
    l.halo.opacity = 0;
  };

  const light = (trial: ActiveTrial, ts: number) => {
    const l = lanterns[trial.lantern] as Lantern;
    const go = trial.type !== "nogo";
    l.glass.color.copy(go ? GO_GLASS : NOGO_GLASS);
    l.halo.color.copy(go ? GO_HALO : NOGO_HALO);
    l.halo.opacity = go ? 1 : 0.95;
    lampLight.color.copy(go ? GO_HALO : NOGO_HALO);
    lampLight.intensity = go ? LIGHT_ON : LIGHT_ON * 0.55;
    lampLight.position.set(l.centre.x, l.centre.y + 0.2, l.centre.z + 0.9);
    lit = { lantern: trial.lantern, type: trial.type, start: ts };
    if (go) {
      flight = null;
      firefly.root.position.set(l.centre.x, l.centre.y - 0.02, l.centre.z + 0.62);
      firefly.root.scale.setScalar(FIREFLY_SCALE);
    } else {
      // Smaller than the glass, low on its front, so the blue glow stays visible around the moth.
      moth.root.position.set(l.centre.x, l.centre.y - 0.08, l.centre.z + 0.42);
      moth.root.scale.setScalar(MOTH_SCALE);
    }
    startStimulus(creature, trial.type, moth.root, firefly.root); // a firefly still flying to Luma finishes its flight
  };

  const unlight = () => {
    if (!lit) return;
    lanternOff(lit.lantern);
    lampLight.intensity = 0;
    // The creature is gone in this very frame: stimulus_ms is the time it is shown (see creature.ts).
    endStimulus(creature, moth.root, firefly.root);
    lit = null;
  };

  const lumaHead = () => new Vector3(lumaPos.x, lumaPos.y + 1.55, lumaPos.z);

  let built: RunData | null = null;
  const runner = new LanternWatchRunner(
    { task: opts.task, seed: opts.seed, anticipationMs: opts.anticipationMs },
    {
      onState: (s, ts) => {
        lastState = s;
        parent.dataset.phase = s;
        switch (s) {
          case "calib-intro":
            ui.play(true); // the instruction stays until the child taps (no timer)
            ui.say(STRINGS.calibIntro);
            decorTarget = 0;
            setMode("talk", ts);
            audio.babble(1800);
            break;
          case "practice-intro":
            ui.play(true);
            ui.say(STRINGS.practiceIntro);
            setMode("talk", ts);
            audio.babble(1800);
            break;
          case "block-intro":
            ui.play(runner.waitsForReady()); // block 1 waits for a tap; "Here we go again!" does not
            ui.say(runner.blockIndex === 0 ? STRINGS.realIntro : STRINGS.again);
            decorTarget = 0;
            setMode("hop", ts);
            audio.play("ready", 0.55);
            break;
          case "calib-practice":
          case "calib":
          case "practice":
          case "trials":
            ui.say(null);
            setMode("idle", ts);
            break;
          case "break":
            ui.say(STRINGS.rest);
            decorTarget = 1;
            setMode("rest", ts);
            break;
          case "done":
            ui.say(STRINGS.done);
            audio.play("done", 0.7);
            decorTarget = 1;
            nextFirework = ts + 300;
            setMode("celebrate", ts);
            break;
          default:
            break;
        }
      },
      onStimulus: (ts, trial) => {
        // Inside runner.frame(ts): drawn by the render call of this same callback.
        light(trial, ts);
        parent.dataset.stim = trial.type;
        parent.dataset.lantern = String(trial.lantern);
        // Practice: the hand taps fireflies only. On a moth no hand at all (a hand near it reads as "tap it").
        if (trial.phase === "practice" && trial.type !== "nogo") handTarget = { lantern: trial.lantern, mode: "press" };
        else handTarget = null;
      },
      onHide: () => {
        unlight();
        parent.dataset.stim = "";
        if (handTarget) handTarget = null;
      },
      onResponse: (_t, trial) => {
        if (trial.type === "nogo") return; // no reaction at all to a moth tap: no sound, no mark
        audio.chime(); // the same short chime for every caught firefly
        const l = lanterns[trial.lantern] as Lantern;
        sparkles.spawn(new Vector3(l.centre.x, l.centre.y, l.centre.z + 0.5), 18, SPARK, 1.8, 600, -1.5);
        flight = { from: firefly.root.position.clone(), start: lastTs };
        creature.caught();
        handTarget = null;
      },
      onBreakReady: () => ui.play(true),
      onComplete: (data) => {
        built = data;
      },
    },
  );
  parent.dataset.phase = "intro";
  if (!opts.autoStart) {
    ui.say(STRINGS.start);
    ui.play(true);
  }

  // ---- geometry of the lanterns on screen (hit test, hand) ----
  let viewW = 1;
  let viewH = 1;
  const screen: { x: number; y: number; r: number }[] = lanterns.map(() => ({ x: 0, y: 0, r: 40 }));
  const tmp = new Vector3();
  const updateScreen = () => {
    for (let k = 0; k < lanterns.length; k++) {
      const c = (lanterns[k] as Lantern).centre;
      tmp.set(c.x, c.y, c.z).project(camera);
      const x = ((tmp.x + 1) / 2) * viewW;
      const y = ((1 - tmp.y) / 2) * viewH;
      tmp.set(c.x, c.y + 0.75, c.z).project(camera);
      const r = Math.abs(((1 - tmp.y) / 2) * viewH - y);
      const s = screen[k] as { x: number; y: number; r: number };
      s.x = x;
      s.y = y + r * 0.1; // the target zone reaches a little below the glass, over the stand
      s.r = r;
    }
    // At least 34 px (a 68 px target), never overlapping: see hitRadius in logic.ts.
    const a = screen[0] as { x: number };
    const b = screen[1] as { x: number };
    const gap = Math.abs(b.x - a.x);
    for (const s of screen) s.r = hitRadius(s.r, gap);
    // For end-to-end checks (Playwright): lantern centres and hit radii in CSS px.
    parent.dataset.lanterns = screen.map((s) => `${s.x.toFixed(0)},${s.y.toFixed(0)},${s.r.toFixed(0)}`).join(";");
  };
  const hitLantern = (x: number, y: number): number | null => {
    let best: number | null = null;
    let bestD = Infinity;
    screen.forEach((s, k) => {
      const d = Math.hypot(x - s.x, y - s.y);
      if (d <= s.r && d < bestD) {
        best = k;
        bestD = d;
      }
    });
    return best;
  };

  const onDown = (e: PointerEvent) => {
    if (!isPrimaryPointer(e)) return; // a second finger is not a response
    audio.unlock(); // inside the gesture: required by iOS Safari
    if (runner.waitsForReady()) {
      // Only the Start button leaves an instruction: a tap elsewhere, or the second tap of a double tap, does nothing.
      if (ui.playHit(e.clientX, e.clientY) && runner.ready(e.timeStamp) === "ready") {
        ui.play(false);
        audio.play("start", 0.6);
      }
      return;
    }
    const r = ui.root.getBoundingClientRect();
    const state = runner.state;
    if (pointerKind === null && (state === "calib" || state === "trials")) {
      pointerKind = normalizePointerType(e.pointerType, window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "mouse");
    }
    const kind = forwardPointerDown(e, r, runner, hitLantern);
    if (kind === "start" || kind === "continue") {
      ui.play(false);
      audio.play("start", 0.6);
    }
  };
  const noMenu = (e: Event) => e.preventDefault();
  ui.root.addEventListener("pointerdown", onDown);
  ui.root.addEventListener("contextmenu", noMenu);

  const onLost = (e: Event) => {
    e.preventDefault();
    lost = true;
  };
  const onRestored = () => {
    lost = false;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  const target = new Vector3();
  let camBase = new Vector3();
  const fit = () => {
    const w = Math.max(1, ui.root.clientWidth);
    const h = Math.max(1, ui.root.clientHeight);
    viewW = w;
    viewH = h;
    const aspect = w / h;
    const portrait = aspect < 1;
    lumaPos.copy(portrait ? LUMA_PORTRAIT : LUMA_LANDSCAPE);
    placePad();
    camera.fov = portrait ? 52 : 40;
    const halfW = portrait ? 2.45 : 3.9;
    const tanH = Math.tan((camera.fov * Math.PI) / 360);
    const d = Math.max(7.5, halfW / (tanH * aspect));
    camera.aspect = aspect;
    // Aim between the lanterns and Luma, so both stay in view; portrait aims higher to leave sky on top.
    target.set(0, portrait ? 1.9 : 1.25, 0.9);
    camera.position.copy(target).addScaledVector(VIEW_DIR, d);
    if (portrait) camera.position.y -= 0.6;
    camBase = camera.position.clone();
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    if (scene.fog instanceof Fog) {
      scene.fog.near = d + 14;
      scene.fog.far = d + 70;
    }
    renderer.setSize(w, h, false);
    updateScreen();
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(ui.root);

  const poseLuma = (ts: number) => {
    const t = ts - modeStart;
    let lift = 0;
    let sy = 1;
    let sx = 1;
    const turn = 0.32; // facing the lanterns, a little to the right
    let flap = 0;
    let armL = 0;
    let armR = 0;
    let talking = false;
    if ((mode === "hop" || mode === "celebrate") && !reduced) {
      const period = mode === "celebrate" ? 720 : 620;
      const p = (t % period) / period;
      const air = p < 0.6 ? p / 0.6 : -1;
      if (air >= 0) {
        lift = (mode === "celebrate" ? 0.5 : 0.28) * 4 * air * (1 - air);
        const s = Math.sin(Math.PI * air);
        sy = 1 + 0.16 * s;
        sx = 1 - 0.08 * s;
      } else {
        const q = (p - 0.6) / 0.4;
        const sq = Math.sin(q * Math.PI) * 0.2;
        sy = 1 - sq;
        sx = 1 + sq * 0.7;
      }
      armL = armR = mode === "celebrate" ? 1.6 + Math.sin(ts * 0.012) * 0.3 : 0.8;
      flap = Math.sin(ts * 0.05) * 0.5;
      if (mode === "hop" && t > 1250) setMode("idle", ts);
    } else {
      sy = 1 + 0.018 * Math.sin(ts * 0.0032);
      sx = 1 - 0.009 * Math.sin(ts * 0.0032);
      if (mode === "celebrate" || mode === "hop") armL = armR = 1.4;
      if (mode === "wave") {
        armR = 2.1 + (reduced ? 0 : Math.sin(ts * 0.011) * 0.45);
        if (!reduced) flap = Math.sin(ts * 0.004) * 0.12;
      }
      if (mode === "talk") {
        talking = t < 2000;
        lift = talking ? Math.abs(Math.sin(ts * 0.0105)) * 0.05 : 0;
        armL = armR = talking ? 0.35 + Math.sin(ts * 0.007) * 0.2 : 0;
      }
      if (mode === "rest") {
        sy = 1 + 0.03 * Math.sin(ts * 0.0016);
        sx = 1 - 0.015 * Math.sin(ts * 0.0016);
      }
    }
    // A small happy bounce when a firefly arrives (identical every time, no tally).
    if (ts < happyUntil && !reduced) {
      const k = 1 - (happyUntil - ts) / 420;
      lift += 0.16 * Math.sin(Math.PI * k);
      armL = armR = Math.max(armL, 1.2 * Math.sin(Math.PI * k));
    }
    luma.root.position.set(lumaPos.x, lumaPos.y + lift, lumaPos.z);
    luma.root.rotation.y = turn;
    luma.squash.scale.set(sx, sy, sx);
    (luma.arms[0] as Group).rotation.z = -armL;
    (luma.arms[1] as Group).rotation.z = armR;
    (luma.wings[0] as Group).rotation.y = flap;
    (luma.wings[1] as Group).rotation.y = -flap;
    for (const a of luma.antennae) a.rotation.z = Math.sin(ts * 0.004 + a.position.x * 9) * 0.05 - lift * 0.4;
    luma.mouth.visible = talking;
    luma.smile.visible = !talking;
    if (talking) luma.mouth.scale.set(0.075, 0.025 + 0.045 * Math.abs(Math.sin(ts * 0.021)), 0.03);
    const blink = ts % 3400 < 120 ? 0.12 : 1;
    let eyeY = mode === "rest" ? Math.min(blink, 0.45) : blink;
    if (ts < happyUntil || mode === "celebrate") eyeY = Math.min(eyeY, 0.55);
    for (const e of luma.eyes) e.scale.y = eyeY;
    world.shadow.position.set(lumaPos.x, WATER_Y + 0.06, lumaPos.z + 0.05);
    world.shadow.scale.setScalar(1.3 * (1 - Math.min(lift, 0.6) * 0.6));
  };

  const head = new Vector3();
  const frame = (ts: number) => {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (lost) return;
    const dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
    if (lastTs && intervals.length < 4000) intervals.push(ts - lastTs);
    lastTs = ts;

    // 1. Measurement state machine. May light a lantern for this very frame.
    runner.frame(ts);
    if (!canEndSignalled && runner.canEndEarly()) {
      canEndSignalled = true;
      opts.onCanEndEarly?.();
    }
    if (endRequested) {
      endRequested = false;
      const partial = built || metrics ? null : runner.endEarly(ts);
      if (partial) {
        built = partial;
        endedEarly = true;
      } else if (!built && !metrics) {
        opts.onUnusable?.();
      } else if (completeAt >= 0) {
        completeAt = ts; // already finished and celebrating: hand the result back now
      }
    }
    ui.playEnabled(!runner.waitsForReady() || runner.canReady(ts));
    if (built && !metrics) {
      try {
        const data = built as RunData;
        const hz = estimateRefreshHz(intervals);
        if (hz === null) throw new Error("no frame interval measured");
        metrics = buildSessionMetrics({
          sessionId: uuidV4(),
          childId: opts.childId,
          startedAt: new Date(performance.timeOrigin + data.t0).toISOString(),
          durationMs: data.duration_ms,
          task: opts.task,
          device: buildDeviceInfo({
            userAgent: navigator.userAgent,
            pointerType: pointerKind ?? (window.matchMedia?.("(pointer: coarse)").matches ? "touch" : "mouse"),
            screenW: window.screen.width,
            screenH: window.screen.height,
            devicePixelRatio: window.devicePixelRatio || 1,
            estRefreshHz: hz,
            crossOriginIsolated: window.crossOriginIsolated === true,
          }),
          trials: data.trials,
          offTargetTaps: data.off_target_taps,
        });
        completeAt = endedEarly ? ts : ts + CELEBRATE_MS;
      } catch (err) {
        built = null;
        opts.onError?.(err);
      }
    }
    if (metrics && completeAt >= 0 && ts >= completeAt) {
      completeAt = -1;
      opts.onComplete?.(metrics);
    }

    // 2. Visuals.
    if (lit) {
      const l = lanterns[lit.lantern] as Lantern;
      const k = (ts - lit.start) * 0.007;
      l.haloSprite.scale.setScalar(2.3 + Math.sin(k) * 0.08);
      if (lit.type !== "nogo" && !flight) {
        firefly.root.position.y = l.centre.y + Math.sin(ts * 0.009) * 0.05;
      }
    }
    const wingBeat = reduced ? 0.3 : Math.sin(ts * 0.08) * 0.6;
    for (const [k, w] of firefly.wings.entries()) w.rotation.y = (k ? -1 : 1) * wingBeat;
    const mothFlap = reduced ? 0 : (Math.sin(ts * 0.004) * 0.5 + 0.5) * 0.35;
    (moth.wings[0] as Group).rotation.y = mothFlap;
    (moth.wings[1] as Group).rotation.y = -mothFlap;

    if (flight) {
      const k = Math.min((ts - flight.start) / FLIGHT_MS, 1);
      const e = easeInOut(k);
      const to = lumaHead();
      firefly.root.position.lerpVectors(flight.from, to, e);
      firefly.root.position.y += Math.sin(Math.PI * k) * 0.9;
      firefly.root.scale.setScalar(FIREFLY_SCALE * (1 - 0.5 * e));
      if (k >= 1) {
        flight = null;
        creature.landed();
        showCreatures();
        sparkles.spawn(to, 22, SPARK, 2.0, 700, -2.0);
        happyUntil = ts + 420;
        audio.play("sparkle", 0.4);
      }
    }
    poseLuma(ts);

    // Decorative fireflies: only outside the measured trial loop.
    decorLevel += (decorTarget - decorLevel) * Math.min(1, dt / 350);
    const ffMat = world.fireflies.material as PointsMaterial;
    ffMat.opacity = decorLevel * 0.95;
    world.fireflies.visible = decorLevel > 0.01;
    if (world.fireflies.visible && !reduced) {
      const attr = world.fireflies.geometry.getAttribute("position") as Float32BufferAttribute;
      const b = world.fireflyBase;
      for (let i = 0; i < b.length / 3; i++) {
        attr.setXYZ(
          i,
          (b[i * 3] as number) + Math.sin(ts * 0.0006 + i) * 0.5,
          (b[i * 3 + 1] as number) + Math.sin(ts * 0.0011 + i * 2.1) * 0.3,
          (b[i * 3 + 2] as number) + Math.cos(ts * 0.0007 + i * 1.3) * 0.4,
        );
      }
      attr.needsUpdate = true;
    }

    if (lastState === "done" && !reduced && ts >= nextFirework) {
      nextFirework = ts + 520 + Math.random() * 300;
      for (let b = 0; b < 2; b++) {
        tmp.set((Math.random() - 0.5) * 6, 3.0 + Math.random() * 1.2, -0.6 - Math.random());
        const c = FIRE[Math.floor(Math.random() * FIRE.length)] as Color;
        fireworks.spawn(tmp, 40, [c, c, WHITE], 4.0, 1500, -0.9, true);
      }
    }
    sparkles.update(dt);
    fireworks.update(dt);
    world.water.offset.y = (ts * 0.000012) % 1;

    // Gentle camera drift only on the start, break and end screens.
    const drift = !reduced && (lastState === "intro" || lastState === "done" || lastState === "break");
    const wantX = drift ? camBase.x + Math.sin(ts * 0.00025) * 0.3 : camBase.x;
    if (Math.abs(camera.position.x - wantX) > 0.0005) {
      camera.position.x = drift ? wantX : camBase.x + (camera.position.x - camBase.x) * 0.9;
      if (!drift && Math.abs(camera.position.x - camBase.x) < 0.001) camera.position.x = camBase.x;
      camera.lookAt(target);
      updateScreen();
    }

    // Practice hand on the lit lantern; bubble above Luma.
    if (handTarget) {
      const s = screen[handTarget.lantern] as { x: number; y: number; r: number };
      ui.hand(handTarget.mode, s.x, s.y + (handTarget.mode === "hold" ? s.r * 0.9 : 0));
    } else ui.hand("off");
    head.copy(lumaHead()).project(camera);
    ui.place(((head.x + 1) / 2) * viewW, ((1 - head.y) / 2) * viewH - 10);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  // The play page already took the start tap, so the first frame moves on to the calibration intro.
  if (opts.autoStart) runner.pointerDown(performance.now(), 0, 0, null);

  return {
    endEarly: () => {
      endRequested = true;
    },
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ui.root.removeEventListener("pointerdown", onDown);
      ui.root.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      audio.close();
      const mats = new Set<Material>();
      scene.traverse((o) => {
        const m = o as Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = (m as { material?: Material | Material[] }).material;
        if (Array.isArray(mat)) mat.forEach((x) => mats.add(x));
        else if (mat) mats.add(mat);
      });
      mats.forEach((m) => {
        (m as { map?: { dispose(): void } | null }).map?.dispose();
        m.dispose();
      });
      grad.dispose();
      world.glow.dispose();
      world.water.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      ui.destroy();
      // React StrictMode mounts twice in development: only the instance that wrote the dataset last clears it.
      if (parent.dataset.lwOwner === owner) {
        delete parent.dataset.phase;
        delete parent.dataset.stim;
        delete parent.dataset.lantern;
        delete parent.dataset.lanterns;
        delete parent.dataset.lwOwner;
      }
    },
  };
}

