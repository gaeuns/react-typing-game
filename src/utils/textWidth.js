/**
 * 문장이 고정폭 글꼴로 몇 em 너비인지 — 한글 같은 전각 글자는 1em, 영문 · 숫자 · 문장부호는 0.5em
 * (+ 글자 간격 0.04em). CSS가 이 값(--units)으로 글자 크기를 줄여 긴 낱말 · 문장도 칸에 들어가게 한다.
 */
export function widthUnits(text) {
  let units = 0;
  for (const char of text) units += (char.codePointAt(0) >= 0x1100 ? 1 : 0.5) + 0.04;
  return Math.max(units * 1.03, 1); // 반올림 오차로 마지막 글자가 넘어가지 않게 약간 여유
}
