import Stripe from "stripe";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleCheckout, handlePortal, handleWebhook, type SubscriptionUpdate } from "./handlers";

const PARENT = "00000000-0000-4000-8000-00000000000a";
const CUSTOMER = "cus_synthetic";
const PRICE = "price_synthetic";
// Synthetic signing value for the test only (a real one lives in STRIPE_WEBHOOK_SECRET).
const SIGNING = "synthetic-signing-value";
const stripe = new Stripe("unused-by-signature-checks");

function post(path: string, body = "{}", headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request(`https://demo.example.test${path}`, { method: "POST", headers, body });
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/stripe/checkout (FR-45)", () => {
  function deps({
    parentId = PARENT as string | null,
    priceId = PRICE,
    status = null as string | null,
    stripeActive = false,
    siteUrl = undefined as string | undefined,
  } = {}) {
    const getOrCreateCustomer = vi.fn().mockResolvedValue(CUSTOMER);
    const createCheckoutSession = vi.fn().mockResolvedValue({ url: "https://checkout.example.test/s" });
    const getSubscriptionStatus = vi.fn().mockResolvedValue(status);
    const hasLiveSubscription = vi.fn().mockResolvedValue(stripeActive);
    return {
      d: {
        getParentId: async () => parentId,
        priceId,
        siteUrl,
        getSubscriptionStatus,
        getOrCreateCustomer,
        hasLiveSubscription,
        createCheckoutSession,
      },
      getOrCreateCustomer,
      hasLiveSubscription,
      createCheckoutSession,
    };
  }

  it("answers 409 already_subscribed when Stripe has a live subscription the webhook has not stored yet", async () => {
    const { d, createCheckoutSession, hasLiveSubscription } = deps({ status: null, stripeActive: true });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_subscribed" });
    expect(hasLiveSubscription).toHaveBeenCalledWith(CUSTOMER);
    expect(createCheckoutSession).not.toHaveBeenCalled();
  });

  it("builds the return URLs from siteUrl when it is set, not from the request host", async () => {
    const { d, createCheckoutSession } = deps({ siteUrl: "https://app.example.test/" });
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        successUrl: "https://app.example.test/dashboard?paid=1",
        cancelUrl: "https://app.example.test/dashboard",
      }),
    );
  });

  it.each(["active", "trialing"])("answers 409 already_subscribed when the stored status is %s", async (status) => {
    const { d, createCheckoutSession, getOrCreateCustomer } = deps({ status });
    const res = await handleCheckout(post("/api/stripe/checkout"), d);
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "already_subscribed" });
    expect(createCheckoutSession).not.toHaveBeenCalled();
    expect(getOrCreateCustomer).not.toHaveBeenCalled();
  });

  it.each([null, "canceled", "past_due", "incomplete_expired"])("still creates a checkout when the stored status is %s", async (status) => {
    const { d, createCheckoutSession } = deps({ status });
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(200);
    expect(createCheckoutSession).toHaveBeenCalledTimes(1);
  });

  it("creates a subscription checkout for the parent's customer and answers its url", async () => {
    const { d, getOrCreateCustomer, createCheckoutSession } = deps();
    const res = await handleCheckout(post("/api/stripe/checkout"), d);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.example.test/s" });
    expect(getOrCreateCustomer).toHaveBeenCalledWith(PARENT);
    expect(createCheckoutSession).toHaveBeenCalledWith({
      customer: CUSTOMER,
      priceId: PRICE,
      parentId: PARENT,
      successUrl: "https://demo.example.test/dashboard?paid=1",
      cancelUrl: "https://demo.example.test/dashboard",
    });
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

  it("answers 502 when Stripe fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, createCheckoutSession } = deps();
    createCheckoutSession.mockRejectedValue(new Error("stripe down"));
    expect((await handleCheckout(post("/api/stripe/checkout"), d)).status).toBe(502);
  });
});

