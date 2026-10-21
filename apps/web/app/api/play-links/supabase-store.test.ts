import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabasePlayLinkStore } from "./supabase-store";

const PARENT = "00000000-0000-4000-8000-00000000000a";
const CHILD = "00000000-0000-4000-8000-0000000000ca";
const codeHash = "b".repeat(64);

function fakeClient(result: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe("SupabasePlayLinkStore", () => {
  it("issues through issue_play_link with the parent, the child, the hash, the expiry and the choices", async () => {
    const { client, rpc } = fakeClient({ data: true, error: null });
    const expiresAt = new Date("2026-10-20T11:00:00Z");
    const consent = { camera: false, microphone: true };
    const issued = await createSupabasePlayLinkStore(client).issue({ parentId: PARENT, childId: CHILD, codeHash, expiresAt, consent });

    expect(issued).toBe(true);
    expect(rpc).toHaveBeenCalledWith("issue_play_link", {
      p_parent_id: PARENT,
      p_child_id: CHILD,
      p_code_hash: codeHash,
      p_expires_at: "2026-10-20T11:00:00.000Z",
      p_allow_camera: false,
      p_allow_microphone: true,
    });
  });

  it("NFR-04: finds the parent's consent to one text version, read from processing_consents", async () => {
    const calls: unknown[][] = [];
    const chain = (data: unknown[]) => {
      const q = {
        select: (...a: unknown[]) => (calls.push(["select", ...a]), q),
        eq: (...a: unknown[]) => (calls.push(["eq", ...a]), q),
        limit: (...a: unknown[]) => (calls.push(["limit", ...a]), Promise.resolve({ data, error: null })),
      };
      return q;
    };
    const from = vi.fn().mockReturnValueOnce(chain([{ id: 1 }])).mockReturnValueOnce(chain([]));
    const store = createSupabasePlayLinkStore({ from } as unknown as SupabaseClient);

    expect(await store.hasProcessingConsent(PARENT, "v1")).toBe(true);
    expect(await store.hasProcessingConsent(PARENT, "v1")).toBe(false);
    expect(from).toHaveBeenCalledWith("processing_consents");
    expect(calls).toContainEqual(["eq", "parent_id", PARENT]);
    expect(calls).toContainEqual(["eq", "version", "v1"]);
  });

  it("answers false when the child is not the parent's", async () => {
    const { client } = fakeClient({ data: false, error: null });
    const expiresAt = new Date();
    const consent = { camera: false, microphone: false };
    expect(await createSupabasePlayLinkStore(client).issue({ parentId: PARENT, childId: CHILD, codeHash, expiresAt, consent })).toBe(false);
  });

  it("resolves through resolve_play_link and answers the child and the choices, or null", async () => {
    const found = fakeClient({ data: [{ child_id: CHILD, allow_camera: true, allow_microphone: false }], error: null });
    expect(await createSupabasePlayLinkStore(found.client).resolve(codeHash)).toEqual({
      childId: CHILD,
      consent: { camera: true, microphone: false },
    });
    expect(found.rpc).toHaveBeenCalledWith("resolve_play_link", { p_code_hash: codeHash });

    const missing = fakeClient({ data: [], error: null });
    expect(await createSupabasePlayLinkStore(missing.client).resolve(codeHash)).toBeNull();
  });

  it("throws on a database error", async () => {
    const { client } = fakeClient({ data: null, error: { message: "connection refused" } });
    await expect(createSupabasePlayLinkStore(client).resolve(codeHash)).rejects.toThrow();
  });
});
