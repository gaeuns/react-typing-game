import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { GAMES, gamesFor, isBetter, scoreText } from '../data/games';
import { fetchRanking, medalClass } from '../utils/ranking';
import { supabase } from '../utils/supabase';

const TOP = 3;
const MEDALS = ['🥇', '🥈', '🥉'];
const FLASH_MS = 2500;

/**
 * 홈 화면 실시간 랭킹 — 게임마다 상위 3명을 나란히 (English면 한글 전용 게임은 빼고).
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

  // 언어가 바뀌거나 로그인 · 로그아웃하면 다시 (내 줄 표시 is_me는 서버가 정한다)
  const userId = user?.id;
  useEffect(() => {
    if (!configured) return;
    setBoards({});
    gamesFor(mode).forEach((g) => load(g.id, { fresh: true }));
  }, [configured, mode, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 점수 알림 구독 — 서버는 "이 게임에 새 기록"만 알려 주고(비공개 Broadcast 채널), 내용은 랭킹 함수로 다시 읽는다
  useEffect(() => {
    if (!configured) return undefined;
    const channel = supabase
      .channel('home-live-ranking', { config: { private: true } })
      .on('broadcast', { event: 'new_score' }, ({ payload }) => {
        if (payload?.mode !== modeRef.current) return;
        const before = boardsRef.current[payload.game];
        load(payload.game, { fresh: true }).then((rows) => {
          if (!Array.isArray(before)) return; // 처음 불러오는 중이면 비교할 게 없다
          // 순위표에 새로 들어왔거나 점수가 좋아진 줄 = 방금 들어온 기록 (자기 최고보다 낮은 점수는 순위표가 안 바뀌어 조용히)
          const hit = rows.find((r) => {
            const prev = before.find((o) => o.nickname === r.nickname);
            return !prev || isBetter(payload.game, r.score, prev.score);
          });
          if (hit) setNews({ game: payload.game, nickname: hit.nickname, score: hit.score });
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
          ? `🔔 ${news.nickname}님이 ${GAMES.find((g) => g.id === news.game)?.name}에서 ${scoreText(news.game, news.score)}!`
          : '새 기록이 나오면 여기에 바로 떠요'}
      </p>

      <div className="live-ranking__grid">
        {gamesFor(mode).map((g) => {
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
                      key={r.nickname}
                      className={[
                        'live-ranking__row',
                        medalClass(r.rank),
                        r.is_me && 'is-me',
                        news?.game === g.id && news.nickname === r.nickname && 'is-new',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      <span className="live-ranking__rank">{MEDALS[r.rank - 1] ?? r.rank}</span>
                      <span className="live-ranking__name">{r.nickname}</span>
                      {/* 좁은 칸이라 단위는 빼되, 시간 게임(고스트)은 "9.00초"로 */}
                      <span className="live-ranking__score">{g.time ? scoreText(g.id, r.score) : r.score.toLocaleString()}</span>
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
