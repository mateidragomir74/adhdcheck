import { afterEach, describe, expect, it, vi } from "vitest";
import { createEmailSender, DEFAULT_EMAIL_FROM, resolveEmailFrom, type EmailTransport } from "./sender";

const message = { subject: "Hello", text: "Body", html: "<p>Body</p>" };
const to = "parent.synthetic@example.test";
const noWait = async () => {};

afterEach(() => vi.restoreAllMocks());

describe("createEmailSender (FR-50)", () => {
  it("sends from the project sender with the idempotency key", async () => {
    const transport = vi.fn<EmailTransport>().mockResolvedValue({ data: { id: "e1" }, error: null });
    const result = await createEmailSender(transport, { sleep: noWait }).send({ to, message, idempotencyKey: "k1" });

    expect(result).toBe("sent");
    expect(transport).toHaveBeenCalledWith({ from: DEFAULT_EMAIL_FROM, to: [to], ...message }, { idempotencyKey: "k1" });
  });

  it("sends from the configured sender when one is given", async () => {
    const transport = vi.fn<EmailTransport>().mockResolvedValue({ data: { id: "e1" }, error: null });
    await createEmailSender(transport, { sleep: noWait, from: "ADHDCheck <hello@verified.example.test>" }).send({ to, message, idempotencyKey: "k1" });
    expect(transport.mock.calls[0]![0].from).toBe("ADHDCheck <hello@verified.example.test>");
  });

  it("skips (and sends nothing) when there is no sender address", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const transport = vi.fn<EmailTransport>();
    expect(await createEmailSender(transport, { from: null }).send({ to, message, idempotencyKey: "k1" })).toBe("skipped");
    expect(transport).not.toHaveBeenCalled();
  });

  // R3-E5
  it("R3-E5 gives up on a provider that never answers, instead of holding the caller", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = vi.fn<EmailTransport>(() => new Promise(() => {}));
    expect(await createEmailSender(transport, { sleep: noWait, timeoutMs: 20 }).send({ to, message, idempotencyKey: "k1" })).toBe("failed");
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it("skips quietly when no key is configured", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await createEmailSender(null).send({ to, message, idempotencyKey: "k1" })).toBe("skipped");
    expect(JSON.stringify(warn.mock.calls)).toContain("email_not_configured");
  });

  it("retries a transient error, then succeeds", async () => {
    const transport = vi
      .fn<EmailTransport>()
      .mockResolvedValueOnce({ data: null, error: { name: "rate_limit_exceeded", message: "slow down", statusCode: 429 } })
      .mockResolvedValueOnce({ data: { id: "e1" }, error: null });
    expect(await createEmailSender(transport, { sleep: noWait }).send({ to, message, idempotencyKey: "k1" })).toBe("sent");
    expect(transport).toHaveBeenCalledTimes(2);
  });

  it("does not retry a permanent error, and logs its name but never the address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = vi
      .fn<EmailTransport>()
      .mockResolvedValue({ data: null, error: { name: "validation_error", message: `cannot send to ${to}`, statusCode: 403 } });
    expect(await createEmailSender(transport, { sleep: noWait }).send({ to, message, idempotencyKey: "k1" })).toBe("failed");
    expect(transport).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(error.mock.calls);
    expect(logged).toContain("validation_error");
    expect(logged).not.toContain(to);
  });

  it("answers failed, without throwing, when the transport throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = vi.fn<EmailTransport>().mockRejectedValue(new Error("network down"));
    expect(await createEmailSender(transport, { sleep: noWait }).send({ to, message, idempotencyKey: "k1" })).toBe("failed");
  });
});

describe("resolveEmailFrom (one sender setting, EMAIL_FROM, for every email)", () => {
  it("uses EMAIL_FROM when set", () => {
    expect(resolveEmailFrom({ EMAIL_FROM: " ADHDCheck <hello@verified.example.test> ", NODE_ENV: "production" })).toBe("ADHDCheck <hello@verified.example.test>");
  });
  it("falls back to the Resend test sender outside production only", () => {
    expect(resolveEmailFrom({ NODE_ENV: "development" })).toBe(DEFAULT_EMAIL_FROM);
    expect(resolveEmailFrom({ EMAIL_FROM: "  ", NODE_ENV: "test" })).toBe(DEFAULT_EMAIL_FROM);
    expect(resolveEmailFrom({ NODE_ENV: "production" })).toBeNull();
  });
});
