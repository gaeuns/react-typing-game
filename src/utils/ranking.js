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

/** 끝난 판의 점수를 올린다 (로그인했을 때만 부른다) */
export async function submitScore(game, mode, score, level) {
  const { error } = await supabase.from('game_scores').insert({ game, mode, score, level });
  if (error) throw error;
}

/**
 * 게임 · 언어별 위에서부터 limit명 — [{ rank, user_id, nickname, score, level }]
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
