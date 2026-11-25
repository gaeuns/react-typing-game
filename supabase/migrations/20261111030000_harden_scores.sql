-- QA 결과 반영 — 막을 수 있는 건 모두 막는다.
--
-- 점수 (H1 · M1 · L2 · L3)
--   - 세션은 게임의 "시작"(3 · 2 · 1 카운트다운)에서 받고, 한 번 제출하면 지운다.
--     줄다리기만 이긴 라운드마다 누적 점수를 다시 올리므로, 단계 · 점수가 커질 때만 같은 세션으로 다시 받는다.
--   - 세션 유효 시간: 게임별 실제 판 길이 (초성 90초 · 고스트 15분 · 나머지 1시간)
--   - 사람 속도 가정: 낱말 초당 2개, 타수 분당 900타(초당 15타). 고스트 하한은 1,100타
--   - 냠냠 디펜스 · 타닥이 달리기는 게임의 실제 규칙(떨어지는 · 나오는 간격, 달리는 속도)을 그대로 따라 계산한 최대치
--   - 같은 사용자 요청은 advisory lock으로 한 줄로 세워 동시 제출로 검사를 건너뛰지 못하게
-- 계정 · 기타 (M3 · L4 · L5 · L6 · L7)
--   - 로그인 이메일(= 아이디) 바꾸기 금지
--   - profiles.created_at 공개 중지
--   - 헷갈리는 글자(0/o, 1/l/i)를 같은 글자로 보고 닉네임 중복 검사
--   - 연습 기록은 함수로만 저장
--   - private.game_sessions RLS 켜기, 쓰이지 않는 INSERT 정책 지우기

-- ─── 세션 ───
alter table private.game_sessions
  add column last_level integer,
  add column last_score integer;
alter table private.game_sessions enable row level security;

drop policy if exists "내 점수만 올릴 수 있음" on public.game_scores;

