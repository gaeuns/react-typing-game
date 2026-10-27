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

/** 새 기록이 최고 기록이면 저장하고 true를 돌려준다. (타수가 같으면 정확도가 더 높아야 최고 기록) */
export function saveIfBest(key, record) {
  const all = readAll();
  const prev = all[key];
  const isBetter = !prev || record.speed > prev.speed || (record.speed === prev.speed && record.accuracy > prev.accuracy);
  if (!isBetter) return false;

  all[key] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}

// ─── 게임 최고 점수 ─────────────────────────────────────────────

const GAME_KEY = 'tadak:games';

function readGames() {
  try {
    return JSON.parse(localStorage.getItem(GAME_KEY)) ?? {};
  } catch {
    return {};
  }
}

/** key: `${게임}:${언어}` — { score, level, date } */
export function getGameBest(key) {
  return readGames()[key] ?? null;
}

/** 점수가 최고 점수보다 높으면 저장하고 true를 돌려준다. (0점 판은 저장하지 않는다) */
export function saveGameBest(key, record) {
  if (record.score <= 0) return false;
  const all = readGames();
  const prev = all[key];
  if (prev && prev.score >= record.score) return false;

  all[key] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}
