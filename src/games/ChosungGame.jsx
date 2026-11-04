import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import GameStat from './GameStat';
import { Banner, Countdown, DangerBar, GameGuide, Popups, addPopup, pruneEffects, showBanner } from './GameBits';
import useGameInput from './useGameInput';
import useGameLoop from './useGameLoop';
import Mascot from '../components/Mascot';
import { pickQuiz } from '../data/chosungQuiz';
import { getGameBest, saveGameBest } from '../utils/storage';
import { widthUnits } from '../utils/textWidth';

const GAME_SECONDS = 60; // 맞히든 넘기든 시간은 그대로 — 1분 고정
const TOTAL_QUESTIONS = 20; // 한 판 문제 수 — 다 풀면 시간이 남아도 끝
const HINT_AFTER_SECONDS = 6; // 이만큼 못 맞히면 첫 글자를 보여 준다 (점수는 절반)
const QUICK_SECONDS = 3; // 이 안에 맞히면 번개 보너스
const MOOD_SECONDS = 0.8; // 맞힘 · 틀림 표정을 보여 주는 시간
const TALK_SECONDS = 1.6; // 연속 정답 말풍선을 보여 주는 시간
const TALK_FROM_COMBO = 2; // 이만큼 연달아 맞히면 타닥이가 말풍선으로 알려 준다

const freshGame = () => ({
  quiz: pickQuiz(),
  asked: 0, // 지금 문제를 낸 뒤 흐른 초
  left: GAME_SECONDS,
  done: 0, // 맞히거나 넘긴 문제 수
  clock: 0,
  score: 0,
  combo: 0,
  solved: 0,
  history: [], // 최근 문제 [{ id, word, ok }]
  mood: null, // { type: 'happy' | 'sad', until }
  talk: null, // 타닥이 말풍선 { text, until }
  popups: [],
  banner: null,
  nextId: 1,
  over: false,
});

/**
 * 초성 퀴즈 — ㅌㅈㅇㅅ 같은 초성과 힌트(그림 · 설명)를 보고 낱말을 통째로 쳐서 맞힌다.
 * 한 판 20문제 · 1분 고정 — 다 풀거나 시간이 다 되면 끝. 모르면 Tab으로 넘긴다. 6초가 지나면 첫 글자가 열린다(점수 절반).
 * 연달아 맞히면 타닥이가 머리 위 말풍선으로 알려 준다.
 * 한글 전용 — 낱말 언어와 상관없이 한글로 친다.
 */
