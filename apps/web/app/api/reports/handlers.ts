import type { SessionResult } from "../../../lib/data/parent";
import { buildReport, type ReportModel } from "../../../lib/report";
import { isUuid } from "../../../lib/uuid";

// GET /api/reports/<sessionId> (D-05 and D-05b, DECIDED, Hatem, 2026-10-20; FR-48): the parent report as a
// PDF, the only paid feature, paid once per report. The check is here, on the server: the file is served
// only when a paid purchase of this report exists for this parent (402 otherwise). Reads use the logged-in
// parent's own client, so RLS hides every other parent's session and purchase (404). The file is built only
// after payment is confirmed. Errors are logged by code only.

export type ReportDeps = {
  getParentId(): Promise<string | null>;
  // The session with its score and the child's nickname, or null when RLS shows no such session.
  getReport(sessionId: string): Promise<{ result: SessionResult; nickname: string } | null>;
  // Whether the logged-in parent holds a paid purchase of this report (report_purchases, RLS).
  isReportPaid(sessionId: string): Promise<boolean>;
  renderPdf(model: ReportModel): Promise<Uint8Array>;
};

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function handleReportDownload(sessionId: string, deps: ReportDeps): Promise<Response> {
  if (!(await deps.getParentId())) return fail(401, "not_logged_in");
  if (!isUuid(sessionId)) return fail(404, "unknown_session");

  let model: ReportModel | null;
  let paid: boolean;
  try {
    const report = await deps.getReport(sessionId);
    if (!report) return fail(404, "unknown_session");
    model = buildReport(report.result, report.nickname);
    if (!model) return fail(404, "not_scored");
    paid = await deps.isReportPaid(sessionId);
  } catch {
    console.error("[reports] failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }
  if (!paid) return fail(402, "payment_required");

  const bytes = await deps.renderPdf(model);
  return new Response(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/pdf" }), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${model.fileName}"`,
      "cache-control": "private, no-store",
    },
  });
}
