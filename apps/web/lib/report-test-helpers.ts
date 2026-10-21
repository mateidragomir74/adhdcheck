// Test helpers for the parent report (D-05). Synthetic data only.
import { inflateSync, constants } from "node:zlib";
import type { ScoreResult } from "@adhdcheck/contracts";
import { validScoreResult } from "../../../packages/contracts/src/fixtures/score-result.valid";
import type { SessionResult } from "./data/parent";

export const TEST_SESSION = "3f2b8c1e-5a4d-4e6f-9b7a-1c2d3e4f5a6b";
export const TEST_STARTED = "2026-10-12T16:30:00.000Z";

export function sessionResult(band: ScoreResult["band"], overrides: Partial<ScoreResult> = {}): SessionResult {
  return {
    session_id: TEST_SESSION,
    child_id: "00000000-0000-4000-8000-0000000000c1",
    started_at: TEST_STARTED,
    duration_ms: 300000,
    device: { pointer_type: "touch", user_agent: "synthetic-test-agent" },
    score: {
      ...(validScoreResult as ScoreResult),
      band,
      indicators: { ...validScoreResult.indicators, omission_rate: 0.06, commission_rate: 0.22, off_target_tap_rate: 0.12, rt_cv: 0.27 },
      // Placeholder reason lines are stored in the database but never copied into the report.
      reasons: ["TODO (Person 4): reason line for high_rt_variability"],
      ...overrides,
    },
  };
}

// Reads the text a viewer sees: inflates each content stream and decodes the hex strings pdf-lib draws
// with Tj. Wrapped lines are joined with a space, so a sentence split across lines reads whole again.
export function pdfText(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const raw = buf.toString("latin1");
  const parts: string[] = [];
  const marker = /stream\r?\n/g;
  let m: RegExpExecArray | null;
  while ((m = marker.exec(raw))) {
    const start = m.index + m[0].length;
    const end = raw.indexOf("endstream", start);
    if (end < 0) break;
    let content: string;
    try {
      content = inflateSync(buf.subarray(start, end), { finishFlush: constants.Z_SYNC_FLUSH }).toString("latin1");
    } catch {
      continue;
    }
    for (const t of content.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) parts.push(Buffer.from(t[1], "hex").toString("latin1"));
  }
  return parts.join(" ").replace(/\s+/g, " ");
}
