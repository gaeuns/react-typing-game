import { useEffect, useRef } from 'react';
import { formatTime } from '../utils/calculate';

/**
 * 한 판이 끝나면 뜨는 결과 화면 — 모든 연습 종류가 같이 쓴다.
 * Enter: 다음 연습으로 / Esc: 같은 연습 다시 하기
 *
 * 버튼에 autoFocus를 주지 않는다 — 판을 끝내자마자 습관적으로 친 Space가 버튼을 눌러
 * 결과를 못 보고 넘어가 버리기 때문. 대신 창 자체에 포커스를 두고 Enter · Esc만 받는다.
 */
const KEY_GUARD_MS = 400; // 뜨자마자 들어온 키(마지막 글자 확정용 Enter 등)는 무시

export default function ResultModal({ result, title, nextLabel, onRestart, onNext }) {
  const { speed, accuracy, time, isBest, prevBest, implausible } = result;
  const diff = prevBest ? speed - prevBest.speed : null;

  const dialogRef = useRef(null);
  const openedAt = useRef(Date.now());

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onRestart();
        return;
      }
      // 버튼에 포커스가 있으면 버튼이 알아서 처리한다
      if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
      e.preventDefault();
      if (e.repeat || e.isComposing || Date.now() - openedAt.current < KEY_GUARD_MS) return;
      onNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart, onNext]);

  return (
    <div className="modal-backdrop">
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        tabIndex={-1}
      >
        {isBest && <div className="stamp">최고 기록</div>}

        <div>
          <p className="modal__kind">{title} 완료</p>
          <h2 id="result-title" className="modal__title">
            수고했어요!
          </h2>
          <div className="modal__hero">
            <span className="modal__speed">{speed}</span>
            <span className="modal__unit">타/분</span>
          </div>
          {implausible && (
            <p className="modal__note">사람이 칠 수 없는 속도라 최고 기록에는 저장하지 않았어요.</p>
          )}
          {!implausible && diff !== null && (
            <p className={`modal__diff ${diff >= 0 ? 'is-up' : 'is-down'}`}>
              이전 최고 기록보다 {diff >= 0 ? `+${diff}` : diff}타
            </p>
          )}
        </div>

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

        <div className="modal__actions">
          <button type="button" className="btn btn--ghost" onClick={onRestart}>
            다시 하기 <kbd>Esc</kbd>
          </button>
          <button type="button" className="btn btn--primary" onClick={onNext}>
            다음: {nextLabel} <kbd>Enter</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}
