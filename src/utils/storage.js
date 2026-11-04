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

/** 연습 최고 기록을 통째로 바꾼다 (로그인한 계정 기록으로) — 화면이 다시 읽도록 'tadak:bests' 이벤트를 보낸다 */
export function replaceBests(all) {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  window.dispatchEvent(new Event('tadak:bests'));
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
  const record = readGames()[key] ?? null;
  // 고스트 레이스는 고정 코스 도착 시간(ms) — 예전 기록(타수 · 무작위 코스, course 표시 없음)은 없는 셈 친다
  if (key.startsWith('ghost:') && record && record.course !== 1) return null; // 1 = GhostGame.jsx의 COURSE_ID
  return record;
}

/**
 * 최고 기록보다 좋으면 저장하고 true를 돌려준다. (0점 판은 저장하지 않는다)
 * better(a, b): a가 b보다 좋은가 — 기본은 클수록, 시간 게임은 data/games.js의 isBetter를 넘긴다
 */
export function saveGameBest(key, record, better = (a, b) => a > b) {
  if (record.score <= 0) return false;
  const all = readGames();
  const prev = getGameBest(key);
  if (prev && !better(record.score, prev.score)) return false;

  all[key] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}

// ─── 고스트 레이스 유령 ─────────────────────────────────────────
// 가장 빨랐던 판을 언어별로 하나 — 유령이 그 판을 그대로 따라 달린다
// { speed, time, strokes, trace: [TRACE_STEP초마다 누적 바른 타수], date }

const GHOST_KEY = 'tadak:ghost';

function readGhosts() {
  try {
    return JSON.parse(localStorage.getItem(GHOST_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function getGhost(mode) {
  return readGhosts()[mode] ?? null;
}

/** 더 빠른 판이면 유령으로 저장하고 true */
export function saveGhost(mode, record) {
  const all = readGhosts();
  if (all[mode] && all[mode].speed >= record.speed) return false;
  all[mode] = { ...record, date: new Date().toISOString() };
  try {
    localStorage.setItem(GHOST_KEY, JSON.stringify(all));
  } catch {
    // 저장 실패는 무시
  }
  return true;
}
