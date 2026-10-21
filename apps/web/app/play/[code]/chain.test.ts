import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreResultSchema, SessionMetricsSchema, type SessionMetrics } from "@adhdcheck/contracts";
import { validScoreResult } from "../../../../../packages/contracts/src/fixtures/score-result.valid";
import { validSessionMetrics } from "../../../../../packages/contracts/src/fixtures/session-metrics.valid";
import type { Consent, UploadResult } from "../../../lib/play-client";
import { runPlayFlow } from "./flow";
import * as chainModule from "./chain";
import { START_ENABLE_MS } from "@adhdcheck/game";
import { browserDom, createSessionChain, toMiniGameEntry, type ChainDeps, type ChainStep } from "./chain";
import { NEXT_STRINGS, nextGameText } from "./strings";
import type { SessionGame } from "./game";

const CHILD = "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
const OFF: Consent = { camera: false, microphone: false };
const lanternMetrics = validSessionMetrics as SessionMetrics;
// What Lantern Watch hands back when it is ended early: the trials recorded so far (fewer than the full run).
const partialMetrics: SessionMetrics = { ...lanternMetrics, trials: lanternMetrics.trials.slice(0, 1) };
const tick = () => new Promise((r) => setTimeout(r, 0));
const flush = async () => {
  for (let k = 0; k < 8; k++) await tick();
};

// Synthetic results shaped like the four mini-games' own result types.
function fakeResult(id: string): Record<string, unknown> {
  if (id === "route-planner")
    return { id, version: "0.1.0", params: { n_puzzles: 4 }, puzzles: [{ i: 0, solved: true }], summary: { nPuzzles: 4 } };
  const base = { id, version: "0.1.0", params: { seed: 1 }, trials: [{ i: 0 }], summary: { n: 1 } };
  return id === "star-path" ? { ...base, motion: null } : base;
}

type Harness = ReturnType<typeof harness>;
function harness(opts: { failing?: Record<string, "reject" | "throw" | "bad-result">; earlyResult?: SessionMetrics | null } = {}) {
  const log: string[] = [];
  const completers: Record<string, (r: unknown) => void> = {};
  const nexts: Array<() => void> = [];
  const earlyResult = opts.earlyResult === undefined ? partialMetrics : opts.earlyResult;
  let pendingLantern: SessionMetrics | null | undefined;
  // The "Game n of 5" card waits for a tap (Hatem, 2026-10-21): by default the harness child taps at once.
  const cardTaps: Array<() => void> = [];
  let holdCard = false;
  let lanternDone: (m: SessionMetrics | null) => void = (m) => {
    pendingLantern = m; // Lantern Watch starts after its own card: remember a finish that comes early
  };
  const lanternCalls: unknown[][] = [];
  const lantern: SessionGame = (el, childId, consent, audioContext) => {
    lanternCalls.push([childId, consent, audioContext]);
    log.push("lantern:mount");
    return {
      promise: new Promise<SessionMetrics | null>((resolve) => {
        lanternDone = (m) => {
          log.push("lantern:done");
          resolve(m);
        };
        if (pendingLantern !== undefined) lanternDone(pendingLantern);
      }),
      destroy: () => log.push("lantern:destroy"),
      endEarly: () => {
        log.push("lantern:endEarly");
        lanternDone(earlyResult);
      },
    };
  };
  const ids = ["star-path", "bridge-wait", "treasure-choice", "route-planner"] as const;
  const steps: ChainStep[] = ids.map((id) => ({
    id,
    mount: (_el, onComplete) => {
      log.push(`mount:${id}`);
      const mode = opts.failing?.[id];
      if (mode === "throw") throw new Error("boom"); // thrown before a promise exists
      if (mode === "reject") return Promise.reject(new Error("no WebGL"));
      completers[id] = (r) => onComplete(r as never);
      return Promise.resolve({ destroy: () => log.push(`destroy:${id}`) });
    },
  }));
  const deps: ChainDeps = {
    lantern,
    steps,
    dom: {
      next: (_el, onNext) => {
        log.push("next:on");
        nexts.push(onNext);
        return { remove: () => log.push("next:remove") };
      },
      slot: () => ({ el: {} as HTMLElement, remove: () => log.push("slot:remove") }),
      card: (_el, n, total) => {
        log.push(`card:${n}/${total}`);
        const tapped = holdCard ? new Promise<void>((r) => cardTaps.push(r)) : Promise.resolve();
        return { tapped, remove: () => log.push(`card:remove:${n}`) };
      },
    },
  };
  return {
    log,
    deps,
    lanternCalls,
    finishLantern: (m: SessionMetrics = lanternMetrics) => lanternDone(m),
    finish: (id: string, r: unknown = opts.failing?.[id] === "bad-result" ? { id, junk: true } : fakeResult(id)) => completers[id]?.(r),
    next: () => nexts.at(-1)?.(),
    nextAt: (i: number) => nexts[i]?.(),
    nextsShown: () => nexts.length,
    hold: () => (holdCard = true),
    release: () => cardTaps.shift()?.(),
    cardsWaiting: () => cardTaps.length,
  };
}

