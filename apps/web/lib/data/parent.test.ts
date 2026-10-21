import { describe, expect, it } from "vitest";
import { validScoreResult } from "../../../../packages/contracts/src/fixtures/score-result.valid";
import { toSessionResult, validateNewChild } from "./parent";

const SESSION_ID = validScoreResult.session_id;

// A sessions row as PostgREST returns it with its embedded scores row (object or one-element array).
function row(score: unknown) {
  return {
    id: SESSION_ID,
    child_id: "00000000-0000-4000-8000-0000000000ca",
    started_at: "2026-10-01T16:30:00+00:00",
    duration_ms: 300000,
    device: { pointer_type: "touch", user_agent: "synthetic-demo-agent", screen_w: 1024 },
    scores: score,
  };
}

const scoreColumns: Record<string, unknown> = { ...validScoreResult };
delete scoreColumns.schema_version;
delete scoreColumns.session_id;

describe("toSessionResult (FR-33, FR-38)", () => {
  it("turns a session row with its score into a contract-checked ScoreResult", () => {
    const result = toSessionResult(row(scoreColumns));

    expect(result.session_id).toBe(SESSION_ID);
    expect(result.started_at).toBe("2026-10-01T16:30:00+00:00");
    expect(result.device).toEqual({ pointer_type: "touch", user_agent: "synthetic-demo-agent" });
    expect(result.score).toEqual(validScoreResult);
  });

  it("accepts the score embedded as a one-element array", () => {
    expect(toSessionResult(row([scoreColumns])).score).toEqual(validScoreResult);
  });

  it("gives score null for a session that has no score yet", () => {
    expect(toSessionResult(row(null)).score).toBeNull();
    expect(toSessionResult(row([])).score).toBeNull();
  });

  it("throws on a score that breaks the contract instead of showing it", () => {
    expect(() => toSessionResult(row({ ...scoreColumns, band: "severe" }))).toThrow();
  });
});

describe("validateNewChild (FR-31)", () => {
  it("keeps only nickname and birth year, trimmed", () => {
    expect(validateNewChild({ nickname: "  Fox ", birth_year: 2018 })).toEqual({ nickname: "Fox", birth_year: 2018 });
  });

  it.each([
    [{ nickname: "", birth_year: 2018 }],
    [{ nickname: "   ", birth_year: 2018 }],
    [{ nickname: "Fox", birth_year: 2018.5 }],
    [{ nickname: "Fox", birth_year: "2018" }],
    [{ nickname: "Fox" }],
    [{ nickname: "x".repeat(41), birth_year: 2018 }],
    [{ nickname: "Fox", birth_year: 2012 }],
    [{ nickname: "Fox", birth_year: 2021 }],
  ])("refuses %j", (input) => {
    expect(validateNewChild(input, new Date("2026-10-20T12:00:00Z"))).toBeNull();
  });

  it("accepts the longest nickname and both ends of the birth-year range", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    expect(validateNewChild({ nickname: "x".repeat(40), birth_year: 2018 }, now)).not.toBeNull();
    expect(validateNewChild({ nickname: "Fox", birth_year: 2014 }, now)).not.toBeNull();
    expect(validateNewChild({ nickname: "Fox", birth_year: 2020 }, now)).not.toBeNull();
  });

  // Intended purpose: children aged 6 to 12 (docs/02 section 2). With a birth year only, the
  // accepted years are (current year - 12) to (current year - 6), as in the add-child form.
  const now = new Date("2026-10-20T12:00:00Z");
  it.each([2014, 2017, 2020])("accepts birth year %i in 2026 (age 6 to 12)", (birth_year) => {
    expect(validateNewChild({ nickname: "Fox", birth_year }, now)).toEqual({ nickname: "Fox", birth_year });
  });
  it.each([2013, 2021, 1990, 2026])("refuses birth year %i in 2026 (outside 6 to 12)", (birth_year) => {
    expect(validateNewChild({ nickname: "Fox", birth_year }, now)).toBeNull();
  });
});
