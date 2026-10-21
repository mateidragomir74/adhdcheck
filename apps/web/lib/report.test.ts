import { describe, expect, it, vi } from "vitest";
import { SCORE_DISCLAIMER, type ScoreResult } from "@adhdcheck/contracts";
import { BAND_TEXT, S } from "../app/parent/strings";
import { formatDate } from "../app/parent/_components/ResultCard";
import { buildReport, renderReportPdf } from "./report";
import { TEST_STARTED as STARTED, pdfText, sessionResult } from "./report-test-helpers";

// D-05 / FR-48: the downloadable parent report. It holds only what the result card already shows.

// Banned wording from the adhdcheck-dev skill, section 5, plus "severity" and "percent chance".
const BANNED = /diagnos|likely|probabilit|risk score|severe|severity|moderate|mild|treat|cure|clinically (proven|validated)|percent chance/i;

async function textOf(band: ScoreResult["band"], nickname = "Demo Fox") {
  const model = buildReport(sessionResult(band), nickname);
  expect(model).not.toBeNull();
  return pdfText(await renderReportPdf(model!));
}

function buildReportEmailModel() {
  const model = buildReport(sessionResult("no_flag"), "Demo Fox");
  expect(model).not.toBeNull();
  return model!;
}

describe("parent report PDF (D-05, FR-48)", () => {
  it("is a PDF holding the nickname, the session date, the fixed headline, the fixed disclaimer and the next step", async () => {
    const model = buildReport(sessionResult("follow_up_suggested"), "Demo Fox");
    const bytes = await renderReportPdf(model!);
    expect(Buffer.from(bytes.subarray(0, 5)).toString("latin1")).toBe("%PDF-");
    const text = pdfText(bytes);
    expect(text).toContain("Demo Fox");
    expect(text).toContain(formatDate(STARTED));
    expect(text).toContain(BAND_TEXT.follow_up_suggested.headline);
    expect(text).toContain(SCORE_DISCLAIMER);
    expect(text).toContain(S.result.nextStep);
    expect(text).toContain(S.result.nextStepText);
  });

  it("R3-P3 renders byte-identical PDFs for the same session at different times (the email idempotency payload must not change)", async () => {
    const model = buildReportEmailModel();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-10-20T10:00:00Z"));
      const first = await renderReportPdf(model);
      vi.setSystemTime(new Date("2026-10-21T11:22:33Z"));
      const second = await renderReportPdf(model);
      expect(Buffer.from(second).equals(Buffer.from(first))).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows the game measures as game measures, as on the result card", async () => {
    const text = await textOf("follow_up_suggested");
    expect(text).toContain(S.result.indicators);
    expect(text).toContain(`${S.indicator.omission_rate}: 6%`);
    expect(text).toContain(`${S.indicator.commission_rate}: 22%`);
    expect(text).toContain(`${S.indicator.off_target_tap_rate}: 12%`);
    expect(text).toContain(`${S.indicator.rt_cv}: 0.27`);
    expect(text).toContain(S.result.notValidated);
  });

  it("carries the headline of its own band only", async () => {
    const text = await textOf("no_flag");
    expect(text).toContain(BAND_TEXT.no_flag.headline);
    expect(text).toContain(BAND_TEXT.no_flag.support);
    expect(text).not.toContain(BAND_TEXT.follow_up_suggested.headline);
  });

  it("has no measures section when the session gave too little data, as on the card", async () => {
    const text = await textOf("insufficient_data");
    expect(text).toContain(BAND_TEXT.insufficient_data.headline);
    expect(text).not.toContain(S.result.indicators);
  });

  it.each(["follow_up_suggested", "no_flag", "insufficient_data"] as const)(
    "contains no banned wording outside the fixed disclaimer (%s)",
    async (band) => {
      const text = await textOf(band);
      expect(text).toContain(SCORE_DISCLAIMER);
      expect(text.replace(SCORE_DISCLAIMER, "")).not.toMatch(BANNED);
      expect(text).not.toMatch(/TODO|ADHD|%\s*chance/i);
    },
  );

  it("the banned-word check can fail: it flags the disclaimer itself", () => {
    expect(SCORE_DISCLAIMER).toMatch(BANNED);
  });

  it("renders a nickname outside the PDF standard font without failing", async () => {
    const text = await textOf("no_flag", "Ștefan 🦊");
    expect(text).toContain("Stefan");
  });

  it("has no report for a session that is not scored yet", () => {
    expect(buildReport({ ...sessionResult("no_flag"), score: null }, "Demo Fox")).toBeNull();
  });

  it("names the file by the session date, never by the nickname", () => {
    expect(buildReport(sessionResult("no_flag"), "Demo Fox")!.fileName).toBe("report-2026-10-12.pdf");
  });
});
