/**
 * 목표 문장을 글자 단위로 보여주고, 입력값과 비교해 색을 입힌다.
 * - correct: 맞게 친 글자
 * - wrong: 틀린 글자
 * - composing: 한글 조합 중인 글자 (아직 판정하지 않음)
 * - pending: 아직 안 친 글자
 */
export default function TypingBoard({ target, input, isComposing, nextSentence, onClick }) {
  const cursorIndex = isComposing ? input.length - 1 : input.length;

  return (
    <section className="board" onClick={onClick}>
      <p className="board__sentence" aria-label={target}>
        {target.split('').map((char, i) => {
          let state = 'pending';
          if (i < input.length) {
            if (isComposing && i === input.length - 1) state = 'composing';
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

      {nextSentence && (
        <p className="board__next">
          <span className="board__next-label">다음</span>
          {nextSentence}
        </p>
      )}
    </section>
  );
}
