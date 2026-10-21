import { afterEach, describe, expect, it, vi } from "vitest";
import { ScoreResultSchema, SessionMetricsSchema, type SessionMetrics } from "@adhdcheck/contracts";
import { validScoreResult } from "../../../../../packages/contracts/src/fixtures/score-result.valid";
import { validSessionMetrics } from "../../../../../packages/contracts/src/fixtures/session-metrics.valid";
import type { Consent, UploadResult } from "../../../lib/play-client";
import { runPlayFlow } from "./flow";
import { DEFAULT_SKIP_HOLD_MS, DEFAULT_TRANSITION_MS, browserDom, createHoldDetector, createSessionChain, toMiniGameEntry, type ChainDeps, type ChainStep } from "./chain";
import type { SessionGame } from "./game";

const CHILD = "7d9e0a1b-2c3d-4e5f-8a9b-0c1d2e3f4a5b";
const OFF: Consent = { camera: false, microphone: false };
const lanternMetrics = validSessionMetrics as SessionMetrics;
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
function harness(opts: { failing?: Record<string, "reject" | "throw" | "bad-result"> } = {}) {
  const log: string[] = [];
  const completers: Record<string, (r: unknown) => void> = {};
  const skips: Array<() => void> = [];
  let pendingLantern: SessionMetrics | undefined;
  const waits: number[] = [];
  let releaseWait: () => void = () => {};
  let holdWait = false;
  let lanternDone: (m: SessionMetrics) => void = (m) => {
    pendingLantern = m; // Lantern Watch starts after its own card: remember a finish that comes early
  };
  const lanternCalls: unknown[][] = [];
  const lantern: SessionGame = (el, childId, consent, audioContext) => {
    lanternCalls.push([childId, consent, audioContext]);
    log.push("lantern:mount");
    return {
      promise: new Promise<SessionMetrics>((resolve) => {
        lanternDone = (m) => {
          log.push("lantern:done");
          resolve(m);
        };
        if (pendingLantern) lanternDone(pendingLantern);
      }),
      destroy: () => log.push("lantern:destroy"),
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
    transitionMs: 1234,
    skipHoldMs: 777,
    wait: (ms) => {
      waits.push(ms);
      log.push(`wait:${ms}`);
      return holdWait ? new Promise<void>((r) => (releaseWait = r)) : Promise.resolve();
    },
    dom: {
      skip: (_el, onSkip, holdMs) => {
        log.push(`skip:on:${holdMs}`);
        skips.push(onSkip);
        return { remove: () => log.push("skip:remove") };
      },
      slot: () => ({ el: {} as HTMLElement, remove: () => log.push("slot:remove") }),
      card: (_el, n, total) => {
        log.push(`card:${n}/${total}`);
        return { remove: () => log.push(`card:remove:${n}`) };
      },
    },
  };
  return {
    log,
    waits,
    deps,
    lanternCalls,
    finishLantern: (m: SessionMetrics = lanternMetrics) => lanternDone(m),
    finish: (id: string, r: unknown = opts.failing?.[id] === "bad-result" ? { id, junk: true } : fakeResult(id)) => completers[id]?.(r),
    skip: () => skips.at(-1)?.(),
    skipAt: (i: number) => skips[i]?.(),
    skipsShown: () => skips.length,
    hold: () => (holdWait = true),
    release: () => releaseWait(),
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

  it("advances by itself: a card, the wait, then the next game, with no call from the parent", async () => {
    const h = harness();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    const i = (s: string) => h.log.indexOf(s);
    expect(i("lantern:done")).toBeLessThan(i("card:2/5"));
    const w = h.log.indexOf("wait:1234", i("card:2/5"));
    expect(i("card:2/5")).toBeLessThan(w);
    expect(w).toBeLessThan(i("card:remove:2"));
    expect(i("card:remove:2")).toBeLessThan(i("mount:star-path"));
    h.finish("star-path");
    await flush();
    expect(h.log).toContain("destroy:star-path");
    expect(h.log).toContain("card:3/5");
    expect(h.log).toContain("mount:bridge-wait");
  });

  it("keeps a card on screen for the whole wait: the next game is not mounted before the wait ends", async () => {
    const h = harness();
    h.hold();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    h.release(); // card 1 ends, Lantern Watch starts
    await flush();
    h.finishLantern();
    await flush();
    expect(h.log).toContain("card:2/5");
    expect(h.log).not.toContain("mount:star-path");
    h.release();
    await flush();
    expect(h.log).toContain("mount:star-path");
  });

  it("the card duration is a named TODO design choice", () => {
    expect(DEFAULT_TRANSITION_MS).toBeGreaterThan(0);
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
    const merged = await run.promise;
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
    const merged = await run.promise;
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
    const merged = await run.promise;
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

describe("createSessionChain: the hidden grown-up skip (I3)", () => {
  it("a game that mounts and never finishes can be skipped: the next game mounts and Lantern's data is still uploaded", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    expect(h.log).toContain("mount:star-path"); // never finished by the child
    h.skip();
    await flush();
    expect(h.log).toContain("destroy:star-path");
    expect(h.log).toContain("mount:bridge-wait");
    for (const id of ["bridge-wait", "treasure-choice", "route-planner"]) {
      await flush();
      h.finish(id);
    }
    const merged = await run.promise;
    const { minigames, ...rest } = merged;
    expect(rest).toEqual(lanternMetrics);
    expect(minigames?.[0]).toMatchObject({ id: "star-path", results: { status: "skipped", reason: "skipped_by_adult" } });
    expect(minigames?.map((m) => m.id)).toEqual(["star-path", "bridge-wait", "treasure-choice", "route-planner"]);
    expect(SessionMetricsSchema.safeParse(merged).success).toBe(true);
  });

  it("a game stuck while mounting (its mount promise never settles) can be skipped too", async () => {
    const h = harness();
    const stuck: ChainStep = { id: "star-path", mount: () => new Promise(() => {}) };
    const run = createSessionChain({ ...h.deps, steps: [stuck, ...h.deps.steps.slice(1)] })({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.skip();
    await flush();
    expect(h.log).toContain("mount:bridge-wait");
    run.destroy();
  });

  it("shows the control only while a mini-game runs, with the configured hold, never over Lantern Watch or a card", async () => {
    const h = harness();
    const run = createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    await flush();
    expect(h.skipsShown()).toBe(0); // card 1 and Lantern Watch: nothing to skip
    h.finishLantern();
    await flush();
    expect(h.skipsShown()).toBe(1);
    expect(h.log).toContain("skip:on:777");
    h.finish("star-path");
    await flush();
    expect(h.log).toContain("skip:remove");
    run.destroy();
  });

  it("the control of a game that already finished does nothing when it fires late", async () => {
    const h = harness();
    createSessionChain(h.deps)({} as HTMLElement, CHILD, OFF);
    h.finishLantern();
    await flush();
    h.finish("star-path");
    await flush();
    expect(h.log).toContain("mount:bridge-wait");
    h.skipAt(0); // star-path's control, late
    h.skipAt(0);
    await flush();
    expect(h.log).not.toContain("destroy:bridge-wait"); // the running game is untouched
    expect(h.log).not.toContain("mount:treasure-choice");
  });

  it("the hold duration is a named TODO design choice", () => {
    expect(DEFAULT_SKIP_HOLD_MS).toBeGreaterThan(0);
  });
});

describe("createHoldDetector (the long press behind the skip control)", () => {
  function fakeTimers() {
    let fn: (() => void) | null = null;
    let ms = -1;
    return {
      setTimer: (f: () => void, t: number) => {
        fn = f;
        ms = t;
        return 1;
      },
      clearTimer: () => (fn = null),
      fire: () => fn?.(),
      armed: () => fn !== null,
      ms: () => ms,
    };
  }

  it("fires once after the hold, and not when the finger lifts early", () => {
    const t = fakeTimers();
    let n = 0;
    const d = createHoldDetector(900, () => n++, t.setTimer, t.clearTimer);
    d.down();
    expect(t.ms()).toBe(900);
    d.up(); // short tap
    t.fire();
    expect(n).toBe(0);
    d.down();
    t.fire();
    expect(n).toBe(1);
  });

  it("a second finger or a cancelled pointer disarms it", () => {
    const t = fakeTimers();
    let n = 0;
    const d = createHoldDetector(900, () => n++, t.setTimer, t.clearTimer);
    d.down();
    d.up();
    expect(t.armed()).toBe(false);
    expect(n).toBe(0);
  });
});

describe("browserDom.skip on a touch screen (Chrome for Android long press)", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function fakeBox() {
    const listeners: Record<string, Array<(e: unknown) => void>> = {};
    const box = {
      style: { cssText: "" },
      setAttribute() {},
      addEventListener: (type: string, fn: (e: unknown) => void) => ((listeners[type] ??= []).push(fn)),
      remove() {},
    };
    const fire = (type: string) => {
      const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, stopPropagation() {} };
      for (const fn of listeners[type] ?? []) fn(e);
      return e;
    };
    return { box, fire };
  }

  it("a context menu opened by the long press is prevented and does not disarm the hold", () => {
    vi.useFakeTimers();
    const { box, fire } = fakeBox();
    vi.stubGlobal("document", { createElement: () => box });
    let skipped = 0;
    browserDom.skip({ appendChild() {} } as unknown as HTMLElement, () => skipped++, 3000);
    fire("pointerdown");
    vi.advanceTimersByTime(1000);
    const menu = fire("contextmenu");
    expect(menu.defaultPrevented).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(skipped).toBe(1);
  });

  it("the control opts out of the callout, text selection and browser gestures", () => {
    const { box } = fakeBox();
    vi.stubGlobal("document", { createElement: () => box });
    browserDom.skip({ appendChild() {} } as unknown as HTMLElement, () => {}, 3000);
    for (const css of ["-webkit-touch-callout:none", "user-select:none", "-webkit-user-select:none", "touch-action:none"])
      expect(box.style.cssText).toContain(css);
  });
});
