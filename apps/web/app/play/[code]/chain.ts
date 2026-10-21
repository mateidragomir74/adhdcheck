import {
  MiniGameEntrySchema,
  SessionMetricsSchema,
  type MiniGameEntry,
  type MiniGameId,
  type SessionMetrics,
} from "@adhdcheck/contracts";
import type { BridgeWaitResult, RoutePlannerResult, StarPathResult, TreasureChoiceResult } from "@adhdcheck/game";
import type { SessionGame, SessionGameRun } from "./game";
import { transitionText } from "./strings";

// One /play/<code> session plays every built mini-game in a row, with no parent action (decided by Hatem,
// 2026-10-20). Order: research/04 section 5 (missions 1 to 5) and docs/02 FR-61 to FR-64, without Storm Watch (FR-60,
// not built):
//   1. Lantern Watch, which starts with its calibration block "Wake the fireflies" (mini-game 0). The two are one
//      continuous block for the child, as before, so they are one game here.
//   2. Star Path   3. Bridge Wait   4. Treasure Choice   5. Route Planner (FR-64, optional in the docs, included).
// The child sees "Game n of 5" before every game, the first one included. Counting the calibration as a game of its own would give 6; the
// docs call it mini-game 0 and it has no screen of its own, so it is not counted (flagged in the PR).
//
// Only after the last game does the promise resolve, so the page uploads once (flow.ts). The upload is Lantern's
// SessionMetrics, unchanged, plus `minigames` (PC-02) with the four results. A game that fails to start, throws or
// returns something unusable is skipped and recorded, and the chain goes on. A game that starts and never ends can
// be skipped by an adult: a long press on a hidden corner control (see DEFAULT_SKIP_HOLD_MS), recorded as skipped.
// There is no time limit per game. Lantern Watch cannot be skipped: the upload cannot be built without it. If Lantern Watch itself cannot start,
// nothing can be scored: its calm fallback sentence stays on screen and nothing is uploaded, as before.

// TODO (design choice, no source): how long the "Game n of 5" card stays before the next game starts.
export const DEFAULT_TRANSITION_MS = 3000;

// TODO (design choice, no source): how long an adult holds the hidden corner control to skip the running game.
export const DEFAULT_SKIP_HOLD_MS = 3000;

export type MiniGameResult = StarPathResult | BridgeWaitResult | TreasureChoiceResult | RoutePlannerResult;
type Handle = { destroy(): void };

export type ChainStep = {
  id: MiniGameId;
  /** Mounts the game in `el`; calls onComplete with its result when the child finishes. */
  mount(el: HTMLElement, onComplete: (result: MiniGameResult) => void): Promise<Handle>;
};

export type ChainDom = {
  /** A fresh full-size box inside `el` for one game; remove() takes it out again. */
  slot(el: HTMLElement): { el: HTMLElement; remove(): void };
  /** A hidden control in a corner of `el`: holding it for holdMs calls onSkip. For the adult, never the child. */
  skip(el: HTMLElement, onSkip: () => void, holdMs: number): { remove(): void };
  /** The transition card "Game n of total". */
  card(el: HTMLElement, n: number, total: number): { remove(): void };
};

export type ChainDeps = {
  lantern: SessionGame;
  steps: readonly ChainStep[];
  transitionMs: number;
  skipHoldMs: number;
  wait(ms: number): Promise<void>;
  dom: ChainDom;
};

/** The PC-02 entry for a finished mini-game: its own id, version and params, and its trials (Route Planner: its puzzles) and results. */
export function toMiniGameEntry(r: MiniGameResult): MiniGameEntry {
  const trials = "puzzles" in r ? r.puzzles : r.trials;
  const results: Record<string, unknown> = { summary: r.summary };
  if ("motion" in r) results.motion = r.motion;
  // JSON round trip: the entry is plain JSON exactly as the server will receive it.
  const plain: unknown = JSON.parse(JSON.stringify({ id: r.id, version: r.version, params: r.params, trials, results }));
  return MiniGameEntrySchema.parse(plain);
}

