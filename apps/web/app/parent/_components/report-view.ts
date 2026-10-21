import type { ReportPurchase } from "../../../lib/data/parent";

// What the report block shows (D-05b): the offer, a short wait right after checkout while the webhook
// records the payment, payment in progress (a Checkout was opened and not paid yet), the paid state, or
// nothing for a session with too little data (R3-P2: there is no result to report, so no offer).
// Only the server decides who gets the file (GET /api/reports/<id>).
export type ReportView = "offer" | "confirming" | "in_progress" | "paid" | "paid_emailed" | "none";

export function reportView(
  purchase: Pick<ReportPurchase, "status" | "emailed_at"> | null,
  returningFromCheckout: boolean,
  band: string,
  // pollsLeft: how many more checks of the purchase the page will make; at 0 a pending purchase stops
  // saying "confirming" and offers to resume instead (R4-4).
  poll: { pollsLeft: number } = { pollsLeft: 1 },
): ReportView {
  if (purchase?.status === "paid") return purchase.emailed_at ? "paid_emailed" : "paid";
  if (band === "insufficient_data") return "none";
  if (returningFromCheckout) return purchase?.status === "pending" && poll.pollsLeft <= 0 ? "in_progress" : "confirming";
  return purchase?.status === "pending" ? "in_progress" : "offer";
}

// POST /api/stripe/checkout answered 409: a payment for this report exists or is on its way (already_paid when
// Stripe says paid, payment_pending for a delayed method), or the session cannot be bought. The page waits for
// the server record (and polls for it), it never claims "paid" itself.
export function viewAfterCheckoutConflict(error: string | undefined): ReportView {
  return error === "insufficient_data" ? "none" : "confirming";
}
