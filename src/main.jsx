import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './hooks/useAuth';
import './index.css';
import './mascot.css';
import { GAME_WORD_LISTS } from './data/gameWords';

// 한글 글꼴은 글자 묶음별 조각으로 나뉘어 처음 쓰는 순간 받아진다 — 그사이 그 글자만 다른 글꼴(가늘고 작게)로 보여서
// 게임 낱말에 쓰이는 조각은 미리 받아 둔다 (두께 400 · 700)
const gameChars = [
  ...new Set(Object.values(GAME_WORD_LISTS).flatMap((byMode) => Object.values(byMode).flat()).join('')),
].join('');
['400', '700'].forEach((weight) =>
  document.fonts?.load(`${weight} 1em "Nanum Gothic Coding"`, gameChars).catch(() => {}),
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
);
