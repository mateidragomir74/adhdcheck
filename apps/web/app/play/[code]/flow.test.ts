import { describe, expect, it } from "vitest";
import { ScoreResultSchema, type SessionMetrics } from "@adhdcheck/contracts";
import { validScoreResult } from "../../../../../packages/contracts/src/fixtures/score-result.valid";
import { validSessionMetrics } from "../../../../../packages/contracts/src/fixtures/session-metrics.valid";
import type { Consent, UploadResult } from "../../../lib/play-client";
import { runPlayFlow, type FlowDeps, type Screen } from "./flow";

const CHILD = "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
const OFF: Consent = { camera: false, microphone: false };
const metrics = validSessionMetrics as SessionMetrics;
const saved: UploadResult = { status: "saved", score: ScoreResultSchema.parse(validScoreResult) };

function setup(over: Partial<FlowDeps> & { uploads?: UploadResult[] } = {}) {
  const screens: Screen["kind"][] = [];
  const calls = { upload: 0, play: 0, network: 0 };
  const played: Consent[] = [];
  const ready: Screen[] = [];
  const uploads = over.uploads ?? [saved];
  const deps: FlowDeps = {
    resolve: async () => ({ child_id: CHILD, consent: OFF }),
    play: async (childId, consent) => {
      calls.play += 1;
      played.push(consent);
      expect(childId).toBe(CHILD);
      return metrics;
    },
    waitForStart: async () => {},
    upload: async (code, m) => {
      expect(code).toBe("code-1");
      expect(m).toBe(metrics);
      return uploads[Math.min(calls.upload++, uploads.length - 1)] as UploadResult;
    },
    waitForNetwork: async () => {
      calls.network += 1;
    },
    show: (s) => {
      screens.push(s.kind);
      if (s.kind === "ready") ready.push(s);
    },
    ...over,
  };
  return { deps, screens, calls, played, ready };
}

describe("runPlayFlow, camera and microphone choices (FR-70)", () => {
  it("hands the game both sensors off when the parent switched nothing on", async () => {
    const { deps, played, ready } = setup();
    await runPlayFlow("code-1", deps);
    expect(played).toEqual([OFF]);
    expect(ready).toEqual([{ kind: "ready", consent: OFF }]);
  });

  it("hands the game exactly the parent's choice, and the start screen shows it for the explanation", async () => {
    const consent = { camera: false, microphone: true };
    const { deps, played, ready } = setup({ resolve: async () => ({ child_id: CHILD, consent }) });
    await runPlayFlow("code-1", deps);
    expect(played).toEqual([consent]);
    expect(ready).toEqual([{ kind: "ready", consent }]);
  });
});

describe("runPlayFlow", () => {
  it("checks the link, waits for the start tap, plays, uploads and ends on a calm screen", async () => {
    const { deps, screens, calls } = setup();
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "ready", "playing", "saving", "done"]);
    expect(calls.upload).toBe(1);
  });

  it("shows the neutral invalid screen and records nothing for an unknown or used link", async () => {
    const { deps, screens, calls } = setup({ resolve: async () => null });
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "invalid"]);
    expect(calls.play + calls.upload).toBe(0);
  });

  it("treats a lookup that throws (no network) like an invalid link", async () => {
    const { deps, screens } = setup({ resolve: async () => Promise.reject(new Error("offline")) });
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "invalid"]);
  });

  it("says the game is not ready when no session game exists, without playing or uploading", async () => {
    const { deps, screens, calls } = setup({ play: null });
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "unavailable"]);
    expect(calls.upload).toBe(0);
  });

  it("keeps the session and uploads it again once the network is back (FR-12)", async () => {
    const { deps, screens, calls } = setup({ uploads: [{ status: "failed" }, { status: "failed" }, saved] });
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "ready", "playing", "saving", "offline", "saving", "offline", "saving", "done"]);
    expect(calls.upload).toBe(3);
    expect(calls.network).toBe(2);
    expect(calls.play).toBe(1);
  });

  it("ends calmly without retrying when the server refuses the session", async () => {
    const { deps, screens, calls } = setup({ uploads: [{ status: "refused", error: "invalid_play_link" }] });
    await runPlayFlow("code-1", deps);
    expect(screens.at(-1)).toBe("done");
    expect(calls.upload).toBe(1);
  });
});

describe("runPlayFlow, leaving the page (R3-L1)", () => {
  it("uploads nothing and shows nothing once the signal is aborted during play", async () => {
    const controller = new AbortController();
    let finish: (m: SessionMetrics) => void = () => {};
    const { deps, screens, calls } = setup({
      play: () =>
        new Promise<SessionMetrics>((resolve) => {
          finish = resolve;
        }),
    });
    const flow = runPlayFlow("code-1", deps, controller.signal);
    await new Promise((r) => setTimeout(r, 0));
    controller.abort();
    const shownBefore = screens.length;
    finish(metrics);
    await flow;
    expect(calls.upload).toBe(0);
    expect(screens.length).toBe(shownBefore);
  });

  it("does not start playing when the page left before the start tap", async () => {
    const controller = new AbortController();
    const { deps, calls } = setup({
      waitForStart: async () => {
        controller.abort();
      },
    });
    await runPlayFlow("code-1", deps, controller.signal);
    expect(calls.play).toBe(0);
  });
});

describe("runPlayFlow, link checked again at the start tap (M2)", () => {
  it("shows the neutral invalid screen, plays nothing and uploads nothing when the link expired while the start screen waited", async () => {
    let calls = 0;
    const { deps, screens, calls: c } = setup({
      resolve: async () => (++calls === 1 ? { child_id: CHILD, consent: OFF } : null),
    });
    await runPlayFlow("code-1", deps);
    expect(calls).toBe(2);
    expect(screens).toEqual(["checking", "ready", "invalid"]);
    expect(c.play + c.upload).toBe(0);
  });

  it("plays as usual when the link is still good at the tap", async () => {
    let calls = 0;
    const { deps, screens } = setup({ resolve: async () => ({ child_id: CHILD, consent: OFF }) });
    const resolve = deps.resolve;
    deps.resolve = async (code) => (calls++, resolve(code));
    await runPlayFlow("code-1", deps);
    expect(calls).toBe(2);
    expect(screens).toEqual(["checking", "ready", "playing", "saving", "done"]);
  });

  it("does not block a child whose network is down at the tap: the first answer stands", async () => {
    let calls = 0;
    const { deps, screens } = setup({
      resolve: async () => {
        if (++calls === 1) return { child_id: CHILD, consent: OFF };
        throw new Error("offline");
      },
    });
    await runPlayFlow("code-1", deps);
    expect(screens).toEqual(["checking", "ready", "playing", "saving", "done"]);
  });
});

describe("runPlayFlow, a game ended with nothing to save (Next game before any usable data)", () => {
  it("ends on the calm done screen and uploads nothing when the game hands back null", async () => {
    const { deps, screens, calls } = setup({ play: async () => null });
    await runPlayFlow("code-1", deps);
    expect(calls.upload).toBe(0);
    expect(screens.at(-1)).toBe("done");
    expect(screens).not.toContain("saving");
  });
});
