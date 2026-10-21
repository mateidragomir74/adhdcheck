-- Waitlist from the landing page (FR-42): stored once per address, server only.
-- Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

set local role anon;
select throws_ok($$ select public.join_waitlist('parent@example.test', 'ro') $$, '42501', null, 'anon cannot call join_waitlist');
select throws_ok($$ select * from public.waitlist $$, '42501', null, 'anon cannot read the waitlist');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.waitlist $$, '42501', null, 'a parent cannot read the waitlist');
reset role;

set local role service_role; -- check-secrets: allow
select is(public.join_waitlist('parent@example.test', 'ro'), true, 'a new address is reported as added');
select is(public.join_waitlist('parent@example.test', 'en'), false, 'an address already listed is reported as not added');
select is(public.join_waitlist('Parent@Example.test', 'en'), false, 'the same address in another case is not added either');
reset role;
select results_eq($$ select count(*)::int from public.waitlist where email = 'parent@example.test' $$, array[1], 'an address is stored once');
select is((select lang from public.waitlist where email = 'parent@example.test'), 'ro', 'the first sign-up is kept');
select throws_ok(
  $$ insert into public.waitlist (email, lang) values ('x@example.test', 'de') $$,
  '23514', null, 'only ro and en are accepted'
);

select * from finish();
rollback;
