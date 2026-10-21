// Email wording (FR-50). Placeholders: TODO texts owner (R5) replaces them with approved texts. Emails carry
// no result, no band, no indicator and not the child's nickname: only a link to the dashboard (docs/02 FR-50).
// The subject lines do not name a condition, since a subject is often visible on a lock screen.

export const EMAIL_TEXT = {
  // Sender name only: without a domain of our own, Resend sends from its shared test address.
  senderName: "ADHDCheck",
  waitlist: {
    en: {
      subject: "You are on the early-access list",
      body: "Thank you for your interest. We will write to you once when early access opens. If you did not sign up, you can ignore this email.",
    },
    ro: {
      subject: "Ești pe lista de acces timpuriu",
      body: "Îți mulțumim pentru interes. Îți vom scrie o singură dată, când se deschide accesul timpuriu. Dacă nu te-ai înscris tu, poți ignora acest email.",
    },
  },
  missionAdded: {
    subject: "A new mission is waiting",
    body: "A new mission was added in your parent area. Open it here:",
  },
  weeklySummary: {
    subject: "Your weekly summary is ready",
    body: "This week's games and missions are in your parent area. Open it here:",
  },
  // R3-D1 (DECIDED, Hatem, 2026-10-20): the paid report is never attached or quoted; the email only says it is
  // ready and links to it behind login. TODO (texts owner): approve the RO and EN wording of this email.
  reportReady: {
    en: {
      subject: "Your detailed report is ready",
      body: "Thank you. Your detailed report is ready in your parent area. Log in and open it here:",
    },
    ro: {
      subject: "Raportul tău detaliat este gata",
      body: "Mulțumim. Raportul tău detaliat este gata în spațiul tău de părinte. Autentifică-te și deschide-l aici:",
    },
  },
} as const;
