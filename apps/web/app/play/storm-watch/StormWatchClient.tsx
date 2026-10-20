"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { StormWatchResult } from "@adhdcheck/game";

// The 3D game (three.js, WebGL) needs the browser, so the canvas is never rendered on the server.
const StormWatchCanvas = dynamic(() => import("./StormWatchCanvas"), { ssr: false });

export function StormWatchClient() {
  const [result, setResult] = useState<StormWatchResult | null>(null);
  // Dev-only panel: NODE_ENV is inlined at build time, so this branch is removed from production builds.
  const showPanel = process.env.NODE_ENV === "development";

  return (
    <div className="fixed inset-0 bg-[#0a0720]">
      <StormWatchCanvas onComplete={setResult} />
      {showPanel && result ? (
        <pre
          data-testid="storm-watch-result"
          className="absolute inset-x-2 bottom-2 z-10 max-h-[40dvh] overflow-auto rounded bg-black/85 p-2 text-xs text-white"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
