import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import GameStat from './GameStat';
import {
  Banner,
  Countdown,
  DangerBar,
  GameGuide,
  Hearts,
  LangPicker,
  Popups,
  addPopup,
  pruneEffects,
  showBanner,
} from './GameBits';
import useGameInput from './useGameInput';
import useGameLoop from './useGameLoop';
import { pickGameWord } from '../data/gameWords';
import { getGameBest, saveGameBest } from '../utils/storage';
import { widthUnits } from '../utils/textWidth';

const START_HEARTS = 3;
const MAX_HEARTS = 5;
const MAX_SLOTS = 4;
const CLEARS_PER_STAGE = 8;
const RESPAWN_SECONDS = 0.35; // 카드를 없앤 뒤 그 자리에 새 카드가 나오기까지
const FEVER_COMBO = 10; // 이 콤보마다 피버 타임 (점수 2배)
const FEVER_SECONDS = 8;
const BONUS_CHANCE = 0.18; // 아이템 카드가 나올 확률
const TIME_BONUS_SECONDS = 2.5;
const FREEZE_SECONDS = 4;
const SWEEP_COUNT = 2;
// 아이템 카드 — 치면 효과 (badge: 카드에 붙는 표시)
const ITEM_CARDS = {
  time: { badge: `⏳ 시간 +${TIME_BONUS_SECONDS}초` },
  heart: { badge: '💖 하트 +1' },
  freeze: { badge: `🧊 얼음 ${FREEZE_SECONDS}초` },
  sweep: { badge: `🧹 ${SWEEP_COUNT}장 지우기` },
};
// 카드 하나에 주는 시간(초) = (기본 + 글자당) × 단계 배율, 최소 1.8초
// 단계 배율: 5단계까지는 한 단계에 4%씩 조금씩 줄고, 6단계부터는 14%씩 확 줄어든다
const BASE_SECONDS = 3.4;
const PER_CHAR_SECONDS = { ko: 0.7, en: 0.35 };
const HARD_FROM_STAGE = 6;
const MIN_SECONDS = 1.8;
const stageFactor = (stage) =>
  0.96 ** (Math.min(stage, HARD_FROM_STAGE - 1) - 1) * 0.86 ** Math.max(0, stage - (HARD_FROM_STAGE - 1));

const timeLimit = (word, stage, mode) =>
  Math.max(MIN_SECONDS, (BASE_SECONDS + PER_CHAR_SECONDS[mode] * word.length) * stageFactor(stage));
// 동시에 나오는 카드: 1~2단계 2장 → 3~4단계 3장 → 5단계부터 4장
const activeSlots = (stage) => (stage <= 2 ? 2 : stage <= 4 ? 3 : MAX_SLOTS);
// 칸 index가 처음 열리는 단계 (잠긴 칸 안내용)
const openStage = (index) => {
  let stage = 1;
  while (activeSlots(stage) <= index) stage += 1;
  return stage;
};

const freshGame = () => ({
  slots: Array.from({ length: MAX_SLOTS }, () => ({ card: null, wait: 0, flash: null })),
  stage: 1,
  score: 0,
  combo: 0,
  cleared: 0,
  hearts: START_HEARTS,
  clock: 0,
  feverUntil: 0,
  freezeUntil: 0,
  popups: [],
  banner: null,
  nextId: 1,
  over: false,
});

/**
 * 타임 어택 — 낱말 카드가 여러 장 동시에 나오고, 카드마다 제한 시간이 줄어든다.
 * 시간 안에 못 친 카드는 하트를 하나 깎고, 하트가 다 떨어지면 게임 오버.
 * 단계가 오를수록 카드가 늘고 시간이 짧아진다(6단계부터 확 빨라짐). 콤보 10마다 피버 타임(점수 2배).
 * 아이템 카드: ⏳ 시간 · 💖 하트 · 🧊 얼음 · 🧹 두 장 지우기.
 */
