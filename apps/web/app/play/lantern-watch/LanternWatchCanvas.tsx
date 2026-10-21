"use client";

import { useEffect, useRef } from "react";
import type { SessionMetrics } from "@adhdcheck/contracts";
import { mountLanternWatch, type LanternWatchHandle } from "@adhdcheck/game";
import { PLAY_STRINGS } from "../[code]/strings";
import { mountWithFallback } from "../mountGuard";

// Synthetic pseudonymous id for the harness only: no child, no upload.
const HARNESS_CHILD = "00000000-0000-4000-8000-000000000000";

export default function LanternWatchCanvas({ onComplete }: { onComplete: (m: SessionMetrics) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onComplete);
  useEffect(() => {
    cb.current = onComplete;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Dev query parameters (?seed=, ?blocks=, ?trials=, ?stim= for screenshots) only apply in development builds.
    const q = process.env.NODE_ENV === "development" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const num = (k: string) => {
      const v = q.get(k);
      return v ? Number(v) : undefined;
    };
    let handle: LanternWatchHandle | undefined;
    const cancel = mountWithFallback(
      el,
      mountLanternWatch(el, {
        childId: HARNESS_CHILD,
        seed: num("seed"),
        blocks: num("blocks"),
        trialsPerBlock: num("trials"),
        stimulusMs: num("stim"),
        onComplete: (m) => cb.current(m),
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
