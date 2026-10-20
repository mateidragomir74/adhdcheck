import type {
  BlockKind,
  BlockSummary,
  DistractorCost,
  DistractorType,
  Outcome,
  ScheduleConfig,
  ScheduledTrial,
  StormWatchResult,
  StormWatchSummary,
  StormWatchTrialRecord,
  Tap,
  TrialType,
} from "./types";

// Clinically grounded timing (Conners CPT & MOXO d-CPT pediatric norms)
export const STIMULUS_MS = 900; // 900ms allows children 6-12 comfortable visual acquisition & reaction
export const ISI_MS_MIN = 1200; // Jittered 1.2s - 2.0s ISI prevents simple rhythmic anticipation
export const ISI_MS_MAX = 2000;
export const TRIALS_PER_BLOCK = 40; // 2 blocks x 40 = 80 total
export const BLOCKS = 2;
export const GO_PROBABILITY = 0.8; // 80% Go builds prepotent motor response, testing inhibition on No-Go
export const AUDIO_CUE_FRACTION = 0.25; // 25% cross-modal audio shift
export const PRACTICE_TRIALS = 4;
export const ANTICIPATION_MS = 150; // Taps < 150ms are motor anticipations (impulsive guessing)

export function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSchedule(cfg: ScheduleConfig): ScheduledTrial[] {
  const rnd = mulberry32(cfg.seed);
  const trialsPerBlock = cfg.trialsPerBlock ?? TRIALS_PER_BLOCK;
  const stimulusMs = cfg.stimulusMs ?? STIMULUS_MS;
  const isiMin = cfg.isiMsMin ?? ISI_MS_MIN;
  const isiMax = cfg.isiMsMax ?? ISI_MS_MAX;
  const goProb = cfg.goProbability ?? GO_PROBABILITY;
  const audioFraction = cfg.audioCueFraction ?? AUDIO_CUE_FRACTION;

  const nGoTotal = Math.round(trialsPerBlock * goProb); // 32
  const nNogo = trialsPerBlock - nGoTotal; // 8
  const nGoAudio = Math.round(nGoTotal * audioFraction); // 8
  const nGoVisual = nGoTotal - nGoAudio; // 24

  // Counterbalance block order by seed: even gets calm then storm; odd gets storm then calm
  const stormFirst = (cfg.seed & 1) === 1;
  const blockKinds: BlockKind[] = stormFirst ? ["storm", "calm"] : ["calm", "storm"];

  const schedule: ScheduledTrial[] = [];
  let globalIndex = 0;

  for (let b = 0; b < BLOCKS; b++) {
    const kind = blockKinds[b] as BlockKind;

    const types: TrialType[] = [
      ...Array<TrialType>(nGoVisual).fill("go"),
      ...Array<TrialType>(nGoAudio).fill("go_audio"),
      ...Array<TrialType>(nNogo).fill("nogo"),
    ];

    // Fisher-Yates shuffle
    for (let k = types.length - 1; k > 0; k--) {
      const j = Math.floor(rnd() * (k + 1));
      const tmp = types[k] as TrialType;
      types[k] = types[j] as TrialType;
      types[j] = tmp;
    }

    for (let i = 0; i < trialsPerBlock; i++) {
      const tType = types[i] as TrialType;
      const isi = isiMin + rnd() * (isiMax - isiMin);

      let hasDistractor = false;
      let distractorType: DistractorType | undefined;

      if (kind === "storm") {
        const roll = rnd();
        if (roll < 0.65) {
          hasDistractor = true;
          const typeRoll = rnd();
          if (typeRoll < 0.45) distractorType = "bird";
          else if (typeRoll < 0.8) distractorType = "thunder";
          else distractorType = "both";
        }
      }

      schedule.push({
        i: globalIndex++,
        block: b,
        blockKind: kind,
        type: tType,
        treeLocation: Math.floor(rnd() * 8), // 8 natural spots on the trees
        isiMs: isi,
        stimulusMs,
        hasDistractor,
        distractorType,
      });
    }
  }

  return schedule;
}

export function buildPracticeSchedule(): ScheduledTrial[] {
  // Practice trials give generous stimulus duration (3600ms) so children can comfortably read instructions
  const PRACTICE_STIMULUS_MS = 3600;
  return [
    {
      i: 0,
      block: -1,
      blockKind: "calm",
      type: "go",
      treeLocation: 0, // Central branch
      isiMs: 1400,
      stimulusMs: PRACTICE_STIMULUS_MS,
      hasDistractor: false,
    },
    {
      i: 1,
      block: -1,
      blockKind: "calm",
      type: "go",
      treeLocation: 2, // Left tree
      isiMs: 1400,
      stimulusMs: PRACTICE_STIMULUS_MS,
      hasDistractor: false,
    },
    {
      i: 2,
      block: -1,
      blockKind: "calm",
      type: "nogo",
      treeLocation: 5, // Right tree
      isiMs: 1400,
      stimulusMs: PRACTICE_STIMULUS_MS,
      hasDistractor: false,
    },
    {
      i: 3,
      block: -1,
      blockKind: "calm",
      type: "go_audio",
      treeLocation: 1, // Central high branch
      isiMs: 1400,
      stimulusMs: PRACTICE_STIMULUS_MS,
      hasDistractor: false,
    },
  ];
}

