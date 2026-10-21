-- FR-31, NFR-13: bounds on the two child fields. Parents write children straight from the browser (RLS),
-- so these checks are the real guard; the form and lib/data/parent.ts apply the same nickname length and
-- the narrower 6 to 12 birth-year range. The birth-year check here is only a plausibility bound: a check
-- constraint cannot follow the current year.
-- Placeholder: the 40-character nickname limit is TODO, confirmed by the texts owner (docs/02 FR-31).
-- NOT VALID: existing rows are not rechecked, so applying this cannot fail on data already stored.

alter table public.children
  add constraint children_nickname_length check (char_length(btrim(nickname)) <= 40) not valid,
  add constraint children_birth_year_plausible check (birth_year between 2000 and 2100) not valid;
