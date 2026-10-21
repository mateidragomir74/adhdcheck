import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Hatem, 2026-10-20: the Missions section is not shown on the parent's child page. The component, the data layer
// (lib/data/parent.ts, missions.ts), the table and the API stay. ChildView is a client component that needs a
// signed-in Supabase session, so this test reads its source for the section rather than rendering it.
const source = readFileSync(join(__dirname, "ChildView.tsx"), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

describe("ChildView, Missions section", () => {
  it("does not render the Missions component or its panel title", () => {
    expect(code).not.toMatch(/<Missions[\s/>]/);
    expect(code).not.toMatch(/S\.missions\.title/);
  });

  it("keeps the missions data layer wired (the progress chart still counts done missions)", () => {
    expect(code).toMatch(/listMissions\(/);
  });

  it("leaves the other panels in place (the check can fail: it would also flag a removed section)", () => {
    expect(code).toMatch(/<StartSession/);
    expect(code).toMatch(/<ProgressChart/);
    expect(code).toMatch(/S\.child\.history/);
  });
});
