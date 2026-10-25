import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import GameStat from './GameStat';
import {
  Banner,
  DangerBar,
  ItemChips,
  LangPicker,
  Popups,
  Rules,
  addPopup,
  pruneEffects,
  showBanner,
} from './GameBits';
import useGameInput from './useGameInput';
import useGameLoop from './useGameLoop';
import { pickGameWord } from '../data/gameWords';
import { CPU_ITEMS, OPPONENTS, PLAYER_ITEMS } from '../data/gameData';
import { toKeystrokes } from '../utils/hangul';
import { getGameBest, saveGameBest } from '../utils/storage';
import { widthUnits } from '../utils/textWidth';

const ROUND_SECONDS = 45; // 시간이 다 되면 밧줄이 내 쪽에 있어야 승리
const CHOICES = 3; // 동시에 보여 주는 낱말 수 — 아무거나 쳐도 된다
const MAX_ITEMS = 3;
const ITEM_WORD_CHANCE = 0.18; // 새 낱말이 아이템 낱말(금색)일 확률
const POWER_SECONDS = 6;
const FREEZE_SECONDS = 4;
const YANK_PULL = 15;
const GUST_PULL = 10;
const INK_SECONDS = 3;
const EVENT_SECONDS = 1.6;
const COMBO_WINDOW = 3; // 이 시간(초) 안에 다음 낱말을 치면 콤보가 이어진다
const SPECIAL_PULL = 20; // 필살 게이지가 차면 한 번에 더 당기는 양

// 상대는 라운드가 오를수록 세게 당긴다 (초당)
const cpuRate = (round) => 3 + 1.6 * (round - 1);
// 낱말 하나로 당기는 양 — 긴 낱말(키를 많이 누르는 낱말)일수록 많이
const pullFor = (word) => 5 + toKeystrokes(word).length * 1.1;
// 콤보가 이어질수록 조금씩 세게 (최대 1.5배)
const comboBonus = (combo) => 1 + Math.min(combo, 10) * 0.05;
const cpuItemDelay = () => 9 + Math.random() * 6;
const opponentFor = (round) => OPPONENTS[Math.min(round, OPPONENTS.length) - 1];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** 새 낱말 — 칸이 차 있거나 이미 금색이 있으면 보통 낱말 */
function makeChoice(game, mode) {
  const taken = game.choices.filter(Boolean).map((c) => c.text);
  const hasGold = game.choices.some((c) => c?.item);
  const canGold = game.inventory.length < MAX_ITEMS && !hasGold;
  return {
    id: game.nextId++,
    text: pickGameWord('tug', mode, taken),
    item: canGold && Math.random() < ITEM_WORD_CHANCE ? pick(PLAYER_ITEMS) : null,
  };
}

const freshRound = (game, mode) => {
  game.pull = 0; // -100(상대 승) ~ 100(내 승)
  game.left = ROUND_SECONDS;
  game.clock = 0;
  game.powerUntil = 0;
  game.freezeUntil = 0;
  game.inkUntil = 0;
  game.cpuItemIn = cpuItemDelay();
  game.event = null;
  game.combo = 0;
  game.lastHit = -Infinity;
  game.choices = Array(CHOICES).fill(null);
  for (let i = 0; i < CHOICES; i += 1) game.choices[i] = makeChoice(game, mode);
  game.ended = false;
  const foe = opponentFor(game.round);
  showBanner(game, `ROUND ${game.round}`, `vs ${foe.icon} ${foe.name}`);
};

const freshGame = (mode) => {
  const game = { round: 1, score: 0, inventory: [], gauge: 0, popups: [], banner: null, nextId: 1, choices: [] };
  freshRound(game, mode);
  return game;
};

/**
 * 줄다리기 대작전 — 낱말 3개 중 아무거나 칠 때마다 밧줄을 내 쪽으로 당긴다. 상대는 쉬지 않고 당기고,
 * 라운드마다 더 센 상대가 나온다. 금색 낱말로 아이템을 얻어 숫자키 1~3으로 쓰고,
 * 낱말을 칠수록 필살 게이지가 차서 가득 차면 한 번에 크게 당긴다. 한 라운드라도 지면 게임 오버.
 */
