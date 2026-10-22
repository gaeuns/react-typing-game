// 낱말 · 장문 연습 데이터와, 연습 종류별로 한 판 분량을 뽑는 함수.
import { pickSentences } from './sentences';

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

// 저작권 보호 기간이 끝난 작품들
const PASSAGES = {
  ko: [
    {
      title: '윤동주 「서시」',
      lines: [
        '죽는 날까지 하늘을 우러러',
        '한 점 부끄럼이 없기를,',
        '잎새에 이는 바람에도',
        '나는 괴로워했다.',
        '별을 노래하는 마음으로',
        '모든 죽어 가는 것을 사랑해야지',
        '그리고 나한테 주어진 길을',
        '걸어가야겠다.',
        '오늘 밤에도 별이 바람에 스치운다.',
      ],
    },
    {
      title: '김소월 「진달래꽃」',
      lines: [
        '나 보기가 역겨워 가실 때에는',
        '말없이 고이 보내 드리우리다',
        '영변에 약산 진달래꽃',
        '아름 따다 가실 길에 뿌리우리다',
        '가시는 걸음걸음 놓인 그 꽃을',
        '사뿐히 즈려밟고 가시옵소서',
        '나 보기가 역겨워 가실 때에는',
        '죽어도 아니 눈물 흘리우리다',
      ],
    },
    {
      title: '윤동주 「별 헤는 밤」 중에서',
      lines: [
        '계절이 지나가는 하늘에는',
        '가을로 가득 차 있습니다.',
        '나는 아무 걱정도 없이',
        '가을 속의 별들을 다 헤일 듯합니다.',
        '가슴 속에 하나 둘 새겨지는 별을',
        '이제 다 못 헤는 것은',
        '쉬이 아침이 오는 까닭이요,',
        '내일 밤이 남은 까닭이요,',
        '아직 나의 청춘이 다하지 않은 까닭입니다.',
      ],
    },
  ],
  en: [
    {
      title: 'Robert Frost, "The Road Not Taken"',
      lines: [
        'Two roads diverged in a yellow wood,',
        'And sorry I could not travel both',
        'And be one traveler, long I stood',
        'And looked down one as far as I could',
        'To where it bent in the undergrowth;',
        'Then took the other, as just as fair,',
        'And having perhaps the better claim,',
        'Because it was grassy and wanted wear;',
        'Though as for that the passing there',
        'Had worn them really about the same,',
      ],
    },
    {
      title: 'Abraham Lincoln, "Gettysburg Address"',
      lines: [
        'Four score and seven years ago our fathers brought forth',
        'on this continent, a new nation, conceived in Liberty,',
        'and dedicated to the proposition that all men are created equal.',
        'Now we are engaged in a great civil war,',
        'testing whether that nation, or any nation so conceived',
        'and so dedicated, can long endure.',
      ],
    },
  ],
};

export const PRACTICE_KINDS = [
  { id: 'keys', label: '자리 연습', unit: '키' },
  { id: 'words', label: '낱말 연습', unit: '낱말' },
  { id: 'short', label: '단문 연습', unit: '문장' },
  { id: 'long', label: '장문 연습', unit: '줄' },
];

export const WORDS_PER_ROUND = 20;

function shuffle(list) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

/**
 * 한 판 분량 — { title, items }
 * 낱말: 무작위 20개 / 단문: 무작위 5문장 / 장문: 작품 하나를 줄 단위로 (excludeTitle과 다른 작품으로)
 * (자리 연습은 KeyPractice가 따로 뽑는다)
 */
export function pickRound(kind, mode, excludeTitle = null) {
  if (kind === 'words') return { title: null, items: shuffle(WORDS[mode]).slice(0, WORDS_PER_ROUND) };
  if (kind === 'long') {
    const others = PASSAGES[mode].filter((p) => p.title !== excludeTitle);
    const passage = shuffle(others.length ? others : PASSAGES[mode])[0];
    return { title: passage.title, items: passage.lines };
  }
  return { title: null, items: pickSentences(mode) };
}
