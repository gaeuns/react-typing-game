import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GAMES } from '../data/games';
import { fetchRanking, medalClass } from '../utils/ranking';
import { supabase } from '../utils/supabase';

const TOP = 5;
const MEDALS = ['🥇', '🥈', '🥉'];
const FLASH_MS = 2500;

/**
 * 홈 화면 실시간 랭킹 — 게임 3종의 상위 5명을 나란히.
 * 누가 점수를 올리면(Supabase Realtime) 그 게임 순위를 바로 다시 불러오고, 새 기록 줄을 잠깐 반짝인다.
 */
export default function LiveRanking({ mode }) {
  const { configured, user } = useAuth();
  const [boards, setBoards] = useState({}); // game → rows | 'error'
  const [news, setNews] = useState(null); // 방금 들어온 기록 { game, userId, nickname, score, at }
  const [live, setLive] = useState(false);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const latest = useRef({}); // 게임마다 마지막으로 보낸 요청 번호 — 먼저 보낸 요청이 늦게 와도 덮어쓰지 않게
  const boardsRef = useRef(boards); // 이벤트 처리에서 갱신 전 순위표를 보려고
  boardsRef.current = boards;

  // fresh: 실시간 갱신 — 진행 중인 같은 요청을 재사용하지 않고 새로 묻는다 (바로 앞 기록이 빠지지 않게)
  const load = (game, { fresh = false } = {}) => {
    const id = (latest.current[game] ?? 0) + 1;
    latest.current[game] = id;
    return fetchRanking(game, modeRef.current, TOP, { fresh })
      .then((rows) => {
        if (latest.current[game] === id) setBoards((b) => ({ ...b, [game]: rows }));
        return rows;
      })
      .catch(() => {
        if (latest.current[game] === id) setBoards((b) => ({ ...b, [game]: 'error' }));
        return [];
      });
  };

  // 언어가 바뀌면 다시
  useEffect(() => {
    if (!configured) return;
    setBoards({});
    GAMES.forEach((g) => load(g.id));
  }, [configured, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 점수 알림 구독
  useEffect(() => {
    if (!configured) return undefined;
    const channel = supabase
      .channel('home-live-ranking')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_scores' }, ({ new: row }) => {
        if (row.mode !== modeRef.current) return;
        load(row.game, { fresh: true }).then((rows) => {
          // 순위 안에 든 그 사람의 최고 기록일 때만 알린다 (자기 최고보다 낮은 점수는 조용히)
          const hit = rows.find((r) => r.user_id === row.user_id && r.score === row.score);
          const before = Array.isArray(boardsRef.current[row.game])
            ? boardsRef.current[row.game].find((r) => r.user_id === row.user_id)
            : null;
          if (hit && !(before && before.score >= row.score)) setNews({ game: row.game, userId: row.user_id, nickname: hit.nickname, score: row.score });
        });
      })
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [configured]); // eslint-disable-line react-hooks/exhaustive-deps

  // 반짝임은 잠깐만
  useEffect(() => {
    if (!news) return undefined;
    const id = setTimeout(() => setNews(null), FLASH_MS);
    return () => clearTimeout(id);
  }, [news]);

  if (!configured) return null;

  return (
    <section className="live-ranking" aria-labelledby="live-ranking-title">
      <div className="live-ranking__head">
        <h2 id="live-ranking-title" className="live-ranking__title">
          🏆 실시간 랭킹 <span className="live-ranking__mode">{mode === 'ko' ? '한글' : 'English'}</span>
        </h2>
        <span className={`live-ranking__live ${live ? 'is-on' : ''}`}>{live ? 'LIVE' : '연결 중'}</span>
      </div>

      <p className="live-ranking__news" aria-live="polite">
        {news
          ? `🔔 ${news.nickname}님이 ${GAMES.find((g) => g.id === news.game)?.name}에서 ${news.score.toLocaleString()}점!`
          : '새 기록이 나오면 여기에 바로 떠요'}
      </p>

      <div className="live-ranking__grid">
        {GAMES.map((g) => {
          const rows = boards[g.id];
          return (
            <div key={g.id} className="live-ranking__board">
              <h3 className="live-ranking__game">
                <span aria-hidden="true">{g.icon}</span> {g.name}
              </h3>
              {rows === undefined ? (
                <p className="live-ranking__empty">불러오는 중…</p>
              ) : rows === 'error' ? (
                <p className="live-ranking__empty">불러오지 못했어요</p>
              ) : rows.length === 0 ? (
                <p className="live-ranking__empty">아직 기록이 없어요</p>
              ) : (
                <ol className="live-ranking__list">
                  {rows.map((r) => (
                    <li
                      key={r.user_id}
                      className={[
                        'live-ranking__row',
                        medalClass(r.rank),
                        r.user_id === user?.id && 'is-me',
                        news?.game === g.id && news.userId === r.user_id && 'is-new',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="live-ranking__rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
                      <span className="live-ranking__name">{r.nickname}</span>
                      <span className="live-ranking__score">{r.score.toLocaleString()}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
