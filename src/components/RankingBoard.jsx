import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GAMES } from '../data/games';
import { fetchMyRank, fetchRanking, medalClass } from '../utils/ranking';

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * 게임 목록 아래 랭킹 — 게임 탭 + 위에서 10명, 내 줄은 강조.
 * 10위 밖이면 맨 아래에 내 순위를 따로 보여 준다.
 */
export default function RankingBoard({ mode }) {
  const { configured, user } = useAuth();
  const [game, setGame] = useState(GAMES[0].id);
  const [board, setBoard] = useState({ status: 'loading', rows: [], mine: null });

  useEffect(() => {
    if (!configured) return undefined;
    let alive = true;
    setBoard((b) => ({ ...b, status: 'loading' }));
    Promise.all([fetchRanking(game, mode), user ? fetchMyRank(game, mode) : null])
      .then(([rows, mine]) => alive && setBoard({ status: 'ready', rows, mine }))
      .catch(() => alive && setBoard({ status: 'error', rows: [], mine: null }));
    return () => {
      alive = false;
    };
  }, [configured, user, game, mode]);

  if (!configured) return null;

  const meInTop = board.rows.some((r) => r.user_id === user?.id);

  return (
    <section className="ranking" aria-labelledby="ranking-title">
      <div className="ranking__head">
        <h3 id="ranking-title" className="ranking__title">
          🏆 랭킹 <span className="ranking__mode">{mode === 'ko' ? '한글' : 'English'}</span>
        </h3>
        <div className="ranking__tabs" role="tablist" aria-label="랭킹 게임">
          {GAMES.map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={game === g.id}
              className={`ranking__tab ${game === g.id ? 'is-active' : ''}`}
              onClick={() => setGame(g.id)}
            >
              <span className="ranking__tab-icon" aria-hidden="true">
                {g.icon}{' '}
              </span>
              {g.name}
            </button>
          ))}
        </div>
      </div>

      {board.status === 'error' ? (
        <p className="ranking__empty">랭킹을 불러오지 못했어요</p>
      ) : board.status === 'loading' && board.rows.length === 0 ? (
        <p className="ranking__empty">불러오는 중…</p>
      ) : board.rows.length === 0 ? (
        <p className="ranking__empty">아직 기록이 없어요 — 첫 번째 주인공이 되어 보세요!</p>
      ) : (
        <ol className="ranking__list">
          {board.rows.map((r) => (
            <li
              key={r.user_id}
              className={['ranking__row', medalClass(r.rank), r.user_id === user?.id && 'is-me'].filter(Boolean).join(' ')}
            >
              <span className="ranking__rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
              <span className="ranking__name">{r.nickname}</span>
              <span className="ranking__score">{r.score.toLocaleString()}점</span>
            </li>
          ))}
          {user && board.mine && !meInTop && (
            <li className="ranking__row is-me is-outside">
              <span className="ranking__rank">{board.mine.rank}</span>
              <span className="ranking__name">나</span>
              <span className="ranking__score">{board.mine.score.toLocaleString()}점</span>
            </li>
          )}
        </ol>
      )}
      {!user && <p className="ranking__hint">로그인하면 내 점수도 랭킹에 올라가요</p>}
    </section>
  );
}
