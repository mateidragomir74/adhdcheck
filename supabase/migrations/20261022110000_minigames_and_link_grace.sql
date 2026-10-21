-- PC-02 (docs/02 section 10.3, accepted by Hatem 2026-10-20) and the link lifetime for a longer session.
-- NOT APPLIED by the pull request that adds it: apply it by hand (SQL editor or apply_migration) after review and
-- BEFORE merging, never with `supabase db push` (see supabase/migrations/README.md).
--
-- 1. sessions.minigames: the optional `minigames` array of SessionMetrics (results of the mini-games played after
--    Lantern Watch). Nullable jsonb: a session without the field, and every row stored before this, keep null.
--    The trials and calibration columns are untouched, so the scorer input is unchanged.
-- 2. save_session now stores that block, and accepts a session that arrives up to a grace after the link expired
--    (the whole chain of mini-games takes longer than the first game did when the one hour lifetime was chosen).
--    Same signature as before, so grants stay; they are repeated below to be explicit.

alter table public.sessions add column minigames jsonb check (minigames is null or jsonb_typeof(minigames) = 'array');

create or replace function public.save_session(p_code_hash text, p_session jsonb, p_score jsonb)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session_id uuid := (p_session ->> 'session_id')::uuid;
  v_link public.play_links;
  v_inserted integer;
begin
  -- Lock the link so two posts with the same link cannot both use it.
  select * into v_link from public.play_links l where l.code_hash = p_code_hash for update;

  if not found or v_link.child_id <> (p_session ->> 'child_id')::uuid then
    return 'invalid_play_link';
  end if;
  if v_link.session_id is not null then
    return case when v_link.session_id = v_session_id then 'duplicate' else 'invalid_play_link' end;
  end if;
  -- The link must be valid when the session STARTS (resolve_play_link still refuses an expired link), but a
  -- session lasts about 13 to 15 minutes (research/04 section 5), so a link that expired during play may still
  -- save the session the child just finished. TODO (design choice, no source): the grace, twice the 15 minutes.
  if v_link.expires_at + interval '30 minutes' <= now() then
    return 'invalid_play_link';
  end if;

  insert into public.sessions (id, child_id, parent_id, started_at, duration_ms, task, device, calibration, off_target_taps, schema_version, minigames)
  values (
    v_session_id,
    v_link.child_id,
    v_link.parent_id,
    (p_session ->> 'started_at')::timestamptz,
    (p_session ->> 'duration_ms')::double precision,
    p_session -> 'task',
    p_session -> 'device',
    p_session -> 'calibration',
    p_session -> 'off_target_taps',
    p_session ->> 'schema_version',
    p_session -> 'minigames'
  )
  on conflict (id) do nothing;

  -- The session_id is already stored, saved with another link: this link cannot claim it.
  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return 'invalid_play_link';
  end if;

  update public.play_links set session_id = v_session_id where code_hash = p_code_hash;

  insert into public.trials (session_id, parent_id, i, block, type, stimulus_onset_ms, responded, rt_ms, outcome, x, y)
  select v_session_id, v_link.parent_id, t.i, t.block, t.type, t.stimulus_onset_ms, t.responded, t.rt_ms, t.outcome, t.x, t.y
  from jsonb_to_recordset(p_session -> 'trials') as t (
    i integer, block integer, type text, stimulus_onset_ms double precision, responded boolean,
    rt_ms double precision, outcome text, x double precision, y double precision
  );

  insert into public.scores (session_id, parent_id, scoring_method, validated, indicators, flags, band, data_quality, reasons, recommendations, disclaimer)
  values (
    v_session_id,
    v_link.parent_id,
    p_score ->> 'scoring_method',
    (p_score ->> 'validated')::boolean,
    p_score -> 'indicators',
    array(select jsonb_array_elements_text(p_score -> 'flags')),
    p_score ->> 'band',
    p_score -> 'data_quality',
    array(select jsonb_array_elements_text(p_score -> 'reasons')),
    array(select jsonb_array_elements_text(p_score -> 'recommendations')),
    p_score ->> 'disclaimer'
  );

  return 'created';
end;
$$;

revoke execute on function public.save_session(text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_session(text, jsonb, jsonb) to service_role; -- check-secrets: allow
