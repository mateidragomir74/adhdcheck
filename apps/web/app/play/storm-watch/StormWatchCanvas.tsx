"use client";

import { useEffect, useRef } from "react";
import { PLAY_STRINGS } from "../[code]/strings";
import { mountWithFallback } from "../mountGuard";
import { mountStormWatch, type StormWatchHandle, type StormWatchResult } from "@adhdcheck/game";

export default function StormWatchCanvas({
  onComplete,
}: {
  onComplete: (r: StormWatchResult) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onComplete);
  useEffect(() => {
    cb.current = onComplete;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Dev query parameters (?seed=, ?trials=, ?skipPractice=1) only apply in development builds.
    const q =
      process.env.NODE_ENV === "development"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();
    const seed = q.get("seed");
    const trials = q.get("trials");
    const skipPractice = q.get("skipPractice") === "1";

    // In development mode, use 8 trials per block and default to seed 1043 (odd -> storm first)
    // so testers experience birds, thunder, lightning, and raindrops immediately without a long wait.
    const isDev = process.env.NODE_ENV === "development";
    const effectiveSeed = seed ? Number(seed) : (isDev ? 1043 : undefined);
    const effectiveTrials = trials ? Number(trials) : (isDev ? 8 : undefined);

    let handle: StormWatchHandle | undefined;
    const cancel = mountWithFallback(
      el,
      mountStormWatch(el, {
        seed: effectiveSeed,
        trialsPerBlock: effectiveTrials,
        skipPractice,
        onComplete: (r) => cb.current(r),
      }),
      PLAY_STRINGS.unavailable,
      (h) => {
        handle = h;
      },
    );

    return () => {
      cancel();
      handle?.destroy();
    };
  }, []);

  return <div ref={ref} className="h-dvh w-full" />;
}
