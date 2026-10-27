import { useRef } from 'react';
import { isPrefix, toKeystrokes } from '../utils/hangul';
import { widthUnits } from '../utils/textWidth';

/**
 * 목표 문장을 글자 단위로 보여주고, 입력값과 비교해 색을 입힌다.
 * - correct: 맞게 친 글자
 * - wrong: 틀린 글자
 * - composing: 한글 조합 중인 글자 — 자모가 목표 글자대로 가고 있으면 composing, 벗어나면 바로 wrong
 * - pending: 아직 안 친 글자
 *
 * upcoming: 다음에 칠 것들 — 'inline'(낱말: 한 줄에 이어서) 또는 'lines'(문장 · 장문: 줄마다)
 * title: 장문 연습의 작품 이름
 * titles · onTitleChange: 주면 작품 이름 자리가 작품 고르기 목록이 된다
 *   onTitleChange(title, { keepFocus }) — 화살표로 훑는 중이면 keepFocus: true (목록에 포커스를 남긴다)
 * onTitleDone: 목록에서 Enter — 입력창으로
 */
export default function TypingBoard({
  target,
  input,
  isComposing,
  title,
  titles,
  onTitleChange,
  onTitleDone,
  upcoming = [],
  upcomingLayout = 'lines',
  onClick,
}) {
  const cursorIndex = isComposing && input.length > 0 ? input.length - 1 : input.length;
  // 닫힌 목록에서 화살표를 누르면 브라우저가 바로 change를 보낸다 — 그때는 입력창으로 넘어가지 않고 계속 고를 수 있게
  const browsingByKey = useRef(false);

  return (
    <section className="board" onClick={onClick}>
      {title && !titles && <p className="board__title">{title}</p>}
      {title && titles && (
        // 판을 누르면 입력창으로 포커스가 가므로, 목록을 누를 땐 판까지 올라가지 않게 막는다
        <label className="passage-picker" onClick={(e) => e.stopPropagation()}>
          <span className="passage-picker__label">작품</span>
          <select
            className="passage-picker__select"
            value={title}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onTitleDone();
                return;
              }
              browsingByKey.current = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key);
            }}
            onChange={(e) => {
              onTitleChange(e.target.value, { keepFocus: browsingByKey.current });
              browsingByKey.current = false;
            }}
            aria-label="장문 작품 고르기"
          >
            {titles.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="board__sentence" aria-label={target} style={{ '--units': widthUnits(target) }}>
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
          <span className="board__next-text board__next-words">{upcoming.join('  ·  ')}</span>
        </p>
      )}

      {upcoming.length > 0 &&
        upcomingLayout === 'lines' &&
        upcoming.map((line, i) => (
          <p key={i} className={`board__next ${i > 0 ? 'board__next--more' : ''}`}>
            <span className={`pill-label ${i > 0 ? 'is-blank' : ''}`} aria-hidden={i > 0}>
              다음
            </span>
            <span className="board__next-text">{line}</span>
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
