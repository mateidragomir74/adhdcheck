// Route Planner in 3D (three.js). Browser only: imported lazily by mount.ts. Same night river, Luma and toon style as
// Bridge Wait and Treasure Choice (world.ts, luma.ts, audio.ts and Particles are imported from Bridge Wait).
//
// The board: 5 x 5 squares on the river in front of the bridge. An open square is a lily pad, a blocked square a
// mossy rock, a seed is a glowing seed in a lotus on its pad. Luma hops one pad per tap.
//
// Timing (research/03 section 2), as in the other mini-games: one requestAnimationFrame loop. Each callback first
// calls runner.frame(ts); when a board is due, the runner calls onBoard inside that call, which builds the whole
// board (every pad, rock and seed at full size, no fade-in); the same callback then renders, so ts is the onset of
// the frame that first draws the board. Taps come from a native pointerdown listener on the game container
// (event.timeStamp, never click); the scene only finds which square is under the finger (board3d.pickCell).
//
// Calm design (adhdcheck-dev skill): while the child plans nothing on the board moves; only Luma, after a tap.
// Every landing looks and sounds the same, a rock tapped next to Luma only wobbles, and no move count, best route
// or score is ever shown. The practice board alone has the animated hand on the next pad of a fewest-moves route.
import {
  AdditiveBlending,
  BufferGeometry,
  Color,
  DataTexture,
  Float32BufferAttribute,
  Points,
  PointsMaterial,
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  type Material,
  type Mesh,
  type MeshBasicMaterial,
  NearestFilter,
  PerspectiveCamera,
  RedFormat,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { GameAudio } from "../bridge-wait/audio";
import { mulberry32 } from "../bridge-wait/logic";
import { buildLuma, makeOutlineMaterial, type LumaRig } from "../bridge-wait/luma";
import { Particles } from "../bridge-wait/scene";
import { WATER_Y, buildWorld, type World } from "../bridge-wait/world";
import { isPrimaryPointer } from "../../pointer";
import { PadTones } from "./audio";
import { PAD_TOP_Y, ROW0_Z, SPACING, cellWorld, fitBoardCamera, minCellPx, padCornersWorld, pickCell, toScreen } from "./board3d";
import { COLS, ROWS, hintStep, neighbours, same } from "./logic";
import { SEED_GOLD, buildFarBank, buildKit, buildPad, buildReachRing, buildRiverside, buildRock, buildSeed, disposeKit, type Pad, type Seed } from "./props";
import { RoutePlannerRunner, type Board, type RunState } from "./runner";
import { STRINGS, betweenLine } from "./strings";
import type { Cell, RoutePlannerResult } from "./types";
import { buildUi } from "./ui";

export interface SceneOptions {
  assetBase: string;
  onComplete?: (result: RoutePlannerResult) => void;
}

const LUMA_SCALE = 0.56;
/** Luma is drawn bigger on the start and end screens, where it is the only thing to look at. */
const LUMA_TITLE_SCALE = 0.85;
const HOP_MS = 270;
const HOP_FAST_MS = 180;
const ARRIVE_MS = 460;
const LIFT_MS = 480;
/** After a board ends: when the board starts sinking (ms into the between pause), solved or not. */
const SINK_SOLVED_MS = 1000;
const SINK_UNSOLVED_MS = 700;
const SINK_MS = 450;

const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 3);
const easeInOut = (t: number) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const key = (c: Cell) => `${c.c},${c.r}`;

type LumaMode = "hover" | "stand" | "wave" | "celebrate";

interface Tween {
  from: Vector3;
  to: Vector3;
  start: number;
  dur: number;
  arc: number;
  /** The square Luma lands on, null for a flight that does not end on a pad (lift to hover). */
  cell: Cell | null;
  seed: boolean;
  kind: "hop" | "arrive" | "lift";
}

interface Flight {
  seed: Seed;
  from: Vector3;
  start: number;
}

