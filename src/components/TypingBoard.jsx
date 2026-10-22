import { isPrefix, toKeystrokes } from '../utils/hangul';

/**
 * 목표 문장을 글자 단위로 보여주고, 입력값과 비교해 색을 입힌다.
 * - correct: 맞게 친 글자
 * - wrong: 틀린 글자
 * - composing: 한글 조합 중인 글자 — 자모가 목표 글자대로 가고 있으면 composing, 벗어나면 바로 wrong
 * - pending: 아직 안 친 글자
 *
 * upcoming: 다음에 칠 것들 — 'inline'(낱말: 한 줄에 이어서) 또는 'lines'(문장 · 장문: 줄마다)
 * title: 장문 연습의 작품 이름
 */
export default function TypingBoard({
  target,
  input,
  isComposing,
  title,
  upcoming = [],
  upcomingLayout = 'lines',
  onClick,
}) {
  const cursorIndex = isComposing && input.length > 0 ? input.length - 1 : input.length;

  return (
    <section className="board" onClick={onClick}>
      {title && <p className="board__title">{title}</p>}

      <p className="board__sentence" aria-label={target}>
        {target.split('').map((char, i) => {
          let state = 'pending';
          if (i < input.length) {
            if (isComposing && i === input.length - 1) state = isOnTrack(input[i], target, i) ? 'composing' : 'wrong';
            else state = input[i] === char ? 'correct' : 'wrong';
          }
          const isSpace = char === ' ';

          return (
            <span
              key={i}
              className={[
                'char',
                `char--${state}`,
                isSpace && 'char--space',
                i === cursorIndex && 'char--cursor',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {char}
            </span>
          );
        })}
        {cursorIndex >= target.length && <span className="char char--cursor char--end"> </span>}
      </p>

      {upcoming.length > 0 && upcomingLayout === 'inline' && (
        <p className="board__next">
          <span className="pill-label">다음</span>
          <span className="board__next-words">{upcoming.join('  ·  ')}</span>
        </p>
      )}

      {upcoming.length > 0 &&
        upcomingLayout === 'lines' &&
        upcoming.map((line, i) => (
          <p key={i} className={`board__next ${i > 0 ? 'board__next--more' : ''}`}>
            <span className={`pill-label ${i > 0 ? 'is-blank' : ''}`} aria-hidden={i > 0}>
              다음
            </span>
            {line}
          </p>
        ))}
    </section>
  );
}

/**
 * 조합 중인 글자가 목표대로 가고 있는지 — 자모 순서가 목표 글자의 앞부분이면 OK.
 * 다음 글자까지 이어서 보는 이유: '가나'를 칠 때 'ㄴ'을 누르면 잠깐 '간'이 되기 때문 (도깨비불 현상)
 */
function isOnTrack(char, target, i) {
  return isPrefix(toKeystrokes(char), toKeystrokes(target.slice(i, i + 2)));
}
