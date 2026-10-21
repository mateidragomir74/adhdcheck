"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { listChildren, listMissions, listSessionResults, type Child, type MissionRow, type SessionResult } from "@/lib/data/parent";
import { S } from "../strings";
import { BandHeadline } from "../_components/BandHeadline";
import { ProgressChart } from "../_components/ProgressChart";
import { ResultCard, formatDate } from "../_components/ResultCard";
import { ErrorNote, Loading, Panel, Shell, useParent } from "../_components/shell";
import { StartSession } from "../_components/StartSession";

// One child: start a game (QR), the latest result card, progress, earlier games, delete (FR-41).
// The Missions section (_components/Missions.tsx, lib/data, the API) is kept but not shown (Hatem, 2026-10-20).
export function ChildView({ childId }: { childId: string }) {
  const { client, ready } = useParent();
  const router = useRouter();
  const [child, setChild] = useState<Child | null>(null);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [missions, setMissions] = useState<MissionRow[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">("loading");
  // ?session=<id>: the report email links to the session that was paid for (the page is read inside Suspense).
  const [shown, setShown] = useState<string | null>(useSearchParams().get("session"));

  useEffect(() => {
    if (!ready) return;
    let live = true;
    (async () => {
      const found = (await listChildren(client)).find((c) => c.id === childId) ?? null;
      if (!found) return null;
      const [r, m] = await Promise.all([listSessionResults(client, childId), listMissions(client, childId)]);
      return { found, r, m };
    })().then(
      (data) => {
        if (!live) return;
        if (!data) return setState("missing");
        setChild(data.found);
        setResults(data.r);
        setMissions(data.m);
        setState("ready");
      },
      () => live && setState("failed"),
    );
    return () => {
      live = false;
    };
  }, [ready, client, childId]);

  if (state === "loading")
    return (
      <Shell>
        <Loading />
      </Shell>
    );
  if (state !== "ready" || !child)
    return (
      <Shell>
        <BackLink />
        {state === "missing" ? (
          // The header of the Shell carries the Log out action.
          <p role="alert" className="rounded-xl bg-berry-soft px-4 py-3 text-ink">
            {S.child.notFound}
          </p>
        ) : (
          <ErrorNote />
        )}
      </Shell>
    );

  const scored = results.filter((r) => r.score);
  const current = scored.find((r) => r.session_id === shown) ?? scored.at(-1) ?? null;

  return (
    <Shell>
      <BackLink />
      <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">{child.nickname}</h1>
      <p className="text-ink-muted">{child.birth_year}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Panel title={S.session.title}>
            <StartSession
              client={client}
              childId={child.id}
              knownSessions={results.map((r) => r.session_id)}
              onResult={(result) => {
                setResults((prev) => [...prev.filter((r) => r.session_id !== result.session_id), result]);
                setShown(result.session_id);
              }}
            />
          </Panel>
          {current && <ResultCard result={current} />}
          <Panel title={S.progress.title}>
            <ProgressChart results={results} missionsDone={missions.filter((m) => m.status === "done").length} />
          </Panel>
        </div>

        <aside className="space-y-6">
          {scored.length > 1 && (
            <Panel title={S.child.history}>
              <ul className="-mx-2 max-h-96 overflow-y-auto">
                {[...scored].reverse().map((r) => (
                  <li key={r.session_id}>
                    <button
                      type="button"
                      onClick={() => setShown(r.session_id)}
                      aria-current={current?.session_id === r.session_id}
                      className="flex min-h-11 w-full flex-col items-start rounded-lg px-2 py-2 text-left hover:bg-cream-2 focus-visible:outline-2 focus-visible:outline-ink aria-[current=true]:bg-cream-2"
                    >
                      <span className="text-sm text-ink-muted">{formatDate(r.started_at)}</span>
                      <span className="text-sm">{r.score ? <BandHeadline band={r.score.band} /> : ""}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <button
            type="button"
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-berry underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-berry"
            onClick={async () => {
              if (!window.confirm(S.child.confirmDelete)) return;
              const res = await fetch(`/api/children/${child.id}`, { method: "DELETE" }).catch(() => null);
              if (res?.ok) router.replace("/parent");
              else setState("failed");
            }}
          >
            {S.child.delete}
          </button>
        </aside>
      </div>
    </Shell>
  );
}

function BackLink() {
  return (
    <Link href="/parent" className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-ink">
      ← {S.child.back}
    </Link>
  );
}
