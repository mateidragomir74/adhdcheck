import { afterEach, describe, expect, it, vi } from "vitest";
import type { EmailSender } from "../../../lib/email/sender";
import type { RateLimiter } from "../../../lib/rate-limit";
import { waitlistEmail } from "../../../lib/email/messages";
import { handleWaitlistPost, type WaitlistStore } from "./handler";

const EMAIL = "parent.synthetic@example.test";

function memoryStore() {
  const saved = new Map<string, string>();
  const store: WaitlistStore = {
    async add(email, lang) {
      if (saved.has(email)) return false;
      saved.set(email, lang);
      return true;
    },
  };
  return { store, saved };
}

const allowAll: RateLimiter = { take: async () => true };
const quietEmail = (): EmailSender & { send: ReturnType<typeof vi.fn> } => ({ send: vi.fn().mockResolvedValue("sent") });
const defers: Array<() => Promise<void>> = [];
const defer = (task: () => Promise<void>) => void defers.push(task);
async function flush() {
  while (defers.length) await defers.shift()!();
}

function post(
  body: unknown,
  { store = memoryStore().store, rateLimiter = allowAll, emailCap = allowAll as RateLimiter, contentType = "application/json", email = quietEmail() as EmailSender } = {},
) {
  return handleWaitlistPost(
    new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "content-type": contentType },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { store, rateLimiter, emailCap, email, defer },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  defers.length = 0;
});

describe("POST /api/waitlist confirmation email (FR-50)", () => {
  it("sends a confirmation in the page language, once per address (idempotency key without the address)", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = quietEmail();
    await post({ email: "Parent.Synthetic@Example.TEST", lang: "ro" }, { email });
    await flush();

    expect(email.send).toHaveBeenCalledTimes(1);
    const sent = email.send.mock.calls[0][0];
    expect(sent.to).toBe(EMAIL);
    expect(sent.message.subject).toBe(waitlistEmail("ro").subject);
    expect(sent.idempotencyKey).toMatch(/^waitlist\/[0-9a-f]{64}$/);
    expect(sent.idempotencyKey).not.toContain("synthetic");
  });

  it("still answers ok when the email cannot be sent", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = { send: vi.fn().mockResolvedValue("failed") };
    const res = await post({ email: EMAIL, lang: "en" }, { email });
    expect(await res.json()).toEqual({ ok: true });
  });

  it("sends nothing when the address could not be stored", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const email = quietEmail();
    const failing: WaitlistStore = { add: async () => Promise.reject(new Error("down")) };
    await post({ email: EMAIL, lang: "en" }, { store: failing, email });
    await flush();
    expect(email.send).not.toHaveBeenCalled();
  });

  // R3-E1: the form must not be a way to mail any address every day.
  it("R3-E1 sends the confirmation only for a NEW address: a second post of the same address sends nothing", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = quietEmail();
    const { store } = memoryStore();
    await post({ email: EMAIL, lang: "en" }, { store, email });
    await post({ email: EMAIL.toUpperCase(), lang: "en" }, { store, email });
    await flush();
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it("R3-E1 sends nothing once the global daily cap of confirmation emails is reached, and still answers ok", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = quietEmail();
    const emailCap: RateLimiter = { take: vi.fn().mockResolvedValue(false) };
    const res = await post({ email: EMAIL, lang: "en" }, { email, emailCap });
    await flush();
    expect(await res.json()).toEqual({ ok: true });
    expect(email.send).not.toHaveBeenCalled();
  });

  it("R3-E1 sends nothing, and still answers ok, when the cap counter is down", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const email = quietEmail();
    const emailCap: RateLimiter = { take: vi.fn().mockRejectedValue(new Error("down")) };
    const res = await post({ email: EMAIL, lang: "en" }, { email, emailCap });
    await flush();
    expect(await res.json()).toEqual({ ok: true });
    expect(email.send).not.toHaveBeenCalled();
  });

  // R3-E3: a mutation that adds Math.random() to the hashed address used to pass every test.
  it("R3-E3 gives the same address, in any case, the same idempotency key, and another address another key", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = quietEmail();
    const alwaysNew: WaitlistStore = { add: async () => true };
    await post({ email: "Parent.Synthetic@Example.TEST", lang: "en" }, { store: alwaysNew, email });
    await post({ email: EMAIL, lang: "en" }, { store: alwaysNew, email });
    await post({ email: "someone.else@example.test", lang: "en" }, { store: alwaysNew, email });
    await flush();
    const keys = email.send.mock.calls.map((c) => c[0].idempotencyKey);
    expect(keys).toHaveLength(3);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[2]).not.toBe(keys[0]);
  });

  // R3-E5: the confirmation is sent after the answer, so a slow provider cannot hold the request.
  it("R3-E5 does not wait for the email before answering", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const email = quietEmail();
    await post({ email: EMAIL, lang: "en" }, { email });
    expect(email.send).not.toHaveBeenCalled();
    await flush();
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/waitlist", () => {
  it("stores the address (lower case) with its language and answers ok", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post({ email: "Parent.Synthetic@Example.TEST", lang: "en" }, { store });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect([...saved]).toEqual([[EMAIL, "en"]]);
  });

  it("answers the same for an address already on the list, and stores it once", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const first = await post({ email: EMAIL, lang: "ro" }, { store });
    const second = await post({ email: EMAIL, lang: "ro" }, { store });

    expect(await second.json()).toEqual(await first.json());
    expect(saved.size).toBe(1);
  });

  it("rejects a language other than ro or en with 400 (was: defaulted to ro)", async () => {
    const { store, saved } = memoryStore();
    const res = await post({ email: EMAIL, lang: "xx" }, { store });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false });
    expect(saved.size).toBe(0);
  });

  it("rejects an unknown field with 400", async () => {
    const { store, saved } = memoryStore();
    const res = await post({ email: EMAIL, lang: "en", extra: 1 }, { store });
    expect(res.status).toBe(400);
    expect(saved.size).toBe(0);
  });

  it("never logs the email address", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await post({ email: EMAIL, lang: "en" });
    expect(res.status).toBe(200);
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain("example.test");
  });

  it("logs only the language and a timestamp", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await post({ email: EMAIL, lang: "en" });
    expect(log).toHaveBeenCalledTimes(1);
    const payload = log.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["at", "lang"]);
    expect(payload.lang).toBe("en");
  });

  it("rejects an invalid address with 400 and stores nothing", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post({ email: "not-an-email" }, { store });
    expect(res.status).toBe(400);
    expect(log).not.toHaveBeenCalled();
    expect(saved.size).toBe(0);
  });

  it("refuses a body not sent as JSON (blocks cross-site form posts)", async () => {
    const { store, saved } = memoryStore();
    const res = await post(JSON.stringify({ email: EMAIL }), { store, contentType: "text/plain" });
    expect(res.status).toBe(415);
    expect(saved.size).toBe(0);
  });

  it("answers 429 above the rate limit and stores nothing (NFR-13)", async () => {
    const { store, saved } = memoryStore();
    const take = vi.fn().mockResolvedValue(false);
    const res = await post({ email: EMAIL }, { store, rateLimiter: { take } });

    expect(res.status).toBe(429);
    expect(take.mock.calls[0][0]).toMatch(/^waitlist:/);
    expect(saved.size).toBe(0);
  });

  it("answers 503 with ok false when storing fails, without logging the address", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: WaitlistStore = {
      async add() {
        throw new Error(`insert failed for ${EMAIL}`);
      },
    };
    const res = await post({ email: EMAIL, lang: "ro" }, { store: failing });

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(JSON.stringify(error.mock.calls)).not.toContain(EMAIL);
  });
});