export type SkipReason = "mount_failed" | "result_invalid" | "skipped_by_adult";

/** Long press: down() arms a timer, up() (finger lifted, cancelled or left) disarms it, the timer calls onHold once. */
export function createHoldDetector(
  holdMs: number,
  onHold: () => void,
  setTimer: (fn: () => void, ms: number) => unknown = (fn, ms) => setTimeout(fn, ms),
  clearTimer: (id: unknown) => void = (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
) {
  let id: unknown = null;
  return {
    down() {
      if (id !== null) return;
      id = setTimer(() => {
        id = null;
        onHold();
      }, holdMs);
    },
    up() {
      if (id === null) return;
      clearTimer(id);
      id = null;
    },
  };
}

function skippedEntry(id: MiniGameId, reason: SkipReason): MiniGameEntry {
  return { id, version: "none", params: {}, results: { status: "skipped", reason } };
}

// The card and the skip control are decoration and an adult's escape hatch: a DOM problem in them must never stop a game.
const NOTHING = { remove() {} };
function safely<T extends { remove(): void }>(make: () => T): T | typeof NOTHING {
  try {
    return make();
  } catch {
    return NOTHING;
  }
}

export function createSessionChain(deps: ChainDeps): SessionGame {
  const total = deps.steps.length + 1;
  return (el, childId, consent, audioContext): SessionGameRun => {
    let destroyed = false;
    let lantern: SessionGameRun | undefined;
    let current: Handle | undefined;
    let slot: { remove(): void } | undefined;
    let card: { remove(): void } | undefined;
    let skipControl: { remove(): void } | undefined;

    const closeGame = () => {
      try {
        current?.destroy();
      } catch {
        // a game that cannot be destroyed must not stop the chain
      }
      current = undefined;
      skipControl?.remove();
      skipControl = undefined;
      slot?.remove();
      slot = undefined;
    };

    const playStep = (step: ChainStep) =>
      new Promise<MiniGameEntry>((resolve) => {
        let done = false;
        const finish = (entry: MiniGameEntry) => {
          if (done || destroyed) return;
          done = true;
          closeGame();
          resolve(entry);
        };
        let mounting: Promise<Handle>;
        try {
          const box = deps.dom.slot(el);
          slot = box;
          skipControl = safely(() => deps.dom.skip(el, () => finish(skippedEntry(step.id, "skipped_by_adult")), deps.skipHoldMs));
          mounting = step.mount(box.el, (result) => {
            try {
              finish(toMiniGameEntry(result));
            } catch {
              finish(skippedEntry(step.id, "result_invalid"));
            }
          });
        } catch {
          finish(skippedEntry(step.id, "mount_failed"));
          return;
        }
        mounting.then(
          (handle) => {
            if (done || destroyed) handle.destroy(); // finished or left before it finished mounting
            else current = handle;
          },
          () => finish(skippedEntry(step.id, "mount_failed")),
        );
      });

    const run = async (): Promise<SessionMetrics | null> => {
      card = safely(() => deps.dom.card(el, 1, total));
      await deps.wait(deps.transitionMs);
      card?.remove();
      card = undefined;
      if (destroyed) return null;
      lantern = deps.lantern(el, childId, consent, audioContext);
      const metrics = await lantern.promise; // never settles when Lantern Watch cannot start
      if (destroyed) return null;
      const entries: MiniGameEntry[] = [];
      for (const [k, step] of deps.steps.entries()) {
        card = safely(() => deps.dom.card(el, k + 2, total));
        await deps.wait(deps.transitionMs);
        card?.remove();
        card = undefined;
        if (destroyed) return null;
        entries.push(await playStep(step));
        if (destroyed) return null;
      }
      const merged = SessionMetricsSchema.safeParse({ ...metrics, minigames: entries });
      // Should not happen (each entry was parsed already). Lantern's own data is still worth uploading.
      return merged.success ? merged.data : metrics;
    };

    const promise = new Promise<SessionMetrics>((resolve) => {
      void run().then(
        (m) => {
          if (m && !destroyed) resolve(m);
        },
        () => undefined, // unreachable by design: nothing in run() rejects except Lantern's own promise, which never does
      );
    });

    return {
      promise,
      destroy() {
        destroyed = true;
        card?.remove();
        card = undefined;
        closeGame();
        lantern?.destroy();
      },
    };
  };
}

// Browser implementations -----------------------------------------------------------------------------------------

const NIGHT = "linear-gradient(180deg,#070b2b 0%,#141c55 38%,#2a2f78 66%,#3d3a86 100%)";

export const browserDom: ChainDom = {
  slot(el) {
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    el.appendChild(box);
    return { el: box, remove: () => box.remove() };
  },
  skip(el, onSkip, holdMs) {
    // 56 px, above the game, invisible: an adult who knows it is there holds it. A child tapping the corner by chance
    // does nothing (a short press is ignored), and holds are rare. TODO (Person 4): where it should sit.
    const box = document.createElement("div");
    box.setAttribute("aria-label", "Skip this game (hold)");
    box.style.cssText = "position:absolute;top:0;right:0;width:56px;height:56px;z-index:10;touch-action:none;-webkit-touch-callout:none;user-select:none;-webkit-user-select:none;opacity:0";
    const hold = createHoldDetector(holdMs, onSkip);
    box.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      hold.down();
    });
    // Chrome for Android opens a context menu on a long press and may then cancel the pointer: the menu is refused.
    box.addEventListener("contextmenu", (e) => e.preventDefault());
    for (const type of ["pointerup", "pointercancel", "pointerleave"]) box.addEventListener(type, () => hold.up());
    el.appendChild(box);
    return {
      remove: () => {
        hold.up();
        box.remove();
      },
    };
  },
  card(el, n, total) {
    const text = transitionText("en", n, total); // TODO (Person 4): language choice when the play page is translated
    const box = document.createElement("div");
    box.setAttribute("role", "status");
    box.setAttribute("aria-live", "polite");
    box.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;text-align:center;background:${NIGHT};color:#fffdf7;font-family:inherit`;
    const glow = document.createElement("div");
    glow.setAttribute("aria-hidden", "true");
    glow.style.cssText =
      "width:32px;height:32px;border-radius:9999px;background:#fff1b8;box-shadow:0 0 24px 8px rgba(255,214,110,.8)";
    const title = document.createElement("p");
    title.textContent = text.title;
    title.style.cssText = "margin:0;font-size:clamp(28px,6vw,48px);font-weight:600;line-height:1.2";
    const hint = document.createElement("p");
    hint.textContent = text.hint;
    hint.style.cssText = "margin:0;font-size:clamp(18px,3vw,26px);line-height:1.3";
    box.append(glow, title, hint);
    el.appendChild(box);
    return { remove: () => box.remove() };
  },
};

