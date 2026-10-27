// ─── 타수 · 정확도 계산 ─────────────────────────────────────────
// 타수 = 바르게 친 키 수(타) ÷ 걸린 시간(분) — 한컴 타자연습과 같은 기준:
// 한글은 자모 하나가 1타(쌍자음은 Shift와 함께 1타, 겹모음 · 겹받침은 2타), 영문 · 문장부호 · 띄어쓰기는 1타.
import { isPrefix, toKeystrokes } from './hangul';

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
 * isComposing이 true면 마지막 글자는 아직 조합 중이라 맞고 틀림은 판정하지 않지만,
 * 목표대로 가고 있으면 지금까지 누른 자모는 타수에 바로 넣는다 ('한'을 치는 중이면 ㅎ·ㅏ·ㄴ 3타).
 */
export function compareInput(target, input, isComposing) {
  const composing = isComposing && input.length > 0;
  const judgedLength = composing ? input.length - 1 : input.length;

  let correctChars = 0;
  let correctStrokes = 0;

  for (let i = 0; i < judgedLength; i += 1) {
    if (input[i] === target[i]) {
      correctChars += 1;
      correctStrokes += countStrokes(target[i]);
    }
  }

  if (composing) {
    // '가나'를 칠 때 'ㄴ'을 누르면 잠깐 '간'이 되므로 다음 글자까지 이어서 본다
    const typed = toKeystrokes(input[judgedLength]);
    if (isPrefix(typed, toKeystrokes(target.slice(judgedLength, judgedLength + 2)))) correctStrokes += typed.length;
  }

  return { correctChars, correctStrokes, typedChars: judgedLength };
}

/**
 * 분당 타수 — 진행 중에는 첫 타부터 바로 보여 주되, 1초가 안 됐으면 1초로 나눠 숫자가 튀지 않게 한다.
 * 끝난 판(final)은 실제 걸린 시간으로 계산한다.
 */
export function calcSpeed(strokes, elapsedMs, { final = false } = {}) {
  if (strokes <= 0) return 0;
  const ms = final ? elapsedMs : Math.max(elapsedMs, 1000);
  if (ms <= 0) return 0;
  return Math.round(strokes / (ms / 60000));
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
