/** 게임 상단 숫자 칸 — label 위, value 크게, sub(최고 점수 · 상대 이름 등)는 값 아래 작은 줄 */
export default function GameStat({ label, value, sub }) {
  return (
    <div className="game-stat">
      <span className="game-stat__label">{label}</span>
      <span className="game-stat__value">{value}</span>
      {sub && <span className="game-stat__sub">{sub}</span>}
    </div>
  );
}
