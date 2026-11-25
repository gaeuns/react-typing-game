-- 점수 · 프로필 테이블을 프론트에서 직접 못 읽게 막는다.
-- 지금까지는 랭킹 · 실시간 알림 때문에 game_scores를 누구나 읽을 수 있었다 → /rest/v1/game_scores로
-- 모든 판의 기록 · user_id · 시각이 그대로 보였다.
--   - 랭킹 · 내 순위 · 내 최고 기록은 서버 함수로만 (필요한 칸만 · user_id 대신 is_me)
--   - 실시간 랭킹은 행 대신 "이 게임에 새 기록" 알림만 (Realtime Broadcast, 비공개 채널 — 받기만 되고 보내기는 안 됨)
--   - profiles는 내 행만 읽기 (닉네임 중복 확인은 함수로)

-- ─── 점수 ───
revoke select on public.game_scores from anon, authenticated;
drop policy if exists "점수는 누구나 볼 수 있음" on public.game_scores;
revoke select on public.game_best from anon, authenticated;

drop function public.game_ranking(text, text, integer);
create function public.game_ranking(p_game text, p_mode text, p_limit integer default 10)
returns table (rank bigint, nickname text, score integer, level integer, is_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select rank() over (order by case when p_game = 'ghost' then -b.score else b.score end desc),
    b.nickname, b.score, b.level, b.user_id = (select auth.uid())
  from public.game_best b
  where b.game = p_game and b.mode = p_mode
  order by case when p_game = 'ghost' then -b.score else b.score end desc, b.created_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

alter function public.my_game_rank(text, text) security definer;

-- 내 게임별 최고 기록 (로그인했을 때 게임 목록 카드 · "최고" 표시)
create function public.my_game_bests()
returns table (game text, mode text, score integer, level integer, achieved_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.game, b.mode, b.score, b.level, b.created_at
  from public.game_best b
  where b.user_id = (select auth.uid());
$$;

revoke execute on function public.game_ranking(text, text, integer) from public;
revoke execute on function public.my_game_rank(text, text) from public;
revoke execute on function public.my_game_bests() from public, anon;
grant execute on function public.game_ranking(text, text, integer) to anon, authenticated;
grant execute on function public.my_game_rank(text, text) to anon, authenticated;
grant execute on function public.my_game_bests() to authenticated;

-- ─── 실시간 랭킹: 행 대신 알림만 ───
alter publication supabase_realtime drop table public.game_scores;

create function private.notify_new_score()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 어느 게임 · 언어에 새 기록이 들어왔는지만 — 받는 쪽은 랭킹 함수로 다시 읽는다
  perform realtime.send(jsonb_build_object('game', new.game, 'mode', new.mode), 'new_score', 'home-live-ranking', true);
  return null;
end;
$$;
revoke all on function private.notify_new_score() from public;

create trigger on_game_score_inserted
  after insert on public.game_scores
  for each row execute function private.notify_new_score();

-- 비공개 채널: 누구나 받을 수 있지만, 보내기(insert) 규칙은 없어서 클라이언트는 가짜 알림을 못 보낸다
create policy "실시간 랭킹 알림 받기" on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() = 'home-live-ranking' and extension = 'broadcast');

-- ─── 프로필: 내 행만 ───
drop policy if exists "닉네임은 누구나 볼 수 있음" on public.profiles;
revoke select on public.profiles from anon;
create policy "내 프로필만 읽기" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

alter function public.nickname_available(text) security definer;