async function playAll(h: Harness, run = createSessionChain(h.deps)(({}) as HTMLElement, CHILD, OFF)) {
  h.finishLantern();
  for (const id of ["star-path", "bridge-wait", "treasure-choice", "route-planner"]) {
    await flush();
    h.finish(id);
  }
  return run.promise;
}

describe("createSessionChain: the order and the count", () => {
  it("plays Lantern Watch first, then Star Path, Bridge Wait, Treasure Choice and Route Planner (docs/04 section 5)", async () => {
    const h = harness();
    await playAll(h);
    expect(h.log.filter((l) => l.startsWith("mount:") || l === "lantern:mount")).toEqual([
      "lantern:mount",
      "mount:star-path",
      "mount:bridge-wait",
      "mount:treasure-choice",
      "mount:route-planner",
    ]);
  });

  it("shows 'game n of 5' before every game, Lantern Watch included, with no card after the last game", async () => {
    const h = harness();
    await playAll(h);
    expect(h.log.filter((l) => l.startsWith("card:") && !l.startsWith("card:remove"))).toEqual(["card:1/5", "card:2/5", "card:3/5", "card:4/5", "card:5/5"]);
  });

  it("advances without a call from the parent: a card, the child's tap, then the next game", async () => {
    const h = harness();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    const i = (s: string) => h.log.indexOf(s);
    expect(i("lantern:done")).toBeLessThan(i("card:2/5"));
    expect(i("card:2/5")).toBeLessThan(i("card:remove:2"));
    expect(i("card:remove:2")).toBeLessThan(i("mount:star-path"));
    h.finish("star-path");
    await flush();
    expect(h.log).toContain("destroy:star-path");
    expect(h.log).toContain("card:3/5");
    expect(h.log).toContain("mount:bridge-wait");
  });

  it("keeps a card on screen until the child taps: no game starts, however long it takes", async () => {
    vi.useFakeTimers();
    const h = harness();
    h.hold();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await vi.advanceTimersByTimeAsync(10 * 60_000); // ten minutes
    expect(h.log).toEqual(["card:1/5"]); // the card is shown; Lantern Watch has not started
    h.release(); // the child taps: card 1 ends, Lantern Watch starts
    await vi.advanceTimersByTimeAsync(0);
    expect(h.log).toContain("lantern:mount");
    h.finishLantern();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(h.log).toContain("card:2/5");
    expect(h.log).not.toContain("mount:star-path");
    expect(h.cardsWaiting()).toBe(1);
    h.release();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.log).toContain("mount:star-path");
    vi.useRealTimers();
  });

  it("destroying the chain while a card waits removes the card and starts nothing", async () => {
    const h = harness();
    h.hold();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    run.destroy();
    await flush();
    expect(h.log).toContain("card:remove:1");
    expect(h.log).not.toContain("lantern:mount");
  });

  it("has no card timer any more", () => {
    expect("DEFAULT_TRANSITION_MS" in chainModule).toBe(false);
  });

  it("gives Lantern Watch the child, the consent and the unlocked audio context, as before", async () => {
    const h = harness();
    const ctx = { state: "running" } as unknown as AudioContext;
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF, ctx);
    await flush();
    expect(h.lanternCalls).toEqual([[CHILD, OFF, ctx]]);
  });
});

