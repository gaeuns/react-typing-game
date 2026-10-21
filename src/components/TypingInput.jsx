import { forwardRef } from 'react';

/**
 * 실제로 글자를 입력받는 입력창.
 * 한글 조합 상태는 composition 이벤트로 부모(App)에 알려준다.
 */
const TypingInput = forwardRef(function TypingInput(
  { value, placeholder, disabled, onChange, onKeyDown, onCompositionStart, onCompositionEnd },
  ref,
) {
  return (
    <input
      ref={ref}
      className="typing-input"
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={onChange}
      onKeyDown={onKeyDown}
      onCompositionStart={onCompositionStart}
      onCompositionEnd={onCompositionEnd}
      onPaste={(e) => e.preventDefault()} // 붙여넣기 방지
      onDrop={(e) => e.preventDefault()}
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
      aria-label="여기에 문장을 입력하세요"
    />
  );
});

export default TypingInput;
