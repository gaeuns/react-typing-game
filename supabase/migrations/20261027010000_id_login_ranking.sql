-- 타닥 — 아이디 로그인 · 닉네임 · 게임 점수 · 랭킹
-- 로그인은 Supabase Auth의 이메일 칸에 "아이디@tadak.invalid"를 넣어 쓴다 (.invalid는 실제로 존재할 수 없는 도메인 — 메일이 나가지 않음).
-- 이메일(선택)은 user_metadata.contact_email에만 둔다 (본인만 볼 수 있음).

-- ─── 아이디 · 닉네임 (회원가입 때 트리거가 만든다) ───
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[a-z][a-z0-9_]{3,15}$'),
  nickname text not null check (nickname ~ '^[0-9A-Za-z가-힣_]{2,12}$'),
  created_at timestamptz not null default now()
);

create unique index profiles_username_key on public.profiles (username);
create unique index profiles_nickname_key on public.profiles (lower(nickname));

alter table public.profiles enable row level security;

create policy "닉네임은 누구나 볼 수 있음" on public.profiles
  for select using (true);

-- 아이디는 공개하지 않는다 — 닉네임만 읽을 수 있게 (쓰기는 트리거만)
revoke all on public.profiles from anon, authenticated;
grant select (id, nickname, created_at) on public.profiles to anon, authenticated;

-- 아이디는 로그인 주소(아이디@tadak.invalid)의 앞부분 그대로 — 규칙에 어긋나거나 겹치면 가입 자체가 실패한다
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, nickname)
  values (new.id, lower(split_part(new.email, '@', 1)), trim(new.raw_user_meta_data ->> 'nickname'));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 중복 확인 (가입 화면의 "중복 확인" 버튼)
-- 아이디 칸은 공개하지 않으므로 security definer — 있다/없다만 알려 준다
create function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(trim(name)));
$$;

revoke execute on function public.username_available(text) from public;
grant execute on function public.username_available(text) to anon, authenticated;

create function public.nickname_available(name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select not exists (select 1 from public.profiles where lower(nickname) = lower(trim(name)));
$$;

-- ─── 게임 점수 ───
create table public.game_scores (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  game text not null check (game in ('speed', 'rain', 'tug')),
  mode text not null check (mode in ('ko', 'en')),
  score integer not null check (score > 0 and score < 10000000),
  level integer check (level > 0),
  created_at timestamptz not null default now()
);

create index game_scores_board_idx on public.game_scores (game, mode, score desc);
create index game_scores_best_idx on public.game_scores (game, mode, user_id, score desc);
create index game_scores_user_idx on public.game_scores (user_id);

alter table public.game_scores enable row level security;

create policy "점수는 누구나 볼 수 있음" on public.game_scores
  for select using (true);

create policy "내 점수만 올릴 수 있음" on public.game_scores
  for insert to authenticated with check ((select auth.uid()) = user_id);

-- 점수는 game · mode · score · level만 넣을 수 있다 (created_at · user_id는 DB 기본값 — 순위 조작 방지), 수정 · 삭제 불가
revoke all on public.game_scores from anon, authenticated;
grant select on public.game_scores to anon, authenticated;
grant insert (game, mode, score, level) on public.game_scores to authenticated;

-- 홈 화면 실시간 랭킹 — 새 점수가 들어오면 알림
alter publication supabase_realtime add table public.game_scores;

-- ─── 랭킹: 게임 · 언어별로 사람마다 최고 점수 하나 ───
create view public.game_best
with (security_invoker = true)
as
select distinct on (s.game, s.mode, s.user_id)
  s.game, s.mode, s.user_id, p.nickname, s.score, s.level, s.created_at
from public.game_scores s
join public.profiles p on p.id = s.user_id
order by s.game, s.mode, s.user_id, s.score desc, s.created_at asc;

-- 위에서부터 p_limit명 (같은 점수는 같은 순위, 먼저 낸 사람이 위)
create function public.game_ranking(p_game text, p_mode text, p_limit integer default 10)
returns table (rank bigint, user_id uuid, nickname text, score integer, level integer, achieved_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select rank() over (order by b.score desc), b.user_id, b.nickname, b.score, b.level, b.created_at
  from public.game_best b
  where b.game = p_game and b.mode = p_mode
  order by b.score desc, b.created_at asc
  limit least(greatest(p_limit, 1), 50);
$$;

-- 내 순위 (기록이 없으면 빈 결과)
create function public.my_game_rank(p_game text, p_mode text)
returns table (rank bigint, score integer)
language sql
stable
set search_path = ''
as $$
  select
    (select count(*) from public.game_best o where o.game = p_game and o.mode = p_mode and o.score > b.score) + 1,
    b.score
  from public.game_best b
  where b.game = p_game and b.mode = p_mode and b.user_id = (select auth.uid());
$$;
