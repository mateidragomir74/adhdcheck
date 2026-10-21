"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { giveProcessingConsent } from "@/lib/data/parent";
import { attempt } from "@/lib/attempt";
import { S } from "../strings";
import { buttonPrimary, ErrorNote } from "./shell";

// NFR-04: the parent's explicit consent to processing, asked once before the first game. Nothing is
// pre-ticked, and the button stays off until the box is ticked. The server refuses a play link without it.
export function ProcessingConsent({ client, onDone }: { client: SupabaseClient; onDone: () => void }) {
  const [ticked, setTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <form
      className="flex flex-col items-start gap-4"
      action={async () => {
        setBusy(true);
        setFailed(false);
        const done = await attempt(() => giveProcessingConsent(client));
        setBusy(false);
        if (done.ok) onDone();
        else setFailed(true);
      }}
    >
      <div className="w-full rounded-xl border border-ink/10 p-4">
        <h3 className="font-semibold">{S.processing.title}</h3>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{S.processing.explain}</p>
        <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            required
            checked={ticked}
            onChange={(event) => setTicked(event.target.checked)}
            className="mt-0.5 size-5 shrink-0 accent-night-3"
          />
          <span>{S.processing.agree}</span>
        </label>
      </div>
      <button type="submit" disabled={!ticked || busy} className={buttonPrimary}>
        {S.processing.button}
      </button>
      {failed && <ErrorNote />}
    </form>
  );
}
