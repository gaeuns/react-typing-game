import { formatTime } from '../utils/calculate';

/** 실시간 타수 · 정확도 · 시간 · 진행도 */
export default function StatusBar({ speed, accuracy, elapsed, current, total }) {
  return (
    <div className="status">
      <Stat label="타수" value={speed} unit="타/분" />
      <Stat label="정확도" value={accuracy} unit="%" />
      <Stat label="시간" value={formatTime(elapsed)} />

      <div className="status__progress" aria-label={`${total}문장 중 ${current}번째`}>
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={[
              'dot',
              i < current - 1 && 'dot--done',
              i === current - 1 && 'dot--now',
            ]
              .filter(Boolean)
              .join(' ')}
          />
        ))}
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
