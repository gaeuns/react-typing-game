// 세 게임이 같이 쓰는 작은 화면 조각들

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

/** 시작 화면 아이템 칩 — title 아래에 [[icon, text], …] */
export function ItemChips({ title, items }) {
  return (
    <div className="item-chips">
      <span className="item-chips__title">{title}</span>
      <div className="item-chips__list">
        {items.map(([icon, text]) => (
          <span key={text} className="item-chips__chip">
            {icon} {text}
          </span>
        ))}
      </div>
    </div>
  );
}
