-- NFR-04: the parent's explicit consent to processing (GDPR Art. 9(2)(a), Art. 8), given before the first
-- session. One row per consent given, kept as a record: a parent can add rows and read their own, never
-- change or delete one (deleting the account removes them with it). The version names the consent text the
-- parent saw, so a new text (TODO, texts owner) can ask again. POST /api/play-links checks for a row of
-- the current version before it issues a link.

create table public.processing_consents (
  id bigint generated always as identity primary key,
  parent_id uuid not null default auth.uid() references public.parents (id) on delete cascade,
  version text not null check (char_length(btrim(version)) between 1 and 40),
  given_at timestamptz not null default now()
);

create index processing_consents_parent_version_idx on public.processing_consents (parent_id, version);

revoke all on public.processing_consents from anon, authenticated;
grant select on public.processing_consents to authenticated;
grant insert (version) on public.processing_consents to authenticated;
grant select on public.processing_consents to service_role; -- check-secrets: allow

alter table public.processing_consents enable row level security;

create policy "processing_consents_select_own" on public.processing_consents
  for select to authenticated using (parent_id = (select auth.uid()));
create policy "processing_consents_insert_own" on public.processing_consents
  for insert to authenticated with check (parent_id = (select auth.uid()));
