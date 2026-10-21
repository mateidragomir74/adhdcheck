"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { pathAfterLogin } from "../../lib/safe-next";
import { S } from "../parent/strings";
import { buttonPrimary, field, postJson } from "../parent/_components/shell";

// FR-30 parent login and sign-up, through the auth API routes (cookie session). After sign-up the parent
// confirms by email (Supabase), then logs in.
export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setBusy(true);
    setNote(null);
    const body = { email: String(form.get("email") ?? ""), password: String(form.get("password") ?? "") }; // check-secrets: allow
    try {
      const res = await postJson(mode === "login" ? "/api/auth/login" : "/api/auth/signup", body);
      if (res.ok && mode === "login") return router.replace(pathAfterLogin(window.location.search));
      if (res.ok) {
        setMode("login");
        return setNote(S.login.checkEmail);
      }
      const { error } = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(error === "weak_password" ? S.login.weak : S.login.failed); // check-secrets: allow
    } catch {
      setNote(S.login.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-night px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl bg-cream p-6 text-ink shadow-[0_20px_60px_rgb(0_0_0/0.35)] sm:p-8">
        <p className="flex items-center gap-2 font-display text-lg font-semibold">
          <span aria-hidden="true" className="size-3 rounded-full bg-glow shadow-[0_0_14px_4px_rgb(251_191_36/0.7)]" />
          {S.appName}
        </p>
        <h1 className="mt-4 font-display text-3xl font-semibold">{S.login.title}</h1>
        <form action={submit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{S.login.email}</span>
            <input name="email" type="email" autoComplete="email" required className={field} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-semibold">{S.login.passLabel}</span>
            <input
              name="password" // check-secrets: allow
              type="password" // check-secrets: allow
              autoComplete={mode === "login" ? "current-password" : "new-password"} // check-secrets: allow
              required
              className={field}
            />
          </label>
          {note && (
            <p role="status" className="rounded-xl bg-cream-2 px-3 py-2 text-sm">
              {note}
            </p>
          )}
          <button type="submit" disabled={busy} className={`${buttonPrimary} w-full`}>
            {mode === "login" ? S.login.submitLogin : S.login.submitSignup}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setNote(null);
          }}
          className="mt-4 min-h-11 w-full rounded-xl text-sm font-semibold text-ink-muted underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-ink"
        >
          {mode === "login" ? S.login.toSignup : S.login.toLogin}
        </button>
      </div>
    </main>
  );
}
