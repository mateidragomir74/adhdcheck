import "server-only";
import { Resend } from "resend";
import { createEmailSender, resolveEmailFrom, type EmailSender } from "./sender";

// The Resend-backed sender (FR-50). RESEND_API_KEY is server only (NFR-10); use a sending-only one. // check-secrets: allow
// The sender is EMAIL_FROM (lib/email/sender.ts resolveEmailFrom). Without the key or a sender, every email is skipped and logged, and the app works the same.
export function createResendSender(): EmailSender {
  const key = process.env.RESEND_API_KEY; // check-secrets: allow
  const from = resolveEmailFrom(process.env);
  if (!key || !from) return createEmailSender(null);
  const resend = new Resend(key); // check-secrets: allow
  return createEmailSender((payload, options) => resend.emails.send(payload, options), { from });
}
