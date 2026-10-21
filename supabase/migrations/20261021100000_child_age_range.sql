-- Intended purpose: children aged 6 to 12 (docs/02 section 2). The parent adds a child from the
-- browser, so the age range is enforced here as well as in the form and in validateNewChild.
-- With a birth year only, the accepted years are (current year - 12) to (current year - 6).
-- A trigger is used instead of a CHECK constraint because the bound depends on the current date.

create function public.enforce_child_age_range()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_year integer := extract(year from now())::integer;
begin
  if new.birth_year < v_year - 12 or new.birth_year > v_year - 6 then
    raise exception 'birth_year % is outside the 6 to 12 age range', new.birth_year
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger children_age_range
before insert or update of birth_year on public.children
for each row execute function public.enforce_child_age_range();
