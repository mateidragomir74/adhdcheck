import { escapeHtml } from "./escape-html";
import { EMAIL_TEXT } from "./strings";

// FR-50 email bodies, built from the fixed strings and, for parents, the dashboard link only.
export type EmailMessage = { subject: string; text: string; html: string };
export type EmailLang = "ro" | "en";

function withLink(subject: string, body: string, link: string): EmailMessage {
  const safe = escapeHtml(link);
  return {
    subject,
    text: `${body}\n${link}\n`,
    html: `<p>${escapeHtml(body)}</p><p><a href="${safe}">${safe}</a></p>`,
  };
}

export function waitlistEmail(lang: "ro" | "en"): EmailMessage {
  const { subject, body } = EMAIL_TEXT.waitlist[lang];
  return { subject, text: `${body}\n`, html: `<p>${escapeHtml(body)}</p>` };
}

export function missionAddedEmail(dashboardUrl: string): EmailMessage {
  return withLink(EMAIL_TEXT.missionAdded.subject, EMAIL_TEXT.missionAdded.body, dashboardUrl);
}

export function weeklySummaryEmail(dashboardUrl: string): EmailMessage {
  return withLink(EMAIL_TEXT.weeklySummary.subject, EMAIL_TEXT.weeklySummary.body, dashboardUrl);
}

// The paid report email (FR-51, R3-D1): fixed text and one link to the page behind login. No attachment and no
// data of the child or of the report.
export function reportReadyEmail(lang: EmailLang, reportUrl: string): EmailMessage {
  const { subject, body } = EMAIL_TEXT.reportReady[lang];
  return withLink(subject, body, reportUrl);
}
