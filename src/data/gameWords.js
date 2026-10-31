// 게임마다 다른 주제의 낱말 — 띄어쓰기가 있으면 스페이스가 "제출"이 되므로 모두 한 덩어리 낱말

// ⚡ 타임 어택 — 생활 속 물건 · 직업 · 장소 · 동작과 느낌
const SPEED_WORDS = {
  ko: [
    // 물건
    '냉장고', '세탁기', '청소기', '선풍기', '에어컨', '전자레인지', '텔레비전', '리모컨', '스마트폰', '이어폰',
    '충전기', '노트북', '태블릿', '카메라', '킥보드', '헬멧', '목도리', '운동화', '지갑', '열쇠',
    '필통', '달력', '거울', '베개', '이불', '칫솔', '치약', '수건', '비누', '숟가락',
    '젓가락', '냄비', '프라이팬', '손전등', '돋보기', '저금통', '색연필', '스케치북', '종이컵', '빨대',
    // 직업
    '의사', '간호사', '소방관', '경찰관', '요리사', '가수', '배우', '화가', '작가', '과학자',
    '디자이너', '기자', '우주비행사', '조종사', '농부', '어부', '목수', '미용사', '사진작가', '건축가',
    // 장소
    '박물관', '놀이공원', '수영장', '영화관', '병원', '시장', '공원', '공항', '바닷가', '캠핑장',
    '빵집', '꽃집', '서점', '편의점', '미술관', '동물원', '식물원', '체육관', '정류장', '등대',
    // 동작 · 느낌
    '달리다', '걷다', '뛰어오르다', '노래하다', '춤추다', '웃다', '생각하다', '기다리다', '반짝이다', '따뜻하다',
    '시원하다', '귀엽다', '빠르다', '느긋하다', '즐겁다', '신나다', '조용하다', '행복하다', '부드럽다', '단단하다',
    // 더 많은 물건 · 직업 · 장소 · 동작 · 풍경
    '자명종', '머리띠', '장화', '망원경', '지구본', '나침반', '액자', '화분', '어항', '책상',
    '의자', '침대', '소파', '커튼', '창문', '현관문', '계단', '엘리베이터', '우체통', '초인종',
    '판사', '변호사', '은행원', '택배기사', '제빵사', '바리스타', '수의사', '약사', '통역사', '운동선수',
    '놀이터', '미용실', '세탁소', '주차장', '터미널', '항구', '온천', '스키장', '전망대', '광장',
    '헤엄치다', '날아가다', '속삭이다', '부지런하다', '반갑다', '상쾌하다', '포근하다', '든든하다', '씩씩하다', '궁금하다',
    '눈사람', '바람개비', '종이비행기', '모래성', '징검다리', '오솔길', '반딧불', '은하수', '봄바람', '노을',
    // 문구 · 생활 도구
    '가위', '풀', '테이프', '클립', '망치', '드라이버', '사다리', '양동이', '걸레', '쓰레받기',
    '휴지통', '택배상자', '쇼핑백', '영수증', '신용카드', '동전', '지폐', '여권', '기차표', '입장권',
    // 거리 · 놀이터
    '안내판', '신호등', '횡단보도', '가로등', '분수대', '벤치', '미끄럼틀', '그네', '시소', '정글짐',
    // 직업
    '편집자', '성우', '작곡가', '지휘자', '조각가', '사서', '관제사', '항해사', '정비사', '큐레이터',
    '안무가', '마술사', '탐정', '기상캐스터', '소믈리에',
    // 장소
    '과학실', '음악실', '강당', '기숙사', '연구소', '방송국', '신문사', '은행', '법원', '소방서',
    '경찰서', '시청', '주민센터', '지하상가', '도서실',
    // 동작 · 느낌
    '설레다', '두근거리다', '뿌듯하다', '아늑하다', '찬란하다', '고요하다', '상냥하다', '성실하다', '재빠르다', '꼼꼼하다',
    '넉넉하다', '달콤하다', '흥얼거리다', '깡충깡충', '살금살금', '두리번거리다', '기지개', '하품하다', '손뼉치다', '발돋움',
    // 하늘 · 땅
    '새벽', '한낮', '초승달', '보름달', '별똥별', '안개', '이슬', '서리', '우박', '파도',
    '갯벌', '모래사장', '절벽', '계곡', '폭포', '동굴', '들판', '언덕', '협곡', '빙하',
  ],
  en: [
    // things
    'fridge', 'washer', 'vacuum', 'fan', 'heater', 'microwave', 'television', 'remote', 'phone', 'earbuds',
    'charger', 'laptop', 'tablet', 'camera', 'scooter', 'helmet', 'scarf', 'sneakers', 'wallet', 'keys',
    'calendar', 'mirror', 'pillow', 'blanket', 'toothbrush', 'towel', 'soap', 'spoon', 'chopsticks', 'kettle',
    'flashlight', 'magnifier', 'crayon', 'sketchbook', 'straw', 'stapler', 'scissors', 'ruler', 'marker', 'envelope',
    // jobs
    'doctor', 'nurse', 'firefighter', 'officer', 'chef', 'singer', 'actor', 'painter', 'writer', 'scientist',
    'designer', 'reporter', 'astronaut', 'pilot', 'farmer', 'fisher', 'carpenter', 'barber', 'photographer', 'architect',
    // places
    'museum', 'park', 'pool', 'cinema', 'hospital', 'market', 'airport', 'beach', 'campsite', 'station',
    'bakery', 'florist', 'bookstore', 'gallery', 'zoo', 'stadium', 'harbor', 'lighthouse', 'library', 'playground',
    // actions · feelings
    'run', 'walk', 'jump', 'sing', 'dance', 'laugh', 'think', 'wait', 'sparkle', 'warm',
    'cool', 'cute', 'fast', 'slow', 'happy', 'excited', 'quiet', 'gentle', 'brave', 'curious',
    // more things · jobs · places · actions · scenery
    'alarm', 'headband', 'boots', 'telescope', 'globe', 'compass', 'frame', 'flowerpot', 'aquarium', 'desk',
    'chair', 'sofa', 'curtain', 'window', 'stairs', 'elevator', 'mailbox', 'doorbell', 'backyard', 'attic',
    'judge', 'lawyer', 'banker', 'courier', 'baker', 'barista', 'vet', 'pharmacist', 'translator', 'athlete',
    'salon', 'laundry', 'parking', 'terminal', 'port', 'spa', 'resort', 'tower', 'plaza', 'subway',
    'swim', 'fly', 'whisper', 'diligent', 'glad', 'fresh', 'cozy', 'sturdy', 'cheerful', 'wonder',
    'snowman', 'pinwheel', 'sandcastle', 'firefly', 'milkyway', 'breeze', 'meadow', 'pebble', 'lantern', 'sunset',
    // stationery · tools
    'glue', 'tape', 'clip', 'hammer', 'screwdriver', 'ladder', 'bucket', 'mop', 'dustpan', 'trashcan',
    'package', 'receipt', 'coin', 'passport', 'ticket', 'signpost', 'streetlight', 'crosswalk', 'fountain', 'bench',
    'slide', 'swing', 'seesaw', 'sandbox', 'toolbox', 'paperclip', 'notepad', 'postcard', 'whistle', 'battery',
    // jobs
    'editor', 'composer', 'conductor', 'sculptor', 'librarian', 'mechanic', 'sailor', 'dentist', 'surgeon', 'magician',
    'detective', 'forecaster', 'plumber', 'electrician', 'gardener',
    // places
    'classroom', 'auditorium', 'dormitory', 'laboratory', 'studio', 'newsroom', 'bank', 'courthouse', 'firehouse', 'cityhall',
    'mall', 'arcade', 'gym', 'clinic', 'motel',
    // actions · feelings
    'giggle', 'tiptoe', 'wander', 'stretch', 'hum', 'skip', 'climb', 'glide', 'shiver', 'yawn',
    'proud', 'calm', 'kind', 'sincere', 'swift', 'tidy', 'generous', 'sweet', 'salty', 'sour',
    // sky · land
    'dawn', 'noon', 'dusk', 'crescent', 'fullmoon', 'shootingstar', 'fog', 'dew', 'frost', 'hail',
    'wave', 'tide', 'cliff', 'valley', 'waterfall', 'cave', 'prairie', 'hill', 'canyon', 'glacier',
  ],
};

