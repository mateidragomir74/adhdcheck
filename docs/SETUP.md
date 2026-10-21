# Setup: clone, install, run

One web app (Next.js, App Router, TypeScript strict) holds the parent pages and the child game at `/play` (decision D-18). Shared code lives in `packages/`. The package manager is **npm workspaces** (see "Why npm").

## 1. Requirements

| Need | Version | Note |
|---|---|---|
| OS | Windows 10/11, macOS or Linux | Measured on Windows 11 with Git Bash |
| Node.js | 22.12 or newer, or 24 (LTS) | Vitest 5 needs Node 22.12+ or 24+; Next.js 16 needs 20.9 or newer, so Vitest sets the floor |
| npm | 10 or newer (ships with Node) | |
| Git | any recent | |
| Browser | a current Chrome, Edge, Safari or Firefox | Test on the demo tablet too |
| Supabase CLI | optional | Only Person 3, later. Not needed to run the app |

## 2. Install and run

```bash
git clone <repo-url> adhdcheck
cd adhdcheck
npm install          # one install at the root installs every workspace
npm run dev          # http://localhost:3000 (landing) and /play (game placeholder)
```

| Command (from the repo root) | What it does |
|---|---|
| `npm run dev` | Next.js dev server for `apps/web` |
| `npm run build` | Production build of `apps/web` |
| `npm test` | Vitest: all packages and the web API tests |
| `npm run typecheck` | `tsc --noEmit` in every workspace |
| `npm run lint` | ESLint for `apps/web` |
| `npm run check:secrets` | Scans STAGED changes for secrets; run before every commit |

Before a commit: `git status`, stage files by name (never `git add -A`), then `npm run check:secrets`. Read `.claude/skills/adhdcheck-dev/SKILL.md`.

## 3. Folder map and owners

```
apps/web/                 Next.js app
  app/_components, app/page.tsx, app/content.ts   landing (RO/EN)         Person 4
  app/play/                                       mounts the game        Person 1
  app/api/                                        route handlers         Person 3
packages/contracts/       zod schemas: SessionMetrics v1, ScoreResult v1   Person 2
packages/scoring/         pure TypeScript scoring (stub today)             Person 2
packages/sensors/         camera and microphone on the device (stub)       Person 2
packages/game/            Phaser game, mountGame(parent)                   Person 1
supabase/migrations/      SQL and row-level security                       Person 3
```

Workspace packages are consumed as TypeScript source (no build step). `apps/web/next.config.ts` lists them in `transpilePackages`; add any new package there.

## 4. Environment variables

Copy `.env.example` to `apps/web/.env.local` (gitignored) and fill the values there. Only names are committed. Never put the Supabase service-role key in browser code.

