// Open the Stripe Customer Portal (FR-46). Logic and tests in ../handlers.ts.
import { createStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getCustomer } from "../billing";
import { handlePortal } from "../handlers";

export async function POST(request: Request) {
  let stripe, admin;
  try {
    stripe = createStripeClient();
    admin = createAdminClient();
  } catch {
    console.error("[stripe] portal failed", { error: "billing_not_configured" });
    return Response.json({ error: "billing_not_configured" }, { status: 503 });
  }
  const supabase = await createClient();
  return handlePortal(request, {
    getParentId: async () => (await supabase.auth.getClaims()).data?.claims.sub ?? null,
    siteUrl: process.env.SITE_URL,
    getCustomer: (parentId) => getCustomer(admin, parentId),
    createPortalSession: ({ customer, returnUrl }) => stripe.billingPortal.sessions.create({ customer, return_url: returnUrl }),
  });
}
