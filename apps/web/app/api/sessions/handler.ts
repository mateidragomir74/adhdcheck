import { ScoreResultSchema, SessionMetricsSchema } from "@adhdcheck/contracts";
import type { z } from "zod";
import { scoreSession } from "@adhdcheck/scoring";
import { hashPlayCode, readBearerCode } from "../../../lib/play-link";
import { clientKey, type RateLimiter } from "../../../lib/rate-limit";
import { InvalidPlayLinkError, type SessionStore } from "./store";

// POST /api/sessions (FR-11): validate SessionMetrics v1, score it, save session, trials and score,
// return the ScoreResult. A short session is saved and scored like any other; the scorer gives it
// band insufficient_data (FR-20, decided: no 4xx). Scoring is deterministic, so a repeated
// session_id is stored once and answered with the same result (FR-12).
// The child's device proves it was sent by a parent with the play link code (FR-01), and posts
// are rate limited per client address (NFR-13), checked first so a burst costs no parsing.
// Errors are logged by code only: no session content, no ids, no code (NFR-02).

// Server limits on one upload (NFR-13), so a bad or hostile client cannot make one request costly.
// Lantern Watch is designed at 3 blocks of 48 trials plus 10 calibration trials (docs/02 FR-04, a
// PROPOSAL), so these leave wide room. Placeholders: TODO confirm with the game owner.
export const MAX_TRIALS = 1000;
export const MAX_OFF_TARGET_TAPS = 1000;
export const MAX_BODY_BYTES = 1_000_000;

// The contract (frozen v1) plus the server limits. A repeated trial index would break the trials key in
// the database, so it is refused here with the field named, not reported later as a storage error.
const UploadSchema = SessionMetricsSchema.superRefine((s, ctx) => {
  if (s.trials.length > MAX_TRIALS) ctx.addIssue({ code: "custom", path: ["trials"], message: "too_big" });
  if (s.off_target_taps.length > MAX_OFF_TARGET_TAPS)
    ctx.addIssue({ code: "custom", path: ["off_target_taps"], message: "too_big" });
  const seen = new Set<number>();
  s.trials.forEach((t, n) => {
    if (seen.has(t.i)) ctx.addIssue({ code: "custom", path: ["trials", n, "i"], message: "duplicate" });
    seen.add(t.i);
  });
});

// Custom issues carry their own short code in the message; zod issues keep theirs.
function issueCode(issue: z.core.$ZodIssue) {
  return issue.code === "custom" ? issue.message : issue.code;
}

type ErrorCode =
  | "too_many_requests"
  | "too_large"
  | "invalid_play_link"
  | "invalid_json"
  | "invalid_session"
  | "scoring_failed"
  | "storage_unavailable";

// Reads the body as UTF-8 text, or returns null as soon as it passes maxBytes (the stream is cancelled).
export async function readTextWithin(request: Request, maxBytes: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}

function fail(status: number, error: ErrorCode, extra?: object) {
  return Response.json({ error, ...extra }, { status });
}

export async function handleSessionPost(
  request: Request,
  deps: { store: SessionStore; rateLimiter: RateLimiter },
): Promise<Response> {
  try {
    if (!(await deps.rateLimiter.take(clientKey(request, "sessions")))) {
      console.warn("[sessions] rejected", { error: "too_many_requests" });
      return fail(429, "too_many_requests");
    }
  } catch {
    console.error("[sessions] failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }

  const code = readBearerCode(request);
  if (!code) {
    console.warn("[sessions] rejected", { error: "invalid_play_link" });
    return fail(401, "invalid_play_link");
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    console.warn("[sessions] rejected", { error: "too_large" });
    return fail(413, "too_large");
  }

  // The header is only a fast path: a streamed (chunked) upload has no content-length, so the body is
  // also counted while it is read, and reading stops at the limit.
  let text: string | null;
  try {
    text = await readTextWithin(request, MAX_BODY_BYTES);
  } catch {
    console.warn("[sessions] rejected", { error: "invalid_json" });
    return fail(400, "invalid_json");
  }
  if (text === null) {
    console.warn("[sessions] rejected", { error: "too_large" });
    return fail(413, "too_large");
  }

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    console.warn("[sessions] rejected", { error: "invalid_json" });
    return fail(400, "invalid_json");
  }

  // The parse itself must never throw into a 500 (a hostile body is a 400): no field of the contract recurses
  // without a bound, and anything unexpected is still answered as an invalid session.
  let parsed: ReturnType<typeof UploadSchema.safeParse>;
  try {
    parsed = UploadSchema.safeParse(body);
  } catch {
    console.warn("[sessions] rejected", { error: "invalid_session", issues: 0 });
    return fail(400, "invalid_session", { issues: [] });
  }
  if (!parsed.success) {
    // Field paths and issue codes only: the values could hold anything the client sent.
    const issues = parsed.error.issues.map((i) => ({ path: i.path.join("."), code: issueCode(i) }));
    console.warn("[sessions] rejected", { error: "invalid_session", issues: issues.length });
    return fail(400, "invalid_session", { issues });
  }
  const session = parsed.data;

  let score;
  try {
    // Re-check the scorer output so no field outside the contract is ever saved.
    score = ScoreResultSchema.parse(scoreSession(session));
  } catch {
    console.error("[sessions] failed", { error: "scoring_failed" });
    return fail(500, "scoring_failed");
  }

  try {
    const { created } = await deps.store.save(hashPlayCode(code), session, score);
    return Response.json(score, { status: created ? 201 : 200 });
  } catch (err) {
    if (err instanceof InvalidPlayLinkError) {
      console.warn("[sessions] rejected", { error: "invalid_play_link" });
      return fail(401, "invalid_play_link");
    }
    console.error("[sessions] failed", { error: "storage_unavailable" });
    return fail(503, "storage_unavailable");
  }
}
