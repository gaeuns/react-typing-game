-- 회원탈퇴는 5분 안에 비밀번호로 로그인한 토큰으로만.
-- 화면은 탈퇴 직전에 비밀번호로 다시 로그인하지만, 그건 화면에서만의 확인이라 개발자 도구에서 저장된 토큰으로 바로 부르면 비밀번호 없이 지워졌다.
-- JWT의 amr에 비밀번호 로그인 시각(timestamp)이 들어 있다 — 토큰을 새로 고쳐 받아도 처음 로그인한 시각이 그대로라 오래된 로그인으로는 못 지운다.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  password_at bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  select max((e ->> 'timestamp')::bigint) into password_at
  from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) e
  where e ->> 'method' = 'password';
  if password_at is null or password_at < extract(epoch from now()) - 300 then
    raise exception 'reauthentication required';
  end if;
  delete from auth.users where id = uid;
end;
$$;
