import { createHash } from "node:crypto";
import type Stripe from "stripe";
import { z } from "zod";
import { reportReadyEmail, type EmailLang } from "../../../lib/email/messages";
import { isUuid } from "../../../lib/uuid";

// Stripe test mode (FR-45, FR-47; D-05, D-05b DECIDED, Hatem, 2026-10-20). The detailed PDF report costs
// 9.99 EUR, paid once per report (Stripe Checkout, mode "payment"); the price comes from STRIPE_PRICE_ID.
// After payment the parent who paid gets an email (Resend) with a link to the report behind login (R3-D1,
// DECIDED, Hatem, 2026-10-20: no attachment, no child data in the email); the report stays downloadable in the app.
// Stripe, Resend and the database are injected, so these run in tests without network. Errors and outcomes
// are logged by code only, never with an email address.
//
// Sources: Stripe "Fulfill orders" (https://docs.stripe.com/checkout/fulfillment): handle
// checkout.session.completed and checkout.session.async_payment_succeeded, fulfil only when payment_status
// is not "unpaid", and make fulfilment safe to run several times, concurrently, for one Checkout Session.
// Stripe webhooks (https://docs.stripe.com/webhooks): verify the signature on the raw body; events can be
// delivered more than once. Resend Idempotency-Key (https://resend.com/docs/api-reference/emails/send-email):
// one key per email, kept 24 hours, so two concurrent deliveries of one event send a single email.

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

