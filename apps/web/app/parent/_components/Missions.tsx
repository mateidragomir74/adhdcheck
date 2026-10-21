"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { attempt } from "@/lib/attempt";
import { addMission, deleteMission, setMissionDone, type MissionRow } from "@/lib/data/parent";
import { MISSIONS } from "@/lib/missions";
import { S } from "../strings";
import { ErrorNote, buttonQuiet, field, postJson } from "./shell";

// FR-37: the parent picks missions from the catalogue and ticks them off. Nothing here reads a score
// (NFR-52): missions are never chosen from a result.
export function Missions({
  client,
  childId,
  missions,
  onChange,
}: {
  client: SupabaseClient;
  childId: string;
  missions: MissionRow[];
  onChange: (missions: MissionRow[]) => void;
}) {
  const [pick, setPick] = useState(MISSIONS[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = (key: string) => MISSIONS.find((m) => m.key === key)?.title ?? key;

  async function run(action: () => Promise<MissionRow[]>) {
    setBusy(true);
    setFailed(false);
    const done = await attempt(action);
    if (done.ok) onChange(done.value);
    else setFailed(true);
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <p className="text-ink-muted">{S.missions.hint}</p>
      {failed && <ErrorNote />}
      {missions.length === 0 ? (
        <p>{S.missions.empty}</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {missions.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-2">
              <label className="flex min-h-11 flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  className="size-5 accent-[var(--leaf)]"
                  checked={m.status === "done"}
                  disabled={busy}
                  onChange={(e) =>
                    run(async () => {
                      const row = await setMissionDone(client, m.id, e.target.checked);
                      return missions.map((x) => (x.id === row.id ? row : x));
                    })
                  }
                />
                <span className={m.status === "done" ? "text-ink-muted line-through" : ""}>{title(m.mission_key)}</span>
              </label>
              <button
                type="button"
                disabled={busy}
                className="min-h-11 rounded-lg px-2 text-sm text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink"
                onClick={() =>
                  run(async () => {
                    await deleteMission(client, m.id);
                    return missions.filter((x) => x.id !== m.id);
                  })
                }
              >
                {S.missions.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const added = await addMission(client, childId, pick);
            // FR-50 "new mission" email: best effort, never blocks or undoes the mission.
            void postJson("/api/emails/mission", { mission_id: added.id }).catch(() => {});
            return [...missions, added];
          });
        }}
      >
        <select aria-label={S.missions.title} value={pick} onChange={(e) => setPick(e.target.value)} className={field}>
          {MISSIONS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.title}
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy} className={buttonQuiet}>
          {S.missions.add}
        </button>
      </form>
    </div>
  );
}