// 🍩 냠냠 디펜스 — 음식, 낱말마다 어울리는 그림과 함께 떨어진다
const FOODS = {
  ko: [
    ['사과', '🍎'], ['바나나', '🍌'], ['포도', '🍇'], ['수박', '🍉'], ['딸기', '🍓'], ['복숭아', '🍑'],
    ['파인애플', '🍍'], ['키위', '🥝'], ['체리', '🍒'], ['레몬', '🍋'], ['귤', '🍊'], ['망고', '🥭'],
    ['코코넛', '🥥'], ['아보카도', '🥑'], ['도시락', '🍱'], ['배', '🍐'], ['멜론', '🍈'], ['토마토', '🍅'],
    ['당근', '🥕'], ['옥수수', '🌽'], ['브로콜리', '🥦'], ['버섯', '🍄'], ['감자', '🥔'], ['고구마', '🍠'],
    ['오이', '🥒'], ['가지', '🍆'], ['마늘', '🧄'], ['양파', '🧅'], ['고추', '🌶️'], ['땅콩', '🥜'],
    ['밤', '🌰'], ['달걀', '🥚'], ['베이컨', '🥓'], ['스테이크', '🥩'], ['치킨', '🍗'], ['햄버거', '🍔'],
    ['피자', '🍕'], ['핫도그', '🌭'], ['감자튀김', '🍟'], ['샌드위치', '🥪'], ['타코', '🌮'], ['부리토', '🌯'],
    ['샐러드', '🥗'], ['스파게티', '🍝'], ['카레', '🍛'], ['라면', '🍜'], ['초밥', '🍣'], ['주먹밥', '🍙'],
    ['떡볶이', '🥘'], ['어묵', '🍢'], ['만두', '🥟'], ['새우튀김', '🍤'], ['게', '🦀'], ['랍스터', '🦞'],
    ['오징어', '🦑'], ['밥', '🍚'], ['국밥', '🍲'], ['김치찌개', '🍲'], ['된장국', '🍲'], ['냉면', '🍜'],
    ['짜장면', '🍜'], ['짬뽕', '🍜'], ['팥빙수', '🍧'], ['아이스크림', '🍦'], ['도넛', '🍩'], ['쿠키', '🍪'],
    ['케이크', '🍰'], ['컵케이크', '🧁'], ['푸딩', '🍮'], ['초콜릿', '🍫'], ['사탕', '🍬'], ['막대사탕', '🍭'],
    ['꿀', '🍯'], ['우유', '🥛'], ['커피', '☕'], ['녹차', '🍵'], ['주스', '🧃'], ['콜라', '🥤'],
    ['팝콘', '🍿'], ['프레첼', '🥨'], ['크루아상', '🥐'], ['식빵', '🍞'], ['베이글', '🥯'], ['와플', '🧇'],
    ['팬케이크', '🥞'], ['버터', '🧈'], ['치즈', '🧀'], ['파이', '🥧'], ['연어초밥', '🍣'], ['경단', '🍡'],
    ['갈비', '🍖'], ['삼겹살', '🥓'], ['불고기', '🥩'], ['비빔밥', '🍚'], ['오믈렛', '🍳'], ['꼬치', '🍢'],
    ['케밥', '🥙'], ['팔라펠', '🧆'], ['바게트', '🥖'], ['소금', '🧂'], ['통조림', '🥫'], ['젤라토', '🍨'],
    ['과일펀치', '🍹'], ['풋사과', '🍏'], ['배추', '🥬'], ['쌀과자', '🍘'], ['포춘쿠키', '🥠'], ['볶음밥', '🍚'],
    ['닭꼬치', '🍢'], ['군만두', '🥟'], ['컵라면', '🍜'], ['튀김우동', '🍜'], ['떡국', '🍲'], ['미역국', '🍲'],
    ['계란후라이', '🍳'], ['레모네이드', '🍋'],
  ],
  en: [
    ['apple', '🍎'], ['banana', '🍌'], ['grape', '🍇'], ['watermelon', '🍉'], ['strawberry', '🍓'], ['peach', '🍑'],
    ['pineapple', '🍍'], ['kiwi', '🥝'], ['cherry', '🍒'], ['lemon', '🍋'], ['orange', '🍊'], ['mango', '🥭'],
    ['coconut', '🥥'], ['avocado', '🥑'], ['bento', '🍱'], ['pear', '🍐'], ['melon', '🍈'], ['tomato', '🍅'],
    ['carrot', '🥕'], ['corn', '🌽'], ['broccoli', '🥦'], ['mushroom', '🍄'], ['potato', '🥔'], ['cucumber', '🥒'],
    ['eggplant', '🍆'], ['garlic', '🧄'], ['onion', '🧅'], ['pepper', '🌶️'], ['peanut', '🥜'], ['chestnut', '🌰'],
    ['egg', '🥚'], ['bacon', '🥓'], ['steak', '🥩'], ['chicken', '🍗'], ['burger', '🍔'], ['pizza', '🍕'],
    ['hotdog', '🌭'], ['fries', '🍟'], ['sandwich', '🥪'], ['taco', '🌮'], ['burrito', '🌯'], ['salad', '🥗'],
    ['spaghetti', '🍝'], ['curry', '🍛'], ['ramen', '🍜'], ['sushi', '🍣'], ['riceball', '🍙'], ['dumpling', '🥟'],
    ['shrimp', '🍤'], ['crab', '🦀'], ['lobster', '🦞'], ['squid', '🦑'], ['oyster', '🦪'], ['rice', '🍚'],
    ['stew', '🍲'], ['soup', '🥣'], ['noodles', '🍜'], ['icecream', '🍦'], ['sorbet', '🍧'], ['flan', '🍮'],
    ['donut', '🍩'], ['cookie', '🍪'], ['cake', '🍰'], ['cupcake', '🧁'], ['pudding', '🍮'], ['chocolate', '🍫'],
    ['candy', '🍬'], ['lollipop', '🍭'], ['honey', '🍯'], ['milk', '🥛'], ['coffee', '☕'], ['tea', '🍵'],
    ['juice', '🧃'], ['soda', '🥤'], ['popcorn', '🍿'], ['pretzel', '🥨'], ['croissant', '🥐'], ['bread', '🍞'],
    ['bagel', '🥯'], ['waffle', '🧇'], ['pancake', '🥞'], ['butter', '🧈'], ['cheese', '🧀'], ['pie', '🥧'],
    ['falafel', '🧆'], ['dango', '🍡'], ['mooncake', '🥮'], ['ribs', '🍖'], ['skewer', '🍢'], ['omelet', '🍳'],
    ['toast', '🍞'], ['smoothie', '🥤'], ['lemonade', '🍋'], ['muffin', '🧁'], ['brownie', '🍫'], ['cereal', '🥣'],
    ['gyro', '🥙'], ['baguette', '🥖'], ['salt', '🧂'], ['beans', '🥫'], ['gelato', '🍨'], ['punch', '🍹'],
    ['greenapple', '🍏'], ['cabbage', '🥬'], ['ricecracker', '🍘'], ['fortunecookie', '🥠'], ['friedrice', '🍚'], ['yakitori', '🍢'],
    ['potsticker', '🥟'], ['bun', '🥟'], ['udon', '🍜'], ['chowder', '🍲'], ['friedegg', '🍳'], ['tangerine', '🍊'],
    ['nuggets', '🍗'], ['sundae', '🍨'],
  ],
};

