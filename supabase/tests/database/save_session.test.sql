-- FR-11: save_session writes session, trials and score in one transaction.
-- FR-01: only with a play link that exists, has not expired (or expired during the session, within the grace), is for
-- this child and is not used up.
-- PC-02: the optional minigames block is stored in sessions.minigames.
-- FR-12: the same session_id is stored once.
-- NFR-12: only the service role may call it.
-- Run with: npx supabase@latest test db
begin;
create extension if not exists pgtap with schema extensions;

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'parent-a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'parent-b@example.test');
insert into public.children (id, parent_id, nickname, birth_year) values
  ('00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', 'Test Fox', 2018),
  ('00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-00000000000b', 'Test Owl', 2017);

-- Synthetic play links (hashes of 64 hex characters), inserted directly.
insert into public.play_links (code_hash, child_id, parent_id, expires_at) values
  (repeat('1', 64), '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', now() + interval '1 hour'),
  (repeat('2', 64), '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', now() - interval '2 hours'),
  (repeat('3', 64), '00000000-0000-0000-0000-0000000000cb', '00000000-0000-0000-0000-00000000000b', now() + interval '1 hour'),
  (repeat('4', 64), '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', now() + interval '1 hour'),
  (repeat('5', 64), '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', now() + interval '1 hour'),
  -- expired one second ago: a session that was playing when the link ran out may still be saved (grace)
  (repeat('6', 64), '00000000-0000-0000-0000-0000000000ca', '00000000-0000-0000-0000-00000000000a', now() - interval '1 second');

-- Synthetic payloads shaped like SessionMetrics v1 and ScoreResult v1.
create temp table payload as select
  jsonb_build_object(
    'schema_version', '1.0',
    'session_id', '00000000-0000-0000-0000-00000000005a',
    'child_id', '00000000-0000-0000-0000-0000000000ca',
    'started_at', '2026-10-20T10:00:00Z',
    'duration_ms', 1000,
    'task', jsonb_build_object('type', 'go_nogo'),
    'device', jsonb_build_object('pointer_type', 'touch'),
    'trials', jsonb_build_array(
      jsonb_build_object('i', 0, 'block', 0, 'type', 'go', 'stimulus_onset_ms', 100, 'responded', true,
                         'rt_ms', 350, 'outcome', 'hit', 'x', 10, 'y', 20),
      jsonb_build_object('i', 1, 'block', 0, 'type', 'nogo', 'stimulus_onset_ms', 1600, 'responded', false,
                         'rt_ms', null, 'outcome', 'correct_reject', 'x', 0, 'y', 0)),
    'off_target_taps', jsonb_build_array(jsonb_build_object('t_ms', 800, 'during', 'isi')),
    'calibration', jsonb_build_object('median_rt_ms', 340, 'n', 10)
  ) as session,
  jsonb_build_object(
    'schema_version', '1.0',
    'session_id', '00000000-0000-0000-0000-00000000005a',
    'scoring_method', 'rules_v0',
    'validated', false,
    'indicators', jsonb_build_object('omission_rate', 0),
    'flags', jsonb_build_array(),
    'band', 'insufficient_data',
    'data_quality', jsonb_build_object('n_trials', 2),
    'reasons', jsonb_build_array(),
    'recommendations', jsonb_build_array(),
    'disclaimer', 'test disclaimer'
  ) as score;
grant select on payload to anon, authenticated, service_role; -- check-secrets: allow

-- Only the service role can call it.
set local role anon;
select throws_ok($$ select public.save_session(repeat('1', 64), session, score) from payload $$, '42501', null, 'anon cannot call save_session');
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';
select throws_ok($$ select public.save_session(repeat('1', 64), session, score) from payload $$, '42501', null, 'a parent cannot call save_session');
reset role;

