import { describe, expect, it } from "vitest";
import { STRINGS, betweenLine } from "./strings";

describe("Route Planner strings", () => {
  it("ends a solved board with the collected line and an unsolved one with a calm next-board line", () => {
    expect(betweenLine(true)).toBe(STRINGS.between);
    expect(betweenLine(false)).toBe(STRINGS.tryNext);
    expect(STRINGS.tryNext).not.toBe(STRINGS.between);
  });

  it("never says the child did badly, shows no number, and has no em-dash", () => {
    for (const t of Object.values(STRINGS)) {
      expect(t).not.toMatch(/wrong|fail|bad|lost|score|point|level|again|oops|diagnos|\d/i);
      expect(t).not.toContain(String.fromCharCode(0x2014));
    }
  });
});
