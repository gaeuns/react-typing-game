-- 랭킹 조작 막기 — 점수는 이제 서버 함수로만 올린다.
--
-- 1. 게임을 시작할 때 start_game()으로 서버가 시작 시각을 기록한 세션을 받는다.
-- 2. 끝나면 submit_score(세션, 점수, 단계)로 올린다. 서버가 아래를 확인하고 통과하면 game_scores에 넣는다.
--    - 내 세션인지, 6시간이 안 지났는지
--    - 같은 게임 점수를 3초 안에 또 올리지 않는지
--    - 게임마다 "그 단계 · 그 시간 안에 실제로 나올 수 있는 점수"인지 (아래 상한)
-- 3. game_scores에 직접 insert하는 권한은 없앤다.
--
-- 상한은 게임 코드의 점수 공식 · 낱말 길이에서 계산했고, 사람 손 속도는 넉넉하게 잡았다
-- (낱말 초당 4개, 글자 초당 한글 10 · 영어 20, 고스트 1,500타). 실제 기록은 상한의 절반도 안 된다.
-- 한계: 게임이 브라우저에서 돌아가므로, 작정하고 상한 안쪽의 그럴듯한 점수를 꾸며 내는 것까지는 막을 수 없다.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.game_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  game text not null check (game in ('speed', 'rain', 'tug', 'chosung', 'ghost', 'runner')),
  mode text not null check (mode in ('ko', 'en')),
  started_at timestamptz not null default now()
);
create index game_sessions_user_started on private.game_sessions (user_id, started_at);

-- 점수는 함수로만
revoke insert on public.game_scores from authenticated;
-- 랭킹 뷰는 읽기 전용 (갱신 불가 뷰라 쓰이진 않지만 권한도 남기지 않는다)
revoke insert, update, delete, truncate, references, trigger on public.game_best from anon, authenticated;

create function public.start_game(p_game text, p_mode text)
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
  -- 하루 지난 내 세션은 정리
  delete from private.game_sessions where user_id = uid and started_at < now() - interval '1 day';
  if (select count(*) from private.game_sessions where user_id = uid and started_at > now() - interval '1 minute') >= 30 then
    raise exception 'too many games';
  end if;
  insert into private.game_sessions (user_id, game, mode) values (uid, p_game, p_mode) returning id into sid;
  return sid;
end;
$$;

create function public.submit_score(p_session uuid, p_score integer, p_level integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s private.game_sessions;
  t numeric; -- 세션 시작 뒤 지난 초
  ko boolean;
  ok boolean;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select * into s from private.game_sessions where id = p_session and user_id = uid;
  if not found then
    raise exception 'invalid session';
  end if;
  t := extract(epoch from now() - s.started_at);
  if t > 6 * 3600 then
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
  ko := s.mode = 'ko';

  ok := case s.game
    -- 타임 어택: 8장마다 단계 UP, 카드 한 장 ≤ 2(10단계+20), 빗자루로 한 번에 최대 3장
    when 'speed' then
      p_level <= 1 + 1.5 * t
      and p_score <= 8 * p_level * (20 * p_level + 40)
      and p_score <= 4 * t * (40 * p_level + 40)
    -- 냠냠 디펜스: 10개마다 단계 UP, 한 개 ≤ (10단계 + 2×낱말길이)×3, 떨어지는 건 0.55초에 하나 이하
    when 'rain' then
      p_level <= 1 + (3 + t / 0.55) / 10
      and p_score <= least(10 * p_level, 3 + t / 0.55) * (30 * p_level + 6 * (case when ko then 5 else 13 end))
    -- 줄다리기: 글자당 ≤ 10×2(힘)×1.5(콤보), 이긴 라운드마다 100×라운드
    when 'tug' then
      p_level <= 1 + t
      and p_score <= 30 * (case when ko then 10 else 20 end) * t + 50 * p_level * (p_level + 1)
    -- 초성 퀴즈: 한글 전용, 20문제, 한 문제 ≤ 70점
    when 'chosung' then
      ko and p_level <= 20 and p_score <= 70 * p_level and t >= p_level / 5.0
    -- 고스트 레이스: 점수 = 도착 시간(ms). 고정 코스(한글 118타 · 영어 100타)를 1,500타보다 빨리 칠 수 없고, 세션보다 오래 걸릴 수 없다
    when 'ghost' then
      p_level = 3
      and p_score >= (case when ko then 118 else 100 end) * 40
      and p_score <= t * 1000 + 1000
    -- 타닥이 달리기: 초당 25m 이하, 100m마다 단계 UP, 장애물은 0.68초에 하나 이하, 하나 ≤ (10 + 3×낱말길이)×단계×3
    when 'runner' then
      p_level <= 1 + 25 * t / 100
      and p_score <= 25 * t + (1 + t / 0.68) * (10 + 3 * (case when ko then 4 else 8 end)) * 3 * p_level
    else false
  end;
  if not ok then
    raise exception 'implausible score';
  end if;

  insert into public.game_scores (user_id, game, mode, score, level) values (uid, s.game, s.mode, p_score, p_level);
end;
$$;

revoke execute on function public.start_game(text, text) from public, anon;
revoke execute on function public.submit_score(uuid, integer, integer) from public, anon;
grant execute on function public.start_game(text, text) to authenticated;
grant execute on function public.submit_score(uuid, integer, integer) to authenticated;
