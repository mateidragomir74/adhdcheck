// Storm Watch (FR-60): Go/No-Go task with distractors (birds, thunder) and cross-modal audio cues (owl hoot).
// All times are milliseconds on performance.now() timebase (session-relative in result).

export type TrialType = "go" | "nogo" | "go_audio";

export type Outcome = "hit" | "omission" | "correct_reject" | "commission" | "anticipation";

export type BlockKind = "calm" | "storm";

export type DistractorType = "bird" | "thunder" | "both";

export interface ScheduledTrial {
  i: number;
  block: number;
  blockKind: BlockKind;
  type: TrialType;
  treeLocation: number; // 0: left, 1: center, 2: right
  isiMs: number;
  stimulusMs: number;
  hasDistractor: boolean;
  distractorType?: DistractorType;
}

export interface ScheduleConfig {
  seed: number;
  trialsPerBlock?: number;
  stimulusMs?: number;
  isiMsMin?: number;
  isiMsMax?: number;
  goProbability?: number;
  audioCueFraction?: number;
}

export interface Tap {
  tMs: number;
  x: number;
  y: number;
  onTarget?: boolean;
}

export interface StormWatchTrialRecord {
  i: number;
  block: number;
  blockKind: BlockKind;
  type: TrialType;
  treeLocation: number;
  stimulusOnsetMs: number;
  responded: boolean;
  rtMs: number | null;
  outcome: Outcome;
  hasDistractor: boolean;
  distractorType?: DistractorType;
  taps: Tap[];
}

export interface BlockSummary {
  block: number;
  blockKind: BlockKind;
  nTrials: number;
  nGo: number;
  nNogo: number;
  nGoAudio: number;
  hits: number;
  omissions: number;
  omissionRate: number;
  commissions: number;
  commissionRate: number;
  correctRejects: number;
  anticipations: number;
  anticipationRate: number;
  rtMeanMs: number | null;
  rtSdMs: number | null;
  rtCv: number | null;
}

export interface DistractorCost {
  /** Block B omission rate minus Block A omission rate */
  omissionRateDelta: number;
  /** Block B commission rate minus Block A commission rate */
  commissionRateDelta: number;
  /** Block B RT SD minus Block A RT SD */
  rtSdDeltaMs: number | null;
  /** Block B mean RT minus Block A mean RT */
  rtMeanDeltaMs: number | null;
}

export interface AudioPerformance {
  nAudioTrials: number;
  audioHits: number;
  audioOmissions: number;
  audioOmissionRate: number;
  audioRtMeanMs: number | null;
  nVisualGoTrials: number;
  visualHits: number;
  visualOmissions: number;
  visualOmissionRate: number;
  visualRtMeanMs: number | null;
}

export interface StormWatchSummary {
  nTrials: number;
  blockCalm: BlockSummary;
  blockStorm: BlockSummary;
  distractorCost: DistractorCost;
  audioPerformance: AudioPerformance;
  overall: {
    omissionRate: number;
    commissionRate: number;
    anticipationRate: number;
    rtMeanMs: number | null;
    rtSdMs: number | null;
    rtCv: number | null;
    dPrime: number | null;
  };
}

/**
 * Local result interface shaped like PC-02 proposal (research/04 section 5).
 */
export interface StormWatchResult {
  id: "storm-watch";
  version: string;
  params: {
    blocks: number;
    trials_per_block: number;
    go_probability: number;
    stimulus_ms: number;
    isi_ms_min: number;
    isi_ms_max: number;
    distractor_block_order: number; // 0 if storm is first block, 1 if storm is second block
    audio_cue_fraction: number;
    seed: number;
    practice_trials: number;
  };
  trials: StormWatchTrialRecord[];
  summary: StormWatchSummary;
}
