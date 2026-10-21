import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayLinkStore } from "./handlers";

// PlayLinkStore backed by the issue_play_link and resolve_play_link SQL functions and the
// processing_consents table (supabase/migrations).
// Pass the service-role client (lib/supabase/admin.ts): play_links is closed to parents and to anon.
export function createSupabasePlayLinkStore(client: SupabaseClient): PlayLinkStore {
  return {
    async issue({ parentId, childId, codeHash, expiresAt, consent }) {
      const { data, error } = await client.rpc("issue_play_link", {
        p_parent_id: parentId,
        p_child_id: childId,
        p_code_hash: codeHash,
        p_expires_at: expiresAt.toISOString(),
        p_allow_camera: consent.camera,
        p_allow_microphone: consent.microphone,
      });
      if (error) throw new Error(`issue_play_link failed: ${error.message}`);
      return data === true;
    },
    async resolve(codeHash) {
      const { data, error } = await client.rpc("resolve_play_link", { p_code_hash: codeHash });
      if (error) throw new Error(`resolve_play_link failed: ${error.message}`);
      const row = (Array.isArray(data) ? data[0] : null) as
        | { child_id: string; allow_camera: boolean; allow_microphone: boolean }
        | null
        | undefined;
      return row ? { childId: row.child_id, consent: { camera: row.allow_camera === true, microphone: row.allow_microphone === true } } : null;
    },
    async hasProcessingConsent(parentId, version) {
      const { data, error } = await client
        .from("processing_consents")
        .select("id")
        .eq("parent_id", parentId)
        .eq("version", version)
        .limit(1);
      if (error) throw new Error(`processing_consents read failed: ${error.message}`);
      return (data ?? []).length > 0;
    },
  };
}
