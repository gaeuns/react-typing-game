import { formatTime } from '../utils/calculate';

const TIME_STEP_MS = 5000; // 60초 연습 진행 칸 하나 = 5초

/**
 * 진행 칸 — 모든 연습이 같은 모양 (지난 칸 · 지금 칸 · 남은 칸).
 * 칸이 많으면(자리 30키 · 장문 30줄) 칸 사이를 좁혀 폰 폭에도 들어가게 한다.
 */
function Segments({ total, current, label }) {
  const gap = total <= 12 ? 4 : total <= 20 ? 2 : 1;
  return (
    <div className="progress" style={{ '--count': total, gap: `${gap}px` }} aria-label={label}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={['progress__seg', i < current && 'progress__seg--done', i === current && 'progress__seg--now']
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </div>
  );
}

/**
 * 실시간 타수 · 정확도 · 시간 · 진행도 카드
 * timeLimit이 있으면(60초 연습) 남은 시간과 끝낸 문장 수, 진행 칸은 5초에 한 칸씩.
 */
export default function StatusBar({ speed, accuracy, elapsed, current, total, timeLimit }) {
  if (timeLimit) {
    const remaining = Math.max(0, timeLimit - elapsed);
    const steps = Math.ceil(timeLimit / TIME_STEP_MS);
    return (
      <div className="status">
        <Stat label="타수" value={speed} unit="타/분" />
        <Stat label="정확도" value={accuracy} unit="%" />
        <Stat label="남은 시간" value={formatTime(Math.ceil(remaining / 1000) * 1000)} />
        <div className="stat stat--progress">
          <span className="stat__label">완료</span>
          <span className="stat__value">
            {current - 1}
            <small>문장</small>
          </span>
          <Segments
            total={steps}
            current={Math.min(steps, Math.floor(elapsed / TIME_STEP_MS))}
            label={`남은 시간 ${Math.ceil(remaining / 1000)}초`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="status">
      <Stat label="타수" value={speed} unit="타/분" />
      <Stat label="정확도" value={accuracy} unit="%" />
      <Stat label="시간" value={formatTime(elapsed)} />

      <div className="stat stat--progress">
        <span className="stat__label">진행</span>
        <span className="stat__value">
          {current}
          <small>/{total}</small>
        </span>
        <Segments total={total} current={current - 1} label={`${total}개 중 ${current}번째`} />
      </div>
    </div>
  );
}

function Stat({ label, value, unit }) {
  return (
    <div className="stat">
      <span className="stat__label">{label}</span>
      <span className="stat__value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
    </div>
  );
}
