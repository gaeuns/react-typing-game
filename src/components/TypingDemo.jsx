import { useEffect, useState } from 'react';
import { toKeystrokes } from '../utils/hangul';
import { addJamo } from '../utils/hangulInput';

const PHRASES = ['타닥타닥, 손끝이 빨라져요', '오늘도 한 줄씩 쳐 볼까요?', 'The quick brown fox jumps', '천 리 길도 한 걸음부터'];
const STROKE_MS = 85;
const HOLD_MS = 1600;

const isJamo = (s) => /[ㄱ-ㅣ]/.test(s);

/** 한 줄을 키 입력 순서대로 친 모습 — 한글은 자모가 조합되는 과정까지 ['ㅌ', '타', '탁', …] */
function frames(phrase) {
  const out = [];
  let text = '';
  let composing = false;
  for (const stroke of toKeystrokes(phrase)) {
    if (isJamo(stroke)) ({ text, composing } = addJamo(text, composing, stroke));
    else {
      text += stroke;
      composing = false;
    }
    out.push(text);
  }
  return out;
}

const ALL_FRAMES = PHRASES.map(frames);
const REDUCED =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** 메인 화면의 저절로 쳐지는 문장 (꾸밈) */
export default function TypingDemo() {
  const [step, setStep] = useState({ phrase: 0, frame: 0 });

  useEffect(() => {
    if (REDUCED) return undefined;
    const list = ALL_FRAMES[step.phrase];
    const atEnd = step.frame >= list.length - 1;
    const id = setTimeout(
      () =>
        setStep(atEnd ? { phrase: (step.phrase + 1) % PHRASES.length, frame: 0 } : { ...step, frame: step.frame + 1 }),
      atEnd ? HOLD_MS : STROKE_MS,
    );
    return () => clearTimeout(id);
  }, [step]);

  const text = REDUCED ? PHRASES[0] : ALL_FRAMES[step.phrase][step.frame];
  return (
    <p className="typing-demo" aria-hidden="true">
      <span className="typing-demo__text">{text}</span>
      <span className="typing-demo__caret" />
    </p>
  );
}
