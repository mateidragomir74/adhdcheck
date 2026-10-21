// The NFR-04 consent text is a placeholder for the texts owner, but it must not promise what the system
// does not do: the service operators can read the data (service role), so "only you can see it" is false.
import { describe, expect, it } from "vitest";
import { S } from "./strings";

describe("processing consent text (NFR-04)", () => {
  it("does not claim that only the parent can see the data", () => {
    expect(S.processing.explain.toLowerCase()).not.toMatch(/only you|nobody else|no one else/);
  });

  it("still says what is kept and that deleting the child deletes it", () => {
    expect(S.processing.explain).toMatch(/taps/);
    expect(S.processing.explain).toMatch(/deleting the child deletes/i);
  });
});
