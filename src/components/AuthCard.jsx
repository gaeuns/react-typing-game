import { useEffect, useState } from 'react';
import {
  NICKNAME_HINT,
  PASSWORD_HINT,
  USERNAME_HINT,
  checkNickname,
  checkUsername,
  useAuth,
} from '../hooks/useAuth';

const EMPTY_FORM = { username: '', password: '', nickname: '', email: '' };
const EMPTY_CHECKS = { username: null, nickname: null }; // { value, ok, message } — 확인한 값이 지금 값과 같아야 통과

/**
 * 메인 화면의 로그인 카드 — 로그인 / 회원가입 / 로그인한 뒤 인사.
 * 아이디로 가입 · 로그인하고, 아이디 · 닉네임은 "중복 확인"을 눌러 통과해야 가입할 수 있다. 이메일은 선택.
 * 로그인하지 않아도 연습 · 게임은 그대로 할 수 있고, 로그인하면 게임 점수가 랭킹에 올라간다.
 */
export default function AuthCard({ onPlay }) {
  const { configured, loading, user, username, nickname, signIn, signUp, signOut } = useAuth();
  const [tab, setTab] = useState('signin'); // signin | signup
  const [form, setForm] = useState(EMPTY_FORM);
  const [checks, setChecks] = useState(EMPTY_CHECKS);
  const [message, setMessage] = useState(null); // { tone: 'error' | 'info', text }
  const [busy, setBusy] = useState(false);

  // 로그인 · 로그아웃이 바뀌면 입력값 · 탭 · 안내를 처음 상태로 (로그아웃 뒤 비밀번호가 남지 않게)
  const userId = user?.id;
  useEffect(() => {
    setForm(EMPTY_FORM);
    setChecks(EMPTY_CHECKS);
    setTab('signin');
    setMessage(null);
  }, [userId]);

  if (!configured) {
    return (
      <section className="auth-card" aria-label="로그인">
        <h2 className="auth-card__title">로그인</h2>
        <p className="auth-card__note">로그인 서버를 준비하고 있어요. 지금은 로그인 없이 연습 · 게임을 할 수 있어요.</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="auth-card" aria-label="로그인" aria-busy="true">
        <p className="auth-card__note">로그인 상태를 확인하는 중…</p>
      </section>
    );
  }

  if (user) {
    return (
      <section className="auth-card" aria-label="내 계정">
        <p className="auth-card__hello">
          <span className="auth-card__avatar" aria-hidden="true">
            {nickname?.[0] ?? '?'}
          </span>
          <span>
            <strong>{nickname}</strong>님, 반가워요!
            {username && <span className="auth-card__id">@{username}</span>}
          </span>
        </p>
        <p className="auth-card__note">게임 점수가 랭킹에 올라가요.</p>
        <div className="auth-card__actions">
          <button type="button" className="btn btn--primary" onClick={onPlay}>
            🎮 게임 하러 가기
          </button>
          <button type="button" className="btn btn--ghost" onClick={signOut}>
            로그아웃
          </button>
        </div>
      </section>
    );
  }

  const isSignUp = tab === 'signup';
  const update = (key) => (e) => {
    const value = key === 'username' ? e.target.value.toLowerCase() : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
  };
  const switchTab = (next) => {
    setTab(next);
    setMessage(null);
  };

  // 지금 칸의 값으로 중복 확인을 통과했는지
  const passed = (key) => checks[key]?.ok && checks[key].value === form[key].trim().toLowerCase();
  const runCheck = async (key) => {
    const value = form[key].trim().toLowerCase();
    setChecks((c) => ({ ...c, [key]: { value, ok: false, message: '확인하는 중…', pending: true } }));
    const res = await (key === 'username' ? checkUsername(form[key]) : checkNickname(form[key]));
    setChecks((c) => ({ ...c, [key]: { value, ...res } }));
  };
  const checkNote = (key) => {
    const c = checks[key];
    if (!c || c.value !== form[key].trim().toLowerCase()) return null;
    return (
      <span className={`auth-form__check ${c.pending ? '' : c.ok ? 'is-ok' : 'is-error'}`} role="status">
        {c.ok ? '✓ ' : ''}
        {c.message}
      </span>
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (isSignUp && (!passed('username') || !passed('nickname'))) {
      setMessage({ tone: 'error', text: '아이디와 닉네임 중복 확인을 해 주세요.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    const res = isSignUp ? await signUp(form) : await signIn(form.username, form.password);
    setBusy(false);
    if (res.error) setMessage({ tone: 'error', text: res.error });
  };

  return (
    <section className="auth-card" aria-label="로그인">
      <div className="auth-card__tabs" role="tablist" aria-label="로그인 · 회원가입">
        {[
          ['signin', '로그인'],
          ['signup', '회원가입'],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`auth-card__tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-form__field">
          <label htmlFor="auth-username">아이디</label>
          {isSignUp && <span className="auth-form__hint">{USERNAME_HINT}</span>}
          <div className="auth-form__row">
            <input
              id="auth-username"
              type="text"
              value={form.username}
              onChange={update('username')}
              placeholder={isSignUp ? '예: tadak_kim' : undefined}
              autoComplete="username"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={16}
              required
            />
            {isSignUp && (
              <button type="button" className="auth-form__check-btn" onClick={() => runCheck('username')}>
                중복 확인
              </button>
            )}
          </div>
          {isSignUp && checkNote('username')}
        </div>

        <div className="auth-form__field">
          <label htmlFor="auth-password">비밀번호</label>
          <input
            id="auth-password"
            type="password"
            value={form.password}
            onChange={update('password')}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            placeholder={isSignUp ? PASSWORD_HINT : undefined}
            minLength={isSignUp ? 8 : 6}
            required
          />
        </div>

        {isSignUp && (
          <>
            <div className="auth-form__field">
              <label htmlFor="auth-nickname">닉네임 · 랭킹에 보이는 이름</label>
              <span className="auth-form__hint">{NICKNAME_HINT}</span>
              <div className="auth-form__row">
                <input
                  id="auth-nickname"
                  type="text"
                  value={form.nickname}
                  onChange={update('nickname')}
                  placeholder="예: 타닥이"
                  autoComplete="nickname"
                  maxLength={12}
                  required
                />
                <button type="button" className="auth-form__check-btn" onClick={() => runCheck('nickname')}>
                  중복 확인
                </button>
              </div>
              {checkNote('nickname')}
            </div>

            <div className="auth-form__field">
              <label htmlFor="auth-email">
                이메일 <span className="auth-form__optional">선택</span>
              </label>
              <input
                id="auth-email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="예: tadak@example.com"
                autoComplete="email"
              />
            </div>
          </>
        )}

        {message && (
          <p className={`auth-form__message is-${message.tone}`} role={message.tone === 'error' ? 'alert' : 'status'}>
            {message.text}
          </p>
        )}

        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? '잠시만요…' : isSignUp ? '가입하기' : '로그인'}
        </button>
      </form>

      <p className="auth-card__note">로그인하지 않아도 연습 · 게임을 할 수 있어요. 로그인하면 게임 점수가 랭킹에 올라가요.</p>
    </section>
  );
}
