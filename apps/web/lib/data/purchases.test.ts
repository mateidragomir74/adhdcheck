import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getReportPurchase, listPendingCheckoutIds } from "./parent";

// A recording stand-in for the Supabase query builder: every call is logged, awaiting it returns the rows.
function fakeClient(rows: unknown[]) {
  const calls: [string, unknown[]][] = [];
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "in", "order", "limit"]) q[m] = (...a: unknown[]) => (calls.push([m, a]), q);
  q.then = (res: (v: unknown) => unknown) => res({ data: rows, error: null });
  return { client: { from: () => q } as unknown as SupabaseClient, calls };
}

describe("pending purchase lookups (R4-2, R4-5)", () => {
  it("lists only pending rows, newest first, and a bounded number of them", async () => {
    const { client, calls } = fakeClient([{ stripe_checkout_session_id: "cs_1" }]);
    expect(await listPendingCheckoutIds(client, "s")).toEqual(["cs_1"]);
    expect(calls).toContainEqual(["eq", ["status", "pending"]]);
    expect(calls).toContainEqual(["order", ["created_at", { ascending: false }]]);
    const limit = calls.find(([m]) => m === "limit");
    expect(limit).toBeDefined();
    expect(limit?.[1][0]).toBeLessThanOrEqual(5);
  });

  it("the purchase the parent page reads ignores failed and expired rows", async () => {
    const { client, calls } = fakeClient([{ status: "pending", emailed_at: null }]);
    await getReportPurchase(client, "s");
    expect(calls).toContainEqual(["in", ["status", ["pending", "paid"]]]);
  });
});