describe("createSessionChain: the result handed to the upload", () => {
  it("resolves once, after the last game, with Lantern's metrics unchanged and the four results in minigames", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    let settled = 0;
    void run.promise.then(() => settled++);
    h.finishLantern();
    for (const id of ["star-path", "bridge-wait", "treasure-choice"]) {
      await flush();
      h.finish(id);
    }
    await flush();
    expect(settled).toBe(0); // three of four extra games done: not yet
    await flush();
    h.finish("route-planner");
    const merged = (await run.promise) as SessionMetrics;
    const { minigames, ...rest } = merged;
    expect(rest).toEqual(lanternMetrics); // the scorer input is exactly what Lantern Watch produced
    expect(minigames?.map((m) => m.id)).toEqual(["star-path", "bridge-wait", "treasure-choice", "route-planner"]);
    expect(SessionMetricsSchema.safeParse(merged).success).toBe(true);
  });

  it("maps Route Planner's puzzles to `trials` and the summary to `results` (PC-02: trials or results)", () => {
    const e = toMiniGameEntry(fakeResult("route-planner") as never);
    expect(e).toMatchObject({ id: "route-planner", trials: [{ i: 0, solved: true }], results: { summary: { nPuzzles: 4 } } });
    const s = toMiniGameEntry(fakeResult("star-path") as never);
    expect(s).toMatchObject({ id: "star-path", results: { summary: { n: 1 }, motion: null } });
  });

  it("uploads once, after the last game, when the page runs the chain through the play flow", async () => {
    const h = harness();
    const uploads: SessionMetrics[] = [];
    const order: string[] = [];
    const game = createSessionChain(h.deps);
    const flow = runPlayFlow("code-1", {
      resolve: async () => ({ child_id: CHILD, consent: OFF }),
      play: (childId, consent) => game({} as HTMLElement, childId, consent).promise,
      waitForStart: async () => {},
      upload: async (_c, m) => {
        uploads.push(m);
        order.push(`upload@${h.log.filter((l) => l.startsWith("destroy:")).length}`);
        return { status: "saved", score: ScoreResultSchema.parse(validScoreResult) } as UploadResult;
      },
      waitForNetwork: async () => {},
      show: () => {},
    });
    await flush();
    h.finishLantern();
    for (const id of ["star-path", "bridge-wait", "treasure-choice"]) {
      await flush();
      h.finish(id);
      await flush();
      expect(uploads).toHaveLength(0); // nothing leaves before the chain is over
    }
    await flush();
    h.finish("route-planner");
    await flow;
    expect(uploads).toHaveLength(1);
    expect(order).toEqual(["upload@4"]); // all four extra games were destroyed before the upload
    expect(uploads[0]?.minigames).toHaveLength(4);
  });
});

describe("createSessionChain: a game that fails is skipped and recorded, the chain goes on", () => {
  it.each(["reject", "throw", "bad-result"] as const)("mini-game 'bridge-wait' %s: next games still run and the session still resolves", async (mode) => {
    const h = harness({ failing: { "bridge-wait": mode } });
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.finish("star-path");
    await flush();
    if (mode === "bad-result") h.finish("bridge-wait");
    await flush();
    expect(h.log).toContain("mount:treasure-choice");
    h.finish("treasure-choice");
    await flush();
    h.finish("route-planner");
    const merged = (await run.promise) as SessionMetrics;
    const bridge = merged.minigames?.find((m) => m.id === "bridge-wait");
    expect(bridge?.results).toMatchObject({ status: "skipped" });
    expect(merged.minigames?.map((m) => m.id)).toEqual(["star-path", "bridge-wait", "treasure-choice", "route-planner"]);
    expect(SessionMetricsSchema.safeParse(merged).success).toBe(true);
  });

  it("still uploads when every extra game fails", async () => {
    const f = { "star-path": "reject", "bridge-wait": "reject", "treasure-choice": "throw", "route-planner": "reject" } as const;
    const h = harness({ failing: f });
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    const merged = (await run.promise) as SessionMetrics;
    expect(merged.minigames).toHaveLength(4);
    expect(merged.minigames?.every((m) => (m.results as { status?: string })?.status === "skipped")).toBe(true);
    const { minigames, ...rest } = merged;
    void minigames;
    expect(rest).toEqual(lanternMetrics);
  });

  it("ignores a second completion from the same game", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.finish("star-path");
    h.finish("star-path");
    await flush();
    expect(h.log.filter((l) => l === "mount:bridge-wait")).toHaveLength(1);
    run.destroy();
  });

  it("when Lantern Watch cannot start nothing is mounted after it and nothing resolves (same calm fallback as before)", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    let settled = false;
    void run.promise.then(() => (settled = true));
    await flush();
    expect(settled).toBe(false);
    expect(h.log.some((l) => l.startsWith("mount:"))).toBe(false);
  });
});

