// FR-50 weekly summary email, on request. Logic and tests in ../handlers.ts.
import { createResendSender } from "@/lib/email/resend";
import { createSupabaseRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAILS_RATE_LIMIT, handleWeeklySummaryEmail } from "../handlers";
import { getParent } from "../parent";

export async function POST(request: Request) {
  const { parent } = await getParent();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.error("[emails] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return handleWeeklySummaryEmail(request, {
    email: createResendSender(),
    rateLimiter: createSupabaseRateLimiter(admin, EMAILS_RATE_LIMIT),
    siteUrl: process.env.SITE_URL,
    getParent: async () => parent,
  });
}
