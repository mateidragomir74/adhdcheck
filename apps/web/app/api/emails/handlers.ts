import { z } from "zod";
import { missionAddedEmail, weeklySummaryEmail } from "../../../lib/email/messages";
import type { EmailSender } from "../../../lib/email/sender";
import type { RateLimiter } from "../../../lib/rate-limit";

// FR-50 parent emails: "new mission" and "weekly summary". Both go to the logged-in parent's own address,
// carry only the dashboard link (no result, no nickname), and answer 200 with the email outcome even when
// sending fails, so the action that triggered them is never undone. Nothing is logged but error codes.

// emailConfirmed: the address passed Supabase's confirmation, so an email goes only to a mailbox its owner proved.
type Parent = { id: string; email: string; emailConfirmed: boolean };
type Deps = {
  email: EmailSender;
  getParent(): Promise<Parent | null>;
  // One bucket per parent for every /api/emails/* route (R3-E2).
  rateLimiter: RateLimiter;
  // SITE_URL: where the dashboard link points (R3-E4); never taken from the request.
  siteUrl: string | undefined;
  now?: () => Date;
};

// TODO: limit not decided (docs/02 NFR-13). Placeholder: 10 emails a minute per parent, for all email routes.
export const EMAILS_RATE_LIMIT = { limit: 10, windowSeconds: 60 };
// One weekly summary per parent per ISO week. Resend keeps an idempotency key for 24 hours only
// (https://resend.com/docs/dashboard/emails/idempotency-keys), so the week is enforced here, with a bucket per
// parent and week. The window outlasts the week, and the key changes with the week. A send that fails still
// uses the week's slot (the limiter cannot give it back).
export const WEEKLY_EMAIL_LIMIT = { limit: 1, windowSeconds: 8 * 86_400 };

// The checks every email route runs first. Returns the parent, or the response to send.
async function guard(deps: Deps): Promise<{ parent: Parent } | { response: Response }> {
  const parent = await deps.getParent();
  if (!parent) return { response: fail(401, "not_logged_in") };
  if (!parent.emailConfirmed) return { response: fail(403, "email_not_confirmed") };
  try {
    if (!(await deps.rateLimiter.take(`emails:${parent.id}`))) return { response: fail(429, "rate_limited") };
  } catch {
    console.error("[emails] failed", { error: "storage_unavailable" });
    return { response: fail(503, "storage_unavailable") };
  }
  return { parent };
}

// The link in the email; null (and the email is skipped) when SITE_URL is not set.
function dashboardUrl(deps: Deps): string | null {
  const site = deps.siteUrl?.trim().replace(/\/+$/, "");
  if (!site) {
    console.error("[emails] skipped", { error: "site_url_not_configured" });
    return null;
  }
  return `${site}/parent`;
}

function fail(status: number, error: string) {
  return Response.json({ error }, { status, headers: { "cache-control": "no-store" } });
}

const MissionBody = z.strictObject({ mission_id: z.guid() });

// POST /api/emails/mission { mission_id }, called by the parent page right after a mission is added.
export async function handleMissionEmail(
  request: Request,
  deps: Deps & { missionIsOwn(missionId: string): Promise<boolean> },
): Promise<Response> {
  const checked = await guard(deps);
  if ("response" in checked) return checked.response;
  const { parent } = checked;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_input");
  }
  const parsed = MissionBody.safeParse(body);
  if (!parsed.success) return fail(400, "invalid_input");
  const missionId = parsed.data.mission_id;

  if (!(await deps.missionIsOwn(missionId))) return fail(404, "unknown_mission");

  const link = dashboardUrl(deps);
  if (!link) return Response.json({ email: "skipped" }, { headers: { "cache-control": "no-store" } });
  const email = await deps.email.send({
    to: parent.email,
    message: missionAddedEmail(link),
    idempotencyKey: `mission-added/${missionId}`,
  });
  return Response.json({ email }, { headers: { "cache-control": "no-store" } });
}

// POST /api/emails/weekly: the weekly summary, sent on request until a scheduler exists (TODO: a weekly
// job). The key holds the ISO week, so a parent gets at most one per week.
export async function handleWeeklySummaryEmail(_request: Request, deps: Deps): Promise<Response> {
  const checked = await guard(deps);
  if ("response" in checked) return checked.response;
  const { parent } = checked;

  const link = dashboardUrl(deps);
  if (!link) return Response.json({ email: "skipped" }, { headers: { "cache-control": "no-store" } });
  const week = isoWeek((deps.now ?? (() => new Date()))());
  try {
    if (!(await deps.rateLimiter.take(`weekly-email:${parent.id}:${week}`, WEEKLY_EMAIL_LIMIT))) {
      return Response.json({ email: "already_sent" }, { headers: { "cache-control": "no-store" } });
    }
  } catch {
    console.error("[emails] failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }
  const email = await deps.email.send({
    to: parent.email,
    message: weeklySummaryEmail(link),
    idempotencyKey: `weekly-summary/${parent.id}/${week}`,
  });
  return Response.json({ email }, { headers: { "cache-control": "no-store" } });
}

// ISO 8601 week, for example "2026-W43" (weeks start on Monday; week 1 holds the year's first Thursday).
export function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
