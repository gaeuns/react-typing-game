// 게임 목록 — 사이드바 · 게임 목록 화면이 같이 쓴다
// lang: 그 언어로만 하는 게임 (낱말 언어와 상관없이), unit: 점수 단위 (없으면 점)
// time: 점수가 걸린 시간(ms)이라 작을수록 좋음 — "12.34초"로 보이고 랭킹도 작은 순 (DB도 같은 규칙)
export const GAMES = [
  {
    id: 'speed',
    icon: '⚡',
    name: '타임 어택',
    desc: '낱말 카드가 여러 장! 카드마다 시간이 줄어들어요. 🧊 얼음 · 🧹 빗자루로 하트를 지키세요.',
  },
  {
    id: 'rain',
    icon: '🍩',
    name: '냠냠 디펜스',
    desc: '음식 · 동물 · 물건이 쏟아져요! 데드라인에 닿기 전에 쳐서 없애고, 💣 폭탄 · 🛡️ 방패로 버티세요.',
  },
  {
    id: 'tug',
    icon: '🪢',
    name: '줄다리기 대작전',
    desc: '낱말을 쳐서 깃발을 승리선까지! 45초가 끝나면 깃발 위치로 판정. 아이템 · 필살기로 센 상대를 이기세요.',
  },
  {
    id: 'chosung',
    icon: '🔤',
    name: '초성 퀴즈',
    desc: 'ㅌㅈㅇㅅ처럼 초성과 힌트만 보고 낱말을 통째로 쳐서 맞혀요. 한글이라서 할 수 있는 놀이!',
    lang: 'ko',
  },
  {
    id: 'ghost',
    icon: '👻',
    name: '고스트 레이스',
    desc: '내 최고 기록 유령과 같은 문장을 나란히 달려요. 유령을 이기면 도착 시간이 기록돼요.',
    time: true,
  },
  {
    id: 'runner',
    icon: '🏃',
    name: '타닥이 달리기',
    desc: '달리는 타닥이 앞에 장애물이 와요! 낱말을 쳐서 폴짝 넘기고, 부딪히면 반창고. 🩹 구급상자 · ⭐ 별로 버티세요.',
  },
];

/** 이 언어 랭킹이 있는 게임 — 한글 전용 게임은 English 랭킹에서 뺀다 */
export const gamesFor = (mode) => GAMES.filter((g) => !g.lang || g.lang === mode);

const info = (game) => GAMES.find((g) => g.id === game);

/** 점수 + 단위 — "1,234점" · "420타" · 시간 게임은 "12.34초" */
export const scoreText = (game, score) =>
  info(game)?.time ? `${(score / 1000).toFixed(2)}초` : `${score.toLocaleString()}${info(game)?.unit ?? '점'}`;

/** a가 b보다 좋은 기록인가 — 시간 게임은 작을수록 */
export const isBetter = (game, a, b) => (info(game)?.time ? a < b : a > b);
