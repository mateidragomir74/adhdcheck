# adhdcheck

ADHD Check helps parents of children aged 6 to 12 decide whether to seek a professional assessment of their child's attention, from a short game the child plays on a tablet, and points them to the right professional. It is a hackathon project (BEHEALTH, Bucharest, team of 4, started 2026-10-19).

It is an orientation tool, not a diagnosis: it never shows an ADHD probability or a severity, and it has not been clinically validated. The parent sees one of two fixed sentences, "A professional assessment is recommended" or "No specific follow-up indicated by this activity", always with the next step to a professional. Intended purpose (DRAFT) and the regulatory reading (expected class IIa under MDR Rule 11): [docs/02](docs/02-specification-cahier-des-charges.md), section 2.

## How it works

1. The parent signs up and adds a child: nickname and birth year only, ages 6 to 12.
2. The parent consents once to the processing of the game data, and chooses camera and microphone (both off by default).
3. The parent starts a game: the app shows a QR code with a single-use play link (valid 1 hour).
4. The child scans it and plays in the tablet browser: no account, no score, no failure screen, no timer.
5. The game uploads its measures (never images or sound); the server validates them against the contract and scores them.
6. The result appears on the parent's screen without a refresh: the headline, what the game measured, and the next step.
7. Afterwards the parent follows progress over time, picks wellbeing missions (never chosen from the score), and can download the parent report, the one paid item.

## Status (2026-10-20)

| Area | State |
| --- | --- |
| Parent app: sign-up, login, children, consent, QR, live result card, progress chart, missions, delete child | Done |
| Backend: Supabase with row-level security on every table, session upload, play links, rate limits, demo seed and Reset demo | Done |
| Landing page (Romanian and English) | Done |
| Parent report PDF, the only paid item (decision D-05), Stripe in test mode | Done; price not decided (D-05b) |
| Mini-games: Wake the fireflies (calibration), Star Path, Bridge Wait, Treasure Choice, Route Planner | Done |
| Lantern Watch, the scored go/no-go game, wired to the QR link | In review (PR #34) |
| Emails through Resend (waitlist, new mission, weekly summary), link only | In review (PR #33) |
| Scoring rules and thresholds (D-04) | Not built: `packages/scoring` is a placeholder that returns "Not enough data" |
| Storm Watch, camera and microphone measures, parent questionnaire | Not built |
| Production deployment | Not deployed yet |

All visible texts outside the decided headlines are placeholders until the texts owner replaces them.

## Repository layout

| Path | What it holds |
| --- | --- |
| `apps/web/app/` | The Next.js app: landing page, `/login`, `/parent` pages, `/play/<code>` for the child |
| `apps/web/app/api/` | Route handlers: auth, children, play links, sessions, demo, reports, Stripe, waitlist |
| `packages/contracts` | `SessionMetrics` v1 and `ScoreResult` v1 as strict zod schemas, the fixed disclaimer, fixtures |
| `packages/scoring` | The scorer (placeholder until the rules exist) |
| `packages/game` | The mini-games (three.js and Phaser) and the session recorder |
| `packages/sensors` | Camera and microphone features (not built yet) |
| `supabase/migrations`, `supabase/tests/database` | Database schema, row-level security and SQL functions; pgTAP tests |
| `scripts/` | `demo-rehearsal.mts` (the showcase flow over HTTP), `check-secrets.mjs` |
| `docs/`, `research/` | Requirements, plan, work split, and the sourced research |

## Run it

Follow [docs/SETUP.md](docs/SETUP.md) for the full guide. In short (Node 22.12 or later):

```bash
npm ci
cp .env.example apps/web/.env.local   # then fill the values; never commit them
npm run dev                           # http://localhost:3000
```

Checks before every pull request:

```bash
npm test               # unit tests (vitest)
npm run typecheck
npm run lint
npm run build
npm run check:secrets  # on staged changes, before every commit
```

Database tests need Docker and the Supabase CLI: `npx supabase@latest start`, then `npx supabase@latest test db`.

## Demo

The demo account is the address in `DEMO_PARENT_EMAIL`. On `/parent` it shows **Reset demo**, which restores Demo Fox with 12 synthetic sessions over 4 weeks, missions and progress. `node scripts/demo-rehearsal.mts --base <url>` runs the whole flow over HTTP (log in, reset, play link, upload, live result) and reports each step. Demo data are synthetic.

## Read next

1. [docs/01-user-needs.md](docs/01-user-needs.md): who the users are and what they need, with sources.
2. [docs/02-specification-cahier-des-charges.md](docs/02-specification-cahier-des-charges.md): intended purpose, requirements with acceptance criteria, contracts, data model, decisions.
3. [docs/03-progress-plan.md](docs/03-progress-plan.md): roles, milestones, tracker, demo checklist.
4. [docs/04-work-split.md](docs/04-work-split.md): who does what.
5. [research/01](research/01-literature-unmet-need.md) evidence and unmet need, [research/02](research/02-competitors-and-regulatory.md) competitors and regulation, [research/03](research/03-tech-stack.md) stack, [research/04](research/04-game-design-symptom-mapping.md) game design, [research/05](research/05-healthcare-business-model-canvas.md) business model canvas, [research/06](research/06-camera-microphone-acquisition.md) camera and microphone.
6. [TODO.md](TODO.md): open research and team decisions.

## Rules for everyone

- This repository is public: no secrets (`.env.example` holds names only), no real personal data, no camera or microphone output.
- Every figure in the pitch comes from the research files, with its source.
- No text says or suggests a diagnosis, a probability or a severity, and nothing claims to treat ADHD.
