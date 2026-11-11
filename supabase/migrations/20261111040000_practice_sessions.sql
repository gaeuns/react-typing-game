-- 타자 연습 기록도 서버 세션으로만 · 실패한 제출도 세션을 버린다
--
-- 연습 기록
--   - 판(라운드)을 시작할 때 start_practice(키)로 세션을 받고, 끝나서 최고 기록이면 save_practice_best(세션, …)로 올린다.
--   - 걸린 시간은 세션을 연 뒤 지난 시간보다 길 수 없고(2초 여유), 타수는 2,000타 이하(PracticeView의 MAX_PLAUSIBLE_SPEED),
--     60초 연습은 걸린 시간이 60초여야 한다. 세션은 한 번 쓰면 버린다 (2시간 지나면 무효).
-- 게임 점수
--   - submit_score가 거절해도 세션을 버린다 — 같은 세션으로 값을 바꿔 가며 상한을 찾아내지 못하게.
--     그래서 거절은 오류 대신 이유 글자로 돌려준다 (오류를 내면 세션 삭제도 되돌려지므로). 통과하면 'ok'.

create table private.practice_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  key text not null check (key ~ '^(ko|en|(words|long|timed|keys-(home|top|bottom|all)):(ko|en))$'),
  started_at timestamptz not null default now()
);
alter table private.practice_sessions enable row level security;
create index practice_sessions_user_started on private.practice_sessions (user_id, started_at);

