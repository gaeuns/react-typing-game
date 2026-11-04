import { useEffect, useRef } from 'react';

/**
 * 타자 옆에서 같이 반응해 주는 마스코트 '타닥이' (말랑한 떡 모양).
 *
 * mood
 * - idle  : 아직 시작 전 — 눈을 깜빡이며 기다린다
 * - happy : 잘 치는 중 — 웃으면서 통통 튄다
 * - cheer : 연속으로 많이 맞힘 — 반짝이 + 만세
 * - sad   : 오타가 있음 — 시무룩, 눈물 한 방울과 먹구름
 *
 * beat: 키를 칠 때마다 바뀌는 값 (입력 길이 등) — 바뀌면 몸이 한 번 말랑하게 눌린다
 * wounds: 오타를 남긴 채 넘긴 문장 수 — 그만큼 반창고가 붙는다 (최대 MAX_WOUNDS개)
 * bubble: false면 말풍선 없이 캐릭터만 (결과 창 등)
 */
export const MAX_WOUNDS = 5;

// 반창고 자리 — 얼굴(눈 · 볼 · 입)은 피해서 머리 · 옆구리 · 아랫배에
const WOUND_SPOTS = [
  { x: 72, y: 50, r: 28 },
  { x: 34, y: 62, r: -24 },
  { x: 90, y: 94, r: -40 },
  { x: 30, y: 97, r: 22 },
  { x: 60, y: 103, r: 8 },
];
const LINES = {
  idle: '같이 쳐 볼까요?',
  happy: '좋아요!',
  cheer: '최고예요! ✨',
  sad: '앗… 틀렸어요',
};

export default function Mascot({ mood = 'idle', beat = 0, wounds = 0, bubble = true }) {
  const count = Math.min(wounds, MAX_WOUNDS);
  const squishRef = useRef(null);

  // 키를 칠 때마다 말랑 애니메이션을 처음부터 다시 — 다시 마운트하지 않아서 반창고 애니메이션은 붙을 때 한 번만
  useEffect(() => {
    const el = squishRef.current;
    if (!el || beat === 0) return;
    el.classList.remove('is-squish');
    void el.offsetWidth; // 리플로우를 일으켜야 같은 애니메이션이 다시 재생된다
    el.classList.add('is-squish');
  }, [beat]);

  const label = `마스코트: ${LINES[mood]}${count ? ` (반창고 ${count}개)` : ''}`;

  return (
    <div className={`mascot mascot--${mood} ${bubble ? '' : 'mascot--no-bubble'}`} role="img" aria-label={label}>
      {bubble && (
        <span className="mascot__bubble" key={mood} aria-hidden="true">
          {LINES[mood]}
        </span>
      )}

      <div className="mascot__squish" ref={squishRef}>
        <svg className="mascot__svg" viewBox="0 0 120 120" aria-hidden="true">
          {/* 먹구름 (sad) */}
          <g className="mascot__cloud">
            <ellipse cx="60" cy="14" rx="22" ry="9" />
            <ellipse cx="46" cy="16" rx="12" ry="8" />
            <ellipse cx="75" cy="17" rx="11" ry="7" />
            <line x1="50" y1="26" x2="48" y2="32" />
            <line x1="62" y1="27" x2="60" y2="33" />
            <line x1="72" y1="26" x2="70" y2="32" />
          </g>

          {/* 반짝이 (cheer) */}
          <g className="mascot__sparkles">
            <path d="M18 30 l3 -8 l3 8 l8 3 l-8 3 l-3 8 l-3 -8 l-8 -3 z" />
            <path d="M96 22 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" />
            <path d="M104 62 l2 -5 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 z" />
          </g>

          {/* 팔 */}
          <path className="mascot__arm mascot__arm--l" d="M26 78 q-12 -2 -14 -12" />
          <path className="mascot__arm mascot__arm--r" d="M94 78 q12 -2 14 -12" />

          {/* 몸 */}
          <ellipse className="mascot__shadow" cx="60" cy="112" rx="30" ry="4" />
          <path
            className="mascot__body"
            d="M60 38 C88 38 100 58 100 80 C100 100 84 108 60 108 C36 108 20 100 20 80 C20 58 32 38 60 38 Z"
          />
          <path className="mascot__shine" d="M36 58 q6 -10 18 -12" />

          {/* 볼 */}
          <ellipse className="mascot__cheek" cx="38" cy="84" rx="7" ry="4.5" />
          <ellipse className="mascot__cheek" cx="82" cy="84" rx="7" ry="4.5" />

          {/* 반창고 — 오타 낸 채로 넘긴 문장마다 하나씩 */}
          {WOUND_SPOTS.slice(0, count).map(({ x, y, r }, i) => (
            <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
              <g className="mascot__bandage">
                <rect x="-10" y="-3.5" width="20" height="7" rx="3.5" />
                <rect className="mascot__bandage-pad" x="-3.5" y="-3.5" width="7" height="7" />
                <circle cx="-7" cy="-1" r="0.7" />
                <circle cx="-7" cy="1.3" r="0.7" />
                <circle cx="7" cy="-1" r="0.7" />
                <circle cx="7" cy="1.3" r="0.7" />
              </g>
            </g>
          ))}

          {/* 눈 — 기분마다 하나만 보인다 */}
          <g className="mascot__eyes mascot__eyes--open">
            <ellipse cx="45" cy="74" rx="4.2" ry="5.2" />
            <ellipse cx="75" cy="74" rx="4.2" ry="5.2" />
            <circle className="mascot__glint" cx="46.5" cy="72" r="1.4" />
            <circle className="mascot__glint" cx="76.5" cy="72" r="1.4" />
          </g>
          <g className="mascot__eyes mascot__eyes--smile">
            <path d="M39 76 q6 -8 12 0" />
            <path d="M69 76 q6 -8 12 0" />
          </g>
          <g className="mascot__eyes mascot__eyes--sad">
            <path d="M39 70 l11 4" />
            <path d="M81 70 l-11 4" />
            <path d="M40 78 q5 4 10 0" />
            <path d="M70 78 q5 4 10 0" />
          </g>

          {/* 눈물 (sad) */}
          <path className="mascot__tear" d="M43 82 q-3 5 0 8 q3 -3 0 -8 z" />

          {/* 입 */}
          <path className="mascot__mouth mascot__mouth--idle" d="M55 86 q5 4 10 0" />
          <path className="mascot__mouth mascot__mouth--happy" d="M53 85 q7 9 14 0 z" />
          <path className="mascot__mouth mascot__mouth--sad" d="M54 92 q6 -6 12 0" />
        </svg>
      </div>
    </div>
  );
}
