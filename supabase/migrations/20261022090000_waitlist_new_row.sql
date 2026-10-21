-- Waitlist (R3-E1): join_waitlist now says whether the address was added now (true) or was already on the
-- list (false), so the confirmation email goes only to a new address. The function is replaced, because a
-- return type cannot change in place. The grants are repeated on the new function. It still answers nothing
-- to anon or authenticated; the route returns the same public answer in both cases.

drop function public.join_waitlist(text, text);

create function public.join_waitlist(p_email text, p_lang text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.waitlist (email, lang) values (lower(p_email), p_lang) on conflict (email) do nothing;
  return found;
end;
$$;

revoke execute on function public.join_waitlist(text, text) from public, anon, authenticated;
grant execute on function public.join_waitlist(text, text) to service_role; -- check-secrets: allow
