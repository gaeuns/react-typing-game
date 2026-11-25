-- 보안 점검(11-25) 결함 7~12
-- 7: 끝없는 게임(speed · rain · tug · runner)은 세션을 오래 열어 두면 시간 비례 상한이 끝없이 커져 9,999,999점까지 통과했다
--    → 세션 최대 30분 + 게임별 절대 상한 (2026-11 1위의 약 5배 — 실제 기록이 다가가면 올린다)
-- 8: 고스트 하한이 예전 한글 코스(118타) 기준 → 지금 코스 145타. 카운트다운(약 2.45초)도 세션 시간에서 뺀다
-- 9: 초성 상한이 모든 문제를 5글자로 가정(1,310점) → 4글자 기준 + 5글자 낱말 5개, 최소 시간 1.2초/문제 + 카운트다운
-- 10: 훔친 토큰으로 2단계 인증(TOTP)을 몰래 붙이면 주인이 비밀번호를 못 바꾼다 → 앱은 MFA를 안 쓰니 등록 자체를 거절
-- 11: 운영자처럼 보이는 닉네임 거절
-- 12: 권한이 없어 효과 없는 practice_bests 쓰기 정책 정리

create or replace function public.submit_score(p_session uuid, p_score integer, p_level integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  s private.game_sessions;
  t numeric;
  ko boolean;
  ok boolean;
  r record;
  c numeric;
  wps constant numeric := 2;
  countdown constant numeric := 2.45; -- 3 · 2 · 1 (700ms씩) + 시작! (350ms) — 세션은 카운트다운 전에 열린다
  max_age numeric;
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
  max_age := case s.game when 'chosung' then 90 when 'ghost' then 900 else 1800 end;
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
      c := 1.2 * wps * t;
      ok := p_score <= 30000
        and p_level <= 1 + c / 8
        and p_score <= 8 * p_level * (20 * p_level + 40)
        and p_score <= 1.25 * c * c + 60 * c;
    elsif s.game = 'rain' then
      select * into r from private.rain_max(t, case when ko then 5 else 13 end);
      ok := p_score <= 150000
        and p_level <= r.max_stage
        and p_score <= r.max_score
        and p_score <= 10 * p_level * (30 * p_level + 6 * (case when ko then 5 else 13 end));
    elsif s.game = 'tug' then
      ok := p_score <= 30000
        and p_level <= 1 + t / 4.4
        and p_score <= 30 * (case when ko then 6 else 15 end) * t + 50 * p_level * (p_level + 1);
    elsif s.game = 'chosung' then
      -- 문제당 10 + 5 × 글자 수 + 번개 15 + 콤보 (ChosungGame.jsx) — 5글자 낱말은 5개뿐
      ok := ko and p_level <= 20
        and p_score <= 45 * p_level + 5 * least(p_level, 5)
          + case when p_level <= 10 then p_level * (p_level + 1) else 110 + 20 * (p_level - 10) end
        and t >= 2 + 1.2 * p_level; -- 카운트다운(2.45초)보다 조금 짧게 — 네트워크 지연 여유
    elsif s.game = 'ghost' then
      -- 지금 코스 타수(GhostGame.jsx 어려움: 한글 145 · 영어 100)를 1,100타로 친 시간이 하한
      ok := p_level = 3
        and p_score >= (case when ko then 145 else 100 end) * 60000 / 1100
        and p_score <= (t - countdown) * 1000 + 1500; -- 여유 1.5초: start_game 응답이 늦어 세션이 늦게 열린 경우
    elsif s.game = 'runner' then
      select * into r from private.runner_max(t, case when ko then 4 else 8 end);
      ok := p_score <= 60000 and p_level <= r.max_stage and p_score <= r.max_score;
    else
      ok := false;
    end if;
    if not ok then
      reason := 'implausible score';
    end if;
  end if;

  if reason is not null then
    delete from private.game_sessions where id = s.id;
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

-- 10: 2단계 인증 등록 거절
create function public.block_mfa_factor()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'mfa is not used';
end;
$$;
revoke all on function public.block_mfa_factor() from public, anon, authenticated;
create trigger on_mfa_factor_added
  before insert on auth.mfa_factors
  for each row execute function public.block_mfa_factor();

-- 11: 운영자처럼 보이는 닉네임 (닮은 글자 비교와 같은 규칙으로)
create function public.nickname_reserved(name text)
returns boolean language sql immutable set search_path = '' as $$
  select translate(lower(trim(name)), '01i', 'oll') in ('타닥', 'tadak', '운영', '관리', '운영자', '관리자', '운영진')
    or translate(lower(trim(name)), '01i', 'oll') ~ '(관리자|운영자|운영진|admln|staff|offlclal)';
$$;
revoke all on function public.nickname_reserved(text) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if split_part(new.email, '@', 2) <> 'tadak.invalid' then
    raise exception 'signup must use an app login id';
  end if;
  if public.nickname_reserved(new.raw_user_meta_data ->> 'nickname') then
    raise exception 'nickname reserved';
  end if;
  insert into public.profiles (id, username, nickname)
  values (new.id, lower(split_part(new.email, '@', 1)), trim(new.raw_user_meta_data ->> 'nickname'));
  return new;
end;
$$;

create or replace function public.nickname_available(name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select not public.nickname_reserved(name) and not exists (
    select 1 from public.profiles
    where translate(lower(nickname), '01i', 'oll') = translate(lower(trim(name)), '01i', 'oll')
  );
$$;

-- 12
drop policy "내 연습 기록만 고치기" on public.practice_bests;
drop policy "내 연습 기록만 넣기" on public.practice_bests;
