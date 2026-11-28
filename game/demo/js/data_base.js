/* 깃들 데모: 바탕 자료
   demo_content/ 의 자료(zones.json, species.json, news.json)가 없어도 게임이 돌도록 넣어 둔 것이다.
   모양은 demo/CONTRACT.md 와 같다. demo_content 의 자료가 있으면 그것이 이 자료를 덮어쓴다(content.js).
   여기 적힌 글 가운데 문서에서 가져오지 않은 것은 from 에 "짐작"이라고 적었고, 화면에 임시라고 뜬다. */
(function () {
  const B = GD.BASE = {};

  /* 이름표: CONTRACT.md 의 표와 같다 */
  B.zoneTable = [
    ['field', '겨울 들녘', '겨울', 1], ['stream', '봄 냇가', '봄', 2], ['forest', '여름 숲', '여름', 3], ['coast', '가을 바닷가', '가을', 4]
  ];
  B.speciesTable = [
    ['crane', '두루미', 'field', 'hard', 'bird'], ['stork', '황새', 'field', 'hard', 'bird'], ['swan', '큰고니', 'field', 'hard', 'bird'],
    ['kestrel', '황조롱이', 'field', 'seldom', 'bird'], ['beangoose', '큰기러기', 'field', 'seldom', 'bird'],
    ['wfgoose', '쇠기러기', 'field', 'often', 'bird'], ['mallard', '청둥오리', 'field', 'often', 'bird'],
    ['eoreumchi', '어름치', 'stream', 'hard', 'fish'], ['gamdol', '감돌고기', 'stream', 'hard', 'fish'], ['otter', '수달', 'stream', 'hard', 'mammal'],
    ['mandarin', '원앙', 'stream', 'seldom', 'bird'], ['ssogari', '쏘가리', 'stream', 'seldom', 'fish'], ['ayu', '은어', 'stream', 'seldom', 'fish'],
    ['pirami', '피라미', 'stream', 'often', 'fish'], ['galgyeoni', '참갈겨니', 'stream', 'often', 'fish'], ['beodeulchi', '버들치', 'stream', 'often', 'fish'],
    ['goral', '산양', 'forest', 'hard', 'mammal'], ['flyingsquirrel', '하늘다람쥐', 'forest', 'hard', 'mammal'],
    ['scopsowl', '소쩍새', 'forest', 'seldom', 'bird'], ['hawkowl', '솔부엉이', 'forest', 'seldom', 'bird'],
    ['badger', '오소리', 'forest', 'seldom', 'mammal'], ['roedeer', '노루', 'forest', 'seldom', 'mammal'],
    ['chipmunk', '다람쥐', 'forest', 'often', 'mammal'], ['redsquirrel', '청설모', 'forest', 'often', 'mammal'], ['hare', '멧토끼', 'forest', 'often', 'mammal'],
    ['ghostcrab', '달랑게', 'coast', 'hard', 'crab'], ['spoonbillsandpiper', '넓적부리도요', 'coast', 'hard', 'bird'], ['seal', '점박이물범', 'coast', 'hard', 'mammal'],
    ['rugosa', '해당화', 'coast', 'seldom', 'plant'], ['fiddler', '농게', 'coast', 'seldom', 'crab'], ['sandbubbler', '엽낭게', 'coast', 'seldom', 'crab'], ['spoonbill', '저어새', 'coast', 'seldom', 'bird'],
    ['reed', '갈대', 'coast', 'often', 'plant'], ['suaeda', '칠면초', 'coast', 'often', 'plant'], ['mudcrab', '칠게', 'coast', 'often', 'crab'], ['heron', '왜가리', 'coast', 'often', 'bird']
  ];
  B.intruderTable = [
    ['visitors', '구경꾼', 'field', 'person'], ['bass', '배스', 'stream', 'fish'], ['bluegill', '블루길', 'stream', 'fish'],
    ['sika', '꽃사슴', 'forest', 'mammal'], ['spartina', '영국갯끈풀', 'coast', 'plant']
  ];

  /* 겨울 들녘 (기획서 11.1) */
  B.zones = [{
    id: 'field', name: '겨울 들녘', season: '겨울', order: 1,
    walk: '논둑을 걷는다', dilemma: '넓이를 어떻게 나눌까', aiDetail: 'count',
    tiles: [
      { id: 'paddy', name: '논', goodFor: '추수한 논의 낟알이 두루미와 기러기의 먹이다', costLevel: '조금' },
      { id: 'marsh', name: '습지', goodFor: '황새가 얕은 물을 걸으며 물고기를 잡는다', costLevel: '조금' },
      { id: 'water', name: '물', goodFor: '큰고니가 내려앉는다', costLevel: '조금' },
      { id: 'reedbed', name: '갈대밭', goodFor: '숨을 곳이 된다', costLevel: '조금' },
      { id: 'grass', name: '풀밭', goodFor: '황조롱이가 들쥐를 잡는다', costLevel: '조금' },
      { id: 'wood', name: '숲', goodFor: '너무 넓으면 시야를 막아 큰 새가 꺼린다', costLevel: '조금' },
      { id: 'house', name: '집', goodFor: '지킴이의 집이다', costLevel: '조금' },
      { id: 'greenhouse', name: '비닐하우스', goodFor: '돈이 된다. 먹이터가 사라진다', costLevel: '아주 많이' }
    ],
    items: [
      { id: 'watergate', name: '물꼬', placeOn: ['paddy'], does: '그 논에 물을 얕게 댄다', kind: 'care' },
      { id: 'sign', name: '푯말', placeOn: ['*'], does: '둘레 칸에 사람 발길이 준다', kind: 'care' },
      { id: 'blind', name: '가림막', placeOn: ['*'], does: '시야를 가려 방해를 줄인다', kind: 'care' },
      { id: 'rest', name: '쉴 자리', placeOn: ['marsh', 'reedbed', 'grass', 'paddy'], does: '사람이 들어가지 않는 조용한 자리를 남겨 둔다', kind: 'care' }
    ],
    earn: {
      big: { id: 'greenhouse', name: '비닐하우스', price: '먹이터가 사라진다' },
      small: { id: 'straw', name: '볏짚 팔기', leaveFor: '두루미가 먹는다' },
      guest: { id: 'visitors', name: '구경꾼' }
    },
    intruder: { id: 'visitors', when: '어려운 발길이 왔다는 소문', harm: '새들의 편안함이 깎인다', counter: ['푯말', '가림막'] }
  }];

  const sp = (id, sci, badges, dayPart, likes, dislikes, stages, traces, story, extra) => Object.assign({
    id, zone: 'field', sci, badges, badgesChecked: false, dayPart, hidden: false, basis: 'model',
    likes, dislikes, stages: { visit: stages[0], stay: stages[1], settle: stages[2] }, traces,
    story: { text: story, sources: [], checked: false }
  }, extra || {});
  const L = (tile, weight, why, from) => ({ tile, weight, why, from });
  const GH = L('greenhouse', 'strong', '먹이터가 사라진다', '기획서 11.1');

  B.species = [
    sp('crane', 'Grus japonensis', ['천연기념물', '멸종위기 I급'], ['dawn', 'day', 'dusk'],
      [L('paddy', 'strong', '낟알을 주워 먹는다', '기획서 11.1'), L('marsh', 'some', '얕은 물에서 밤을 난다', '기획서 11.1')],
      [GH, L('wood', 'some', '시야가 막힌다', '기획서 11.1')],
      ['부부가 번갈아 고개를 들며 살펴요.', '가족이 깃을 다듬으며 느긋해졌어요.', '한 쌍이 춤추고 함께 울어요.'],
      ['footprint', 'feather', 'dropping'],
      '겨울이면 철원과 연천 같은 들녘에서 낟알을 주워 먹으며 지내요.'),
    sp('stork', 'Ciconia boyciana', ['천연기념물', '멸종위기 I급'], ['day', 'dusk'],
      [L('marsh', 'strong', '얕은 물을 걸으며 물고기를 잡는다', '기획서 11.1'), L('paddy', 'some', '물 댄 논이 사냥터가 된다', '기획서 11.1')],
      [GH, L('wood', 'some', '시야가 막힌다', '기획서 11.1')],
      ['혼자 논둑에 서 있어요.', '얕은 물을 걸으며 사냥해요.', '작은 무리로 모였어요.'],
      ['footprint', 'feather'],
      '얕은 물가에서 물고기와 미꾸라지를 잡아먹어요. 예산에서 복원하고 있어요.'),
    sp('swan', 'Cygnus cygnus', ['천연기념물', '멸종위기 II급'], ['dawn', 'day', 'dusk'],
      [L('water', 'strong', '넓은 물에 내려앉는다', '기획서 11.1'), L('reedbed', 'some', '물가 풀숲에서 먹는다', '짐작'), L('marsh', 'some', '물가 풀숲에서 먹는다', '짐작')],
      [GH, L('wood', 'some', '시야가 막힌다', '기획서 11.1')],
      ['물 가운데 멀리 떠 있어요.', '물가 가까이에서 먹어요.', '이 물을 제 터로 삼았어요.'],
      ['feather', 'dropping'],
      '겨울이면 호수와 강 하구에서 물풀을 먹으며 지내요.'),
    sp('kestrel', 'Falco tinnunculus', ['천연기념물'], ['day'],
      [L('grass', 'strong', '풀밭에서 들쥐를 잡는다', '기획서 11.1'), L('paddy', 'some', '트인 논 위를 난다', '짐작')],
      [L('greenhouse', 'some', '사냥터가 사라진다', '짐작'), L('wood', 'some', '트인 땅이 줄어든다', '짐작')],
      ['높은 곳에 앉아 살펴요.', '들판 위를 낮게 날아요.', '멈춰 떠 있다가 내리꽂아요.'],
      ['feather', 'dropping'],
      '들판 위에 멈춰 떠 있다가 들쥐를 잡는 작은 매예요.'),
    sp('beangoose', 'Anser fabalis', ['멸종위기 II급'], ['dawn', 'dusk'],
      [L('paddy', 'strong', '낟알을 주워 먹는다', '기획서 11.1'), L('water', 'some', '물에서 밤을 난다', '짐작'), L('marsh', 'some', '물가에서 쉰다', '짐작')],
      [GH, L('wood', 'some', '시야가 막힌다', '기획서 11.1')],
      ['멀찍이 내려앉아 자주 고개를 들어요.', '논에 흩어져 느긋하게 먹어요.', '해마다 들르는 무리가 됐어요.'],
      ['footprint', 'dropping', 'feather'],
      '겨울에 논과 물가를 오가며 지내는 큰 기러기예요.'),
    sp('wfgoose', 'Anser albifrons', [], ['dawn', 'day', 'dusk'],
      [L('paddy', 'strong', '낟알을 주워 먹는다', '기획서 11.1')],
      [GH, L('wood', 'some', '시야가 막힌다', '기획서 11.1')],
      ['놀라면 떼로 날아올라요.', '내려앉아 먹어요.', '큰 무리가 됐어요.'],
      ['footprint', 'dropping', 'feather'],
      '겨울 논에서 떼 지어 낟알을 주워 먹는 기러기예요.'),
    sp('mallard', 'Anas platyrhynchos', [], ['dawn', 'day', 'dusk', 'night'],
      [L('water', 'strong', '물에 떠서 쉰다', '짐작'), L('marsh', 'some', '얕은 물에서 먹는다', '짐작')],
      [L('greenhouse', 'some', '쉴 물가가 줄어든다', '짐작')],
      ['물 가운데로 물러나 떠 있어요.', '물가에서 느긋하게 먹어요.', '무리가 이 물에서 겨울을 나요.'],
      ['footprint', 'feather'],
      '겨울 물가에서 가장 자주 만나는 오리예요.')
  ];

  /* 오늘의 소식에 쓰는 글 (기획서 4.3) */
  B.news = [
    { id: 'passed', zone: '*', text: '다녀간 흔적이 있어요. 찾아보세요', when: '다녀간 흔적이 생긴 날' },
    { id: 'hidden', zone: '*', text: '어딘가에 숨은 이웃의 흔적이 있어요', when: '와 있지만 지금은 보이지 않는 이웃이 있는 날' },
    { id: 'guest', zone: '*', text: '손님이 온대요', when: '손님이 오는 날' },
    { id: 'trash', zone: 'field', text: '폐비닐이 날려 왔어요', when: '폐비닐이 놓인 날' },
    { id: 'stay', zone: '*', text: '머무는 이웃이 있어요. 조용히 바라보면 더 편안해해요', when: '머묾 단계의 이웃이 와 있는 날' },
    { id: 'settled', zone: '*', text: '깃든 이웃이 있어요. 찾아가 바라보면 그 자리에 이름을 지을 수 있어요', when: '깃듦이 됐는데 아직 이름을 짓지 않은 날' },
    { id: 'near', zone: '*', text: '조금만 더 가꾸면 찾아올 이웃이 있어요', when: '올 가능성이 보통인 이웃이 있는 날' },
    { id: 'dex', zone: '*', text: '도감에 아직 적지 못한 이웃이 와 있어요', when: '와 있는 이웃 가운데 적을 것이 남은 날' },
    { id: 'intruder', zone: '*', text: '불청객이 들어왔어요', when: '불청객이 있는 날' },
    { id: 'lastday', zone: '*', text: '제철의 마지막 날이에요', when: '열나흘째' },
    { id: 'quiet', zone: '*', text: '조용한 아침이에요. 산책하기 좋아요', when: '다른 소식이 없는 날' }
  ];
})();
