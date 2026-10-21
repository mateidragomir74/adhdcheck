import { describe, expect, it } from "vitest";
import { MINIGAME_MAX_TRIALS } from "@adhdcheck/contracts";
import { MAX_FAILURES_PER_LENGTH, N_STARS, START_LENGTH } from "./star-path/logic";
import { N_TRIALS } from "./bridge-wait/logic";
import { N_CHOICES } from "./treasure-choice/logic";
import { PUZZLES } from "./route-planner/logic";

// The upload caps of the contract (MINIGAME_MAX_TRIALS) are not invented: each is what the game itself can record.
// They live in packages/contracts, which cannot import the games, so this test ties them to the games' constants.
describe("MINIGAME_MAX_TRIALS follows the games' own constants (M3)", () => {
  it("star-path: lengths START_LENGTH to N_STARS, at most MAX_FAILURES_PER_LENGTH sequences per length", () => {
    expect(MINIGAME_MAX_TRIALS["star-path"]).toBe((N_STARS - START_LENGTH + 1) * MAX_FAILURES_PER_LENGTH);
  });
  it("bridge-wait: N_TRIALS scored trials", () => expect(MINIGAME_MAX_TRIALS["bridge-wait"]).toBe(N_TRIALS));
  it("treasure-choice: N_CHOICES scored choices", () => expect(MINIGAME_MAX_TRIALS["treasure-choice"]).toBe(N_CHOICES));
  it("route-planner: one record per puzzle", () => expect(MINIGAME_MAX_TRIALS["route-planner"]).toBe(PUZZLES.length));
});
