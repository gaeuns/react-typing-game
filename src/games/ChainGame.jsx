import { useEffect, useReducer, useRef, useState } from 'react';
import GameOverlay from './GameOverlay';
import RankNote from './RankNote';
import GameStat from './GameStat';
import { Banner, Countdown, DangerBar, GameGuide, Hearts, Popups, addPopup, pruneEffects, showBanner } from './GameBits';
import useGameInput from './useGameInput';
import useGameLoop from './useGameLoop';
import Mascot from '../components/Mascot';
import { CHAIN_WORDS, chainAnswers, followsChain, pickChainWord, startChars } from '../data/chainWords';
import { toChosung } from '../utils/hangul';
import { getGameBest, saveGameBest } from '../utils/storage';
import { widthUnits } from '../utils/textWidth';

const START_HEARTS = 3;
const WORDS_PER_LEVEL = 6;
const THINK_SECONDS = 0.7; // 타닥이가 낱말을 고르는 척하는 시간 (이동안 내 시간은 안 흐른다)
const HINT_AT = 0.5; // 차례 시간이 이만큼 남으면 힌트
const KNOCKOUT_BONUS = 50; // 한방 단어 — 타닥이가 못 이으면
const MESSAGE_SECONDS = 1.6;
const MOOD_SECONDS = 0.9;
const SHOWN_CHAIN = 8; // 화면에 보이는 지난 낱말 수

// 차례마다 주는 시간(초) — 1단계 12초에서 단계마다 1.2초씩 줄어 최소 5초
const turnSeconds = (level) => Math.max(5, 12 - (level - 1) * 1.2);
// 타닥이가 낼 낱말 — 내가 받아칠 낱말이 이만큼은 남게 (단계가 오르면 받아치기 어려운 낱말도 낸다)
const minAnswers = (level) => (level >= 3 ? 1 : level === 2 ? 2 : 3);
const levelOf = (count) => Math.floor(count / WORDS_PER_LEVEL) + 1;

const freshGame = () => ({
  chain: [], // [{ id, word, by: 'cpu' | 'me' | 'break' }]
  used: new Set(),
  cpuWord: null,
  pending: null, // 타닥이가 곧 말할 낱말
  thinking: 0,
  left: 0,
  limit: 1,
  hint: null,
  hearts: START_HEARTS,
  score: 0,
  combo: 0,
  count: 0, // 내가 이은 낱말 수
  longest: '',
  clock: 0,
  mood: null,
  message: null,
  popups: [],
  banner: null,
  nextId: 1,
  over: false,
});

/** 타닥이 차례 — prev 다음 낱말을 고른다. 이을 낱말이 없으면 한방! 새 낱말로 다시 시작 */
function cpuTurn(game, prev) {
  let word = prev ? pickChainWord(prev, game.used, minAnswers(levelOf(game.count))) : null;
  if (prev && !word) {
    game.score += KNOCKOUT_BONUS;
    showBanner(game, '💥 한방 단어!', `타닥이가 못 이었어요 · +${KNOCKOUT_BONUS}점`);
    game.mood = { type: 'sad', until: game.clock + MOOD_SECONDS * 2 };
    game.chain.push({ id: game.nextId++, word: '💥', by: 'break' });
  }
  if (!word) word = pickChainWord(null, game.used, minAnswers(levelOf(game.count)));
  game.pending = word;
  game.cpuWord = null;
  game.thinking = THINK_SECONDS;
}

/**
 * 끝말잇기 타자 — 타닥이가 낸 낱말의 끝 글자로 시작하는 낱말을 제한 시간 안에 친다.
 * 사전(data/chainWords.js)에 있는 두 글자 이상 낱말만, 한 판에 같은 낱말은 한 번만. 두음법칙 OK (력 → 역).
 * 시간 안에 못 치면 하트 -1, 하트가 다 떨어지면 끝. 타닥이가 못 잇는 낱말을 치면 한방 보너스.
 * 한글 전용.
 */
