import { useState } from 'react';
import { isSoundOn, setSoundOn } from '../utils/sound';

const MODES = [
  { id: 'ko', label: '한글' },
  { id: 'en', label: 'English' },
];

/**
 * 연습 · 게임 화면 공통 머리줄 — 최고 기록 칩 + 효과음 켜고 끄기 + 언어 토글.
 * 좁은 화면에선 사이드바가 숨으므로 메뉴 버튼과 로고를 여기서 보여준다.
 */
export default function ViewHeader({ bestLabel, bestText, mode, onModeChange, onOpenNav }) {
  const [sound, setSound] = useState(isSoundOn);

  const toggleSound = () => {
    setSoundOn(!sound);
    setSound(!sound);
  };

  return (
    <header className="header">
      <div className="header__start">
        <button type="button" className="menu-btn" onClick={onOpenNav} aria-label="메뉴 열기">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
        <p className="logo logo--compact">
          <span className="logo__mark">타</span>
          <span className="logo__text">타닥</span>
        </p>
      </div>

      <div className="header__actions">
        {bestLabel && (
          <span className="best-chip">
            {bestLabel} 최고 <strong>{bestText ?? '아직 없음'}</strong>
          </span>
        )}

        <button
          type="button"
          className={`sound-btn ${sound ? '' : 'is-off'}`}
          onMouseDown={(e) => e.preventDefault()} // 눌러도 입력창 포커스 그대로
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label="키 입력 효과음"
          title={sound ? '효과음 끄기' : '효과음 켜기'}
        >
          <span aria-hidden="true">{sound ? '🔊' : '🔇'}</span>
        </button>

        <div className="mode-toggle" role="tablist" aria-label="언어 선택">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`mode-toggle__btn ${mode === m.id ? 'is-active' : ''}`}
              onClick={() => onModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
