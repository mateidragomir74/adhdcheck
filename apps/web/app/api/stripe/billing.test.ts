import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Resend } from "resend";
import { getParentEmail, markNotPaid, resendMailer } from "./billing";
import type { ReportMail } from "./handlers";

const MAIL: ReportMail = {
  to: "parent@example.test",
  subject: "s",
  text: "t",
  html: "<p>t</p>",
  idempotencyKey: "report-email/cs_test",
};

function adminWith(user: { email?: string; email_confirmed_at?: string | null } | null) {
  const getUserById = vi.fn().mockResolvedValue({ data: { user }, error: null });
  return { admin: { auth: { admin: { getUserById } } } as unknown as SupabaseClient };
}

describe("getParentEmail (R3-P5)", () => {
  it("returns the address of a confirmed user", async () => {
    const { admin } = adminWith({ email: "a@example.test", email_confirmed_at: "2026-10-01T00:00:00Z" });
    expect(await getParentEmail(admin, "p")).toBe("a@example.test");
  });
  it.each([
    ["null", null],
    ["missing", undefined],
  ])("returns null for an address that is not confirmed (%s)", async (_n, at) => {
    const { admin } = adminWith({ email: "a@example.test", email_confirmed_at: at });
    expect(await getParentEmail(admin, "p")).toBeNull();
  });
});

describe("resendMailer (R3-P3)", () => {
  function resendReturning(error: { statusCode: number | null; name: string } | null) {
    const send = vi.fn().mockResolvedValue({ data: error ? null : { id: "e" }, error });
    return { resend: { emails: { send } } as unknown as Resend, send };
  }
  it("accepts an accepted email", async () => {
    expect(await resendMailer(resendReturning(null).resend, "f@example.test").send(MAIL)).toEqual({ ok: true });
  });
  it("R3-D1 sends the message with its idempotency key and no attachment", async () => {
    const { resend, send } = resendReturning(null);
    await resendMailer(resend, "f@example.test").send(MAIL);
    const [payload, options] = send.mock.calls[0] as [Record<string, unknown>, { idempotencyKey: string }];
    expect(payload).not.toHaveProperty("attachments");
    expect(payload).toMatchObject({ from: "f@example.test", to: ["parent@example.test"], subject: "s", text: "t", html: "<p>t</p>" });
    expect(options).toEqual({ idempotencyKey: "report-email/cs_test" });
  });
  it("treats 409 invalid_idempotent_request as already sent (the first attempt went out)", async () => {
    const { resend } = resendReturning({ statusCode: 409, name: "invalid_idempotent_request" });
    expect(await resendMailer(resend, "f@example.test").send(MAIL)).toEqual({ ok: true });
  });
  it("treats 409 concurrent_idempotent_requests as transient, so Stripe retries", async () => {
    const { resend } = resendReturning({ statusCode: 409, name: "concurrent_idempotent_requests" });
    expect(await resendMailer(resend, "f@example.test").send(MAIL)).toEqual({ ok: false, permanent: false });
  });
  it("treats another 4xx as permanent and a 429 or 5xx as transient", async () => {
    const m = (e: { statusCode: number; name: string }) => resendMailer(resendReturning(e).resend, "f@example.test").send(MAIL);
    expect(await m({ statusCode: 403, name: "validation_error" })).toEqual({ ok: false, permanent: true });
    expect(await m({ statusCode: 429, name: "rate_limit_exceeded" })).toEqual({ ok: false, permanent: false });
    expect(await m({ statusCode: 500, name: "application_error" })).toEqual({ ok: false, permanent: false });
  });
});

describe("markNotPaid (R4-2)", () => {
  it("calls mark_report_not_paid with the checkout id and the status", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null });
    await markNotPaid({ rpc } as unknown as SupabaseClient, "cs_test", "failed");
    expect(rpc).toHaveBeenCalledWith("mark_report_not_paid", { p_checkout_id: "cs_test", p_status: "failed" });
  });
  it("throws when the database fails, so the webhook answers 500", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "down" } });
    await expect(markNotPaid({ rpc } as unknown as SupabaseClient, "cs_test", "expired")).rejects.toThrow();
  });
});
