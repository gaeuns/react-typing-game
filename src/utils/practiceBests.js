import { supabase } from './supabase';
import { setAccountBests } from './storage';

// 계정 최고 기록 — 로그인하면 연습 기록(practice_bests) · 게임 기록(game_best)을 불러와 storage.js의 계정 기록으로 쓴다.
// 화면은 그대로 storage.js의 getBest · getGameBest를 읽는다.

const EMPTY = () => ({ practice: {}, games: {} });

/** 로그인 직후 · 로그인된 채로 열었을 때 — 먼저 빈 계정 기록으로 바꾸고(이 기기 기록이 섞여 보이지 않게) 불러온다 */
export async function loadAccountBests() {
  setAccountBests(EMPTY());
  const { data: auth } = await supabase.auth.getSession();
  const uid = auth.session?.user.id;
  if (!uid) return;
  const [practice, games] = await Promise.all([
    supabase.from('practice_bests').select('key, speed, accuracy, time, updated_at'),
    supabase.rpc('my_game_bests'),
  ]);
  if (practice.error) throw practice.error;
  if (games.error) throw games.error;
  setAccountBests({
    practice: Object.fromEntries(
      practice.data.map((r) => [r.key, { speed: r.speed, accuracy: Number(r.accuracy), time: r.time, date: r.updated_at }]),
    ),
    games: Object.fromEntries(
      games.data.map((r) => [`${r.game}:${r.mode}`, { score: r.score, level: r.level, date: r.achieved_at }]),
    ),
  });
}

/** 새 계정 — 기록 0부터 */
export function startEmptyAccountBests() {
  setAccountBests(EMPTY());
}

/** 로그아웃 · 탈퇴 — 계정 기록을 내려놓고 이 기기 기록으로 */
export function forgetAccountBests() {
  setAccountBests(null);
}

// 연습 판마다 서버 세션 — 걸린 시간이 세션을 연 뒤 지난 시간보다 길면 서버가 받지 않는다
const sessions = new Map();

/** 연습 판을 시작할 때(다시 하기 · 다음 포함) 부른다 — 로그인했을 때만 */
export function startPracticeSession(key) {
  const run = supabase.rpc('start_practice', { p_key: key }).then(({ data, error }) => {
    if (error) throw error;
    return data;
  });
  run.catch(() => {}); // 실패는 저장할 때 알린다
  sessions.set(key, run);
}

/** 새 최고 기록을 계정에 저장 — DB가 더 좋은 기록일 때만 바꾼다. 세션은 한 번만 쓴다 */
export async function saveAccountBest(key, record) {
  const session = await sessions.get(key);
  sessions.delete(key);
  if (!session) throw new Error('no practice session');
  const { error } = await supabase.rpc('save_practice_best', {
    p_session: session,
    p_speed: record.speed,
    p_accuracy: record.accuracy,
    p_time: Math.max(1, Math.round(record.time)),
  });
  if (error) throw error;
}
