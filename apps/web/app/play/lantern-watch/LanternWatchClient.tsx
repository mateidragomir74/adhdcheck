"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { SessionMetricsSchema, type SessionMetrics } from "@adhdcheck/contracts";

// The 3D game (three.js, WebGL) needs the browser, so the canvas is never rendered on the server.
const LanternWatchCanvas = dynamic(() => import("./LanternWatchCanvas"), { ssr: false });

export function LanternWatchClient() {
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  // Dev-only panel: NODE_ENV is inlined at build time, so this branch is removed from production builds.
  const showPanel = process.env.NODE_ENV === "development";
  const check = metrics ? SessionMetricsSchema.safeParse(metrics) : null;
  return (
    <div className="fixed inset-0 bg-[#0b1430]">
      <LanternWatchCanvas onComplete={setMetrics} />
      {showPanel && metrics && check ? (
        <pre
          data-testid="lantern-watch-result"
          data-valid={check.success ? "true" : "false"}
          className="absolute inset-x-2 bottom-2 z-10 max-h-[40dvh] overflow-auto rounded bg-black/85 p-2 text-xs text-white"
        >
          {`SessionMetricsSchema.safeParse: ${check.success ? "valid" : "INVALID"}\n`}
          {JSON.stringify(metrics, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
