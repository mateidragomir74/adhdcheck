import { describe, expect, it } from "vitest";
import { reportView, viewAfterCheckoutConflict } from "./report-view";

// D-05b, R3-P1 and R3-P2: what the report block shows.
describe("reportView", () => {
  it("offers the report when there is no purchase", () => {
    expect(reportView(null, false, "no_flag")).toBe("offer");
  });
  it("shows the paid states for a paid purchase", () => {
    expect(reportView({ status: "paid", emailed_at: null }, false, "no_flag")).toBe("paid");
    expect(reportView({ status: "paid", emailed_at: "2026-10-20T10:00:00Z" }, false, "no_flag")).toBe("paid_emailed");
  });
  it("R3-P1 shows payment in progress, not the offer, while a pending purchase exists", () => {
    expect(reportView({ status: "pending", emailed_at: null }, false, "no_flag")).toBe("in_progress");
  });
  it("waits for the webhook right after checkout", () => {
    expect(reportView(null, true, "no_flag")).toBe("confirming");
  });
  it("R3-P2 hides the offer for a session with too little data", () => {
    expect(reportView(null, false, "insufficient_data")).toBe("none");
    expect(reportView(null, true, "insufficient_data")).toBe("none");
  });
  it("R3-P2 still shows a paid purchase made before the rule", () => {
    expect(reportView({ status: "paid", emailed_at: null }, false, "insufficient_data")).toBe("paid");
  });
});

// R4-4: a 409 from checkout means a payment for this report exists or is on its way. The page must wait for it
// (and poll), never show the paid state and never the offer.
describe("viewAfterCheckoutConflict", () => {
  it("waits for the payment on already_paid and payment_pending", () => {
    expect(viewAfterCheckoutConflict("already_paid")).toBe("confirming");
    expect(viewAfterCheckoutConflict("payment_pending")).toBe("confirming");
  });
  it("shows nothing for a session with too little data", () => {
    expect(viewAfterCheckoutConflict("insufficient_data")).toBe("none");
  });
  it("never claims the report is paid before the server says so", () => {
    for (const e of ["already_paid", "payment_pending", "insufficient_data", undefined]) {
      expect(["paid", "paid_emailed"]).not.toContain(viewAfterCheckoutConflict(e));
    }
  });
  it("after the polls run out with a pending purchase, offers to resume instead of waiting forever", () => {
    expect(reportView({ status: "pending", emailed_at: null }, true, "no_flag", { pollsLeft: 0 })).toBe("in_progress");
    expect(reportView({ status: "pending", emailed_at: null }, true, "no_flag", { pollsLeft: 3 })).toBe("confirming");
    expect(reportView(null, true, "no_flag", { pollsLeft: 0 })).toBe("confirming");
  });
});
