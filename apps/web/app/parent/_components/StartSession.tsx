"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSessionResult, hasProcessingConsent, onNewScore, type SessionResult } from "@/lib/data/parent";
import { createPlayLink, type Consent } from "@/lib/play-client";
import { S } from "../strings";
import { ProcessingConsent } from "./ProcessingConsent";
import { buttonPrimary, buttonQuiet, Loading } from "./shell";

const CONSENT_OFF: Consent = { camera: false, microphone: false };

// FR-32 start a session: a single-use play link and its QR code for the tablet. FR-39: the result arrives
// without a refresh. The subscription starts before the link exists (Realtime can miss the first
// seconds), and a poll every 4 s covers a dropped connection.
export function StartSession({
  client,
  childId,
  knownSessions,
  onResult,
}: {
  client: SupabaseClient;
  childId: string;
  knownSessions: string[];
  onResult: (result: SessionResult) => void;
}) {
  const [link, setLink] = useState<{ url: string; expires_at: string; svg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // FR-70: both off until the parent switches one on, again for every new link.
  const [consent, setConsent] = useState<Consent>(CONSENT_OFF);
  // NFR-04: null while checking. A failed check asks again rather than skipping the step.
  const [agreed, setAgreed] = useState<boolean | null>(null);
  const known = useRef(new Set(knownSessions));
  const onResultRef = useRef(onResult);
  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    let live = true;
    hasProcessingConsent(client).then(
      (yes) => live && setAgreed(yes),
      () => live && setAgreed(false),
    );
    return () => {
      live = false;
    };
  }, [client]);

  useEffect(() => {
    if (!link) return;
    let done = false;
    const deliver = async (sessionId: string) => {
      if (done || known.current.has(sessionId)) return;
      const result = await getSessionResult(client, sessionId).catch(() => null);
      if (!result || result.child_id !== childId || !result.score || done) return;
      done = true;
      known.current.add(sessionId);
      setLink(null);
      setConsent(CONSENT_OFF);
      onResultRef.current(result);
    };
    const stop = onNewScore(client, (id) => void deliver(id));
    const poll = setInterval(async () => {
      const { data } = await client.from("sessions").select("id").eq("child_id", childId);
      for (const row of data ?? []) if (!known.current.has(row.id)) void deliver(row.id);
    }, 4000);
    return () => {
      done = true;
      stop();
      clearInterval(poll);
    };
  }, [link, client, childId]);

  async function start() {
    setBusy(true);
    setFailed(false);
    try {
      const created = await createPlayLink(childId, { consent });
      const svg = await QRCode.toString(created.url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
      setLink({ url: created.url, expires_at: created.expires_at, svg });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  if (agreed === null) return <Loading />;
  if (!agreed) return <ProcessingConsent client={client} onDone={() => setAgreed(true)} />;

  if (!link)
    return (
      <div className="flex flex-col items-start gap-4">
        <fieldset className="w-full rounded-xl border border-ink/10 p-4">
          <legend className="px-1 font-semibold">{S.consent.title}</legend>
          <p className="max-w-prose text-sm text-ink-muted">{S.consent.explain}</p>
          <div className="mt-3 space-y-1">
            <Toggle label={S.consent.camera} on={consent.camera} onChange={(camera) => setConsent({ ...consent, camera })} />
            <Toggle
              label={S.consent.microphone}
              on={consent.microphone}
              onChange={(microphone) => setConsent({ ...consent, microphone })}
            />
          </div>
        </fieldset>
        <button type="button" onClick={start} disabled={busy} className={buttonPrimary}>
          {S.session.start}
        </button>
        {failed && (
          <p role="alert" className="text-sm text-ink">
            {S.session.failed}
          </p>
        )}
      </div>
    );

  const time = new Date(link.expires_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="grid items-center gap-5 sm:grid-cols-[auto_1fr]">
      <div
        className="mx-auto w-56 rounded-xl bg-white p-2 ring-1 ring-ink/10 sm:w-48 [&_svg]:h-auto [&_svg]:w-full"
        role="img"
        aria-label={link.url}
        dangerouslySetInnerHTML={{ __html: link.svg }}
      />
      <div className="space-y-3">
        <p>{S.session.scan}</p>
        <p className="break-all rounded-lg bg-cream-2 px-3 py-2 font-mono text-sm">{link.url}</p>
        <p className="flex items-center gap-2 font-semibold" aria-live="polite">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-glow motion-safe:animate-pulse" />
          {S.session.waiting}
        </p>
        <p className="text-sm text-ink-muted">
          {S.session.expires} {time}.
        </p>
        <button
          type="button"
          onClick={() => {
            setLink(null);
            setConsent(CONSENT_OFF);
          }}
          className={buttonQuiet}
        >
          {S.session.cancel}
        </button>
      </div>
    </div>
  );
}

// An on/off switch with a visible state word, not colour alone (NFR-31 spirit for the parent too).
function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      <span>{label}</span>
      <span className="flex items-center gap-2 text-sm font-semibold text-ink-muted">
        {on ? S.consent.on : S.consent.off}
        <span aria-hidden="true" className={`relative h-7 w-12 rounded-full transition-colors ${on ? "bg-night-3" : "bg-ink/20"}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-[left] ${on ? "left-6" : "left-1"}`} />
        </span>
      </span>
    </button>
  );
}
