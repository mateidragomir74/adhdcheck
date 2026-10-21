import { describe, expect, it } from "vitest";
import { missionAddedEmail, reportReadyEmail } from "./messages";
import { escapeHtml } from "./escape-html";

describe("escapeHtml (one escape for every email)", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
  it("is what both the FR-50 messages and the report email use (a single quote is escaped in both)", () => {
    expect(missionAddedEmail("https://x.test/'").html).toContain("&#39;");
    expect(reportReadyEmail("en", "https://x.test/'").html).toContain("&#39;");
  });
});
