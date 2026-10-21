import type { EmailMessage } from "./messages";
import { EMAIL_TEXT } from "./strings";

// Sends one email (FR-50) and never throws: an email that cannot go out must not break the action that
// asked for it. Logs the provider's error name only, never the address or the content.

// The sender of every email (FR-50 messages and the paid report, FR-51) is EMAIL_FROM, an address on a domain
// verified in Resend. Resend's shared test sender only delivers to the address the Resend account was made
// with, so it is used as a default outside production only (the demo and local work).
export const DEFAULT_EMAIL_FROM = `${EMAIL_TEXT.senderName} <onboarding@resend.dev>`;

export function resolveEmailFrom(env: { EMAIL_FROM?: string; NODE_ENV?: string }): string | null {
  const configured = env.EMAIL_FROM?.trim();
  if (configured) return configured;
  return env.NODE_ENV === "production" ? null : DEFAULT_EMAIL_FROM;
}

export type EmailResult = "sent" | "skipped" | "failed";

export interface EmailSender {
  // idempotencyKey: the provider sends the same key only once (24 hours at Resend), so a repeated call
  // or a double click does not send twice.
  send(input: { to: string; message: EmailMessage; idempotencyKey: string }): Promise<EmailResult>;
}

type ProviderError = { name: string; message: string; statusCode: number | null };
export type EmailTransport = (
  payload: { from: string; to: string[]; subject: string; text: string; html: string },
  options: { idempotencyKey: string },
) => Promise<{ data: unknown; error: ProviderError | null }>;

// Worth a second try: rate limits, provider faults and a network failure. Anything else (a refused
// recipient, a bad key) will fail the same way again.
const TRANSIENT = new Set(["rate_limit_exceeded", "internal_server_error", "application_error", "concurrent_idempotent_requests", "network"]);
const BACKOFF_MS = [500, 1500];

// One attempt gives up after this long (R3-E5): a slow provider must not hold the request that asked for the
// email. The idempotency key makes a later retry safe, so a timeout is not retried here.
export const SEND_TIMEOUT_MS = 5000;

export function createEmailSender(
  transport: EmailTransport | null,
  {
    sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
    from = DEFAULT_EMAIL_FROM as string | null,
    timeoutMs = SEND_TIMEOUT_MS,
  } = {},
): EmailSender {
  return {
    async send({ to, message, idempotencyKey }) {
      if (!transport || !from) {
        console.warn("[email] skipped", { error: "email_not_configured" });
        return "skipped";
      }
      for (let attempt = 0; ; attempt++) {
        let name: string;
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timedOut = new Promise<"timeout">((resolve) => {
            timer = setTimeout(() => resolve("timeout"), timeoutMs);
          });
          const outcome = await Promise.race([transport({ from, to: [to], ...message }, { idempotencyKey }), timedOut]);
          if (outcome === "timeout") {
            console.error("[email] failed", { error: "timeout" });
            return "failed";
          }
          if (!outcome.error) return "sent";
          name = outcome.error.name;
        } catch {
          name = "network";
        } finally {
          clearTimeout(timer);
        }
        if (!TRANSIENT.has(name) || attempt >= BACKOFF_MS.length) {
          console.error("[email] failed", { error: name });
          return "failed";
        }
        await sleep(BACKOFF_MS[attempt]);
      }
    },
  };
}
