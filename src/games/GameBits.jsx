// 세 게임이 같이 쓰는 작은 화면 조각들
import { useEffect, useRef, useState } from 'react';
import { playKey } from '../utils/sound';

/** 하트 — 남은 목숨 */
export function Hearts({ count, max }) {
  return (
    <span className="hearts" aria-label={`목숨 ${count}개`}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`hearts__one ${i < count ? '' : 'is-lost'}`} aria-hidden="true">
          {i < count ? '❤️' : '🤍'}
        </span>
      ))}
    </span>
  );
}

/** 점수 팝업 "+35" — popups: [{ id, text, x, y, tone }] (x · y는 %) */
export function Popups({ popups }) {
  return popups.map((p) => (
    <span
      key={p.id}
      className={`popup ${p.tone ? `is-${p.tone}` : ''}`}
      style={{ left: `${p.x}%`, top: `${p.y}%` }}
      aria-hidden="true"
    >
      {p.text}
    </span>
  ));
}

/** 단계 · 라운드 전환 같은 큰 알림 */
export function Banner({ banner }) {
  if (!banner) return null;
  return (
    <div key={banner.id} className="banner" role="status">
      <span className="banner__title">{banner.title}</span>
      {banner.sub && <span className="banner__sub">{banner.sub}</span>}
    </div>
  );
}

/** 시작 화면에서 낱말 언어 고르기 */
export function LangPicker({ mode, onModeChange }) {
  return (
    <div className="lang-picker" role="group" aria-label="낱말 언어">
      <span className="lang-picker__label">낱말 언어</span>
      {[
        ['ko', '한글'],
        ['en', 'English'],
      ].map(([id, label]) => (
        <button
          key={id}
          type="button"
          className={`lang-picker__btn ${mode === id ? 'is-active' : ''}`}
          aria-pressed={mode === id}
          onClick={() => onModeChange(id)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

const POPUP_MS = 900;
const BANNER_MS = 1600;

/** 게임 상태(g)에 팝업 · 배너를 넣고 오래된 것을 치우는 도우미 */
export function addPopup(game, text, x, y, tone) {
  game.popups.push({ id: game.nextId++, text, x, y, tone, at: performance.now() });
}

export function showBanner(game, title, sub) {
  game.banner = { id: game.nextId++, title, sub, at: performance.now() };
}

export function pruneEffects(game) {
  const now = performance.now();
  game.popups = game.popups.filter((p) => now - p.at < POPUP_MS);
  if (game.banner && now - game.banner.at > BANNER_MS) game.banner = null;
}

/**
 * 게임 오버까지 얼마나 남았는지 — 무엇 때문에 끝나는지(label)와 막대(ratio: 0 안전 → 1 게임 오버)
 * 70%를 넘으면 빨갛게 깜빡인다 (hot을 주면 그 값을 따른다).
 */
export function DangerBar({ label, ratio, detail, hot }) {
  const value = Math.max(0, Math.min(1, ratio));
  const isHot = hot ?? value > 0.7;
  return (
    <div className={`danger ${isHot ? 'is-hot' : ''}`} role="status" aria-label={`${label} ${detail ?? ''}`}>
      <span className="danger__label">{label}</span>
      <span className="danger__bar">
        <span style={{ width: `${value * 100}%` }} />
      </span>
      {detail && <span className="danger__detail">{detail}</span>}
    </div>
  );
}

/** 시작 화면 규칙 — 아이콘 + 한 줄 [[icon, text], …] */
export function Rules({ rules }) {
  return (
    <ul className="rules">
      {rules.map(([icon, text]) => (
        <li key={text}>
          <span className="rules__icon" aria-hidden="true">
            {icon}
          </span>
          {text}
        </li>
      ))}
    </ul>
  );
}

const GUIDE_TABS = [
  ['intro', '게임 설명'],
  ['how', '플레이 방법'],
  ['items', '아이템'],
];

/**
 * 시작 화면 안내 — 게임 설명 | 플레이 방법 | 아이템 탭
 * intro: 설명 문단들, rules: [[icon, text], …], items: [{ title, list: [[icon, name, desc], …] }, …]
 */
export function GameGuide({ intro, rules, items }) {
  const [tab, setTab] = useState('intro');
  const move = (e) => {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const i = GUIDE_TABS.findIndex(([id]) => id === tab);
    setTab(GUIDE_TABS[(i + step + GUIDE_TABS.length) % GUIDE_TABS.length][0]);
  };

  return (
    <div className="guide">
      <div className="guide__tabs" role="tablist" aria-label="게임 안내" onKeyDown={move}>
        {GUIDE_TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`guide__tab ${tab === id ? 'is-active' : ''}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="guide__panel" role="tabpanel">
        {tab === 'intro' && intro.map((text) => <p key={text} className="guide__text">{text}</p>)}
        {tab === 'how' && <Rules rules={rules} />}
        {tab === 'items' &&
          items.map((group) => (
            <div key={group.title} className="guide__group">
              <p className="guide__group-title">{group.title}</p>
              <ul className="guide__items">
                {group.list.map(([icon, name, desc]) => (
                  <li key={name}>
                    <span className="guide__item-icon" aria-hidden="true">
                      {icon}
                    </span>
                    <strong>{name}</strong>
                    <span>{desc}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    </div>
  );
}

const COUNT_FROM = 3;
const COUNT_MS = 700;

/** 시작 전 3 · 2 · 1 — 끝나면 onDone */
export function Countdown({ onDone }) {
  const [n, setN] = useState(COUNT_FROM);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    if (n === 0) {
      const id = setTimeout(() => done.current(), COUNT_MS / 2);
      return () => clearTimeout(id);
    }
    playKey();
    const id = setTimeout(() => setN(n - 1), COUNT_MS);
    return () => clearTimeout(id);
  }, [n]);

  return (
    <div className="countdown" role="status" aria-live="assertive">
      <span key={n} className="countdown__num">
        {n === 0 ? '시작!' : n}
      </span>
    </div>
  );
}
