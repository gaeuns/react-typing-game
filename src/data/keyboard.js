// 화면 키보드 · 자리 연습용 자판 데이터 — 키는 물리 키 코드(KeyboardEvent.code)로 다룬다.
// 그래서 한글 입력기(IME)가 켜져 있든 아니든 같은 자리를 누르면 같은 키로 판정된다.

// 자리 연습에서 치는 글자 키 (위 · 가운데 · 아래 줄)
export const LETTER_ROWS = [
  ['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP'],
  ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'],
  ['KeyZ', 'KeyX', 'KeyC', 'KeyV', 'KeyB', 'KeyN', 'KeyM'],
];

// 화면 키보드에 그리는 전체 줄 (숫자 · 문장부호 · Shift · 스페이스 포함) — 실제 키보드와 같은 배열
export const KEYBOARD_ROWS = [
  [
    'Backquote', 'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6',
    'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal', 'Backspace',
  ],
  [...LETTER_ROWS[0], 'BracketLeft', 'BracketRight', 'Backslash'],
  [...LETTER_ROWS[1], 'Semicolon', 'Quote'],
  ['ShiftLeft', ...LETTER_ROWS[2], 'Comma', 'Period', 'Slash', 'ShiftRight'],
  ['Space'],
];

// 두벌식 표준 자판 (Shift를 누르면 쌍자음 · ㅒ ㅖ)
const KO = {
  KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ', KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ',
  KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ', KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ',
  KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ', KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ',
};
const KO_SHIFT = { KeyQ: 'ㅃ', KeyW: 'ㅉ', KeyE: 'ㄸ', KeyR: 'ㄲ', KeyT: 'ㅆ', KeyO: 'ㅒ', KeyP: 'ㅖ' };

// 숫자 · 문장부호 키 (Shift 없이 / Shift와 함께)
const SYMBOLS = {
  Digit1: ['1', '!'], Digit2: ['2', '@'], Digit3: ['3', '#'], Digit4: ['4', '$'], Digit5: ['5', '%'],
  Digit6: ['6', '^'], Digit7: ['7', '&'], Digit8: ['8', '*'], Digit9: ['9', '('], Digit0: ['0', ')'],
  Minus: ['-', '_'], Equal: ['=', '+'], BracketLeft: ['[', '{'], BracketRight: [']', '}'], Backslash: ['\\', '|'],
  Backquote: ['`', '~'], Semicolon: [';', ':'], Quote: ["'", '"'], Comma: [',', '<'], Period: ['.', '>'], Slash: ['/', '?'],
};

/**
 * 눌린 물리 키 → 고른 언어로 입력될 글자 (한/영 자동) — 글자 키가 아니면 null
 * 한글은 자모 하나(ㄱ, ㅏ …)를 돌려주고, 조합은 utils/hangulInput.js가 한다.
 * 영문은 Shift와 CapsLock 중 하나만 켜져 있으면 대문자.
 */
const NUMPAD = { NumpadDecimal: '.', NumpadAdd: '+', NumpadSubtract: '-', NumpadMultiply: '*', NumpadDivide: '/' };

export function charForKey(code, { shift = false, caps = false } = {}, mode) {
  if (code === 'Space') return ' ';
  if (/^Numpad\d$/.test(code)) return code.slice(6);
  if (NUMPAD[code]) return NUMPAD[code];
  if (code.startsWith('Key')) {
    if (mode === 'ko') return (shift && KO_SHIFT[code]) || KO[code];
    const letter = code.slice(3).toLowerCase();
    return shift !== caps ? letter.toUpperCase() : letter;
  }
  if (SYMBOLS[code]) return SYMBOLS[code][shift ? 1 : 0];
  return null;
}

/** 키 코드 → 화면에 보일 글자 */
export function keyLabel(code, mode) {
  if (code.startsWith('Key')) return mode === 'ko' ? KO[code] : code.slice(3).toLowerCase();
  if (SYMBOLS[code]) return SYMBOLS[code][0];
  if (code === 'Space') return mode === 'ko' ? '스페이스' : 'space';
  if (code.startsWith('Shift')) return 'Shift';
  if (code === 'Backspace') return '⌫';
  return '';
}

