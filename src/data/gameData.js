// 게임에 쓰는 그림 · 아이템 데이터

// 냠냠 디펜스 — 가끔 떨어지는 특수 아이템 (낱말을 치면 효과)
export const RAIN_SPECIALS = [
  { id: 'bomb', icon: '💣', name: '폭탄', desc: '전부 없애기' },
  { id: 'clock', icon: '⏱️', name: '시계', desc: '5초 느리게' },
  { id: 'shield', icon: '🛡️', name: '방패', desc: '한 번 막기' },
];

// 줄다리기 대작전 — 내가 얻어서 쓰는 아이템 (금색 낱말을 치면 얻는다)
export const PLAYER_ITEMS = [
  { id: 'power', icon: '💪', name: '괴력', desc: '6초 동안 당기는 힘 2배' },
  { id: 'freeze', icon: '🧊', name: '얼음', desc: '상대가 4초 동안 못 당겨요' },
  { id: 'yank', icon: '🪢', name: '한 번에 당기기', desc: '한 번에 크게 당겨요' },
];

// 줄다리기 대작전 — 컴퓨터가 가끔 쓰는 방해 아이템
export const CPU_ITEMS = [
  { id: 'gust', icon: '🌪️', name: '돌풍', desc: '밧줄이 상대 쪽으로 확 끌려가요' },
  { id: 'ink', icon: '🦑', name: '먹물', desc: '3초 동안 낱말이 흐려져요' },
];

// 줄다리기 대작전 — 라운드마다 바뀌는 상대 (마지막은 그 뒤로 계속)
export const OPPONENTS = [
  { icon: '🤖', name: '꼬마 로봇' },
  { icon: '🦾', name: '근육 로봇' },
  { icon: '👾', name: '우주 괴물' },
  { icon: '🐉', name: '전설의 용' },
];
