// ─── 타수 · 정확도 계산 ─────────────────────────────────────────

// 두 번 눌러야 입력되는 겹모음 (ㅘ ㅙ ㅚ ㅝ ㅞ ㅟ ㅢ) — 중성 인덱스
const COMPOUND_JUNG = new Set([9, 10, 11, 14, 15, 16, 19]);
// 두 번 눌러야 입력되는 겹받침 (ㄳ ㄵ ㄶ ㄺ ㄻ ㄼ ㄽ ㄾ ㄿ ㅀ ㅄ) — 종성 인덱스
const COMPOUND_JONG = new Set([3, 5, 6, 9, 10, 11, 12, 13, 14, 15, 18]);

const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;

/**
 * 한 글자를 치는 데 필요한 키 입력 수(타).
 * 한글 완성형 글자는 초성 + 중성 + 종성으로 분해해서 센다.
 * 예) '가' = 2타, '한' = 3타, '왔' = 4타 (ㅇ + ㅗ + ㅏ + ㅆ)
 */
export function countStrokes(char) {
  const code = char.charCodeAt(0);
  if (code < HANGUL_START || code > HANGUL_END) return 1;

  const offset = code - HANGUL_START;
  const jung = Math.floor((offset % 588) / 28);
  const jong = offset % 28;

  let strokes = 1; // 초성
  strokes += COMPOUND_JUNG.has(jung) ? 2 : 1;
  if (jong !== 0) strokes += COMPOUND_JONG.has(jong) ? 2 : 1;
  return strokes;
}

/**
 * 입력값과 목표 문장을 비교해 글자별 상태와 통계를 돌려준다.
 * isComposing이 true면 마지막 글자는 아직 조합 중이므로 판정하지 않는다.
 */
export function compareInput(target, input, isComposing) {
  const judgedLength = isComposing ? Math.max(input.length - 1, 0) : input.length;

  let correctChars = 0;
  let correctStrokes = 0;

  for (let i = 0; i < judgedLength; i += 1) {
    if (input[i] === target[i]) {
      correctChars += 1;
      correctStrokes += countStrokes(target[i]);
    }
  }

  return { correctChars, correctStrokes, typedChars: judgedLength };
}

/**
 * 분당 타수 — 진행 중에는 시작 직후 숫자가 튀지 않게 1초 전까지 0,
 * 끝난 판(final)은 1초 안에 끝났어도 실제 시간으로 계산한다.
 */
export function calcSpeed(strokes, elapsedMs, { final = false } = {}) {
  if (elapsedMs <= 0 || (!final && elapsedMs < 1000)) return 0;
  return Math.round(strokes / (elapsedMs / 60000));
}

/** 정확도 (%) */
export function calcAccuracy(correct, typed) {
  if (typed === 0) return 100;
  return Math.round((correct / typed) * 1000) / 10;
}

/** ms → "0:42" 형식 */
export function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = String(totalSeconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}
