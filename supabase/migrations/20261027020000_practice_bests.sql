-- 타자 연습 최고 기록 — 계정마다 연습 종류 · 단계 · 언어별 하나 (본인만 읽고 쓴다)
-- key는 앱의 기록 키 그대로: 단문 'ko' · 'en', 그 밖 'words:ko', 'long:en', 'timed:ko', 자리 연습 'keys-home:ko' …
create table public.practice_bests (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  key text not null check (key ~ '^(ko|en|(words|long|timed|keys-(home|top|bottom|all)):(ko|en))$'),
  speed integer not null check (speed between 0 and 3000),
  accuracy numeric(4, 1) not null check (accuracy between 0 and 100),
  time integer not null check (time > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.practice_bests enable row level security;

create policy "내 연습 기록만 읽기" on public.practice_bests
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "내 연습 기록만 넣기" on public.practice_bests
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "내 연습 기록만 고치기" on public.practice_bests
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.practice_bests from anon, authenticated;
grant select on public.practice_bests to authenticated;
grant insert (key, speed, accuracy, time) on public.practice_bests to authenticated;
grant update (speed, accuracy, time, updated_at) on public.practice_bests to authenticated;

-- 더 좋은 기록일 때만 저장 (타수가 높거나, 같으면 정확도가 높을 때) — 바뀌었으면 true
create function public.save_practice_best(p_key text, p_speed integer, p_accuracy numeric, p_time integer)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  with saved as (
    insert into public.practice_bests (key, speed, accuracy, time)
    values (p_key, p_speed, p_accuracy, p_time)
    on conflict (user_id, key) do update
      set speed = excluded.speed, accuracy = excluded.accuracy, time = excluded.time, updated_at = now()
      where excluded.speed > public.practice_bests.speed
         or (excluded.speed = public.practice_bests.speed and excluded.accuracy > public.practice_bests.accuracy)
    returning 1
  )
  select exists (select 1 from saved);
$$;

revoke execute on function public.save_practice_best(text, integer, numeric, integer) from public, anon;
grant execute on function public.save_practice_best(text, integer, numeric, integer) to authenticated;
