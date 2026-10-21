// FR-50 "new mission" email. Logic and tests in ../handlers.ts.
import { createResendSender } from "@/lib/email/resend";
import { createSupabaseRateLimiter } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { EMAILS_RATE_LIMIT, handleMissionEmail } from "../handlers";
import { getParent } from "../parent";

export async function POST(request: Request) {
  const { supabase, parent } = await getParent();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    console.error("[emails] failed", { error: "storage_unavailable" });
    return Response.json({ error: "storage_unavailable" }, { status: 503 });
  }
  return handleMissionEmail(request, {
    email: createResendSender(),
    rateLimiter: createSupabaseRateLimiter(admin, EMAILS_RATE_LIMIT),
    siteUrl: process.env.SITE_URL,
    getParent: async () => parent,
    // RLS: the parent's own client only sees their own missions.
    missionIsOwn: async (id) => {
      const { data, error } = await supabase.from("missions").select("id").eq("id", id).maybeSingle();
      return !error && !!data;
    },
  });
}
