// 게임 목록 — 사이드바 · 게임 목록 화면이 같이 쓴다
// lang: 그 언어로만 하는 게임 (낱말 언어와 상관없이), unit: 점수 단위 (없으면 점)
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
    id: 'chain',
    icon: '🔗',
    name: '끝말잇기 타자',
    desc: '타닥이와 끝말잇기! 끝 글자로 시작하는 낱말을 제한 시간 안에 쳐요. 타닥이가 못 이으면 한방 승리.',
    lang: 'ko',
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
    desc: '내 최고 기록 유령과 같은 문장을 나란히 달려요. 반투명 타닥이를 따라잡아 새 유령이 되세요.',
    unit: '타',
  },
];

/** 이 언어 랭킹이 있는 게임 — 한글 전용 게임은 English 랭킹에서 뺀다 */
export const gamesFor = (mode) => GAMES.filter((g) => !g.lang || g.lang === mode);

/** 점수 + 단위 — "1,234점" · "420타" */
export const scoreText = (game, score) => `${score.toLocaleString()}${GAMES.find((g) => g.id === game)?.unit ?? '점'}`;
