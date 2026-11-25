-- 고스트 레이스는 점수 = 도착 시간(ms) — 작을수록 위. 다른 게임은 그대로 클수록 위.
-- 순위 기준값: ghost면 -score, 아니면 score (클수록 좋음)

create or replace view public.game_best
with (security_invoker = true)
as
select distinct on (s.game, s.mode, s.user_id)
  s.game, s.mode, s.user_id, p.nickname, s.score, s.level, s.created_at
from public.game_scores s
join public.profiles p on p.id = s.user_id
order by s.game, s.mode, s.user_id,
  case when s.game = 'ghost' then -s.score else s.score end desc, s.created_at asc;

-- 위에서부터 p_limit명 (같은 기록은 같은 순위, 먼저 낸 사람이 위)
create or replace function public.game_ranking(p_game text, p_mode text, p_limit integer default 10)
returns table (rank bigint, user_id uuid, nickname text, score integer, level integer, achieved_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select rank() over (order by case when p_game = 'ghost' then -b.score else b.score end desc),
    b.user_id, b.nickname, b.score, b.level, b.created_at
  from public.game_best b
  where b.game = p_game and b.mode = p_mode
  order by case when p_game = 'ghost' then -b.score else b.score end desc, b.created_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

-- 내 순위 (기록이 없으면 빈 결과)
create or replace function public.my_game_rank(p_game text, p_mode text)
returns table (rank bigint, score integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.game_best o
      where o.game = p_game and o.mode = p_mode
        and case when p_game = 'ghost' then o.score < b.score else o.score > b.score end) + 1,
    b.score
  from public.game_best b
  where b.game = p_game and b.mode = p_mode and b.user_id = (select auth.uid());
$$;
