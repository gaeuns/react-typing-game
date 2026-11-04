import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import GameStat from './GameStat';
import {
  Banner,
  Countdown,
  GameGuide,
  LangPicker,
  Popups,
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
const MIN_CHOICE_UNITS = 3.5; // 폰에서 짧은 낱말 칸도 이만큼은 넓게 (글자 폭 단위)
const MAX_ITEMS = 3;
const ITEM_WORD_CHANCE = 0.18; // 새 낱말이 아이템 낱말(금색)일 확률
const POWER_SECONDS = 6;
const FREEZE_SECONDS = 4;
const INK_SECONDS = 3;
const EVENT_SECONDS = 1.6;
const COMBO_WINDOW = 3; // 이 시간(초) 안에 다음 낱말을 치면 콤보가 이어진다

// 밧줄은 칸으로 움직인다 — 가운데에서 한쪽 끝(승리선 · 패배선)까지 STEPS칸.
// 한 번에 확 끝나지 않게 낱말 하나 = 1칸(긴 낱말 2칸), 아이템 · 필살도 최대 2칸.
const STEPS = 8;
const LONG_WORD_KEYS = 12; // 키를 이만큼 이상 누르는 낱말은 2칸
const YANK_STEPS = 2;
const GUST_STEPS = 1;
const SPECIAL_STEPS = 1; // 필살 게이지가 차면 그 낱말에 더해지는 칸
const FINISH_MS = 500; // 승리선 · 패배선에 닿은 뒤 결과 창까지 — 깃발이 선에 닿는 것만 보여 주고 바로 (그동안 입력은 막음)

// 상대는 쉬지 않고 조금씩 끌어가다 힘이 1칸만큼 모이면 한 칸 당긴다 (칸/초, 라운드가 오를수록 가파르게)
// 0.12 · 0.23 · 0.36 · 0.51 · 0.68 … — 시뮬레이션(실제 낱말 목록)으로 맞춤: 분당 120타는 R1, 180타 R2,
// 250타 R3, 350타 R4, 500타 R5까지 거의 이기고 그다음 라운드에서 반쯤 진다
const cpuRate = (round) => 0.12 + 0.1 * (round - 1) + 0.01 * (round - 1) ** 2;
const stepsFor = (word) => (toKeystrokes(word).length >= LONG_WORD_KEYS ? 2 : 1);
// 콤보가 이어질수록 필살 게이지가 빨리 찬다 (최대 1.5배)
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
  game.pos = 0; // -STEPS(상대 승) ~ STEPS(내 승), 칸
  game.cpuCharge = 0; // 상대가 모으는 힘 0~1 — 1이 되면 한 칸 (그 사이 깃발이 조금씩 끌려가 보인다)
  game.shown = 0; // 화면에 그리는 밧줄 위치(-100~100)
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
  game.banner = null; // 큰 배너는 카운트다운 숫자 · 낱말을 가려서, 라운드 안내는 시작 뒤 밧줄 위 알림 칸에(begin)
};