export function createRoutePlannerScene(parent: HTMLElement, opts: SceneOptions): { destroy: () => void } {
  const reduced = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const ui = buildUi(parent);
  // React StrictMode mounts twice in development and the discarded scene is destroyed after the kept one has
  // started (ledger G6): only the scene that wrote the data attributes last may clear them.
  const owner = `rp${Math.random().toString(36).slice(2, 9)}`;
  parent.dataset.rpOwner = owner;
  const audio = new GameAudio(opts.assetBase);
  audio.prefetch();
  const tones = new PadTones();

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  } catch (err) {
    // No WebGL: remove the DOM and audio this function already created, so the caller can show its fallback.
    audio.close();
    tones.close();
    ui.destroy();
    throw err;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  ui.root.prepend(renderer.domElement);
  const canvas = renderer.domElement;

  const scene = new Scene();
  scene.fog = new Fog(0x8e68b4, 26, 75);
  const camera = new PerspectiveCamera(34, 1, 0.1, 200);

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

  // The Bridge Wait valley without its decorative lily pads (they would read as pads to tap).
  const world: World = buildWorld(scene, grad, outlineMat, { lilyPads: false });
  // Bridge lanterns: a steady, soft warm glow behind the board (decoration, never a cue), as in Treasure Choice.
  world.lanterns.glass.color.set(0xffe58a);
  world.lanterns.halo.opacity = 0.3;
  world.lanterns.reflection.opacity = 0.2;
  world.lanterns.light.intensity = 1.4;
  for (const h of world.lanterns.halos) h.scale.setScalar(1.4);

  const kit = buildKit(grad, outlineMat, world.glow);
  scene.add(buildRiverside(kit, mulberry32(77)), buildFarBank(kit, mulberry32(91), world.glow));
  const boardGroup = new Group();
  scene.add(boardGroup);
  const rings: Mesh[] = [];
  for (let k = 0; k < 4; k++) {
    const r = buildReachRing(kit);
    r.visible = false;
    rings.push(r);
    scene.add(r);
  }
  // Landing ripples on the water (a small pool, reused).
  const ripples: { mesh: Mesh; start: number }[] = [];
  for (let k = 0; k < 3; k++) {
    const m = buildReachRing(kit);
    m.material = kit.ringMat.clone();
    m.visible = false;
    scene.add(m);
    ripples.push({ mesh: m, start: -1 });
  }
  let rippleNext = 0;

  const luma: LumaRig = buildLuma(grad, outlineMat);
  luma.root.scale.setScalar(LUMA_SCALE);
  scene.add(luma.root);
  world.shadow.scale.setScalar(0.6);

  const sparkles = new Particles(200, 0.16, world.glow);
  const fireworks = new Particles(700, 0.5, world.glow);
  scene.add(sparkles.points, fireworks.points);
  const WHITE = new Color(0xffffff);
  const SPARK = [new Color(0xffffff), new Color(0xfff0a8), new Color(0xffd54d)];
  const FIRE = [new Color(0xffd66b), new Color(0xff8fc0), new Color(0x8ff0d8), new Color(0x9fc4ff), new Color(0xd2a8ff)];

  const centre = cellWorld({ c: (COLS - 1) / 2, r: (ROWS - 1) / 2 }, COLS, ROWS);
  const hoverPos = new Vector3(0, PAD_TOP_Y + 0.95, ROW0_Z + 1.2 * SPACING);

  // Fireflies over the river, only on the start and end screens (never while a board is up).
  const RIVER_FF = 40;
  const riverFfBase = new Float32Array(RIVER_FF * 3);
  {
    const rnd = mulberry32(31);
    for (let k = 0; k < RIVER_FF; k++) {
      riverFfBase[k * 3] = (rnd() - 0.5) * 5.2;
      riverFfBase[k * 3 + 1] = PAD_TOP_Y + 0.3 + rnd() * 1.6;
      riverFfBase[k * 3 + 2] = ROW0_Z - 1.2 + rnd() * 5.6;
    }
  }
  const riverFfGeo = new BufferGeometry();
  riverFfGeo.setAttribute("position", new Float32BufferAttribute(Array.from(riverFfBase), 3));
  const riverFf = new Points(
    riverFfGeo,
    new PointsMaterial({ map: world.glow, color: 0xe4ff9a, size: 0.26, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }),
  );
  scene.add(riverFf);

  // ---- board objects (rebuilt for every board; visual only, never used for measurement) ----
  const pads = new Map<string, Pad>();
  const rocks = new Map<string, { root: Group; wobble: number }>();
  const seeds = new Map<string, Seed>();
  const padDip = new Map<string, number>();
  const padGlow = new Map<string, number>();
  let perBoardMats: Material[] = [];
  let board: Board | undefined;
  let shown = false;

  // ---- Luma and animation state ----
  const lumaPos = hoverPos.clone();
  let mode: LumaMode = "wave";
  let modeStart = 0;
  let tween: Tween | null = null;
  const queue: { cell: Cell; seed: boolean }[] = [];
  let pendingArrive = false;
  let turn = 0;
  let lumaScale = LUMA_TITLE_SCALE;
  let turnTarget = 0;
  let landAt = -1;
  let hopCount = 0;
  let happyUntil = 0;
  const flights: Flight[] = [];
  let lastState: RunState = "intro";
  let solvedEnd = false;
  let celebrated = false;
  let sinkStart = -1;
  let waveAt = -1;
  let handCell: Cell | null = null;
  let fireflyTarget = 1;
  let fireflyLevel = 0;
  let nextFirework = 0;
  let lastTs = 0;
  let raf = 0;
  let lost = false;
  let destroyed = false;
  const tmp = new Vector3();
  const head = new Vector3();

  const setMode = (m: LumaMode, ts: number) => {
    mode = m;
    modeStart = ts;
  };

  const clearBoard = () => {
    boardGroup.clear();
    pads.clear();
    rocks.clear();
    seeds.clear();
    padDip.clear();
    padGlow.clear();
    for (const m of perBoardMats) m.dispose();
    perBoardMats = [];
    for (const r of rings) r.visible = false;
    boardGroup.position.y = 0;
    flights.length = 0;
  };

  /** Called inside runner.frame(ts): everything is at full size in this frame, the frame whose ts is the onset. */
  const drawBoard = (b: Board) => {
    // A sink still running from the last board (slow frames) must never reach this one.
    sinkStart = -1;
    clearBoard();
    const pz = b.puzzle;
    for (let r = 0; r < pz.rows; r++)
      for (let c = 0; c < pz.cols; c++) {
        const cell = { c, r };
        const at = cellWorld(cell, pz.cols, pz.rows, 0);
        const turnBy = ((c * 7 + r * 13) % 11) * 0.57; // fixed per square: every child sees the same board
        if (pz.rocks.some((x) => same(x, cell))) {
          const rock = buildRock(kit, turnBy);
          rock.position.copy(at);
          boardGroup.add(rock);
          rocks.set(key(cell), { root: rock, wobble: -1 });
          continue;
        }
        const pad = buildPad(kit, turnBy);
        pad.root.position.copy(at);
        boardGroup.add(pad.root);
        pads.set(key(cell), pad);
        perBoardMats.push(pad.top);
        if (pz.seeds.some((s) => same(s, cell)) && !b.taken.some((t) => same(t, cell))) {
          const s = buildSeed(kit);
          s.root.position.copy(at);
          boardGroup.add(s.root);
          seeds.set(key(cell), s);
          s.seed.traverse((o) => {
            const m = (o as Mesh).material as Material | undefined;
            if (m && m !== kit.seedMat && m !== kit.seedHalo && m !== kit.outlineMat) perBoardMats.push(m);
          });
        }
      }
    shown = true;
    board = b;
    parent.dataset.board = "1";
  };

  const lumaTummy = () => tmp.copy(lumaPos).setY(lumaPos.y + 0.64 * lumaScale).clone();

  const showRings = (b: Board | undefined) => {
    for (const r of rings) r.visible = false;
    if (!b || lastState !== "puzzle" || b.taken.length === b.puzzle.seeds.length) return;
    neighbours(b.puzzle, b.at).forEach((n, k) => {
      const ring = rings[k];
      if (!ring) return;
      ring.position.copy(cellWorld(n, b.puzzle.cols, b.puzzle.rows, PAD_TOP_Y + 0.012));
      ring.visible = true;
    });
  };

  /** Luma is on a pad with nothing queued: the reach rings and, in practice, the hand show where to tap. */
  const settle = () => {
    const b = board;
    showRings(b);
    handCell = b && b.practice && lastState === "puzzle" ? hintStep(b.puzzle, b.at, b.taken) : null;
    if (!handCell) ui.handAt(null);
  };

  const runner = new RoutePlannerRunner({
    onState: (s: RunState, ts: number, b: Board | undefined) => {
      lastState = s;
      parent.dataset.phase = s;
      parent.dataset.practice = b?.practice ? "1" : "0";
      parent.dataset.boardIndex = String(b?.index ?? "");
      switch (s) {
        case "practice-intro":
          ui.play(false);
          ui.say(STRINGS.practiceIntro);
          fireflyTarget = 0;
          setMode("hover", ts);
          break;
        case "puzzle":
          // The board itself is drawn in onBoard, in the next frame (its onset).
          ui.say(b?.practice ? STRINGS.practiceIntro : STRINGS.boardIntro);
          break;
        case "between": {
          solvedEnd = !!b && b.taken.length === b.puzzle.seeds.length;
          celebrated = false;
          // Solved: the line waits for the last seed to reach Luma (the celebration below), so it never shows
          // while a seed is still on the board. Not solved: the calm next-board line, at once.
          if (solvedEnd) ui.say(null);
          else ui.say(betweenLine(false));
          ui.handAt(null);
          handCell = null;
          for (const r of rings) r.visible = false;
          if (!solvedEnd) waveAt = ts + 150;
          sinkStart = ts + (solvedEnd ? SINK_SOLVED_MS : SINK_UNSOLVED_MS);
          break;
        }
        case "done":
          ui.say(STRINGS.done);
          audio.play("done", 0.7);
          fireflyTarget = 1;
          nextFirework = ts + 300;
          setMode("celebrate", ts);
          break;
        default:
          break;
      }
    },
    onBoard: (_ts, b) => {
      drawBoard(b);
      pendingArrive = true;
    },
    onMove: (_tMs, b, seedTaken) => {
      // From the pointerdown handler: the hop starts in the next frame.
      queue.push({ cell: { ...b.at }, seed: seedTaken });
      ui.handAt(null);
      handCell = null;
      for (const r of rings) r.visible = false;
    },
    onBlocked: (_tMs, cell) => {
      const rock = rocks.get(key(cell));
      if (rock) rock.wobble = -2; // started by the next frame
    },
    onComplete: (r) => opts.onComplete?.(r),
  });
  parent.dataset.phase = "intro";
  ui.say(STRINGS.start);
  ui.play(true);

  // ---- input ----
  const cellUnder = (clientX: number, clientY: number): Cell | null => {
    const b = runner.board;
    if (!b || !shown) return null;
    const r = canvas.getBoundingClientRect();
    const nx = ((clientX - r.left) / Math.max(1, r.width)) * 2 - 1;
    const ny = -((clientY - r.top) / Math.max(1, r.height)) * 2 + 1;
    return pickCell(camera, nx, ny, b.puzzle.cols, b.puzzle.rows);
  };
  const onDown = (e: PointerEvent) => {
    if (!isPrimaryPointer(e)) return; // a second finger is not a response
    audio.unlock(); // inside the gesture: required by iOS Safari
    tones.unlock();
    const kind = runner.pointerDown(e.timeStamp, cellUnder(e.clientX, e.clientY));
    if (kind === "start") audio.play("start", 0.6);
  };
  const noMenu = (e: Event) => e.preventDefault();
  ui.root.addEventListener("pointerdown", onDown);
  ui.root.addEventListener("contextmenu", noMenu);

  const onLost = (e: Event) => {
    e.preventDefault(); // allows the context to be restored
    lost = true;
  };
  const onRestored = () => {
    lost = false;
  };
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);

  // ---- layout ----
  let viewW = 1;
  let viewH = 1;
  let boardTopPx = 0;
  const camBase = new Vector3();
  const fit = () => {
    viewW = Math.max(1, ui.root.clientWidth);
    viewH = Math.max(1, ui.root.clientHeight);
    fitBoardCamera(camera, viewW, viewH, COLS, ROWS);
    camBase.copy(camera.position);
    const d = camera.position.distanceTo(centre);
    // Twilight haze just beyond the board: the bridge softens a little and the river upstream fades into the dusk.
    if (scene.fog instanceof Fog) {
      scene.fog.near = d + 2.5;
      scene.fog.far = d + 24;
    }
    renderer.setSize(viewW, viewH, false);
    boardTopPx = Math.min(...padCornersWorld(COLS, ROWS).map((p) => toScreen(camera, p, viewW, viewH).y));
    // For the harness and the screenshot check: screen centre of every square (row by row) and the smallest
    // distance between neighbouring squares, in CSS px. Layout only, no measurement data.
    const cells: number[][] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = toScreen(camera, cellWorld({ c, r }, COLS, ROWS), viewW, viewH);
        cells.push([Math.round(p.x), Math.round(p.y)]);
      }
    parent.dataset.cells = JSON.stringify(cells);
    parent.dataset.cellPx = minCellPx(camera, viewW, viewH, COLS, ROWS).toFixed(1);
  };
  fit();
  const ro = new ResizeObserver(fit);
  ro.observe(ui.root);

  // ---- per-frame animation ----
  const startTween = (t: Omit<Tween, "from">) => {
    tween = { ...t, from: lumaPos.clone() };
    const dx = t.to.x - lumaPos.x;
    const dz = t.to.z - lumaPos.z;
    if (Math.hypot(dx, dz) > 0.05) turnTarget = Math.atan2(dx, dz);
  };

  const land = (t: Tween, ts: number) => {
    landAt = ts;
    hopCount += 1;
    if (t.cell) {
      tones.plip(hopCount);
      padDip.set(key(t.cell), ts);
      const rp = ripples[rippleNext % ripples.length];
      rippleNext += 1;
      if (rp) {
        rp.start = ts;
        rp.mesh.position.copy(cellWorld(t.cell, COLS, ROWS, WATER_Y + 0.015));
      }
      if (t.seed) {
        const s = seeds.get(key(t.cell));
        if (s) {
          seeds.delete(key(t.cell));
          flights.push({ seed: s, from: s.seed.getWorldPosition(new Vector3()), start: ts });
        }
      }
    }
  };

  const updateTween = (ts: number) => {
    if (!tween && pendingArrive) {
      pendingArrive = false;
      const b = board;
      if (b) {
        startTween({ to: cellWorld(b.at, b.puzzle.cols, b.puzzle.rows), start: ts, dur: ARRIVE_MS, arc: 0.25, cell: null, seed: false, kind: "arrive" });
        setMode("stand", ts);
      }
    }
    const sinking = sinkStart >= 0 && ts >= sinkStart;
    if (!tween && queue.length && !sinking) {
      const q = queue.shift() as { cell: Cell; seed: boolean };
      const fast = queue.length > 0 || lastState === "between";
      startTween({ to: cellWorld(q.cell, COLS, ROWS), start: ts, dur: fast ? HOP_FAST_MS : HOP_MS, arc: 0.34, cell: q.cell, seed: q.seed, kind: "hop" });
      setMode("stand", ts);
    }
    if (!tween) return;
    const t = tween;
    const p = clamp01((ts - t.start) / t.dur);
    const e = t.kind === "lift" ? easeInOut(p) : t.kind === "arrive" ? easeOut(p) : easeInOut(p);
    lumaPos.lerpVectors(t.from, t.to, e);
    lumaPos.y += t.arc * 4 * p * (1 - p);
    if (p >= 1) {
      tween = null;
      lumaPos.copy(t.to);
      if (t.kind === "hop") land(t, ts);
      if (t.kind === "arrive") landAt = ts;
      if (t.kind === "lift") setMode(lastState === "done" ? "celebrate" : "hover", ts);
      if (!queue.length && t.kind !== "lift") settle();
    }
  };

  const poseLuma = (ts: number) => {
    const t = ts - modeStart;
    let sy = 1;
    let sx = 1;
    let lift = 0;
    let armL = 0;
    let armR = 0;
    let flap = 0;
    if (tween && tween.kind === "hop") {
      const p = clamp01((ts - tween.start) / tween.dur);
      const s = Math.sin(Math.PI * p);
      sy = 1 + 0.2 * s;
      sx = 1 - 0.1 * s;
      if (p < 0.14) {
        const q = 1 - p / 0.14;
        sy -= 0.22 * q;
        sx += 0.15 * q;
      }
      flap = Math.sin(ts * 0.06) * 0.7;
      armL = armR = 0.7;
    } else if (tween) {
      flap = Math.sin(ts * 0.05) * 0.8;
      armL = armR = 0.5;
    } else if (mode === "hover" || mode === "celebrate") {
      lift = reduced ? 0 : Math.sin(ts * 0.0035) * 0.06;
      flap = reduced ? 0.3 : Math.sin(ts * 0.045) * 0.8;
      if (mode === "celebrate") {
        const period = 760;
        const q = (t % period) / period;
        if (!reduced && q < 0.6) {
          const a = q / 0.6;
          lift += 0.32 * 4 * a * (1 - a);
          sy = 1 + 0.14 * Math.sin(Math.PI * a);
          sx = 1 - 0.07 * Math.sin(Math.PI * a);
        }
        armL = armR = reduced ? 1.6 : 1.6 + Math.sin(ts * 0.012) * 0.3;
      } else {
        armL = armR = 0.45 + Math.sin(ts * 0.004) * 0.1;
      }
    } else {
      // standing on a pad: breathe, blink; a short squash after each landing
      sy = 1 + 0.018 * Math.sin(ts * 0.0032);
      sx = 1 - 0.009 * Math.sin(ts * 0.0032);
      if (landAt >= 0 && ts - landAt < 240) {
        const k = (ts - landAt) / 240;
        const sq = Math.sin(k * Math.PI) * (1 - k);
        sy -= 0.26 * sq;
        sx += 0.18 * sq;
      }
      if (mode === "wave") {
        armR = 2.1 + Math.sin(ts * 0.011) * 0.45;
        if (t > 1100) setMode("stand", ts);
      }
    }
    // Turn towards the hop, then back towards the child once settled.
    if (!tween && !queue.length && ts - landAt > 260) turnTarget = 0;
    turn += (turnTarget - turn) * Math.min(1, 0.22);
    const scaleTarget = !shown && (lastState === "intro" || lastState === "practice-intro" || lastState === "done") ? LUMA_TITLE_SCALE : LUMA_SCALE;
    lumaScale += (scaleTarget - lumaScale) * 0.12;
    luma.root.scale.setScalar(lumaScale);
    luma.root.position.set(lumaPos.x, lumaPos.y + lift, lumaPos.z);
    luma.root.rotation.y = turn;
    luma.root.rotation.x = 0.5; // lean the face towards the camera, which looks down on the board
    luma.squash.scale.set(sx, sy, sx);
    (luma.arms[0] as Group).rotation.z = -armL;
    (luma.arms[1] as Group).rotation.z = armR;
    (luma.wings[0] as Group).rotation.y = flap;
    (luma.wings[1] as Group).rotation.y = -flap;
    for (const a of luma.antennae) a.rotation.z = Math.sin(ts * 0.004 + a.position.x * 9) * 0.05;
    luma.mouth.visible = false;
    luma.smile.visible = true;
    const blinkPhase = ts % 3400;
    let eyeY = blinkPhase < 120 ? 0.12 : 1;
    if (ts < happyUntil || mode === "celebrate") eyeY = Math.min(eyeY, 0.55);
    for (const e of luma.eyes) e.scale.y = eyeY;

    // Blob shadow on the pad (or the water), smaller as Luma rises.
    const height = Math.max(0, lumaPos.y + lift - PAD_TOP_Y);
    const onBoard = shown && !(sinkStart >= 0 && ts >= sinkStart);
    world.shadow.position.set(lumaPos.x, (onBoard ? PAD_TOP_Y : WATER_Y) + 0.014, lumaPos.z + 0.03);
    world.shadow.visible = height < 0.55; // seen from above, a shadow under a hovering Luma reads as a stray spot
    world.shadow.scale.setScalar(0.62 * (1 - Math.min(height, 1) * 0.5));
    head.set(lumaPos.x, lumaPos.y + lift + 1.45 * lumaScale, lumaPos.z);
  };

  const frame = (ts: number) => {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    if (lost) return;
    const dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
    lastTs = ts;

    // 1. Measurement state machine. May draw a new board (onBoard) for this very frame.
    runner.frame(ts);

    // 2. Visuals.
    updateTween(ts);

    // Seeds fly into Luma, then a sparkle (the same for every seed).
    for (let k = flights.length - 1; k >= 0; k--) {
      const f = flights[k] as Flight;
      const p = clamp01((ts - f.start) / 300);
      const to = lumaTummy();
      f.seed.seed.position.copy(f.from).lerp(to, easeIn(p)).sub(f.seed.root.position);
      f.seed.seed.position.y += 0.35 * 4 * p * (1 - p);
      f.seed.seed.scale.setScalar(1 - 0.5 * p);
      // The empty lotus closes into the pad: a picked-up seed leaves nothing that looks like one more to fetch.
      f.seed.cradle.scale.setScalar(Math.max(0.001, 1 - easeOut(p)));
      if (p >= 1) {
        f.seed.seed.visible = false;
        f.seed.cradle.visible = false;
        flights.splice(k, 1);
        sparkles.spawn(to, 18, SPARK, 1.6, 620, -1.8);
        audio.play("sparkle", 0.45);
        happyUntil = ts + 500;
      }
    }

    // The last seed is in: celebrate this board (same celebration for every solved board, whatever the route).
    if (lastState === "between" && solvedEnd && !celebrated && !tween && !queue.length && !flights.length) {
      celebrated = true;
      ui.say(betweenLine(true));
      audio.play("ready", 0.6);
      setMode("celebrate", ts);
      sparkles.spawn(lumaTummy(), 30, SPARK, 2.4, 800, -2.0);
      const b = board;
      // A wave of light runs across the pads, outward from Luma.
      if (b)
        for (const k2 of pads.keys()) {
          const [c, r] = k2.split(",").map(Number) as [number, number];
          padGlow.set(k2, ts + (Math.abs(c - b.at.c) + Math.abs(r - b.at.r)) * 70);
        }
    }
    if (waveAt >= 0 && ts >= waveAt) {
      waveAt = -1;
      setMode("wave", ts);
    }

    // After the pause, the board sinks into the river and Luma flies up, ready for the next one.
    if (sinkStart >= 0 && ts >= sinkStart) {
      if (shown && boardGroup.position.y === 0) {
        queue.length = 0;
        tween = null;
        startTween({ to: hoverPos, start: ts, dur: LIFT_MS, arc: 0.1, cell: null, seed: false, kind: "lift" });
        turnTarget = 0;
      }
      const k = clamp01((ts - sinkStart) / SINK_MS);
      boardGroup.position.y = -0.62 * easeIn(k) - 1e-4;
      if (k >= 1) {
        sinkStart = -1;
        shown = false;
        parent.dataset.board = "0";
        clearBoard();
      }
    }

    // Pad dips on landing and the celebration glow wave.
    for (const [k2, pad] of pads) {
      const dipAt = padDip.get(k2);
      let y = 0;
      if (dipAt !== undefined) {
        const q = (ts - dipAt) / 380;
        if (q >= 1) padDip.delete(k2);
        else y = -0.045 * Math.sin(q * Math.PI) * (1 - q);
      }
      pad.root.position.y = y;
      const glowAt = padGlow.get(k2);
      if (glowAt !== undefined && ts >= glowAt) {
        const q = (ts - glowAt) / 700;
        const a = q < 0.2 ? q / 0.2 : Math.max(0, 1 - (q - 0.2) / 0.8);
        pad.top.emissive.copy(SEED_GOLD).multiplyScalar(0.55 * a);
        if (q >= 1) {
          padGlow.delete(k2);
          pad.top.emissive.setRGB(0, 0, 0);
        }
      }
    }
    for (const [, rock] of rocks) {
      if (rock.wobble === -2) rock.wobble = ts;
      if (rock.wobble >= 0) {
        const q = (ts - rock.wobble) / 420;
        rock.root.rotation.z = q >= 1 ? 0 : Math.sin(q * Math.PI * 3) * 0.09 * (1 - q);
        if (q >= 1) rock.wobble = -1;
      }
    }
    for (const rp of ripples) {
      if (rp.start < 0) {
        rp.mesh.visible = false;
        continue;
      }
      const q = (ts - rp.start) / 520;
      if (q >= 1) {
        rp.start = -1;
        rp.mesh.visible = false;
        continue;
      }
      rp.mesh.visible = !reduced;
      rp.mesh.scale.setScalar(1 + 0.5 * easeOut(q));
      (rp.mesh.material as MeshBasicMaterial).opacity = 0.6 * (1 - q);
    }

    poseLuma(ts);

    // Practice hand: fingertip on the next pad of a fewest-moves route, once Luma has landed.
    if (handCell && !tween && !queue.length && lastState === "puzzle") {
      const p = toScreen(camera, cellWorld(handCell, COLS, ROWS, PAD_TOP_Y + 0.05), viewW, viewH);
      ui.handAt(p);
    }

    // Decorative fireflies: only on the start and end screens, never during a board.
    fireflyLevel += (fireflyTarget - fireflyLevel) * Math.min(1, dt / 350);
    const ffMat = world.fireflies.material as PointsMaterial;
    ffMat.opacity = fireflyLevel * 0.95;
    world.fireflies.visible = fireflyLevel > 0.01;
    const rfMat = riverFf.material as PointsMaterial;
    rfMat.opacity = fireflyLevel * 0.9;
    riverFf.visible = fireflyLevel > 0.01;
    if (riverFf.visible && !reduced) {
      const attr = riverFf.geometry.getAttribute("position") as Float32BufferAttribute;
      for (let i = 0; i < RIVER_FF; i++) {
        attr.setXYZ(
          i,
          (riverFfBase[i * 3] as number) + Math.sin(ts * 0.0005 + i * 1.7) * 0.35,
          (riverFfBase[i * 3 + 1] as number) + Math.sin(ts * 0.0009 + i * 2.3) * 0.18,
          (riverFfBase[i * 3 + 2] as number) + Math.cos(ts * 0.0006 + i * 0.9) * 0.3,
        );
      }
      attr.needsUpdate = true;
    }
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
      for (let k = 0; k < 2; k++) {
        tmp.set((Math.random() - 0.5) * 4.0, PAD_TOP_Y + 1.2 + Math.random() * 1.0, centre.z - 1.4 + Math.random() * 2.8);
        const c = FIRE[Math.floor(Math.random() * FIRE.length)] as Color;
        // A round burst: a flat ring would read as foam on the water from this high camera.
        fireworks.spawn(tmp, 36, [c, c, WHITE], 2.6, 1400, -0.8, false);
      }
    }
    sparkles.update(dt);
    fireworks.update(dt);

    // River flow: very slow and low contrast.
    world.water.offset.y = (ts * 0.000012) % 1;

    // Gentle camera sway only on the start and end screens.
    if (!reduced && (lastState === "intro" || lastState === "done")) {
      camera.position.set(camBase.x + Math.sin(ts * 0.00025) * 0.25, camBase.y, camBase.z);
      camera.lookAt(centre);
    } else if (camera.position.x !== camBase.x) {
      camera.position.x += (camBase.x - camera.position.x) * 0.1;
      if (Math.abs(camera.position.x - camBase.x) < 0.001) camera.position.x = camBase.x;
      camera.lookAt(centre);
    }

    // Speech bubble: tail on Luma's head, kept above the board while a board is on the river.
    tmp.copy(head).project(camera);
    const hx = ((tmp.x + 1) / 2) * viewW;
    const hy = ((1 - tmp.y) / 2) * viewH - 6;
    ui.place(hx, hy, shown || lastState === "puzzle" ? boardTopPx : undefined);

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);

  return {
    destroy: () => {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      ui.root.removeEventListener("pointerdown", onDown);
      ui.root.removeEventListener("contextmenu", noMenu);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      audio.close();
      tones.close();
      clearBoard();
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
      disposeKit(kit);
      grad.dispose();
      world.glow.dispose();
      world.water.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      ui.destroy();
      if (parent.dataset.rpOwner === owner)
        for (const k of ["phase", "practice", "boardIndex", "board", "cells", "cellPx", "rpOwner"]) delete parent.dataset[k];
    },
  };
}
