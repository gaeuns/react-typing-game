import { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar';
import HomeView from './views/HomeView';
import PracticeView from './views/PracticeView';
import GameView from './views/GameView';

// 새로고침해도 보던 화면으로 — 이 탭에서만 기억 (sessionStorage, 막혀 있으면 홈부터)
const PLACE_KEY = 'tadak:place';
const VIEWS = ['home', 'practice', 'game'];
const GAME_IDS = [null, 'speed', 'rain', 'tug'];

function loadPlace() {
  try {
    const place = JSON.parse(sessionStorage.getItem(PLACE_KEY));
    if (VIEWS.includes(place?.view) && GAME_IDS.includes(place.game ?? null)) return place;
  } catch {
    // 무시
  }
  return { view: 'home', game: null };
}

/**
 * 앱 뼈대 — 왼쪽 메뉴 + 메인 / 연습 / 게임 화면.
 * 언어(한글 · English)는 모든 화면이 같이 쓴다.
 */
export default function App() {
  const [view, setView] = useState(() => loadPlace().view); // home | practice | game
  const [game, setGame] = useState(() => loadPlace().game ?? null); // null(게임 목록) | speed | rain | tug
  const [mode, setMode] = useState('ko');
  const [isNavOpen, setIsNavOpen] = useState(false);

  useEffect(() => {
    try {
      sessionStorage.setItem(PLACE_KEY, JSON.stringify({ view, game }));
    } catch {
      // 저장 실패는 무시
    }
  }, [view, game]);

  const navigate = (target) => {
    setView(target.view);
    setGame(target.game ?? null);
    setIsNavOpen(false);
  };

  const openNav = () => setIsNavOpen(true);

  // 서랍을 Esc · 바깥 클릭으로 닫으면 하던 입력으로 바로 돌아가게 (연습은 타이머도 다시 흐른다)
  const closeNav = () => {
    setIsNavOpen(false);
    setTimeout(() => {
      document
        .querySelector('.shell__main .typing-input:not(:disabled), .shell__main .keypad, .shell__main .game-input')
        ?.focus();
    }, 0);
  };

  return (
    <div className="shell">
      <Sidebar view={view} game={game} onNavigate={navigate} open={isNavOpen} onClose={closeNav} />

      <div className="shell__main">
        {view === 'home' ? (
          <HomeView mode={mode} onModeChange={setMode} onOpenNav={openNav} onNavigate={navigate} />
        ) : view === 'practice' ? (
          <PracticeView mode={mode} onModeChange={setMode} onOpenNav={openNav} />
        ) : (
          <GameView mode={mode} onModeChange={setMode} game={game} onSelectGame={setGame} onOpenNav={openNav} />
        )}
      </div>
    </div>
  );
}