// 글자(자모) → 눌러야 할 키 { code, shift }
const CHAR_TO_KEY = (() => {
  const map = { ' ': { code: 'Space', shift: false } };
  for (const [code, jamo] of Object.entries(KO)) map[jamo] = { code, shift: false };
  for (const [code, jamo] of Object.entries(KO_SHIFT)) map[jamo] = { code, shift: true };
  for (const [code, [plain, shifted]] of Object.entries(SYMBOLS)) {
    map[plain] = { code, shift: false };
    map[shifted] = { code, shift: true };
  }
  for (const code of LETTER_ROWS.flat()) {
    const letter = code.slice(3);
    map[letter.toLowerCase()] = { code, shift: false };
    map[letter] = { code, shift: true };
  }
  return map;
})();

/** 한 번의 키 입력 단위(자모 · 영문자 · 문장부호)를 칠 때 누를 키 — 자판에 없는 글자는 null */
export function keyForStroke(stroke) {
  return CHAR_TO_KEY[stroke] ?? null;
}

// 키마다 맡는 손가락 (L5 = 왼손 새끼 … R5 = 오른손 새끼, T = 엄지)
const FINGERS = {
  L5: ['Backquote', 'Digit1', 'KeyQ', 'KeyA', 'KeyZ', 'ShiftLeft'],
  L4: ['Digit2', 'KeyW', 'KeyS', 'KeyX'],
  L3: ['Digit3', 'KeyE', 'KeyD', 'KeyC'],
  L2: ['Digit4', 'Digit5', 'KeyR', 'KeyT', 'KeyF', 'KeyG', 'KeyV', 'KeyB'],
  R2: ['Digit6', 'Digit7', 'KeyY', 'KeyU', 'KeyH', 'KeyJ', 'KeyN', 'KeyM'],
  R3: ['Digit8', 'KeyI', 'KeyK', 'Comma'],
  R4: ['Digit9', 'KeyO', 'KeyL', 'Period'],
  R5: [
    'Digit0', 'Minus', 'Equal', 'Backspace',
    'KeyP', 'BracketLeft', 'BracketRight', 'Backslash',
    'Semicolon', 'Quote', 'Slash', 'ShiftRight',
  ],
  T: ['Space'],
};
const FINGER_OF = Object.fromEntries(
  Object.entries(FINGERS).flatMap(([finger, codes]) => codes.map((code) => [code, finger])),
);

export const FINGER_NAME = {
  L5: '왼손 새끼',
  L4: '왼손 약지',
  L3: '왼손 중지',
  L2: '왼손 검지',
  R2: '오른손 검지',
  R3: '오른손 중지',
  R4: '오른손 약지',
  R5: '오른손 새끼',
  T: '엄지',
};

export function fingerOf(code) {
  return FINGER_OF[code] ?? null;
}

/** Shift는 치는 손의 반대쪽 새끼손가락으로 누른다 */
export function shiftFor(code) {
  return fingerOf(code)?.startsWith('L') ? 'ShiftRight' : 'ShiftLeft';
}

// 검지를 올려 두는 기준 키 (실제 키보드의 돌기)
export const HOME_BUMPS = new Set(['KeyF', 'KeyJ']);

export const STAGES = [
  { id: 'home', label: '기본 자리', rows: [1] },
  { id: 'top', label: '윗자리', rows: [0] },
  { id: 'bottom', label: '아랫자리', rows: [2] },
  { id: 'all', label: '전체', rows: [0, 1, 2] },
];

export const KEYS_PER_ROUND = 30;

/** 단계에 맞는 키를 무작위로 count개 — 같은 키가 연달아 나오지 않게 */
export function pickKeys(stageId, count = KEYS_PER_ROUND) {
  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[0];
  const pool = stage.rows.flatMap((r) => LETTER_ROWS[r]);
  const keys = [];
  while (keys.length < count) {
    const code = pool[Math.floor(Math.random() * pool.length)];
    if (code !== keys[keys.length - 1]) keys.push(code);
  }
  return keys;
}
