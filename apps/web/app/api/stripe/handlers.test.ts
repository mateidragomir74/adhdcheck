import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCORE_DISCLAIMER } from "@adhdcheck/contracts";
import { BAND_TEXT } from "../../parent/strings";
import {
  checkoutIdempotencyKey,
  handleCheckout,
  handleWebhook,
  type CheckoutDeps,
  type MailResult,
  type ReportMail,
  type WebhookDeps,
} from "./handlers";

// D-05b (DECIDED, Hatem, 2026-10-20): the detailed report is a one-off payment per report, sent by email
// to the parent who paid. Stripe and Resend are test doubles here: no network, no real key.

const PARENT = "00000000-0000-4000-8000-00000000000a";
const SESSION = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
const CHILD = "00000000-0000-4000-8000-0000000000c1";
const PRICE = "price_synthetic";
const CHECKOUT = "cs_test_synthetic";
const PARENT_EMAIL = "parent-a@example.test";
const SITE = "https://site.example.test";
// Synthetic signing value for the test only (a real one lives in STRIPE_WEBHOOK_SECRET).
const SIGNING = "synthetic-signing-value";
const stripe = new Stripe("unused-by-signature-checks");

function post(path: string, body: unknown = { sessionId: SESSION }, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request(`https://demo.example.test${path}`, {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/stripe/checkout (FR-45, D-05b one-off payment per report)", () => {
  type Retrieved = Awaited<ReturnType<CheckoutDeps["retrieveCheckout"]>>;
  function deps(
    o: Partial<{
      parentId: string | null;
      priceId: string;
      siteUrl: string | undefined;
      own: { childId: string; band: string | null } | null;
      paid: boolean;
      pending: string[];
      closed: string | null;
      retrieved: Record<string, Retrieved>;
    }> = {},
  ) {
    const c = {
      parentId: PARENT as string | null,
      priceId: PRICE,
      siteUrl: "https://site.example.test" as string | undefined,
      own: { childId: CHILD, band: "no_flag" } as { childId: string; band: string | null } | null,
      paid: false,
      pending: [] as string[],
      closed: null as string | null,
      retrieved: {} as Record<string, Retrieved>,
      ...o,
    };
    const createCheckoutSession = vi.fn<CheckoutDeps["createCheckoutSession"]>().mockResolvedValue({ id: CHECKOUT, url: "https://checkout.example.test/s" });
    const startPurchase = vi.fn<CheckoutDeps["startPurchase"]>().mockResolvedValue("started");
    const getOwnSession = vi.fn<CheckoutDeps["getOwnSession"]>().mockResolvedValue(c.own);
    const isPaid = vi.fn<CheckoutDeps["isPaid"]>().mockResolvedValue(c.paid);
    const pendingCheckouts = vi.fn<CheckoutDeps["pendingCheckouts"]>().mockResolvedValue(c.pending);
    const retrieveCheckout = vi.fn<CheckoutDeps["retrieveCheckout"]>(async (id) => c.retrieved[id] ?? null);
    const latestClosedCheckout = vi.fn<CheckoutDeps["latestClosedCheckout"]>().mockResolvedValue(c.closed);
    const d: CheckoutDeps = {
      getParentId: async () => c.parentId,
      priceId: c.priceId,
      siteUrl: c.siteUrl,
      getOwnSession,
      isPaid,
      pendingCheckouts,
      latestClosedCheckout,
      retrieveCheckout,
      createCheckoutSession,
      startPurchase,
    };
    return { d, createCheckoutSession, startPurchase, getOwnSession, isPaid, pendingCheckouts, retrieveCheckout, latestClosedCheckout };
  }

  it("creates a one-off payment checkout for this report, with the parent and session in metadata", async () => {
    const { d, createCheckoutSession, startPurchase } = deps();
    const res = await handleCheckout(post("/api/stripe/checkout"), d);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.example.test/s" });
    expect(createCheckoutSession).toHaveBeenCalledWith({
      priceId: PRICE,
      parentId: PARENT,
      sessionId: SESSION,
      lang: "en",
      successUrl: `https://site.example.test/parent/${CHILD}?report=paid`,
      cancelUrl: `https://site.example.test/parent/${CHILD}`,
      idempotencyKey: expect.any(String),
    });
    expect(startPurchase).toHaveBeenCalledWith({ parentId: PARENT, sessionId: SESSION, checkoutId: CHECKOUT, lang: "en" });
  });

  it("takes the email language from the browser language (Romanian when the first preference is ro)", async () => {
    const { d, createCheckoutSession } = deps();
    await handleCheckout(post("/api/stripe/checkout", { sessionId: SESSION }, { "content-type": "application/json", "accept-language": "ro-RO,ro;q=0.9,en;q=0.8" }), d);
    expect(createCheckoutSession.mock.calls[0]![0].lang).toBe("ro");
  });

  it("answers 409 already_paid when this report is already paid, and opens no checkout", async () => {
    const { d, createCheckoutSession, startPurchase } = deps({ paid: true });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_paid" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(startPurchase).not.toHaveBeenCalled();
  });

  it("answers 404 for another parent's session (RLS shows nothing) and opens no checkout", async () => {
    const { d, createCheckoutSession } = deps({ own: null });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "unknown_session" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("answers 404 not_scored for a session with no result yet (no report to sell)", async () => {
    const { d, createCheckoutSession } = deps({ own: { childId: CHILD, band: null } });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_scored" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it.each([
    ["no body field", {}],
    ["a session id that is not a uuid", { sessionId: "not-a-uuid" }],
    ["an unknown field (a client cannot choose the price or the recipient)", { sessionId: SESSION, email: "someone@example.test" }],
  ])("answers 400 for %s", async (_name, body) => {
    const { d, createCheckoutSession } = deps();
    expect((await handleCheckout(post("/api/stripe/checkout", body), d)).status).toBe(400);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("answers 401 when no parent is logged in", async () => {
    const { d, createCheckoutSession } = deps({ parentId: null });
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(401);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("answers 503 when no price is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession } = deps({ priceId: "" });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "billing_not_configured" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("refuses a request not sent as JSON (blocks cross-site form posts)", async () => {
    const { d } = deps();
    expect((await handleCheckout(post("/api/stripe/checkout", "{}", { "content-type": "text/plain" }), d)).status).toBe(415);
  });

  // R3-P1: a parent whose webhook is late, who pays by a delayed method, or who has two tabs open must not be
  // able to open a second Checkout for a report that already has one.
  it("R3-P1 returns the existing open Checkout instead of creating a second one", async () => {
    const { d, createCheckoutSession } = deps({
      pending: ["cs_open"],
      retrieved: { cs_open: { status: "open", paymentStatus: "unpaid", url: "https://checkout.example.test/existing" } },
    });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.example.test/existing" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P1 refuses with 409 when a pending purchase's Checkout is complete (webhook late)", async () => {
    const { d, createCheckoutSession } = deps({
      pending: ["cs_done"],
      retrieved: { cs_done: { status: "complete", paymentStatus: "paid", url: null } },
    });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P1 refuses with 409 when the Checkout is complete but a delayed payment is still unpaid", async () => {
    const { d, createCheckoutSession } = deps({
      pending: ["cs_delayed"],
      retrieved: { cs_delayed: { status: "complete", paymentStatus: "unpaid", url: null } },
    });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "payment_pending" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P1 creates a new Checkout when every earlier one expired or is unknown to Stripe", async () => {
    const { d, createCheckoutSession } = deps({
      pending: ["cs_old", "cs_gone"],
      retrieved: { cs_old: { status: "expired", paymentStatus: "unpaid", url: null } },
    });
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("R3-P1 answers 502 and opens no Checkout when Stripe cannot say what an earlier one became", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession, retrieveCheckout } = deps({ pending: ["cs_open"] });
    retrieveCheckout.mockRejectedValue(new Error("stripe down"));
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(502);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P1 gives two simultaneous requests for one report the same Stripe idempotency key", async () => {
    const a = deps();
    const b = deps();
    await handleCheckout(post("/api/stripe/checkout"), a.d);
    await handleCheckout(post("/api/stripe/checkout"), b.d);
    expect(a.createCheckoutSession.mock.calls[0]![0].idempotencyKey).toBe(b.createCheckoutSession.mock.calls[0]![0].idempotencyKey);
  });

  // R5-3: Stripe replays the answer of a request whose idempotency key it has seen. After a delayed payment
  // failed or a Checkout expired inside the same half hour, the same key would return the dead session.
  it("R5-3 uses another idempotency key once an earlier checkout of this report failed or expired", async () => {
    const before = deps();
    const afterFirst = deps({ closed: "cs_expired_1" });
    const afterSecond = deps({ closed: "cs_failed_2" });
    for (const x of [before, afterFirst, afterSecond]) await handleCheckout(post("/api/stripe/checkout"), x.d);
    const keys = [before, afterFirst, afterSecond].map((x) => x.createCheckoutSession.mock.calls[0]![0].idempotencyKey);
    expect(new Set(keys).size).toBe(3);
  });

  it("R5-3 still gives two tabs the same key while nothing new has closed", async () => {
    const a = deps({ closed: "cs_expired_1" });
    const b = deps({ closed: "cs_expired_1" });
    await handleCheckout(post("/api/stripe/checkout"), a.d);
    await handleCheckout(post("/api/stripe/checkout"), b.d);
    expect(a.createCheckoutSession.mock.calls[0]![0].idempotencyKey).toBe(b.createCheckoutSession.mock.calls[0]![0].idempotencyKey);
  });

  // R7-3: Stripe answers an idempotency error (-> 502) when a key is reused with different parameters, and advises
  // against personal identifiers in keys (https://docs.stripe.com/api/idempotent_requests,
  // https://docs.stripe.com/error-low-level). The key is an opaque hash over every parameter sent to Stripe.
  const keyOf = async (o: Parameters<typeof deps>[0], lang?: string) => {
    const x = deps(o);
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (lang) headers["accept-language"] = lang;
    await handleCheckout(post("/api/stripe/checkout", { sessionId: SESSION }, headers), x.d);
    return x.createCheckoutSession.mock.calls[0]![0].idempotencyKey;
  };

  it("R7-3 gives the same parent and report another key when the language differs (same half hour)", async () => {
    expect(await keyOf({}, "ro-RO,ro;q=0.9")).not.toBe(await keyOf({}, "en-US,en;q=0.9"));
  });

  it("R7-3 gives identical calls the same key, and another key for another site URL or price", async () => {
    const base = await keyOf({}, "ro");
    expect(await keyOf({}, "ro")).toBe(base);
    expect(await keyOf({ siteUrl: "https://other.example.test" }, "ro")).not.toBe(base);
    expect(await keyOf({ priceId: "price_other" }, "ro")).not.toBe(base);
  });

  it("R7-3 puts neither the parent id, nor the report id, nor an email in the key", async () => {
    const key = await keyOf({ closed: "cs_expired_1" }, "ro");
    for (const clear of [PARENT, SESSION, CHILD, PARENT_EMAIL, "example.test"]) expect(key).not.toContain(clear);
    expect(key).toMatch(/^report-checkout\/[A-Za-z0-9/_-]+$/);
    expect(key.length).toBeLessThanOrEqual(255);
  });

  // R7-5: every field of the hash must matter, so removing one from the hash fails a test.
  it("R7-5 changes the key when any single input changes, and not otherwise", () => {
    const base = { priceId: "p", parentId: "a", sessionId: "s", lang: "en" as const, successUrl: "u1", cancelUrl: "u2", bucket: 5, closedId: null as string | null };
    const k = checkoutIdempotencyKey(base);
    expect(checkoutIdempotencyKey({ ...base })).toBe(k);
    const changed = [
      { priceId: "p2" },
      { parentId: "a2" },
      { sessionId: "s2" },
      { lang: "ro" as const },
      { successUrl: "u1b" },
      { cancelUrl: "u2b" },
      { bucket: 6 },
      { closedId: "cs_x" },
    ];
    for (const c of changed) expect(checkoutIdempotencyKey({ ...base, ...c }), JSON.stringify(c)).not.toBe(k);
  });

  it("R7-5 gives two reports of one child, same language, same half hour, different keys", async () => {
    const a = deps();
    const b = deps();
    await handleCheckout(post("/api/stripe/checkout", { sessionId: SESSION }), a.d);
    await handleCheckout(post("/api/stripe/checkout", { sessionId: "4f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b" }), b.d);
    expect(a.createCheckoutSession.mock.calls[0]![0].idempotencyKey).not.toBe(b.createCheckoutSession.mock.calls[0]![0].idempotencyKey);
  });

  it("R5-3 answers 503 and opens no checkout when the closed checkouts cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession, latestClosedCheckout } = deps();
    latestClosedCheckout.mockRejectedValue(new Error("db down"));
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(503);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P2 answers 409 insufficient_data for a session with too little data, and opens no Checkout", async () => {
    const { d, createCheckoutSession } = deps({ own: { childId: CHILD, band: "insufficient_data" } });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "insufficient_data" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("R3-P6 builds the return URLs from the configured site URL, never from the request origin", async () => {
    const { d, createCheckoutSession } = deps({ siteUrl: "https://configured.example.test/" });
    await handleCheckout(post("/api/stripe/checkout"), d);
    const input = createCheckoutSession.mock.calls[0]![0];
    expect(input.successUrl).toBe(`https://configured.example.test/parent/${CHILD}?report=paid`);
    expect(input.cancelUrl).toBe(`https://configured.example.test/parent/${CHILD}`);
    expect(JSON.stringify(input)).not.toContain("demo.example.test");
  });

  it("R3-P6 answers 503 billing_not_configured when no site URL is configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession } = deps({ siteUrl: undefined });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(503);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("answers 502 when Stripe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession } = deps();
    createCheckoutSession.mockRejectedValue(new Error("stripe down"));
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(502);
  });
});

describe("POST /api/stripe/webhook (FR-47, D-05b)", () => {
  type Over = Partial<{ type: string; mode: string; payment_status: string; metadata: Record<string, string>; created: number; amount_total: number; currency: string }>;
  function event(o: Over = {}) {
    return JSON.stringify({
      id: "evt_synthetic",
      object: "event",
      type: o.type ?? "checkout.session.completed",
      created: o.created ?? 1_760_000_000,
      data: {
        object: {
          id: CHECKOUT,
          object: "checkout.session",
          mode: o.mode ?? "payment",
          payment_status: o.payment_status ?? "paid",
          amount_total: o.amount_total ?? 999,
          currency: o.currency ?? "eur",
          client_reference_id: PARENT,
          metadata: o.metadata ?? { parent_id: PARENT, session_id: SESSION, lang: "en" },
        },
      },
    });
  }

  function signed(payload: string, secret = SIGNING) { // check-secrets: allow
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret }); // check-secrets: allow
    return post("/api/stripe/webhook", payload, { "content-type": "application/json", "stripe-signature": signature });
  }

  // A stateful fake of the report_purchases table, so a replayed event meets the row the first one wrote.
  function deps(o: Partial<{ mailer: "ok" | "permanent" | "transient" | "none"; email: string | null; emailedAlready: boolean }> = {}) {
    const c = { mailer: "ok" as const, email: PARENT_EMAIL as string | null, emailedAlready: false, ...o };
    const row = { status: "pending", emailed: c.emailedAlready };
    const markPaid = vi.fn<WebhookDeps["markPaid"]>(async () => {
      const outcome = row.status === "paid" ? "already_paid" : "paid";
      row.status = "paid";
      return { outcome, emailed: row.emailed };
    });
    const markEmailed = vi.fn<WebhookDeps["markEmailed"]>(async () => {
      row.emailed = true;
    });
    const getParentEmail = vi.fn<WebhookDeps["getParentEmail"]>().mockResolvedValue(c.email);
    const reportTarget = vi.fn<WebhookDeps["reportTarget"]>().mockResolvedValue({ childId: CHILD, band: "no_flag" });
    const startPurchase = vi.fn<WebhookDeps["startPurchase"]>().mockResolvedValue("started");
    const send = vi.fn<(mail: ReportMail) => Promise<MailResult>>().mockResolvedValue(
      c.mailer === "permanent" ? { ok: false, permanent: true } : c.mailer === "transient" ? { ok: false, permanent: false } : { ok: true },
    );
    const verify = (payload: string, signature: string) => stripe.webhooks.constructEvent(payload, signature, SIGNING);
    const lineItemPrices = vi.fn<WebhookDeps["lineItemPrices"]>().mockResolvedValue([PRICE]);
    const markNotPaid = vi.fn<WebhookDeps["markNotPaid"]>().mockResolvedValue(undefined);
    const d: WebhookDeps = {
      verify,
      priceId: PRICE,
      siteUrl: SITE,
      lineItemPrices,
      markNotPaid,
      markPaid,
      markEmailed,
      startPurchase,
      getParentEmail,
      reportTarget,
      mailer: c.mailer === "none" ? null : { send },
    };
    return { d, row, markPaid, markEmailed, getParentEmail, reportTarget, startPurchase, send, lineItemPrices, markNotPaid };
  }

  it.each(["checkout.session.completed", "checkout.session.async_payment_succeeded"])(
    "on %s marks the purchase paid, emails a link to the paying parent's own address, and records emailed_at",
    async (type) => {
      const { d, markPaid, send, markEmailed, getParentEmail, reportTarget } = deps();
      const res = await handleWebhook(signed(event({ type })), d);

      expect(res.status).toBe(200);
      expect(markPaid).toHaveBeenCalledWith({ checkoutId: CHECKOUT, parentId: PARENT, sessionId: SESSION, lang: "en" });
      expect(getParentEmail).toHaveBeenCalledWith(PARENT);
      expect(reportTarget).toHaveBeenCalledWith(PARENT, SESSION);
      expect(send).toHaveBeenCalledTimes(1);
      const mail = send.mock.calls[0]![0];
      expect(mail.to).toBe(PARENT_EMAIL);
      // R3-D1 (DECIDED, Hatem, 2026-10-20): a link behind login, never the file.
      expect(mail).not.toHaveProperty("attachment");
      expect(mail.text).toContain(`${SITE}/parent/${CHILD}?session=${SESSION}`);
      expect(mail.idempotencyKey).toBe(`report-email/${CHECKOUT}`);
      expect(markEmailed).toHaveBeenCalledWith(CHECKOUT);
    },
  );

  it("a replayed event marks nothing twice and sends no second email", async () => {
    const { d, send, markEmailed } = deps();
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect((await handleWebhook(signed(event({ type: "checkout.session.async_payment_succeeded" })), d)).status).toBe(200);
    expect(send).toHaveBeenCalledTimes(1);
    expect(markEmailed).toHaveBeenCalledTimes(1);
  });

  it("sends nothing for a completed checkout whose payment is still pending (delayed payment method)", async () => {
    const { d, markPaid, send } = deps();
    const res = await handleWebhook(signed(event({ payment_status: "unpaid" })), d);
    expect(res.status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  // R5-4: when the row written at checkout start was lost (the insert is only logged on failure), a delayed
  // payment method would leave no pending row and the parent could pay a second time.
  it("R5-4 records a pending purchase from the metadata when the checkout completes unpaid", async () => {
    const { d, startPurchase, markPaid, send } = deps();
    expect((await handleWebhook(signed(event({ payment_status: "unpaid", metadata: { parent_id: PARENT, session_id: SESSION, lang: "ro" } })), d)).status).toBe(200);
    expect(startPurchase).toHaveBeenCalledWith({ parentId: PARENT, sessionId: SESSION, checkoutId: CHECKOUT, lang: "ro" });
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("R5-4 does not record a pending purchase for bad metadata or a paid checkout, nor for a checkout that is not a payment", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, startPurchase } = deps();
    await handleWebhook(signed(event({ payment_status: "unpaid", metadata: { parent_id: "x", session_id: SESSION } })), d);
    await handleWebhook(signed(event({ payment_status: "paid" })), d);
    await handleWebhook(signed(event({ mode: "subscription", payment_status: "unpaid" })), d);
    expect(startPurchase).not.toHaveBeenCalled();
  });

  it("R5-4 answers 500 so Stripe retries when the pending purchase cannot be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, startPurchase } = deps();
    startPurchase.mockRejectedValue(new Error("db down"));
    expect((await handleWebhook(signed(event({ payment_status: "unpaid" })), d)).status).toBe(500);
  });

  it("ignores a checkout that is not a one-off payment", async () => {
    const { d, markPaid } = deps();
    expect((await handleWebhook(signed(event({ mode: "subscription" })), d)).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("ignores a checkout with missing or malformed metadata, logging a code only", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, markPaid } = deps();
    expect((await handleWebhook(signed(event({ metadata: { parent_id: PARENT } })), d)).status).toBe(200);
    expect((await handleWebhook(signed(event({ metadata: { parent_id: "x", session_id: SESSION } })), d)).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "bad_metadata" });
  });

  it("records paid and logs a code, never the address, when email is not configured; the parent can still download", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, row, markEmailed, getParentEmail } = deps({ mailer: "none" });
    const res = await handleWebhook(signed(event()), d);
    expect(res.status).toBe(200);
    expect(row.status).toBe("paid");
    expect(markEmailed).not.toHaveBeenCalled();
    expect(getParentEmail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "email_not_configured" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("@");
  });

  it("does not retry forever on a permanent email refusal (for example the resend.dev test sender): 200, code logged", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, row, markEmailed } = deps({ mailer: "permanent" });
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(row.status).toBe("paid");
    expect(markEmailed).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "email_rejected" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(PARENT_EMAIL);
  });

  it("answers 500 on a temporary email failure so Stripe retries, and the retry sends once", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, send, markEmailed } = deps({ mailer: "transient" });
    expect((await handleWebhook(signed(event()), d)).status).toBe(500);
    expect(markEmailed).not.toHaveBeenCalled();
    send.mockResolvedValue({ ok: true });
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(markEmailed).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("logs a code and sends nothing when the parent has no email on record", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, send } = deps({ email: null });
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "no_parent_email" });
  });

  it("logs a code and sends nothing when the database does not match the purchase to the parent's session", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, send, markPaid } = deps();
    markPaid.mockResolvedValue({ outcome: "unknown_session", emailed: false });
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "unknown_session" });
  });

  it("rejects a wrong signature with 400 and records nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, markPaid, send } = deps();
    const res = await handleWebhook(signed(event(), "another-signing-value"), d);
    expect(res.status).toBe(400);
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects an unsigned event with 400", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, markPaid } = deps();
    const res = await handleWebhook(post("/api/stripe/webhook", event()), d);
    expect(res.status).toBe(400);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("acknowledges other event types without recording them", async () => {
    const { d, markPaid } = deps();
    expect((await handleWebhook(signed(event({ type: "invoice.paid" })), d)).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("answers 500 when recording fails, so Stripe retries, and sends nothing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, markPaid, send } = deps();
    markPaid.mockRejectedValue(new Error("db down"));
    expect((await handleWebhook(signed(event()), d)).status).toBe(500);
    expect(send).not.toHaveBeenCalled();
  });

  // R4-3: this test used to pass only because amount_total 0 tripped the price check. Now the amount is the
  // right one, so only the payment_status guard can stop it.
  it("R4-3 records nothing for a checkout with no payment required, with the right amount and price", async () => {
    const { d, markPaid, send, lineItemPrices } = deps();
    expect((await handleWebhook(signed(event({ payment_status: "no_payment_required" })), d)).status).toBe(200);
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(lineItemPrices).not.toHaveBeenCalled();
  });

  it("R4-3 pays out a discounted checkout: the line item is the configured price, whatever amount_total is", async () => {
    const { d, markPaid } = deps();
    expect((await handleWebhook(signed(event({ amount_total: 499 })), d)).status).toBe(200);
    expect(markPaid).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["another price", ["price_other"]],
    ["two line items", [PRICE, "price_other"]],
    ["no line item", []],
  ])("R4-3 records nothing and logs an error with the checkout id for %s", async (_n, prices) => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, markPaid, send, lineItemPrices } = deps();
    lineItemPrices.mockResolvedValue(prices);
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(lineItemPrices).toHaveBeenCalledWith(CHECKOUT);
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith("[stripe] webhook needs review", { outcome: "price_mismatch", checkout: CHECKOUT });
  });

  it("R4-3 answers 500 so Stripe retries when the line items cannot be read", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, lineItemPrices, markPaid } = deps();
    lineItemPrices.mockRejectedValue(new Error("stripe down"));
    expect((await handleWebhook(signed(event()), d)).status).toBe(500);
    expect(markPaid).not.toHaveBeenCalled();
  });

  it("R4-3 answers 500 with an error log and records nothing when no price is configured", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, markPaid } = deps();
    expect((await handleWebhook(signed(event()), { ...d, priceId: undefined })).status).toBe(500);
    expect(markPaid).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });

  // R4-2: a delayed payment that fails, or a Checkout that expires, must not block a new checkout forever.
  it.each([
    ["checkout.session.async_payment_failed", "failed"],
    ["checkout.session.expired", "expired"],
  ])("R4-2 on %s marks the purchase %s and sends nothing", async (type, status) => {
    const { d, markNotPaid, markPaid, send } = deps();
    expect((await handleWebhook(signed(event({ type, payment_status: "unpaid" })), d)).status).toBe(200);
    expect(markNotPaid).toHaveBeenCalledWith(CHECKOUT, status);
    expect(markPaid).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  // R6-6: the row written at checkout start can be missing (that insert is only logged when it fails). A
  // failed or expired event must still leave a closed row, or a later completed event would create a pending
  // one that blocks every new checkout with 409.
  it.each([
    ["checkout.session.async_payment_failed", "failed"],
    ["checkout.session.expired", "expired"],
  ])("R6-6 on %s records the purchase from the metadata first, then marks it %s", async (type, status) => {
    const { d, startPurchase, markNotPaid } = deps();
    expect((await handleWebhook(signed(event({ type, payment_status: "unpaid", metadata: { parent_id: PARENT, session_id: SESSION, lang: "ro" } })), d)).status).toBe(200);
    expect(startPurchase).toHaveBeenCalledWith({ parentId: PARENT, sessionId: SESSION, checkoutId: CHECKOUT, lang: "ro" });
    expect(markNotPaid).toHaveBeenCalledWith(CHECKOUT, status);
    expect(startPurchase.mock.invocationCallOrder[0]!).toBeLessThan(markNotPaid.mock.invocationCallOrder[0]!);
  });

  it("R6-6 event order: failed first with no row, then completed unpaid, leaves no pending row", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = new Map<string, string>(); // checkout id -> status; start_report_purchase keeps an existing row
    const { d, startPurchase, markNotPaid } = deps();
    startPurchase.mockImplementation(async ({ checkoutId }) => {
      if (!rows.has(checkoutId)) rows.set(checkoutId, "pending");
      return "started";
    });
    markNotPaid.mockImplementation(async (id, status) => {
      if (rows.get(id) === "pending") rows.set(id, status);
    });
    await handleWebhook(signed(event({ type: "checkout.session.async_payment_failed", payment_status: "unpaid" })), d);
    await handleWebhook(signed(event({ type: "checkout.session.completed", payment_status: "unpaid" })), d);
    expect(rows.get(CHECKOUT)).toBe("failed");
    expect([...rows.values()]).not.toContain("pending");
  });

  it("R6-6 still marks the purchase when the metadata is unusable, and answers 500 when the row cannot be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const a = deps();
    await handleWebhook(signed(event({ type: "checkout.session.expired", payment_status: "unpaid", metadata: { parent_id: "x" } })), a.d);
    expect(a.startPurchase).not.toHaveBeenCalled();
    expect(a.markNotPaid).toHaveBeenCalledWith(CHECKOUT, "expired");
    const b = deps();
    b.startPurchase.mockRejectedValue(new Error("db down"));
    expect((await handleWebhook(signed(event({ type: "checkout.session.expired", payment_status: "unpaid" })), b.d)).status).toBe(500);
    expect(b.markNotPaid).not.toHaveBeenCalled();
  });

  it("R4-2 ignores a failed or expired event of a checkout that is not a one-off payment", async () => {
    const { d, markNotPaid } = deps();
    await handleWebhook(signed(event({ type: "checkout.session.expired", mode: "subscription" })), d);
    expect(markNotPaid).not.toHaveBeenCalled();
  });

  it("R4-2 answers 500 so Stripe retries when the failure cannot be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, markNotPaid } = deps();
    markNotPaid.mockRejectedValue(new Error("db down"));
    expect((await handleWebhook(signed(event({ type: "checkout.session.async_payment_failed", payment_status: "unpaid" })), d)).status).toBe(500);
  });

  it("R4-2 end to end: after a delayed payment failed, the parent can open a new Checkout", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const rows = [{ id: CHECKOUT, status: "pending" }];
    const w = deps();
    w.markNotPaid.mockImplementation(async (id, status) => {
      const r = rows.find((x) => x.id === id);
      if (r && r.status === "pending") r.status = status;
    });
    const c = (() => {
      const base = new Request("https://x.example.test", { method: "POST" });
      void base;
      const createCheckoutSession = vi.fn<CheckoutDeps["createCheckoutSession"]>().mockResolvedValue({ id: "cs_new", url: "https://checkout.example.test/new" });
      const d: CheckoutDeps = {
        getParentId: async () => PARENT,
        priceId: PRICE,
        siteUrl: "https://site.example.test",
        getOwnSession: async () => ({ childId: CHILD, band: "no_flag" }),
        isPaid: async () => false,
        // what listPendingCheckoutIds returns: pending rows only
        pendingCheckouts: async () => rows.filter((r) => r.status === "pending").map((r) => r.id),
        latestClosedCheckout: async () => rows.filter((r) => r.status !== "pending").at(-1)?.id ?? null,
        // Stripe still reports the delayed payment as complete and unpaid
        retrieveCheckout: async () => ({ status: "complete", paymentStatus: "unpaid", url: null }),
        createCheckoutSession,
        startPurchase: async () => "started",
      };
      return { d, createCheckoutSession };
    })();
    expect((await handleCheckout(post("/api/stripe/checkout"), c.d)).status).toBe(409); // still waiting for the bank
    await handleWebhook(signed(event({ type: "checkout.session.async_payment_failed", payment_status: "unpaid" })), w.d);
    const res = await handleCheckout(post("/api/stripe/checkout"), c.d);
    expect(res.status).toBe(200);
    expect(c.createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("R3-P2 sends no email for a legacy paid purchase whose session has too little data", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, reportTarget, send } = deps();
    reportTarget.mockResolvedValue({ childId: CHILD, band: "insufficient_data" });
    expect((await handleWebhook(signed(event()), d)).status).toBe(200);
    expect(send).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "insufficient_data" });
  });

  it("logs a code and sends nothing when the report cannot be found, or the site URL is not configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = deps();
    a.reportTarget.mockResolvedValue(null);
    expect((await handleWebhook(signed(event()), a.d)).status).toBe(200);
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "report_unavailable" });
    const b = deps();
    expect((await handleWebhook(signed(event()), { ...b.d, siteUrl: undefined })).status).toBe(200);
    expect(warn).toHaveBeenCalledWith("[stripe] webhook", { outcome: "site_url_not_configured" });
    expect(a.send).not.toHaveBeenCalled();
    expect(b.send).not.toHaveBeenCalled();
  });

  // R3-D1 (DECIDED, Hatem, 2026-10-20), option A: the child's data never leaves the app. The email holds fixed
  // text and a link to the page behind login; no PDF, no nickname, no headline, no band, no disclaimer.
  it.each(["en", "ro"] as const)("R3-D1 (%s) sends fixed text and one link behind login, with nothing of the child or the report", async (lang) => {
    const { d, send } = deps();
    await handleWebhook(signed(event({ metadata: { parent_id: PARENT, session_id: SESSION, lang } })), d);
    const mail = send.mock.calls[0]![0];
    const all = `${mail.subject}\n${mail.text}\n${mail.html}`;
    const link = `${SITE}/parent/${CHILD}?session=${SESSION}`;
    expect(Object.keys(mail).sort()).toEqual(["html", "idempotencyKey", "subject", "text", "to"]);
    expect([...new Set(all.match(/https?:\/\/[^\s"<]+/g))]).toEqual([link]);
    expect(all).not.toMatch(/follow-up|no specific|Not a diagnosis|nu este un diagnostic|recomand|indicator|score|band|\.pdf|nickname/i);
    expect(all).not.toContain(SCORE_DISCLAIMER);
    for (const b of ["follow_up_suggested", "no_flag", "insufficient_data"] as const) expect(all).not.toContain(BAND_TEXT[b].headline);
    expect(all).not.toContain(String.fromCharCode(0x2014));
  });
});