export default function TugGame({ mode, autoStart, onModeChange, onExit }) {
  const [status, setStatus] = useState('ready'); // ready | playing | paused | won | over
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  // useRef(freshGame())은 렌더마다 freshGame을 다시 실행하므로(낱말 가방까지 소모) 처음 한 번만 만든다
  const g = useRef(null);
  if (g.current === null) g.current = freshGame(mode);
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const bestKey = `tug:${mode}`;
  const [best, setBest] = useState(() => getGameBest(bestKey)); // 매 프레임 localStorage를 읽지 않게

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);
  const announce = (icon, text) => {
    g.current.event = { icon, text, until: g.current.clock + EVENT_SECONDS };
  };

  const start = () => {
    g.current = freshGame(mode);
    setResult(null);
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

  const nextRound = () => {
    g.current.round += 1;
    freshRound(g.current, mode);
    setStatus('playing');
    focusInput();
  };

  // reason: 'pulled'(깃발을 승리선까지) | 'pulledAway'(패배선까지 끌려감) | 'timeout'(시간 종료 → 깃발 위치로 판정)
  const endRound = (won, reason = 'pulled') => {
    const game = g.current;
    if (game.ended) return;
    game.ended = true;
    if (won) game.score += 100 * game.round;
    // 이긴 라운드도 바로 저장 — 승리 창에서 그만둬도 점수가 남게
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score: game.score, level: game.round });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ score: game.score, round: game.round, isBest, prev, reason });
    setStatus(won ? 'won' : 'over');
  };

  const activateItem = (slot) => {
    const game = g.current;
    const item = game.inventory[slot];
    if (!item) return;
    game.inventory.splice(slot, 1);
    if (item.id === 'power') game.powerUntil = game.clock + POWER_SECONDS;
    if (item.id === 'freeze') game.freezeUntil = game.clock + FREEZE_SECONDS;
    if (item.id === 'yank') game.pull = Math.min(100, game.pull + YANK_PULL);
    announce(item.icon, `${item.name}!`);
    if (game.pull >= 100) endRound(true);
    rerender();
  };

  useGameLoop((dt) => {
    const game = g.current;
    game.clock += dt;
    game.left -= dt;
    if (game.clock >= game.freezeUntil) game.pull -= cpuRate(game.round) * dt;
    if (game.clock - game.lastHit > COMBO_WINDOW) game.combo = 0;

    // 상대의 방해 아이템
    game.cpuItemIn -= dt;
    if (game.cpuItemIn <= 0) {
      const item = pick(CPU_ITEMS);
      if (item.id === 'gust') game.pull -= GUST_PULL;
      if (item.id === 'ink') game.inkUntil = game.clock + INK_SECONDS;
      announce(item.icon, `상대의 ${item.name}! ${item.desc}`);
      game.cpuItemIn = cpuItemDelay();
    }

    if (game.pull >= 100) endRound(true, 'pulled');
    else if (game.pull <= -100) endRound(false, 'pulledAway');
    else if (game.left <= 0) endRound(game.pull > 0, 'timeout');
    game.pull = Math.max(-100, Math.min(100, game.pull));
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const { inputProps } = useGameInput({
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      const index = game.choices.findIndex((c) => c.text === text);
      if (index === -1) {
        game.combo = 0;
        setIsMiss(true);
        rerender();
        return;
      }
      const choice = game.choices[index];
      game.combo = game.clock - game.lastHit <= COMBO_WINDOW ? game.combo + 1 : 1;
      game.lastHit = game.clock;
      const power = game.clock < game.powerUntil ? 2 : 1;
      let pull = pullFor(text) * power * comboBonus(game.combo);
      game.score += Math.round(text.length * 10 * power * comboBonus(game.combo));

      // 필살 게이지 — 당긴 만큼 찬다
      game.gauge += pull * 1.2;
      if (game.gauge >= 100) {
        game.gauge = 0;
        pull += SPECIAL_PULL;
        showBanner(game, '💥 필살 당기기!', `+${SPECIAL_PULL}`);
      }
      game.pull = Math.min(100, game.pull + pull);
      addPopup(game, `+${Math.round(pull)}`, 20 + index * 30, 62, power > 1 ? 'fever' : null);

      if (choice.item && game.inventory.length < MAX_ITEMS) {
        game.inventory.push(choice.item);
        announce(choice.item.icon, `${choice.item.name} 획득! 숫자키 ${game.inventory.length}번으로 사용`);
      } else if (choice.item) {
        announce('🎒', '아이템 칸이 가득 찼어요');
      }
      game.choices[index] = null;
      game.choices[index] = makeChoice(game, mode);
      // 칸이 가득 찼으면 남아 있는 금색 낱말도 보통 낱말로 (쳐도 얻을 게 없으니)
      if (game.inventory.length >= MAX_ITEMS) game.choices.forEach((c) => (c.item = null));
      if (game.pull >= 100) endRound(true);
      rerender();
    },
    onKey: (e) => {
      if (e.key === 'Escape' && status === 'playing') {
        setStatus('paused');
        return true;
      }
      // 낱말에는 숫자가 없으니 숫자키는 아이템 사용으로 쓴다
      if (['1', '2', '3'].includes(e.key) && status === 'playing') {
        activateItem(Number(e.key) - 1);
        return true;
      }
      return false;
    },
  });

  const game = g.current;
  const { round, score, pull, left, clock, choices, inventory, event, combo, gauge } = game;
  const powered = clock < game.powerUntil;
  const frozen = clock < game.freezeUntil;
  const inked = clock < game.inkUntil;
  const foe = opponentFor(round);

  return (
    <div className="game">
      <div className="game__hud">
        <GameStat label="라운드" value={round} sub={foe.name} />
        <GameStat label="점수" value={score} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label="남은 시간" value={`${Math.max(0, Math.ceil(left))}초`} />
        <GameStat label="연속" value={combo} />
      </div>

      <DangerBar
        label={
          pull < -60
            ? '⚠️ 빨간 선 코앞! 빨리 당기세요'
            : '⏱️ 시간이 끝나면 깃발 위치로 승패'
        }
        ratio={status === 'playing' ? 1 - left / ROUND_SECONDS : 0}
        // 패배선이 가깝거나, 시간이 얼마 안 남았는데 지고 있을 때만 빨갛게
        hot={status === 'playing' && (pull < -60 || (left < ROUND_SECONDS * 0.3 && pull <= 0))}
        detail={
          status === 'playing'
            ? `${Math.max(0, Math.ceil(left))}초 남음 · ${
                pull > 0 ? '🟢 이기는 중' : pull > -1 ? '⚪ 가운데 · 지는 중' : '🔴 지는 중'
              }`
            : null
        }
      />

      <div className="game__field tug-field">
        <div className="tug-field__effects" aria-live="polite">
          {combo >= 2 && <span className="effect-chip">🔥 {combo}연속 · 더 세게</span>}
          {powered && <span className="effect-chip">💪 힘 2배 {Math.ceil(game.powerUntil - clock)}초</span>}
          {frozen && <span className="effect-chip">🧊 상대 멈춤 {Math.ceil(game.freezeUntil - clock)}초</span>}
          {inked && <span className="effect-chip is-bad">🦑 먹물 {Math.ceil(game.inkUntil - clock)}초</span>}
          {event && clock < event.until && (
            <span className="tug-field__event">
              {event.icon} {event.text}
            </span>
          )}
        </div>

        <div className="rope" aria-label={`밧줄 위치 ${Math.round(pull)} (100이면 승리)`}>
          <span className="rope__side">
            <span className={`rope__who ${powered ? 'is-strong' : ''}`} aria-hidden="true">
              🧑
            </span>
            나
          </span>
          <div className="rope__track">
            <span className="rope__goal rope__goal--me">
              <span className="rope__goal-label">승리선</span>
            </span>
            <span className="rope__goal rope__goal--cpu">
              <span className="rope__goal-label">패배선</span>
            </span>
            <span className="rope__center" />
            <span className="rope__knot" style={{ left: `${50 - pull / 2}%` }} aria-hidden="true">
              🚩
            </span>
          </div>
          <span className="rope__side">
            <span className={`rope__who ${frozen ? 'is-frozen' : ''}`} aria-hidden="true">
              {foe.icon}
            </span>
            {foe.name}
          </span>
        </div>

        <p className={`rope__rule ${pull < -60 ? 'is-danger' : ''}`}>
          {pull < -60
            ? '⚠️ 깃발이 빨간 선에 가까워요!'
            : '🚩 초록 선까지 당기면 승리 · 빨간 선에 닿으면 패배'}
        </p>

        <div className={`tug-choices ${inked ? 'is-inked' : ''}`}>
          {choices.map((c) => (
            <div key={c.id} className={`tug-choice ${c.item ? 'is-item' : ''}`}>
              {c.item && <span className="tug-choice__item">{c.item.icon} {c.item.name}</span>}
              <span className="tug-choice__word" style={{ '--units': widthUnits(c.text) }}>
                {status === 'ready' ? '?' : c.text}
              </span>
            </div>
          ))}
        </div>

        <div className="gauge" aria-label={`필살 게이지 ${Math.round(gauge)}%`}>
          <span className="gauge__label">💥 필살 게이지</span>
          <span className="gauge__bar">
            <span style={{ width: `${Math.min(100, gauge)}%` }} />
          </span>
        </div>

        <div className="items" aria-label="내 아이템">
          {Array.from({ length: MAX_ITEMS }, (_, slot) => {
            const item = inventory[slot];
            return (
              <button
                key={slot}
                type="button"
                className={`item-slot ${item ? '' : 'is-empty'}`}
                disabled={!item || status !== 'playing'}
                onMouseDown={(e) => e.preventDefault()} // 눌러도 입력창 포커스 유지
                onClick={() => activateItem(slot)}
                title={item ? `${item.name} — ${item.desc}` : '빈 칸'}
              >
                <kbd>{slot + 1}</kbd>
                <span className="item-slot__icon" aria-hidden="true">
                  {item ? item.icon : ''}
                </span>
                <span className="item-slot__name">{item ? item.name : '빈 칸'}</span>
              </button>
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
          placeholder={mode === 'ko' ? '아무 낱말 치고 Enter · 아이템 1~3' : 'Type a word + Enter · items 1–3'}
          aria-label="낱말 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🪢 줄다리기 대작전"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <Rules
            rules={[
              ['🎯', `낱말 ${CHOICES}개 중 아무거나 치면 당겨요`],
              ['🟢', '깃발이 승리선에 닿으면 승리'],
              ['🔴', '깃발이 패배선에 닿으면 패배'],
              ['⏱️', `${ROUND_SECONDS}초가 끝나면 깃발이 내 쪽일 때 승리`],
              ['💥', '게이지가 차면 필살 당기기'],
            ]}
          />
          <ItemChips title="금색 낱말 → 아이템 · 숫자키 1~3" items={PLAYER_ITEMS.map((item) => [item.icon, item.desc])} />
          <ItemChips title="상대 방해" items={CPU_ITEMS.map((item) => [item.icon, item.name])} />
          <LangPicker mode={mode} onModeChange={onModeChange} />
        </GameOverlay>
      )}
      {status === 'paused' && (
        <GameOverlay
          title="일시정지"
          primary={{ label: '계속하기', onClick: resume }}
          secondary={{ label: '그만하기', onClick: onExit }}
        >
          <p>입력창에서 벗어나 잠시 멈췄어요.</p>
        </GameOverlay>
      )}
      {status === 'won' && (
        <GameOverlay
          title={`${round}라운드 승리!`}
          tone="win"
          primary={{ label: '다음 라운드', onClick: nextRound }}
          secondary={{ label: '그만하기', onClick: onExit }}
        >
          <p className="game-overlay__score">{score}점</p>
          <p className="game-overlay__reason">
            {result?.reason === 'timeout'
              ? `⏱️ 시간 종료 — 깃발이 내 쪽에 있어서 승리`
              : '🚩 깃발을 승리선까지 당겨서 승리'}
          </p>
          {result?.isBest && <p className="game-overlay__best">최고 점수 저장!</p>}
          <p>
            다음 상대 {opponentFor(round + 1).icon} {opponentFor(round + 1).name} · 더 세요! 아이템과 게이지는 그대로
          </p>
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
          <p className="game-overlay__reason">
            {result.reason === 'timeout'
              ? '⏱️ 시간 종료 — 깃발이 내 쪽에 없어서 패배'
              : '🚩 깃발이 패배선까지 끌려가서 패배'}
          </p>
          <p>
            {result.round}라운드에서 {foe.icon} {foe.name}에게 졌어요
          </p>
          {result.isBest ? (
            <p className="game-overlay__best">최고 점수!</p>
          ) : (
            result.prev && <p>최고 점수 {result.prev.score}점</p>
          )}
        </GameOverlay>
      )}
    </div>
  );
}
