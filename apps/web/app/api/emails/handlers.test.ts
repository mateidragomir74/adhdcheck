import { afterEach, describe, expect, it, vi } from "vitest";
import { missionAddedEmail, weeklySummaryEmail } from "../../../lib/email/messages";
import type { EmailSender } from "../../../lib/email/sender";
import type { RateLimiter } from "../../../lib/rate-limit";
import { handleMissionEmail, handleWeeklySummaryEmail, isoWeek, WEEKLY_EMAIL_LIMIT } from "./handlers";

const PARENT = { id: "00000000-0000-4000-8000-00000000000a", email: "parent.synthetic@example.test" };
const MISSION = "00000000-0000-4000-8000-0000000000aa";
const SITE = "https://site.example.test";
const DASHBOARD = `${SITE}/parent`;

function request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function deps(
  o: Partial<{ parent: { id: string; email: string; emailConfirmed: boolean } | null; owns: boolean; result: string; allow: boolean; siteUrl: string | undefined }> = {},
) {
  const c = { parent: { ...PARENT, emailConfirmed: true } as { id: string; email: string; emailConfirmed: boolean } | null, owns: true, result: "sent", allow: true, siteUrl: SITE as string | undefined, ...o };
  const email = { send: vi.fn().mockResolvedValue(c.result) } satisfies EmailSender;
  const missionIsOwn = vi.fn().mockResolvedValue(c.owns);
  const take = vi.fn<RateLimiter["take"]>().mockResolvedValue(c.allow);
  return { email, missionIsOwn, rateLimiter: { take } satisfies RateLimiter, take, siteUrl: c.siteUrl, getParent: async () => c.parent, now: () => new Date("2026-10-20T12:00:00Z") };
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/emails/mission (FR-50 new mission)", () => {
  it("emails the logged-in parent a link to the dashboard, once per mission", async () => {
    const d = deps();
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "sent" });
    expect(d.missionIsOwn).toHaveBeenCalledWith(MISSION);
    expect(d.email.send).toHaveBeenCalledWith({
      to: PARENT.email,
      message: missionAddedEmail(DASHBOARD),
      idempotencyKey: `mission-added/${MISSION}`,
    });
  });

  it("answers 401 without a logged-in parent and sends nothing", async () => {
    const d = deps({ parent: null });
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(res.status).toBe(401);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("answers 404 for a mission that is not the parent's and sends nothing", async () => {
    const d = deps({ owns: false });
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(res.status).toBe(404);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it.each([[{}], [{ mission_id: "nope" }], [{ mission_id: MISSION, extra: 1 }]])("answers 400 for %j", async (body) => {
    const d = deps();
    expect((await handleMissionEmail(request("/api/emails/mission", body), d)).status).toBe(400);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  // R3-E2
  it("R3-E2 refuses a parent whose address is not confirmed, and sends nothing", async () => {
    const d = deps({ parent: { ...PARENT, emailConfirmed: false } });
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(res.status).toBe(403);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("R3-E2 answers 429 when the rate limit is reached, and sends nothing", async () => {
    const d = deps({ allow: false });
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(res.status).toBe(429);
    expect(d.email.send).not.toHaveBeenCalled();
    expect(d.take).toHaveBeenCalledWith(`emails:${PARENT.id}`);
  });

  it("R3-E2 answers 503 and sends nothing when the rate limiter is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps();
    d.take.mockRejectedValue(new Error("down"));
    expect((await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d)).status).toBe(503);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("R3-E4 builds the dashboard link from SITE_URL, never from the request origin", async () => {
    const d = deps({ siteUrl: "https://configured.example.test/" });
    await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(d.email.send.mock.calls[0]![0].message.text).toContain("https://configured.example.test/parent");
    expect(d.email.send.mock.calls[0]![0].message.text).not.toContain("localhost");
  });

  it("R3-E4 sends nothing and answers skipped when SITE_URL is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ siteUrl: undefined });
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), d);
    expect(await res.json()).toEqual({ email: "skipped" });
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("answers 200 with the email outcome when sending fails, so the mission itself stays added", async () => {
    const res = await handleMissionEmail(request("/api/emails/mission", { mission_id: MISSION }), deps({ result: "failed" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ email: "failed" });
  });
});

describe("POST /api/emails/weekly (FR-50 weekly summary)", () => {
  it("emails the logged-in parent the dashboard link, at most once per ISO week", async () => {
    const d = deps();
    const res = await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d);

    expect(res.status).toBe(200);
    expect(d.email.send).toHaveBeenCalledWith({
      to: PARENT.email,
      message: weeklySummaryEmail(DASHBOARD),
      idempotencyKey: `weekly-summary/${PARENT.id}/2026-W43`,
    });
  });

  // R4-6: Resend keeps an idempotency key 24 hours (https://resend.com/docs/dashboard/emails/idempotency-keys),
  // so "at most one per week" is enforced here, with a bucket per parent per ISO week.
  it("R4-6 takes one slot per parent per ISO week, and sends nothing when this week's slot is used", async () => {
    const d = deps();
    d.take.mockImplementation(async (key) => !key.startsWith("weekly-email:"));
    const res = await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d);
    expect(await res.json()).toEqual({ email: "already_sent" });
    expect(d.take).toHaveBeenCalledWith(`weekly-email:${PARENT.id}:2026-W43`, WEEKLY_EMAIL_LIMIT);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("R4-6 sends when the week's slot is free, and a new week has a new slot", async () => {
    const d = deps();
    await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d);
    expect(d.email.send).toHaveBeenCalledTimes(1);
    const later = { ...deps(), now: () => new Date("2026-10-27T12:00:00Z") };
    await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), later);
    expect(later.take).toHaveBeenCalledWith(`weekly-email:${PARENT.id}:2026-W44`, WEEKLY_EMAIL_LIMIT);
  });

  it("R4-6 does not use up the week's slot when the email cannot be built (no SITE_URL)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ siteUrl: undefined });
    await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d);
    expect(d.take.mock.calls.some(([key]) => key.startsWith("weekly-email:"))).toBe(false);
  });

  it("R4-6 answers 503 and sends nothing when the weekly counter is down", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps();
    d.take.mockImplementation(async (key) => {
      if (key.startsWith("weekly-email:")) throw new Error("down");
      return true;
    });
    expect((await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d)).status).toBe(503);
    expect(d.email.send).not.toHaveBeenCalled();
  });

  it("R3-E2 refuses an unconfirmed address and rate limits the weekly route too", async () => {
    const unconfirmed = deps({ parent: { ...PARENT, emailConfirmed: false } });
    expect((await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), unconfirmed)).status).toBe(403);
    expect(unconfirmed.email.send).not.toHaveBeenCalled();
    const limited = deps({ allow: false });
    expect((await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), limited)).status).toBe(429);
    expect(limited.email.send).not.toHaveBeenCalled();
  });

  it("answers 401 without a logged-in parent", async () => {
    const d = deps({ parent: null });
    expect((await handleWeeklySummaryEmail(request("/api/emails/weekly", {}), d)).status).toBe(401);
    expect(d.email.send).not.toHaveBeenCalled();
  });
});

describe("isoWeek", () => {
  it.each([
    ["2026-10-20T12:00:00Z", "2026-W43"],
    ["2026-01-01T12:00:00Z", "2026-W01"],
    ["2027-01-01T12:00:00Z", "2026-W53"],
  ])("%s is %s", (iso, week) => {
    expect(isoWeek(new Date(iso))).toBe(week);
  });
});
