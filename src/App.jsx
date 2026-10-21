import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TypingBoard from './components/TypingBoard';
import TypingInput from './components/TypingInput';
import StatusBar from './components/StatusBar';
import ResultModal from './components/ResultModal';
import useTimer from './hooks/useTimer';
import { pickSentences } from './data/sentences';
import { calcAccuracy, calcSpeed, compareInput } from './utils/calculate';
import { getBest, saveIfBest } from './utils/storage';

const MODES = [
  { id: 'ko', label: '한글' },
  { id: 'en', label: 'English' },
];

const EMPTY_TOTALS = { correctChars: 0, correctStrokes: 0, typedChars: 0 };

export default function App() {
  const [mode, setMode] = useState('ko');
  const [sentences, setSentences] = useState(() => pickSentences('ko'));
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [totals, setTotals] = useState(EMPTY_TOTALS); // 끝낸 문장들의 누적 통계
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(() => getBest('ko'));

  const timer = useTimer();
  const inputRef = useRef(null);
  const composingRef = useRef(false); // 이벤트 핸들러 안에서 최신 조합 상태를 읽기 위한 ref

  const target = sentences[index];

  // ─── 실시간 통계 ──────────────────────────────────────────────
  const current = useMemo(
    () => compareInput(target, input, isComposing),
    [target, input, isComposing],
  );
  const speed = calcSpeed(totals.correctStrokes + current.correctStrokes, timer.elapsed);
  const accuracy = calcAccuracy(
    totals.correctChars + current.correctChars,
    totals.typedChars + current.typedChars,
  );

  const focusInput = () => inputRef.current?.focus();

  // ─── 라운드 시작 / 리셋 ───────────────────────────────────────
  const resetRound = useCallback(
    (nextMode) => {
      setSentences(pickSentences(nextMode));
      setIndex(0);
      setInput('');
      setIsComposing(false);
      composingRef.current = false;
      setTotals(EMPTY_TOTALS);
      setResult(null);
      setBest(getBest(nextMode));
      timer.reset();
      setTimeout(focusInput, 0);
    },
    [timer],
  );

  useEffect(() => {
    focusInput();
  }, []);

  // ─── 문장 하나 완료 ───────────────────────────────────────────
  const completeSentence = (value) => {
    const stats = compareInput(target, value, false);
    const nextTotals = {
      correctChars: totals.correctChars + stats.correctChars,
      correctStrokes: totals.correctStrokes + stats.correctStrokes,
      typedChars: totals.typedChars + stats.typedChars,
    };
    setTotals(nextTotals);
    setInput('');

    const isLast = index + 1 >= sentences.length;
    if (!isLast) {
      setIndex(index + 1);
      return;
    }

    // 라운드 끝 → 결과 계산 & 최고 기록 저장
    const time = timer.stop();
    const record = {
      speed: calcSpeed(nextTotals.correctStrokes, time),
      accuracy: calcAccuracy(nextTotals.correctChars, nextTotals.typedChars),
      time,
    };
    const prevBest = getBest(mode);
    const isBest = saveIfBest(mode, record);
    if (isBest) setBest(getBest(mode));
    setResult({ ...record, isBest, prevBest });
  };

  // ─── 입력 처리 ────────────────────────────────────────────────
  const handleChange = (e) => {
    let value = e.target.value;
    const composing = composingRef.current || e.nativeEvent.isComposing;

    // 문장을 넘기자마자 습관적으로 누른 스페이스는 무시
    if (input === '' && value === ' ') return;

    // 조합 중이 아닐 때만 길이를 자른다 (조합 중에 값을 바꾸면 IME가 깨짐)
    if (!composing && value.length > target.length) value = value.slice(0, target.length);

    timer.start();
    setInput(value);

    // 마지막 글자까지 쳤고 조합이 끝났으면 다음 문장으로
    if (!composing && value.length === target.length) completeSentence(value);
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
    setIsComposing(true);
  };

  const handleCompositionEnd = (e) => {
    composingRef.current = false;
    setIsComposing(false);

    const value = e.target.value.slice(0, target.length);
    setInput(value);

    // 한글로 끝나는 문장: 마지막 글자 조합이 끝나는 순간 완료
    if (value.length === target.length) completeSentence(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      resetRound(mode);
      return;
    }

    // 조합 중 Enter는 compositionEnd에서 처리되므로 여기선 무시
    if (e.key === 'Enter' && !e.nativeEvent.isComposing && !composingRef.current) {
      e.preventDefault();
      if (input.length === target.length) completeSentence(input);
    }
  };

  const changeMode = (nextMode) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    resetRound(nextMode);
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">
          <span className="logo__mark">타</span>
          <span className="logo__text">타닥</span>
        </h1>

        <div className="mode-toggle" role="tablist" aria-label="언어 선택">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              className={`mode-toggle__btn ${mode === m.id ? 'is-active' : ''}`}
              onClick={() => changeMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      <main className="main">
        <StatusBar
          speed={speed}
          accuracy={accuracy}
          elapsed={timer.elapsed}
          current={index + 1}
          total={sentences.length}
        />

        <TypingBoard
          target={target}
          input={input}
          isComposing={isComposing}
          nextSentence={sentences[index + 1]}
          onClick={focusInput}
        />

        <TypingInput
          ref={inputRef}
          value={input}
          disabled={!!result}
          placeholder={timer.isRunning || index > 0 ? '' : '위 문장을 따라 입력하면 시작돼요'}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
        />

        <footer className="footer">
          <span>
            <kbd>Esc</kbd> 처음부터
          </span>
          <span>
            최고 기록{' '}
            <strong>{best ? `${best.speed}타 · ${best.accuracy}%` : '아직 없음'}</strong>
          </span>
        </footer>
      </main>

      {result && <ResultModal result={result} onRestart={() => resetRound(mode)} />}
    </div>
  );
}
