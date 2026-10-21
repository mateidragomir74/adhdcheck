import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreResultSchema, type ScoreResult, type SessionMetrics } from "@adhdcheck/contracts";
import { validSessionMetrics } from "../../../../../packages/contracts/src/fixtures/session-metrics.valid";
import { newPlayCode } from "../../../lib/play-link";
import type { RateLimiter } from "../../../lib/rate-limit";
import { handleSessionPost, MAX_BODY_BYTES, MAX_OFF_TARGET_TAPS, MAX_TRIALS } from "./handler";
import { InvalidPlayLinkError, type SessionStore } from "./store";
import { DEFAULT_TASK, LanternWatchRunner, buildSessionMetrics, type RunData } from "@adhdcheck/game";

// In-memory store: same contract as the Supabase store, no database needed.
function memoryStore() {
  const saved = new Map<string, { codeHash: string; session: SessionMetrics; score: ScoreResult }>();
  const store: SessionStore = {
    async save(codeHash, session, score) {
      if (saved.has(session.session_id)) return { created: false };
      saved.set(session.session_id, { codeHash, session, score });
      return { created: true };
    },
  };
  return { store, saved };
}

const allowAll: RateLimiter = { take: async () => true };
const link = newPlayCode();

function post(
  body: unknown,
  store: SessionStore,
  { code = link.code as string | null, rateLimiter = allowAll } = {},
) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (code !== null) headers.authorization = `Bearer ${code}`;
  return handleSessionPost(
    new Request("http://localhost/api/sessions", {
      method: "POST",
      headers,
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { store, rateLimiter },
  );
}

afterEach(() => vi.restoreAllMocks());

describe("POST /api/sessions", () => {
  it("FR-11: saves a valid session with its trials and returns its ScoreResult", async () => {
    const { store, saved } = memoryStore();
    const res = await post(validSessionMetrics, store);

    expect(res.status).toBe(201);
    const body = ScoreResultSchema.parse(await res.json());
    expect(body.session_id).toBe(validSessionMetrics.session_id);

    const row = saved.get(validSessionMetrics.session_id);
    expect(row?.session.trials).toHaveLength(validSessionMetrics.trials.length);
    expect(row?.score).toEqual(body);
  });

  it("FR-01: passes the store the hash of the play code, never the code", async () => {
    const { store, saved } = memoryStore();
    await post(validSessionMetrics, store);

    expect(saved.get(validSessionMetrics.session_id)?.codeHash).toBe(link.codeHash);
  });

  it("FR-20: a session too short to score is still saved and returns band insufficient_data", async () => {
    const { store, saved } = memoryStore();
    const res = await post({ ...validSessionMetrics, trials: [] }, store);

    expect(res.status).toBe(201);
    expect((await res.json()).band).toBe("insufficient_data");
    expect(saved.size).toBe(1);
  });

  it("FR-12: a duplicate session_id is stored once and answered with the same result", async () => {
    const { store, saved } = memoryStore();
    const first = await post(validSessionMetrics, store);
    const second = await post(validSessionMetrics, store);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(saved.size).toBe(1);
  });

  it("FR-01: answers 401 without a play code and saves nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post(validSessionMetrics, store, { code: null });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_play_link" });
    expect(saved.size).toBe(0);
  });

  it("FR-01: answers 401 when the store refuses the play link (unknown, expired or used)", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const refusing: SessionStore = {
      async save() {
        throw new InvalidPlayLinkError();
      },
    };
    const res = await post(validSessionMetrics, refusing);

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "invalid_play_link" });
    expect(JSON.stringify(warn.mock.calls)).not.toContain(link.code);
  });

  it("NFR-13: answers 429 above the rate limit, before reading the body", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const take = vi.fn().mockResolvedValue(false);
    const res = await post("{not json", store, { rateLimiter: { take } });

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "too_many_requests" });
    expect(take).toHaveBeenCalledTimes(1);
    expect(saved.size).toBe(0);
  });

  it("NFR-13: answers 503 when the rate limit cannot be checked", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const broken: RateLimiter = {
      take: async () => {
        throw new Error("connection refused");
      },
    };
    const res = await post(validSessionMetrics, store, { rateLimiter: broken });

    expect(res.status).toBe(503);
    expect(saved.size).toBe(0);
  });

  it("rejects a body that is not JSON with 400 and saves nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post("{not json", store);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_json");
    expect(saved.size).toBe(0);
  });

  it("rejects an unknown field with 400 (strict contract) and saves nothing", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post({ ...validSessionMetrics, nickname: "Test Fox" }, store);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_session");
    expect(saved.size).toBe(0);
  });

  it("rejects a malformed trial with 400 and names the field, not its value", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store } = memoryStore();
    const bad = {
      ...validSessionMetrics,
      trials: [{ ...validSessionMetrics.trials[0], outcome: "unexpected-value" }],
    };
    const res = await post(bad, store);

    expect(res.status).toBe(400);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("trials.0.outcome");
    expect(text).not.toContain("unexpected-value");
  });

  it("NFR-13: rejects more trials than one session can hold with 400 and saves nothing", async () => {
    const { store, saved } = memoryStore();
    const trial = validSessionMetrics.trials[0];
    const trials = Array.from({ length: MAX_TRIALS + 1 }, (_, i) => ({ ...trial, i }));
    const res = await post({ ...validSessionMetrics, trials }, store);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_session", issues: [{ path: "trials", code: "too_big" }] });
    expect(saved.size).toBe(0);
  });

  it("NFR-13: rejects more off-target taps than one session can hold with 400", async () => {
    const { store, saved } = memoryStore();
    const off_target_taps = Array.from({ length: MAX_OFF_TARGET_TAPS + 1 }, () => ({ t_ms: 1, during: "isi" }));
    const res = await post({ ...validSessionMetrics, off_target_taps }, store);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_session", issues: [{ path: "off_target_taps", code: "too_big" }] });
    expect(saved.size).toBe(0);
  });

  it("rejects two trials with the same index with 400 instead of a storage error", async () => {
    const { store, saved } = memoryStore();
    const [first] = validSessionMetrics.trials;
    const res = await post({ ...validSessionMetrics, trials: [first, { ...first }] }, store);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_session", issues: [{ path: "trials.1.i", code: "duplicate" }] });
    expect(saved.size).toBe(0);
  });

  it("NFR-13: answers 413 to a body above the size limit, before reading it", async () => {
    const { store, saved } = memoryStore();
    const res = await handleSessionPost(
      new Request("http://localhost/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json", "content-length": String(MAX_BODY_BYTES + 1), authorization: `Bearer ${link.code}` },
        body: "{}",
      }),
      { store, rateLimiter: allowAll },
    );

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expect(saved.size).toBe(0);
  });

  // A streamed (chunked) upload carries no content-length, so the header check alone cannot bound it.
  function streamed(chunks: string[]) {
    const bytes = new TextEncoder();
    let pulled = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        const next = chunks[pulled++];
        if (next === undefined) controller.close();
        else controller.enqueue(bytes.encode(next));
      },
    });
    const request = new Request("http://localhost/api/sessions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${link.code}` },
      body,
      duplex: "half",
    } as RequestInit);
    return { request, pulledChunks: () => pulled };
  }

  it("NFR-13: answers 413 to a streamed body above the size limit with no content-length, and stops reading", async () => {
    const { store, saved } = memoryStore();
    const chunk = " ".repeat(100_000);
    const { request, pulledChunks } = streamed(Array.from({ length: 50 }, () => chunk));
    expect(request.headers.get("content-length")).toBeNull();

    const res = await handleSessionPost(request, { store, rateLimiter: allowAll });

    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expect(saved.size).toBe(0);
    expect(pulledChunks()).toBeLessThan(50);
  });

  it("NFR-13: still accepts a valid streamed body under the limit", async () => {
    const { store, saved } = memoryStore();
    const text = JSON.stringify(validSessionMetrics);
    const { request } = streamed([text.slice(0, 10), text.slice(10)]);

    const res = await handleSessionPost(request, { store, rateLimiter: allowAll });

    expect(res.status).toBe(201);
    expect(saved.size).toBe(1);
  });

  it("logs the error code but never the session content or ids", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store } = memoryStore();
    await post({ ...validSessionMetrics, nickname: "Test Fox" }, store);

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain("invalid_session");
    expect(logged).not.toContain("Test Fox");
    expect(logged).not.toContain(validSessionMetrics.child_id);
    expect(logged).not.toContain(validSessionMetrics.session_id);
  });

  it("answers 503 when storage fails, logs it, and does not return a result", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing: SessionStore = {
      async save() {
        throw new Error("connection refused");
      },
    };
    const res = await post(validSessionMetrics, failing);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "storage_unavailable" });
    expect(error).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/sessions with a Lantern Watch session (the game wired into /play/[code])", () => {
  // The game's own runner and payload builder, driven by a simulated child: every firefly tapped 400 ms after
  // onset, moths never. Synthetic ids.
  function lanternSession(): SessionMetrics {
    const task = { ...DEFAULT_TASK, blocks: 1, trialsPerBlock: 10 };
    let data: RunData | null = null;
    const taps: { t: number; lantern: number | null }[] = [];
    const r = new LanternWatchRunner(
      { task, seed: 3, anticipationMs: null },
      {
        onStimulus: (ts, tr) => {
          if (tr.type !== "nogo") taps.push({ t: ts + 400, lantern: tr.lantern });
        },
        onComplete: (d) => {
          data = d;
        },
      },
    );
    let ts = 1000;
    r.pointerDown(ts, 0, 0, null);
    for (let k = 0; k < 200_000 && !data; k++) {
      ts += 1000 / 60;
      while (taps.length && (taps[0] as { t: number }).t <= ts) {
        const p = taps.shift() as { t: number; lantern: number | null };
        r.pointerDown(p.t, 100, 100, p.lantern);
      }
      r.frame(ts);
    }
    const d = data as RunData | null;
    if (!d) throw new Error("simulated run did not finish");
    return buildSessionMetrics({
      sessionId: "5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b",
      childId: "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b",
      startedAt: "2026-10-20T10:00:00.000Z",
      durationMs: d.duration_ms,
      task,
      device: validSessionMetrics.device as SessionMetrics["device"],
      trials: d.trials,
      offTargetTaps: d.off_target_taps,
    });
  }

  it("FR-11: saves it with all its trials and returns a valid ScoreResult", async () => {
    const { store, saved } = memoryStore();
    const session = lanternSession();
    const res = await post(session, store);
    expect(res.status).toBe(201);
    const body = ScoreResultSchema.parse(await res.json());
    expect(body.session_id).toBe(session.session_id);
    expect(saved.get(session.session_id)?.session.trials).toHaveLength(20);
  });
});

