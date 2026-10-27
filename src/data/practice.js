// 낱말 연습 데이터와, 연습 종류별로 한 판 분량을 뽑는 함수.
import { PASSAGES } from './passages';
import { SENTENCES, pickSentences } from './sentences';

const WORDS = {
  ko: [
    '하늘', '바다', '컴퓨터', '키보드', '사과나무', '도서관', '자전거', '무지개', '고양이', '강아지',
    '선풍기', '냉장고', '운동장', '비행기', '기차역', '우체국', '김치찌개', '떡볶이', '손가락', '연습장',
    '타자기', '모니터', '마우스', '프로그램', '개발자', '햇살', '바람개비', '눈사람', '봄날', '여름밤',
    '가을비', '겨울잠', '소나무', '해바라기', '별자리', '달팽이', '거북이', '다람쥐', '친구', '학교',
  ],
  en: [
    'apple', 'keyboard', 'river', 'garden', 'window', 'planet', 'coffee', 'yellow', 'silver', 'rocket',
    'puzzle', 'jacket', 'monkey', 'orange', 'castle', 'bridge', 'forest', 'island', 'summer', 'winter',
    'music', 'pencil', 'travel', 'button', 'screen', 'mouse', 'code', 'react', 'typing', 'people',
    'friend', 'little', 'quick', 'brown', 'jump', 'light', 'dream', 'smile', 'ocean', 'mountain',
  ],
};

/** 게임에서 쓰는 낱말 목록 */
export function wordsFor(mode) {
  return WORDS[mode];
}

// short: 좁은 화면 탭에 쓰는 짧은 이름
export const PRACTICE_KINDS = [
  { id: 'keys', label: '자리 연습', short: '자리', unit: '키' },
  { id: 'words', label: '낱말 연습', short: '낱말', unit: '낱말' },
  { id: 'short', label: '단문 연습', short: '단문', unit: '문장' },
  { id: 'long', label: '장문 연습', short: '장문', unit: '줄' },
  { id: 'timed', label: '60초 연습', short: '60초', unit: '문장' },
];

export const WORDS_PER_ROUND = 20;
export const TIMED_MS = 60 * 1000; // 60초 연습 제한 시간

function shuffle(list) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/** 장문 작품 이름 목록 — 작품 고르기용 */
export function passageTitles(mode) {
  return PASSAGES[mode].map((p) => p.title);
}

/** 고른 장문 작품 한 판 — { title, items } */
export function getPassage(mode, title) {
  const passage = PASSAGES[mode].find((p) => p.title === title) ?? PASSAGES[mode][0];
  return { title: passage.title, items: passage.lines };
}

/**
 * 한 판 분량 — { title, items }
 * 낱말: 무작위 20개 / 단문: 무작위 5문장 / 장문: 작품 하나를 줄 단위로 (excludeTitle과 다른 작품으로)
 * 60초: 단문을 세 바퀴 섞어 이어 붙인다 — 60초 안에 다 칠 수 없을 만큼
 * (자리 연습은 KeyPractice가 따로 뽑는다)
 */
export function pickRound(kind, mode, excludeTitle = null) {
  if (kind === 'words') return { title: null, items: shuffle(WORDS[mode]).slice(0, WORDS_PER_ROUND) };
  if (kind === 'timed') {
    const items = [];
    while (items.length < SENTENCES[mode].length * 3) {
      const lap = shuffle(SENTENCES[mode]);
      if (lap[0] === items[items.length - 1]) lap.push(lap.shift()); // 바퀴가 바뀔 때 같은 문장이 연달아 나오지 않게
      items.push(...lap);
    }
    return { title: null, items };
  }
  if (kind === 'long') {
    const others = PASSAGES[mode].filter((p) => p.title !== excludeTitle);
    const passage = shuffle(others.length ? others : PASSAGES[mode])[0];
    return { title: passage.title, items: passage.lines };
  }
  return { title: null, items: pickSentences(mode) };
}
