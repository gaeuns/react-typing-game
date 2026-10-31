import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { fetchMyRank, submitScore } from '../utils/ranking';

/**
 * 게임 오버 창의 랭킹 한 줄 — 로그인했으면 점수를 올리고 내 순위를, 아니면 로그인 안내를 보여 준다.
 * 게임 오버 창이 뜰 때 한 번만 올린다.
 */
export default function RankNote({ game, mode, score, level }) {
  const { configured, user } = useAuth();
  const [state, setState] = useState({ status: 'saving' }); // saving | saved | error
  const sent = useRef(false);

  useEffect(() => {
    if (!configured || !user || score <= 0 || sent.current) return;
    sent.current = true;
    submitScore(game, mode, score, level)
      .then(() => fetchMyRank(game, mode))
      .then((mine) => setState({ status: 'saved', mine }))
      .catch(() => setState({ status: 'error' }));
  }, [configured, user, game, mode, score, level]);

  if (!configured || score <= 0) return null;
  if (!user) return <p className="rank-note">🏆 로그인하면 점수가 랭킹에 올라가요</p>;
  if (state.status === 'saving') return <p className="rank-note">🏆 랭킹에 올리는 중…</p>;
  if (state.status === 'error') return <p className="rank-note is-error">랭킹에 올리지 못했어요</p>;
  return (
    <p className="rank-note">
      🏆 랭킹 <strong>{state.mine?.rank ?? '-'}위</strong>
      {state.mine && state.mine.score > score && ` · 내 최고 ${state.mine.score}점`}
    </p>
  );
}
