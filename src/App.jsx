import { useState } from 'react';
import Sidebar from './components/Sidebar';
import PracticeView from './views/PracticeView';
import GameView from './views/GameView';

/**
 * 앱 뼈대 — 왼쪽 메뉴 + 연습 화면 / 게임 화면.
 * 언어(한글 · English)는 두 화면이 같이 쓴다.
 */
export default function App() {
  const [view, setView] = useState('practice'); // practice | game
  const [game, setGame] = useState(null); // null(게임 목록) | speed | rain | tug
  const [mode, setMode] = useState('ko');
  const [isNavOpen, setIsNavOpen] = useState(false);

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
        {view === 'practice' ? (
          <PracticeView mode={mode} onModeChange={setMode} onOpenNav={openNav} />
        ) : (
          <GameView mode={mode} onModeChange={setMode} game={game} onSelectGame={setGame} onOpenNav={openNav} />
        )}
      </div>
    </div>
  );
}
