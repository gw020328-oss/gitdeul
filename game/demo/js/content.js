/* 깃들 데모: 자료 읽기
   바탕 자료(data_base.js) 위에 demo_content/ 의 자료(window.GD_CONTENT, build.py 가 만든다)를 덮어쓴다.
   게임 코드는 여기서 만든 GD.ZONES, GD.SP, GD.NEWS 만 본다. */
(function () {
  const B = GD.BASE, C = window.GD_CONTENT || {};
  const byId = (arr) => { const m = {}; (arr || []).forEach(o => { if (o && o.id) m[o.id] = o; }); return m; };

  /* 구역마다 게임 코드 쪽에서 정하는 것. 자료 파일에는 숫자와 배치가 없다. */
  const ZCFG = {
    field: {
      hasWalk: true, snow: true, base: 'grass', fixed: ['house'],
      smallOn: ['paddy'], cropOn: ['paddy'],
      start: { '3,-3': 'house', '0,-2': 'paddy', '1,-2': 'paddy', '0,-1': 'paddy', '1,-1': 'paddy', '-1,1': 'marsh', '-3,1': 'wood', '-3,2': 'wood' },
      spawn: '3,-2',
      trash: true,
      sky: 'winter'
    },
    // 냇가에는 아무것도 아닌 땅이 자료에 없어서, 게임 쪽에서 둔치를 하나 넣었다(임시).
    stream: {
      hasWalk: true, snow: false, sky: 'spring', spawn: '1,2', outVeg: 'yard', base: 'bank', extraTiles: [{ id: 'bank', name: '둔치', goodFor: '아직 아무것도 아닌 물가의 빈 땅이다', costLevel: '조금', engine: true }],
      smallOn: ['riffle'], cropOn: ['farm'],
      // 처음 땅은 어려운 발길의 이웃 모두에게 '낮음'이 되게 둔다 (균형 모의로 맞춤, 11월 28일)
      start: { '-2,0': 'riffle', '-1,0': 'riffle', '0,0': 'pool', '-2,-1': 'bankwood', '0,-1': 'bankwood', '2,-1': 'farm', '2,1': 'farm', '3,-2': 'village', '-3,2': 'village' }
    },
    // 숲은 AI가 어려운 발길을 모른다고 말하는 구역이다. 다녀간 흔적이 생겨야 실마리가 잡히므로 하늘다람쥐만 '보통'에 걸치게 침엽수를 셋 둔다.
    forest: {
      hasWalk: true, snow: false, sky: 'summer', spawn: '1,2', outVeg: 'tree', exposure: 1.3, base: 'broadleaf', smallOn: ['broadleaf'],
      start: { '0,0': 'valley', '1,-1': 'valley', '-1,1': 'valley', '2,-2': 'valley', '-2,2': 'valley', '-2,0': 'conifer', '-3,1': 'conifer', '-3,0': 'conifer', '2,1': 'rock', '3,-3': 'clearing', '3,-2': 'clearing', '1,2': 'clearing' }
    },
    coast: {
      hasWalk: true, snow: false, sky: 'autumn', spawn: '1,2', sea: true, farColor: [.78, .7, .54], base: 'mixed', smallOn: ['mixed', 'sand'],
      start: { '-3,0': 'channel', '-2,0': 'channel', '-1,0': 'channel', '0,0': 'channel', '-1,-1': 'mud', '-2,1': 'mud', '3,-2': 'sand', '3,-3': 'dune', '-3,3': 'farmflat', '-2,3': 'farmflat', '-1,3': 'farmflat', '-3,2': 'farmflat' }
    }
  };
  // 자료의 아이템 id 를 게임 코드가 쓰는 id 로 맞춘다
  const ITEM_ALIAS = { signpost: 'sign', screen: 'blind' };
  // 모든 구역에 똑같이 있는 간접 돌봄(쉴 자리 마련하기). 구역마다 무엇으로 할지는 아직 정해지지 않아 임시로 하나를 둔다.
  const REST = { id: 'rest', name: '쉴 자리', placeOn: ['*'], does: '사람이 들어가지 않는 조용한 자리를 남겨 둔다', kind: 'care', engine: true };
  // 모든 구역에 똑같이 있는 꾸밈. occupy 가 true 면 칸을 차지한다(이웃의 판단에 들어간다).
  const DECOR = [
    { id: 'wall', name: '돌담', occupy: false, does: '칸의 가장자리에 돌담을 쌓는다. 이웃의 판단과는 상관이 없다' },
    { id: 'path', name: '길', occupy: true, does: '칸을 흙길로 바꾼다. 칸을 차지한다' },
    { id: 'pavilion', name: '정자', occupy: true, does: '칸에 정자를 짓는다. 칸을 차지한다' }
  ];
  GD.DECOR = DECOR;

  const czones = byId(C.zones), cspecies = byId(C.species);
  const bzones = byId(B.zones), bspecies = byId(B.species);

  GD.ZONES = B.zoneTable.map(([id, name, season, order]) => {
    const src = czones[id] || bzones[id] || null;
    const cfg = ZCFG[id] || {};
    const z = Object.assign({ id, name, season, order, tiles: [], items: [], earn: {}, intruder: null, aiDetail: 'lack', walk: '', dilemma: '' }, src || {});
    z.name = z.name || name; z.season = z.season || season; z.order = order;
    z.ready = !!src;                         // 자료가 있어 플레이할 수 있는 구역인가
    z.fromContent = !!czones[id];
    z.cfg = cfg;
    z.tiles = (z.tiles || []).map(t => { const o = Object.assign({ goodFor: '' }, t); o.costLevel = o.costLevel || '조금'; return o; });
    (cfg.extraTiles || []).forEach(t => { if (!z.tiles.some(o => o.id === t.id)) z.tiles.unshift(Object.assign({}, t)); });
    z.items = (z.items || []).map(i => { const o = Object.assign({ placeOn: ['*'], does: '', kind: 'care' }, i); o.id = ITEM_ALIAS[o.id] || o.id; return o; });
    if (z.item_blind_any !== false) { const b = z.items.find(i => i.id === 'blind'); if (b) b.placeOn = ['*']; }   // 가림막: 길 칸이 생겨 아무 칸에나 놓게 했다
    if (src && !z.items.some(i => i.id === 'rest')) z.items.push(Object.assign({}, REST));
    z.earn = z.earn || {};
    // 돈 되는 칸(큰 벌이): 자료에 earns 로 표시된 칸. 표시가 없으면 큰 벌이의 id 와 같은 칸.
    const big = z.earn.big;
    if (big && big.id && !z.tiles.some(t => t.earns || t.id === big.id)) z.tiles.push({ id: big.id, name: big.name, goodFor: '돈이 된다. ' + (big.price || ''), costLevel: '많이', earns: true });
    z.tiles.forEach(t => {
      t.money = !!t.earns || !!(big && big.id === t.id);
      t.fixed = !!t.fixed || (cfg.fixed || []).indexOf(t.id) >= 0;
      if (t.money) t.costLevel = '아주 많이';   // 돈 되는 칸은 값이 가장 비싸다 (게임 규칙)
    });
    // 꾸밈 가운데 칸을 차지하는 것은 칸 종류로도 넣는다
    DECOR.filter(d => d.occupy).forEach(d => { if (!z.tiles.some(t => t.id === d.id)) z.tiles.push({ id: d.id, name: d.name, goodFor: d.does, costLevel: '조금', decor: true }); });
    z.tile = byId(z.tiles); z.item = byId(z.items);
    z.paintTiles = z.tiles.filter(t => !t.money && !t.fixed && !t.decor);   // 칸 바꾸기에 나오는 것
    z.base = cfg.base && z.tile[cfg.base] ? cfg.base : (z.paintTiles[0] ? z.paintTiles[0].id : null);
    z.smallOn = cfg.smallOn || (z.paintTiles[0] ? [z.paintTiles[0].id] : []);
    z.cropOn = cfg.cropOn || [];
    z.hasWalk = !!cfg.hasWalk;
    z.keeper = z.title || GD.KEEPER[id];
    z.species = [];
    return z;
  });
  GD.zone = id => GD.ZONES.find(z => z.id === id);

  const TIER_ORDER = { hard: 0, seldom: 1, often: 2 };
  GD.SP = {};
  B.speciesTable.forEach(([id, name, zone, tier, kind]) => {
    const src = cspecies[id] || bspecies[id] || null;
    const s = Object.assign({
      id, name, zone, tier, kind, sci: '', badges: [], badgesChecked: false, dayPart: ['dawn', 'day', 'dusk'], hidden: false,
      basis: 'model', likes: [], dislikes: [], stages: {}, traces: ['footprint'], story: { text: '', sources: [], checked: false }
    }, src || {});
    s.name = s.name || name; s.zone = zone; s.tier = s.tier || tier; s.kind = s.kind || kind;
    s.stub = !src;                           // 이름표만 있고 내용 자료가 아직 없는 종
    s.fromContent = !!cspecies[id];
    s.stages = Object.assign({ visit: '', stay: '', settle: '' }, s.stages || {});
    s.story = Object.assign({ text: '', sources: [], checked: false }, s.story || {});
    if (!s.dayPart || !s.dayPart.length) s.dayPart = ['dawn', 'day', 'dusk'];
    s.traces = s.traces || [];
    // 아이템을 좋아하는 종: 규칙에서 '@아이템' 으로 센다. 작은 벌이(조개 등)를 좋아하는 종은 남겨 둔 먹이로 센다.
    s.itemLikes = (s.itemLikes || []).map(l => Object.assign({}, l, { item: ITEM_ALIAS[l.item] || l.item }));
    GD.SP[id] = s;
    const z = GD.zone(zone); if (z) z.species.push(s);
  });
  GD.ZONES.forEach(z => {
    z.species.sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier]);
    z.hard = z.species.filter(s => s.tier === 'hard');
  });
  GD.ALLSP = B.speciesTable.map(r => GD.SP[r[0]]);

  GD.INTRUDER = {};
  B.intruderTable.forEach(([id, name, zone, kind]) => { GD.INTRUDER[id] = { id, name, zone, kind }; });
  (C.intruders || []).forEach(o => { if (o && o.id && GD.INTRUDER[o.id]) Object.assign(GD.INTRUDER[o.id], o, { zone: GD.INTRUDER[o.id].zone }); });

  // 소식: 자료의 글과 바탕 글을 함께 둔다. 같은 id 면 자료의 글이 이긴다.
  const news = byId(B.news);
  (C.news || []).forEach(n => { if (n && n.id) news[n.id] = n; });
  GD.NEWS = news;
  // ids 를 앞에서부터 찾아, 이 구역에 쓸 수 있는 첫 글을 준다
  GD.newsText = function (ids, zoneId) {
    for (const id of [].concat(ids)) { const n = news[id]; if (n && (!n.zone || n.zone === '*' || n.zone === zoneId)) return n.text; }
    return '';
  };

  GD.contentInfo = {
    zones: GD.ZONES.filter(z => z.fromContent).map(z => z.id),
    species: GD.ALLSP.filter(s => s.fromContent).length,
    stubs: GD.ALLSP.filter(s => s.stub).length
  };
})();
