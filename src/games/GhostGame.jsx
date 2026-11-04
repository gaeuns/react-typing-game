import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import GameStat from './GameStat';
import { Banner, Countdown, GameGuide, LangPicker, showBanner, pruneEffects } from './GameBits';
import useGameLoop from './useGameLoop';
import Mascot from '../components/Mascot';
import TypingBoard from '../components/TypingBoard';
import { pickSentences } from '../data/sentences';
import { calcSpeed, countStrokes } from '../utils/calculate';
import { isPrefix, toKeystrokes } from '../utils/hangul';
import { AUTO_LANG, applyKey } from '../utils/hangulInput';
import { getBest, getGameBest, getGhost, saveGameBest, saveGhost } from '../utils/storage';
import { playKey } from '../utils/sound';

const COURSE_SENTENCES = 3; // 한 판에 달리는 문장 수
const TRACE_STEP = 0.25; // 유령 기록 간격(초)
const DEFAULT_GHOST_SPEED = 150; // 기록이 하나도 없을 때 유령 타수 (GHOST_PACE를 곱하기 전)
const GHOST_PACE = 1.1; // 유령은 기록보다 10% 빠르게 달린다 — 내 최고 기록과 똑같으면 이기기 너무 쉬워서
const MAX_PLAUSIBLE_SPEED = 2000; // 이보다 빠르면 유령으로 저장하지 않는다 (낱말이 통째로 들어온 판)

const sentenceStrokes = (text) => [...text].reduce((sum, c) => sum + countStrokes(c), 0);

/**
 * 오타 전까지 바르게 친 타수 — 틀린 글자가 있으면 거기서 멈춘다 (고쳐야 다시 나아간다)
 * 조합 중인 마지막 글자는 목표대로 가고 있으면 누른 자모만큼 센다.
 */
function progressOf(target, input, composing) {
  const judged = composing && input ? input.length - 1 : input.length;
  let strokes = 0;
  for (let i = 0; i < judged; i += 1) {
    if (input[i] !== target[i]) return { strokes, typo: true };
    strokes += countStrokes(target[i]);
  }
  if (composing && input) {
    const typed = toKeystrokes(input[judged]);
    if (!isPrefix(typed, toKeystrokes(target.slice(judged, judged + 2)))) return { strokes, typo: true };
    strokes += typed.length;
  }
  return { strokes, typo: false };
}

const SMOOTH_SAMPLES = 2; // 앞뒤로 이만큼(×TRACE_STEP초)씩 평균
const STEADY_SHARE = 0.4; // 유령 움직임 중 고른 속도의 몫 — 기록이 멈춘 곳에서도 이 비율만큼은 계속 간다

/**
 * 기록을 1초 폭으로 고르게 — 잠깐 멈칫한 곳에서도 유령이 멈췄다 튀지 않고 계속 나아가게.
 * 출발(0타)과 도착(마지막 타수)은 그대로 둔다.
 */
function smoothTrace(trace) {
  if (!trace?.length) return trace;
  const last = trace.length - 1;
  return trace.map((value, i) => {
    if (i === 0 || i === last) return value;
    const from = Math.max(0, i - SMOOTH_SAMPLES);
    const to = Math.min(last, i + SMOOTH_SAMPLES);
    let sum = 0;
    for (let k = from; k <= to; k += 1) sum += trace[k];
    return sum / (to - from + 1);
  });
}

/**
 * 이번 판 유령 —고스트 레이스에서 낸 내 최고 기록(움직임 그대로)과 단문 연습 최고 타수 중 빠른 쪽.
 * 둘 다 없으면 기본 유령. 어느 쪽이든 GHOST_PACE만큼 빠르게 (speed는 빨라진 타수)
 */
function chooseGhost(mode) {
  const own = getGhost(mode);
  const practice = getBest(mode);
  const paced = (speed) => Math.round(speed * GHOST_PACE);
  if (own && (!practice || own.speed >= practice.speed)) {
    return { trace: smoothTrace(own.trace), speed: paced(own.speed), source: '고스트 레이스 내 최고 기록' };
  }
  if (practice) return { speed: paced(practice.speed), trace: null, source: '단문 연습 내 최고 기록' };
  return { speed: paced(DEFAULT_GHOST_SPEED), trace: null, source: '아직 기록이 없어 기본 유령' };
}