export function classifyTrial(
  trial: ScheduledTrial,
  taps: Tap[],
  stimulusOnsetMs: number,
  stimulusMs: number = STIMULUS_MS,
  anticipationMs: number = ANTICIPATION_MS,
): { outcome: Outcome; rtMs: number | null; responded: boolean } {
  const windowEnd = stimulusOnsetMs + stimulusMs + 400;

  const targetTaps = taps.filter((t) => t.onTarget !== false);
  const validTaps = targetTaps.filter((t) => t.tMs >= stimulusOnsetMs - 200 && t.tMs <= windowEnd);

  if (trial.type === "nogo") {
    const tap = targetTaps.find((t) => t.tMs >= stimulusOnsetMs && t.tMs <= windowEnd);
    if (tap) {
      return {
        outcome: "commission",
        rtMs: tap.tMs - stimulusOnsetMs,
        responded: true,
      };
    }
    return {
      outcome: "correct_reject",
      rtMs: null,
      responded: false,
    };
  }

  // Go or Go-Audio
  if (validTaps.length === 0) {
    return {
      outcome: "omission",
      rtMs: null,
      responded: false,
    };
  }

  const firstTap = validTaps[0] as Tap;
  const rt = firstTap.tMs - stimulusOnsetMs;

  if (rt < anticipationMs) {
    return {
      outcome: "anticipation",
      rtMs: rt,
      responded: true,
    };
  }

  return {
    outcome: "hit",
    rtMs: rt,
    responded: true,
  };
}

