import { afterEach, describe, expect, it, vi } from "vitest";
import { handleConfirm, handleLogin, handleLogout, handleSignUp, safeNextPath, type AuthClient } from "./handlers";

const EMAIL = "parent.synthetic@example.test";
const PASSWORD = "synthetic-pass-123"; // check-secrets: allow
const CREDS = { email: EMAIL, password: PASSWORD }; // check-secrets: allow

// Fake Supabase auth: each method answers like supabase-js ({ data, error }).
function fakeAuth(error: { code?: string; status?: number; message: string } | null = null) {
  const answer = vi.fn().mockResolvedValue({ data: {}, error });
  const auth = {
    signUp: answer,
    signInWithPassword: answer, // check-secrets: allow
    signOut: answer,
    verifyOtp: answer,
  } as unknown as AuthClient;
  return { auth, answer };
}

function postJson(path: string, body: unknown, contentType = "application/json") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/auth/signup (FR-30)", () => {
  it("signs up with email and password and answers ok", async () => { // check-secrets: allow
    const { auth, answer } = fakeAuth();
    const res = await handleSignUp(postJson("/api/auth/signup", CREDS), { auth });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(answer).toHaveBeenCalledWith(CREDS);
  });

  it("rejects an invalid email with 400 without calling Supabase", async () => {
    const { auth, answer } = fakeAuth();
    const res = await handleSignUp(postJson("/api/auth/signup", { email: "nope", password: PASSWORD }), { auth }); // check-secrets: allow

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(answer).not.toHaveBeenCalled();
  });

  it("rejects a missing password with 400", async () => { // check-secrets: allow
    const { auth } = fakeAuth();
    const res = await handleSignUp(postJson("/api/auth/signup", { email: EMAIL }), { auth });
    expect(res.status).toBe(400);
  });

  it("passes a weak password refusal on as weak_password", async () => { // check-secrets: allow
    const { auth } = fakeAuth({ code: "weak_password", status: 422, message: "Password should be at least 6 characters." }); // check-secrets: allow
    const res = await handleSignUp(postJson("/api/auth/signup", { email: EMAIL, password: "a" }), { auth }); // check-secrets: allow

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "weak_password" }); // check-secrets: allow
  });

  it("answers 429 when Supabase rate limits", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { auth } = fakeAuth({ code: "over_email_send_rate_limit", status: 429, message: "rate limit" });
    const res = await handleSignUp(postJson("/api/auth/signup", CREDS), { auth });

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_many_requests" });
  });

  it("refuses a body that is not sent as JSON (blocks cross-site form posts)", async () => {
    const { auth, answer } = fakeAuth();
    const res = await handleSignUp(
      postJson("/api/auth/signup", JSON.stringify(CREDS), "text/plain"),
      { auth },
    );

    expect(res.status).toBe(415);
    expect(answer).not.toHaveBeenCalled();
  });

  it("never logs the email or the password", async () => { // check-secrets: allow
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { auth } = fakeAuth({ code: "unexpected_failure", status: 500, message: `failed for ${EMAIL}` });
    await handleSignUp(postJson("/api/auth/signup", CREDS), { auth });

    const logged = JSON.stringify([...warn.mock.calls, ...error.mock.calls]);
    expect(logged).not.toContain(EMAIL);
    expect(logged).not.toContain(PASSWORD); // check-secrets: allow
  });
});

describe("POST /api/auth/login (FR-30)", () => {
  it("logs in and answers ok", async () => {
    const { auth, answer } = fakeAuth();
    const res = await handleLogin(postJson("/api/auth/login", CREDS), { auth });

    expect(res.status).toBe(200);
    expect(answer).toHaveBeenCalledWith(CREDS);
  });

  it("answers 401 invalid_credentials for a wrong password", async () => { // check-secrets: allow
    const { auth } = fakeAuth({ code: "invalid_credentials", status: 400, message: "Invalid login credentials" });
    const res = await handleLogin(postJson("/api/auth/login", { email: EMAIL, password: "wrong" }), { auth }); // check-secrets: allow

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_credentials" });
  });

  it("answers 403 email_not_confirmed before the email link was opened", async () => {
    const { auth } = fakeAuth({ code: "email_not_confirmed", status: 400, message: "Email not confirmed" });
    const res = await handleLogin(postJson("/api/auth/login", CREDS), { auth });

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "email_not_confirmed" });
  });

  it("refuses a body that is not sent as JSON", async () => {
    const { auth } = fakeAuth();
    const res = await handleLogin(
      postJson("/api/auth/login", JSON.stringify(CREDS), "text/plain"),
      { auth },
    );
    expect(res.status).toBe(415);
  });
});

