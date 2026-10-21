import { ScoreResultSchema, type ScoreResult } from "@adhdcheck/contracts";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissionKey } from "../missions";
import { PROCESSING_CONSENT_VERSION } from "../processing-consent";

// Data for the parent pages (Person 4). Pass the logged-in parent's client (lib/supabase/server.ts in
// Server Components, lib/supabase/client.ts in Client Components): RLS returns only their own rows.
// Every score is checked against ScoreResult v1 before a page sees it. Errors throw; pages show their
// error state. Writes the parent may not do (sessions, scores) go through the API routes instead.

export type Child = { id: string; nickname: string; birth_year: number; created_at: string };

export type SessionResult = {
  session_id: string;
  child_id: string;
  started_at: string;
  duration_ms: number;
  // NFR-24: the chart shows the device per session; sessions on different devices are not comparable.
  device: { pointer_type: string; user_agent: string };
  // null until the session is scored.
  score: ScoreResult | null;
};

export type MissionRow = {
  id: string;
  child_id: string;
  mission_key: string;
  status: "todo" | "done";
  created_at: string;
  done_at: string | null;
};

export const SESSION_COLUMNS =
  "id, child_id, started_at, duration_ms, device, scores (scoring_method, validated, indicators, flags, band, data_quality, reasons, recommendations, disclaimer)";
const MISSION_COLUMNS = "id, child_id, mission_key, status, created_at, done_at";

function check<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what} failed: ${result.error.message}`);
  return result.data as T;
}

type SessionRow = {
  id: string;
  child_id: string;
  started_at: string;
  duration_ms: number;
  device: Record<string, unknown>;
  scores: unknown;
};

export function toSessionResult(row: SessionRow): SessionResult {
  const embedded = Array.isArray(row.scores) ? row.scores[0] : row.scores;
  const score = embedded
    ? ScoreResultSchema.parse({ schema_version: "1.0", session_id: row.id, ...(embedded as object) })
    : null;
  return {
    session_id: row.id,
    child_id: row.child_id,
    started_at: row.started_at,
    duration_ms: row.duration_ms,
    device: { pointer_type: String(row.device.pointer_type ?? ""), user_agent: String(row.device.user_agent ?? "") },
    score,
  };
}

// Intended purpose: children aged 6 to 12 (docs/02 section 2). The add-child form uses the same bounds.
export const MIN_AGE = 6;
export const MAX_AGE = 12;

// The longest nickname; the database check (migration 20261021120000_child_bounds) uses the same number.
// Placeholder: TODO texts owner confirms (docs/02 FR-31).
export const MAX_NICKNAME_LENGTH = 40;

// With the birth year only, the accepted years are (current year - 12) to (current year - 6), the same
// range the database trigger children_age_range enforces (migration 20261021100000_child_age_range).
export function birthYearRange(now: Date = new Date()) {
  const year = now.getUTCFullYear();
  return { min: year - MAX_AGE, max: year - MIN_AGE };
}

// FR-31: nickname and birth year only (NFR-01). Returns null when the input is not acceptable,
// including a birth year outside the 6 to 12 age range (checked on the server, not only in the form).
export function validateNewChild(input: unknown, now: Date = new Date()): { nickname: string; birth_year: number } | null {
  const { nickname, birth_year } = (input ?? {}) as { nickname?: unknown; birth_year?: unknown };
  if (typeof nickname !== "string") return null;
  const name = nickname.trim();
  if (name.length === 0 || name.length > MAX_NICKNAME_LENGTH) return null;
  if (typeof birth_year !== "number" || !Number.isInteger(birth_year)) return null;
  const { min, max } = birthYearRange(now);
  if (birth_year < min || birth_year > max) return null;
  return { nickname: name, birth_year };
}

export async function listChildren(client: SupabaseClient): Promise<Child[]> {
  const result = await client.from("children").select("id, nickname, birth_year, created_at").order("created_at");
  return check(result, "list children");
}

export async function createChild(client: SupabaseClient, input: unknown): Promise<Child> {
  const child = validateNewChild(input);
  if (!child) throw new Error("create child: nickname and a whole birth year are required");
  const result = await client.from("children").insert(child).select("id, nickname, birth_year, created_at").single();
  return check(result, "create child");
}

// Oldest first, for the progress chart (FR-38) and the history list.
export async function listSessionResults(client: SupabaseClient, childId: string): Promise<SessionResult[]> {
  const result = await client.from("sessions").select(SESSION_COLUMNS).eq("child_id", childId).order("started_at");
  return check<SessionRow[]>(result, "list sessions").map(toSessionResult);
}

// The result card (FR-33) for one session, or null when it does not exist or is not the parent's.
export async function getSessionResult(client: SupabaseClient, sessionId: string): Promise<SessionResult | null> {
  const result = await client.from("sessions").select(SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  const row = check<SessionRow | null>(result, "get session");
  return row ? toSessionResult(row) : null;
}

// FR-39: calls onScore when a new score of this parent is saved (Realtime, RLS applies).
// Subscribe as soon as the QR is shown: changes in the first seconds after subscribing can be missed,
// so also poll getSessionResult every 2 s while waiting. Returns the function that unsubscribes.
export function onNewScore(client: SupabaseClient, onScore: (sessionId: string) => void): () => void {
  const channel = client
    .channel(`scores-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "scores" }, (change) => {
      const sessionId = (change.new as { session_id?: unknown }).session_id;
      if (typeof sessionId === "string") onScore(sessionId);
    })
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

