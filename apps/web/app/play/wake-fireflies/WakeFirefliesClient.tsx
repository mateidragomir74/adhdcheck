"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { WakeFirefliesResult } from "@adhdcheck/game";

// The canvas needs the browser, so it is never rendered on the server.
const WakeFirefliesCanvas = dynamic(() => import("./WakeFirefliesCanvas"), { ssr: false });

export function WakeFirefliesClient() {
  const [result, setResult] = useState<WakeFirefliesResult | null>(null);
  // Dev-only panel: NODE_ENV is inlined at build time, so this branch is removed from production builds.
  const showPanel = process.env.NODE_ENV === "development";
  return (
    <div className="fixed inset-0 bg-[#0b1430]">
      <WakeFirefliesCanvas onComplete={setResult} />
      {showPanel && result ? (
        <pre
          data-testid="wake-fireflies-result"
          className="absolute inset-x-2 bottom-2 z-10 max-h-[40dvh] overflow-auto rounded bg-black/85 p-2 text-xs text-white"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
