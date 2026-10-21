import {
  MiniGameEntrySchema,
  SessionMetricsSchema,
  type MiniGameEntry,
  type MiniGameId,
  type SessionMetrics,
} from "@adhdcheck/contracts";
import { START_ENABLE_MS } from "@adhdcheck/game";
import type { BridgeWaitResult, RoutePlannerResult, StarPathResult, TreasureChoiceResult } from "@adhdcheck/game";
import type { SessionGame, SessionGameRun } from "./game";
import { nextGameText, transitionText } from "./strings";

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
// returns something unusable is skipped and recorded, and the chain goes on. Every game, Lantern Watch included, shows
// a small visible "Next game" button (Hatem, 2026-10-21): it ends the running game and moves on. Games 2 to 5 are
// recorded as skipped. Lantern Watch is ended early and the trials already recorded are kept: the upload still
// happens, with a partial session the scorer rates as insufficient data when it is short. SessionMetrics v1 needs a
// calibration median, so over Lantern Watch the button is NOT shown (absent, not disabled) until the first calibration
// hit is recorded (SessionGameRun.canEndEarly): a press can then always produce valid metrics. On the last game the
// button says Finish. There is no time limit per game. If Lantern Watch itself cannot start, nothing can be scored:
// its calm fallback sentence stays on screen, with no button, and nothing is uploaded, as before.

// The "Game n of 5" card stays on screen until the child taps its button (Hatem, 2026-10-21: the children need time to
// read). There is no timer, so no reading time is invented.

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
  /** The visible "Next game" button, over `el`: pressing it calls onNext. It ignores presses for START_ENABLE_MS after it is drawn. */
  next(el: HTMLElement, onNext: () => void, last?: boolean): { remove(): void };
  /** The transition card "Game n of total" with a button: `tapped` settles when the child taps it, or when the card is removed. */
  card(el: HTMLElement, n: number, total: number): { remove(): void; tapped: Promise<void> };
};