-- 냠냠 디펜스 최대치 — 떨어지는 대로 바로 먹는다고 치고 t초 동안 먹을 수 있는 개수 · 점수 · 단계
-- (시작할 때 4개, 이후 단계별 간격 max(0.55, 1.5 - 0.12×(단계-1))초, 10개마다 단계 UP, 한 개 ≤ (10×단계 + 2×낱말길이)×3)
create function private.rain_max(t numeric, word_len integer, out max_stage integer, out max_score numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  clock numeric := 0;
  eaten integer := 0;
  stage integer := 1;
begin
  max_score := 0;
  loop
    -- 시작할 때 4개(START_ITEMS 3 + 바로 하나), 그다음부터는 간격마다 하나
    if eaten >= 4 then
      clock := clock + greatest(0.55, 1.5 - 0.12 * (stage - 1));
      exit when clock > t;
    end if;
    max_score := max_score + (10 * stage + 2 * word_len) * 3;
    eaten := eaten + 1;
    stage := 1 + eaten / 10;
    exit when eaten > 100000;
  end loop;
  max_stage := stage;
end;
$$;

-- 타닥이 달리기 최대치 — 넘어지지 않고 모든 장애물을 친다고 치고 t초 동안의 거리 · 장애물 수 · 점수 · 단계
-- (속도 min(0.18 + 0.03×(단계-1), 0.5)판/초 × 50m, 100m마다 단계 UP, 장애물 간격 ≥ 0.8 × max(0.85, 2.0 - 0.15×(단계-1))초,
--  하나 ≤ (10 + 3×낱말길이)×(단계+1)×3, 점수 = 낱말 점수 + 거리)
create function private.runner_max(t numeric, word_len integer, out max_stage integer, out max_score numeric)
language plpgsql
immutable
set search_path = ''
as $$
declare
  clock numeric := 0;
  dt numeric := 0.05;
  dist numeric := 0;
  stage integer := 1;
  next_spawn numeric := 0;
  points numeric := 0;
begin
  while clock < t loop
    if clock >= next_spawn then
      points := points + (10 + 3 * word_len) * (stage + 1) * 3; -- 다가오는 동안 단계가 하나 오를 수 있어서 +1
      next_spawn := clock + 0.8 * greatest(0.85, 2.0 - 0.15 * (stage - 1));
    end if;
    dist := dist + least(0.18 + 0.03 * (stage - 1), 0.5) * 50 * dt;
    stage := 1 + floor(dist / 100)::integer;
    clock := clock + dt;
  end loop;
  max_stage := stage;
  max_score := points + floor(dist);
end;
$$;

revoke all on function private.rain_max(numeric, integer) from public;
revoke all on function private.runner_max(numeric, integer) from public;

create or replace function public.start_game(p_game text, p_mode text)
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
  perform pg_advisory_xact_lock(hashtext('tadak-score:' || uid::text));
  -- 1시간 지난 내 세션은 정리하고, 열린 세션은 5개까지만 (오래된 것부터 버린다)
  delete from private.game_sessions where user_id = uid and started_at < now() - interval '1 hour';
  delete from private.game_sessions where id in (
    select id from private.game_sessions where user_id = uid order by started_at desc offset 4
  );
  if (select count(*) from public.game_scores where user_id = uid and created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many games';
  end if;
  insert into private.game_sessions (user_id, game, mode) values (uid, p_game, p_mode) returning id into sid;
  return sid;
end;
$$;

create or replace function public.submit_score(p_session uuid, p_score integer, p_level integer)
returns void
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
  if t > max_age then
    delete from private.game_sessions where id = s.id;
    raise exception 'session expired';
  end if;
  if exists (
    select 1 from public.game_scores
    where user_id = uid and game = s.game and created_at > now() - interval '3 seconds'
  ) then
    raise exception 'too fast';
  end if;
  if p_score is null or p_level is null or p_score < 1 or p_level < 1 then
    raise exception 'implausible score';
  end if;
  -- 같은 세션으로 다시 올리는 건 줄다리기 다음 라운드뿐 (단계 · 점수가 커질 때만)
  if s.last_level is not null and not (s.game = 'tug' and p_level > s.last_level and p_score >= s.last_score) then
    raise exception 'session used';
  end if;
  ko := s.mode = 'ko';

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
    raise exception 'implausible score';
  end if;

  insert into public.game_scores (user_id, game, mode, score, level) values (uid, s.game, s.mode, p_score, p_level);
  if s.game = 'tug' then
    update private.game_sessions set last_level = p_level, last_score = p_score where id = s.id;
  else
    delete from private.game_sessions where id = s.id;
  end if;
end;
$$;

-- ─── 로그인 이메일(= 아이디) 바꾸기 금지 ───
-- 아이디는 profiles.username과 로그인 이메일 앞부분이 같아야 한다. 이메일을 바꾸면 둘이 어긋나고 다른 도메인 계정이 생긴다.
create function public.block_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     or (coalesce(new.email_change, '') <> coalesce(old.email_change, '') and coalesce(new.email_change, '') <> '') then
    raise exception 'email change is not allowed';
  end if;
  return new;
end;
$$;
revoke all on function public.block_email_change() from public, anon, authenticated;

create trigger on_auth_user_email_change
  before update on auth.users
  for each row execute function public.block_email_change();

-- ─── 공개 정보 줄이기 ───
revoke select (created_at) on public.profiles from anon, authenticated;

-- ─── 헷갈리는 글자로 닉네임 흉내 막기 (0→o, 1 · i→l, 대소문자 무시) ───
drop index public.profiles_nickname_key;
create unique index profiles_nickname_key on public.profiles (translate(lower(nickname), '01i', 'oll'));

create or replace function public.nickname_available(name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles
    where translate(lower(nickname), '01i', 'oll') = translate(lower(trim(name)), '01i', 'oll')
  );
$$;

-- ─── 연습 기록은 함수로만 (더 좋은 기록일 때만 바뀐다) ───
revoke insert, update on public.practice_bests from authenticated;

create or replace function public.save_practice_best(p_key text, p_speed integer, p_accuracy numeric, p_time integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  saved boolean;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  with s as (
    insert into public.practice_bests (user_id, key, speed, accuracy, time)
    values (uid, p_key, p_speed, p_accuracy, p_time)
    on conflict (user_id, key) do update
      set speed = excluded.speed, accuracy = excluded.accuracy, time = excluded.time, updated_at = now()
      where excluded.speed > public.practice_bests.speed
         or (excluded.speed = public.practice_bests.speed and excluded.accuracy > public.practice_bests.accuracy)
    returning 1
  )
  select exists (select 1 from s) into saved;
  return saved;
end;
$$;

revoke execute on function public.save_practice_best(text, integer, numeric, integer) from public, anon;
grant execute on function public.save_practice_best(text, integer, numeric, integer) to authenticated;
