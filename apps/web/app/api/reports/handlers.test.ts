import { describe, expect, it, vi } from "vitest";
import { renderReportPdf } from "../../../lib/report";
import { sessionResult } from "../../../lib/report-test-helpers";
import { handleReportDownload, type ReportDeps } from "./handlers";

// GET /api/reports/<sessionId> (D-05, D-05b, FR-48): the only paid feature, a one-off payment per report.
// The payment check is on the server, so hiding or showing a button in the page changes nothing about who
// gets the file.

const SESSION = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const PARENT = "00000000-0000-4000-8000-00000000000a";

function deps(over: Partial<{ parentId: string | null; report: Awaited<ReturnType<ReportDeps["getReport"]>>; paid: boolean }> = {}) {
  const o = { parentId: PARENT as string | null, report: { result: sessionResult("follow_up_suggested"), nickname: "Demo Fox" }, paid: true, ...over };
  const getReport = vi.fn().mockResolvedValue(o.report);
  const isReportPaid = vi.fn().mockResolvedValue(o.paid);
  const renderPdf = vi.fn(renderReportPdf);
  const d: ReportDeps = { getParentId: async () => o.parentId, getReport, isReportPaid, renderPdf };
  return { d, getReport, isReportPaid, renderPdf };
}

describe("GET /api/reports/<sessionId>", () => {
  it("answers 401 when no parent is logged in", async () => {
    const { d, getReport } = deps({ parentId: null });
    const res = await handleReportDownload(SESSION, d);
    expect(res.status).toBe(401);
    expect(getReport).not.toHaveBeenCalled();
  });

  it("answers 404 for an id that is not a uuid, without a database call", async () => {
    const { d, getReport } = deps();
    const res = await handleReportDownload("not-a-uuid", d);
    expect(res.status).toBe(404);
    expect(getReport).not.toHaveBeenCalled();
  });

  it("answers 404 for another parent's session (RLS returns nothing), even when that report was paid", async () => {
    const { d, renderPdf } = deps({ report: null, paid: true });
    const res = await handleReportDownload(SESSION, d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown_session" });
    expect(renderPdf).not.toHaveBeenCalled();
  });

  it("answers 404 for a session that is not scored yet", async () => {
    const { d } = deps({ report: { result: { ...sessionResult("no_flag"), score: null }, nickname: "Demo Fox" } });
    expect((await handleReportDownload(SESSION, d)).status).toBe(404);
  });

  it("answers 402 payment_required when this report has no paid purchase, and builds no file", async () => {
    const { d, renderPdf, isReportPaid } = deps({ paid: false });
    const res = await handleReportDownload(SESSION, d);
    expect(res.status).toBe(402);
    expect(await res.json()).toEqual({ error: "payment_required" });
    expect(res.headers.get("content-type")).not.toContain("pdf");
    expect(renderPdf).not.toHaveBeenCalled();
    expect(isReportPaid).toHaveBeenCalledWith(SESSION);
  });

  it("sends the PDF to the parent who paid for this report", async () => {
    const { d } = deps({ paid: true });
    const res = await handleReportDownload(SESSION, d);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="report-2026-10-12.pdf"');
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(Buffer.from(body.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
  });

  it("answers 503 when the database cannot be read", async () => {
    const { d } = deps();
    d.getReport = vi.fn().mockRejectedValue(new Error("down"));
    expect((await handleReportDownload(SESSION, d)).status).toBe(503);
    const second = deps();
    second.d.isReportPaid = vi.fn().mockRejectedValue(new Error("down"));
    expect((await handleReportDownload(SESSION, second.d)).status).toBe(503);
  });
});
