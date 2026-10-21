import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SCORE_DISCLAIMER } from "@adhdcheck/contracts";
import { findBannedWording, findUnnegated } from "../landing-copy";
import { sessionResult } from "../../lib/report-test-helpers";
import { ResultCard } from "./_components/ResultCard";
import { reportView } from "./_components/report-view";
import { BAND_TEXT, S } from "./strings";

// D-05 (DECIDED, Hatem, 2026-10-20): everything is free for parents except the detailed report.
// D-05b (DECIDED, Hatem, 2026-10-20): the report is 9.99 EUR, one-off per report, sent by email to the
// parent who paid and downloadable here by that parent.

function values(o: unknown): string[] {
  if (typeof o === "string") return [o];
  if (o && typeof o === "object") return Object.values(o).flatMap(values);
  return [];
}

describe("free for every parent (D-05, FR-48)", () => {
  it("an unpaid parent sees the full result card and next step, and no paid state", () => {
    // ResultCard takes no payment input at all: what it shows cannot depend on payment.
    const html = renderToStaticMarkup(createElement(ResultCard, { result: sessionResult("follow_up_suggested") }));
    expect(html).toContain(BAND_TEXT.follow_up_suggested.headline);
    expect(html).toContain(SCORE_DISCLAIMER);
    expect(html).toContain(S.result.indicators);
    expect(html).toContain(S.indicator.omission_rate);
    expect(html).toContain(S.result.nextStep);
    expect(html).toContain(S.result.nextStepText);
    expect(html).not.toContain(S.report.sentAndHere);
    expect(html).not.toContain(S.report.availableHere);
  });

  it("missions, progress, the child page and the result card never read the payment", () => {
    for (const f of ["_components/Missions.tsx", "_components/ProgressChart.tsx", "_components/ResultCard.tsx", "[childId]/ChildView.tsx"]) {
      const src = readFileSync(join(__dirname, f), "utf8");
      expect(src, f).not.toMatch(/getReportPurchase|from\("report_purchases"\)|isReportPaid/);
    }
  });

  it("no parent text says missions or progress need a payment", () => {
    const offending = values(S).filter((t) => /(missions|progress)[^.]*(plan|subscri|pay|report)/i.test(t));
    expect(offending).toEqual([]);
  });

  it("the wording check can fail", () => {
    expect(/(missions|progress)[^.]*(plan|subscri|pay|report)/i.test("Missions and progress tracking come with the family plan.")).toBe(true);
  });
});

describe("the report offer and the paid state (D-05b)", () => {
  it("offers the report at the decided price, one-off, with no subscription wording", () => {
    expect(S.report.offerTitle).toBe("Get the detailed report, 9.99 EUR, one-off");
    const offer = [S.report.offerTitle, S.report.offerText, S.report.offerFree, S.report.buy].join(" ");
    expect(offer).not.toMatch(/subscri|plan\b|per month|renew(s|al)? automatically|only today|last chance|hurry|limited/i);
    expect(findBannedWording(values(S.report))).toEqual([]);
    expect(findUnnegated(values(S.report))).toEqual([]);
  });

  it("after payment the parent is told it was sent to their email and is available here", () => {
    expect(S.report.sentAndHere).toBe("Sent to your email, and available here");
  });

  it.each([
    [null, false, "offer"],
    [{ status: "pending", emailed_at: null }, false, "in_progress"],
    [{ status: "pending", emailed_at: null }, true, "confirming"],
    [null, true, "confirming"],
    [{ status: "paid", emailed_at: null }, false, "paid"],
    [{ status: "paid", emailed_at: "2026-10-20T10:00:00Z" }, false, "paid_emailed"],
    [{ status: "paid", emailed_at: "2026-10-20T10:00:00Z" }, true, "paid_emailed"],
  ] as const)("purchase %j, back from checkout %s: shows %s", (purchase, returning, view) => {
    expect(reportView(purchase, returning, "no_flag")).toBe(view);
  });
});

// R6-9: a link from the report email opened while logged in as another parent finds no such child (RLS). The
// page says so and points to the log out action instead of a generic error.
describe("child page of another account (R6-9)", () => {
  it("has its own message, which is not the generic error and passes the wording gate", () => {
    expect(S.child.notFound).toBeTruthy();
    expect(S.child.notFound).not.toBe(S.error);
    expect(S.child.notFound).toContain(S.nav.logout);
    expect(findBannedWording([S.child.notFound])).toEqual([]);
    expect(findUnnegated([S.child.notFound])).toEqual([]);
  });
});
