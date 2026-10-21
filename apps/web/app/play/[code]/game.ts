import type { SessionMetrics } from "@adhdcheck/contracts";
import type { Consent } from "@/lib/play-client";
import { mountWithFallback } from "../mountGuard";
import { DEFAULT_STEPS, browserDom, createSessionChain } from "./chain";
import { PLAY_STRINGS } from "./strings";

// The game whose session is uploaded and scored: Lantern Watch, the go/no-go task (Person 1, FR-04 to
// FR-10), with its calibration block "Wake the fireflies" (FR-03). It mounts in `el` and resolves with
// SessionMetrics v1 when the child finishes. FR-70: it may ask for the camera or microphone (through
// packages/sensors, FR-71/72) only when that flag of `consent` is true; both are false unless the parent
// switched them on before creating the link. The other mini-games run after it (chain.ts) and travel in the
// `minigames` block of the same upload (PC-02, accepted 2026-10-20, docs/02 section 10.3).
//
// destroy() stops the game (render loop, WebGL, audio, listeners) and is what the page calls when it is left
// (R3-L1); after it the promise never settles, so nothing is uploaded.
//
// endEarly() is the visible "Next game" button (chain.ts): it ends the game now. The promise then resolves with the
// trials already recorded (a partial session, which the scorer rates as insufficient data when it is short), or with
// null when nothing valid can be built yet (SessionMetrics v1 needs a calibration median, so at least one calibration
// firefly must have been tapped). Null means: nothing to upload.
// canEndEarly resolves when the first calibration hit is recorded: from then on endEarly() yields valid metrics, and only
// then does the chain show its "Next game" button over Lantern Watch. It never resolves if the game cannot start.
export type SessionGameRun = { promise: Promise<SessionMetrics | null>; destroy(): void; endEarly?(): void; canEndEarly?: Promise<void> };
// audioContext: created and resumed by the page inside the start tap (lib/audio-unlock.ts); the game reuses it.
export type SessionGame = (el: HTMLElement, childId: string, consent: Consent, audioContext?: AudioContext) => SessionGameRun;

type Handle = { destroy(): void; endEarly?(): void };
type MountOptions = {
  childId: string;
  autoStart: boolean;
  audioContext?: AudioContext;
  /** Development only (devLanternOptions): shorter runs for a quick look in a browser. */
  blocks?: number;
  trialsPerBlock?: number;
  onComplete: (metrics: SessionMetrics) => void;
  onUnusable?: () => void;
  onCanEndEarly?: () => void;
  onError: () => void;
};
export type MountLanternWatch = (el: HTMLElement, opts: MountOptions) => Promise<Handle>;

/**
 * Lantern Watch. `consent` is accepted but no sensor is started: packages/sensors has no capture yet and
 * SessionMetrics v1 has no camera or microphone block (PC-04 proposed), so the camera and microphone are never requested (FR-70).
 * If the 3D game cannot start (no WebGL), the calm "ask your parent" sentence replaces it and the promise never
 * resolves, so nothing is uploaded. The play page already took the child's start tap, so the game starts by itself.
 */
// Development builds only (NODE_ENV is inlined, so production ignores them), as the /play/lantern-watch page does:
// ?blocks= and ?trials=. Never a way around the play link, which is still checked and used up.
function devLanternOptions(): Pick<MountOptions, "blocks" | "trialsPerBlock"> {
  if (process.env.NODE_ENV !== "development" || typeof window === "undefined") return {};
  const q = new URLSearchParams(window.location.search);
  const num = (k: string) => (Number.isInteger(Number(q.get(k))) && Number(q.get(k)) > 0 ? Number(q.get(k)) : undefined);
  return { blocks: num("blocks"), trialsPerBlock: num("trials") };
}

export function createSessionGame(loadMount: () => Promise<MountLanternWatch>): SessionGame {
  return (el, childId, consent, audioContext) => {
    void consent;
    let handle: Handle | undefined;
    let cancel: (() => void) | undefined;
    let destroyed = false;
    let endRequested = false;
    let resolveNull: () => void = () => {};
    let signalCanEnd: () => void = () => {};
    const canEndEarly = new Promise<void>((resolve) => (signalCanEnd = resolve));
    const stop = () => {
      destroyed = true;
      cancel?.();
      handle?.destroy();
      handle = undefined;
    };
    const promise = new Promise<SessionMetrics | null>((resolve) => {
      resolveNull = () => {
        if (!destroyed) resolve(null);
      };
      const fail = () => {
        handle?.destroy();
        handle = undefined;
        el.replaceChildren();
        el.textContent = PLAY_STRINGS.unavailable;
      };
      // The module is loaded here, in the browser, so three.js never runs during server rendering.
      const mounting = loadMount().then((mount) =>
        mount(el, {
          childId,
          autoStart: true,
          audioContext,
          ...devLanternOptions(),
          onComplete: (metrics) => {
            handle?.destroy();
            handle = undefined;
            if (!destroyed) resolve(metrics);
          },
          onCanEndEarly: () => {
            if (!destroyed) signalCanEnd();
          },
          onUnusable: () => {
            handle?.destroy();
            handle = undefined;
            resolveNull();
          },
          onError: fail,
        }),
      );
      cancel = mountWithFallback(el, mounting, PLAY_STRINGS.unavailable, (h) => {
        handle = h;
        if (endRequested && !destroyed) h.endEarly?.(); // asked before the game finished mounting
      });
    });
    return {
      promise,
      canEndEarly,
      destroy: stop,
      endEarly: () => {
        if (destroyed || endRequested) return;
        endRequested = true;
        handle?.endEarly?.();
      },
    };
  };
}

const lanternWatch = createSessionGame(() => import("@adhdcheck/game").then((m) => m.mountLanternWatch));

/** What a play link runs: Lantern Watch, then the other mini-games in a row, one upload at the end (chain.ts). */
export const sessionGame: SessionGame | null = createSessionChain({
  lantern: lanternWatch,
  steps: DEFAULT_STEPS,
  dom: browserDom,
});
