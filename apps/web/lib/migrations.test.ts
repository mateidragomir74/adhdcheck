// The Supabase CLI records each migration by the number before the first underscore, so two files with
// the same number collide: `db push` treats the second as already applied and never sends it.
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dir = fileURLToPath(new URL("../../../supabase/migrations/", import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".sql"));

describe("supabase migrations", () => {
  it("finds the migration files", () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it("gives every migration its own version number", () => {
    const byVersion = new Map<string, string[]>();
    for (const f of files) {
      const version = f.split("_")[0]!;
      byVersion.set(version, [...(byVersion.get(version) ?? []), f]);
    }
    const duplicates = [...byVersion.values()].filter((names) => names.length > 1);
    expect(duplicates).toEqual([]);
  });

  it("names every migration <14 digits>_<name>.sql", () => {
    expect(files.filter((f) => !/^\d{14}_[a-z0-9_]+\.sql$/.test(f))).toEqual([]);
  });
});
