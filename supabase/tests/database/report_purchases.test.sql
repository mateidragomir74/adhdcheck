-- D-05b (DECIDED, Hatem, 2026-10-20): one-off payment per report. report_purchases is written only by the
-- server (service role: checkout start, Stripe webhook), read by the parent who paid (RLS). A replayed
-- webhook marks nothing twice and the emailed mark is set once.
-- Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(23);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent-a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'parent-b@example.test');

insert into public.children (id, parent_id, nickname, birth_year) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Synthetic A', 2018);

insert into public.sessions (id, child_id, parent_id, started_at, duration_ms, task, device, calibration, off_target_taps, schema_version) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
   '2026-10-12 16:30+00', 300000, '{}', '{}', '{}', '[]', '1.0'),
  ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
   '2026-10-13 16:30+00', 300000, '{}', '{}', '{}', '[]', '1.0');

select has_table('public', 'report_purchases', 'report_purchases exists');
select is((select relrowsecurity from pg_class where oid = 'public.report_purchases'::regclass), true, 'RLS is on');
select col_is_unique('public', 'report_purchases', 'stripe_checkout_session_id', 'one row per Stripe checkout session');

-- Only the server writes.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok($$ insert into public.report_purchases (parent_id, session_id, stripe_checkout_session_id, status, paid_at)
  values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_self', 'paid', now()) $$,
  '42501', null, 'a parent cannot insert a purchase (cannot mark itself as paid)');
select throws_ok($$ select public.start_report_purchase('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_x', 'en') $$,
  '42501', null, 'a parent cannot call start_report_purchase');
select throws_ok($$ select * from public.mark_report_paid('cs_x', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'en') $$,
  '42501', null, 'a parent cannot call mark_report_paid');
select throws_ok($$ select public.mark_report_emailed('cs_x') $$, '42501', null, 'a parent cannot call mark_report_emailed');
reset role;

set local role service_role; -- check-secrets: allow
select is(public.start_report_purchase('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'cs_b', 'en'),
  'unknown_session', 'a checkout for another parent''s session is refused in SQL too');
select is(public.start_report_purchase('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_a', 'ro'),
  'started', 'checkout start records a pending purchase');
select is(public.start_report_purchase('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_a', 'ro'),
  'started', 'starting the same checkout twice keeps one row');
select is((select count(*)::int from public.report_purchases where stripe_checkout_session_id = 'cs_a'), 1, 'one row for cs_a');

select results_eq($$ select outcome, emailed from public.mark_report_paid('cs_a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'ro') $$,
  $$ values ('paid'::text, false) $$, 'the first paid event marks the purchase paid, not yet emailed');
select results_eq($$ select outcome, emailed from public.mark_report_paid('cs_a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'ro') $$,
  $$ values ('already_paid'::text, false) $$, 'a replayed event changes nothing');
select is(public.mark_report_emailed('cs_a'), true, 'the email is marked sent once');
select is(public.mark_report_emailed('cs_a'), false, 'a second mark does nothing');
select results_eq($$ select outcome, emailed from public.mark_report_paid('cs_a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'ro') $$,
  $$ values ('already_paid'::text, true) $$, 'after the email, a replay reports emailed (no second email)');
select results_eq($$ select outcome from public.mark_report_paid('cs_a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000d1', 'en') $$,
  $$ values ('unknown_session'::text) $$, 'metadata naming a parent who does not own the session is refused');
select results_eq($$ select outcome from public.mark_report_paid('cs_a', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d2', 'en') $$,
  $$ values ('mismatch'::text) $$, 'metadata naming another session for a known checkout is refused');
select results_eq($$ select outcome, emailed from public.mark_report_paid('cs_new', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'en') $$,
  $$ values ('paid'::text, false) $$, 'a paid event with no pending row (checkout insert lost) still records the purchase');
select is((select paid_at is not null from public.report_purchases where stripe_checkout_session_id = 'cs_a'), true, 'paid_at is set');
reset role;

-- The parent who paid reads the purchase; another parent reads zero rows.
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select results_eq($$ select status from public.report_purchases where stripe_checkout_session_id = 'cs_a' $$, array['paid'], 'parent A reads its own purchase');
select throws_ok($$ update public.report_purchases set emailed_at = null $$, '42501', null, 'parent A cannot change a purchase');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';
select is_empty($$ select 1 from public.report_purchases $$, 'parent B reads zero rows');
reset role;

select * from finish();
rollback;