/** 기록(trace)을 GHOST_PACE배 빨리 감아 t초에 친 타수 — 기록이 끝나면 평균 속도로 이어 간다 */
function replayAt(ghost, t) {
  const rate = ghost.speed / 60;
  const { trace } = ghost;
  const i = (t * GHOST_PACE) / TRACE_STEP;
  const last = trace.length - 1;
  if (i >= last) return trace[last] + rate * (t - (last * TRACE_STEP) / GHOST_PACE);
  const k = Math.floor(i);
  return trace[k] + (trace[k + 1] - trace[k]) * (i - k);
}

/**
 * t초에 유령이 친 타수 — 기록이 없으면 고른 속도로.
 * 기록이 있으면 기록대로(멈칫 · 빨라짐) 달리되 고른 속도를 STEADY_SHARE만큼 섞어서, 내가 오래 멈췄던 곳에서도
 * 유령은 멈추지 않고 계속 나아간다. 평균 속도가 같으니 도착 시각은 그대로.
 */
function ghostStrokesAt(ghost, t) {
  const steady = (ghost.speed / 60) * t;
  if (!ghost.trace?.length) return steady;
  return replayAt(ghost, t) * (1 - STEADY_SHARE) + steady * STEADY_SHARE;
}

/** 유령이 total타를 다 치는 시각(초) */
function ghostFinishTime(ghost, total) {
  let t = 0;
  while (ghostStrokesAt(ghost, t) < total && t < 900) t += 0.02;
  return t;
}

const freshGame = (mode) => {
  const course = pickSentences(mode, COURSE_SENTENCES);
  const strokes = course.map(sentenceStrokes);
  return {
    course,
    strokes,
    total: strokes.reduce((a, b) => a + b, 0),
    ghost: chooseGhost(mode),
    index: 0,
    done: 0, // 끝낸 문장들의 타수
    mine: 0, // 지금까지 바르게 친 타수 (끝낸 문장 + 치는 중)
    clock: 0,
    trace: [0],
    ghostDoneAt: null, // 유령이 결승선에 닿은 시각
    popups: [],
    banner: null,
    nextId: 1,
    over: false,
  };
};

/**
 * 고스트 레이스 — 같은 문장을 내 최고 기록 '유령'과 나란히 달리며 친다.
 * 진행 막대 두 개 위에 타닥이(나)와 반투명 타닥이(유령)가 올라가 달린다.
 * 유령보다 먼저 도착하면 승리, 더 빠르면 이번 판이 다음 유령이 된다.
 */
