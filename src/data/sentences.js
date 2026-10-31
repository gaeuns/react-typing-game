// 연습 문장 목록 — 자유롭게 추가/수정하세요.
export const SENTENCES = {
  ko: [
    '천 리 길도 한 걸음부터 시작된다.',
    '가는 말이 고와야 오는 말이 곱다.',
    '낮말은 새가 듣고 밤말은 쥐가 듣는다.',
    '백지장도 맞들면 낫다.',
    '티끌 모아 태산이 된다.',
    '하늘이 무너져도 솟아날 구멍이 있다.',
    '배움에는 왕도가 없다.',
    '오늘 할 일을 내일로 미루지 말자.',
    '작은 습관이 모여 큰 변화를 만든다.',
    '시작이 반이라는 말을 믿어 보자.',
    '꾸준함은 재능을 이긴다.',
    '빨리 치는 것보다 정확하게 치는 것이 먼저다.',
    '창밖으로 가을 바람이 선선하게 불어온다.',
    '따뜻한 커피 한 잔과 함께 하루를 시작한다.',
    '리액트는 컴포넌트로 화면을 만드는 라이브러리다.',
    '버그를 고치다 보면 어느새 새벽이 된다.',
    '세 살 버릇 여든까지 간다.',
    '고생 끝에 낙이 온다.',
  ],
  en: [
    'The quick brown fox jumps over the lazy dog.',
    'Practice makes perfect.',
    'A journey of a thousand miles begins with a single step.',
    'Slow and steady wins the race.',
    'Every expert was once a beginner.',
    'Actions speak louder than words.',
    'Small habits lead to big changes.',
    'Accuracy first, speed will follow.',
    'React lets you build user interfaces out of components.',
    'Fortune favors the bold.',
    'Where there is a will, there is a way.',
    'Learning never exhausts the mind.',
    'Time flies when you are having fun.',
    'Keep your eyes on the screen, not the keyboard.',
    'Simple is better than complex.',
    'The early bird catches the worm.',
  ],
};

export const SENTENCES_PER_ROUND = 5;

// 무작위로 count개를 뽑아 한 라운드 문장 목록을 만든다.
export function pickSentences(mode, count = SENTENCES_PER_ROUND) {
  const pool = [...SENTENCES[mode]];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