export default function ChainGame({ autoStart, onExit }) {
  const mode = 'ko';
  const [status, setStatus] = useState('ready'); // ready | countdown | playing | paused | over
  const [isMiss, setIsMiss] = useState(false);
  const [result, setResult] = useState(null);
  const g = useRef(null);
  if (g.current === null) g.current = freshGame();
  const [, rerender] = useReducer((x) => x + 1, 0);
  const inputRef = useRef(null);
  const bestKey = 'chain:ko';
  const [best, setBest] = useState(() => getGameBest(bestKey));

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);

  const start = () => {
    g.current = freshGame();
    setResult(null);
    setStatus('countdown');
  };

  const begin = () => {
    cpuTurn(g.current, null);
    showBanner(g.current, '🔗 끝말잇기', '타닥이가 먼저 시작해요!');
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
    if (g.current.over) return;
    g.current.over = true;
    const { score, count, longest } = g.current;
    const level = levelOf(count);
    const prev = getGameBest(bestKey);
    const isBest = saveGameBest(bestKey, { score, level });
    if (isBest) setBest(getGameBest(bestKey));
    setResult({ score, count, longest, level, isBest, prev });
    setStatus('over');
  };

  const say = (game, text, tone = 'bad') => {
    game.message = { text, tone, until: game.clock + MESSAGE_SECONDS };
  };

  useGameLoop((dt) => {
    const game = g.current;
    game.clock += dt;
    if (game.mood && game.clock > game.mood.until) game.mood = null;
    if (game.message && game.clock > game.message.until) game.message = null;

    if (game.pending) {
      game.thinking -= dt;
      if (game.thinking <= 0) {
        const word = game.pending;
        game.pending = null;
        game.cpuWord = word;
        game.used.add(word);
        game.chain.push({ id: game.nextId++, word, by: 'cpu' });
        game.limit = turnSeconds(levelOf(game.count));
        game.left = game.limit;
        game.hint = null;
      }
    } else if (game.cpuWord) {
      game.left -= dt;
      if (!game.hint && game.left / game.limit <= HINT_AT) {
        const answers = chainAnswers(game.cpuWord, game.used);
        const pick = answers[Math.floor(Math.random() * answers.length)];
        if (pick) game.hint = pick[0] + toChosung(pick.slice(1));
      }
      if (game.left <= 0) {
        // 시간 초과 → 하트 하나, 타닥이가 새 낱말로 다시 시작
        const example = chainAnswers(game.cpuWord, game.used)[0];
        game.hearts -= 1;
        game.combo = 0;
        game.mood = { type: 'happy', until: game.clock + MOOD_SECONDS };
        addPopup(game, '💔', 50, 30, 'bad');
        say(game, example ? `⏰ 시간 초과! 「${example}」 같은 낱말이 있었어요` : '⏰ 시간 초과!');
        game.chain.push({ id: game.nextId++, word: '⏰', by: 'break' });
        if (game.hearts <= 0) gameOver();
        else cpuTurn(game, null);
      }
    }
    pruneEffects(game);
    rerender();
  }, status === 'playing');

  const miss = (game, text) => {
    say(game, text);
    game.combo = 0;
    setIsMiss(true);
    rerender();
  };

  const { inputProps } = useGameInput({
    mode,
    onSubmit: (text) => {
      if (status !== 'playing') return;
      const game = g.current;
      if (!game.cpuWord) {
        miss(game, '타닥이 차례예요 — 낱말이 나오면 쳐요');
        return;
      }
      const starts = startChars(game.cpuWord.slice(-1));
      if (!followsChain(game.cpuWord, text)) {
        miss(game, `「${starts.join('」 또는 「')}」(으)로 시작해야 해요`);
        return;
      }
      if (text.length < 2) {
        miss(game, '두 글자 이상 낱말만 돼요');
        return;
      }
      if (game.used.has(text)) {
        miss(game, '이번 판에 벌써 나온 낱말이에요');
        return;
      }
      if (!CHAIN_WORDS.has(text)) {
        miss(game, `「${text}」은(는) 타닥이 사전에 없어요`);
        return;
      }

      const level = levelOf(game.count);
      const gain = 10 * level + 5 * text.length + Math.round((game.left / game.limit) * 10);
      game.score += gain;
      game.combo += 1;
      game.count += 1;
      if (text.length > game.longest.length) game.longest = text;
      game.used.add(text);
      game.chain.push({ id: game.nextId++, word: text, by: 'me' });
      game.mood = { type: game.combo >= 5 ? 'cheer' : 'happy', until: game.clock + MOOD_SECONDS };
      addPopup(game, `+${gain}`, 50, 62, null);
      say(game, '좋아요! 이번엔 타닥이 차례', 'good');
      if (levelOf(game.count) > level) {
        showBanner(game, `LEVEL ${levelOf(game.count)}`, `차례 시간 ${turnSeconds(levelOf(game.count)).toFixed(1)}초 · 낱말이 어려워져요`);
      }
      cpuTurn(game, text);
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
  const level = levelOf(game.count);
  const starts = game.cpuWord ? startChars(game.cpuWord.slice(-1)) : [];
  const shownChain = game.chain.slice(-SHOWN_CHAIN);
  const mood = game.mood?.type ?? (game.pending ? 'idle' : 'happy');

  return (
    <div className="game">
      <div className="game__hud">
        <GameStat label="단계" value={level} sub={`이은 낱말 ${game.count}개`} />
        <GameStat label="점수" value={game.score} sub={`최고 ${best ? best.score : 0}`} />
        <GameStat label="연속" value={game.combo} />
        <div className="game-stat">
          <span className="game-stat__label">하트</span>
          <Hearts count={game.hearts} max={START_HEARTS} />
        </div>
      </div>

      <DangerBar
        label={game.hearts === 1 ? '⚠️ 하트 1개! 이번엔 꼭 이어요' : '⏳ 시간 안에 이어요 · 못 이으면 ❤️ -1'}
        ratio={status === 'playing' && game.cpuWord ? 1 - game.left / game.limit : 0}
        detail={status === 'playing' && game.cpuWord ? `${Math.max(0, game.left).toFixed(1)}초` : null}
      />

      <div className="game__field chain-field">
        <ol className="chain-trail" aria-label="지금까지 이은 낱말">
          {shownChain.map((c) => (
            <li key={c.id} className={`chain-trail__word is-${c.by}`}>
              {c.word}
            </li>
          ))}
        </ol>

        <div className="chain-turn">
          <Mascot mood={mood} beat={game.chain.length} bubble={false} />
          <div className="chain-turn__speech" role="status" aria-live="polite">
            {game.cpuWord ? (
              <>
                <span className="chain-turn__word" style={{ '--units': widthUnits(game.cpuWord) }}>
                  {game.cpuWord.slice(0, -1)}
                  <mark>{game.cpuWord.slice(-1)}</mark>
                </span>
                <span className="chain-turn__ask">
                  「{starts.join('」 · 「')}」(으)로 시작하는 낱말!
                </span>
              </>
            ) : (
              <span className="chain-turn__thinking">타닥이가 생각 중…</span>
            )}
          </div>
        </div>

        <p className={`chain-field__message ${game.message ? `is-${game.message.tone}` : ''}`} aria-live="polite">
          {game.message?.text ?? (game.hint ? `💡 힌트: ${game.hint}` : ' ')}
        </p>
        <Popups popups={game.popups} />
        <Banner banner={game.banner} />
      </div>

      <div className="game__input-row">
        <input
          ref={inputRef}
          className={`game-input ${isMiss ? 'is-miss' : ''}`}
          onAnimationEnd={() => setIsMiss(false)}
          placeholder={starts.length ? `「${starts[0]}」(으)로 시작하는 낱말 + Enter` : '낱말을 치고 Enter'}
          aria-label="낱말 입력"
          onBlur={() => status === 'playing' && setStatus('paused')}
          {...inputProps}
        />
      </div>

      {status === 'ready' && (
        <GameOverlay
          title="🔗 끝말잇기 타자"
          primary={{ label: '시작하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <GameGuide
            intro={[
              '타닥이와 끝말잇기! 타닥이가 낸 낱말의 끝 글자로 시작하는 낱말을 시간 안에 쳐요.',
              `타닥이 사전에 있는 낱말 ${CHAIN_WORDS.size.toLocaleString()}개만 쓸 수 있어요. 타닥이가 못 잇는 낱말을 치면 한방 승리!`,
            ]}
            rules={[
              ['🔗', '끝 글자로 시작하는 낱말을 치고 Enter 또는 스페이스'],
              ['📖', '두 글자 이상 · 사전에 있는 낱말 · 한 판에 한 번씩만'],
              ['🔁', '두음법칙 OK — 「력」 다음에 「역도」, 「로」 다음에 「노래」'],
              ['⏳', `차례 시간 ${turnSeconds(1)}초 · 단계마다 짧아져요 (최소 ${turnSeconds(99)}초)`],
              ['💔', '시간 안에 못 이으면 하트 -1 · 하트를 다 잃으면 끝'],
            ]}
            items={[
              {
                title: '보너스',
                list: [
                  ['💥', '한방 단어', `타닥이가 이을 낱말이 없으면 +${KNOCKOUT_BONUS}점`],
                  ['💡', '힌트', '차례 시간이 절반 남으면 쓸 수 있는 낱말 하나를 초성으로 알려 줘요'],
                  ['📏', '긴 낱말', '글자가 많을수록 점수가 커요'],
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
          title="게임 오버"
          tone="over"
          primary={{ label: '다시 하기', onClick: start }}
          secondary={{ label: '게임 목록', onClick: onExit }}
        >
          <p className="game-overlay__score">{result.score}점</p>
          <p>
            {result.level}단계 · 낱말 {result.count}개 이음
            {result.longest && ` · 가장 긴 낱말 「${result.longest}」`}
          </p>
          {result.isBest ? (
            <p className="game-overlay__best">최고 점수!</p>
          ) : (
            result.prev && <p>최고 점수 {result.prev.score}점</p>
          )}
          <RankNote game="chain" mode={mode} score={result.score} level={result.level} />
        </GameOverlay>
      )}
    </div>
  );
}
