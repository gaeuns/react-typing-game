import { useEffect, useState } from 'react';
import ViewHeader from '../components/ViewHeader';
import RankingBoard from '../components/RankingBoard';
import SpeedGame from '../games/SpeedGame';
import RainGame from '../games/RainGame';
import TugGame from '../games/TugGame';
import { GAMES } from '../data/games';
import { getGameBest } from '../utils/storage';

const GAME_COMPONENTS = { speed: SpeedGame, rain: RainGame, tug: TugGame };

/**
 * 타자 게임 화면 — game이 없으면 게임 목록, 있으면 그 게임.
 * 언어를 바꾸면 게임을 새 판으로 다시 띄운다 (key에 mode).
 * "다시 하기" 버튼 · F5: 같은 게임을 처음부터 바로 시작 (브라우저 새로고침 대신)
 */
export default function GameView({ mode, onModeChange, game, onSelectGame, onOpenNav }) {
  const Game = GAME_COMPONENTS[game];
  const info = GAMES.find((g) => g.id === game);
  const [run, setRun] = useState({ id: 0, autoStart: false, game, mode });

  // 다른 게임 · 언어로 바뀌면 그 렌더에서 바로 시작 화면부터 (effect로 하면 한 번 더 그리고, autoStart가 잠깐 남는다)
  if (run.game !== game || run.mode !== mode) setRun({ id: run.id + 1, autoStart: false, game, mode });

  const restart = () => setRun((r) => ({ ...r, id: r.id + 1, autoStart: true }));

  useEffect(() => {
    if (!Game) return undefined;
    const handleKeyDown = (e) => {
      // Ctrl · Shift + F5(강력 새로고침)는 브라우저에 그대로 맡긴다
      if (e.key !== 'F5' || e.ctrlKey || e.shiftKey || e.metaKey || e.altKey) return;
      e.preventDefault(); // 페이지 새로고침 대신 게임만 다시
      restart();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [Game]);

  return (
    <div className="app app--game">
      <ViewHeader mode={mode} onModeChange={onModeChange} onOpenNav={onOpenNav} />

      {Game ? (
        <main className="game-screen">
          <div className="game-screen__bar">
            <button type="button" className="back-btn" onClick={() => onSelectGame(null)} aria-label="게임 목록">
              ←<span className="back-btn__text"> 게임 목록</span>
            </button>
            <h2 className="game-screen__title">
              <span aria-hidden="true">{info.icon}</span> {info.name}
            </h2>
            <button
              type="button"
              className="restart-btn"
              onMouseDown={(e) => e.preventDefault()} // 눌러도 입력창 포커스 그대로
              onClick={restart}
              aria-label="다시 하기 (F5)"
            >
              ↻<span className="restart-btn__text"> 다시 하기</span> <kbd className="restart-btn__key">F5</kbd>
            </button>
          </div>
          <Game
            key={`${game}-${mode}-${run.id}`}
            mode={mode}
            autoStart={run.autoStart}
            onModeChange={onModeChange}
            onExit={() => onSelectGame(null)}
          />
        </main>
      ) : (
        <main className="lobby">
          <h2 className="lobby__title">타자 게임</h2>
          <p className="lobby__desc">게임을 고르세요 · 낱말 언어 {mode === 'ko' ? '한글' : 'English'}</p>
          <div className="lobby__grid">
            {GAMES.map((g) => {
              const best = getGameBest(`${g.id}:${mode}`);
              return (
                <button key={g.id} type="button" className="game-card" onClick={() => onSelectGame(g.id)}>
                  <span className="game-card__icon" aria-hidden="true">
                    {g.icon}
                  </span>
                  <span className="game-card__name">{g.name}</span>
                  <span className="game-card__desc">{g.desc}</span>
                  <span className="game-card__best">{best ? `최고 ${best.score}점` : '아직 기록 없음'}</span>
                </button>
              );
            })}
          </div>
          <RankingBoard mode={mode} />
        </main>
      )}
    </div>
  );
}