export function mean(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

export function sampleSd(arr: number[]): number | null {
  if (arr.length < 2) return null;
  const m = mean(arr)!;
  const variance = arr.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

export function computeBlockSummary(trials: StormWatchTrialRecord[], blockKind: BlockKind): BlockSummary {
  const blockTrials = trials.filter((t) => t.blockKind === blockKind);
  const blockNum = blockTrials.length > 0 ? blockTrials[0]!.block : 0;
  const nTrials = blockTrials.length;

  const goTrials = blockTrials.filter((t) => t.type === "go");
  const goAudioTrials = blockTrials.filter((t) => t.type === "go_audio");
  const allGoTrials = blockTrials.filter((t) => t.type === "go" || t.type === "go_audio");
  const nogoTrials = blockTrials.filter((t) => t.type === "nogo");

  const hits = allGoTrials.filter((t) => t.outcome === "hit").length;
  const omissions = allGoTrials.filter((t) => t.outcome === "omission").length;
  const commissions = nogoTrials.filter((t) => t.outcome === "commission").length;
  const correctRejects = nogoTrials.filter((t) => t.outcome === "correct_reject").length;
  const anticipations = allGoTrials.filter((t) => t.outcome === "anticipation").length;

  const hitRts = allGoTrials
    .filter((t) => t.outcome === "hit" && t.rtMs !== null && t.rtMs >= ANTICIPATION_MS)
    .map((t) => t.rtMs!);

  const rtMean = mean(hitRts);
  const rtSd = sampleSd(hitRts);
  const rtCv = rtMean && rtSd && rtMean > 0 ? rtSd / rtMean : null;

  const omissionRate = allGoTrials.length > 0 ? omissions / allGoTrials.length : 0;
  const commissionRate = nogoTrials.length > 0 ? commissions / nogoTrials.length : 0;
  const anticipationRate = allGoTrials.length > 0 ? anticipations / allGoTrials.length : 0;

  return {
    block: blockNum,
    blockKind,
    nTrials,
    nGo: goTrials.length,
    nNogo: nogoTrials.length,
    nGoAudio: goAudioTrials.length,
    hits,
    omissions,
    omissionRate,
    commissions,
    commissionRate,
    correctRejects,
    anticipations,
    anticipationRate,
    rtMeanMs: rtMean,
    rtSdMs: rtSd,
    rtCv,
  };
}

/** Standard normal quantile function (inverse CDF) using rational approximation */
function normInv(p: number): number {
  if (p <= 0) return -3.5;
  if (p >= 1) return 3.5;
  if (p === 0.5) return 0;

  const isUpper = p > 0.5;
  const alpha = isUpper ? 1 - p : p;
  const t = Math.sqrt(-2 * Math.log(alpha));

  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;

  const num = c0 + c1 * t + c2 * t * t;
  const den = 1 + d1 * t + d2 * t * t + d3 * t * t * t;
  const xp = t - num / den;

  return isUpper ? xp : -xp;
}

export function computeDPrime(hitRate: number, falseAlarmRate: number): number {
  const h = Math.min(Math.max(hitRate, 0.01), 0.99);
  const fa = Math.min(Math.max(falseAlarmRate, 0.01), 0.99);
  return normInv(h) - normInv(fa);
}

export function summarise(trials: StormWatchTrialRecord[]): StormWatchSummary {
  const calm = computeBlockSummary(trials, "calm");
  const storm = computeBlockSummary(trials, "storm");

  const omissionRateDelta = storm.omissionRate - calm.omissionRate;
  const commissionRateDelta = storm.commissionRate - calm.commissionRate;
  const rtSdDeltaMs =
    storm.rtSdMs !== null && calm.rtSdMs !== null ? storm.rtSdMs - calm.rtSdMs : null;
  const rtMeanDeltaMs =
    storm.rtMeanMs !== null && calm.rtMeanMs !== null ? storm.rtMeanMs - calm.rtMeanMs : null;

  const distractorCost: DistractorCost = {
    omissionRateDelta,
    commissionRateDelta,
    rtSdDeltaMs,
    rtMeanDeltaMs,
  };

  const audioTrials = trials.filter((t) => t.type === "go_audio");
  const visualGoTrials = trials.filter((t) => t.type === "go");

  const audioHits = audioTrials.filter((t) => t.outcome === "hit").length;
  const audioOmissions = audioTrials.filter((t) => t.outcome === "omission").length;
  const audioRts = audioTrials
    .filter((t) => t.outcome === "hit" && t.rtMs !== null && t.rtMs >= ANTICIPATION_MS)
    .map((t) => t.rtMs!);

  const visualHits = visualGoTrials.filter((t) => t.outcome === "hit").length;
  const visualOmissions = visualGoTrials.filter((t) => t.outcome === "omission").length;
  const visualRts = visualGoTrials
    .filter((t) => t.outcome === "hit" && t.rtMs !== null && t.rtMs >= ANTICIPATION_MS)
    .map((t) => t.rtMs!);

  const audioPerformance = {
    nAudioTrials: audioTrials.length,
    audioHits,
    audioOmissions,
    audioOmissionRate: audioTrials.length > 0 ? audioOmissions / audioTrials.length : 0,
    audioRtMeanMs: mean(audioRts),
    nVisualGoTrials: visualGoTrials.length,
    visualHits,
    visualOmissions,
    visualOmissionRate: visualGoTrials.length > 0 ? visualOmissions / visualGoTrials.length : 0,
    visualRtMeanMs: mean(visualRts),
  };

  const allGo = trials.filter((t) => t.type === "go" || t.type === "go_audio");
  const allNogo = trials.filter((t) => t.type === "nogo");
  const allHits = allGo.filter((t) => t.outcome === "hit").length;
  const allOmissions = allGo.filter((t) => t.outcome === "omission").length;
  const allCommissions = allNogo.filter((t) => t.outcome === "commission").length;
  const allAnticipations = allGo.filter((t) => t.outcome === "anticipation").length;

  const allHitRts = allGo
    .filter((t) => t.outcome === "hit" && t.rtMs !== null && t.rtMs >= ANTICIPATION_MS)
    .map((t) => t.rtMs!);

  const overallRtMean = mean(allHitRts);
  const overallRtSd = sampleSd(allHitRts);
  const overallRtCv =
    overallRtMean && overallRtSd && overallRtMean > 0 ? overallRtSd / overallRtMean : null;

  const hitRate = allGo.length > 0 ? allHits / allGo.length : 0;
  const faRate = allNogo.length > 0 ? allCommissions / allNogo.length : 0;
  const dPrime = computeDPrime(hitRate, faRate);

  return {
    nTrials: trials.length,
    blockCalm: calm,
    blockStorm: storm,
    distractorCost,
    audioPerformance,
    overall: {
      omissionRate: allGo.length > 0 ? allOmissions / allGo.length : 0,
      commissionRate: allNogo.length > 0 ? allCommissions / allNogo.length : 0,
      anticipationRate: allGo.length > 0 ? allAnticipations / allGo.length : 0,
      rtMeanMs: overallRtMean,
      rtSdMs: overallRtSd,
      rtCv: overallRtCv,
      dPrime,
    },
  };
}
