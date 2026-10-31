import ViewHeader from '../components/ViewHeader';
import AuthCard from '../components/AuthCard';
import TypingDemo from '../components/TypingDemo';
import HomeIllustration from '../components/HomeIllustration';
import LiveRanking from '../components/LiveRanking';

const FEATURES = [
  ['⌨️', '자리 · 낱말 · 단문 · 장문 · 60초'],
  ['🎮', '타자 게임 3종'],
  ['🏆', '실시간 랭킹'],
];

/** 메인 화면 — 소개 · 바로 시작 + 키보드 그림, 아래에 실시간 랭킹과 로그인 카드 */
export default function HomeView({ mode, onModeChange, onOpenNav, onNavigate }) {
  return (
    <div className="app app--home">
      <ViewHeader mode={mode} onModeChange={onModeChange} onOpenNav={onOpenNav} />

      <main className="home">
        <section className="home__hero">
          <div className="home__intro">
            <p className="home__eyebrow">한글 · English 타자 연습</p>
            <h1 className="home__title">
              손끝으로 익히는
              <br />
              <span className="home__brand">타닥</span> 타자 연습
            </h1>
            <TypingDemo />

            <div className="home__actions">
              <button type="button" className="btn btn--primary" onClick={() => onNavigate({ view: 'practice' })}>
                ⌨️ 타자 연습
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => onNavigate({ view: 'game', game: null })}>
                🎮 타자 게임
              </button>
            </div>

            <ul className="home__features">
              {FEATURES.map(([icon, text]) => (
                <li key={text}>
                  <span aria-hidden="true">{icon}</span> {text}
                </li>
              ))}
            </ul>
          </div>

          <HomeIllustration />
        </section>

        <section className="home__bottom">
          <LiveRanking mode={mode} />
          <AuthCard onPlay={() => onNavigate({ view: 'game', game: null })} />
        </section>
      </main>
    </div>
  );
}