// 🍩 냠냠 디펜스 — 음식 말고도 떨어지는 것들 (동물 · 물건 · 자연), 그림과 짝
const THINGS = {
  ko: [
    ['우산', '☂️'], ['풍선', '🎈'], ['별', '⭐'], ['선물', '🎁'], ['곰인형', '🧸'], ['축구공', '⚽'],
    ['테니스공', '🎾'], ['책', '📚'], ['전구', '💡'], ['보석', '💎'], ['왕관', '👑'], ['반지', '💍'],
    ['장갑', '🧤'], ['모자', '🎩'], ['신발', '👟'], ['비행접시', '🛸'], ['구름', '☁️'], ['눈송이', '❄️'],
    ['나뭇잎', '🍃'], ['벚꽃', '🌸'], ['해바라기', '🌻'], ['선인장', '🌵'], ['병아리', '🐤'], ['열대어', '🐠'],
    ['나비', '🦋'], ['무당벌레', '🐞'], ['달팽이', '🐌'], ['문어', '🐙'], ['펭귄', '🐧'], ['토끼', '🐰'],
    ['고양이', '🐱'], ['강아지', '🐶'], ['폭죽', '🎆'], ['트로피', '🏆'], ['메달', '🏅'], ['주사위', '🎲'],
    ['퍼즐', '🧩'], ['기타', '🎸'], ['북', '🥁'], ['마이크', '🎤'], ['편지', '💌'], ['종', '🔔'],
    ['양초', '🕯️'], ['돛단배', '⛵'], ['로봇', '🤖'], ['요요', '🪀'], ['연', '🪁'], ['무지개', '🌈'],
    ['단풍잎', '🍁'], ['조개', '🐚'],
    ['여우', '🦊'], ['곰', '🐻'], ['판다', '🐼'], ['코알라', '🐨'], ['돼지', '🐷'], ['개구리', '🐸'],
    ['원숭이', '🐵'], ['오리', '🦆'], ['부엉이', '🦉'], ['거북이', '🐢'], ['꿀벌', '🐝'], ['고슴도치', '🦔'],
    ['다람쥐', '🐿️'], ['앵무새', '🦜'], ['공작새', '🦚'], ['홍학', '🦩'], ['안경', '👓'], ['가방', '🎒'],
    ['손목시계', '⌚'], ['모래시계', '⏳'], ['자석', '🧲'], ['크레파스', '🖍️'], ['물감', '🎨'], ['네잎클로버', '🍀'],
    ['해님', '☀️'], ['달님', '🌙'], ['수정구슬', '🔮'], ['텐트', '⛺'], ['자동차', '🚗'], ['버스', '🚌'],
    ['기차', '🚂'], ['헬리콥터', '🚁'], ['자전거', '🚲'], ['오토바이', '🏍️'],
  ],
  en: [
    ['umbrella', '☂️'], ['balloon', '🎈'], ['star', '⭐'], ['gift', '🎁'], ['teddy', '🧸'], ['soccerball', '⚽'],
    ['tennisball', '🎾'], ['book', '📚'], ['bulb', '💡'], ['diamond', '💎'], ['crown', '👑'], ['ring', '💍'],
    ['gloves', '🧤'], ['tophat', '🎩'], ['shoe', '👟'], ['ufo', '🛸'], ['cloud', '☁️'], ['snowflake', '❄️'],
    ['leaf', '🍃'], ['blossom', '🌸'], ['sunflower', '🌻'], ['cactus', '🌵'], ['chick', '🐤'], ['fish', '🐠'],
    ['butterfly', '🦋'], ['ladybug', '🐞'], ['snail', '🐌'], ['octopus', '🐙'], ['penguin', '🐧'], ['bunny', '🐰'],
    ['kitten', '🐱'], ['puppy', '🐶'], ['fireworks', '🎆'], ['trophy', '🏆'], ['medal', '🏅'], ['dice', '🎲'],
    ['puzzle', '🧩'], ['guitar', '🎸'], ['drum', '🥁'], ['microphone', '🎤'], ['letter', '💌'], ['bell', '🔔'],
    ['candle', '🕯️'], ['sailboat', '⛵'], ['yoyo', '🪀'], ['kite', '🪁'], ['rainbow', '🌈'], ['maple', '🍁'],
    ['seashell', '🐚'], ['robot', '🤖'],
    ['fox', '🦊'], ['bear', '🐻'], ['panda', '🐼'], ['koala', '🐨'], ['piglet', '🐷'], ['frog', '🐸'],
    ['monkey', '🐵'], ['duck', '🦆'], ['owl', '🦉'], ['turtle', '🐢'], ['bee', '🐝'], ['hedgehog', '🦔'],
    ['squirrel', '🐿️'], ['parrot', '🦜'], ['peacock', '🦚'], ['flamingo', '🦩'], ['spectacles', '👓'], ['schoolbag', '🎒'],
    ['watch', '⌚'], ['hourglass', '⏳'], ['magnet', '🧲'], ['paints', '🎨'], ['clover', '🍀'], ['sunshine', '☀️'],
    ['moonlight', '🌙'], ['crystal', '🔮'], ['tent', '⛺'], ['car', '🚗'], ['schoolbus', '🚌'], ['steamtrain', '🚂'],
    ['helicopter', '🚁'], ['bicycle', '🚲'], ['motorbike', '🏍️'],
  ],
};

