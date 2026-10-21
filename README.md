# ⌨️ 타닥 (Tadak)

> React로 만든 한글·영어 타자 연습 웹사이트

서버 없이 브라우저에서 바로 동작하는 타자 연습 사이트입니다.
문장을 따라 치면서 실시간으로 타수와 정확도를 확인할 수 있습니다.

<br>

## 📸 미리보기

<!-- 스크린샷이나 GIF를 여기에 넣어주세요 -->
<!-- ![preview](./docs/preview.gif) -->

🔗 **배포 주소**: <!-- https://your-deploy-url.com -->

<br>

## ✨ 주요 기능

- **라운드 진행** – 한 라운드에 5문장, 진행도 표시 · 다음 문장 미리보기 · `Esc`로 처음부터
- **실시간 정오 판정** – 맞은 글자는 초록색, 틀린 글자는 빨간색으로 표시
- **타수 · 정확도 계산** – 입력하는 동안 분당 타수와 정확도를 실시간 표시
- **결과 화면** – 연습이 끝나면 평균 타수, 정확도, 걸린 시간 확인
- **한글 / 영어 모드** – 한글 조합 입력(IME)까지 정확하게 처리
- **최고 기록 저장** – `localStorage`에 기록을 저장해 새로고침해도 유지
- **다크모드** – 시스템 설정에 따라 자동 전환

### 🛠️ 추가 예정

- [ ] 60초 타임어택 모드
- [ ] 짧은 글 / 긴 글 / 단어 모드 선택
- [ ] 키 입력 효과음

<br>

## 🧰 기술 스택

| 구분 | 사용 기술 |
| --- | --- |
| Framework | React |
| Build Tool | Vite |
| Language | JavaScript |
| Styling | CSS |
| Storage | localStorage |

<br>

## 🚀 실행 방법

```bash
# 레포지토리 클론
git clone https://github.com/gaeuns/react-typing-game.git
cd react-typing-game

# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 `http://localhost:5173` 으로 접속하면 됩니다.

<br>

## 📁 폴더 구조

```
src/
├── components/
│   ├── TypingBoard.jsx     # 문장 표시 및 글자별 정오 표시
│   ├── TypingInput.jsx     # 입력창 (한글 조합 처리 포함)
│   ├── StatusBar.jsx       # 실시간 타수 · 정확도 · 타이머
│   └── ResultModal.jsx     # 결과 화면
├── data/
│   └── sentences.js        # 연습 문장 목록
├── hooks/
│   └── useTimer.js         # 타이머 커스텀 훅
├── utils/
│   ├── calculate.js        # 타수 · 정확도 계산 함수
│   └── storage.js          # 최고 기록 저장 (localStorage)
├── App.jsx                 # 입력 처리 · 라운드 진행 로직
├── index.css
└── main.jsx
```

<br>

## 💡 구현 포인트

### 한글 조합 입력 처리

한글은 `ㅎ → 하 → 한` 처럼 여러 단계를 거쳐 한 글자가 완성되기 때문에,
`onChange`만 사용하면 조합 중인 글자가 오타로 판정되는 문제가 있었습니다.

`onCompositionStart` / `onCompositionEnd` 이벤트로 **조합 중인지 여부를 구분**하여,
글자가 완성된 시점에만 정오 판정을 하도록 해결했습니다.

```jsx
const [isComposing, setIsComposing] = useState(false);

<input
  onCompositionStart={() => setIsComposing(true)}
  onCompositionEnd={() => setIsComposing(false)}
  onChange={handleChange}
/>
```

### 타수 계산

```
타수(타/분) = 맞게 친 글자의 키 입력 수 ÷ 경과 시간(분)
정확도(%)   = 맞은 글자 수 ÷ 입력한 글자 수 × 100
```

한글 타수는 글자 수가 아니라 **실제로 누른 키 개수**로 셉니다.
완성형 한글을 초성 · 중성 · 종성으로 분해해서 `가` = 2타, `한` = 3타, `왔` = 4타(ㅇ+ㅗ+ㅏ+ㅆ)처럼 계산합니다. (`utils/calculate.js`의 `countStrokes`)

<br>

## 📝 회고

<!-- 만들면서 어려웠던 점, 배운 점을 적어주세요 -->

<br>

## 👤 만든 사람

- GitHub: [@gaeuns](https://github.com/gaeuns)
