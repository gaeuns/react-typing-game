// 메인 화면 그림 — 키보드 위로 "타" "닥" 키캡이 튀어 오르는 모습 (SVG, 색은 테마 변수를 따른다)

const ROWS = [
  { y: 150, x: 46, keys: ['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'] },
  { y: 186, x: 60, keys: ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'] },
  { y: 222, x: 78, keys: ['ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ'] },
];
const KEY_W = 34;
const KEY_GAP = 6;
const HOT = new Set(['ㅌ', 'ㅏ', 'ㄷ', 'ㄱ']); // "타닥"을 치는 키

export default function HomeIllustration() {
  return (
    <svg className="home-art" viewBox="0 0 480 300" role="img" aria-label="키보드를 두드리면 타, 닥 키캡이 튀어 오르는 그림">
      {/* 바닥 그림자 · 키보드 몸체 */}
      <ellipse className="home-art__shadow" cx="240" cy="282" rx="200" ry="12" />
      <rect className="home-art__body" x="28" y="128" width="424" height="146" rx="22" />
      <rect className="home-art__plate" x="40" y="140" width="400" height="124" rx="14" />

      {ROWS.map((row) =>
        row.keys.map((k, i) => {
          const x = row.x + i * (KEY_W + KEY_GAP);
          const hot = HOT.has(k);
          return (
            <g key={k} className={`home-art__key ${hot ? 'is-hot' : ''}`}>
              <rect x={x} y={row.y} width={KEY_W} height="30" rx="7" />
              <text x={x + KEY_W / 2} y={row.y + 20}>
                {k}
              </text>
            </g>
          );
        }),
      )}
      {/* 튀어 오르는 키캡 */}
      <g className="home-art__cap home-art__cap--a">
        <path className="home-art__trail" d="M150 120 q-6 -22 6 -40" />
        <rect x="112" y="24" width="76" height="68" rx="16" />
        <text x="150" y="70">
          타
        </text>
      </g>
      <g className="home-art__cap home-art__cap--b">
        <path className="home-art__trail" d="M300 118 q8 -20 -4 -36" />
        <rect x="262" y="40" width="76" height="68" rx="16" />
        <text x="300" y="86">
          닥
        </text>
      </g>

      {/* 반짝임 */}
      <g className="home-art__spark">
        <path d="M222 44 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 z" />
        <path d="M380 70 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" />
        <path d="M78 76 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 z" />
      </g>
    </svg>
  );
}
