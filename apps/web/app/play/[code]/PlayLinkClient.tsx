"use client";

import { useEffect, useRef, useState, type Ref } from "react";
import { resolvePlayLink, uploadSession, type Consent } from "@/lib/play-client";
import { createUnlockedAudioContext } from "@/lib/audio-unlock";
import { runPlayFlow, type Screen } from "./flow";
import { sessionGame, type SessionGameRun } from "./game";
import { PLAY_STRINGS } from "./strings";

// FR-14: full screen and the current orientation, both asked inside the start tap (browsers only allow
// them in a user gesture). Either can be refused (iOS Safari has no orientation lock); the game runs anyway.
async function enterPlayMode() {
  try {
    await document.documentElement.requestFullscreen?.({ navigationUI: "hide" });
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.(orientation.type.startsWith("portrait") ? "portrait" : "landscape");
  } catch {
    // Not supported or refused.
  }
}

// Resolves when the browser reports it is back online, or after a few seconds anyway (online can be true
// while the server is unreachable).
function waitForNetwork() {
  return new Promise<void>((resolve) => {
    const done = () => {
      window.removeEventListener("online", done);
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, 5000);
    window.addEventListener("online", done);
  });
}

export function PlayLinkClient({ code }: { code: string }) {
  const [screen, setScreen] = useState<Screen>({ kind: "checking" });
  const gameRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<() => void>(() => {});
  // Created inside the start tap (a user gesture) and handed to the game, which reuses it.
  const audioRef = useRef<AudioContext | null>(null);

  // R3-L1: leaving the page (or React dev mode running the effect twice) stops the game that was started and
  // ends the flow, so no render loop, WebGL context, AudioContext or listener is left running and a return
  // to the page starts one clean instance.
  useEffect(() => {
    const controller = new AbortController();
    let run: SessionGameRun | undefined;
    const game = sessionGame;
    void runPlayFlow(code, {
      resolve: (c) => resolvePlayLink(c),
      play: game
        ? (childId, consent) => {
            const el = gameRef.current;
            if (!el) throw new Error("game container missing");
            run = game(el, childId, consent, audioRef.current ?? undefined);
            return run.promise;
          }
        : null,
      waitForStart: () => new Promise<void>((resolve) => (startRef.current = resolve)),
      upload: (c, metrics) => uploadSession(c, metrics),
      waitForNetwork,
      show: (next) => {
        if (!controller.signal.aborted) setScreen(next);
      },
    }, controller.signal);
    return () => {
      controller.abort();
      run?.destroy();
      if (!run) void audioRef.current?.close().catch(() => undefined); // never handed to a game
      audioRef.current = null;
    };
  }, [code]);

  return <PlayScreen screen={screen} gameRef={gameRef} onStart={() => {
        audioRef.current ??= createUnlockedAudioContext();
        startRef.current();
      }}
    />;
}

// FR-70: the child-friendly explanation, shown only when the parent switched a sensor on.
function sensorLine(consent: Consent): string | null {
  if (consent.camera && consent.microphone) return PLAY_STRINGS.sensorsBoth;
  if (consent.camera) return PLAY_STRINGS.sensorsCamera;
  if (consent.microphone) return PLAY_STRINGS.sensorsMicrophone;
  return null;
}

// The night-sky screen around the game. Also the Suspense fallback of the page (screen "checking").
export function PlayScreen({
  screen,
  gameRef,
  onStart,
}: {
  screen: Screen;
  gameRef?: Ref<HTMLDivElement>;
  onStart?: () => void;
}) {
  const playing = screen.kind === "playing";
  return (
    <main className="relative h-dvh w-full touch-none select-none overflow-hidden bg-[linear-gradient(180deg,#070b2b_0%,#141c55_38%,#2a2f78_66%,#3d3a86_100%)] font-[family-name:var(--font-fredoka)] text-[#fffdf7]">
      <div ref={gameRef} className={playing ? "absolute inset-0" : "hidden"} />
      {!playing && (
        <div className="flex h-full flex-col items-center justify-center gap-10 px-6 text-center">
          <Firefly calm={screen.kind !== "done" && screen.kind !== "ready"} />
          <p aria-live="polite" className="max-w-[22ch] text-[clamp(22px,4vw,34px)] leading-snug font-semibold">
            {PLAY_STRINGS[screen.kind]}
          </p>
          {screen.kind === "ready" && sensorLine(screen.consent) && (
            <p className="-mt-4 max-w-[30ch] rounded-2xl bg-[#fffdf7]/10 px-5 py-3 text-[clamp(17px,2.6vw,22px)] leading-snug">
              {sensorLine(screen.consent)}
            </p>
          )}
          {screen.kind === "ready" && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                void enterPlayMode();
                onStart?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onStart?.();
              }}
              className="flex h-32 w-32 items-center justify-center rounded-full border-[6px] border-[#fffdf7] bg-[radial-gradient(circle_at_35%_30%,#7ff0e1,#2fbfae_60%,#1f9e95)] text-xl font-bold text-[#0b3d39] shadow-[0_7px_0_#167a73,0_16px_30px_rgba(4,4,30,.5)] outline-offset-4 focus-visible:outline-4 focus-visible:outline-[#fffdf7] active:translate-y-1"
            >
              {PLAY_STRINGS.start}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

// Luma's glow: still while the page waits, a slow pulse when there is something to do or celebrate.
function Firefly({ calm }: { calm: boolean }) {
  return (
    <div aria-hidden="true" className="relative h-24 w-24">
      <div
        className={`absolute inset-0 rounded-full bg-[radial-gradient(circle,rgba(255,231,140,.9)_0%,rgba(255,200,90,.35)_45%,transparent_70%)] ${calm ? "" : "motion-safe:animate-pulse"}`}
      />
      <div className="absolute top-1/2 left-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#fff1b8] shadow-[0_0_24px_8px_rgba(255,214,110,.8)]" />
    </div>
  );
}