| Name | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase client (public) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase client (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | server only |
| `STRIPE_SECRET_KEY` | server only, Stripe test mode |
| `STRIPE_WEBHOOK_SECRET` | server only |
| `STRIPE_PRICE_ID` | server only: the test-mode **one-time** price of the detailed report, 9.99 EUR (D-05b), used by `POST /api/stripe/checkout` in `mode: "payment"`. A recurring price is refused by Stripe in that mode |
| `RESEND_API_KEY` | server only: sends the email with the link to the paid report (FR-51; the report itself is not attached). Optional: without it the purchase is still recorded and the parent downloads the report |
| `SITE_URL` | server only: the public address of the site without a trailing slash, for example `https://your-production-domain`. It is the only source of the Stripe success and cancel URLs and of the dashboard link in emails; the request origin is never used. Without it checkout answers 503 and parent emails with a link are skipped |
| `EMAIL_FROM` | server only: the sender of every email (FR-50 messages and the paid report), for example `ADHDCheck <reports@your-verified-domain>`. It must be on a domain verified in Resend: `onboarding@resend.dev` only delivers to the Resend account owner's own address (https://resend.com/docs/knowledge-base/403-error-resend-dev-domain). Optional: unset outside production the Resend test sender is used; unset in production no email is sent (this variable was called `REPORT_FROM_EMAIL`) |
| `DEMO_PARENT_EMAIL` | server only: the account that may use Reset demo (`POST /api/demo/reset`) |
| `GAME_HARNESS` | server only: set to `1` to serve the dev game pages under `/play` (bridge-wait, star-path, treasure-choice, route-planner, wake-fireflies, lantern-watch) in production; read at build, off by default |

The names follow the usual convention of each provider; confirm them against the provider quickstart when you wire the service.

## 4b. Stripe and Resend for the paid report (D-05b), for the owner to configure

Decision D-05b (Hatem, 2026-10-20): the detailed PDF report costs 9.99 EUR, paid once per report. The parent who paid gets an email with a link to the report behind login (R3-D1, DECIDED, Hatem, 2026-10-20: no attachment, no child data in the email); the PDF is downloaded on the parent page.

1. **Stripe product and price (test mode).** Create a product for the detailed report with a **one-time** price of 9.99 EUR. Put the price id (`price_...`) in `STRIPE_PRICE_ID`.
2. **Webhook endpoint.** In the Stripe Dashboard (test mode), Developers, Webhooks, add the endpoint `https://<production domain>/api/stripe/webhook` and select exactly these events:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed` (a delayed payment failed: the purchase is marked failed and a new checkout is allowed; [Stripe: fulfil orders](https://docs.stripe.com/checkout/fulfillment))
   - `checkout.session.expired` (the Checkout was not completed in time: the purchase is marked expired; [Stripe: event types](https://docs.stripe.com/api/events/types))

   Copy its signing secret into `STRIPE_WEBHOOK_SECRET`. The subscription events (`customer.subscription.*`) are no longer used and can be removed from an existing endpoint. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired` prints a test signing secret.
3. **Resend.** Verify the sending domain at https://resend.com/domains, then set `RESEND_API_KEY` and `EMAIL_FROM` (an address on that domain). With `onboarding@resend.dev` only the Resend account owner receives the email; Resend refuses other recipients with a 403, which the webhook logs as `email_rejected` without retrying.
4. **Site address.** Set `SITE_URL` to the production address (Vercel environment variable).
5. **Database.** Apply `supabase/migrations/20261021130000_report_purchases.sql`, then `supabase/migrations/20261021140000_drop_subscriptions.sql`, then `supabase/migrations/20261022090000_waitlist_new_row.sql`, then `supabase/migrations/20261022100000_purchase_not_paid_and_rate_limit_windows.sql` to the live project (`npx supabase db push`). Until the first one is applied, checkout and the report download answer 503.

What the webhook does: it verifies the signature on the raw body (400 otherwise), marks the purchase paid once (only when `payment_status` is `paid` and the Checkout's one line item is `STRIPE_PRICE_ID`, read with `listLineItems`; any other item is logged at error level as `webhook needs review` with the Checkout id and nothing is recorded, so check the Stripe Dashboard for those; a replayed or concurrent event changes nothing), emails a link to the report page (built from `SITE_URL`, so `SITE_URL` must be set for the email to go out; the webhook logs `site_url_not_configured` otherwise) to the address the parent signed up with (Supabase auth), and records `emailed_at`. The email has fixed text and the link only: no PDF, nickname, result or disclaimer. A visitor who is not logged in is sent to the login page and returned to the linked page after login. A `checkout.session.completed` still `unpaid` records the pending purchase from the metadata. The email carries a Resend idempotency key per Checkout Session, so two deliveries of one event send one email. A temporary email failure answers 500 so that Stripe retries; a missing email configuration or a permanent refusal answers 200 with a logged code (never the address).

## 5. Status of the stubs

- The **waitlist** (`POST /api/waitlist`) stores the address (lower case, once) and the page language in the server-only `waitlist` table. A confirmation email (Resend, FR-50) is sent after the answer, only for an address that was not on the list yet and within a daily cap on confirmation emails (placeholder value, TODO). The address is never logged (only language and time).
- `scoreSession` returns `insufficient_data` for every session until Person 2 writes the rules. No thresholds exist yet.
- The **demo seed** (`seed_demo`, used by Reset demo) writes synthetic scores in SQL, not scorer output, and its reason lines are placeholders until Person 4 supplies the text.
- `/play` draws a blank "Luma" canvas. No game logic.
- `SessionMetrics` makes `x` and `y` required on every trial, as in the spec, but an omission has no tap position. Person 1 and Person 2 must agree what to send (contracts change by team agreement only).

## 6. Versions (npm registry, 2026-10-19; `latest` tag)

| Item | Registry latest | Used here | Licence | Source |
|---|---|---|---|---|
| Node.js LTS | 24.22.0 (Krypton) | any 22.12+ or 24 | n/a | https://nodejs.org/dist/index.json |
| Next.js | 16.4.2 | 16.4.2 (pinned by the landing page) | MIT | `npm view next version` |
| React | 19.3.1 | 19.3.0 (pinned by the landing page) | MIT | npm registry |
| TypeScript | 7.0.2 | 5.x (`^5`, the landing page choice) | Apache-2.0 | npm registry |
| Phaser | 4.2.1 (dist-tag `latest`; GitHub marks v4.0.0 as a non-pre-release and 4.2.1 as Latest) | `^4.2.1` | MIT | https://github.com/phaserjs/phaser/releases |
| zod | 4.6.7 | `^4.6.7` | MIT | npm registry |
| Vitest | 5.0.5 | `^5.0.5` | MIT | npm registry |
| ESLint | 10.13.0 | 9.x (landing page choice) | MIT | npm registry |
| Supabase CLI | 2.121.0 | not installed by the repo | MIT | npm registry |
| @supabase/supabase-js | 2.118.0 | not added yet | MIT | npm registry |
| @mediapipe/tasks-vision | 1.1.1 | not added yet | Apache-2.0 | npm registry |
| @ricky0123/vad-web | 0.0.31 | not added yet | ISC | npm registry |
| stripe | 23.0.0 | `^22.6.2` | MIT | npm registry |
| resend | 6.34.1 | `^6.34.1` | MIT | npm registry |
| qrcode | 1.5.4 | not added yet | MIT | npm registry |
| pnpm | 12.14.0 | not used | MIT | npm registry |

Measured on the setup machine: Node 24.21.0, npm 11.19.0, pnpm 10.26.0, Supabase CLI 2.108.0, Git 2.54.0.

To add a package not yet present, run `npm install <name> --workspace <folder>` (for example `npm install stripe --workspace apps/web`, or `@mediapipe/tasks-vision` and `@ricky0123/vad-web` in `packages/sensors`; `qrcode` also needs `@types/qrcode`). Check the licence first; no GPL and no non-commercial code.

### Why npm

The landing page merged first (PR 1) with a `package-lock.json` and npm scripts, so the team keeps npm. npm workspaces give one root install with no extra tool. With workspaces there is a single lockfile at the root, so the landing page's own `apps/web/package-lock.json` was removed.

## 7. Known traps and fixes

- **Database migrations are applied by hand, never with `supabase db push`.** The live project records only three migration versions in its history although later ones were applied by hand, so a push would fail. Apply the file in the SQL editor (or `apply_migration`) before merging the code that needs it. Details: `supabase/migrations/README.md`. Pending: `20261022110000_minigames_and_link_grace.sql`.

| Trap | Fix |
|---|---|
| Phaser reads `window` when imported, so a normal import crashes server rendering ("window is not defined") | `packages/game` imports Phaser inside `mountGame`. `app/play/PlayClient.tsx` loads the canvas with `next/dynamic` and `ssr: false`, which is only allowed inside a Client Component. Never import `phaser` at the top of a file a Server Component can reach |
| Game created twice in dev (React Strict Mode runs effects twice) | `GameCanvas.tsx` destroys the game in the effect cleanup and handles a mount that finishes after cleanup |
| MediaPipe needs its WASM files; without a base path it fetches from the host root | Self-host: copy `node_modules/@mediapipe/tasks-vision/wasm` into `apps/web/public/mediapipe/` and call `FilesetResolver.forVisionTasks("/mediapipe")`. Model `.task` files are downloaded separately and also placed in `public/`. Source: https://developers.google.com/edge/api/mediapipe/js/tasks-vision.filesetresolver. Not yet verified in this app (Person 2 to test) |
| Windows with the Volta shim: a multi-line `node -e` runs only its first line | Put the code in a `.mjs` or `.cjs` file |
| Vercel Hobby preview URLs are behind login | Demo from the production alias (`research/03-tech-stack.md`, section 1) |
| `next dev` rewrites `apps/web/AGENTS.md` | Commit it with your work or leave it |
| `npm install` prints an `unrs-resolver` install-script notice and `npm audit` warnings | Notice only. Do not run `npm audit fix --force` (it can change pinned major versions) |
