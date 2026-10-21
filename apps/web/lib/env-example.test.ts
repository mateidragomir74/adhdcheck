import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// R3-P7: .env.example lists every environment variable the code reads, so a new deployment is not missing
// one that only shows up as a 503 in production.
const ROOT = resolve(__dirname, "../../..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "backups"]);
// Set by the platform, not by us.
const PLATFORM = new Set(["NODE_ENV"]);

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...sources(full));
    else if (/\.(ts|tsx|mts|mjs)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(full);
  }
  return out;
}

describe(".env.example", () => {
  const listed = new Set(
    readFileSync(join(ROOT, ".env.example"), "utf8")
      .split(/\r?\n/)
      .map((line) => /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((n): n is string => !!n),
  );
  const read = new Set<string>();
  for (const dir of ["apps", "packages", "scripts"]) {
    for (const file of sources(join(ROOT, dir))) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\b(?:process\.)?env\.([A-Z][A-Z0-9_]+)\b/g)) read.add(m[1] as string);
    }
  }

  it("finds the variables the code reads (the scan can see them)", () => {
    expect(read.has("STRIPE_PRICE_ID")).toBe(true);
    expect(read.size).toBeGreaterThan(8);
  });

  it("names every variable the code reads", () => {
    const missing = [...read].filter((n) => !PLATFORM.has(n) && !listed.has(n));
    expect(missing).toEqual([]);
  });

  it("does not still name the renamed sender variable", () => {
    expect(listed.has("REPORT_FROM_EMAIL")).toBe(false);
    expect(listed.has("EMAIL_FROM")).toBe(true);
    expect(listed.has("SITE_URL")).toBe(true);
  });
});
