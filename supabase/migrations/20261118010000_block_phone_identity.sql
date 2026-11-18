-- 로그인 수단은 "아이디@tadak.invalid + 비밀번호" 하나뿐이어야 한다.
-- 이메일 변경만 막고 있어서, 대시보드에서 전화번호 · OAuth 로그인을 켜는 순간
-- 세션 토큰만 가진 사람이 전화번호나 외부 계정을 몰래 붙여 두 번째 로그인 수단을 만들 수 있었다.

-- 전화번호 추가 · 변경도 거절
create or replace function public.block_email_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.email is distinct from old.email
     or (coalesce(new.email_change, '') <> coalesce(old.email_change, '') and coalesce(new.email_change, '') <> '') then
    raise exception 'email change is not allowed';
  end if;
  if new.phone is distinct from old.phone
     or (coalesce(new.phone_change, '') <> coalesce(old.phone_change, '') and coalesce(new.phone_change, '') <> '') then
    raise exception 'phone change is not allowed';
  end if;
  return new;
end;
$$;

-- 이메일 말고 다른 로그인 수단(전화 · OAuth · 익명 등) 연결 거절
create function public.block_extra_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.provider <> 'email' then
    raise exception 'only id/password login is allowed';
  end if;
  return new;
end;
$$;
revoke all on function public.block_extra_identity() from public, anon, authenticated;

create trigger on_auth_identity_added
  before insert or update of provider on auth.identities
  for each row execute function public.block_extra_identity();
