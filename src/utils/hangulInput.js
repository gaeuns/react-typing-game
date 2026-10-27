// ─── 한/영 자동 입력 ────────────────────────────────────────────
// 운영체제 입력기(한/영 키) 상태와 상관없이, 고른 언어대로 글자를 넣는다.
// 키보드가 있는 기기에서는 입력창을 읽기 전용으로 두고(입력기가 끼어들지 않게) 눌린 물리 키(code)를
// 직접 글자로 바꾼다. 한글은 두벌식 규칙대로 여기서 조합한다 — 마지막 글자는 "조합 중"(composing).
// 터치 기기(화면 키보드)는 운영체제 입력기를 그대로 쓴다.
import { charForKey } from '../data/keyboard';
import { CHO, JONG, JUNG } from './hangul';

/** 키보드(정밀 포인터)가 있는 기기에서만 켠다 — 폰 · 태블릿은 화면 키보드의 언어 전환을 그대로 */
export const AUTO_LANG =
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: fine)').matches;

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

// 두 키로 만드는 겹모음 · 겹받침
const VOWEL_PAIR = { ㅗㅏ: 'ㅘ', ㅗㅐ: 'ㅙ', ㅗㅣ: 'ㅚ', ㅜㅓ: 'ㅝ', ㅜㅔ: 'ㅞ', ㅜㅣ: 'ㅟ', ㅡㅣ: 'ㅢ' };
const JONG_PAIR = {
  ㄱㅅ: 'ㄳ', ㄴㅈ: 'ㄵ', ㄴㅎ: 'ㄶ', ㄹㄱ: 'ㄺ', ㄹㅁ: 'ㄻ', ㄹㅂ: 'ㄼ', ㄹㅅ: 'ㄽ', ㄹㅌ: 'ㄾ', ㄹㅍ: 'ㄿ', ㄹㅎ: 'ㅀ', ㅂㅅ: 'ㅄ',
};
const SPLIT_VOWEL = Object.fromEntries(Object.entries(VOWEL_PAIR).map(([pair, v]) => [v, [...pair]]));
const SPLIT_JONG = Object.fromEntries(Object.entries(JONG_PAIR).map(([pair, j]) => [j, [...pair]]));

const isVowel = (jamo) => JUNG.includes(jamo);
const isConsonant = (jamo) => CHO.includes(jamo) || (jamo !== '' && JONG.includes(jamo));
const isJamo = (char) => isVowel(char) || isConsonant(char);

const compose = (cho, jung, jong = '') =>
  String.fromCharCode(HANGUL_START + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong));

function decompose(char) {
  const code = char.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return null;
  const offset = code - HANGUL_START;
  return { cho: CHO[Math.floor(offset / 588)], jung: JUNG[Math.floor((offset % 588) / 28)], jong: JONG[offset % 28] };
}

/** 자모 하나를 더한다 — composing: 마지막 글자가 아직 조합 중인지 */
export function addJamo(text, composing, jamo) {
  const last = composing ? text.slice(-1) : '';
  const head = text.slice(0, text.length - last.length);
  const done = (next) => ({ text: next, composing: true });
  if (!last) return done(text + jamo);

  const s = decompose(last);
  if (isVowel(jamo)) {
    if (s && !s.jong) {
      const v = VOWEL_PAIR[s.jung + jamo];
      return done(v ? head + compose(s.cho, v) : text + jamo);
    }
    if (s) {
      // 받침이 다음 글자의 첫소리로 넘어간다 (값 + ㅏ → 갑사)
      const pair = SPLIT_JONG[s.jong];
      if (pair) return done(head + compose(s.cho, s.jung, pair[0]) + compose(pair[1], jamo));
      if (CHO.includes(s.jong)) return done(head + compose(s.cho, s.jung) + compose(s.jong, jamo));
      return done(text + jamo);
    }
    if (CHO.includes(last)) return done(head + compose(last, jamo)); // 자음 하나 + 모음
    if (SPLIT_JONG[last]) return done(head + SPLIT_JONG[last][0] + compose(SPLIT_JONG[last][1], jamo)); // ㄳ + ㅏ → ㄱ사
    const v = isVowel(last) && VOWEL_PAIR[last + jamo];
    return done(v ? head + v : text + jamo);
  }

  // 자음
  if (s && !s.jong) return done(JONG.includes(jamo) ? head + compose(s.cho, s.jung, jamo) : text + jamo);
  if (s) {
    const jj = JONG_PAIR[s.jong + jamo];
    return done(jj ? head + compose(s.cho, s.jung, jj) : text + jamo);
  }
  const pair = JONG_PAIR[last + jamo]; // 자음 둘 → 겹자음 (ㄱ + ㅅ → ㄳ, 윈도 입력기와 같게)
  return done(pair ? head + pair : text + jamo);
}

/** 백스페이스 — 조합 중이면 자모 하나씩 (값 → 갑 → 가 → ㄱ → 없음), 아니면 글자 하나 */
export function backspace(text, composing) {
  if (!text) return { text, composing: false };
  if (!composing) return { text: text.slice(0, -1), composing: false };
  const last = text.slice(-1);
  const head = text.slice(0, -1);
  const s = decompose(last);
  if (s) {
    if (s.jong) return { text: head + compose(s.cho, s.jung, SPLIT_JONG[s.jong]?.[0] ?? ''), composing: true };
    if (SPLIT_VOWEL[s.jung]) return { text: head + compose(s.cho, SPLIT_VOWEL[s.jung][0]), composing: true };
    return { text: head + s.cho, composing: true };
  }
  if (SPLIT_VOWEL[last]) return { text: head + SPLIT_VOWEL[last][0], composing: true };
  if (SPLIT_JONG[last]) return { text: head + SPLIT_JONG[last][0], composing: true };
  return { text: head, composing: false };
}

/**
 * 키 하나를 입력값에 반영한다. 다룰 키가 아니면 null (Ctrl · Alt 조합, 방향키, Enter 등).
 * 결과: { text, composing }
 */
export function applyKey(text, composing, e, mode) {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.code === 'Backspace') return backspace(text, composing);
  const char = charForKey(e.code, { shift: e.shiftKey, caps: e.getModifierState?.('CapsLock') }, mode);
  if (char === null) return null;
  if (mode === 'ko' && isJamo(char)) return addJamo(text, composing, char);
  return { text: text + char, composing: false };
}
