-- Round 4: a failed delayed payment or an expired Checkout stops blocking a new checkout (R4-2), and a long
-- rate-limit window survives calls with a short one (take_rate_limit keeps each bucket's own window).
-- Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000000a', 'parent-a@example.test');
insert into public.children (id, parent_id, nickname, birth_year) values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a', 'Synthetic A', 2018);
insert into public.sessions (id, child_id, parent_id, started_at, duration_ms, task, device, calibration, off_target_taps, schema_version) values
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000a',
   '2026-10-12 16:30+00', 300000, '{}', '{}', '{}', '[]', '1.0');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok($$ select public.mark_report_not_paid('cs_x', 'failed') $$, '42501', null, 'a parent cannot call mark_report_not_paid');
reset role;

set local role service_role; -- check-secrets: allow
select public.start_report_purchase('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_a', 'en');
select public.start_report_purchase('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'cs_b', 'en');
select is(public.mark_report_not_paid('cs_a', 'failed'), true, 'a pending purchase is marked failed');
select is(public.mark_report_not_paid('cs_a', 'expired'), false, 'a purchase that is no longer pending is not changed again');
select * from public.mark_report_paid('cs_b', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000d1', 'en');
select is(public.mark_report_not_paid('cs_b', 'expired'), false, 'a paid purchase is never marked failed or expired');
select throws_ok($$ select public.mark_report_not_paid('cs_a', 'paid') $$, 'P0001', null, 'only failed and expired are accepted');
reset role;
select is((select status from public.report_purchases where stripe_checkout_session_id = 'cs_a'), 'failed', 'cs_a is failed');
select is((select status from public.report_purchases where stripe_checkout_session_id = 'cs_b'), 'paid', 'cs_b is still paid');

set local role service_role; -- check-secrets: allow
select is(public.take_rate_limit('cap-test', 2, 86400), true, 'a daily bucket takes its first hit');
update public.rate_limits set window_start = now() - interval '2 hours' where bucket = 'cap-test';
select public.take_rate_limit('short-test', 3, 60);
reset role;
select is((select count(*)::int from public.rate_limits where bucket = 'cap-test'), 1, 'a 60 second call does not delete a 24 hour bucket');
update public.rate_limits set window_start = now() - interval '25 hours' where bucket = 'cap-test';
set local role service_role; -- check-secrets: allow
select public.take_rate_limit('other-test', 3, 60);
reset role;
select is((select count(*)::int from public.rate_limits where bucket = 'cap-test'), 0, 'a bucket is deleted once its own window has passed');

select * from finish();
rollback;
