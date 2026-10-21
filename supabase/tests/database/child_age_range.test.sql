-- Intended purpose: children aged 6 to 12 (docs/02 section 2). The database refuses a birth year
-- outside (current year - 12) to (current year - 6), even when the browser check is bypassed.
-- Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(5);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a6', 'age-parent@example.test');

select lives_ok(
  format($$ insert into public.children (parent_id, nickname, birth_year)
            values ('00000000-0000-0000-0000-0000000000a6', 'Age Ok Low', %s) $$, extract(year from now())::int - 12),
  'a child aged 12 (birth year = this year - 12) is accepted'
);
select lives_ok(
  format($$ insert into public.children (parent_id, nickname, birth_year)
            values ('00000000-0000-0000-0000-0000000000a6', 'Age Ok High', %s) $$, extract(year from now())::int - 6),
  'a child aged 6 (birth year = this year - 6) is accepted'
);
select throws_ok(
  format($$ insert into public.children (parent_id, nickname, birth_year)
            values ('00000000-0000-0000-0000-0000000000a6', 'Too Old', %s) $$, extract(year from now())::int - 13),
  '23514', null,
  'a birth year of this year - 13 is refused'
);
select throws_ok(
  format($$ insert into public.children (parent_id, nickname, birth_year)
            values ('00000000-0000-0000-0000-0000000000a6', 'Too Young', %s) $$, extract(year from now())::int - 5),
  '23514', null,
  'a birth year of this year - 5 is refused'
);
select throws_ok(
  format($$ update public.children set birth_year = %s where nickname = 'Age Ok Low' $$, extract(year from now())::int - 20),
  '23514', null,
  'changing a birth year to outside the range is refused'
);

select * from finish();
rollback;
