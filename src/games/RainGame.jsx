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
import { pickFalling } from '../data/gameWords';
import { RAIN_SPECIALS } from '../data/gameData';
import { getGameBest, saveGameBest } from '../utils/storage';

// 가로로 나눈 칸 수 — 판이 좁으면(폰) 줄여서 라벨이 판 밖으로 잘리거나 서로 겹치지 않게
const LANE_WIDTH = 95; // 칸 하나에 필요한 너비(px) — 가장 긴 라벨 기준
const lanesFor = (fieldWidth) => Math.max(3, Math.min(8, Math.floor(fieldWidth / LANE_WIDTH)));
const ITEM_GAP_PX = 72; // 같은 칸에서 앞뒤 음식 사이 최소 간격 — 빠른 음식이 느린 음식을 덮지 않게
const START_ITEMS = 3; // 시작하자마자 떨어지고 있는 개수
const CLEARS_PER_STAGE = 10;
const SPECIAL_CHANCE = 0.1;
const MAX_SHIELDS = 3;
const SLOW_SECONDS = 5;
// 단계가 오를수록 빨리 떨어지고(화면 높이 비율/초) 자주 생기고 한 화면에 많아진다
const fallSpeed = (stage) => Math.min(0.065 + 0.012 * (stage - 1), 0.22);
const spawnEvery = (stage) => Math.max(0.55, 1.5 - 0.12 * (stage - 1));
const maxOnScreen = (stage) => 5 + stage * 2;
// 콤보 5마다 점수 배율 +0.5 (최대 3배)
const multiplier = (combo) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const freshGame = () => ({
  items: [], // { id, word, icon, special, lane, y, speed } — y: 0(맨 위) → 1(데드라인)
  pops: [], // 맞혀서 터지는 중인 것
  stage: 1,
  score: 0,
  combo: 0,
  cleared: 0,
  shields: 0,
  clock: 0,
  slowUntil: 0,
  spawnIn: 0,
  hitId: null, // 데드라인에 닿은 것
  popups: [],
  banner: null,
  nextId: 1,
  over: false,
});

/**
 * 냠냠 디펜스 — 낱말을 단 음식 · 동물 · 물건이 여러 개 동시에 떨어진다. 데드라인에 닿기 전에 쳐서 먹어 치워야 하고,
 * 하나라도 닿으면 게임 오버(방패가 있으면 한 번 막아 준다). 단계가 오를수록 빨라지고 많아진다.
 * 💣 폭탄 · ⏱️ 시계 · 🛡️ 방패 아이템이 가끔 섞여 떨어진다.
 */
