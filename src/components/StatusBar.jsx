import { formatTime } from '../utils/calculate';

const MAX_SEGMENTS = 12;

/** 실시간 타수 · 정확도 · 시간 · 진행도 카드 */
export default function StatusBar({ speed, accuracy, elapsed, current, total }) {
  return (
    <div className="status">
      <Stat label="타수" value={speed} unit="타/분" />
      <Stat label="정확도" value={accuracy} unit="%" />
      <Stat label="시간" value={formatTime(elapsed)} />

      <div className="stat">
        <span className="stat__label">진행</span>
        <span className="stat__value">
          {current}
          <small>/{total}</small>
        </span>
        {total <= MAX_SEGMENTS ? (
          <div className="progress" style={{ '--count': total }} aria-label={`${total}개 중 ${current}번째`}>
            {Array.from({ length: total }, (_, i) => (
              <span
                key={i}
                className={[
                  'progress__seg',
                  i < current - 1 && 'progress__seg--done',
                  i === current - 1 && 'progress__seg--now',
                ]
                  .filter(Boolean)
                  .join(' ')}
              />
            ))}
          </div>
        ) : (
          // 칸이 너무 많으면(낱말 · 자리 연습) 막대 하나로
          <div className="progress progress--bar" aria-label={`${total}개 중 ${current}번째`}>
            <span className="progress__fill" style={{ width: `${((current - 1) / total) * 100}%` }} />
          </div>
        )}
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