describe("createSessionChain: leaving the page", () => {
  it("destroy() stops the current game and the card, mounts nothing more and never resolves", async () => {
    const h = harness();
    h.hold();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    let settled = false;
    void run.promise.then(() => (settled = true));
    await flush();
    h.release();
    await flush();
    h.finishLantern();
    await flush();
    run.destroy();
    h.release();
    await flush();
    expect(h.log).toContain("card:remove:2");
    expect(h.log).not.toContain("mount:star-path");
    expect(settled).toBe(false);
  });

  it("destroy() during a game destroys that game once and the chain stays silent afterwards", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    run.destroy();
    h.finish("star-path"); // a late result
    await flush();
    expect(h.log.filter((l) => l === "destroy:star-path")).toHaveLength(1);
    expect(h.log).not.toContain("mount:bridge-wait");
  });
});

const STEP_IDS = ["star-path", "bridge-wait", "treasure-choice", "route-planner"] as const;

describe("createSessionChain: the visible Next game button, games 2 to 5", () => {
  it.each(STEP_IDS.map((id, k) => [id, k] as const))("pressed during %s: that game is destroyed and recorded as skipped, the next one starts", async (id, k) => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    for (const before of STEP_IDS.slice(0, k)) {
      await flush();
      h.finish(before);
    }
    await flush();
    expect(h.log).toContain(`mount:${id}`);
    h.next();
    await flush();
    expect(h.log).toContain(`destroy:${id}`);
    const following = STEP_IDS[k + 1];
    if (following) expect(h.log).toContain(`mount:${following}`);
    for (const after of STEP_IDS.slice(k + 1)) {
      await flush();
      h.finish(after);
    }
    const merged = (await run.promise) as SessionMetrics;
    expect(merged).not.toBeNull();
    const m = merged as SessionMetrics;
    const { minigames, ...rest } = m;
    expect(rest).toEqual(lanternMetrics); // Lantern's data is untouched
    expect(minigames?.map((e) => e.id)).toEqual([...STEP_IDS]);
    expect(minigames?.[k]).toMatchObject({ id, results: { status: "skipped", reason: "skipped" } });
    expect(minigames?.filter((e) => (e.results as { status?: string })?.status === "skipped")).toHaveLength(1);
    expect(SessionMetricsSchema.safeParse(m).success).toBe(true);
  });

  it("a game stuck while mounting (its mount promise never settles) can be skipped too", async () => {
    const h = harness();
    const stuck: ChainStep = { id: "star-path", mount: () => new Promise(() => {}) };
    const run = createSessionChain({ ...h.deps, steps: [stuck, ...h.deps.steps.slice(1)] })({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.next();
    await flush();
    expect(h.log).toContain("mount:bridge-wait");
    run.destroy();
  });

  it("skipping the LAST game uploads once, with Lantern's data and four entries, the last one skipped", async () => {
    const h = harness();
    const uploads: SessionMetrics[] = [];
    const game = createSessionChain(h.deps);
    const flow = runPlayFlow("code-1", {
      resolve: async () => ({ child_id: CHILD, consent: OFF }),
      play: (childId, consent) => game({} as HTMLElement, childId, consent).promise,
      waitForStart: async () => {},
      upload: async (_c, m) => {
        uploads.push(m);
        return { status: "saved", score: ScoreResultSchema.parse(validScoreResult) } as UploadResult;
      },
      waitForNetwork: async () => {},
      show: () => {},
    });
    await flush();
    h.finishLantern();
    for (const id of ["star-path", "bridge-wait", "treasure-choice"]) {
      await flush();
      h.finish(id);
    }
    await flush();
    expect(uploads).toHaveLength(0);
    h.next(); // Route Planner, the last game
    await flow;
    expect(uploads).toHaveLength(1);
    expect(h.log).toContain("destroy:route-planner");
    const { minigames, ...rest } = uploads[0] as SessionMetrics;
    expect(rest).toEqual(lanternMetrics);
    expect(minigames).toHaveLength(4);
    expect(minigames?.[3]).toMatchObject({ id: "route-planner", results: { status: "skipped", reason: "skipped" } });
  });

  it("every game of the chain gets its own control, shown only while it runs and removed when it ends, never over a card", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    expect(h.log).toContain("card:1/5");
    expect(h.nextsShown()).toBe(1); // Lantern Watch (the harness child taps its card at once)
    h.finishLantern();
    await flush();
    for (const id of STEP_IDS) {
      await flush();
      h.finish(id);
    }
    await run.promise;
    expect(h.nextsShown()).toBe(5);
    expect(h.log.filter((l) => l === "next:remove")).toHaveLength(5);
    // a control is created after its card was removed and removed before the next card is drawn
    const seq = h.log.filter((l) => l.startsWith("card:") || l.startsWith("next:"));
    for (let k = 0; k < seq.length; k++) if (seq[k] === "next:on") expect(seq[k - 1]).toMatch(/^card:remove:/);
  });

  it("the control of a game that already finished does nothing when it fires late, and a double press skips only once", async () => {
    const h = harness();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.finish("star-path");
    await flush();
    expect(h.log).toContain("mount:bridge-wait");
    const lanternControl = 0;
    const starControl = 1;
    h.nextAt(starControl); // star-path's control, late
    h.nextAt(starControl);
    h.nextAt(lanternControl); // Lantern's control, late
    await flush();
    expect(h.log).not.toContain("destroy:bridge-wait"); // the running game is untouched
    expect(h.log).not.toContain("mount:treasure-choice");
    expect(h.log.filter((l) => l === "lantern:endEarly")).toHaveLength(0);
    h.next();
    h.next();
    await flush();
    expect(h.log.filter((l) => l === "mount:treasure-choice")).toHaveLength(1);
    expect(h.log).not.toContain("destroy:treasure-choice");
  });
});

