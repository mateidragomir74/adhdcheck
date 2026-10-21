import { SCORE_DISCLAIMER } from "@adhdcheck/contracts";
import type { SessionResult } from "@/lib/data/parent";
import { BAND_TEXT, S } from "../strings";
import { ReportDownload } from "./ReportDownload";

// FR-33 result card: band in plain words, indicator bars, reasons, data quality, disclaimer (fixed text, shown under the headline), next step.
// Both outcomes get the same colours and weight (adhdcheck-dev skill, section 4): no alarm, no relief.
// The whole card and the next step are free for every parent (FR-35, FR-48, D-05). Only the report
// download below the card is paid, and its paywall appears only after the server refuses the download.

const RATE_KEYS = ["omission_rate", "commission_rate", "off_target_tap_rate"] as const;

// Notes meant for developers (the placeholder scorer in packages/scoring writes "stub: ...") are not shown
// to parents. Every other data-quality note is.
export function isParentNote(note: string) {
  return !/^stub:/i.test(note.trim());
}

// Relative import: the tests render this card, and Vitest has no "@/" alias.
import { formatDate } from "../../../lib/format";
export { formatDate };

function Bar({ label, value, shown }: { label: string; value: number; shown: string }) {
  const width = `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-semibold tabular-nums">{shown}</span>
      </div>
      <div className="mt-1 h-2.5 rounded-full bg-night/10" aria-hidden="true">
        <div className="h-full rounded-full bg-night-3" style={{ width }} />
      </div>
    </div>
  );
}

export function ResultCard({ result }: { result: SessionResult }) {
  const score = result.score;
  if (!score) return null;
  const text = BAND_TEXT[score.band];
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  return (
    <article className="overflow-hidden rounded-2xl bg-white shadow-[0_1px_0_rgb(31_27_58/0.06),0_8px_24px_rgb(31_27_58/0.06)]">
      <div className="bg-night px-5 py-6 text-moon sm:px-7">
        <p className="text-sm text-moon-muted">
          {S.result.of} {formatDate(result.started_at)}
        </p>
        <h3 className="mt-1 font-display text-2xl leading-tight font-semibold sm:text-3xl">{text.headline}</h3>
        <p className="mt-2 max-w-prose text-sm text-moon-muted">{SCORE_DISCLAIMER}</p>
        {text.support && <p className="mt-2 max-w-prose text-moon-muted">{text.support}</p>}
      </div>

      <div className="grid gap-6 px-5 py-6 sm:px-7 md:grid-cols-2">
        {score.reasons.length > 0 && (
          <div>
            <h4 className="font-display text-lg font-semibold">{S.result.why}</h4>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {score.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {score.band !== "insufficient_data" && (
          <div>
            <h4 className="font-display text-lg font-semibold">{S.result.indicators}</h4>
            <div className="mt-3 space-y-3">
              {RATE_KEYS.map((k) => (
                <Bar key={k} label={S.indicator[k]} value={score.indicators[k]} shown={pct(score.indicators[k])} />
              ))}
              <Bar label={S.indicator.rt_cv} value={score.indicators.rt_cv} shown={score.indicators.rt_cv.toFixed(2)} />
            </div>
            {!score.validated && <p className="mt-3 text-sm text-ink-muted">{S.result.notValidated}</p>}
          </div>
        )}
        <div>
          <h4 className="font-display text-lg font-semibold">{S.result.quality}</h4>
          <p className="mt-2">
            {score.data_quality.n_trials} {S.result.trials} · {pct(score.data_quality.pct_anticipations)} {S.result.anticipations}
          </p>
          {score.data_quality.notes.filter(isParentNote).map((n) => (
            <p key={n} className="mt-1 text-sm text-ink-muted">
              {n}
            </p>
          ))}
        </div>
        <div className="rounded-xl bg-cream-2 p-4">
          <h4 className="font-display text-lg font-semibold">{S.result.nextStep}</h4>
          <p className="mt-1">{S.result.nextStepText}</p>
        </div>
      </div>
      <div className="border-t border-ink/10 px-5 py-4 sm:px-7">
        <ReportDownload sessionId={result.session_id} band={score.band} />
      </div>
    </article>
  );
}
