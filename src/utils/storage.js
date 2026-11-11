// 최고 기록 — 로그인하지 않았으면 이 기기(localStorage), 로그인했으면 계정 기록(DB에서 불러와 메모리에 둔다).
// 로그인한 동안에는 localStorage를 고쳐도 화면 · "최고 기록" 판정은 계정 기록을 따른다.
// (시크릿 모드 등에서 localStorage가 막혀 있어도 앱이 죽지 않도록 try/catch)

// 로그인한 계정 기록 — { practice: { 키: 기록 }, games: { '게임:언어': { score, level } } } | null(로그인 안 함)
let account = null;

/** 계정 기록으로 바꾸거나(로그인) null로 이 기기 기록으로 돌아간다(로그아웃) — 화면이 다시 읽도록 'tadak:bests' 이벤트 */
export function setAccountBests(next) {
  account = next;
  window.dispatchEvent(new Event('tadak:bests'));
}

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
  if (account) return account.practice[key] ?? null;
  const record = readAll()[key] ?? null;
  // 손으로 고친 말이 안 되는 값(2,000타 초과 · 정확도 100% 초과)은 없는 셈 친다 (PracticeView의 MAX_PLAUSIBLE_SPEED)
  if (record && !(record.speed <= 2000 && record.accuracy <= 100)) return null;
  return record;
}

/** 새 기록이 최고 기록이면 저장하고 true를 돌려준다. (타수가 같으면 정확도가 더 높아야 최고 기록) */
export function saveIfBest(key, record) {
  const prev = getBest(key);
  const isBetter = !prev || record.speed > prev.speed || (record.speed === prev.speed && record.accuracy > prev.accuracy);
  if (!isBetter) return false;

  const saved = { ...record, date: new Date().toISOString() };
  if (account) {
    account.practice[key] = saved; // 계정에는 PracticeView가 서버 함수로 올린다
    return true;
  }
  const all = readAll();
  all[key] = saved;
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
  if (account) return account.games[key] ?? null;
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
  const prev = getGameBest(key);
  if (prev && !better(record.score, prev.score)) return false;

  const saved = { ...record, date: new Date().toISOString() };
  if (account) {
    account.games[key] = saved; // 계정(랭킹)에는 RankNote가 서버 함수로 올린다
    return true;
  }
  const all = readGames();
  all[key] = saved;
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
