-- Round 4 (R4-2 and a defect found while writing it).
--
-- 1. report_purchases.status gains 'failed' (a delayed payment failed, Stripe event
--    checkout.session.async_payment_failed) and 'expired' (checkout.session.expired). Such a row no longer blocks
--    a new checkout for the report. mark_report_not_paid moves a PENDING row only; a paid row never changes.
--
-- 2. take_rate_limit deleted every other bucket whose window, measured with the CALLER's window, had passed. A
--    60 second call therefore deleted the 24 hour waitlist confirmation cap (R3-E1) and the weekly email slot a
--    minute after they were set, so those limits did not hold. Each bucket now stores its own window and is
--    deleted only when its own window has passed.

alter table public.report_purchases drop constraint report_purchases_status_check;
alter table public.report_purchases
  add constraint report_purchases_status_check check (status in ('pending', 'paid', 'failed', 'expired'));

create function public.mark_report_not_paid(p_checkout_id text, p_status text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_status not in ('failed', 'expired') then
    raise exception 'mark_report_not_paid: status must be failed or expired';
  end if;
  update public.report_purchases p set status = p_status
  where p.stripe_checkout_session_id = p_checkout_id and p.status = 'pending';
  return found;
end;
$$;

revoke execute on function public.mark_report_not_paid(text, text) from public, anon, authenticated;
grant execute on function public.mark_report_not_paid(text, text) to service_role; -- check-secrets: allow

alter table public.rate_limits add column window_seconds integer not null default 60 check (window_seconds > 0);

create or replace function public.take_rate_limit(p_bucket text, p_limit integer, p_window_seconds integer)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hits integer;
begin
  insert into public.rate_limits as r (bucket, window_start, hits, window_seconds)
  values (p_bucket, now(), 1, p_window_seconds)
  on conflict (bucket) do update set
    window_start = case when r.window_start <= now() - make_interval(secs => r.window_seconds) then now() else r.window_start end,
    hits = case when r.window_start <= now() - make_interval(secs => r.window_seconds) then 1 else r.hits + 1 end,
    window_seconds = p_window_seconds
  returning r.hits into v_hits;

  delete from public.rate_limits
  where bucket in (
    select o.bucket from public.rate_limits o
    where o.window_start <= now() - make_interval(secs => o.window_seconds) and o.bucket <> p_bucket
    for update skip locked
  );

  return v_hits <= p_limit;
end;
$$;
