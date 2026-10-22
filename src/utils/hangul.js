// ─── 한글 → 두벌식 키 입력 순서 ────────────────────────────────
// "과" → ['ㄱ', 'ㅗ', 'ㅏ'], "값" → ['ㄱ', 'ㅏ', 'ㅂ', 'ㅅ']
// 조합 중인 글자가 맞게 가고 있는지, 다음에 어떤 키를 눌러야 하는지 알아내는 데 쓴다.

const CHO = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
const JUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

// 두 번 눌러야 하는 겹모음 · 겹받침 (쌍자음 ㄲ ㄸ … 은 Shift + 한 번이라 쪼개지 않는다)
const SPLIT = {
  ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ',
  ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ',
};

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

const split = (jamo) => (SPLIT[jamo] ? [...SPLIT[jamo]] : jamo ? [jamo] : []);

/** 문자열을 키 입력 단위로 펼친다 (한글이 아닌 글자는 그대로 한 칸) */
export function toKeystrokes(text) {
  const keys = [];
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= HANGUL_START && code <= HANGUL_END) {
      const offset = code - HANGUL_START;
      keys.push(CHO[Math.floor(offset / 588)]);
      keys.push(...split(JUNG[Math.floor((offset % 588) / 28)]));
      keys.push(...split(JONG[offset % 28]));
    } else {
      keys.push(...split(char));
    }
  }
  return keys;
}

/** a가 b의 앞부분인지 */
export function isPrefix(a, b) {
  return a.length <= b.length && a.every((key, i) => key === b[i]);
}
