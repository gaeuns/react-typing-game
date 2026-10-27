import { useEffect, useRef } from 'react';

const KEY_GUARD_MS = 400; // 뜨자마자 들어온 키(게임 중 치던 Enter · 스페이스)는 무시

/**
 * 게임 위에 덮는 안내 창 — 시작 전 · 일시정지 · 게임 오버 · 라운드 결과에 같이 쓴다.
 * Enter: primary / Esc: secondary (있으면)
 */
export default function GameOverlay({ title, children, primary, secondary, tone }) {
  const openedAt = useRef(Date.now());

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.repeat || e.isComposing || Date.now() - openedAt.current < KEY_GUARD_MS) return;
      if (e.key === 'Enter' && primary) {
        e.preventDefault();
        primary.onClick();
      } else if (e.key === 'Escape' && secondary) {
        e.preventDefault();
        secondary.onClick();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [primary, secondary]);

  return (
    <div className="game-overlay">
      <div className={`game-overlay__card ${tone ? `is-${tone}` : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="game-overlay__title">{title}</h2>
        <div className="game-overlay__body">{children}</div>
        <div className="game-overlay__actions">
          {secondary && (
            <button type="button" className="btn btn--ghost" onClick={secondary.onClick}>
              {secondary.label} <kbd>Esc</kbd>
            </button>
          )}
          {primary && (
            <button type="button" className="btn btn--primary" onClick={primary.onClick}>
              {primary.label} <kbd>Enter</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
