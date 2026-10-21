import { formatTime } from '../utils/calculate';

/** 한 라운드가 끝나면 뜨는 결과 화면 */
export default function ResultModal({ result, onRestart }) {
  const { speed, accuracy, time, isBest, prevBest } = result;
  const diff = prevBest ? speed - prevBest.speed : null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className="modal">
        {isBest && <div className="stamp">최고 기록</div>}

        <h2 id="result-title" className="modal__title">
          수고했어요!
        </h2>

        <div className="modal__hero">
          <span className="modal__speed">{speed}</span>
          <span className="modal__unit">타/분</span>
        </div>

        {diff !== null && (
          <p className={`modal__diff ${diff >= 0 ? 'is-up' : 'is-down'}`}>
            이전 최고 기록보다 {diff >= 0 ? `+${diff}` : diff}타
          </p>
        )}

        <dl className="modal__stats">
          <div>
            <dt>정확도</dt>
            <dd>{accuracy}%</dd>
          </div>
          <div>
            <dt>걸린 시간</dt>
            <dd>{formatTime(time)}</dd>
          </div>
        </dl>

        <button type="button" className="btn btn--primary" onClick={onRestart} autoFocus>
          다시 하기 <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
