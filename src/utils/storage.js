// 최고 기록을 localStorage에 저장한다.
// (시크릿 모드 등에서 localStorage가 막혀 있어도 앱이 죽지 않도록 try/catch)

const BEST_KEY = 'tadak:best';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(BEST_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** key: 연습 종류 · 언어별 저장 키 (App의 bestKey) */
export function getBest(key) {
  return readAll()[key] ?? null;
}

/** 새 기록이 최고 기록이면 저장하고 true를 돌려준다. */
export function saveIfBest(key, record) {
  const all = readAll();
  const prev = all[key];
  if (prev && prev.speed >= record.speed) return false;

  all[key] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}
