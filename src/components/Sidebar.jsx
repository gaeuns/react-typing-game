import { useEffect } from 'react';
import { GAMES } from '../data/games';
import { useAuth } from '../hooks/useAuth';

/**
 * 왼쪽 메뉴 — 홈 / 타자 연습 / 타자 게임(목록 · 게임 3종), 맨 아래 내 계정(닉네임 · 로그아웃).
 * 넓은 화면에선 늘 보이고, 좁은 화면에선 메뉴 버튼으로 여는 서랍(open)이 된다.
 */
export default function Sidebar({ view, game, onNavigate, open, onClose }) {
  const { configured, user, nickname, signOut } = useAuth();

  // 서랍이 열려 있으면 Esc로 닫기
  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const item = (key, label, icon, isActive, target) => (
    <button
      key={key}
      type="button"
      className={`nav-item ${isActive ? 'is-active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onNavigate(target)}
    >
      <span className="nav-item__icon" aria-hidden="true">
        {icon}
      </span>
      {label}
    </button>
  );

  return (
    <>
      {open && <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />}
      <nav className={`sidebar ${open ? 'is-open' : ''}`} aria-label="메뉴">
        <p className="logo sidebar__logo">
          <span className="logo__mark">타</span>
          <span className="logo__text">타닥</span>
        </p>

        {item('home', '홈', '🏠', view === 'home', { view: 'home' })}

        <p className="sidebar__section">연습</p>
        {item('practice', '타자 연습', '⌨️', view === 'practice', { view: 'practice' })}

        <p className="sidebar__section">게임</p>
        {item('lobby', '게임 목록', '🎮', view === 'game' && !game, { view: 'game', game: null })}
        {GAMES.map((g) => item(g.id, g.name, g.icon, view === 'game' && game === g.id, { view: 'game', game: g.id }))}

        {configured && (
          <div className="sidebar__account">
            {user ? (
              <>
                <p className="sidebar__user">
                  <span className="sidebar__avatar" aria-hidden="true">
                    {nickname?.[0] ?? '?'}
                  </span>
                  <span className="sidebar__nickname">{nickname}</span>
                </p>
                <button type="button" className="sidebar__logout" onClick={signOut}>
                  로그아웃
                </button>
              </>
            ) : (
              <button type="button" className="sidebar__login" onClick={() => onNavigate({ view: 'home' })}>
                🔑 로그인
              </button>
            )}
          </div>
        )}
      </nav>
    </>
  );
}
