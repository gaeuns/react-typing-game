// 최고 기록을 localStorage에 저장한다.
// (시크릿 모드 등에서 localStorage가 막혀 있어도 앱이 죽지 않도록 try/catch)

const KEY = 'tadak:best';

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) ?? {};
  } catch {
    return {};
  }
}

export function getBest(mode) {
  return readAll()[mode] ?? null;
}

/** 새 기록이 최고 기록이면 저장하고 true를 돌려준다. */
export function saveIfBest(mode, record) {
  const all = readAll();
  const prev = all[mode];
  if (prev && prev.speed >= record.speed) return false;

  all[mode] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}