describe("createSessionChain: the visible Next game button during Lantern Watch", () => {
  it("ends Lantern Watch early, keeps its partial metrics, plays the other four games and uploads once", async () => {
    const h = harness();
    const uploads: SessionMetrics[] = [];
    const game = createSessionChain(h.deps);
    const flow = runPlayFlow("code-1", {
      resolve: async () => ({ child_id: CHILD, consent: OFF }),
      play: (childId, consent) => game({} as HTMLElement, childId, consent).promise,
      waitForStart: async () => {},
      upload: async (_c, m) => {
        uploads.push(m);
        return { status: "saved", score: ScoreResultSchema.parse(validScoreResult) } as UploadResult;
      },
      waitForNetwork: async () => {},
      show: () => {},
    });
    await flush();
    expect(h.nextsShown()).toBe(1);
    h.next(); // during Lantern Watch
    await flush();
    expect(h.log).toContain("lantern:endEarly");
    expect(h.log).toContain("mount:star-path"); // the chain goes on
    expect(uploads).toHaveLength(0);
    for (const id of STEP_IDS) {
      await flush();
      h.finish(id);
    }
    await flow;
    expect(uploads).toHaveLength(1);
    const { minigames, ...rest } = uploads[0] as SessionMetrics;
    expect(rest).toEqual(partialMetrics); // the trials recorded so far are what is uploaded
    expect(rest.trials.length).toBeLessThan(lanternMetrics.trials.length);
    expect(minigames?.map((e) => e.id)).toEqual([...STEP_IDS]);
    expect(SessionMetricsSchema.safeParse(uploads[0]).success).toBe(true);
  });

  it("removes the control as soon as Lantern Watch ends, and pressing it twice ends the game once", async () => {
    const h = harness();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    h.next();
    h.nextAt(0);
    await flush();
    expect(h.log.filter((l) => l === "lantern:endEarly")).toHaveLength(1);
    expect(h.log).toContain("next:remove");
  });

  it("when Lantern Watch has nothing valid to hand back (no calibration data yet): no upload, no further game, a calm end", async () => {
    const h = harness({ earlyResult: null });
    const uploads: SessionMetrics[] = [];
    const screens: string[] = [];
    const game = createSessionChain(h.deps);
    const flow = runPlayFlow("code-1", {
      resolve: async () => ({ child_id: CHILD, consent: OFF }),
      play: (childId, consent) => game({} as HTMLElement, childId, consent).promise,
      waitForStart: async () => {},
      upload: async (_c, m) => {
        uploads.push(m);
        return { status: "saved", score: ScoreResultSchema.parse(validScoreResult) } as UploadResult;
      },
      waitForNetwork: async () => {},
      show: (sc) => screens.push(sc.kind),
    });
    await flush();
    h.next();
    await flow;
    expect(uploads).toHaveLength(0);
    expect(screens.at(-1)).toBe("done");
    expect(h.log.some((l) => l.startsWith("mount:"))).toBe(false);
    expect(h.log).not.toContain("card:2/5");
  });

  it("leaving the page right after pressing it uploads nothing and starts nothing", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    let settled = false;
    void run.promise.then(() => (settled = true));
    await flush();
    run.destroy();
    h.next();
    await flush();
    expect(settled).toBe(false);
    expect(h.log.some((l) => l.startsWith("mount:"))).toBe(false);
  });
});