set local role service_role; -- check-secrets: allow
select is((select public.save_session(repeat('9', 64), session, score) from payload), 'invalid_play_link', 'an unknown link is refused');
select is((select public.save_session(repeat('2', 64), session, score) from payload), 'invalid_play_link', 'a link expired beyond the grace is refused');
select is((select public.save_session(repeat('3', 64), session, score) from payload), 'invalid_play_link', 'a link for another child is refused');
select is((select public.save_session(repeat('1', 64), session, score) from payload), 'created', 'a new session with a valid link is created');
select is((select public.save_session(repeat('1', 64), session, score) from payload), 'duplicate', 'the same session again with its link is a duplicate (FR-12)');
select is(
  (select public.save_session(repeat('1', 64), jsonb_set(session, '{session_id}', '"00000000-0000-0000-0000-00000000005b"'), score) from payload),
  'invalid_play_link',
  'a used link is refused for another session'
);
select is(
  (select public.save_session(repeat('4', 64), session, score) from payload),
  'invalid_play_link',
  'a fresh link cannot claim a session_id that is already stored'
);
reset role;

select results_eq($$ select count(*)::int from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, array[1], 'one session row after the refused and duplicate posts');
select results_eq($$ select count(*)::int from public.trials where session_id in (select id from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) $$, array[2], 'two trial rows, not four');
select results_eq($$ select count(*)::int from public.scores where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, array[1], 'one score row');
select is(
  (select parent_id from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')),
  '00000000-0000-0000-0000-00000000000a'::uuid,
  'parent_id comes from the link, not from the payload'
);
select is(
  (select session_id from public.play_links where code_hash = repeat('1', 64)),
  '00000000-0000-0000-0000-00000000005a'::uuid,
  'the link is marked used by this session'
);
select is(
  (select session_id from public.play_links where code_hash = repeat('4', 64)),
  null,
  'a refused link stays unused'
);
select is((select rt_ms from public.trials where session_id in (select id from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) and i = 1), null, 'a missing response keeps rt_ms null');
select is((select off_target_taps from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), (select session->'off_target_taps' from payload), 'off-target taps kept as jsonb');
select is((select band from public.scores where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), 'insufficient_data', 'score band saved');
select is((select flags from public.scores where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')), '{}'::text[], 'empty flags saved as an empty array');

-- One transaction: a bad trial leaves no session behind and does not use up the link.
set local role service_role; -- check-secrets: allow
select throws_ok(
  $$ select public.save_session(
       repeat('5', 64),
       jsonb_set(jsonb_set(session, '{session_id}', '"00000000-0000-0000-0000-00000000005c"'),
                 '{trials,0,outcome}', '"not-an-outcome"'),
       score) from payload $$,
  '23514',
  null,
  'a trial that breaks a check constraint makes the whole save fail'
);
reset role;
select results_eq($$ select count(*)::int from public.sessions where parent_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b') $$, array[1], 'no session row from the failed save');
select is(
  (select session_id from public.play_links where code_hash = repeat('5', 64)),
  null,
  'the link of a failed save stays unused'
);

-- PC-02 and the grace: a link that ran out during a long session still saves it, with its minigames block.
set local role service_role; -- check-secrets: allow
select is(
  (select public.save_session(
     repeat('6', 64),
     jsonb_set(jsonb_set(session, '{session_id}', '"00000000-0000-0000-0000-00000000005d"'),
               '{minigames}', '[{"id": "star-path", "version": "0.1.0", "params": {}, "results": {"summary": {"span": 2}}}]'::jsonb),
     score) from payload),
  'created',
  'a link that expired during the session, within the grace, still saves it'
);
reset role;
select is(
  (select minigames from public.sessions where id = '00000000-0000-0000-0000-00000000005d'),
  '[{"id": "star-path", "version": "0.1.0", "params": {}, "results": {"summary": {"span": 2}}}]'::jsonb,
  'the minigames block is stored as sent'
);
select is((select minigames from public.sessions where id = '00000000-0000-0000-0000-00000000005a'), null, 'a session without the block keeps null');

select * from finish();
rollback;