const freshGame = (mode) => {
  const game = { round: 1, score: 0, inventory: [], gauge: 0, popups: [], banner: null, nextId: 1, choices: [], hits: 0 };
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

  const finishTimer = useRef(null);
  useEffect(() => () => clearTimeout(finishTimer.current), []);

  // 시작 · 다시 하기 → 3 · 2 · 1 → begin
  const start = () => {
    clearTimeout(finishTimer.current); // 결과 창을 기다리는 중에 F5 · 다시 하기를 눌러도 옛 판 결과가 뜨지 않게
    g.current = freshGame(mode);
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    const foe = opponentFor(g.current.round);
    announce('🪢', `ROUND ${g.current.round} · vs ${foe.icon} ${foe.name}`);
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

  // 다음 라운드도 3 · 2 · 1 — 배너를 보는 사이 상대가 먼저 당겨 깃발이 가운데를 벗어나지 않게
  const nextRound = () => {
    g.current.round += 1;
    freshRound(g.current, mode);
    setStatus('countdown');
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
    setResult({ score: game.score, round: game.round, isBest, prev, reason, won });
    setTyped(''); // 치던 글자는 버린다 — 끝난 뒤엔 더 칠 수 없다
    // 바로 결과 창을 띄우지 않고 깃발이 선에 닿은 모습을 잠깐 보여 준다 (그동안 게임은 멈춤)
    setStatus('finishing');
    finishTimer.current = setTimeout(() => setStatus(won ? 'won' : 'over'), FINISH_MS);
  };

  // 칸 이동 — 끝(±STEPS)에 닿으면 라운드 끝
  const move = (steps) => {
    const game = g.current;
    if (game.ended) return;
    game.pos = Math.max(-STEPS, Math.min(STEPS, game.pos + steps));
    if (game.pos >= STEPS) endRound(true, 'pulled');
    else if (game.pos <= -STEPS) endRound(false, 'pulledAway');
  };

  const activateItem = (slot) => {
    const game = g.current;
    const item = game.inventory[slot];
    if (!item) return;
    game.inventory.splice(slot, 1);
    if (item.id === 'power') game.powerUntil = game.clock + POWER_SECONDS;
    if (item.id === 'freeze') game.freezeUntil = game.clock + FREEZE_SECONDS;
    announce(item.icon, `${item.name}!`);
    if (item.id === 'yank') {
      game.hits += 1;
      move(YANK_STEPS);
    }
    rerender();
  };

  useGameLoop((dt) => {
    const game = g.current;
    if (!game.ended) {
      game.clock += dt;
      game.left -= dt;
      if (game.clock >= game.freezeUntil) game.cpuCharge += cpuRate(game.round) * dt;
      if (game.clock - game.lastHit > COMBO_WINDOW) game.combo = 0;

      if (game.cpuCharge >= 1) {
        game.cpuCharge -= 1;
        move(-1);
      }

      // 상대의 방해 아이템
      game.cpuItemIn -= dt;
      if (!game.ended && game.cpuItemIn <= 0) {
        const item = pick(CPU_ITEMS);
        if (item.id === 'ink') game.inkUntil = game.clock + INK_SECONDS;
        announce(item.icon, `상대의 ${item.name}! ${item.desc}`);
        game.cpuItemIn = cpuItemDelay();
        if (item.id === 'gust') move(-GUST_STEPS);
      }

      if (!game.ended && game.left <= 0) endRound(game.pos > 0, 'timeout');
    }

    // 화면 위치는 목표로 부드럽게 따라간다 — 한 칸 당기면 약 0.3초에 걸쳐 스르륵.
    // (CSS transition은 매 프레임 값이 바뀌면 계속 처음부터 다시 시작돼 거의 안 움직여서 JS로)
    const target = ((game.pos - (game.ended ? 0 : game.cpuCharge)) / STEPS) * 100;
    game.shown += (target - game.shown) * Math.min(1, dt * 10);
    pruneEffects(game);
    rerender();
  }, status === 'playing' || status === 'finishing'); // 끝난 뒤에도 깃발이 선까지 가는 모습은 마저 그린다

  const { inputProps, setValue: setTyped } = useGameInput({
    mode,
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
      game.hits += 1; // 당길 때마다 '나'가 홱 당기는 몸짓을 다시 틀기 위한 번호
      game.combo = game.clock - game.lastHit <= COMBO_WINDOW ? game.combo + 1 : 1;
      game.lastHit = game.clock;
      const power = game.clock < game.powerUntil ? 2 : 1;
      let steps = Math.min(2, stepsFor(text) * power); // 한 낱말로는 최대 2칸
      game.score += Math.round(text.length * 10 * power * comboBonus(game.combo));

      // 필살 게이지 — 낱말마다 차고, 콤보가 이어지면 더 빨리
      game.gauge += 15 * comboBonus(game.combo);
      if (game.gauge >= 100) {
        game.gauge = 0;
        steps = Math.min(2, steps + SPECIAL_STEPS); // 필살이어도 낱말 하나로는 2칸까지 — 확 끝나지 않게
        showBanner(game, '💥 필살 당기기!', `${steps}칸`);
      }
      addPopup(game, `+${steps}칸`, 20 + index * 30, 62, power > 1 ? 'fever' : null);

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
      move(steps);
      rerender();
    },
    onKey: (e) => {
      // 라운드가 끝나면(결과 창이 뜨기 전 잠깐 포함) 글자 · Enter · 아이템 키를 모두 막는다. F5는 다시 하기
      if (g.current.ended && e.key !== 'F5') return true;
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
  const { round, score, pos, left, clock, choices, inventory, event, combo, gauge } = game;
  // 화면 위치(-100~100): 칸 위치(상대가 모으는 힘만큼 조금씩 끌려감)를 게임 루프에서 부드럽게 따라간 값
  const pull = game.shown;
  const finishing = status === 'finishing';
  const danger = pos <= -(STEPS - 2); // 패배선까지 2칸 이하
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

      <div className="game__field tug-field">
        <div className="tug-field__effects" aria-live="polite">
          {combo >= 2 && <span className="effect-chip">🔥 {combo}연속 · 게이지 더 빨리</span>}
          {powered && <span className="effect-chip">💪 힘 2배 {Math.ceil(game.powerUntil - clock)}초</span>}
          {frozen && <span className="effect-chip">🧊 상대 멈춤 {Math.ceil(game.freezeUntil - clock)}초</span>}
          {inked && <span className="effect-chip is-bad">🦑 먹물 {Math.ceil(game.inkUntil - clock)}초</span>}
          {event && clock < event.until && (
            <span className="tug-field__event">
              {event.icon} {event.text}
            </span>
          )}
        </div>

        <div
          // 끝난 자세(이긴 쪽 · 진 쪽)는 결과 창이 떠 있는 동안에도 그대로
          className={`rope ${status === 'playing' ? 'is-live' : ''} ${
            ['finishing', 'won', 'over'].includes(status) ? (result?.won ? 'is-won' : 'is-lost') : ''
          }`}
          aria-label={`밧줄 위치 ${pos}칸 (${STEPS}칸이면 승리, -${STEPS}칸이면 패배)`}
          style={{ '--pull': pull }}
        >
          <span className="rope__side">
            {/* key가 바뀌면 다시 마운트돼 '홱' 몸짓이 처음부터 다시 나온다 */}
            <span
              key={game.hits}
              className={`rope__who rope__who--me ${powered ? 'is-strong' : ''} ${game.hits ? 'is-yank' : ''}`}
              aria-hidden="true"
            >
              🧑
            </span>
            나
          </span>
          <div className="rope__track">
            {/* 가운데에서 깃발까지 — 내 쪽이면 초록, 상대 쪽이면 빨강 */}
            <span
              className={`rope__gain ${pull >= 0 ? 'is-mine' : 'is-theirs'}`}
              style={{ left: `${50 - Math.max(pull, 0) / 2}%`, width: `${Math.abs(pull) / 2}%` }}
            />
            <span className="rope__line" />
            <span className="rope__goal rope__goal--me">
              <span className="rope__goal-label">승리선</span>
            </span>
            <span className="rope__goal rope__goal--cpu">
              <span className="rope__goal-label">패배선</span>
            </span>
            <span className="rope__center" />
            <span className="rope__knot" style={{ left: `${50 - pull / 2}%` }} aria-hidden="true">
              <span key={game.hits} className={game.hits ? 'is-bump' : ''}>🚩</span>
            </span>
          </div>
          <span className="rope__side">
            <span className={`rope__who rope__who--cpu ${frozen ? 'is-frozen' : ''}`} aria-hidden="true">
              {foe.icon}
            </span>
            {foe.name}
          </span>
        </div>

        <p className={`rope__rule ${danger ? 'is-danger' : ''}`}>
          {danger
            ? '⚠️ 깃발이 빨간 선에 가까워요!'
            : `🚩 ${STEPS}칸 당겨 초록 선에 닿으면 승리 · 빨간 선에 닿으면 패배`}
        </p>

        <div className={`tug-choices ${inked ? 'is-inked' : ''}`}>
          {choices.map((c) => (
            <div
              key={c.id}
              className={`tug-choice ${c.item ? 'is-item' : ''}`}
              style={{ '--grow': Math.max(widthUnits(c.text), MIN_CHOICE_UNITS) }} // 폰에서 칸 너비 비율
            >
              {c.item && <span className="tug-choice__item">{c.item.icon} {c.item.name}</span>}
              <span className="tug-choice__word" style={{ '--units': widthUnits(c.text) }}>
                {status === 'ready' || status === 'countdown' || status === 'finishing' ? '?' : c.text}
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
          readOnly={inputProps.readOnly || status !== 'playing'} // 터치 기기 입력기도 끝난 뒤엔 막기
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🪢 줄다리기 대작전"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              '로봇과 괴물을 상대로 하는 줄다리기! 낱말을 칠 때마다 밧줄을 내 쪽으로 당겨요.',
              '라운드를 이길수록 더 센 상대가 나와요. 이긴 라운드에서 그만둬도 점수는 랭킹에 남아요.',
            ]}
            rules={[
              ['🎯', `낱말 ${CHOICES}개 중 아무거나 치면 한 칸 · 아주 긴 낱말은 두 칸`],
              ['🟢', `깃발을 ${STEPS}칸 당겨 초록 승리선에 닿으면 승리`],
              ['🔴', '빨간 패배선에 닿으면 패배'],
              ['⏱️', `${ROUND_SECONDS}초가 끝나면 깃발이 내 쪽에 있을 때 승리`],
              ['💥', '쉬지 않고 치면 콤보 · 게이지가 차면 필살 당기기'],
            ]}
            items={[
              {
                title: `내 아이템 · 금색 낱말로 얻고 1~${MAX_ITEMS} 키로 써요`,
                list: PLAYER_ITEMS.map((item) => [item.icon, item.name, item.desc]),
              },
              {
                title: '상대 방해',
                list: CPU_ITEMS.map((item) => [item.icon, item.name, item.desc]),
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
          {/* 이긴 라운드마다 랭킹에도 올린다 — 여기서 그만둬도 남게 (랭킹은 사람마다 최고 점수만) */}
          <RankNote game="tug" mode={mode} score={score} level={round} />
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
          <RankNote game="tug" mode={mode} score={result.score} level={result.round} />
        </GameOverlay>
      )}
    </div>
  );
}