// NFR-04: whether the parent has agreed to the current consent text, and record that they do (RLS: the
// row is always the caller's own, and cannot be changed afterwards). POST /api/play-links checks the same.
export async function hasProcessingConsent(client: SupabaseClient): Promise<boolean> {
  const result = await client.from("processing_consents").select("id").eq("version", PROCESSING_CONSENT_VERSION).limit(1);
  return check<{ id: number }[]>(result, "read consent").length > 0;
}

export async function giveProcessingConsent(client: SupabaseClient): Promise<void> {
  const result = await client.from("processing_consents").insert({ version: PROCESSING_CONSENT_VERSION });
  check(result, "record consent");
}

// D-05b, FR-48: the purchase of one report by the logged-in parent (report_purchases, RLS: own rows only),
// the paid one first, or null before any checkout. Never gate the result card, next step or deletion on it.
export type ReportPurchase = { status: "pending" | "paid"; emailed_at: string | null };
export async function getReportPurchase(client: SupabaseClient, sessionId: string): Promise<ReportPurchase | null> {
  const result = await client
    .from("report_purchases")
    .select("status, emailed_at")
    .eq("session_id", sessionId)
    .in("status", ["pending", "paid"]) // failed and expired attempts are history, not the state of the report
    .order("paid_at", { ascending: false, nullsFirst: false })
    .limit(1);
  return check<ReportPurchase[]>(result, "read report purchase")[0] ?? null;
}

// R3-P1: the Stripe Checkout Session ids of this parent's pending purchases of one report, newest first, so a
// second checkout can be refused or resumed. RLS: own rows only.
export async function listPendingCheckoutIds(client: SupabaseClient, sessionId: string): Promise<string[]> {
  const result = await client
    .from("report_purchases")
    .select("stripe_checkout_session_id")
    .eq("session_id", sessionId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(5); // a Checkout lives 24 hours; failed and expired rows are not listed, so this stays short
  return check<{ stripe_checkout_session_id: string }[]>(result, "list pending checkouts").map((r) => r.stripe_checkout_session_id);
}

// R5-3: the Stripe Checkout Session id of this parent's newest failed or expired purchase of one report, or null.
// RLS: own rows only. It goes into the checkout idempotency key, so a new checkout after a failure is new to Stripe.
export async function getLatestClosedCheckoutId(client: SupabaseClient, sessionId: string): Promise<string | null> {
  const result = await client
    .from("report_purchases")
    .select("stripe_checkout_session_id")
    .eq("session_id", sessionId)
    .in("status", ["failed", "expired"])
    .order("created_at", { ascending: false })
    .limit(1);
  return check<{ stripe_checkout_session_id: string }[]>(result, "latest closed checkout")[0]?.stripe_checkout_session_id ?? null;
}

// FR-37: missions are always chosen by the parent; nothing here reads a score (NFR-52).
export async function listMissions(client: SupabaseClient, childId: string): Promise<MissionRow[]> {
  const result = await client.from("missions").select(MISSION_COLUMNS).eq("child_id", childId).order("created_at");
  return check(result, "list missions");
}

export async function addMission(client: SupabaseClient, childId: string, missionKey: string): Promise<MissionRow> {
  if (!isMissionKey(missionKey)) throw new Error("add mission: unknown mission key");
  const result = await client
    .from("missions")
    .insert({ child_id: childId, mission_key: missionKey })
    .select(MISSION_COLUMNS)
    .single();
  return check(result, "add mission");
}

export async function setMissionDone(client: SupabaseClient, missionId: string, done: boolean): Promise<MissionRow> {
  const result = await client
    .from("missions")
    .update({ status: done ? "done" : "todo" })
    .eq("id", missionId)
    .select(MISSION_COLUMNS)
    .single();
  return check(result, "update mission");
}

export async function deleteMission(client: SupabaseClient, missionId: string): Promise<void> {
  check(await client.from("missions").delete().eq("id", missionId), "delete mission");
}
