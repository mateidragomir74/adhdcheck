"use client";

import { useState } from "react";
import { S } from "../strings";
import { buttonQuiet, postJson } from "./shell";

// FR-50: the weekly summary email, sent on request until a weekly job exists. The email holds only a link
// back here; the server sends at most one per week.
export function WeeklyEmail() {
  const [state, setState] = useState<"idle" | "busy" | "sent" | "skipped" | "failed">("idle");
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">{S.email.hint}</p>
      <button
        type="button"
        disabled={state === "busy"}
        className={buttonQuiet}
        onClick={async () => {
          setState("busy");
          try {
            const res = await postJson("/api/emails/weekly");
            const body = (await res.json().catch(() => ({}))) as { email?: string };
            setState(res.ok && (body.email === "sent" || body.email === "already_sent") ? "sent" : body.email === "skipped" ? "skipped" : "failed");
          } catch {
            setState("failed");
          }
        }}
      >
        {S.email.send}
      </button>
      {(state === "sent" || state === "skipped" || state === "failed") && (
        <p role="status" className="text-sm">
          {S.email[state]}
        </p>
      )}
    </div>
  );
}