export default function RainGame({ mode, autoStart, onModeChange, onExit }) {
  const [status, setStatus] = useState('ready');
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  // useRef(freshGame())은 렌더마다 freshGame을 다시 실행하므로(낱말 가방까지 소모) 처음 한 번만 만든다
  const g = useRef(null);
  if (g.current === null) g.current = freshGame();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const fieldRef = useRef(null);
  const bestKey = `rain:${mode}`;
  const [best, setBest] = useState(() => getGameBest(bestKey)); // 매 프레임 localStorage를 읽지 않게

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const spawn = (y = 0) => {
    const game = g.current;
    const { word, icon } = pickFalling(mode, game.items.map((it) => it.word));
    const lanes = lanesFor(fieldRef.current?.clientWidth ?? 800);
    // 위쪽에 막 생긴 것의 칸 · 바로 옆 칸은 피한다 (라벨끼리 겹치지 않게)
    const busy = new Set(
      game.items.filter((it) => it.y < 0.25).flatMap((it) => [it.lane - 1, it.lane, it.lane + 1]),
    );
    const all = [...Array(lanes).keys()];
    const free = all.filter((lane) => !busy.has(lane));
    const lane = pick(free.length ? free : all);
    const special = Math.random() < SPECIAL_CHANCE ? pick(RAIN_SPECIALS) : null;
    game.items.push({
      id: game.nextId++,
      word,
      icon: special ? special.icon : icon, // 음식은 이름에 맞는 그림
      special: special?.id ?? null,
      lane,
      x: ((lane + 0.5) / lanes) * 100, // 칸 가운데 (%)
      y,
      speed: 0.8 + Math.random() * 0.45, // 음식마다 조금씩 다른 속도
    });
  };

  const start = () => {
    g.current = freshGame();
    // 시작부터 여러 개가 떨어지고 있게
    for (let i = 0; i < START_ITEMS; i += 1) spawn(0.18 - i * 0.07);
    g.current.spawnIn = spawnEvery(1);
    showBanner(g.current, 'STAGE 1', '빨간 선을 지켜라!');
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

  const gameOver = (hitId) => {
    const game = g.current;
    if (game.over) return;
    game.over = true;
    game.hitId = hitId;
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score: game.score, level: game.stage });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ score: game.score, stage: game.stage, cleared: game.cleared, isBest, prev });
    setStatus('over');
  };

  // 먹어 치움 — 점수 · 콤보 · 단계
  const eat = (item, { chain = false } = {}) => {
    const game = g.current;
    game.items = game.items.filter((it) => it !== item);
    game.pops.push({ ...item, at: performance.now() });
    game.cleared += 1;
    const gain = Math.round((10 * game.stage + item.word.length * 2) * multiplier(game.combo));
    game.score += gain;
    addPopup(game, `+${gain}`, item.x, item.y * 85 + 5, chain ? 'good' : null);
    if (game.cleared % CLEARS_PER_STAGE === 0) {
      game.stage += 1;
      showBanner(game, `STAGE ${game.stage}`, '더 빠르게, 더 많이!');
    }
  };

  // 시계 · 방패 효과 (폭탄은 받는 쪽에서 따로 처리)
  const applySpecial = (item) => {
    const game = g.current;
    if (item.special === 'clock') {
      game.slowUntil = game.clock + SLOW_SECONDS;
      showBanner(game, '⏱️ 슬로우', `${SLOW_SECONDS}초 동안 천천히`);
    }
    if (item.special === 'shield') {
      game.shields = Math.min(MAX_SHIELDS, game.shields + 1);
      addPopup(game, '🛡️ +1', item.x, item.y * 85 + 15, 'good');
    }
  };

  useGameLoop((dt) => {
    const game = g.current;
    game.clock += dt;
    game.spawnIn -= dt;
    if (game.spawnIn <= 0 && game.items.length < maxOnScreen(game.stage)) {
      spawn();
      game.spawnIn = spawnEvery(game.stage);
    }
    const slow = game.clock < game.slowUntil ? 0.5 : 1;
    const speed = fallSpeed(game.stage) * slow;
    const gap = ITEM_GAP_PX / (fieldRef.current?.clientHeight || 500);
    // 아래쪽(데드라인에 가까운) 것부터 움직이고, 같은 칸의 앞 음식을 앞지르지 못하게 한다
    const ordered = [...game.items].sort((a, b) => b.y - a.y);
    const frontInLane = new Map();
    for (const item of ordered) {
      item.y += speed * item.speed * dt;
      const front = frontInLane.get(item.lane);
      if (front !== undefined) item.y = Math.min(item.y, front - gap);
      frontInLane.set(item.lane, item.y);
    }
    for (const item of ordered) {
      if (item.y < 1) continue;
      if (game.shields > 0) {
        // 방패가 막아 준다
        game.shields -= 1;
        game.items = game.items.filter((it) => it !== item);
        addPopup(game, '🛡️ 막았다!', item.x, 85, 'good');
        continue;
      }
      item.y = 1;
      gameOver(item.id);
      break;
    }
    const now = performance.now();
    game.pops = game.pops.filter((p) => now - p.at < 450);
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const { inputProps } = useGameInput({
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      // 같은 낱말이 여럿이면 데드라인에 가장 가까운 것부터
      const target = game.items.filter((it) => it.word === text).sort((a, b) => b.y - a.y)[0];
      if (!target) {
        game.combo = 0;
        setIsMiss(true);
        rerender();
        return;
      }
      game.combo += 1;
      eat(target);
      applySpecial(target);
      if (target.special === 'bomb') {
        const rest = [...game.items];
        // 폭탄으로 먹은 시계 · 방패도 효과는 그대로 (폭탄끼리는 다시 터지지 않는다)
        rest.forEach((it) => {
          eat(it, { chain: true });
          if (it.special !== 'bomb') applySpecial(it);
        });
        showBanner(game, '💣 펑!', rest.length ? `${rest.length}개를 한 번에!` : '화면이 깨끗해졌어요');
      }
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
  const slowed = game.clock < game.slowUntil;
  // 데드라인에 가장 가까운 것 — 이게 닿으면 게임 오버 (방패가 있으면 한 번 막는다)
  const lowest = game.items.reduce((max, it) => (!max || it.y > max.y ? it : max), null);

  return (
    <div className={`game ${slowed ? 'is-slow' : ''}`}>
      <div className="game__hud">
        <GameStat label="단계" value={game.stage} />
        <GameStat label="점수" value={game.score} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label="연속" value={game.combo} sub={`점수 ×${multiplier(game.combo)}`} />
        <GameStat label="방패" value={game.shields ? '🛡️'.repeat(game.shields) : '없음'} />
      </div>

      <DangerBar
        label={
          game.shields > 0
            ? `🛡️ 방패 ${game.shields}개 — 빨간 선에 닿아도 ${game.shields}번 버텨요`
            : '☠️ 하나라도 빨간 선에 닿으면 게임 오버'
        }
        ratio={status === 'playing' && lowest ? lowest.y : 0}
        detail={
          lowest && status === 'playing' ? `제일 아래 「${lowest.word}」 · 남은 거리 ${Math.round((1 - lowest.y) * 100)}%` : null
        }
      />

      <div ref={fieldRef} className="game__field rain-field">
        {game.items.map((item) => (
          <div
            key={item.id}
            className={[
              'rain-item',
              item.special && `is-special is-${item.special}`,
              item.y > 0.75 && 'is-danger',
              item.id === game.hitId && 'is-hit',
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ '--x': item.x, '--y': item.y }}
          >
            <span className="rain-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="rain-item__word">{item.word}</span>
          </div>
        ))}
        {game.pops.map((pop) => (
          <div
            key={`pop-${pop.id}`}
            className="rain-item is-pop"
            style={{ '--x': pop.x, '--y': pop.y }}
            aria-hidden="true"
          >
            <span className="rain-item__icon">{pop.icon}</span>
            <span className="rain-item__word">{pop.word}</span>
          </div>
        ))}
        {slowed && <span className="rain-field__slow">⏱️ 슬로우 {Math.ceil(game.slowUntil - game.clock)}초</span>}
        <div className="rain-field__deadline" aria-hidden="true">
          <span>여기 닿으면 끝</span>
        </div>
        <Popups popups={game.popups} />
        <Banner banner={game.banner} />
      </div>

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          placeholder={mode === 'ko' ? '떨어지는 낱말 치고 Enter' : 'Type a falling word + Enter'}
          aria-label="낱말 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🍩 냠냠 디펜스"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <Rules
            rules={[
              ['🎯', '떨어지는 낱말을 치고 Enter'],
              ['☠️', '하나라도 빨간 선에 닿으면 게임 오버'],
              ['📈', `${CLEARS_PER_STAGE}개마다 단계 UP · 점점 빨라져요`],
              ['🔥', '콤보를 이으면 점수 최대 3배'],
            ]}
          />
          <ItemChips title="특수 아이템" items={RAIN_SPECIALS.map((s) => [s.icon, s.desc])} />
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
      {status === 'over' && result && (
        <GameOverlay
          title="게임 오버"
          tone="over"
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <p className="game-overlay__score">{result.score}점</p>
          <p>
            {result.stage}단계 · {result.cleared}개 냠냠
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
