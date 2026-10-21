import { createHash } from "node:crypto";
import { z } from "zod";
import { waitlistEmail } from "../../../lib/email/messages";
import type { EmailSender } from "../../../lib/email/sender";
import { clientKey, type RateLimiter } from "../../../lib/rate-limit";

// POST /api/waitlist: early-access sign-ups from the landing page (FR-42). Stores the address (lower case)
// and the page language; an address already listed gets the same answer and is stored once.
// The address is never logged (only language and time). Rate limited per client like /api/sessions.
// FR-50: a confirmation email in the page language, sent only when the address is NEW on the list (so the
// form cannot be used to mail one address again), within a global daily cap on confirmation emails, and
// after the answer has gone (R3-E1, R3-E5). The idempotency key is a hash of the address as a second guard.
// It never changes the answer.

export interface WaitlistStore {
  // true when the address was added now, false when it was already on the list.
  add(email: string, lang: "ro" | "en"): Promise<boolean>;
}

// TODO: limit not decided (docs/02 NFR-13). Placeholder: 100 confirmation emails a day for the whole site.
export const WAITLIST_EMAIL_DAILY_CAP = { limit: 100, windowSeconds: 86_400 };
export const WAITLIST_EMAIL_CAP_KEY = "waitlist-confirmation-emails";

const Body = z.strictObject({ email: z.email().max(254), lang: z.enum(["ro", "en"]) });

export async function handleWaitlistPost(
  request: Request,
  deps: {
    store: WaitlistStore;
    rateLimiter: RateLimiter;
    // One shared bucket (WAITLIST_EMAIL_CAP_KEY) for the whole site.
    emailCap: RateLimiter;
    email: EmailSender;
    // Runs the task after the response (Next after()).
    defer: (task: () => Promise<void>) => void;
  },
): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return Response.json({ ok: false }, { status: 415 });

  try {
    if (!(await deps.rateLimiter.take(clientKey(request, "waitlist")))) {
      return Response.json({ ok: false }, { status: 429 });
    }
  } catch {
    console.error("[waitlist] failed", { error: "storage_unavailable" });
    return Response.json({ ok: false }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { email, lang: language } = parsed.data;

  const address = email.toLowerCase();
  let isNew: boolean;
  try {
    isNew = await deps.store.add(address, language);
  } catch {
    console.error("[waitlist] failed", { error: "storage_unavailable" });
    return Response.json({ ok: false }, { status: 503 });
  }

  if (isNew) {
    deps.defer(async () => {
      try {
        if (!(await deps.emailCap.take(WAITLIST_EMAIL_CAP_KEY))) {
          console.warn("[waitlist] confirmation skipped", { error: "daily_cap_reached" });
          return;
        }
        await deps.email.send({
          to: address,
          message: waitlistEmail(language),
          idempotencyKey: `waitlist/${createHash("sha256").update(address).digest("hex")}`,
        });
      } catch {
        console.error("[waitlist] confirmation failed", { error: "email_unavailable" });
      }
    });
  }

  console.log("[waitlist] signup received", { lang: language, at: new Date().toISOString() });
  return Response.json({ ok: true });
}
