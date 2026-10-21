-- Report purchases (D-05b, DECIDED, Hatem, 2026-10-20): the detailed PDF report costs 9.99 EUR, paid once
-- per report through Stripe Checkout in mode "payment". One row per Stripe Checkout Session. Written only
-- by the server through the service role (checkout start, Stripe webhook; NFR-12); the parent who paid
-- reads their own rows (RLS). The result card, next step and data deletion never depend on it (FR-48).
-- Deleting the child or the session deletes its purchases (on delete cascade).

create table public.report_purchases (
  id bigint generated always as identity primary key,
  parent_id uuid not null references public.parents (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  stripe_checkout_session_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  -- language of the email (RO or EN), taken from the browser at checkout
  lang text not null default 'en' check (lang in ('ro', 'en')),
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  emailed_at timestamptz,
  constraint report_purchases_paid_at check ((status = 'paid') = (paid_at is not null)),
  constraint report_purchases_emailed_after_paid check (emailed_at is null or paid_at is not null)
);

create index report_purchases_parent_session on public.report_purchases (parent_id, session_id);
create index report_purchases_session on public.report_purchases (session_id);

revoke all on public.report_purchases from anon, authenticated;
grant select on public.report_purchases to authenticated;
grant select, insert, update, delete on public.report_purchases to service_role; -- check-secrets: allow

alter table public.report_purchases enable row level security;

create policy "report_purchases_select_own" on public.report_purchases
  for select to authenticated using (parent_id = (select auth.uid()));

-- Checkout start: records a pending purchase, only for a session of that parent. Returns 'started' or
-- 'unknown_session'. Starting the same checkout session twice keeps one row.
create function public.start_report_purchase(p_parent_id uuid, p_session_id uuid, p_checkout_id text, p_lang text)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.parent_id = p_parent_id) then
    return 'unknown_session';
  end if;
  insert into public.report_purchases (parent_id, session_id, stripe_checkout_session_id, lang)
  values (p_parent_id, p_session_id, p_checkout_id, p_lang)
  on conflict (stripe_checkout_session_id) do nothing;
  return 'started';
end;
$$;

-- Webhook write (checkout.session.completed with payment_status paid, or async_payment_succeeded). Stripe can
-- deliver the same event more than once and concurrently, so the row is locked and marked paid once.
-- outcome: 'paid' (first time), 'already_paid' (a replay), 'unknown_session' (not that parent's session, or
-- deleted), 'mismatch' (the checkout id is known for another parent or session). emailed: the report email
-- was already sent, so the caller must not send it again.
create function public.mark_report_paid(p_checkout_id text, p_parent_id uuid, p_session_id uuid, p_lang text)
returns table (outcome text, emailed boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  r public.report_purchases%rowtype;
begin
  if not exists (select 1 from public.sessions s where s.id = p_session_id and s.parent_id = p_parent_id) then
    return query select 'unknown_session'::text, false;
    return;
  end if;

  insert into public.report_purchases (parent_id, session_id, stripe_checkout_session_id, lang)
  values (p_parent_id, p_session_id, p_checkout_id, p_lang)
  on conflict (stripe_checkout_session_id) do nothing;

  select * into r from public.report_purchases p where p.stripe_checkout_session_id = p_checkout_id for update;

  if r.parent_id <> p_parent_id or r.session_id <> p_session_id then
    return query select 'mismatch'::text, false;
    return;
  end if;

  if r.status = 'paid' then
    return query select 'already_paid'::text, r.emailed_at is not null;
    return;
  end if;

  update public.report_purchases p set status = 'paid', paid_at = now() where p.id = r.id;
  return query select 'paid'::text, false;
end;
$$;

-- After the email is accepted by the provider. True the first time, false afterwards.
create function public.mark_report_emailed(p_checkout_id text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.report_purchases p set emailed_at = now()
  where p.stripe_checkout_session_id = p_checkout_id and p.status = 'paid' and p.emailed_at is null;
  return found;
end;
$$;

revoke execute on function public.start_report_purchase(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.mark_report_paid(text, uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.mark_report_emailed(text) from public, anon, authenticated;
grant execute on function public.start_report_purchase(uuid, uuid, text, text) to service_role; -- check-secrets: allow
grant execute on function public.mark_report_paid(text, uuid, uuid, text) to service_role; -- check-secrets: allow
grant execute on function public.mark_report_emailed(text) to service_role; -- check-secrets: allow
