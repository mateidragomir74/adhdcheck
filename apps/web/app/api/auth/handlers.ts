import type { EmailOtpType, SupabaseClient } from "@supabase/supabase-js";
import { safeNextPath } from "../../../lib/safe-next";

// Parent auth with Supabase Auth (FR-30), server side. The pages that call these are Person 4's.
// Answers carry an error code only; emails and passwords are never logged.
// POST bodies must be sent as application/json: a cross-site HTML form cannot set that header,
// so another site cannot log a parent in or out behind their back.

export type AuthClient = Pick<SupabaseClient["auth"], "signUp" | "signInWithPassword" | "signOut" | "verifyOtp">; // check-secrets: allow
type Deps = { auth: AuthClient };
type AuthError = { code?: string; status?: number } | null;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_TYPES: readonly EmailOtpType[] = ["signup", "invite", "magiclink", "recovery", "email_change", "email"];

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; res: Response }> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return { ok: false, res: fail(415, "json_required") };
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, res: fail(400, "invalid_input") };
  }
}

function readCredentials(body: unknown): { email: string; password: string } | null { // check-secrets: allow
  const { email, password } = (body ?? {}) as { email?: unknown; password?: unknown }; // check-secrets: allow
  if (typeof email !== "string" || email.length > 254 || !EMAIL.test(email)) return null;
  if (typeof password !== "string" || password.length === 0) return null; // check-secrets: allow
  return { email, password }; // check-secrets: allow
}

// Errors the routes do not map themselves: rate limit, or Supabase failing.
function commonError(route: string, error: NonNullable<AuthError>): Response {
  if (error.status === 429) {
    console.warn(`[auth] ${route} rate limited`, { code: error.code });
    return fail(429, "too_many_requests");
  }
  console.error(`[auth] ${route} failed`, { code: error.code, status: error.status });
  return fail(502, "auth_unavailable");
}

export async function handleSignUp(request: Request, { auth }: Deps): Promise<Response> {
  const read = await readJson(request);
  if (!read.ok) return read.res;
  const credentials = readCredentials(read.body);
  if (!credentials) return fail(400, "invalid_input");

  // An address that is already registered gets the same answer (Supabase does not reveal it).
  const { error } = await auth.signUp(credentials);
  if (!error) return Response.json({ ok: true });
  if (error.code === "weak_password") return fail(400, "weak_password"); // check-secrets: allow
  return commonError("signup", error);
}

export async function handleLogin(request: Request, { auth }: Deps): Promise<Response> {
  const read = await readJson(request);
  if (!read.ok) return read.res;
  const credentials = readCredentials(read.body);
  if (!credentials) return fail(400, "invalid_input");

  const { error } = await auth.signInWithPassword(credentials); // check-secrets: allow
  if (!error) return Response.json({ ok: true });
  if (error.code === "invalid_credentials") return fail(401, "invalid_credentials");
  if (error.code === "email_not_confirmed") return fail(403, "email_not_confirmed");
  return commonError("login", error);
}

export async function handleLogout(request: Request, { auth }: Deps): Promise<Response> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.toLowerCase().startsWith("application/json")) return fail(415, "json_required");

  const { error } = await auth.signOut();
  if (!error) return Response.json({ ok: true });
  return commonError("logout", error);
}

// Email link: {{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/
// (set in the Supabase email templates). On failure the parent lands on the home page with
// ?auth_error=confirm_failed, for the page to explain.
export async function handleConfirm(request: Request, { auth }: Deps): Promise<Response> {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash"); // check-secrets: allow
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(url.searchParams.get("next"));

  if (tokenHash && type && OTP_TYPES.includes(type)) { // check-secrets: allow
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type }); // check-secrets: allow
    if (!error) return Response.redirect(new URL(next, url.origin), 303);
    console.warn("[auth] confirm refused", { code: error.code });
  }
  return Response.redirect(new URL("/?auth_error=confirm_failed", url.origin), 303);
}

export { safeNextPath };
