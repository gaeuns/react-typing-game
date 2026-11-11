import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import { startGameSession } from '../utils/ranking';
import GameStat from './GameStat';
import { Banner, Countdown, GameGuide, LangPicker, Popups, addPopup, pruneEffects, showBanner } from './GameBits';
import useGameInput from './useGameInput';
import useGameLoop from './useGameLoop';
import Mascot, { MAX_WOUNDS } from '../components/Mascot';
import { pickGameWord } from '../data/gameWords';
import { getGameBest, saveGameBest } from '../utils/storage';

// 판 안의 가로 위치는 모두 판 너비 비율(0 왼쪽 → 1 오른쪽)
const MASCOT_X = 0.14; // 타닥이가 달리는 자리 (몸 가운데)
const SPAWN_X = 1.08; // 장애물이 처음 나타나는 자리 (판 오른쪽 바깥)
const HIT_X = MASCOT_X + 0.03; // 장애물이 여기까지 오면 부딪힌다
const MIN_GAP_PX = 130; // 앞뒤 장애물 사이 최소 간격 — 낱말 표가 서로 겹치지 않게
const METERS_PER_FIELD = 50; // 판 한 폭을 달리면 50m
const METERS_PER_STAGE = 100; // 이만큼 달릴 때마다 단계 UP (빨라진다)
const JUMP_SECONDS = 0.6;
const STUMBLE_SECONDS = 0.9; // 부딪혀 넘어진 동안은 느려진다
const STAR_SECONDS = 5;
const ITEM_CHANCE = 0.1;
const MOOD_SECONDS = 0.7;
const TALK_SECONDS = 1.4;

// 단계가 오를수록 빨라지고(판 너비/초) 장애물이 자주 나온다
// 처음부터 너무 느리지 않게 시작하고, 단계마다 확 빨라진다 (최고 속도에서도 낱말을 칠 시간은 2초쯤)
const runSpeed = (stage) => Math.min(0.18 + 0.03 * (stage - 1), 0.5);
const spawnEvery = (stage) => Math.max(0.85, 2.0 - 0.15 * (stage - 1)) * (0.8 + Math.random() * 0.45);
// 콤보 5마다 점수 배율 +0.5 (최대 3배)
const multiplier = (combo) => Math.min(3, 1 + Math.floor(combo / 5) * 0.5);

const OBSTACLES = ['🪨', '🌵', '🪵', '🚧', '🍄', '🧱', '📦', '🦔'];
const ITEMS = {
  heal: { icon: '🩹', name: '구급상자', desc: '반창고 하나 떼기' },
  star: { icon: '⭐', name: '별', desc: `${STAR_SECONDS}초 동안 무적 — 장애물을 알아서 넘어요` },
};
const CLOUDS = [
  { x: 0.25, y: 14, size: 2.2, depth: 0.15 },
  { x: 0.62, y: 6, size: 1.6, depth: 0.1 },
  { x: 0.95, y: 20, size: 2.6, depth: 0.2 },
];

const pick = (list) => list[Math.floor(Math.random() * list.length)];

const freshGame = () => ({
  obstacles: [], // { id, word, icon, item, x, cleared, jumped, crashed }
  pops: [], // 아이템을 먹어서 터지는 중인 것
  clock: 0,
  distance: 0, // m
  ground: 0, // 지금까지 달린 거리 (판 너비 단위) — 땅 · 구름을 흘려보내는 데 쓴다
  points: 0, // 낱말로 얻은 점수 (거리 점수는 따로)
  stage: 1,
  combo: 0,
  cleared: 0, // 쳐서 넘은 장애물 수
  wounds: 0, // 부딪힌 횟수 — 타닥이 반창고, MAX_WOUNDS개면 게임 오버
  spawnIn: 0,
  jumpAt: null, // 점프를 시작한 시각
  stumbleUntil: 0,
  starUntil: 0,
  mood: null, // { type, until }
  talk: null, // 타닥이 말풍선 { text, until }
  popups: [],
  banner: null,
  nextId: 1,
  over: false,
});

const scoreOf = (game) => game.points + Math.floor(game.distance);

