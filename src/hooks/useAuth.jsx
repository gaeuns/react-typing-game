import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

/**
 * 로그인 상태 — 앱 전체가 같이 쓴다 (사이드바 닉네임, 메인 화면, 게임 랭킹).
 * Supabase가 설정되지 않았으면 configured: false — 로그인 없이 그대로 쓸 수 있다.
 *
 * 아이디로 가입 · 로그인한다. Supabase Auth는 이메일이 있어야 해서 "아이디@tadak.invalid"를 넣어 쓴다
 * (.invalid는 실제로 존재할 수 없는 도메인이라 메일이 나가지 않는다). 이메일(선택)은 user_metadata에만 둔다.
 */
const AuthContext = createContext(null);

const LOGIN_DOMAIN = 'tadak.invalid';
const toLoginEmail = (username) => `${username.trim().toLowerCase()}@${LOGIN_DOMAIN}`;

export const USERNAME_RULE = /^[a-z][a-z0-9_]{3,15}$/;
export const USERNAME_HINT = '영문 소문자로 시작 · 영문 소문자 · 숫자 · _ 4~16자';
export const NICKNAME_RULE = /^[0-9A-Za-z가-힣_]{2,12}$/;
export const NICKNAME_HINT = '한글 · 영문 · 숫자 · _ 2~12자';
// 가입 비밀번호: 영문 + 숫자를 섞어 8자 이상 (서버는 6자만 검사 — 123456 같은 쉬운 비밀번호를 막는다)
const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
export const PASSWORD_HINT = '영문과 숫자를 섞어 8자 이상';
const EMAIL_RULE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Supabase 오류 → 사용자에게 보여 줄 말
function toMessage(error) {
  const text = error?.message ?? '';
  if (/invalid login credentials/i.test(text)) return '아이디 또는 비밀번호가 맞지 않아요.';
  if (/already registered|already exists/i.test(text)) return '이미 있는 아이디예요. 중복 확인을 다시 해 주세요.';
  // 프로필 저장(가입 트리거)이 실패 — 확인 직후 다른 사람이 같은 아이디 · 닉네임으로 가입했거나 규칙에 어긋남
  if (/database error saving new user|profiles|check constraint|duplicate key/i.test(text)) {
    return '아이디나 닉네임을 쓸 수 없어요. 중복 확인을 다시 해 주세요.';
  }
  if (/password should be at least|weak.?password/i.test(text)) return `비밀번호는 ${PASSWORD_HINT}으로 해 주세요.`;
  if (/rate limit|too many/i.test(text)) return '잠시 뒤에 다시 시도해 주세요.';
  if (/failed to fetch|network/i.test(text)) return '서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.';
  return '문제가 생겼어요. 잠시 뒤에 다시 시도해 주세요.';
}

/** 아이디 중복 확인 — { ok, message } */
export async function checkUsername(raw) {
  const name = raw.trim().toLowerCase();
  if (!USERNAME_RULE.test(name)) return { ok: false, message: `아이디는 ${USERNAME_HINT}로 지어 주세요.` };
  const { data, error } = await supabase.rpc('username_available', { name });
  if (error) return { ok: false, message: toMessage(error) };
  return data ? { ok: true, message: '쓸 수 있는 아이디예요.' } : { ok: false, message: '이미 있는 아이디예요.' };
}

/** 닉네임 중복 확인 — { ok, message } */
export async function checkNickname(raw) {
  const name = raw.trim();
  if (!NICKNAME_RULE.test(name)) return { ok: false, message: `닉네임은 ${NICKNAME_HINT}로 지어 주세요.` };
  const { data, error } = await supabase.rpc('nickname_available', { name });
  if (error) return { ok: false, message: toMessage(error) };
  return data ? { ok: true, message: '쓸 수 있는 닉네임이에요.' } : { ok: false, message: '이미 쓰고 있는 닉네임이에요.' };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!supabase);
  const [profileNickname, setProfileNickname] = useState(null); // 랭킹과 같은 닉네임 (profiles)

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  // 화면에 보이는 닉네임은 랭킹과 같은 profiles에서 — user_metadata는 사용자가 바꿀 수 있어서
  const userId = user?.id;
  useEffect(() => {
    setProfileNickname(null);
    if (!supabase || !userId) return undefined;
    let alive = true;
    supabase
      .from('profiles')
      .select('nickname')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => alive && data && setProfileNickname(data.nickname));
    return () => {
      alive = false;
    };
  }, [userId]);

  const signIn = async (username, password) => {
    if (!username.trim()) return { error: '아이디를 입력해 주세요.' };
    const { error } = await supabase.auth.signInWithPassword({ email: toLoginEmail(username), password });
    return error ? { error: toMessage(error) } : {};
  };

  /** 회원가입 — 아이디 · 닉네임 중복 확인은 화면에서 먼저 끝낸다. 이메일은 선택 */
  const signUp = async ({ username, password, nickname, email }) => {
    const id = username.trim().toLowerCase();
    const name = nickname.trim();
    const contact = email.trim();
    if (!USERNAME_RULE.test(id)) return { error: `아이디는 ${USERNAME_HINT}로 지어 주세요.` };
    if (!PASSWORD_RULE.test(password)) return { error: `비밀번호는 ${PASSWORD_HINT}으로 해 주세요.` };
    if (!NICKNAME_RULE.test(name)) return { error: `닉네임은 ${NICKNAME_HINT}로 지어 주세요.` };
    if (contact && !EMAIL_RULE.test(contact)) return { error: '이메일 주소를 확인해 주세요. 없으면 비워 두세요.' };

    const { data, error } = await supabase.auth.signUp({
      email: toLoginEmail(id),
      password,
      options: { data: { username: id, nickname: name, contact_email: contact || null } },
    });
    if (error) return { error: toMessage(error) };
    // 이미 있는 아이디면 Supabase는 오류 없이 빈 identities를 돌려줄 때가 있다
    if (data.user && data.user.identities?.length === 0) return { error: '이미 있는 아이디예요. 중복 확인을 다시 해 주세요.' };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    configured: !!supabase,
    loading,
    user,
    username: user?.email?.endsWith(`@${LOGIN_DOMAIN}`) ? user.email.split('@')[0] : null, // user_metadata는 본인이 바꿀 수 있어서 안 쓴다
    nickname: user ? (profileNickname ?? user.user_metadata?.nickname ?? null) : null,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