export default function ChosungGame({ autoStart, onExit }) {
  const mode = 'ko';
  const [status, setStatus] = useState('ready'); // ready | countdown | playing | paused | over
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  const g = useRef(null);
  if (g.current === null) g.current = freshGame();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const bestKey = 'chosung:ko';
  const [best, setBest] = useState(() => getGameBest(bestKey));

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const start = () => {
    g.current = freshGame();
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    showBanner(g.current, '🔤 초성 퀴즈', `${TOTAL_QUESTIONS}문제 · 1분 안에 많이 맞혀요!`);
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

  // reason: 'time'(시간이 다 됨) | 'done'(20문제를 다 풂)
  const gameOver = (reason) => {
    if (g.current.over) return;
    g.current.over = true;
    const { score, solved, quiz, left } = g.current;
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score, level: Math.max(1, solved) });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ score, solved, reason, left, missed: reason === 'time' ? quiz.word : null, isBest, prev });
    setStatus('over');
  };

  const nextQuiz = (game, ok) => {
    game.history = [{ id: game.nextId++, word: game.quiz.word, ok }, ...game.history].slice(0, 6);
    game.done += 1;
    if (game.done >= TOTAL_QUESTIONS) {
      gameOver('done');
      return;
    }
    game.quiz = pickQuiz();
    game.asked = 0;
  };

  useGameLoop((dt) => {
    const game = g.current;
    game.clock += dt;
    game.asked += dt;
    game.left -= dt;
    if (game.mood && game.clock > game.mood.until) game.mood = null;
    if (game.talk && game.clock > game.talk.until) game.talk = null;
    if (game.left <= 0) {
      game.left = 0;
      gameOver('time');
    }
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const pass = () => {
    const game = g.current;
    addPopup(game, `넘김 · 정답 「${game.quiz.word}」`, 50, 18, 'bad');
    game.combo = 0;
    game.talk = null;
    game.mood = { type: 'sad', until: game.clock + MOOD_SECONDS };
    nextQuiz(game, false);
    rerender();
  };

  const { inputProps } = useGameInput({
    mode,
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      if (text !== game.quiz.word) {
        game.combo = 0;
        game.talk = null;
        game.mood = { type: 'sad', until: game.clock + MOOD_SECONDS };
        setIsMiss(true);
        rerender();
        return;
      }
      const hinted = game.asked >= HINT_AFTER_SECONDS;
      const quick = game.asked < QUICK_SECONDS;
      game.combo += 1;
      game.solved += 1;
      const base = 10 + 5 * text.length + (quick ? 15 : 0) + Math.min(game.combo, 10) * 2;
      const gain = hinted ? Math.round(base / 2) : base;
      game.score += gain;
      game.mood = { type: game.combo >= 5 ? 'cheer' : 'happy', until: game.clock + MOOD_SECONDS };
      addPopup(game, `+${gain}${quick ? ' ⚡' : ''}`, 50, 18, quick ? 'fever' : null);
      if (game.combo >= TALK_FROM_COMBO) {
        const text = game.combo % 5 === 0 ? `${game.combo}연속! 대단해요 ✨` : `🔥 ${game.combo}연속 정답!`;
        game.talk = { text, until: game.clock + TALK_SECONDS };
      }
      nextQuiz(game, true);
      rerender();
    },
    onKey: (e) => {
      if (status !== 'playing') return false;
      if (e.key === 'Escape') {
        setStatus('paused');
        return true;
      }
      if (e.key === 'Tab') {
        pass();
        return true;
      }
      return false;
    },
  });

  const game = g.current;
  const { quiz } = game;
  const hinted = game.asked >= HINT_AFTER_SECONDS;
  const mood = game.mood?.type ?? 'idle';
  // 첫 글자가 열리면 초성 첫 칸을 그 글자로 바꿔 보여 준다
  const tiles = [...quiz.chosung].map((c, i) => (hinted && i === 0 ? quiz.word[0] : c));

  return (
    <div className="game">
      <div className="game__hud">
        <GameStat label="남은 시간" value={`${Math.ceil(game.left)}초`} />
        <GameStat label="점수" value={game.score} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label="연속" value={game.combo} />
        <GameStat
          label="문제"
          value={`${Math.min(game.done + 1, TOTAL_QUESTIONS)}/${TOTAL_QUESTIONS}`}
          sub={`맞힘 ${game.solved}`}
        />
      </div>

      <DangerBar
        label={game.left < 10 ? '⚠️ 시간이 얼마 안 남았어요' : `⏱️ 1분 동안 ${TOTAL_QUESTIONS}문제 · 모르면 Tab으로 넘기기`}
        ratio={status === 'playing' ? 1 - game.left / GAME_SECONDS : 0}
        hot={game.left < 10}
        detail={status === 'playing' ? `${game.left.toFixed(1)}초` : null}
      />

      <div className="game__field quiz-field">
        <div className="quiz-card" key={quiz.word}>
          <span className="quiz-card__topic">{quiz.topic}</span>
          <div className="quiz-card__tiles" aria-label={`초성 ${quiz.chosung}`} style={{ '--count': tiles.length }}>
            {tiles.map((c, i) => (
              <span key={i} className={`quiz-tile ${hinted && i === 0 ? 'is-open' : ''}`}>
                {c}
              </span>
            ))}
          </div>
          {quiz.icon ? (
            <span className="quiz-card__icon" aria-label={`그림 힌트 ${quiz.icon}`}>
              {quiz.icon}
            </span>
          ) : (
            <p className="quiz-card__hint">💡 {quiz.hint}</p>
          )}
          <span className="quiz-card__timer" aria-hidden="true">
            <span style={{ width: `${Math.min(1, game.asked / HINT_AFTER_SECONDS) * 100}%` }} />
          </span>
          <span className="quiz-card__note">
            {hinted ? '첫 글자 공개! 점수는 절반이에요' : `${Math.ceil(HINT_AFTER_SECONDS - game.asked)}초 뒤 첫 글자 공개`}
          </span>
        </div>

        <div className="quiz-side">
          <Mascot mood={mood} beat={game.solved} bubble={!!game.talk} line={game.talk?.text} />
          <ol className="quiz-history" aria-label="지난 문제">
            {game.history.map((h) => (
              <li key={h.id} className={h.ok ? 'is-ok' : 'is-miss'}>
                {h.ok ? '⭕' : '❌'} <span style={{ '--units': widthUnits(h.word) }}>{h.word}</span>
              </li>
            ))}
          </ol>
        </div>
        <Popups popups={game.popups} />
        <Banner banner={game.banner} />
      </div>

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          placeholder="낱말을 통째로 치고 Enter · 모르면 Tab"
          aria-label="정답 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🔤 초성 퀴즈"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              'ㅌㅈㅇㅅ처럼 초성만 보여 줘요. 그림이나 설명 힌트를 보고 무슨 낱말인지 맞혀 보세요.',
              '한글이라서 할 수 있는 놀이예요. 낱말 언어와 상관없이 한글로 쳐요.',
            ]}
            rules={[
              ['⌨️', '낱말을 끝까지 다 치고 Enter 또는 스페이스'],
              ['📋', `한 판에 ${TOTAL_QUESTIONS}문제 · 다 풀면 끝`],
              ['⏱️', '시간은 1분 고정 — 맞히거나 넘겨도 시간은 그대로예요'],
              ['⏭️', '모르겠으면 Tab으로 넘기기'],
              ['🔓', `${HINT_AFTER_SECONDS}초가 지나면 첫 글자가 열려요 (점수 절반)`],
              ['⚡', `${QUICK_SECONDS}초 안에 맞히면 번개 보너스 · 연속으로 맞힐수록 점수 UP (타닥이가 말풍선으로 알려 줘요)`],
            ]}
            items={[
              {
                title: '힌트 종류',
                list: [
                  ['🖼️', '그림', '먹을거리 · 동물 · 자연 · 탈것 · 물건은 그림이 힌트'],
                  ['💡', '설명', '직업 · 장소 · 스포츠 · 사자성어는 한 줄 설명이 힌트'],
                  ['🔓', '첫 글자', `${HINT_AFTER_SECONDS}초 뒤 초성 첫 칸이 글자로 바뀌어요`],
                ],
              },
            ]}
          />
          <p className="game-overlay__note">🇰🇷 한글 전용 게임이에요</p>
        </GameOverlay>
      )}
      {status === 'countdown' && <Countdown onDone={begin} />}
      {status === 'paused' && (
        <GameOverlay
          title="일시정지"
          primary={{ label: '계속하기', onClick: resume }}
          secondary={{ label: '그만하기', onClick: onExit }}
        >
          <p>잠시 멈췄어요. 준비되면 계속하세요.</p>
        </GameOverlay>
      )}
      {status === 'over' && result && (
        <GameOverlay
          title={result.reason === 'done' ? '🎉 20문제 완료!' : '⏰ 시간 끝!'}
          tone="over"
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <p className="game-overlay__score">{result.score}점</p>
          <p>
            {TOTAL_QUESTIONS}문제 중 {result.solved}문제 맞힘
            {result.reason === 'done' ? ` · ${Math.ceil(result.left)}초 남기고 끝` : ` · 마지막 문제 정답은 「${result.missed}」`}
          </p>
          {result.isBest ? (
            <p className="game-overlay__best">최고 점수!</p>
          ) : (
            result.prev && <p>최고 점수 {result.prev.score}점</p>
          )}
          <RankNote game="chosung" mode={mode} score={result.score} level={Math.max(1, result.solved)} />
        </GameOverlay>
      )}
    </div>
  );
}
