-- 회원탈퇴 — 로그인한 본인 계정만 지운다.
-- auth.users를 지우면 profiles → game_scores · practice_bests가 on delete cascade로 같이 지워진다.
-- 클라이언트는 auth.users를 직접 지울 수 없어서 security definer. 지우는 대상은 auth.uid()로만 정한다.
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