describe("POST /api/auth/logout (FR-30)", () => {
  it("signs out and answers ok", async () => {
    const { auth, answer } = fakeAuth();
    const res = await handleLogout(postJson("/api/auth/logout", {}), { auth });

    expect(res.status).toBe(200);
    expect(answer).toHaveBeenCalledTimes(1);
  });

  it("refuses a request that is not sent as JSON (blocks cross-site logout)", async () => {
    const { auth, answer } = fakeAuth();
    const res = await handleLogout(postJson("/api/auth/logout", "", "text/plain"), { auth });

    expect(res.status).toBe(415);
    expect(answer).not.toHaveBeenCalled();
  });
});

describe("GET /api/auth/confirm (email link)", () => {
  const confirmUrl = (query: string) => new Request(`http://localhost/api/auth/confirm?${query}`);

  it("verifies the token and redirects to next", async () => { // check-secrets: allow
    const { auth, answer } = fakeAuth();
    const res = await handleConfirm(confirmUrl("token_hash=abc&type=email&next=/dashboard"), { auth }); // check-secrets: allow

    expect(answer).toHaveBeenCalledWith({ token_hash: "abc", type: "email" }); // check-secrets: allow
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("redirects home with an error flag when the token is refused", async () => { // check-secrets: allow
    const { auth } = fakeAuth({ code: "otp_expired", status: 403, message: "Token has expired" }); // check-secrets: allow
    const res = await handleConfirm(confirmUrl("token_hash=abc&type=email"), { auth }); // check-secrets: allow

    expect(res.headers.get("location")).toBe("http://localhost/?auth_error=confirm_failed");
  });

  it("redirects home with an error flag when the link has no token", async () => { // check-secrets: allow
    const { auth, answer } = fakeAuth();
    const res = await handleConfirm(confirmUrl("type=email"), { auth });

    expect(answer).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("http://localhost/?auth_error=confirm_failed");
  });

  it("never redirects to another site", async () => {
    const { auth } = fakeAuth();
    const res = await handleConfirm(confirmUrl("token_hash=abc&type=email&next=//evil.example"), { auth }); // check-secrets: allow
    expect(res.headers.get("location")).toBe("http://localhost/");
  });
});

describe("safeNextPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/children/1?tab=results", "/children/1?tab=results"],
    [null, "/"],
    ["", "/"],
    ["dashboard", "/"],
    ["//evil.example", "/"],
    ["/\\evil.example", "/"],
    ["https://evil.example", "/"],
    [`/${String.fromCharCode(9)}/evil.example`, "/"],
    [`/${String.fromCharCode(13, 10)}/evil.example`, "/"],
    ["javascript:alert(1)", "/"],
    ["/x?y=1#z", "/x?y=1#z"],
  ])("%s -> %s", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });
});

describe("R6-1 handleConfirm never redirects off this site", () => {
  it.each(["/%09/evil.example", "/%0A/evil.example", "/%0D%0A/evil.example", "/%09%5Cevil.example", "//evil.example", "https://evil.example"])(
    "next=%s lands on this origin",
    async (next) => {
      const { auth } = fakeAuth();
      const res = await handleConfirm(new Request(`http://localhost/api/auth/confirm?token_hash=abc&type=email&next=${next}`), { auth }); // check-secrets: allow
      expect(new URL(res.headers.get("location") as string).origin).toBe("http://localhost");
    },
  );
});