create function public.start_practice(p_key text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  sid uuid;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  perform pg_advisory_xact_lock(hashtext('tadak-practice:' || uid::text));
  delete from private.practice_sessions where user_id = uid and started_at < now() - interval '2 hours';
  delete from private.practice_sessions where id in (
    select id from private.practice_sessions where user_id = uid order by started_at desc offset 4
  );
  insert into private.practice_sessions (user_id, key) values (uid, p_key) returning id into sid;
  return sid;
end;
$$;

drop function public.save_practice_best(text, integer, numeric, integer);

create function public.save_practice_best(p_session uuid, p_speed integer, p_accuracy numeric, p_time integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s private.practice_sessions;
  elapsed_ms numeric;
  saved boolean;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  perform pg_advisory_xact_lock(hashtext('tadak-practice:' || uid::text));
  select * into s from private.practice_sessions where id = p_session and user_id = uid for update;
  if not found then
    raise exception 'invalid session';
  end if;
  delete from private.practice_sessions where id = s.id; -- 한 번만 (거절돼도)
  elapsed_ms := extract(epoch from now() - s.started_at) * 1000;
  if elapsed_ms > 2 * 3600 * 1000
     or p_speed is null or p_accuracy is null or p_time is null
     or p_speed < 0 or p_speed > 2000
     or p_accuracy < 0 or p_accuracy > 100
     or p_time < 1000 or p_time > elapsed_ms + 2000
     or (s.key like 'timed:%' and p_time not between 59000 and 61000) then
    return false;
  end if;

  with up as (
    insert into public.practice_bests (user_id, key, speed, accuracy, time)
    values (uid, s.key, p_speed, p_accuracy, p_time)
    on conflict (user_id, key) do update
      set speed = excluded.speed, accuracy = excluded.accuracy, time = excluded.time, updated_at = now()
      where excluded.speed > public.practice_bests.speed
         or (excluded.speed = public.practice_bests.speed and excluded.accuracy > public.practice_bests.accuracy)
    returning 1
  )
  select exists (select 1 from up) into saved;
  return saved;
end;
$$;

revoke execute on function public.start_practice(text) from public, anon;
revoke execute on function public.save_practice_best(uuid, integer, numeric, integer) from public, anon;
grant execute on function public.start_practice(text) to authenticated;
grant execute on function public.save_practice_best(uuid, integer, numeric, integer) to authenticated;

-- ─── 게임 점수: 거절해도 세션을 버린다 (반환값이 바뀌므로 다시 만든다) ───
drop function public.submit_score(uuid, integer, integer);

create function public.submit_score(p_session uuid, p_score integer, p_level integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s private.game_sessions;
  t numeric; -- 세션(게임 시작) 뒤 지난 초
  ko boolean;
  ok boolean;
  r record;
  c numeric; -- 타임 어택에서 칠 수 있는 카드 수
  wps constant numeric := 2; -- 낱말 초당 2개
  max_age numeric; -- 세션 유효 시간(초)
  reason text;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  perform pg_advisory_xact_lock(hashtext('tadak-score:' || uid::text));
  select * into s from private.game_sessions where id = p_session and user_id = uid for update;
  if not found then
    raise exception 'invalid session';
  end if;
  t := extract(epoch from now() - s.started_at);
  max_age := case s.game when 'chosung' then 90 when 'ghost' then 900 else 3600 end;
  ko := s.mode = 'ko';

  if t > max_age then
    reason := 'session expired';
  elsif exists (
    select 1 from public.game_scores
    where user_id = uid and game = s.game and created_at > now() - interval '3 seconds'
  ) then
    reason := 'too fast';
  elsif p_score is null or p_level is null or p_score < 1 or p_level < 1 then
    reason := 'implausible score';
  elsif s.last_level is not null and not (s.game = 'tug' and p_level > s.last_level and p_score >= s.last_score) then
    reason := 'session used';
  else
    if s.game = 'speed' then
      -- 낱말 초당 2개 + 빗자루 덤 20%, 8장마다 단계 UP, 카드 한 장 ≤ 2×(10×단계 + 20)
      c := 1.2 * wps * t;
      ok := p_level <= 1 + c / 8
        and p_score <= 8 * p_level * (20 * p_level + 40)
        and p_score <= 1.25 * c * c + 60 * c;
    elsif s.game = 'rain' then
      select * into r from private.rain_max(t, case when ko then 5 else 13 end);
      ok := p_level <= r.max_stage
        and p_score <= r.max_score
        and p_score <= 10 * p_level * (30 * p_level + 6 * (case when ko then 5 else 13 end));
    elsif s.game = 'tug' then
      -- 글자 초당 한글 6 · 영어 15 (900타), 글자당 ≤ 10 × 힘 2 × 콤보 1.5, 이긴 라운드마다 100×라운드
      -- 라운드마다 3·2·1(2.45초) + 최소 4낱말(2초)
      ok := p_level <= 1 + t / 4.4
        and p_score <= 30 * (case when ko then 6 else 15 end) * t + 50 * p_level * (p_level + 1);
    elsif s.game = 'chosung' then
      -- 한글 전용 · 20문제 · 한 문제 ≤ 10 + 5×5글자 + 번개 15 + 콤보 min(연속,10)×2 · 한 문제에 0.8초 이상
      ok := ko and p_level <= 20
        and p_score <= 50 * p_level + case when p_level <= 10 then p_level * (p_level + 1) else 110 + 20 * (p_level - 10) end
        and t >= 0.8 * p_level;
    elsif s.game = 'ghost' then
      -- 점수 = 도착 시간(ms). 고정 코스(한글 118타 · 영어 100타)를 1,100타보다 빨리 칠 수 없고, 게임 시작 뒤 지난 시간보다 길 수 없다
      ok := p_level = 3
        and p_score >= (case when ko then 118 else 100 end) * 60000 / 1100
        and p_score <= t * 1000 + 500;
    elsif s.game = 'runner' then
      select * into r from private.runner_max(t, case when ko then 4 else 8 end);
      ok := p_level <= r.max_stage and p_score <= r.max_score;
    else
      ok := false;
    end if;
    if not ok then
      reason := 'implausible score';
    end if;
  end if;

  if reason is not null then
    delete from private.game_sessions where id = s.id; -- 거절된 세션은 다시 못 쓴다
    return reason;
  end if;

  insert into public.game_scores (user_id, game, mode, score, level) values (uid, s.game, s.mode, p_score, p_level);
  if s.game = 'tug' then
    update private.game_sessions set last_level = p_level, last_score = p_score where id = s.id;
  else
    delete from private.game_sessions where id = s.id;
  end if;
  return 'ok';
end;
$$;

revoke execute on function public.submit_score(uuid, integer, integer) from public, anon;
grant execute on function public.submit_score(uuid, integer, integer) to authenticated;
