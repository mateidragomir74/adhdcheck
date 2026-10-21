"use client";

import { useEffect, useMemo, useState } from "react";
import { getReportPurchase } from "../../../lib/data/parent";
import { createLazyClient } from "../../../lib/supabase/client";
import { S } from "../strings";
import { reportView, viewAfterCheckoutConflict, type ReportView } from "./report-view";
import { ErrorNote, buttonPrimary, buttonQuiet, postJson } from "./shell";

// D-05 and D-05b (DECIDED, Hatem, 2026-10-20): the detailed report is the only paid feature, 9.99 EUR, paid
// once per report. After payment the parent who paid gets an email with a link to this page (R3-D1) and downloads it here. The
// result and the next step above never depend on this block. The server checks payment itself
// (GET /api/reports/<id> answers 402 without a paid purchase), so this block only chooses what to show.

const CONFIRM_POLLS = 10;
const CONFIRM_EVERY_MS = 2000;

export function ReportDownload({ sessionId, band }: { sessionId: string; band: string }) {
  const client = useMemo(() => createLazyClient(), []);
  const [view, setView] = useState<ReportView | "checking">("checking");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Bumped when checkout answers 409: the page then waits for the payment and polls, like after a return.
  const [conflicts, setConflicts] = useState(0);

  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const returning = conflicts > 0 || new URLSearchParams(window.location.search).get("report") === "paid";
    const check = async (left: number) => {
      const purchase = await getReportPurchase(client, sessionId).catch(() => null);
      if (!live) return;
      // Back from checkout and not yet paid: keep the wait message (never the offer, so nobody pays twice).
      const next = reportView(purchase, returning, band, { pollsLeft: left });
      setView(next);
      if (next === "confirming" && left > 0) timer = setTimeout(() => void check(left - 1), CONFIRM_EVERY_MS);
    };
    void check(CONFIRM_POLLS);
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, sessionId, band, conflicts]);

  async function download() {
    setBusy(true);
    setFailed(false);
    const res = await fetch(`/api/reports/${sessionId}`, { cache: "no-store" }).catch(() => null);
    if (res?.ok) {
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "report.pdf";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } else if (res?.status === 402) setView("offer");
    else setFailed(true);
    setBusy(false);
  }

  async function buy() {
    setBusy(true);
    setNote(null);
    const res = await postJson("/api/stripe/checkout", { sessionId }).catch(() => null);
    const body = (await res?.json().catch(() => ({}))) as { url?: string; error?: string } | undefined;
    if (res?.ok && body?.url) {
      window.location.assign(body.url);
      return;
    }
    // 409: a Checkout for this report was already paid or is being paid (late webhook, delayed payment).
    if (res?.status === 409) {
      setView(viewAfterCheckoutConflict(body?.error));
      if (body?.error !== "insufficient_data") setConflicts((n) => n + 1);
    } else setNote(S.billing.unavailable);
    setBusy(false);
  }

  if (view === "checking") return <p className="text-sm text-ink-muted">{S.report.checking}</p>;

  if (view === "none") return null;

  if (view === "in_progress") {
    return (
      <section aria-labelledby={`report-progress-${sessionId}`} className="space-y-3">
        <p id={`report-progress-${sessionId}`} role="status" className="text-ink-muted">
          {S.report.inProgress}
        </p>
        <button type="button" disabled={busy} onClick={buy} className={buttonQuiet}>
          {busy ? S.report.buying : S.report.resume}
        </button>
        {note && (
          <p role="status" className="text-sm text-ink-muted">
            {note}
          </p>
        )}
      </section>
    );
  }

  if (view === "confirming") {
    return (
      <p role="status" className="text-ink-muted">
        {S.report.confirming}
      </p>
    );
  }

  if (view === "offer") {
    return (
      <section aria-labelledby={`report-offer-${sessionId}`} className="space-y-3">
        <h4 id={`report-offer-${sessionId}`} className="font-display text-lg font-semibold">
          {S.report.offerTitle}
        </h4>
        <p className="max-w-[65ch]">{S.report.offerText}</p>
        <p className="max-w-[65ch] text-sm text-ink-muted">{S.report.offerFree}</p>
        <button type="button" disabled={busy} onClick={buy} className={buttonPrimary}>
          {busy ? S.report.buying : S.report.buy}
        </button>
        {note && (
          <p role="status" className="text-sm text-ink-muted">
            {note}
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-3">
      <p role="status" className="font-semibold">
        {view === "paid_emailed" ? S.report.sentAndHere : S.report.availableHere}
      </p>
      <button type="button" disabled={busy} onClick={download} className={buttonQuiet}>
        {busy ? S.report.preparing : S.report.download}
      </button>
      {failed && <ErrorNote />}
    </div>
  );
}
