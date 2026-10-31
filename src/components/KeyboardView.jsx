import { HOME_BUMPS, KEYBOARD_ROWS, fingerOf, keyLabel, shiftFor } from '../data/keyboard';

/**
 * 화면 키보드.
 * - target: 다음에 눌러야 할 키 코드 (shift가 true면 반대쪽 Shift도 같이 표시)
 * - flash: 방금 누른 키 { code, ok } — 맞으면 초록, 틀리면 빨강으로 잠깐 표시
 * - onPress: 주면 글자 키를 눌러서도 입력할 수 있다 (자리 연습 · 키보드 없는 기기)
 */
export default function KeyboardView({ mode, target, shift = false, flash, onPress }) {
  const shiftKey = target && shift ? shiftFor(target) : null;

  return (
    <div className="keyboard" aria-hidden="true">
      {KEYBOARD_ROWS.map((row, r) => (
        <div key={r} className={`keyboard__row keyboard__row--${r}`}>
          {row.map((code) => {
            const className = [
              'key',
              `key--${code}`,
              `finger-${fingerOf(code)}`,
              (code === target || code === shiftKey) && 'is-target',
              flash?.code === code && (flash.ok ? 'is-hit' : 'is-miss'),
              HOME_BUMPS.has(code) && 'has-bump',
            ]
              .filter(Boolean)
              .join(' ');

            if (onPress && code.startsWith('Key')) {
              return (
                <button
                  key={code}
                  type="button"
                  tabIndex={-1}
                  className={className}
                  onMouseDown={(e) => e.preventDefault()} // 눌러도 포커스가 원래 자리에 남게
                  onClick={() => onPress(code)}
                >
                  {keyLabel(code, mode)}
                </button>
              );
            }
            return (
              <span key={code} className={className}>
                {keyLabel(code, mode)}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}