describe("the hidden long-press skip is gone", () => {
  it("no hold detector, no hold duration, no hidden control", () => {
    expect("createHoldDetector" in chainModule).toBe(false);
    expect("DEFAULT_SKIP_HOLD_MS" in chainModule).toBe(false);
    expect("skip" in browserDom).toBe(false);
    expect(typeof browserDom.next).toBe("function");
  });
});

describe("Next game texts", () => {
  it("exist in English and Romanian, with a label and a spoken description, and no em-dash", () => {
    for (const lang of ["en", "ro"] as const) {
      const t = nextGameText(lang);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.aria.length).toBeGreaterThan(0);
      expect(JSON.stringify(NEXT_STRINGS[lang])).not.toContain(String.fromCharCode(0x2014));
    }
    expect(nextGameText("en").label).toBe("Next game");
  });
});

describe("browserDom.next (the visible control)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  type Node = { tag: string; textContent: string; innerHTML: string; disabled?: boolean; style: { cssText: string }; attrs: Record<string, string>; listeners: Record<string, Array<(e: unknown) => void>>; kids: Node[]; removed: boolean };
  function fakeDoc() {
    const made: Node[] = [];
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        const node: Node & { setAttribute(k: string, v: string): void; append(...k: Node[]): void; addEventListener(t: string, f: (e: unknown) => void): void; remove(): void } = {
          tag,
          textContent: "",
          innerHTML: "",
          style: { cssText: "" },
          attrs: {},
          listeners: {},
          kids: [],
          removed: false,
          setAttribute(k, v) {
            node.attrs[k] = v;
          },
          append(...k) {
            node.kids.push(...k);
          },
          addEventListener(t, f) {
            (node.listeners[t] ??= []).push(f);
          },
          remove() {
            node.removed = true;
          },
        };
        made.push(node);
        return node;
      },
    });
    return made;
  }
  const press = (n: Node) => n.listeners.click?.forEach((fn) => fn({ stopPropagation() {}, preventDefault() {} }));

  it("is a real button with an icon and the label 'Next game', at least 44 by 44 CSS px, never hidden", () => {
    const made = fakeDoc();
    browserDom.next({ appendChild() {} } as unknown as HTMLElement, () => {});
    const button = made.find((n) => n.tag === "button")!;
    expect(button.attrs.type).toBe("button");
    expect(button.attrs["aria-label"]).toBe(nextGameText("en").aria);
    const all: Node[] = [];
    const walk = (n: Node) => (all.push(n), n.kids.forEach(walk));
    walk(button);
    expect(all.some((n) => n.textContent === "Next game")).toBe(true); // the visible label
    expect(all.some((n) => n.attrs["aria-hidden"] === "true" && n.innerHTML.includes("<svg"))).toBe(true); // the icon
    expect(button.style.cssText).toMatch(/min-height:44px/);
    expect(button.style.cssText).toMatch(/min-width:44px/);
    expect(button.style.cssText).not.toMatch(/opacity:0(;|$)/);
    expect(button.style.cssText).toMatch(/touch-action:manipulation/);
  });

  it("ignores presses for START_ENABLE_MS (a double tap on Start cannot also hit Next), then calls onNext once", async () => {
    vi.useFakeTimers();
    const made = fakeDoc();
    let n = 0;
    browserDom.next({ appendChild() {} } as unknown as HTMLElement, () => n++);
    const button = made.find((x) => x.tag === "button")!;
    expect(button.disabled).toBe(true);
    let elapsed = 0;
    for (const at of [60, 120, 250]) {
      await vi.advanceTimersByTimeAsync(at - elapsed);
      elapsed = at;
      press(button); // the second tap of a double tap
    }
    expect(n).toBe(0);
    await vi.advanceTimersByTimeAsync(START_ENABLE_MS);
    expect(button.disabled).toBe(false);
    press(button);
    press(button);
    expect(n).toBe(1);
  });

  it("removing the control takes the button out and stops the enable timer", async () => {
    vi.useFakeTimers();
    const made = fakeDoc();
    const c = browserDom.next({ appendChild() {} } as unknown as HTMLElement, () => {});
    const button = made.find((x) => x.tag === "button")!;
    c.remove();
    expect(made.some((x) => x.removed)).toBe(true);
    await vi.advanceTimersByTimeAsync(START_ENABLE_MS * 2);
    expect(button.disabled).toBe(true); // the timer was cleared: it never enabled a removed button
  });

  it("a press does not reach the game under it (pointerdown stops at the control)", () => {
    const made = fakeDoc();
    browserDom.next({ appendChild() {} } as unknown as HTMLElement, () => {});
    const button = made.find((x) => x.tag === "button")!;
    let stopped = 0;
    button.listeners.pointerdown?.forEach((fn) => fn({ stopPropagation: () => stopped++ }));
    expect(stopped).toBe(1);
  });
});

