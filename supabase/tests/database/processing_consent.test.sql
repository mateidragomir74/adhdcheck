-- NFR-04: the parent's consent to processing, given before the first session, is kept per text version as an
-- append-only record that only its parent can read. Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'parent-consent-a@example.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'parent-consent-b@example.test');

select has_table('public', 'processing_consents', 'consents are recorded in their own table');

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d1", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.processing_consents (version) values ('test-1') $$,
  'a parent records consent to a text version'
);
select results_eq(
  $$ select parent_id, version from public.processing_consents $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid, 'test-1') $$,
  'the record belongs to the caller and names the version'
);
select isnt_empty(
  $$ select 1 from public.processing_consents where given_at is not null $$,
  'the record carries the time it was given'
);
select throws_ok(
  $$ insert into public.processing_consents (parent_id, version) values ('00000000-0000-0000-0000-0000000000d2', 'test-1') $$,
  '42501', null, 'a parent cannot record consent for another parent'
);
select throws_ok(
  $$ update public.processing_consents set version = 'test-2' $$,
  '42501', null, 'a record cannot be changed'
);
select throws_ok(
  $$ insert into public.processing_consents (version) values ('  ') $$,
  '23514', null, 'a blank version is refused'
);

set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated"}';
select is_empty($$ select 1 from public.processing_consents $$, 'parent B reads none of parent A''s consents');
reset role;

set local role anon;
select throws_ok($$ select 1 from public.processing_consents $$, '42501', null, 'a visitor cannot read consents');
reset role;

select * from finish();
rollback;