export type ChainDeps = {
  lantern: SessionGame;
  steps: readonly ChainStep[];
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

export type SkipReason = "mount_failed" | "result_invalid" | "skipped";

function skippedEntry(id: MiniGameId, reason: SkipReason): MiniGameEntry {
  return { id, version: "none", params: {}, results: { status: "skipped", reason } };
}

// The card and the Next game control are not the measurement: a DOM problem in them must never stop a game.
// A card that cannot be drawn must not stop the chain either: it counts as already tapped.
const NOTHING = { remove() {}, tapped: Promise.resolve() };
function safely<T extends { remove(): void; tapped?: Promise<void> }>(make: () => T): T | typeof NOTHING {
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
    let card: { remove(): void; tapped: Promise<void> } | undefined;
    let nextControl: { remove(): void } | undefined;

    const closeGame = () => {
      try {
        current?.destroy();
      } catch {
        // a game that cannot be destroyed must not stop the chain
      }
      current = undefined;
      nextControl?.remove();
      nextControl = undefined;
      slot?.remove();
      slot = undefined;
    };

    const playStep = (step: ChainStep, last: boolean) =>
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
          nextControl = safely(() => deps.dom.next(el, () => finish(skippedEntry(step.id, "skipped")), last));
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
      card = safely(() => deps.dom.card(el, 1, total)) as { remove(): void; tapped: Promise<void> };
      await card.tapped;
      card?.remove();
      card = undefined;
      if (destroyed) return null;
      const lanternRun = deps.lantern(el, childId, consent, audioContext);
      lantern = lanternRun;
      let ending = false;
      // The button appears only once ending early yields valid metrics (the first calibration hit is recorded), so a press
      // can always hand back a partial session; before that, and when Lantern Watch cannot start, there is no button.
      void lanternRun.canEndEarly?.then(() => {
        if (ending || destroyed || nextControl) return;
        nextControl = safely(() =>
          deps.dom.next(el, () => {
            if (ending || destroyed) return;
            ending = true;
            nextControl?.remove();
            nextControl = undefined;
            lanternRun.endEarly?.();
          }),
        );
      });
      const metrics = await lanternRun.promise; // never settles when Lantern Watch cannot start
      ending = true;
      nextControl?.remove();
      nextControl = undefined;
      if (destroyed) return null;
      if (metrics === null) return null; // defensive: the button appears only after a calibration hit, so this should not happen; nothing valid to upload
      const entries: MiniGameEntry[] = [];
      for (const [k, step] of deps.steps.entries()) {
        card = safely(() => deps.dom.card(el, k + 2, total)) as { remove(): void; tapped: Promise<void> };
        await card.tapped;
        card?.remove();
        card = undefined;
        if (destroyed) return null;
        entries.push(await playStep(step, k === deps.steps.length - 1));
        if (destroyed) return null;
      }
      const merged = SessionMetricsSchema.safeParse({ ...metrics, minigames: entries });
      // Should not happen (each entry was parsed already). Lantern's own data is still worth uploading.
      return merged.success ? merged.data : metrics;
    };

    const promise = new Promise<SessionMetrics | null>((resolve) => {
      void run().then(
        (m) => {
          if (!destroyed) resolve(m);
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
  next(el, onNext, last) {
    // A small visible button in the top-right corner (never over a game's centre, its Start button or its text, checked
    // at 390x844, 844x390, 1024x768 and 768x1024). It keeps the 44 by 44 CSS px target (adhdcheck-dev, section 4) and
    // is disabled for START_ENABLE_MS after it is drawn: it appears right after the child's tap on a "Start" button, so
    // the second tap of a double tap must not also leave the game. TODO (Person 4): the placement and the texts.
    const text = nextGameText("en", last === true); // the last game says Finish. TODO (Person 4): language choice when the play page is translated
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("type", "button");
    button.setAttribute("aria-label", text.aria);
    button.style.cssText =
      "position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));z-index:10;display:flex;align-items:center;gap:8px;min-width:44px;min-height:44px;padding:8px 14px;border:2px solid rgba(255,253,247,.85);border-radius:9999px;background:rgba(7,11,43,.72);color:#fffdf7;font:inherit;font-size:16px;font-weight:600;line-height:1;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent;user-select:none;-webkit-user-select:none";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.style.cssText = "display:flex;width:18px;height:18px";
    // Static markup, no user input: a "skip to next" glyph (a triangle and a bar).
    icon.innerHTML =
      '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true" focusable="false"><path d="M5 4l11 8-11 8z"/><rect x="18" y="4" width="3" height="16" rx="1"/></svg>';
    const label = document.createElement("span");
    label.textContent = text.label;
    button.append(icon, label);
    // Stops a press here from reaching the game under it (the page has its own pointer handlers).
    button.addEventListener("pointerdown", (e) => e.stopPropagation());
    button.disabled = true;
    button.style.opacity = "0.45";
    const enable = setTimeout(() => {
      button.disabled = false;
      button.style.opacity = "1";
    }, START_ENABLE_MS);
    let used = false;
    button.addEventListener("click", (e) => {
      e.stopPropagation();
      if (button.disabled || used) return;
      used = true;
      onNext();
    });
    el.appendChild(button);
    return {
      remove: () => {
        clearTimeout(enable);
        button.remove();
      },
    };
  },
  card(el, n, total) {
    const text = transitionText("en", n, total); // TODO (Person 4): language choice when the play page is translated
    // The card is a plain box; only the announcement (glow, title, hint) is a live region. The button sits outside it.
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:28px;padding:24px;text-align:center;background:${NIGHT};color:#fffdf7;font-family:inherit`;
    const status = document.createElement("div");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    status.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:28px";
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
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text.button;
    // At least 44 by 44 CSS px (adhdcheck-dev, section 4); a large target for a small hand. Focus ring kept.
    button.style.cssText =
      "min-width:200px;min-height:64px;padding:12px 40px;border:0;border-radius:9999px;background:#fff1b8;color:#1f1b3a;font:inherit;font-size:clamp(22px,4vw,32px);font-weight:700;cursor:pointer;touch-action:manipulation";
    status.append(glow, title, hint);
    box.append(status, button);
    el.appendChild(box);
    let settle: () => void = () => {};
    const tapped = new Promise<void>((resolve) => (settle = resolve));
    // Disabled (and drawn so) for the first START_ENABLE_MS: a stray tap right after the last game must not skip the card.
    button.disabled = true;
    button.style.opacity = "0.4";
    const enable = setTimeout(() => {
      button.disabled = false;
      button.style.opacity = "1";
    }, START_ENABLE_MS);
    button.addEventListener("click", () => {
      if (!button.disabled) settle();
    });
    // Removing the card (the page is left) also settles `tapped`, so the chain can notice it was destroyed and stop.
    return {
      tapped,
      remove: () => {
        clearTimeout(enable);
        box.remove();
        settle();
      },
    };
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
