/* 깃들 데모: 숫자 모음
   여기 있는 숫자는 모두 임시다. 해 보면서 이 파일만 고치면 된다.
   돈과 흔적의 빈도는 게임 규칙이고, 오고 머무는 판단은 임시 규칙이다(rules.js). */
window.GD = window.GD || {};

GD.CFG = {
  saveKey: 'gitdeul_demo_v1',

  /* ---------- 하루 ---------- */
  dayLen: 420,               // 하루의 길이(초). 7분
  phases: [                  // until: 하루 가운데 이때까지(0~1)
    { id: 'dawn',  name: '새벽',    until: 0.12 },
    { id: 'day',   name: '낮',      until: 0.62 },
    { id: 'dusk',  name: '해 질 녘', until: 0.80 },
    { id: 'night', name: '밤',      until: 1.00 }
  ],
  sleepFrom: 'dusk',         // 이때부터 잠들 수 있다
  sitSpeed: 12,              // 앉아서 바라볼 때 시간이 가는 빠르기(배)
  yearDays: 14,              // 한 해(제철)의 날 수

  /* ---------- 땅 ---------- */
  hexR: 0.62,                // 육각형 칸의 크기(가운데에서 꼭짓점까지). 1은 약 2.7m
  startRings: 3,             // 시작은 가운데 한 칸과 둘레 세 겹 = 37칸
  maxRings: 5,               // 두 번까지 넓힐 수 있다
  expandCost: { 4: 60, 5: 110 },   // 겹을 더할 때 드는 돈 (게임 규칙)

  /* ---------- 돈 (게임 규칙) ---------- */
  startMoney: 30,
  cost: { '조금': 3, '보통': 6, '많이': 10, '아주 많이': 16 },  // 칸과 아이템의 값
  bigRefund: 0.5,            // 돈 되는 칸을 헐면 돌아오는 비율
  income: {
    base: 3,                 // 매일 들어오는 기본 수입
    big: 3,                  // 돈 되는 칸 하나가 매일 버는 돈
    small: 4,                // 작은 벌이 한 번(볏짚 한 칸)
    stay: 2,                 // 보전 수입: 어려운 발길이 머묾일 때 매일 (11월 28일 모의로 6에서 낮춤)
    settle: 4,               // 보전 수입: 어려운 발길이 깃듦일 때 매일 (10에서 낮춤)
    guest: 8,                // 손님(구경꾼)을 받으면
    trash: 1,                // 폐비닐 하나 (2에서 낮춤)
    record: [2, 3, 5],       // 도감에 들름, 머묾, 깃듦을 적을 때 ([3, 5, 8]에서 낮춤)
    crop: 3                  // 해가 넘어갈 때 논 한 칸의 수확
  },
  decorCost: { wall: 3, path: 3, pavilion: 12 },

  /* ---------- 오는 법 (임시 규칙) ---------- */
  levelCut: [0.4, 0.7],      // 점수가 이 값을 넘으면 보통, 높음
  // 가능성(낮음, 보통, 높음)에 따른 올 확률. 자리마다 다르다.
  arriveP: {
    often:  [0.25, 0.75, 0.97],
    seldom: [0.08, 0.45, 0.80],
    hard:   [0.04, 0.38, 0.80]
  },
  returnP: 0.92,             // 머묾 이상인 이웃이 가능성 보통 이상일 때 다시 올 확률

  /* ---------- 편안함 (임시 규칙) ---------- */
  comfort: {
    stayGain: [4, 9, 13],    // 머물 가능성이 낮음, 보통, 높음인 채로 하루가 지나면
    watched: 4,              // 멀리서 조용히 바라봄
    food: 2,                 // 먹이를 넉넉히 남겨 둠
    rest: 3,                 // 쉴 자리가 마련돼 있음
    sign: 2,                 // 푯말이 놓여 있음
    blind: 2,                // 가림막이 놓여 있음
    careMax: 7,              // 돌봄으로 하루에 더해지는 값의 위
    trash: 1,                // 폐비닐 하나를 주울 때 와 있는 이웃에게
    spooked: 8,              // 뛰어서 다가가 날려 보냄
    dug: 10,                 // 머무는 칸을 갈아엎음
    guestHit: 10,            // 손님을 받음
    guestHitGuarded: 4,      // 푯말이나 가림막이 있을 때 손님을 받음
    intruderLeft: 6,         // 불청객을 내버려 둠
    awayDrop: 4,             // 오지 않은 날(가능성 보통 이상)
    stay: 50, settle: 100,   // 머묾, 깃듦이 되는 값
    nextYear: { settle: 60, stay: 30 }   // 해가 넘어갈 때 남는 값
  },

  /* ---------- 흔적 (게임 규칙) ---------- */
  trace: {
    passedP: 0.55,           // 가능성 보통 이상인데 오지 않은 날, 다녀간 흔적이 생길 확률
    max: 4                   // 하루에 놓이는 흔적의 위
  },

  /* ---------- 불청객과 손님 (게임 규칙) ---------- */
  guestP: 0.45,              // 어려운 발길이 온 뒤, 아침마다 구경꾼이 올 확률
  intruderP: 0.35,           // 조건이 맞을 때 아침마다 불청객이 들어올 확률
  intruderFixCost: 8,        // 불청객을 대하는 데 드는 돈
  trashPerDay: 3,            // 아침마다 날려 오는 폐비닐

  /* ---------- 걷기와 바라보기 ---------- */
  walk: {
    speed: 0.8, run: 1.7,    // 걷기, 뛰기의 빠르기
    eye: 0.5,                // 눈높이
    watchTime: 3.5,          // 가만히 바라봐야 도감에 적히는 시간(초)
    watchRange: 2.8,         // 바라볼 수 있는 거리
    alert: 1.35, alertRun: 2.3,   // 이웃이 알아채는 거리(걸을 때, 뛸 때)
    flee: 0.85, fleeRun: 1.5,     // 이웃이 달아나는 거리
    pick: 0.45,              // 흔적과 폐비닐을 줍는 거리
    returnAfter: 14,         // 놀라 날아간 새가 다시 내려앉기까지, 가만히 서 있거나 멀리 떨어져 있어야 하는 시간(초)
    heavyFly: true           // 두루미, 황새, 큰고니가 뛰어오는 사람에 놀라 날아오를 때 간단한 모형으로 바꿔 보여 줄지
  },
  // 단계(들름, 머묾, 깃듦)에 따라 경계 거리에 곱하는 값. 편안할수록 가까이 갈 수 있다.
  wary: [1.45, 1.45, 1.0, 0.7],

  /* ---------- 그래픽 ---------- */
  quality: {
    low:  { name: '낮음', dpr: 1.0,  aa: false, shadow: 0,    post: false, mirror: false, veg: 0.3, sub: 4, snow: 250, far: 30, simple: true  },
    mid:  { name: '보통', dpr: 1.25, aa: true,  shadow: 1024, post: false, mirror: false, veg: 0.6, sub: 5, snow: 600, far: 60, simple: false },
    high: { name: '높음', dpr: 1.5,  aa: true,  shadow: 2048, post: true,  mirror: true,  veg: 1.0, sub: 6, snow: 950, far: 90, simple: false }
  },
  defaultQuality: 'mid',
  autoLowerFps: 26           // 처음 몇 초의 초당 장면 수가 이보다 낮으면 한 단계 낮추자고 알린다
};

/* 낱말 */
GD.TIER = { often: '잦은 발길', seldom: '뜸한 발길', hard: '어려운 발길' };
GD.TIER_LINE = { often: '자주 찾아와요', seldom: '가끔 찾아와요', hard: '땅이 잘 맞아야 찾아와요' };
GD.LV = ['낮음', '보통', '높음'];
GD.STG = ['', '들름', '머묾', '깃듦'];
GD.TRACE = { footprint: '발자국', feather: '깃털', dropping: '배설물', sound: '소리', tower: '돌탑', burrow: '굴', scale: '비늘', shell: '껍데기', nibble: '뜯은 자국', hair: '털', nest: '둥지', sprout: '싹' };
GD.BASIS = {
  model: '모델', literature: '문헌 규칙', temp: '임시 규칙', game: '게임 규칙'
};
GD.KEEPER = { field: '들녘지기', stream: '냇가지기', forest: '숲지기', coast: '바닷가지기' };
