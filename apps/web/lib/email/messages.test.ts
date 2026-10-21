import { describe, expect, it } from "vitest";
import { missionAddedEmail, reportReadyEmail, waitlistEmail, weeklySummaryEmail } from "./messages";

const DASHBOARD = "https://app.example.test/parent";

const all = [
  waitlistEmail("en"),
  waitlistEmail("ro"),
  missionAddedEmail(DASHBOARD),
  weeklySummaryEmail(DASHBOARD),
  reportReadyEmail("en", DASHBOARD),
  reportReadyEmail("ro", DASHBOARD),
];

// Scope: every email the app sends (waitlist, new mission, weekly summary and, since R3-D1, the paid report
// email of FR-51). No email carries child data: the paid report stays in the app behind login and the email
// only links to it.
describe("FR-50 email messages", () => {
  it("never carry a result: no band, headline, indicator or score wording", () => {
    for (const m of all) {
      const text = `${m.subject}\n${m.text}\n${m.html}`;
      expect(text).not.toMatch(/follow_up|no_flag|insufficient|assessment is recommended|indicator|score|band|omission|commission/i);
    }
  });

  it("pass the banned-wording check (adhdcheck-dev skill, section 5)", () => {
    for (const m of all) {
      const text = `${m.subject}\n${m.text}\n${m.html}`;
      expect(text).not.toMatch(/diagnos|likely|probabilit|risk score|severe|moderate|mild|treat|cure|clinically (proven|validated)/i);
      expect(text).not.toContain(String.fromCharCode(0x2014));
    }
  });

  it("the parent emails carry only the link to the dashboard", () => {
    for (const m of [missionAddedEmail(DASHBOARD), weeklySummaryEmail(DASHBOARD), reportReadyEmail("en", DASHBOARD), reportReadyEmail("ro", DASHBOARD)]) {
      expect(m.text).toContain(DASHBOARD);
      expect(m.html).toContain(`href="${DASHBOARD}"`);
      expect(m.text.match(/https?:\/\/\S+/g)).toEqual([DASHBOARD]);
    }
  });

  it("R3-D1 the report email follows the language and names no report content", () => {
    expect(reportReadyEmail("ro", DASHBOARD).subject).not.toBe(reportReadyEmail("en", DASHBOARD).subject);
    for (const m of [reportReadyEmail("en", DASHBOARD), reportReadyEmail("ro", DASHBOARD)]) {
      expect(`${m.subject}
${m.text}
${m.html}`).not.toMatch(/adhd|pdf|attach|atașat|diagnostic|nickname/i);
    }
  });

  it("the waitlist email follows the page language", () => {
    expect(waitlistEmail("ro").subject).not.toBe(waitlistEmail("en").subject);
  });

  it("escapes the link in the HTML part", () => {
    const m = missionAddedEmail('https://x.test/"><script>');
    expect(m.html).not.toContain("<script>");
  });
});