export default function GhostGame({ mode, autoStart, onModeChange, onExit }) {
  const [status, setStatus] = useState('ready'); // ready | countdown | playing | paused | over
  const [input, setInput] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  const g = useRef(null);
  if (g.current === null) g.current = freshGame(mode);
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const composingRef = useRef(false);
  const advanceAfterCompose = useRef(false);
  const bestKey = `ghost:${mode}`;
  const [best, setBest] = useState(() => getGameBest(bestKey));

  const game = g.current;
  const target = game.course[game.index] ?? '';
  const progress = progressOf(target, input, isComposing);
  game.mine = game.done + progress.strokes;

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const resetInput = () => {
    setInput('');
    setIsComposing(false);
    composingRef.current = false;
    advanceAfterCompose.current = false;
  };

  const start = () => {
    g.current = freshGame(mode);
    resetInput();
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    setStatus('playing');
    focusInput();
  };

  useEffect(() => {
    if (autoStart) start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = () => {
    setStatus('playing');
    focusInput();
  };

  const finish = () => {
    if (game.over) return;
    game.over = true;
    const time = game.clock;
    const speed = calcSpeed(game.total, time * 1000, { final: true });
    const ghostTime = ghostFinishTime(game.ghost, game.total);
    const win = time < ghostTime;
    const plausible = speed <= MAX_PLAUSIBLE_SPEED;
    const trace = [...game.trace, game.total];
    const newGhost = plausible && saveGhost(mode, { speed, time, strokes: game.total, trace });
    const prev = getGameBest(bestKey);
    const isBest = plausible && saveGameBest(bestKey, { score: speed, level: COURSE_SENTENCES });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ time, speed, ghostTime, ghostSpeed: game.ghost.speed, win, newGhost, isBest, prev, plausible });
    setStatus('over');
  };

  useGameLoop((dt) => {
    game.clock += dt;
    // 유령 기록 — TRACE_STEP초마다 그때까지 바르게 친 타수
    while (game.trace.length * TRACE_STEP <= game.clock) game.trace.push(game.mine);
    if (game.ghostDoneAt === null && ghostStrokesAt(game.ghost, game.clock) >= game.total) {
      game.ghostDoneAt = game.clock;
      showBanner(game, '👻 유령 도착!', '끝까지 달려서 기록을 남겨요');
    }
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  // ─── 입력 — 타자 연습과 같은 방식: 문장을 다 치고 스페이스 · Enter로 다음 ───
  const tryAdvance = (value) => {
    if (value !== target) {
      setIsMiss(true); // 오타를 고쳐야 넘어간다
      return;
    }
    game.done += game.strokes[game.index];
    resetInput();
    if (game.index + 1 >= game.course.length) {
      game.mine = game.total;
      finish();
      return;
    }
    game.index += 1;
    rerender();
  };

  const handleChange = (e) => {
    if (status !== 'playing') return;
    let { value } = e.target;
    const composing = composingRef.current || e.nativeEvent.isComposing;
    if (input === '' && value === ' ') return; // 문장을 넘기자마자 습관적으로 누른 스페이스
    if (!composing && value.length > target.length) {
      if (value[target.length] === ' ') {
        tryAdvance(value.slice(0, target.length));
        return;
      }
      value = value.slice(0, target.length);
    }
    setInput(value);
  };

  const handleCompositionStart = () => {
    composingRef.current = true;
    setIsComposing(true);
  };

  const handleCompositionEnd = (e) => {
    composingRef.current = false;
    setIsComposing(false);
    if (status !== 'playing') return;
    const value = e.target.value.slice(0, target.length);
    setInput(value);
    if (advanceAfterCompose.current) {
      advanceAfterCompose.current = false;
      if (value.length === target.length) tryAdvance(value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (status === 'playing') setStatus('paused');
      return;
    }
    if (status !== 'playing') return;
    if (!e.repeat && !['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'HangulMode'].includes(e.key)) playKey();
    const isAdvanceKey =
      e.key === 'Enter' || e.key === ' ' || ['Enter', 'NumpadEnter', 'Space'].includes(e.nativeEvent.code);
    if (AUTO_LANG) {
      if (isAdvanceKey && input.length >= target.length) {
        e.preventDefault();
        tryAdvance(input);
        return;
      }
      if (['Enter', 'NumpadEnter'].includes(e.nativeEvent.code)) return;
      const next = applyKey(input, composingRef.current, e.nativeEvent, mode);
      if (!next) return;
      e.preventDefault();
      if (input === '' && next.text === ' ') return;
      if (next.text.length > target.length) return;
      composingRef.current = next.composing;
      setIsComposing(next.composing);
      setInput(next.text);
      return;
    }
    if (!isAdvanceKey || input.length < target.length) return;
    if (e.nativeEvent.isComposing || composingRef.current) {
      advanceAfterCompose.current = true;
      return;
    }
    e.preventDefault();
    tryAdvance(input);
  };

  // ─── 화면 ───
  const ghostStrokes = Math.min(game.total, ghostStrokesAt(game.ghost, game.clock));
  const myRatio = game.total ? game.mine / game.total : 0;
  const ghostRatio = game.total ? ghostStrokes / game.total : 0;
  const gap = Math.round(game.mine - ghostStrokes);
  const racing = status === 'playing' || status === 'paused';
  const speed = calcSpeed(game.mine, game.clock * 1000);
  let mood = 'idle';
  if (racing && progress.typo) mood = 'sad';
  else if (racing && gap > 20) mood = 'cheer';
  else if (racing) mood = 'happy';

  const lane = (who, ratio, label, detail, children) => (
    <div className={`race-lane is-${who}`}>
      <span className="race-lane__label">{label}</span>
      <div className="race-lane__track">
        <span className="race-lane__fill" style={{ width: `${ratio * 100}%` }} />
        <span className="race-lane__runner" style={{ left: `${ratio * 100}%` }}>
          {children}
        </span>
        <span className="race-lane__goal" aria-hidden="true">
          🏁
        </span>
      </div>
      <span className="race-lane__detail">{detail}</span>
    </div>
  );

  return (
    <div className="game">
      <div className="game__hud">
        <GameStat label="시간" value={`${game.clock.toFixed(1)}초`} />
        <GameStat label="지금 타수" value={racing ? speed : 0} sub={`최고 ${best ? best.score : 0}타`} />
        <GameStat label="유령" value={`${game.ghost.speed}타`} sub={game.ghost.source} />
        <GameStat label="문장" value={`${Math.min(game.index + 1, COURSE_SENTENCES)}/${COURSE_SENTENCES}`} />
      </div>

      <div className="game__field race-field">
        <div className="race" role="group" aria-label="경주 진행">
          {lane(
            'me',
            myRatio,
            '나',
            `${Math.round(myRatio * 100)}%`,
            <Mascot mood={mood} beat={input.length} bubble={false} />,
          )}
          {lane(
            'ghost',
            ghostRatio,
            '유령',
            `${Math.round(ghostRatio * 100)}%`,
            <Mascot mood="idle" bubble={false} />,
          )}
        </div>
        <p className={`race-gap ${gap >= 0 ? 'is-ahead' : 'is-behind'}`} role="status">
          {!racing
            ? '같은 문장을 유령과 나란히 달려요'
            : game.ghostDoneAt !== null
              ? `👻 유령은 ${game.ghostDoneAt.toFixed(1)}초에 도착했어요 · 끝까지!`
              : gap === 0
                ? '나란히 달리는 중!'
                : gap > 0
                  ? `유령보다 ${gap}타 앞서요 🏃`
                  : `유령보다 ${-gap}타 뒤처졌어요 💨`}
        </p>
        <Banner banner={game.banner} />
      </div>

      <TypingBoard
        target={target}
        input={input}
        isComposing={isComposing}
        upcoming={game.course.slice(game.index + 1)}
        onClick={focusInput}
      />

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          value={input}
          placeholder={mode === 'ko' ? '문장을 따라 치고 스페이스 · Enter' : 'Type the sentence + Space / Enter'}
          aria-label="문장 입력"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionEnd={handleCompositionEnd}
          onBlur={() => status === 'playing' && setStatus('paused')}
          readOnly={AUTO_LANG}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          onPaste={(e) => e.preventDefault()}
          onDrop={(e) => e.preventDefault()}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="👻 고스트 레이스"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              '내 최고 기록이 유령이 되어 같은 문장을 나란히 달려요. 반투명 타닥이를 따라잡아 보세요!',
              `이번 유령: ${game.ghost.source} ${game.ghost.speed}타`,
            ]}
            rules={[
              ['⌨️', `문장 ${COURSE_SENTENCES}개를 차례로 치고 스페이스 · Enter로 다음 문장`],
              ['✏️', '오타가 있으면 막대가 멈춰요 — 고쳐야 다시 나아가요'],
              ['🏁', '유령보다 먼저 결승선에 닿으면 승리'],
              ['👻', '더 빠르게 달리면 이번 판이 다음 판의 유령이 돼요'],
            ]}
            items={[
              {
                title: '유령은 누구?',
                list: [
                  ['👻', '레이스 기록', '고스트 레이스 최고 기록 — 그때 멈칫한 곳까지 그대로 따라 해요'],
                  ['📝', '단문 연습', '레이스 기록이 없으면 단문 연습 최고 타수로 고르게 달려요'],
                  ['🐢', '기본 유령', `기록이 하나도 없으면 ${Math.round(DEFAULT_GHOST_SPEED * GHOST_PACE)}타로 달려요`],
                  ['⚡', '살짝 더 빠르게', `유령은 기록보다 ${Math.round((GHOST_PACE - 1) * 100)}% 빨리 달려요`],
                ],
              },
            ]}
          />
          <LangPicker mode={mode} onModeChange={onModeChange} />
        </GameOverlay>
      )}
      {status === 'countdown' && <Countdown onDone={begin} />}
      {status === 'paused' && (
        <GameOverlay
          title="일시정지"
          primary={{ label: '계속하기', onClick: resume }}
          secondary={{ label: '그만하기', onClick: onExit }}
        >
          <p>유령도 같이 멈췄어요. 준비되면 계속하세요.</p>
        </GameOverlay>
      )}
      {status === 'over' && result && (
        <GameOverlay
          title={result.win ? '🏆 유령을 이겼어요!' : '👻 유령이 더 빨랐어요'}
          tone={result.win ? null : 'over'}
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <p className="game-overlay__score">{result.speed}타</p>
          <p>
            나 {result.time.toFixed(1)}초 · 유령 {result.ghostTime.toFixed(1)}초 (
            {result.win ? `${(result.ghostTime - result.time).toFixed(1)}초 먼저` : `${(result.time - result.ghostTime).toFixed(1)}초 늦게`})
          </p>
          {result.newGhost && <p className="game-overlay__best">👻 이번 판이 새 유령이 됐어요!</p>}
          {!result.plausible && <p>너무 빨라서 기록에 넣지 않았어요</p>}
          {!result.isBest && result.prev && <p>최고 기록 {result.prev.score}타</p>}
          <RankNote game="ghost" mode={mode} score={result.plausible ? result.speed : 0} level={COURSE_SENTENCES} />
        </GameOverlay>
      )}
    </div>
  );
}
