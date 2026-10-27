-- QA 반영: 앱 로그인 주소(아이디@tadak.invalid)가 아닌 이메일로 가입하면 거부 — 다른 도메인으로 아이디를 선점하지 못하게
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if split_part(new.email, '@', 2) <> 'tadak.invalid' then
    raise exception 'signup must use an app login id';
  end if;
  insert into public.profiles (id, username, nickname)
  values (new.id, lower(split_part(new.email, '@', 1)), trim(new.raw_user_meta_data ->> 'nickname'));
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
