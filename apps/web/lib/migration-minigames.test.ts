import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The database side of PC-02 and of the link lifetime. The SQL itself is run by supabase/tests/database
// (pgTAP); these checks only make sure the migration that does it exists and says what it must.
const dir = join(__dirname, "..", "..", "..", "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
const all = files.map((f) => ({ f, sql: readFileSync(join(dir, f), "utf8") }));
const latestSaveSession = [...all].reverse().find(({ sql }) => /create (or replace )?function public\.save_session/i.test(sql));

describe("save_session in the latest migration that defines it", () => {
  it("stores the minigames block of the session (PC-02), in a nullable jsonb column of sessions", () => {
    expect(latestSaveSession).toBeDefined();
    const sql = latestSaveSession?.sql ?? "";
    expect(sql).toMatch(/alter table public\.sessions\s+add column minigames jsonb/i);
    expect(sql).not.toMatch(/minigames jsonb not null/i);
    expect(sql).toMatch(/p_session -> 'minigames'/);
  });

  it("accepts an upload that arrives after the link expired, within a grace that covers the whole chain", () => {
    const sql = latestSaveSession?.sql ?? "";
    expect(sql).not.toMatch(/v_link\.expires_at <= now\(\)/);
    expect(sql).toMatch(/expires_at \+ .*interval.* <= now\(\)/i);
    expect(sql).toMatch(/TODO/);
  });

  it("keeps the grants: the server side role only", () => {
    const sql = latestSaveSession?.sql ?? "";
    expect(sql).toMatch(/revoke execute on function public\.save_session\(text, jsonb, jsonb\) from public, anon, authenticated/i);
    expect(sql).toMatch(/grant execute on function public\.save_session\(text, jsonb, jsonb\) to service.role/i);
  });
});
