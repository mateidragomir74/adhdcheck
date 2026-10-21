"use client";

import { useEffect, useRef } from "react";
import { mountWakeFireflies, type WakeFirefliesHandle, type WakeFirefliesResult } from "@adhdcheck/game";

export default function WakeFirefliesCanvas({ onComplete }: { onComplete: (r: WakeFirefliesResult) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onComplete);
  useEffect(() => {
    cb.current = onComplete;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Dev query parameters (?seed=, ?trials=) only apply in development builds.
    const q = process.env.NODE_ENV === "development" ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const seed = q.get("seed");
    const trials = q.get("trials");
    let cancelled = false;
    let handle: WakeFirefliesHandle | undefined;
    mountWakeFireflies(el, {
      seed: seed ? Number(seed) : undefined,
      trials: trials ? Number(trials) : undefined,
      onComplete: (r) => cb.current(r),
    }).then((h) => {
      if (cancelled) h.destroy();
      else handle = h;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
    };
  }, []);

  return <div ref={ref} className="h-dvh w-full" />;
}