function isJson(request: Request) {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

// The email language: Romanian when the browser's first language preference is Romanian, else English.
export function langFromRequest(request: Request): EmailLang {
  const first = (request.headers.get("accept-language") ?? "").split(",")[0]?.trim().toLowerCase() ?? "";
  return first === "ro" || first.startsWith("ro-") ? "ro" : "en";
}

const Uuid = z.string().refine(isUuid);
const CHECKOUT_BUCKET_MS = 30 * 60 * 1000;
const CheckoutBody = z.strictObject({ sessionId: Uuid });

// R7-3. Stripe answers an error when an idempotency key is reused with different parameters
// (https://docs.stripe.com/api/idempotent_requests) and advises against personal identifiers in keys; a key is
// reused only for an identical call (https://docs.stripe.com/error-low-level). So the key is a SHA-256 over every
// parameter that goes to Stripe, plus the half hour bucket and the newest closed checkout (R5-3): it changes when any
// of them changes, it is the same for two identical requests (two tabs), and it holds no id or address in clear.
export function checkoutIdempotencyKey(p: {
  priceId: string;
  parentId: string;
  sessionId: string;
  lang: EmailLang;
  successUrl: string;
  cancelUrl: string;
  bucket: number;
  closedId: string | null;
}): string {
  const digest = createHash("sha256")
    .update(JSON.stringify([p.priceId, p.parentId, p.sessionId, p.lang, p.successUrl, p.cancelUrl, p.bucket, p.closedId]))
    .digest("hex");
  return `report-checkout/${digest}`;
}

export type CheckoutDeps = {
  getParentId(): Promise<string | null>;
  priceId: string | undefined;
  // SITE_URL: the public address of the site, the only source of the return URLs (never the request origin).
  siteUrl: string | undefined;
  // The session as the logged-in parent sees it (RLS): null for another parent's session. band is null
  // while the session has no result.
  getOwnSession(sessionId: string): Promise<{ childId: string; band: string | null } | null>;
  // Whether this parent already holds a paid purchase of this report.
  isPaid(sessionId: string): Promise<boolean>;
  // Stripe Checkout Session ids of this parent's pending purchases of this report, newest first (RLS).
  pendingCheckouts(sessionId: string): Promise<string[]>;
  // The Stripe Checkout Session id of this parent's newest failed or expired purchase of this report, or null.
  // It goes into the idempotency key (R5-3), so a new checkout after a failure is never answered with the dead one.
  latestClosedCheckout(sessionId: string): Promise<string | null>;
  // What Stripe says an earlier Checkout Session became; null when Stripe does not know it.
  retrieveCheckout(checkoutId: string): Promise<{ status: "open" | "complete" | "expired"; paymentStatus: string; url: string | null } | null>;
  createCheckoutSession(input: {
    priceId: string;
    parentId: string;
    sessionId: string;
    lang: EmailLang;
    successUrl: string;
    cancelUrl: string;
    // Two requests for one report in the same half hour (two tabs) get the same Checkout Session from Stripe.
    idempotencyKey: string;
  }): Promise<{ id: string; url: string | null }>;
  startPurchase(input: { parentId: string; sessionId: string; checkoutId: string; lang: EmailLang }): Promise<string>;
};

// POST /api/stripe/checkout (JSON { sessionId }, logged-in parent) -> { url } of a Checkout page for one
// report. Success returns to the child page, which shows the paid state once the webhook has run.
export async function handleCheckout(request: Request, deps: CheckoutDeps): Promise<Response> {
  if (!isJson(request)) return fail(415, "json_required");
  const parentId = await deps.getParentId();
  if (!parentId) return fail(401, "not_logged_in");
  if (!deps.priceId) {
    console.error("[stripe] checkout failed", { error: "billing_not_configured" });
    return fail(503, "billing_not_configured");
  }
  const parsed = CheckoutBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail(400, "invalid_request");
  const { sessionId } = parsed.data;

  const siteUrl = deps.siteUrl?.trim().replace(/\/+$/, "");
  if (!siteUrl) {
    console.error("[stripe] checkout failed", { error: "billing_not_configured" });
    return fail(503, "billing_not_configured");
  }

  let own: { childId: string; band: string | null } | null;
  try {
    own = await deps.getOwnSession(sessionId);
    if (!own) return fail(404, "unknown_session");
    if (own.band === null) return fail(404, "not_scored");
    // A session with too little data has no result to report, so there is nothing to sell.
    if (own.band === "insufficient_data") return fail(409, "insufficient_data");
    if (await deps.isPaid(sessionId)) return fail(409, "already_paid");
  } catch {
    console.error("[stripe] checkout failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }

  // An earlier Checkout for this report decides first (late webhook, delayed payment method, two tabs).
  let existingUrl: string | null = null;
  try {
    for (const id of await deps.pendingCheckouts(sessionId)) {
      const earlier = await deps.retrieveCheckout(id);
      if (!earlier) continue;
      if (earlier.status === "complete") return fail(409, earlier.paymentStatus === "paid" ? "already_paid" : "payment_pending");
      if (earlier.status === "open" && earlier.url && !existingUrl) existingUrl = earlier.url;
    }
  } catch {
    console.error("[stripe] checkout failed", { error: "billing_unavailable" });
    return fail(502, "billing_unavailable");
  }
  if (existingUrl) return Response.json({ url: existingUrl });

  const lang = langFromRequest(request);
  let closedId: string | null;
  try {
    closedId = await deps.latestClosedCheckout(sessionId);
  } catch {
    console.error("[stripe] checkout failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }
  const successUrl = `${siteUrl}/parent/${own.childId}?report=paid`;
  const cancelUrl = `${siteUrl}/parent/${own.childId}`;
  try {
    const session = await deps.createCheckoutSession({
      priceId: deps.priceId,
      parentId,
      sessionId,
      lang,
      successUrl,
      cancelUrl,
      idempotencyKey: checkoutIdempotencyKey({
        priceId: deps.priceId,
        parentId,
        sessionId,
        lang,
        successUrl,
        cancelUrl,
        bucket: Math.floor(Date.now() / CHECKOUT_BUCKET_MS),
        closedId,
      }),
    });
    if (!session.url) throw new Error("checkout session without url");
    // The webhook also records the purchase from the metadata, so a lost insert here loses nothing.
    await deps.startPurchase({ parentId, sessionId, checkoutId: session.id, lang }).catch(() => {
      console.warn("[stripe] checkout", { outcome: "start_not_recorded" });
    });
    return Response.json({ url: session.url });
  } catch {
    console.error("[stripe] checkout failed", { error: "billing_unavailable" });
    return fail(502, "billing_unavailable");
  }
}

export type ReportMail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  idempotencyKey: string;
};
// permanent: the provider refused the message for good (for example a 403 because the sender domain is not
// verified), so a retry cannot help.
export type MailResult = { ok: true } | { ok: false; permanent: boolean };
export type Mailer = { send(mail: ReportMail): Promise<MailResult> };

export type PaidOutcome = { outcome: string; emailed: boolean };

export type WebhookDeps = {
  // Stripe signature check (stripe.webhooks.constructEvent with STRIPE_WEBHOOK_SECRET); throws when invalid.
  verify(payload: string, signature: string): Stripe.Event;
  // STRIPE_PRICE_ID: the only price a paid checkout may hold.
  priceId: string | undefined;
  // The price ids of the Checkout Session's line items, read from Stripe (sessions.listLineItems); throws when
  // Stripe cannot say. The price id is compared, not amount_total: a coupon or tax changes the total, not the item.
  lineItemPrices(checkoutId: string): Promise<string[]>;
  // A delayed payment failed or the Checkout expired: the pending purchase stops blocking a new checkout.
  markNotPaid(checkoutId: string, status: "failed" | "expired"): Promise<void>;
  markPaid(input: { checkoutId: string; parentId: string; sessionId: string; lang: EmailLang }): Promise<PaidOutcome>;
  markEmailed(checkoutId: string): Promise<void>;
  // Records a pending purchase from the Checkout metadata (R5-4); the same database call as at checkout start.
  startPurchase(input: { parentId: string; sessionId: string; checkoutId: string; lang: EmailLang }): Promise<string>;
  // SITE_URL: the public address of the site, the only source of the link in the email.
  siteUrl: string | undefined;
  // The email of the parent who paid, from Supabase auth (never from the request or Stripe).
  getParentEmail(parentId: string): Promise<string | null>;
  // The child page of that parent's session where the report is downloaded, or null when there is none (not
  // scored, deleted). Only ids and the band leave this function; the band decides whether a report exists.
  reportTarget(parentId: string, sessionId: string): Promise<{ childId: string; band: string } | null>;
  // null when RESEND_API_KEY or EMAIL_FROM is not set: the purchase is still recorded.
  mailer: Mailer | null;
};

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);
// https://docs.stripe.com/checkout/fulfillment (listen for checkout.session.async_payment_failed too) and
// https://docs.stripe.com/api/events/types (checkout.session.expired).
const NOT_PAID_EVENTS: Record<string, "failed" | "expired"> = {
  "checkout.session.async_payment_failed": "failed",
  "checkout.session.expired": "expired",
};
const Metadata = z.object({ parent_id: Uuid, session_id: Uuid, lang: z.enum(["ro", "en"]).catch("en") });

function note(outcome: string) {
  console.warn("[stripe] webhook", { outcome });
  return Response.json({ received: true });
}

// POST /api/stripe/webhook (FR-47): verifies the signature on the raw body, marks the purchase paid once,
// then emails the link to the report once. A 500 makes Stripe retry (database or temporary email failure); a permanent
// condition answers 200 with a logged code, so Stripe does not retry it for days.
export async function handleWebhook(request: Request, deps: WebhookDeps): Promise<Response> {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing signature");
    event = deps.verify(payload, signature);
  } catch {
    console.warn("[stripe] webhook rejected", { error: "invalid_signature" });
    return fail(400, "invalid_signature");
  }

  const notPaid = NOT_PAID_EVENTS[event.type];
  if (notPaid) {
    const closed = event.data.object as Stripe.Checkout.Session;
    if (closed.mode !== "payment") return Response.json({ received: true });
    try {
      // R6-6: the row written at checkout start can be missing. Record it from the metadata first (an existing
      // row is kept), so this event closes it and a later "completed, unpaid" event cannot open a pending one.
      const known = Metadata.safeParse(closed.metadata ?? {});
      if (known.success) {
        await deps.startPurchase({ parentId: known.data.parent_id, sessionId: known.data.session_id, checkoutId: closed.id, lang: known.data.lang });
      }
      await deps.markNotPaid(closed.id, notPaid);
    } catch {
      console.error("[stripe] webhook failed", { error: "storage_unavailable" });
      return fail(500, "storage_unavailable");
    }
    return Response.json({ received: true });
  }

  if (!PAID_EVENTS.has(event.type)) return Response.json({ received: true });
  const checkout = event.data.object as Stripe.Checkout.Session;
  if (checkout.mode !== "payment") return Response.json({ received: true });
  // A delayed payment method completes the checkout before the money arrives (unpaid; async_payment_succeeded
  // follows). Only "paid" counts: "no_payment_required" (a 100% coupon) is not a purchase of this report.
  if (checkout.payment_status === "unpaid" && event.type === "checkout.session.completed") {
    // R5-4: the pending row is written at checkout start and that insert is only logged when it fails; write it
    // again from the metadata, so the parent cannot start a second payment while the bank is still working.
    const pending = Metadata.safeParse(checkout.metadata ?? {});
    if (pending.success) {
      try {
        await deps.startPurchase({ parentId: pending.data.parent_id, sessionId: pending.data.session_id, checkoutId: checkout.id, lang: pending.data.lang });
      } catch {
        console.error("[stripe] webhook failed", { error: "storage_unavailable" });
        return fail(500, "storage_unavailable");
      }
    }
    return Response.json({ received: true });
  }
  if (checkout.payment_status !== "paid") return Response.json({ received: true });
  const meta = Metadata.safeParse(checkout.metadata ?? {});
  if (!meta.success) return note("bad_metadata");
  const { parent_id: parentId, session_id: sessionId, lang } = meta.data;

  // The Checkout must hold exactly the configured price. A mismatch after money was taken is logged at error
  // level with the Checkout id so it is reviewed by hand (Stripe Dashboard), never silently dropped.
  try {
    if (!deps.priceId) throw new Error("no configured price");
    const prices = await deps.lineItemPrices(checkout.id);
    if (prices.length !== 1 || prices[0] !== deps.priceId) {
      console.error("[stripe] webhook needs review", { outcome: "price_mismatch", checkout: checkout.id });
      return Response.json({ received: true });
    }
  } catch {
    console.error("[stripe] webhook failed", { error: "billing_unavailable" });
    return fail(500, "billing_unavailable");
  }

  let paid: PaidOutcome;
  try {
    paid = await deps.markPaid({ checkoutId: checkout.id, parentId, sessionId, lang });
  } catch {
    console.error("[stripe] webhook failed", { error: "storage_unavailable" });
    return fail(500, "storage_unavailable");
  }
  if (paid.outcome !== "paid" && paid.outcome !== "already_paid") return note(paid.outcome);
  if (paid.emailed) return Response.json({ received: true });
  if (!deps.mailer) return note("email_not_configured");

  try {
    const to = await deps.getParentEmail(parentId);
    if (!to) return note("no_parent_email");
    const siteUrl = deps.siteUrl?.trim().replace(/\/+$/, "");
    if (!siteUrl) return note("site_url_not_configured");
    const target = await deps.reportTarget(parentId, sessionId);
    if (!target) return note("report_unavailable");
    // Cannot be bought any more; a purchase made before that rule has no report to link to.
    if (target.band === "insufficient_data") return note("insufficient_data");
    // The link opens the child page behind login; a visitor without a session is sent to /login and comes back.
    const content = reportReadyEmail(lang, `${siteUrl}/parent/${target.childId}?session=${sessionId}`);
    const sent = await deps.mailer.send({ to, ...content, idempotencyKey: `report-email/${checkout.id}` });
    if (!sent.ok) {
      if (sent.permanent) return note("email_rejected");
      throw new Error("email temporarily unavailable");
    }
    await deps.markEmailed(checkout.id);
    return Response.json({ received: true });
  } catch {
    console.error("[stripe] webhook failed", { error: "email_unavailable" });
    return fail(500, "email_unavailable");
  }
}