describe("POST /api/sessions with the PC-02 minigames field", () => {
  const entry = {
    id: "star-path",
    version: "0.1.0",
    params: { n_stars: 9 },
    trials: [{ i: 0, outcome: "correct" }],
    results: { summary: { span: 2, errors: 0 } },
  };

  it("accepts a session with minigames and hands them to the store with Lantern's fields untouched", async () => {
    const { store, saved } = memoryStore();
    const res = await post({ ...validSessionMetrics, minigames: [entry] }, store);

    expect(res.status).toBe(201);
    const row = saved.get(validSessionMetrics.session_id);
    expect(row?.session.minigames).toEqual([entry]);
    expect(row?.session.trials).toEqual(validSessionMetrics.trials);
    expect(row?.session.calibration).toEqual(validSessionMetrics.calibration);
  });

  it("scores the session the same with or without minigames (the scorer input is unchanged)", async () => {
    const a = memoryStore();
    const b = memoryStore();
    const plain = await (await post(validSessionMetrics, a.store)).json();
    const withGames = await (await post({ ...validSessionMetrics, minigames: [entry] }, b.store)).json();
    expect(withGames).toEqual(plain);
  });

  it.each([
    ["an unknown field on an entry", { ...entry, extra: true }],
    ["an unknown game", { ...entry, id: "storm-watch" }],
    ["an entry without trials or results", { id: "star-path", version: "0.1.0", params: {} }],
  ])("rejects %s with 400 and saves nothing", async (_name, bad) => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const res = await post({ ...validSessionMetrics, minigames: [bad] }, store);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_session");
    expect(saved.size).toBe(0);
  });

  it("rejects minigames that is not an array", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store } = memoryStore();
    expect((await post({ ...validSessionMetrics, minigames: entry }, store)).status).toBe(400);
  });

  it("I4: answers 400, not 500, to a 5000 deep array in trials (no stack overflow in the parser)", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    // Built as text: JSON.stringify of a 5000 deep value overflows in the test itself.
    const deep = "[".repeat(5000) + "]".repeat(5000);
    const body = JSON.stringify({ ...validSessionMetrics, minigames: [{ ...entry, trials: ["__DEEP__"] }] }).replace('"__DEEP__"', deep);
    const res = await post(body, store);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_session");
    expect(saved.size).toBe(0);
  });

  it("M3: answers 400 to more trials than the game can play", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { store, saved } = memoryStore();
    const trials = Array.from({ length: 100 }, (_, i) => ({ i }));
    const res = await post({ ...validSessionMetrics, minigames: [{ ...entry, trials }] }, store);

    expect(res.status).toBe(400);
    expect(saved.size).toBe(0);
  });
});
