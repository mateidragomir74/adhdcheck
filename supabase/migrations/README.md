# supabase/migrations

Owner: Person 3 (backend). The database schema, row-level security and SQL functions, as numbered SQL files applied in order. The cloud project `adhdcheck` is in Frankfurt (eu-central-1), chosen at creation and fixed for good (NFR-03).

| Migration | What it adds |
| --- | --- |
| `20261019211806_init_schema_rls` | parents, children, sessions, trials, scores; RLS on every table; cascade delete (FR-41) |
| `20261019214149_save_session` | `save_session`: a session, its trials and its score in one transaction (FR-11, FR-12) |
| `20261020120000_play_links_rate_limit` | Single-use play links stored as a hash, rate limit (FR-01, NFR-13) |
| `20261020180000_seed_demo` | `seed_demo`: Demo Fox with 12 synthetic sessions over 4 weeks (FR-55, FR-56) |
| `20261020200000_missions` | Missions the parent chooses (FR-37) |
| `20261020210000_realtime_scores` | Live result to the parent screen (FR-39) |
| `20261020220000_waitlist` | Landing page waitlist, server only (FR-42) |
| `20261020230000_subscriptions` | Stripe subscription status per parent (FR-45 to FR-47) |
| `20261021090000_play_link_consent` | Camera and microphone choices carried by the play link, off by default (FR-70) |
| `20261021100000_child_age_range` | Birth years limited to ages 6 to 12 |
| `20261021110000_processing_consent` | The parent's consent to processing, per text version (NFR-04) |
| `20261021120000_child_bounds` | Nickname length and plausible birth year (FR-31, NFR-13) |

## Rules

- New migration: `npx supabase@latest migration new <name>`. Every migration has its own version number (a test in `apps/web/lib/migrations.test.ts` checks it).
- Every new table gets RLS and a pgTAP test in `supabase/tests/database/` proving one parent cannot read another parent's rows. Policies compare with `(select auth.uid())` and apply to `authenticated` only (checked by `rls.test.sql`).
- Writes of sessions, trials and scores go through the server (service role). Server-only SQL functions are `security invoker`, use an empty `search_path`, and are executable by `service_role` only.
- No key or connection string in any file here.
- Local: `npx supabase@latest start`, then `npx supabase@latest test db`; `npx supabase@latest db reset --local` reapplies everything.
- Cloud: `npx supabase@latest db push` applies new migrations to the live project. Agree it with the team first, and push before deploying code that needs the new migration.