// 🪢 줄다리기 대작전 — 사자성어 · 스포츠 · 힘센 동물 · 모험 (긴 낱말일수록 세게 당긴다)
const TUG_WORDS = {
  ko: [
    // 사자성어
    '일석이조', '대기만성', '고진감래', '우공이산', '유비무환', '동고동락', '일취월장', '죽마고우', '금상첨화', '전화위복',
    '다재다능', '백발백중', '자업자득', '설상가상', '이심전심', '천하무적', '막상막하', '용두사미', '오리무중', '일편단심',
    '형설지공', '각골난망', '결초보은', '와신상담', '칠전팔기', '사필귀정', '십시일반', '역지사지', '온고지신', '청출어람',
    // 스포츠
    '축구', '야구', '농구', '배구', '탁구', '테니스', '배드민턴', '수영', '마라톤', '태권도',
    '씨름', '유도', '체조', '스키', '스케이트', '서핑', '볼링', '골프', '줄넘기', '줄다리기',
    '펜싱', '양궁', '조정', '복싱', '역도',
    // 힘센 동물
    '코끼리', '하마', '코뿔소', '고릴라', '호랑이', '사자', '불곰', '들소', '독수리', '상어',
    '혹등고래', '공룡', '악어', '늑대', '황소',
    // 모험
    '용사', '기사', '마법사', '해적선', '보물상자', '성벽', '화산', '폭풍우', '번개', '천둥',
    '우주선', '거대로봇', '영웅', '전설', '모험가', '탐험대', '챔피언', '승리', '도전', '불사조',
    // 응원
    '영차영차', '으라차차', '힘내라', '끝까지', '한번더', '이겨라', '할수있다', '파이팅', '협동', '단결',
    // 더 많은 사자성어 · 스포츠 · 동물 · 영웅
    '과유불급', '새옹지마', '오매불망', '동문서답', '적반하장', '호시탐탐', '갑론을박', '이구동성', '외유내강', '대동단결',
    '하키', '럭비', '승마', '사이클', '카누', '핸드볼', '크리켓', '컬링', '봅슬레이', '스노보드',
    '맘모스', '치타', '표범', '캥거루', '타조', '펠리컨', '바다사자', '북극곰', '바다코끼리', '물소',
    '해적왕', '보물지도', '무인도', '등반가', '개척자', '수호자', '대장군', '천하장사', '불도저', '기관차',
    // 사자성어
    '권선징악', '기사회생', '노심초사', '다다익선', '명불허전', '박학다식', '방방곡곡', '부전자전', '비몽사몽', '사면초가',
    '산전수전', '소탐대실', '안하무인', '애지중지', '어부지리', '우왕좌왕', '유유자적', '인과응보', '자포자기', '작심삼일',
    // 스포츠
    '육상', '높이뛰기', '멀리뛰기', '창던지기', '원반던지기', '철인삼종', '근대오종', '레슬링', '검도', '합기도',
    '카약', '요트', '클라이밍', '스쿼시', '당구',
    // 동물
    '흰수염고래', '범고래', '대왕오징어', '장수풍뎅이', '사슴벌레', '멧돼지', '고라니', '반달곰', '두루미', '올빼미',
    '해마', '바다거북', '독사', '들개', '살쾡이',
    // 판타지
    '드래곤', '유니콘', '그리핀', '골렘', '기사단', '마왕', '용병', '검객', '궁수', '방패병',
    '성기사', '대마법사', '소환사', '결투', '원정대',
    // 응원
    '아자아자', '가즈아', '버텨라', '밀어붙여', '당겨라', '한마음', '팀워크', '투혼', '패기', '근성',
    '집념', '불굴', '투지', '열정', '끈기',
  ],
  en: [
    // strength · battle
    'champion', 'victory', 'strength', 'muscle', 'power', 'warrior', 'knight', 'wizard', 'dragon', 'giant',
    'titan', 'thunder', 'lightning', 'volcano', 'hurricane', 'tornado', 'avalanche', 'earthquake', 'gladiator', 'phoenix',
    // adventure
    'adventure', 'explorer', 'treasure', 'pirate', 'captain', 'galaxy', 'universe', 'meteor', 'gravity', 'expedition',
    // sports
    'football', 'baseball', 'basketball', 'volleyball', 'tennis', 'badminton', 'swimming', 'marathon', 'taekwondo', 'wrestling',
    'gymnastics', 'skiing', 'skating', 'surfing', 'bowling', 'golf', 'archery', 'rowing', 'boxing', 'sprint',
    'olympics', 'fencing', 'weightlifting', 'kayaking', 'climbing',
    // strong animals
    'elephant', 'hippo', 'rhino', 'gorilla', 'tiger', 'lion', 'grizzly', 'bison', 'eagle', 'shark',
    'humpback', 'dinosaur', 'crocodile', 'wolf', 'buffalo',
    // spirit
    'teamwork', 'together', 'courage', 'fearless', 'unstoppable', 'legendary', 'invincible', 'determination', 'persistence', 'momentum',
    'endurance', 'heave', 'anchor', 'rope', 'grip', 'hustle', 'focus', 'spirit', 'rally', 'triumph',
    'valiant', 'mighty', 'colossal', 'heroic', 'resilience', 'powerhouse', 'superhero', 'thunderbolt', 'brawny', 'steadfast',
    // more sports · animals · heroes · forces of nature
    'hockey', 'rugby', 'cycling', 'canoe', 'handball', 'cricket', 'curling', 'bobsled', 'snowboard', 'equestrian',
    'mammoth', 'cheetah', 'leopard', 'kangaroo', 'ostrich', 'walrus', 'polarbear', 'moose', 'yak', 'orca',
    'pioneer', 'guardian', 'general', 'strongman', 'bulldozer', 'locomotive', 'juggernaut', 'lumberjack', 'mountaineer', 'navigator',
    'overdrive', 'supernova', 'typhoon', 'blizzard', 'tsunami', 'cyclone', 'stampede', 'rampage', 'vanguard', 'crusader',
    // heroes · myths
    'archer', 'paladin', 'sorcerer', 'summoner', 'warlord', 'samurai', 'ninja', 'viking', 'spartan', 'ranger',
    'unicorn', 'griffin', 'golem', 'kraken', 'hydra', 'minotaur', 'cyclops', 'werewolf', 'vampire', 'behemoth',
    // sports
    'decathlon', 'triathlon', 'javelin', 'hurdles', 'discus', 'kendo', 'judo', 'karate', 'sumo', 'lacrosse',
    'polo', 'squash', 'billiards', 'sailing', 'fencer',
    // animals
    'stallion', 'bulldog', 'mustang', 'panther', 'jaguar', 'hyena', 'warthog', 'boar', 'stag', 'falcon',
    'hawk', 'condor', 'barracuda', 'swordfish', 'rattlesnake',
    // spirit · power
    'grit', 'willpower', 'tenacity', 'valor', 'bravery', 'stamina', 'vigor', 'might', 'force', 'fortitude',
    'resolve', 'passion', 'zeal', 'unity', 'glory', 'honor', 'legacy', 'destiny', 'victorious', 'relentless',
    'dauntless', 'tireless', 'powerful', 'heavyweight', 'thunderclap', 'firestorm', 'sandstorm', 'whirlwind', 'shockwave', 'meteorite',
  ],
};

