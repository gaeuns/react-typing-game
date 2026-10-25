import { useEffect, useMemo, useRef, useState } from 'react';
import TypingBoard from '../components/TypingBoard';
import TypingInput from '../components/TypingInput';
import StatusBar from '../components/StatusBar';
import ResultModal from '../components/ResultModal';
import KeyPractice from '../components/KeyPractice';
import KeyboardView from '../components/KeyboardView';
import ViewHeader from '../components/ViewHeader';
import useTimer from '../hooks/useTimer';
import { PRACTICE_KINDS, pickRound } from '../data/practice';
import { FINGER_NAME, STAGES, fingerOf, keyForStroke, keyLabel } from '../data/keyboard';
import { calcAccuracy, calcSpeed, compareInput } from '../utils/calculate';
import { isPrefix, toKeystrokes } from '../utils/hangul';
import { getBest, saveIfBest } from '../utils/storage';

const EMPTY_TOTALS = { correctChars: 0, correctStrokes: 0, typedChars: 0 };
const FLASH_MS = 300; // 누른 키를 맞음/틀림 색으로 보여주는 시간
// 사람이 낼 수 없는 속도 — 폰 추천 낱말 탭처럼 한 번에 낱말이 통째로 들어온 판은 최고 기록에 넣지 않는다
const MAX_PLAUSIBLE_SPEED = 2000;

const PLACEHOLDER = {
  words: '낱말을 따라 치면 시작돼요',
  short: '문장을 따라 치면 시작돼요',
  long: '첫 줄을 따라 치면 시작돼요',
};

// 최고 기록은 연습 종류 · 언어별로 따로 (자리 연습은 단계별로도) — 단문은 예전 저장 키(ko/en)를 그대로 쓴다
function bestKey(kind, mode, stage) {
  if (kind === 'short') return mode;
  if (kind === 'keys') return `keys-${stage}:${mode}`;
  return `${kind}:${mode}`;
}

const BACKSPACE = { code: 'Backspace', shift: false };
// 마지막 글자를 조합하는 중 — 스페이스(또는 Enter)로 확정하면 다음으로 넘어간다
const FINISH = { code: 'Space', shift: false, finish: true };

/**
 * 지금 눌러야 할 키 — 이미 틀린 글자가 있거나 조합이 엇나갔으면 Backspace,
 * 마지막 글자 조합만 남았으면 FINISH, 자판에 없는 글자면 null.
 */
function expectedKey(target, input, isComposing) {
  // 조합이 막 시작돼 입력값이 아직 비어 있는 순간엔 조합 중이 아닌 것으로 본다
  const composing = isComposing && input.length > 0;
  const committed = composing ? input.length - 1 : input.length;
  for (let i = 0; i < committed; i += 1) if (input[i] !== target[i]) return BACKSPACE;

  const expected = toKeystrokes(target.slice(committed));
  const typed = composing ? toKeystrokes(input.slice(committed)) : [];
  if (!isPrefix(typed, expected)) return BACKSPACE;

  const stroke = expected[typed.length];
  return stroke === undefined ? FINISH : keyForStroke(stroke);
}

/** 안내용 키 이름 — Shift가 필요하면 "Shift + F"처럼 (영문은 대문자로) */
function keyText({ code, shift }, mode) {
  const label = keyLabel(code, mode);
  if (!shift) return label;
  return `Shift + ${mode === 'en' && code.startsWith('Key') ? label.toUpperCase() : label}`;
}

/**
 * 타자 연습 화면 — 자리 · 낱말 · 단문 · 장문.
 * 언어(mode)는 게임 화면과 같이 쓰도록 바깥(App)이 들고 있다.
 */
