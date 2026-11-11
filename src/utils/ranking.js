import { supabase } from './supabase';

// 게임 랭킹 — Supabase의 game_scores 테이블 · game_ranking / my_game_rank 함수 (supabase/migrations 참고)

/** 1 · 2 · 3위 줄 색 — 금 · 은 · 동 (같은 점수면 같은 순위라 같은 색) */
export function medalClass(rank) {
  return ['', 'is-gold', 'is-silver', 'is-bronze'][rank] ?? '';
}

// 똑같은 요청이 동시에 두 번 가지 않게 (개발 모드 StrictMode의 effect 두 번 등) — 끝나면 지운다
const inFlight = new Map();
function once(key, run) {
  if (!inFlight.has(key)) inFlight.set(key, run().finally(() => inFlight.delete(key)));
  return inFlight.get(key);
}

// 게임 · 언어마다 지금 판의 서버 세션 — 서버가 시작 시각을 기록해 두고, 점수를 올릴 때 걸린 시간으로 말이 되는지 확인한다
const sessions = new Map();

/**
 * 판을 시작할 때(3 · 2 · 1) 부른다 — 로그인했을 때만 서버 세션을 연다.
 * 세션은 한 판에 한 번만 점수를 받는다 (줄다리기는 다음 라운드마다 더 큰 점수로 다시).
 */
export function startGameSession(game, mode) {
  if (!supabase) return;
  const run = supabase.auth.getSession().then(async ({ data: auth }) => {
    if (!auth.session) return null;
    const { data, error } = await supabase.rpc('start_game', { p_game: game, p_mode: mode });
    if (error) throw error;
    return data;
  });
  run.catch(() => {}); // 실패는 점수를 올릴 때 알린다
  sessions.set(`${game}:${mode}`, run);
}

/** 끝난 판의 점수를 올린다 (로그인했을 때만 부른다) — 서버 함수가 세션 · 점수를 확인하고 넣는다 */
export async function submitScore(game, mode, score, level) {
  const session = await sessions.get(`${game}:${mode}`);
  if (!session) throw new Error('no game session');
  const { data, error } = await supabase.rpc('submit_score', { p_session: session, p_score: score, p_level: level });
  if (error) throw error;
  if (data !== 'ok') throw new Error(data); // 서버가 거절한 이유 (implausible score 등)
}

/**
 * 게임 · 언어별 위에서부터 limit명 — [{ rank, nickname, score, level, is_me }]
 * fresh: 같은 요청이 진행 중이어도 새로 묻는다 (실시간 갱신 — 그 사이에 들어온 기록까지 받아야 해서)
 */
export function fetchRanking(game, mode, limit = 10, { fresh = false } = {}) {
  const run = async () => {
    const { data, error } = await supabase.rpc('game_ranking', { p_game: game, p_mode: mode, p_limit: limit });
    if (error) throw error;
    return data;
  };
  return fresh ? run() : once(`ranking:${game}:${mode}:${limit}`, run);
}

/** 내 순위 — { rank, score } 또는 기록이 없으면 null */
export function fetchMyRank(game, mode) {
  return once(`mine:${game}:${mode}`, async () => {
    const { data, error } = await supabase.rpc('my_game_rank', { p_game: game, p_mode: mode });
    if (error) throw error;
    return data[0] ?? null;
  });
}
