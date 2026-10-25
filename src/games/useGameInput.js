import { useRef, useState } from 'react';

/**
 * 게임용 입력창 — 낱말을 치고 Enter(또는 스페이스)로 낸다.
 *
 * 한글 입력기 함정: 마지막 글자를 조합하는 중에 Enter/스페이스를 누르면
 * keydown은 "조합 중"으로 오고, 글자는 그 뒤 compositionend에서야 확정된다.
 * 그래서 조합 중에 누른 제출 키는 기억해 뒀다가 조합이 끝나는 순간 낸다.
 *
 * onSubmit(text): 낸 낱말 (앞뒤 공백 제거, 빈 문자열은 무시)
 * onKey(e): 그 밖의 keydown (아이템 숫자키 · Esc 등) — true를 돌려주면 기본 처리를 막는다
 */
export default function useGameInput({ onSubmit, onKey }) {
  const [value, setValue] = useState('');
  const composing = useRef(false);
  const submitAfterCompose = useRef(false);

  const submit = (text) => {
    setValue('');
    const word = text.trim();
    if (word) onSubmit(word);
  };

  const inputProps = {
    value,
    onChange: (e) => {
      // 확정용으로 친 스페이스만 남은 경우는 비운다
      setValue(e.target.value.trim() === '' ? '' : e.target.value);
    },
    onCompositionStart: () => {
      composing.current = true;
    },
    onCompositionEnd: (e) => {
      composing.current = false;
      if (submitAfterCompose.current) {
        submitAfterCompose.current = false;
        submit(e.target.value);
      }
    },
    onKeyDown: (e) => {
      if (onKey?.(e)) {
        e.preventDefault();
        return;
      }
      // 조합 중 keydown은 입력기에 따라 key가 'Enter'·' '로 오기도(Mac) 'Process'로 오기도(Windows) 해서
      // 물리 키(code)도 같이 본다
      const isSubmitKey =
        e.key === 'Enter' || e.key === ' ' || ['Enter', 'NumpadEnter', 'Space'].includes(e.nativeEvent.code);
      if (!isSubmitKey) return;
      if (e.nativeEvent.isComposing || composing.current) {
        submitAfterCompose.current = true;
        return;
      }
      e.preventDefault();
      submit(e.target.value);
    },
    autoComplete: 'off',
    autoCorrect: 'off',
    autoCapitalize: 'off',
    spellCheck: false,
    onPaste: (e) => e.preventDefault(),
    onDrop: (e) => e.preventDefault(),
  };

  return { value, setValue, inputProps };
}
