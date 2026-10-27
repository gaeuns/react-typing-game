import { supabase } from './supabase';
import { replaceBests } from './storage';

// 타자 연습 최고 기록 — 로그인하면 계정(DB practice_bests)에 저장하고, 이 기기 기록은 계정 기록으로 바꿔 둔다.
// 화면은 그대로 storage.js의 getBest를 읽는다 (이 기기 기록 = 지금 로그인한 계정의 기록).

/** 계정 기록을 불러와 이 기기 기록을 통째로 바꾼다 */
export async function loadAccountBests() {
  const { data, error } = await supabase.from('practice_bests').select('key, speed, accuracy, time, updated_at');
  if (error) throw error;
  replaceBests(
    Object.fromEntries(
      data.map((r) => [r.key, { speed: r.speed, accuracy: Number(r.accuracy), time: r.time, date: r.updated_at }]),
    ),
  );
}

/** 새 최고 기록을 계정에 저장 — DB가 더 좋은 기록일 때만 바꾼다 */
export async function saveAccountBest(key, record) {
  const { error } = await supabase.rpc('save_practice_best', {
    p_key: key,
    p_speed: record.speed,
    p_accuracy: record.accuracy,
    p_time: Math.max(1, Math.round(record.time)),
  });
  if (error) throw error;
}

/** 이 기기 기록 비우기 — 로그인 · 로그아웃할 때 (다른 사람 기록이 섞이지 않게) */
export function clearLocalBests() {
  replaceBests({});
}