describe("POST /api/stripe/portal (FR-46)", () => {
  function deps({ parentId = PARENT as string | null, customer = CUSTOMER as string | null, siteUrl = undefined as string | undefined } = {}) {
    const createPortalSession = vi.fn().mockResolvedValue({ url: "https://portal.example.test/p" });
    return { d: { getParentId: async () => parentId, siteUrl, getCustomer: async () => customer, createPortalSession }, createPortalSession };
  }

  it("returns to siteUrl when it is set", async () => {
    const { d, createPortalSession } = deps({ siteUrl: "https://app.example.test" });
    expect((await handlePortal(post("/api/stripe/portal"), d)).status).toBe(200);
    expect(createPortalSession).toHaveBeenCalledWith({ customer: CUSTOMER, returnUrl: "https://app.example.test/dashboard" });
  });

  it("opens the portal for the parent's customer, returning to the dashboard", async () => {
    const { d, createPortalSession } = deps();
    const res = await handlePortal(post("/api/stripe/portal"), d);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://portal.example.test/p" });
    expect(createPortalSession).toHaveBeenCalledWith({ customer: CUSTOMER, returnUrl: "https://demo.example.test/dashboard" });
  });

  it("answers 404 for a parent who never subscribed", async () => {
    const { d, createPortalSession } = deps({ customer: null });
    const res = await handlePortal(post("/api/stripe/portal"), d);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "no_subscription" });
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it("answers 401 when no parent is logged in", async () => {
    const { d } = deps({ parentId: null });
    expect((await handlePortal(post("/api/stripe/portal"), d)).status).toBe(401);
  });
});

describe("POST /api/stripe/webhook (FR-47)", () => {
  function event(type: string, status = "active", created = 1_760_000_000) {
    return JSON.stringify({
      id: "evt_synthetic",
      object: "event",
      type,
      created,
      data: { object: { id: "sub_synthetic", object: "subscription", customer: CUSTOMER, status } },
    });
  }

  function deps(current = "active") {
    const record = vi.fn<(u: SubscriptionUpdate) => Promise<string>>().mockResolvedValue("updated");
    const verify = (payload: string, signature: string) => stripe.webhooks.constructEvent(payload, signature, SIGNING);
    const retrieveSubscription = vi.fn(async (id: string) => ({ id, status: current, customer: CUSTOMER }) as unknown as Stripe.Subscription);
    return { d: { verify, record, retrieveSubscription }, record, retrieveSubscription };
  }

  function signed(payload: string, secret = SIGNING) { // check-secrets: allow
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret }); // check-secrets: allow
    return post("/api/stripe/webhook", payload, { "content-type": "application/json", "stripe-signature": signature });
  }

  it.each([
    ["customer.subscription.created", "active"],
    ["customer.subscription.updated", "past_due"],
    ["customer.subscription.deleted", "canceled"],
  ])("records %s with the subscription status", async (type, status) => {
    const { d, record } = deps(status);
    const res = await handleWebhook(signed(event(type, status)), d);

    expect(res.status).toBe(200);
    expect(record).toHaveBeenCalledWith({
      customerId: CUSTOMER,
      subscriptionId: "sub_synthetic",
      status,
      eventCreated: new Date(1_760_000_000 * 1000),
    });
  });

  it("records the status of the retrieved subscription when an older event is delivered last", async () => {
    const { d, record, retrieveSubscription } = deps("canceled");
    const res = await handleWebhook(signed(event("customer.subscription.created", "active")), d);

    expect(res.status).toBe(200);
    expect(retrieveSubscription).toHaveBeenCalledWith("sub_synthetic");
    expect(record).toHaveBeenCalledWith({
      customerId: CUSTOMER,
      subscriptionId: "sub_synthetic",
      status: "canceled",
      eventCreated: new Date(1_760_000_000 * 1000),
    });
  });

  it("answers 500 when the subscription cannot be retrieved, so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, record, retrieveSubscription } = deps();
    retrieveSubscription.mockRejectedValue(new Error("stripe down"));
    const res = await handleWebhook(signed(event("customer.subscription.updated")), d);
    expect(res.status).toBe(500);
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects a bad signature with 400 and records nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, record } = deps();
    const res = await handleWebhook(signed(event("customer.subscription.updated"), "another-signing-value"), d);

    expect(res.status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });

  it("rejects a missing signature with 400", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { d, record } = deps();
    const res = await handleWebhook(post("/api/stripe/webhook", event("customer.subscription.updated")), d);
    expect(res.status).toBe(400);
    expect(record).not.toHaveBeenCalled();
  });

  it("acknowledges other event types without recording them", async () => {
    const { d, record } = deps();
    const res = await handleWebhook(signed(event("invoice.paid")), d);
    expect(res.status).toBe(200);
    expect(record).not.toHaveBeenCalled();
  });

  it("answers 500 when recording fails, so Stripe retries", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { d, record } = deps();
    record.mockRejectedValue(new Error("db down"));
    expect((await handleWebhook(signed(event("customer.subscription.updated")), d)).status).toBe(500);
  });
});