// 목록을 섞어 두고 차례로 꺼낸다(다 꺼내면 다시 섞기) — 한 바퀴 돌기 전엔 같은 낱말이 다시 나오지 않게
const bags = new Map();

function shuffled(list) {
  const pool = [...list];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}

const pickFrom = (key, list, except) => {
  const taken = new Set(except);
  let bag = bags.get(key);
  for (let tries = 0; tries < 2; tries += 1) {
    if (!bag?.length) bag = shuffled(list);
    const index = bag.findIndex((w) => !taken.has(w)); // 화면에 이미 있는 낱말은 건너뛴다
    if (index !== -1) {
      const [word] = bag.splice(index, 1);
      bags.set(key, bag);
      return word;
    }
    bag = null; // 남은 것이 모두 화면에 있으면 새로 섞는다
  }
  return list[Math.floor(Math.random() * list.length)];
};

/** 타임 어택 · 줄다리기 낱말 — 화면에 이미 있는 낱말(except)과 겹치지 않게 */
export function pickGameWord(game, mode, except = []) {
  const list = game === 'tug' ? TUG_WORDS[mode] : SPEED_WORDS[mode];
  return pickFrom(`${game}:${mode}`, list, except);
}

const FALLING = { ko: [...FOODS.ko, ...THINGS.ko], en: [...FOODS.en, ...THINGS.en] };

/** 냠냠 디펜스 — 음식 · 동물 · 물건 등 떨어지는 것 하나 { word, icon } */
export function pickFalling(mode, except = []) {
  const word = pickFrom(
    `rain:${mode}`,
    FALLING[mode].map(([w]) => w),
    except,
  );
  return { word, icon: FALLING[mode].find(([w]) => w === word)[1] };
}

// 데이터 점검용 (QA · 개발 중 확인)
export const GAME_WORD_LISTS = {
  speed: SPEED_WORDS,
  tug: TUG_WORDS,
  rain: { ko: FALLING.ko.map(([w]) => w), en: FALLING.en.map(([w]) => w) },
};
