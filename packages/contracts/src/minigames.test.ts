import { describe, expect, it } from "vitest";
import { MAX_JSON_DEPTH, MINIGAME_IDS, MINIGAME_MAX_TRIALS, MiniGameEntrySchema, SessionMetricsSchema } from "./session-metrics";
import { validSessionMetrics } from "./fixtures/session-metrics.valid";

// PC-02 (docs/02 section 10.3, accepted by Hatem 2026-10-20): an optional `minigames` array on SessionMetrics,
// one entry per mini-game with `id`, `version`, `params` and `trials` or `results`. Synthetic values only.
const starPath = {
  id: "star-path",
  version: "0.1.0",
  params: { n_stars: 9, seed: 1 },
  trials: [{ i: 0, length: 2, outcome: "correct" }],
  results: { summary: { span: 2, errors: 0 }, motion: null },
};
const skipped = { id: "route-planner", version: "none", params: {}, results: { status: "skipped", reason: "mount_failed" } };

describe("SessionMetrics.minigames (PC-02)", () => {
  it("a v1 payload without the field is still valid (additive change)", () => {
    expect(SessionMetricsSchema.safeParse(validSessionMetrics).success).toBe(true);
  });

  it("accepts a minigames array with trials, with results, or with both", () => {
    const entries = [starPath, { id: "bridge-wait", version: "0.1.0", params: {}, results: { summary: { nTrials: 24 } } }, skipped];
    const parsed = SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: entries });
    expect(parsed.success).toBe(true);
  });

  it("lists the four built mini-games after Lantern Watch, in the order of docs/04 section 5", () => {
    expect([...MINIGAME_IDS]).toEqual(["star-path", "bridge-wait", "treasure-choice", "route-planner"]);
  });

  it.each([
    ["an unknown field on an entry", { ...starPath, extra: 1 }],
    ["an id that is not a built mini-game", { ...starPath, id: "storm-watch" }],
    ["an entry with neither trials nor results", { id: "star-path", version: "0.1.0", params: {} }],
    ["a missing version", { id: "star-path", params: {}, results: {} }],
    ["a missing params", { id: "star-path", version: "0.1.0", results: {} }],
    ["trials that are not an array", { ...starPath, trials: "x" }],
    ["a value that is not JSON (undefined inside results)", { ...starPath, results: { a: undefined } }],
    ["a non-finite number in params", { ...starPath, params: { a: Number.NaN } }],
  ])("rejects %s", (_name, entry) => {
    expect(MiniGameEntrySchema.safeParse(entry).success).toBe(false);
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: [entry] }).success).toBe(false);
  });

  it("rejects the same mini-game twice, and more entries than there are mini-games", () => {
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: [starPath, starPath] }).success).toBe(false);
    const five = [...MINIGAME_IDS, "star-path"].map((id) => ({ ...skipped, id }));
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: five }).success).toBe(false);
  });

  it("rejects a minigames field that is not an array", () => {
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: starPath }).success).toBe(false);
  });

  it("does not add the other PC-02 blocks (motion, context): they stay rejected", () => {
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, motion: {} }).success).toBe(false);
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, context: {} }).success).toBe(false);
  });
});

// I4: a hostile payload must be refused with a validation error, never crash the parser.
function nested(depth: number): unknown {
  let v: unknown = [];
  for (let k = 1; k < depth; k++) v = [v];
  return v;
}

describe("minigames: bounded depth (I4)", () => {
  it("refuses a 5000 deep array in trials without throwing", () => {
    const entry = { ...starPath, trials: [nested(5000)] };
    let ok: boolean | undefined;
    expect(() => (ok = SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: [entry] }).success)).not.toThrow();
    expect(ok).toBe(false);
  });

  it("accepts nesting up to the limit and refuses one level more", () => {
    const at = { ...starPath, trials: [nested(MAX_JSON_DEPTH)] };
    const over = { ...starPath, trials: [nested(MAX_JSON_DEPTH + 1)] };
    expect(MiniGameEntrySchema.safeParse(at).success).toBe(true);
    expect(MiniGameEntrySchema.safeParse(over).success).toBe(false);
  });

  it("a deep object in params or results is refused the same way", () => {
    let o: unknown = {};
    for (let k = 0; k < 5000; k++) o = { a: o };
    expect(MiniGameEntrySchema.safeParse({ ...starPath, params: { o } }).success).toBe(false);
    expect(MiniGameEntrySchema.safeParse({ ...starPath, results: { o } }).success).toBe(false);
  });
});

describe("minigames: trials cap per game (M3)", () => {
  it.each(MINIGAME_IDS)("%s: accepts as many trials as the game can play and refuses one more", (id) => {
    const cap = MINIGAME_MAX_TRIALS[id];
    const mk = (n: number) => ({ id, version: "0.1.0", params: {}, trials: Array.from({ length: n }, (_, i) => ({ i })) });
    expect(MiniGameEntrySchema.safeParse(mk(cap)).success).toBe(true);
    expect(SessionMetricsSchema.safeParse({ ...validSessionMetrics, minigames: [mk(cap + 1)] }).success).toBe(false);
  });
});