export default function SpeedGame({ mode, autoStart, onModeChange, onExit }) {
  const [status, setStatus] = useState('ready'); // ready | playing | paused | over
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  // useRef(freshGame())은 렌더마다 freshGame을 다시 실행하므로(낱말 가방까지 소모) 처음 한 번만 만든다
  const g = useRef(null);
  if (g.current === null) g.current = freshGame();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const bestKey = `speed:${mode}`;
  const [best, setBest] = useState(() => getGameBest(bestKey)); // 매 프레임 localStorage를 읽지 않게

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  // 시작 · 다시 하기 → 3 · 2 · 1 → begin
  const start = () => {
    g.current = freshGame();
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    showBanner(g.current, 'STAGE 1', '카드 2장으로 시작!');
    setStatus('playing');
    focusInput();
  };

  // 다시 하기 · F5로 다시 띄운 경우엔 시작 화면 없이 바로
  useEffect(() => {
    if (autoStart) start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resume = () => {
    setStatus('playing');
    focusInput();
  };

  const gameOver = () => {
    if (g.current.over) return; // 상태가 바뀌기 전 프레임에서 한 번 더 불려도 한 번만
    g.current.over = true;
    const { score, stage, cleared } = g.current;
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score, level: stage });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ score, stage, cleared, isBest, prev });
    setStatus('over');
  };

  const spawn = (slot) => {
    const game = g.current;
    const onScreen = game.slots.filter((s) => s.card).map((s) => s.card.word);
    const word = pickGameWord('speed', mode, onScreen);
    let kind = 'normal';
    if (Math.random() < BONUS_CHANCE) {
      // 하트 비율은 1단계 40% → 단계마다 6%씩 줄어 최소 10% (후반 긴장감 유지), 나머지는 시간 · 얼음 · 지우기
      const heartShare = Math.max(0.1, 0.4 - 0.06 * (game.stage - 1));
      const others = ['time', 'freeze', 'sweep'];
      kind =
        game.hearts < MAX_HEARTS && Math.random() < heartShare
          ? 'heart'
          : others[Math.floor(Math.random() * others.length)];
    }
    const limit = timeLimit(word, game.stage, mode);
    slot.card = { id: game.nextId++, word, kind, limit, left: limit };
  };

  // 팝업을 띄울 카드 자리 (%)
  const slotPos = (index) => ({ x: index % 2 ? 75 : 25, y: index < 2 ? 12 : 60 });

  useGameLoop((dt) => {
    const game = g.current;
    game.clock += dt;
    const frozen = game.clock < game.freezeUntil; // 얼음: 카드 시간이 흐르지 않는다
    const active = activeSlots(game.stage);
    game.slots.forEach((slot, i) => {
      if (slot.flash && game.clock > slot.flash.until) slot.flash = null;
      if (!slot.card) {
        if (i >= active) return;
        slot.wait -= dt;
        if (slot.wait <= 0) spawn(slot);
        return;
      }
      if (!frozen) slot.card.left -= dt;
      if (slot.card.left > 0) return;
      // 시간 초과 → 하트 하나
      game.hearts -= 1;
      game.combo = 0;
      addPopup(game, '💔', slotPos(i).x, slotPos(i).y, 'bad');
      slot.flash = { type: 'expired', word: slot.card.word, until: game.clock + 0.5 };
      slot.card = null;
      slot.wait = RESPAWN_SECONDS + 0.4;
    });
    if (game.hearts <= 0) gameOver();
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const { inputProps } = useGameInput({
    mode,
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      const index = game.slots.findIndex((s) => s.card?.word === text);
      if (index === -1) {
        game.combo = 0;
        setIsMiss(true);
        rerender();
        return;
      }
      const slot = game.slots[index];
      const { card } = slot;
      const fever = game.clock < game.feverUntil;
      const gain = (10 * game.stage + Math.round((card.left / card.limit) * 20)) * (fever ? 2 : 1);
      game.score += gain;
      game.combo += 1;
      game.cleared += 1;
      const { x, y } = slotPos(index);
      addPopup(game, `+${gain}`, x, y, fever ? 'fever' : null);

      if (card.kind === 'time') {
        game.slots.forEach((s) => s.card && (s.card.left = Math.min(s.card.limit, s.card.left + TIME_BONUS_SECONDS)));
        addPopup(game, `⏳ +${TIME_BONUS_SECONDS}초`, x, y + 12, 'good');
      }
      if (card.kind === 'heart') {
        game.hearts = Math.min(MAX_HEARTS, game.hearts + 1);
        addPopup(game, '💖 +1', x, y + 12, 'good');
      }
      if (card.kind === 'freeze') {
        game.freezeUntil = game.clock + FREEZE_SECONDS;
        showBanner(game, '🧊 얼음!', `${FREEZE_SECONDS}초 동안 시간 멈춤`);
      }
      if (card.kind === 'sweep') {
        // 다른 카드 중 시간이 가장 급한 것부터 지운다
        const targets = game.slots
          .map((s, i) => ({ s, i }))
          .filter(({ s, i }) => i !== index && s.card)
          .sort((a, b) => a.s.card.left / a.s.card.limit - b.s.card.left / b.s.card.limit)
          .slice(0, SWEEP_COUNT);
        targets.forEach(({ s, i }) => {
          const bonus = 10 * game.stage;
          game.score += bonus;
          game.cleared += 1;
          addPopup(game, `🧹 +${bonus}`, slotPos(i).x, slotPos(i).y, 'good');
          s.flash = { type: 'cleared', word: s.card.word, until: game.clock + 0.35 };
          s.card = null;
          s.wait = RESPAWN_SECONDS;
        });
      }
      if (game.combo % FEVER_COMBO === 0) {
        game.feverUntil = game.clock + FEVER_SECONDS;
        showBanner(game, '🔥 피버 타임!', `${FEVER_SECONDS}초 동안 점수 2배`);
      }
      // 빗자루로 여러 장을 한 번에 지워 단계 경계를 건너뛰어도 단계가 오르게
      const nextStage = Math.floor(game.cleared / CLEARS_PER_STAGE) + 1;
      if (nextStage > game.stage) {
        // 급가속 구간에 처음 들어설 때만 알린다 (빗자루로 단계를 건너뛰어도)
        const hard = game.stage < HARD_FROM_STAGE && nextStage >= HARD_FROM_STAGE ? ' · 이제부터 확 빨라져요!' : '';
        game.stage = nextStage;
        showBanner(game, `STAGE ${game.stage}`, `카드 ${activeSlots(game.stage)}장${hard}`);
      }
      slot.flash = { type: 'cleared', word: card.word, until: game.clock + 0.35 };
      slot.card = null;
      slot.wait = RESPAWN_SECONDS;
      rerender();
    },
    onKey: (e) => {
      if (e.key === 'Escape' && status === 'playing') {
        setStatus('paused');
        return true;
      }
      return false;
    },
  });

  const game = g.current;
  const fever = game.clock < game.feverUntil;
  const frozen = game.clock < game.freezeUntil;
  const active = activeSlots(game.stage);
  // 가장 급한 카드 — 이 카드가 0초가 되면 하트가 하나 깎인다
  const urgent = game.slots
    .filter((s) => s.card)
    .reduce((min, s) => (!min || s.card.left / s.card.limit < min.left / min.limit ? s.card : min), null);
  const lastHeart = game.hearts === 1;

  return (
    <div className={`game ${fever ? 'is-fever' : ''} ${frozen ? 'is-frozen' : ''}`}>
      <div className="game__hud">
        <GameStat label="단계" value={game.stage} />
        <GameStat label="점수" value={game.score} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label={fever ? '🔥 피버' : '연속'} value={game.combo} sub={fever ? '점수 2배' : null} />
        <div className="game-stat">
          <span className="game-stat__label">하트</span>
          <Hearts count={game.hearts} max={Math.max(START_HEARTS, game.hearts)} />
        </div>
      </div>

      <DangerBar
        label={lastHeart ? '⚠️ 하트 1개! 한 장만 더 놓치면 끝' : '⏳ 막대가 다 줄기 전에 치세요 · 놓치면 ❤️ -1'}
        ratio={status === 'playing' && urgent ? 1 - urgent.left / urgent.limit : 0}
        detail={
          frozen
            ? `🧊 시간 멈춤 ${Math.ceil(game.freezeUntil - game.clock)}초`
            : urgent && status === 'playing'
              ? `제일 급한 「${urgent.word}」 ${urgent.left.toFixed(1)}초`
              : null
        }
      />

      <div className="game__field attack-field">
        <div className="attack-grid">
          {game.slots.map((slot, i) => {
            const { card, flash } = slot;
            if (i >= active && !card) {
              return (
                <div key={`slot-${i}`} className="attack-card is-locked" aria-hidden="true">
                  🔒 {openStage(i)}단계에서 열림
                </div>
              );
            }
            if (!card) {
              return (
                <div
                  key={`slot-${i}`}
                  className={`attack-card is-empty ${flash ? `is-${flash.type}` : ''}`}
                  aria-hidden="true"
                >
                  {flash?.word}
                </div>
              );
            }
            const ratio = card.left / card.limit;
            return (
              <div
                key={`card-${card.id}`}
                className={`attack-card is-${card.kind} ${ratio < 0.3 ? 'is-urgent' : ''}`}
                aria-label={`${card.word}, ${card.left.toFixed(1)}초 남음`}
              >
                {card.kind !== 'normal' && <span className="attack-card__badge">{ITEM_CARDS[card.kind].badge}</span>}
                <span className="attack-card__word" style={{ '--units': widthUnits(card.word) }}>
                  {card.word}
                </span>
                <span className="attack-card__timer">
                  <span style={{ width: `${Math.max(0, ratio) * 100}%` }} />
                </span>
                <span className="attack-card__secs">{Math.max(0, card.left).toFixed(1)}초</span>
              </div>
            );
          })}
        </div>
        <Popups popups={game.popups} />
        <Banner banner={game.banner} />
      </div>

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          placeholder={mode === 'ko' ? '카드 낱말 치고 Enter' : 'Type a card word + Enter'}
          aria-label="낱말 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="⚡ 타임 어택"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              '낱말 카드가 여러 장 한꺼번에 나와요. 카드마다 시간 막대가 줄어드니 급한 카드부터 쳐서 하트를 지키세요.',
              '단계가 오를수록 카드가 늘고 빨라져요. 얼마나 높은 단계까지 버틸 수 있을까요?',
            ]}
            rules={[
              ['🎯', '카드의 낱말을 치고 Enter 또는 스페이스'],
              ['⏳', '막대가 다 줄기 전에 쳐야 해요. 놓치면 하트 -1'],
              ['☠️', '하트를 모두 잃으면 게임 오버'],
              ['📈', `${CLEARS_PER_STAGE}장마다 단계 UP · ${HARD_FROM_STAGE}단계부터 확 빨라져요`],
              ['🔥', `${FEVER_COMBO}콤보마다 피버 타임 · ${FEVER_SECONDS}초 동안 점수 2배`],
            ]}
            items={[
              {
                title: '아이템 카드 · 낱말을 치면 효과가 나요',
                list: [
                  ['⏳', '시간', `모든 카드에 ${TIME_BONUS_SECONDS}초를 더해요`],
                  ['💖', '하트', `하트 1개 회복 · 최대 ${MAX_HEARTS}개`],
                  ['🧊', '얼음', `${FREEZE_SECONDS}초 동안 시간이 멈춰요`],
                  ['🧹', '빗자루', `가장 급한 카드 ${SWEEP_COUNT}장을 한 번에 지워요`],
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
          <p>잠시 멈췄어요. 준비되면 계속하세요.</p>
        </GameOverlay>
      )}
      {status === 'over' && result && (
        <GameOverlay
          title="게임 오버"
          tone="over"
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <p className="game-overlay__score">{result.score}점</p>
          <p>
            {result.stage}단계 · 카드 {result.cleared}장
          </p>
          {result.isBest ? (
            <p className="game-overlay__best">최고 점수!</p>
          ) : (
            result.prev && <p>최고 점수 {result.prev.score}점</p>
          )}
          <RankNote game="speed" mode={mode} score={result.score} level={result.stage} />
        </GameOverlay>
      )}
    </div>
  );
}
