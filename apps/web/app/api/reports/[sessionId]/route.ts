// Parent report download, paid once per report (D-05, D-05b, FR-48). Logic and tests in ../handlers.ts.
import type { NextRequest } from "next/server";
import { getReportPurchase, getSessionResult } from "@/lib/data/parent";
import { renderReportPdf } from "@/lib/report";
import { createClient } from "@/lib/supabase/server";
import { handleReportDownload } from "../handlers";

export async function GET(_request: NextRequest, ctx: RouteContext<"/api/reports/[sessionId]">) {
  const { sessionId } = await ctx.params;
  const supabase = await createClient();
  return handleReportDownload(sessionId, {
    getParentId: async () => (await supabase.auth.getClaims()).data?.claims.sub ?? null,
    // The parent's own client: RLS (sessions_select_own, scores_select_own, children_select_own) returns
    // nothing for another parent's session or child.
    getReport: async (id) => {
      const result = await getSessionResult(supabase, id);
      if (!result) return null;
      const { data, error } = await supabase.from("children").select("nickname").eq("id", result.child_id).maybeSingle();
      if (error) throw new Error(`read child failed: ${error.message}`);
      return data ? { result, nickname: data.nickname as string } : null;
    },
    isReportPaid: async (id) => (await getReportPurchase(supabase, id))?.status === "paid",
    renderPdf: renderReportPdf,
  });
}
