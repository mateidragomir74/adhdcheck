import { describe, expect, it } from "vitest";
import { parentFromUser } from "./parent-from-user";

// R4-7: the confirmation flag must come from email_confirmed_at, never be forced.
describe("parentFromUser (R3-E2)", () => {
  it("is confirmed only with email_confirmed_at", () => {
    expect(parentFromUser({ id: "p", email: "a@example.test", email_confirmed_at: "2026-10-01T00:00:00Z" })).toEqual({ id: "p", email: "a@example.test", emailConfirmed: true });
    expect(parentFromUser({ id: "p", email: "a@example.test", email_confirmed_at: null })?.emailConfirmed).toBe(false);
    expect(parentFromUser({ id: "p", email: "a@example.test" })?.emailConfirmed).toBe(false);
  });
  it("is null without a user, an id or an address", () => {
    expect(parentFromUser(null)).toBeNull();
    expect(parentFromUser({ id: "", email: "a@example.test" })).toBeNull();
    expect(parentFromUser({ id: "p", email: "" })).toBeNull();
  });
});