// Development only: shorter games for a quick look in a browser, the way the /play/<name> dev pages do. NODE_ENV is
// inlined at build time, so production builds ignore every parameter. ?max= (Star Path), ?bridge= (Bridge Wait trials),
// ?choices= (Treasure Choice).
function devNumber(name: string): number | undefined {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return undefined;
  const v = new URLSearchParams(window.location.search).get(name);
  return v && Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : undefined;
}

export const DEFAULT_STEPS: readonly ChainStep[] = [
  {
    id: "star-path",
    mount: (el, onComplete) =>
      import("@adhdcheck/game").then((m) => m.mountStarPath(el, { onComplete, maxLength: devNumber("max") })),
  },
  {
    id: "bridge-wait",
    mount: (el, onComplete) =>
      import("@adhdcheck/game").then((m) => m.mountBridgeWait(el, { onComplete, trials: devNumber("bridge") })),
  },
  {
    id: "treasure-choice",
    mount: (el, onComplete) =>
      import("@adhdcheck/game").then((m) => m.mountTreasureChoice(el, { onComplete, choices: devNumber("choices") })),
  },
  {
    id: "route-planner",
    mount: (el, onComplete) => import("@adhdcheck/game").then((m) => m.mountRoutePlanner(el, { onComplete })),
  },
];