/**
 * 타닥이 달리기 — 타닥이가 계속 오른쪽으로 달리고, 장애물이 낱말을 달고 다가온다.
 * 부딪히기 전에 그 낱말을 치면 타닥이가 알아서 폴짝 넘는다. 못 치면 꽈당 넘어지고 반창고가 하나 붙는다.
 * 반창고가 5개가 되면 게임 오버. 멀리 달릴수록 빨라진다.
 * 🩹 구급상자 · ⭐ 별 아이템이 가끔 공중에 떠 있다 (쳐서 먹으면 효과, 놓쳐도 벌은 없음).
 */
export default function RunnerGame({ mode, autoStart, onModeChange, onExit }) {
  const [status, setStatus] = useState('ready'); // ready | countdown | playing | paused | over
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  const g = useRef(null);
  if (g.current === null) g.current = freshGame();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const fieldRef = useRef(null);
  const bestKey = `runner:${mode}`;
  const [best, setBest] = useState(() => getGameBest(bestKey));

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);
  const fieldWidth = () => fieldRef.current?.clientWidth || 800;

  const say = (game, text) => {
    game.talk = { text, until: game.clock + TALK_SECONDS };
  };
  const feel = (game, type, seconds = MOOD_SECONDS) => {
    game.mood = { type, until: game.clock + seconds };
  };

  const spawn = () => {
    const game = g.current;
    const word = pickGameWord(
      'runner',
      mode,
      game.obstacles.map((o) => o.word),
    );
    const item = Math.random() < ITEM_CHANCE ? pick(Object.keys(ITEMS)) : null;
    game.obstacles.push({
      id: game.nextId++,
      word,
      icon: item ? ITEMS[item].icon : pick(OBSTACLES),
      item,
      x: SPAWN_X,
      cleared: false,
      jumped: false,
      crashed: false,
    });
  };

  const start = () => {
    startGameSession('runner', mode); // 랭킹 점수는 이 판의 서버 세션으로만 올라간다
    g.current = freshGame();
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    g.current.spawnIn = 0.6; // 시작하자마자 하나 — 너무 빨리 부딪히지 않게 살짝 뒤에
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

  const gameOver = () => {
    const game = g.current;
    if (game.over) return;
    game.over = true;
    const score = scoreOf(game);
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score, level: game.stage });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({
      score,
      distance: Math.floor(game.distance),
      cleared: game.cleared,
      stage: game.stage,
      isBest,
      prev,
    });
    setStatus('over');
  };

  // 부딪힘 — 꽈당 + 반창고
  const crash = (game, obstacle) => {
    obstacle.crashed = true;
    game.wounds += 1;
    game.combo = 0;
    game.stumbleUntil = game.clock + STUMBLE_SECONDS;
    game.jumpAt = null;
    feel(game, 'sad', STUMBLE_SECONDS);
    say(game, game.wounds >= MAX_WOUNDS ? '더는 못 뛰겠어요…' : '아야!');
    addPopup(game, `🩹 ${game.wounds}/${MAX_WOUNDS}`, MASCOT_X * 100 + 4, 38, 'bad');
    if (game.wounds >= MAX_WOUNDS) gameOver();
  };

  useGameLoop((dt) => {
    const game = g.current;
    if (game.over) return; // 게임 오버 창이 뜨기 전 한 프레임 더 돌아도 거리 · 점수가 늘지 않게
    game.clock += dt;
    const stumbling = game.clock < game.stumbleUntil;
    const star = game.clock < game.starUntil;
    const speed = runSpeed(game.stage) * (stumbling ? 0.4 : 1);
    const step = speed * dt;
    game.ground += step;
    game.distance += step * METERS_PER_FIELD;

    const stage = 1 + Math.floor(game.distance / METERS_PER_STAGE);
    if (stage > game.stage) {
      game.stage = stage;
      showBanner(game, `STAGE ${stage}`, `${(stage - 1) * METERS_PER_STAGE}m 돌파! 더 빠르게`);
      say(game, '더 빨리 달려요!');
    }

    // 새 장애물 — 시간이 됐고, 맨 뒤 장애물과 충분히 떨어졌을 때
    game.spawnIn -= dt;
    const last = game.obstacles[game.obstacles.length - 1];
    const gap = MIN_GAP_PX / fieldWidth();
    if (game.spawnIn <= 0 && (!last || last.x < SPAWN_X - gap)) {
      spawn();
      game.spawnIn = spawnEvery(game.stage);
    }

    // 점프 거리의 절반 앞에서 뛰어올라야 장애물 한가운데 위를 지나간다
    const jumpFrom = MASCOT_X + (speed * JUMP_SECONDS) / 2;
    for (const o of game.obstacles) {
      o.x -= step;
      if (o.item || o.crashed) continue;
      if ((o.cleared || star) && !o.jumped && o.x <= jumpFrom) {
        o.jumped = true;
        if (game.jumpAt === null || game.clock - game.jumpAt > JUMP_SECONDS * 0.7) game.jumpAt = game.clock;
        if (!o.cleared) addPopup(game, '⭐ 무적!', o.x * 100, 30, 'fever');
      }
      if (!o.jumped && o.x <= HIT_X) {
        crash(game, o);
        if (game.over) break;
      }
    }
    if (game.jumpAt !== null && game.clock - game.jumpAt > JUMP_SECONDS) game.jumpAt = null;
    // 놓친 아이템 · 지나간 장애물은 치운다
    game.obstacles = game.obstacles.filter((o) => (o.item ? o.x > MASCOT_X - 0.06 : o.x > -0.12));

    if (game.mood && game.clock > game.mood.until) game.mood = null;
    if (game.talk && game.clock > game.talk.until) game.talk = null;
    const now = performance.now();
    game.pops = game.pops.filter((p) => now - p.at < 450);
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const { inputProps } = useGameInput({
    mode,
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      // 같은 낱말이 여럿이면 타닥이에게 가장 가까운 것부터
      const target = game.obstacles
        .filter((o) => o.word === text && !o.cleared && !o.crashed && o.x > HIT_X)
        .sort((a, b) => a.x - b.x)[0];
      if (!target) {
        game.combo = 0;
        feel(game, 'sad');
        setIsMiss(true);
        rerender();
        return;
      }
      game.combo += 1;
      const gain = Math.round((10 + text.length * 3) * game.stage * multiplier(game.combo - 1));
      game.points += gain;
      addPopup(game, `+${gain}`, target.x * 100, 30, null);

      if (target.item) {
        game.obstacles = game.obstacles.filter((o) => o !== target);
        game.pops.push({ ...target, at: performance.now() });
        if (target.item === 'heal') {
          if (game.wounds > 0) {
            game.wounds -= 1;
            say(game, '반창고 뗐다! 고마워요');
          } else {
            say(game, '아직 멀쩡해요!');
          }
        }
        if (target.item === 'star') {
          game.starUntil = game.clock + STAR_SECONDS;
          showBanner(game, '⭐ 무적', `${STAR_SECONDS}초 동안 알아서 넘어요`);
        }
        feel(game, 'cheer');
      } else {
        target.cleared = true;
        game.cleared += 1;
        feel(game, game.combo >= 10 ? 'cheer' : 'happy');
        if (game.combo >= 5 && game.combo % 5 === 0) say(game, `🔥 ${game.combo}연속!`);
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
  const star = game.clock < game.starUntil;
  const stumbling = game.clock < game.stumbleUntil;
  const jumpP = game.jumpAt === null ? 0 : Math.min(1, (game.clock - game.jumpAt) / JUMP_SECONDS);
  const jump = 4 * jumpP * (1 - jumpP); // 0 → 1(꼭대기) → 0
  let mood = game.mood?.type ?? 'happy';
  if (status === 'ready' || status === 'countdown') mood = 'idle';
  else if (!game.mood && (star || game.combo >= 10)) mood = 'cheer';

  // 아직 안 친 장애물 중 가장 가까운 것 — 이게 부딪히면 반창고 (판에서 주황 테두리로 보여 준다)
  const next = game.obstacles
    .filter((o) => !o.item && !o.cleared && !o.crashed && o.x > HIT_X)
    .sort((a, b) => a.x - b.x)[0];
  const width = fieldRef.current?.clientWidth || 800;

  return (
    <div className={`game ${star ? 'is-star' : ''}`}>
      <div className="game__hud">
        <GameStat label="거리" value={`${Math.floor(game.distance)}m`} sub={`${game.stage}단계`} />
        <GameStat label="점수" value={scoreOf(game)} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label="연속" value={game.combo} sub={`점수 ×${multiplier(game.combo)}`} />
        <GameStat
          label="반창고"
          value={game.wounds ? '🩹'.repeat(game.wounds) : '없음'}
          sub={`${MAX_WOUNDS}개면 끝`}
        />
      </div>

      <div ref={fieldRef} className="game__field runner-field" style={{ '--jump': jump }}>
        {CLOUDS.map((c, i) => {
          const x = ((((c.x - game.ground * c.depth) % 1.3) + 1.3) % 1.3) - 0.15;
          return (
            <span
              key={i}
              className="runner-cloud"
              style={{ left: `${x * 100}%`, top: `${c.y}%`, fontSize: `${c.size}rem` }}
              aria-hidden="true"
            >
              ☁️
            </span>
          );
        })}

        <div className="runner-ground" style={{ backgroundPositionX: `${-((game.ground * width) % 64)}px` }} />

        {game.obstacles.map((o) => (
          <div
            key={o.id}
            className={[
              'runner-obstacle',
              o.item && `is-item is-${o.item}`,
              o.cleared && 'is-cleared',
              o.crashed && 'is-crashed',
              o === next && 'is-next',
              o.x < MASCOT_X + 0.1 && 'is-passing', // 타닥이 곁을 지나는 중 — 낱말 표가 몸을 가리지 않게 숨긴다
            ]
              .filter(Boolean)
              .join(' ')}
            style={{ left: `${o.x * 100}%` }}
          >
            <span className="runner-obstacle__word">
              {o.cleared && '✓ '}
              {o.word}
            </span>
            <span className="runner-obstacle__icon" aria-hidden="true">
              {o.icon}
            </span>
          </div>
        ))}
        {game.pops.map((p) => (
          <div key={`pop-${p.id}`} className="runner-obstacle is-item is-pop" style={{ left: `${p.x * 100}%` }} aria-hidden="true">
            <span className="runner-obstacle__icon">{p.icon}</span>
          </div>
        ))}

        <div
          className={[
            'runner-mascot',
            status === 'playing' && 'is-running',
            jump > 0 && 'is-jumping',
            stumbling && 'is-stumbling',
            star && 'is-star',
          ]
            .filter(Boolean)
            .join(' ')}
          style={{ left: `${MASCOT_X * 100}%` }}
        >
          <Mascot mood={mood} beat={game.cleared} wounds={game.wounds} bubble={!!game.talk} line={game.talk?.text} />
        </div>

        {star && <span className="runner-field__star">⭐ 무적 {Math.ceil(game.starUntil - game.clock)}초</span>}
        <Popups popups={game.popups} />
        <Banner banner={game.banner} />
      </div>

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          placeholder={mode === 'ko' ? '장애물 위 낱말을 치고 Enter' : 'Type the word on the obstacle + Enter'}
          aria-label="낱말 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🏃 타닥이 달리기"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              '타닥이가 쉬지 않고 달려요. 길에 놓인 장애물마다 낱말이 붙어 있어요.',
              '부딪히기 전에 그 낱말을 치면 타닥이가 폴짝 넘어요. 못 치면 꽈당! 반창고가 하나씩 붙어요.',
            ]}
            rules={[
              ['⌨️', '장애물 위 낱말을 치고 Enter 또는 스페이스 — 친 장애물은 ✓ 표시, 가까이 오면 알아서 점프'],
              ['🩹', `부딪히면 반창고 하나 · ${MAX_WOUNDS}개가 되면 게임 오버`],
              ['📏', `${METERS_PER_STAGE}m마다 단계 UP · 점점 빨라지고 장애물이 자주 나와요`],
              ['🔥', '연속으로 넘으면 점수 최대 3배 · 멀리 달린 거리(m)도 점수'],
              ['❌', '틀린 낱말을 내면 연속이 끊겨요'],
            ]}
            items={[
              {
                title: '아이템 · 공중에 떠 있어요, 낱말을 치면 효과 (놓쳐도 괜찮아요)',
                list: Object.values(ITEMS).map((it) => [it.icon, it.name, it.desc]),
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
          title="꽈당! 게임 오버"
          tone="over"
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <div className="runner-result">
            <Mascot mood="sad" wounds={MAX_WOUNDS} bubble={false} />
            <div>
              <p className="game-overlay__score">{result.score}점</p>
              <p>
                {result.distance}m 달림 · 장애물 {result.cleared}개 넘음 · {result.stage}단계
              </p>
              {result.isBest ? (
                <p className="game-overlay__best">최고 점수!</p>
              ) : (
                result.prev && <p>최고 점수 {result.prev.score}점</p>
              )}
            </div>
          </div>
          <RankNote game="runner" mode={mode} score={result.score} level={result.stage} />
        </GameOverlay>
      )}
    </div>
  );
}
