// 키 입력 효과음 — 파일 없이 Web Audio로 짧은 소리를 만든다.
// 켜고 끄기는 localStorage에 저장 (막혀 있어도 앱이 죽지 않도록 try/catch)

const SOUND_KEY = 'tadak:sound';

let enabled = (() => {
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
})();

let ctx = null;

/** 처음 소리를 낼 때 만든다 — 브라우저는 사용자가 키를 누른 뒤에만 소리를 허락한다 */
function audio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return null;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ type, from, to, duration, volume }) {
  if (!enabled) return;
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + duration);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t);
  osc.stop(t + duration);
}

/** 맞게 누른 키 — 짧은 딸깍 */
export function playKey() {
  tone({ type: 'triangle', from: 1800, to: 900, duration: 0.035, volume: 0.12 });
}

/** 틀리게 누른 키 — 낮은 툭 */
export function playWrong() {
  tone({ type: 'square', from: 180, to: 120, duration: 0.09, volume: 0.06 });
}

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on) {
  enabled = on;
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // 저장 실패는 무시
  }
}
