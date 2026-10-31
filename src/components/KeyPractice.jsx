import { useEffect, useRef, useState } from 'react';
import StatusBar from './StatusBar';
import KeyboardView from './KeyboardView';
import useTimer from '../hooks/useTimer';
import { FINGER_NAME, STAGES, fingerOf, keyLabel, pickKeys } from '../data/keyboard';
import { calcAccuracy, calcSpeed } from '../utils/calculate';
import { playKey, playWrong } from '../utils/sound';

const UPCOMING = 8; // 다음에 칠 키를 몇 개까지 미리 보여줄지
const FLASH_MS = 300; // 누른 키를 맞음/틀림 색으로 보여주는 시간

/**
 * 자리 연습 — 화면 키보드에서 칠 키와 손가락을 짚어 준다.
 * 키는 물리 키 코드로 판정해서 한글 입력기 상태와 상관없이 동작하고,
 * 키보드가 없는 기기에서는 화면 키보드를 눌러도 된다.
 * 한 판이 끝나면 onFinish({ speed, accuracy, time })를 부른다.
 * 단계(stage)는 다시 하기 후에도 유지되도록 부모가 들고 있고, 바뀌면 부모가 새 판으로 다시 마운트한다.
 */
export default function KeyPractice({ mode, stage, disabled, onStageChange, onFinish, onRestart }) {
  const [keys] = useState(() => pickKeys(stage));
  const [pos, setPos] = useState(0);
  const [presses, setPresses] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flash, setFlash] = useState(null); // 방금 누른 키 { code, ok }
  const timer = useTimer();
  const padRef = useRef(null);

  const target = keys[pos];
  const finger = target ? fingerOf(target) : null;

  useEffect(() => {
    padRef.current?.focus();
  }, []);

  // 누른 키 표시는 잠깐만
  useEffect(() => {
    if (!flash) return undefined;
    const id = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [flash]);

  const press = (code) => {
    if (disabled || !target) return;
    // 화면 키보드를 눌렀을 때도 포커스를 패드로 되돌려 타이머가 멈춘 채 진행되지 않게
    padRef.current?.focus();
    timer.start();
    timer.resume();

    const ok = code === target;
    const nextCorrect = correct + (ok ? 1 : 0);
    const nextPresses = presses + 1;
    setPresses(nextPresses);
    setCorrect(nextCorrect);
    setFlash({ code, ok });
    if (ok) playKey();
    else playWrong();
    if (!ok) return;

    // 맞은 키만 다음으로 넘어간다
    const nextPos = pos + 1;
    setPos(nextPos);
    if (nextPos === keys.length) {
      const time = timer.stop();
      onFinish({
        speed: calcSpeed(nextCorrect, time, { final: true }),
        accuracy: calcAccuracy(nextCorrect, nextPresses),
        time,
      });
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onRestart();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (!e.code.startsWith('Key')) return; // 글자 키가 아닌 것(스페이스, 숫자 등)은 무시
    e.preventDefault();
    press(e.code);
  };

  return (
    <>
      <StatusBar
        speed={calcSpeed(correct, timer.elapsed)}
        accuracy={calcAccuracy(correct, presses)}
        elapsed={timer.elapsed}
        current={Math.min(pos + 1, keys.length)}
        total={keys.length}
      />

      <div className="stage-tabs" role="tablist" aria-label="자리 연습 단계">
        {STAGES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={stage === s.id}
            className={`stage-tabs__btn ${stage === s.id ? 'is-active' : ''}`}
            onClick={() => onStageChange(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <section
        ref={padRef}
        className="keypad"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onFocus={timer.resume}
        onBlur={timer.pause}
        aria-label={target ? `${keyLabel(target, mode)} 키를 누르세요` : '연습 끝'}
      >
        <div className="keypad__target">
          <span className={`keypad__char ${flash && !flash.ok ? 'is-wrong' : ''}`}>
            {target ? keyLabel(target, mode) : '✓'}
          </span>
          {finger && <span className={`keypad__finger finger-${finger}`}>{FINGER_NAME[finger]}</span>}
        </div>

        <p className="keypad__queue" aria-hidden="true">
          <span className="pill-label">다음</span>
          {keys.slice(pos + 1, pos + 1 + UPCOMING).map((code, i) => (
            <span key={`${pos}-${i}`}>{keyLabel(code, mode)}</span>
          ))}
        </p>

        <KeyboardView mode={mode} target={target} flash={flash} onPress={press} />
      </section>

      <footer className="hints">
        <span className="hints__keys">
          <span>
            <kbd>Esc</kbd> · <kbd>F5</kbd> 처음부터
          </span>
        </span>
        <span>손가락을 기본 자리(F · J 돌기)에 올려 두고 시작하세요</span>
      </footer>
    </>
  );
}
