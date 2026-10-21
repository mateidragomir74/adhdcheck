-- FR-31, NFR-13: a parent writes children straight from the browser (RLS, parent_id filled by default), so the
-- database itself refuses an overlong nickname or an impossible birth year. Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'parent-bounds@example.test');

insert into public.children (id, parent_id, nickname, birth_year) values
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-0000000000b1', 'Test Fox', 2018);

set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000b1", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.children (nickname, birth_year)
     values (repeat('x', 40), 2018) $$,
  'a 40-character nickname is accepted'
);
select throws_ok(
  $$ insert into public.children (nickname, birth_year)
     values (repeat('x', 41), 2018) $$,
  '23514', null, 'a 41-character nickname is refused'
);
select throws_ok(
  $$ insert into public.children (nickname, birth_year)
     values ('Test Owl', 1899) $$,
  '23514', null, 'an impossible past birth year is refused'
);
select throws_ok(
  $$ insert into public.children (nickname, birth_year)
     values ('Test Owl', 2101) $$,
  '23514', null, 'an impossible future birth year is refused'
);
select throws_ok(
  $$ update public.children set nickname = repeat('y', 41)
     where id = '00000000-0000-0000-0000-0000000000cb' $$,
  '23514', null, 'an edit cannot make the nickname too long either'
);

select * from finish();
rollback;