describe("browserDom.card waits for the child's tap", () => {
  afterEach(() => vi.unstubAllGlobals());

  function fakeDoc() {
    type Node = { disabled?: boolean; tag: string; textContent: string; style: { cssText: string }; listeners: Record<string, Array<() => void>>; removed: boolean; attrs: Record<string, string>; kids: Node[] };
    const made: Node[] = [];
    vi.stubGlobal("document", {
      createElement: (tag: string) => {
        const node = {
          tag,
          textContent: "",
          style: { cssText: "" },
          listeners: {} as Record<string, Array<() => void>>,
          removed: false,
          attrs: {} as Record<string, string>,
          kids: [] as Node[],
          setAttribute(k: string, v: string) {
            node.attrs[k] = v;
          },
          append(...k: Node[]) {
            node.kids.push(...k);
          },
          addEventListener(type: string, fn: () => void) {
            (node.listeners[type] ??= []).push(fn);
          },
          remove() {
            node.removed = true;
          },
        };
        made.push(node);
        return node;
      },
    });
    return made;
  }

  it("shows the title and a Start button, and settles only when the button is tapped", async () => {
    vi.useFakeTimers();
    const made = fakeDoc();
    const card = browserDom.card({ appendChild() {} } as unknown as HTMLElement, 2, 5);
    let settled = false;
    void card.tapped.then(() => (settled = true));
    const button = made.find((n) => n.tag === "button")!;
    // I-1: a tap in the first moments does nothing (the button is disabled), at 60, 120 and 250 ms
    let elapsed = 0;
    for (const at of [60, 120, 250]) {
      await vi.advanceTimersByTimeAsync(at - elapsed);
      elapsed = at;
      button.listeners.click?.forEach((fn) => fn());
    }
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    expect(button.disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(button.disabled).toBe(false);
    expect(settled).toBe(false); // ten minutes: still on screen
    expect(button.textContent).toBe("Start");
    expect(made.some((n) => n.textContent === "Game 2 of 5")).toBe(true);
    expect(button.style.cssText).toMatch(/min-height:64px/);
    button.listeners.click?.forEach((fn) => fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(true);
    vi.useRealTimers();
  });

  it("the Start button is outside the live region (role=status), so a screen reader does not re-announce it", () => {
    const made = fakeDoc();
    browserDom.card({ appendChild() {} } as unknown as HTMLElement, 1, 5);
    const button = made.find((n) => n.tag === "button")!;
    const status = made.find((n) => n.attrs.role === "status")!;
    const contains = (n: typeof status, target: typeof status): boolean => n === target || n.kids.some((k) => contains(k, target));
    expect(status).toBeDefined();
    expect(contains(status, button)).toBe(false);
    expect(status.kids.some((k) => k.textContent === "Game 1 of 5")).toBe(true); // the announcement stays in the live region
  });

  it("removing the card settles it too, so a destroyed chain does not hang", async () => {
    fakeDoc();
    const card = browserDom.card({ appendChild() {} } as unknown as HTMLElement, 1, 5);
    let settled = false;
    void card.tapped.then(() => (settled = true));
    card.remove();
    await Promise.resolve();
    expect(settled).toBe(true);
  });
});
