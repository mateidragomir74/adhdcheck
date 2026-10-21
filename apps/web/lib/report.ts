import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { SCORE_DISCLAIMER } from "@adhdcheck/contracts";
import { BAND_TEXT, S } from "../app/parent/strings";
import type { SessionResult } from "./data/parent";
import { formatDate } from "./format";

// Parent report (D-05 and D-05b, DECIDED, Hatem, 2026-10-20; FR-48). The only paid feature: 9.99 EUR,
// one-off per report, downloadable by the parent who paid, who is emailed a link to it (R3-D1). It holds only
// what the result card already shows, with the same texts: nickname, session date, the fixed headline and
// its supporting line, the fixed disclaimer, the game measures as game measures, and the next step. No
// reason lines (placeholders), no probability, no severity, no diagnosis words (lib/report.test.ts).
//
// PDF library: pdf-lib (MIT), pure JavaScript. Its standard fonts ship as JavaScript, so the serverless
// bundle needs no font file on disk (pdfkit reads Helvetica.afm from disk, a known Next.js bundling
// failure, foliojs/pdfkit#1549). Standard fonts encode WinAnsi only: other characters are simplified.

export type ReportLine = { kind: "title" | "heading" | "text" | "small"; text: string };
export type ReportModel = { fileName: string; lines: ReportLine[] };

const RATE_KEYS = ["omission_rate", "commission_rate", "off_target_tap_rate"] as const;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function buildReport(result: SessionResult, nickname: string): ReportModel | null {
  const score = result.score;
  if (!score) return null;
  const band = BAND_TEXT[score.band];
  const lines: ReportLine[] = [
    { kind: "title", text: `${S.result.title}: ${nickname}` },
    { kind: "small", text: `${S.result.of} ${formatDate(result.started_at)}` },
    { kind: "heading", text: band.headline },
    { kind: "text", text: SCORE_DISCLAIMER },
  ];
  if (band.support) lines.push({ kind: "text", text: band.support });
  if (score.band !== "insufficient_data") {
    lines.push({ kind: "heading", text: S.result.indicators });
    for (const k of RATE_KEYS) lines.push({ kind: "text", text: `${S.indicator[k]}: ${pct(score.indicators[k])}` });
    lines.push({ kind: "text", text: `${S.indicator.rt_cv}: ${score.indicators.rt_cv.toFixed(2)}` });
    if (!score.validated) lines.push({ kind: "small", text: S.result.notValidated });
  }
  lines.push({ kind: "heading", text: S.result.nextStep }, { kind: "text", text: S.result.nextStepText });
  return { fileName: `report-${result.started_at.slice(0, 10)}.pdf`, lines };
}

// Keeps what the font can draw; a letter with a diacritic it cannot draw loses the mark (Ș -> S), and
// anything else becomes "?". A nickname can never make the download fail.
function drawable(font: PDFFont, text: string): string {
  let out = "";
  for (const ch of text) {
    for (const candidate of [ch, ch.normalize("NFD").replace(/\p{M}/gu, ""), "?"]) {
      try {
        if (candidate) font.encodeText(candidate);
        out += candidate;
        break;
      } catch {
        // try the next candidate
      }
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      out.push(line);
      line = word;
    } else line = next;
  }
  if (line) out.push(line);
  return out;
}

const STYLE = {
  title: { size: 20, bold: true, before: 0 },
  heading: { size: 14, bold: true, before: 18 },
  text: { size: 11, bold: false, before: 6 },
  small: { size: 9, bold: false, before: 4 },
} as const;

export async function renderReportPdf(model: ReportModel): Promise<Uint8Array> {
  // updateMetadata false: pdf-lib would stamp the current time as creation and modification date, so the
  // same report rendered twice would differ, and Resend refuses a retry of the same idempotency key whose
  // payload changed (409 invalid_idempotent_request).
  const doc = await PDFDocument.create({ updateMetadata: false });
  doc.setTitle(S.result.title);
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const [pageW, pageH] = [595.28, 841.89]; // A4 in points
  const margin = 56;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;
  const ink = rgb(0.12, 0.11, 0.23);

  for (const line of model.lines) {
    const style = STYLE[line.kind];
    const font = style.bold ? bold : regular;
    y -= style.before;
    for (const part of wrap(font, drawable(font, line.text), style.size, pageW - 2 * margin)) {
      const height = style.size * 1.35;
      if (y - height < margin) {
        page = doc.addPage([pageW, pageH]);
        y = pageH - margin;
      }
      y -= height;
      page.drawText(part, { x: margin, y, size: style.size, font, color: ink });
    }
  }
  return doc.save();
}