export default function PracticeView({ mode, onModeChange, onOpenNav }) {
  const [kind, setKind] = useState('short'); // keys | words | short | long
  const [keyStage, setKeyStage] = useState(STAGES[0].id);
  const [round, setRound] = useState(() => pickRound('short', mode)); // { title, items }
  const [roundId, setRoundId] = useState(0); // 자리 연습을 새 판으로 다시 마운트할 때 올린다
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [totals, setTotals] = useState(EMPTY_TOTALS); // 끝낸 문장들의 누적 통계
  const [result, setResult] = useState(null);
  const [best, setBest] = useState(() => getBest(bestKey('short', mode, STAGES[0].id)));
  const [keyFlash, setKeyFlash] = useState(null); // 방금 누른 키 { code, ok }

  const timer = useTimer();
  const inputRef = useRef(null);
  const composingRef = useRef(false); // 이벤트 핸들러 안에서 최신 조합 상태를 읽기 위한 ref
  const advanceAfterCompose = useRef(false); // 마지막 글자를 조합하는 중에 스페이스 · Enter를 눌렀다

  const items = round.items;
  const target = items[index];

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

  const nextKey = useMemo(() => expectedKey(target, input, isComposing), [target, input, isComposing]);

  // 누른 키 표시는 잠깐만
  useEffect(() => {
    if (!keyFlash) return undefined;
    const id = setTimeout(() => setKeyFlash(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [keyFlash]);

  const focusInput = () => inputRef.current?.focus();

  // ─── 라운드 시작 / 리셋 ───────────────────────────────────────
  // 장문을 Esc · 다시 하기로 처음부터 하면 같은 작품 그대로, "다음"(excludeTitle)일 때만 다른 작품
  const resetRound = (nextMode = mode, nextKind = kind, { stage = keyStage, excludeTitle = null } = {}) => {
    const sameLong = nextKind === 'long' && kind === 'long' && nextMode === mode && !excludeTitle;
    setRound(sameLong ? round : pickRound(nextKind, nextMode, excludeTitle));
    setRoundId((id) => id + 1);
    setIndex(0);
    setInput('');
    setIsComposing(false);
    composingRef.current = false;
    setTotals(EMPTY_TOTALS);
    setResult(null);
    setKeyFlash(null);
    setBest(getBest(bestKey(nextKind, nextMode, stage)));
    timer.reset();
    setTimeout(focusInput, 0);
  };

  useEffect(() => {
    focusInput();
  }, []);

  // ─── 한 판 끝 → 결과 & 최고 기록 저장 (모든 연습 종류 공통) ───
  const finishRound = (record) => {
    const key = bestKey(kind, mode, keyStage);
    const prevBest = getBest(key);
    const implausible = record.speed > MAX_PLAUSIBLE_SPEED;
    const isBest = !implausible && saveIfBest(key, record);
    if (isBest) setBest(getBest(key));
    setResult({ ...record, isBest, prevBest, implausible });
  };

  // 결과 화면의 "다음" — 자리 연습은 다음 단계로, 그다음은 낱말 → 단문 → 장문 → 장문(다른 작품)
  const stageIndex = STAGES.findIndex((s) => s.id === keyStage);
  const next = (() => {
    if (kind === 'keys' && stageIndex < STAGES.length - 1) {
      const stage = STAGES[stageIndex + 1];
      return { kind: 'keys', stage: stage.id, label: `자리 연습 · ${stage.label}` };
    }
    if (kind === 'keys') return { kind: 'words', label: '낱말 연습' };
    if (kind === 'words') return { kind: 'short', label: '단문 연습' };
    if (kind === 'short') return { kind: 'long', label: '장문 연습' };
    return { kind: 'long', label: '장문 연습 · 다른 작품' };
  })();

  const goNext = () => {
    if (next.stage) setKeyStage(next.stage);
    setKind(next.kind);
    resetRound(mode, next.kind, {
      stage: next.stage ?? keyStage,
      excludeTitle: kind === 'long' ? round.title : null,
    });
  };

  // ─── 문장(낱말 · 줄) 하나 완료 ────────────────────────────────
  const completeSentence = (value) => {
    const stats = compareInput(target, value, false);
    const nextTotals = {
      correctChars: totals.correctChars + stats.correctChars,
      correctStrokes: totals.correctStrokes + stats.correctStrokes,
      typedChars: totals.typedChars + stats.typedChars,
    };
    setTotals(nextTotals);
    setInput('');

    const isLast = index + 1 >= items.length;
    if (!isLast) {
      setIndex(index + 1);
      return;
    }

    const time = timer.stop();
    finishRound({
      speed: calcSpeed(nextTotals.correctStrokes, time, { final: true }),
      accuracy: calcAccuracy(nextTotals.correctChars, nextTotals.typedChars),
      time,
    });
  };

  // ─── 입력 처리 ────────────────────────────────────────────────
  const handleChange = (e) => {
    let value = e.target.value;
    const composing = composingRef.current || e.nativeEvent.isComposing;

    // 문장을 넘기자마자 습관적으로 누른 스페이스는 무시
    if (input === '' && value === ' ') return;

    // 조합 중이 아닐 때만 길이를 자른다 (조합 중에 값을 바꾸면 IME가 깨짐)
    if (!composing && value.length > target.length) {
      // 다 친 뒤 입력기가 확정하며 넣은 스페이스 → 다음으로
      if (value[target.length] === ' ') {
        timer.start();
        completeSentence(value.slice(0, target.length));
        return;
      }
      value = value.slice(0, target.length);
    }

    timer.start();
    setInput(value);
    // 다 쳐도 바로 넘어가지 않는다 — 스페이스나 Enter를 눌러야 다음으로 (handleKeyDown)
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

    // 마지막 글자를 조합하던 중에 스페이스 · Enter를 눌렀으면 확정과 함께 다음으로
    if (advanceAfterCompose.current) {
      advanceAfterCompose.current = false;
      if (value.length === target.length) completeSentence(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      resetRound();
      return;
    }

    // 누른 키가 지금 눌러야 할 키였는지 바로 표시 (Shift · Ctrl 같은 보조키만 누른 건 제외)
    if (!e.repeat && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'HangulMode'].includes(e.key) && nextKey) {
      // 영문 대소문자는 CapsLock도 반영 (Shift와 CapsLock이 하나만 켜져 있으면 대문자)
      const isLetter = e.code.startsWith('Key');
      const shifted = mode === 'en' && isLetter ? e.shiftKey !== e.getModifierState('CapsLock') : e.shiftKey;
      let ok;
      if (nextKey.finish) ok = e.code === 'Space' || e.code === 'Enter';
      else if (nextKey === BACKSPACE) ok = e.code === 'Backspace';
      else ok = e.code === nextKey.code && shifted === nextKey.shift;
      setKeyFlash({ code: e.code, ok });
    }

    // 다 쳤으면 스페이스 · Enter로 다음 문장(낱말 · 줄)으로
    // 조합 중 keydown은 입력기에 따라 key가 'Process'로 오기도 해서 물리 키(code)도 본다
    const isAdvanceKey =
      e.key === 'Enter' || e.key === ' ' || ['Enter', 'NumpadEnter', 'Space'].includes(e.nativeEvent.code);
    if (!isAdvanceKey || input.length < target.length) return;
    if (e.nativeEvent.isComposing || composingRef.current) {
      advanceAfterCompose.current = true; // 조합이 끝나는 순간(compositionend) 넘어간다
      return;
    }
    e.preventDefault();
    completeSentence(input);
  };

  const changeMode = (nextMode) => {
    if (nextMode === mode) {
      focusInput();
      return;
    }
    onModeChange(nextMode);
    resetRound(nextMode, kind);
  };

  const changeKind = (nextKind) => {
    if (nextKind === kind) {
      focusInput();
      return;
    }
    setKind(nextKind);
    resetRound(mode, nextKind);
  };

  const changeKeyStage = (nextStage) => {
    setKeyStage(nextStage);
    resetRound(mode, kind, { stage: nextStage });
  };

  // 입력창에서 벗어나 있는 동안(다른 탭 등)은 타이머를 멈춰 타수가 깎이지 않게 한다
  const handleFocus = () => timer.resume();
  const handleBlur = () => timer.pause();

  const kindInfo = PRACTICE_KINDS.find((k) => k.id === kind);
  const resultTitle = kind === 'keys' ? `자리 연습 · ${STAGES[stageIndex].label}` : kindInfo.label;
  const nextFinger = nextKey ? fingerOf(nextKey.code) : null;

  return (
    <div className="app">
      <ViewHeader
        bestLabel={kind === 'keys' ? STAGES[stageIndex].label : kindInfo.label.replace(' 연습', '')}
        bestText={best ? `${best.speed}타 · ${best.accuracy}%` : null}
        mode={mode}
        onModeChange={changeMode}
        onOpenNav={onOpenNav}
      />

      <main className="practice" data-kind={kind}>
        <nav className="kind-tabs" role="tablist" aria-label="연습 종류">
          {PRACTICE_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              role="tab"
              aria-selected={kind === k.id}
              className={`kind-tabs__btn ${kind === k.id ? 'is-active' : ''}`}
              onClick={() => changeKind(k.id)}
            >
              {k.label}
            </button>
          ))}
        </nav>

        {kind === 'keys' ? (
          <KeyPractice
            key={`${roundId}-${mode}-${keyStage}`}
            mode={mode}
            stage={keyStage}
            disabled={!!result}
            onStageChange={changeKeyStage}
            onFinish={finishRound}
            onRestart={() => resetRound()}
          />
        ) : (
          <>
            <StatusBar
              speed={speed}
              accuracy={accuracy}
              elapsed={timer.elapsed}
              current={index + 1}
              total={items.length}
            />

            <TypingBoard
              target={target}
              input={input}
              isComposing={isComposing}
              title={round.title}
              upcoming={items.slice(index + 1, index + 1 + (kind === 'words' ? 5 : kind === 'long' ? 2 : 1))}
              upcomingLayout={kind === 'words' ? 'inline' : 'lines'}
              onClick={focusInput}
            />

            <TypingInput
              ref={inputRef}
              value={input}
              disabled={!!result}
              placeholder={timer.isRunning || index > 0 ? '' : PLACEHOLDER[kind]}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onFocus={handleFocus}
              onBlur={handleBlur}
            />

            <section className="key-guide" aria-live="polite">
              <p className={`key-guide__hint ${nextKey === BACKSPACE ? 'is-wrong' : ''}`}>
                {nextKey === BACKSPACE ? (
                  <>
                    <span className="key-guide__long">
                      틀렸어요 — <kbd>⌫</kbd> 백스페이스로 지우고 다시 쳐 보세요
                    </span>
                    <span className="key-guide__short">
                      틀렸어요 — <kbd>⌫</kbd>로 지우기
                    </span>
                  </>
                ) : nextKey?.finish ? (
                  <>
                    <span className="key-guide__long">
                      <kbd>스페이스</kbd> 또는 <kbd>Enter</kbd>를 누르면 다음 {kindInfo.unit}
                    </span>
                    <span className="key-guide__short">
                      <kbd>스페이스</kbd> → 다음
                    </span>
                  </>
                ) : nextKey ? (
                  <>
                    다음 키 <strong>{keyText(nextKey, mode)}</strong>
                    {nextFinger && <span className={`key-guide__finger finger-${nextFinger}`}>{FINGER_NAME[nextFinger]}</span>}
                  </>
                ) : (
                  '자판에 없는 글자예요 — 그대로 입력해 주세요'
                )}
              </p>
              <KeyboardView mode={mode} target={nextKey?.code} shift={nextKey?.shift} flash={keyFlash} />
            </section>

            <footer className="hints">
              <span className="hints__keys">
                <span>
                  <kbd>Esc</kbd> 처음부터
                </span>
                <span>
                  <kbd>Space</kbd> · <kbd>Enter</kbd> 다음 {kindInfo.unit}
                </span>
              </span>
              <span>누른 키가 맞으면 초록, 틀리면 빨강으로 바로 표시돼요</span>
            </footer>
          </>
        )}
      </main>

      {result && (
        <ResultModal
          result={result}
          title={resultTitle}
          nextLabel={next.label}
          onRestart={() => resetRound()}
          onNext={goNext}
        />
      )}
    </div>
  );
}
