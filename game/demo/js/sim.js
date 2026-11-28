/* 깃들 데모: 하루의 흐름과 게임 규칙
   아침에 누가 오는지, 편안함, 흔적, 돈, 불청객, 해 넘김, 구역이 열리고 완성되는 것까지.
   화면은 여기서 하지 않는다. 바뀐 것은 GD.emit 으로 알리고 ui.js, world3d.js 가 받아 그린다. */
(function () {
  const CFG = GD.CFG, U = GD.util, H = GD.hex, RL = GD.rules;
  const SIM = GD.sim = {};
  const S = () => GD.S;
  const openZones = () => GD.ZONES.filter(z => z.ready && S().z[z.id] && S().z[z.id].open);
  SIM.openZones = openZones;

  /* ---------- 시간 ---------- */
  SIM.phase = function (clock) { const t = (clock === undefined ? S().clock : clock) / CFG.dayLen; return CFG.phases.find(p => t < p.until) || CFG.phases[CFG.phases.length - 1]; };
  SIM.phaseStart = id => { let a = 0; for (const p of CFG.phases) { if (p.id === id) return a * CFG.dayLen; a = p.until; } return 0; };
  SIM.canSleep = () => S().clock >= SIM.phaseStart(CFG.sleepFrom);
  SIM.speed = 1;                    // 앉아 있으면 빨라진다
  SIM.paused = false;
  let lastPhase = '';
  SIM.tick = function (dt) {
    const s = S(); if (!s.started || SIM.paused) return;
    const before = s.clock;
    s.clock = Math.min(CFG.dayLen, s.clock + dt * SIM.speed * (SIM.devSpeed || 1));
    if (SIM.clockMax != null && before <= SIM.clockMax) s.clock = Math.min(s.clock, SIM.clockMax);   // 첫 아침 안내 동안에는 해가 지지 않게 붙든다
    const ph = SIM.phase().id;
    if (ph !== lastPhase) { const first = !lastPhase; lastPhase = ph; if (!first) GD.emit('phase', ph); }
    if (s.clock >= CFG.dayLen && before < CFG.dayLen) GD.emit('nightEnd');
  };
  SIM.resetPhase = () => { lastPhase = SIM.phase().id; };

  /* ---------- 단계 ---------- */
  SIM.stage = function (sp) { const s = S(), c = s.comfort[sp] || 0; return c >= CFG.comfort.settle ? 3 : c >= CFG.comfort.stay ? 2 : s.met[sp] ? 1 : 0; };
  // 지금 이 이웃을 볼 수 있는가: 와 있고, 자리를 비키지 않았고, 지금이 나오는 때이고, 숨는 이웃이면 이미 만난 뒤여야 한다
  SIM.visible = function (zoneId, spId) {
    const Z = S().z[zoneId], h = Z && Z.here[spId]; if (!h || h.away) return false;
    const sp = GD.SP[spId];
    if (sp.dayPart.indexOf(SIM.phase().id) < 0) return false;
    if (sp.hidden && !S().rec[spId]) return false;
    return true;
  };
  SIM.canRecord = function (zoneId, spId) { const s = S(); return SIM.visible(zoneId, spId) && s.rec[spId] < SIM.stage(spId) && !s.today.recToday[spId]; };

  /* ---------- 오늘 한 일 적기 ---------- */
  function freshToday() {
    return { lv0: {}, paint: {}, item: {}, sold: 0, soldMoney: 0, trash: 0, traces: [], recs: [], watched: {}, spooked: {}, dug: {}, recToday: {}, guest: {}, guestHit: {}, fixed: [], expand: [], decor: 0, news: [], came: {}, income: null, back: [] };
  }
  const did = () => S().today;
  function tally(k, n) { const s = S(); s.tally = s.tally || {}; s.tally[k] = (s.tally[k] || 0) + (n || 1); }

  /* ---------- 아침: 누가 왔는지 정한다 ---------- */
  function cellsOf(Z, ids, used) { const out = []; for (const k in Z.tiles) if (ids.indexOf(Z.tiles[k]) >= 0 && !used[k]) out.push(k); return out; }
  const PLACE = {   // 들녘의 이웃이 내려앉는 칸. 앞에 있는 것부터 찾는다.
    crane: ['paddy', 'marsh', 'grass'], stork: ['marsh', 'paddy', 'grass'], swan: ['water'], mallard: ['water', 'marsh'],
    wfgoose: ['paddy', 'grass'], beangoose: ['paddy', 'marsh', 'grass'], kestrel: ['grass', 'paddy']
  };
  function pickCell(z, Z, sp, r, used) {
    let order = PLACE[sp.id] || sp.likes.map(l => l.tile).filter(id => z.tile[id]);
    // 물고기는 물이 있는 칸에만 놓는다. 좋아하는 칸 가운데 물이 없으면 구역의 물 칸 아무 데나.
    if (sp.kind === 'fish') { const wet = id => GD.vis.tile(id).h < GD.vis.WL - .03; order = order.filter(wet); if (!order.length) order = z.tiles.map(t => t.id).filter(wet); if (!order.length) return null; }
    // 걷기 시작하는 자리(집 곁) 가까이에는 내려앉지 않는다. 다른 칸이 없을 때만 앉는다.
    const sp0 = z.cfg.spawn ? H.parse(z.cfg.spawn) : null, far = k => { if (!sp0) return true; const p = H.parse(k); return H.dist(p[0] - sp0[0], p[1] - sp0[1]) >= 2; };
    for (const id of order) {
      let c = cellsOf(Z, [id], used); const cf = c.filter(far); if (cf.length) c = cf;
      if (id === 'paddy' && (sp.id === 'crane' || sp.id === 'stork')) { const wet = c.filter(k => Z.items[k] && Z.items[k].watergate); if (wet.length && r() < .6) c = wet; }
      if (id === 'water') { const inner = c.filter(k => H.neighbors(k).filter(nk => Z.tiles[nk] === 'water').length >= 2); if (inner.length) c = inner; }
      if (c.length) { const k = c[Math.floor(r() * c.length)]; used[k] = 1; return k; }
    }
    if (PLACE[sp.id]) return null;               // 들녘의 이웃은 맞는 칸이 없으면 내려앉지 못한다
    // 좋아하는 칸이 다 찼으면 다른 이웃과 같은 칸을 쓴다 (물고기가 뭍에 놓이지 않게)
    for (const id of order) { const c = cellsOf(Z, [id], {}); if (c.length) return c[Math.floor(r() * c.length)]; }
    const any = []; for (const k in Z.tiles) { const t = z.tile[Z.tiles[k]]; if (!used[k] && t && !t.money && !t.fixed && !t.decor) any.push(k); }
    if (!any.length) return null; const k = any[Math.floor(r() * any.length)]; used[k] = 1; return k;
  }
  function spotIn(key, r, spread) { const c = H.centerK(key), a = r() * 6.283, d = r() * H.R * (spread || .55); return [c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d]; }

  function arrive(z, force, ensure) {
    const s = S(), Z = s.z[z.id], n = RL.counts(z.id), unk = RL.unknown(z.id, n);
    const sig = Object.keys(Z.tiles).sort().map(k => Z.tiles[k][0]).join('') + '|' + s.year + '-' + s.day + '|' + z.id;
    const r = U.rng(U.hashStr(sig)), used = {}, came = [];
    Z.here = {}; Z.traces = []; Z.trash = []; Z.guest = null;
    for (const sp of z.species) {
      if (sp.stub) continue;
      const sc = RL.score(sp.id, n), L = unk ? 0 : RL.level(sc), roll = r(), tr = r();
      let p = CFG.arriveP[sp.tier][L];
      if (SIM.stage(sp.id) >= 2 && L >= 1) p = Math.max(p, CFG.returnP);
      if (force || roll < p || (ensure && ensure.indexOf(sp.id) >= 0)) {
        const cell = pickCell(z, Z, sp, r, used);
        if (cell) {
          Z.here[sp.id] = { cell };
          if (!s.met[sp.id]) { s.met[sp.id] = true; s.firstDay[sp.id] = { y: s.year, d: s.day, t: Object.assign({}, s.tally || {}) }; }
          if (sp.tier === 'hard') Z.hardCame = true;
          came.push(sp.id);
          continue;
        }
      }
      // 다녀간 흔적: 가능성이 보통 이상인데 오늘 머물지 않았다 (빈도는 게임 규칙)
      if (L >= 1 && sp.traces.length && tr < CFG.trace.passedP && Z.traces.length < CFG.trace.max) {
        const cell = pickCell(z, Z, sp, r, {});
        if (cell) { const p2 = spotIn(cell, r); Z.traces.push({ sp: sp.id, type: 'passed', what: U.pick(sp.traces, r), cell, x: p2[0], z: p2[1], found: false }); }
      }
    }
    // 숨은 이웃의 흔적: 와 있지만 낮에 잘 보이지 않는다
    for (const id of came) {
      const sp = GD.SP[id];
      if ((sp.hidden && !s.rec[id]) || sp.dayPart.indexOf('day') < 0) {
        const cell = Z.here[id].cell, p2 = spotIn(cell, r);
        const what = id === 'scopsowl' ? 'sound' : sp.traces.length ? U.pick(sp.traces, r) : 'sound';
        Z.traces.push({ sp: id, type: 'hidden', what, cell, x: p2[0], z: p2[1], found: false });
      }
    }
    // 폐비닐
    if (z.cfg.trash) {
      const land = []; for (const k in Z.tiles) if (['water', 'house', 'greenhouse', 'pavilion'].indexOf(Z.tiles[k]) < 0 && !used[k]) land.push(k);
      for (let i = 0; i < CFG.trashPerDay && land.length; i++) { const k = land.splice(Math.floor(r() * land.length), 1)[0], p2 = spotIn(k, r, .5); Z.trash.push({ cell: k, x: p2[0], z: p2[1], got: false }); }
    }
    // 손님과 불청객: 첫 어려운 발길이 온 뒤에만 나타난다
    const gid = z.earn.guest && z.earn.guest.id, iid = z.intruder && z.intruder.id;
    if (Z.hardCame && came.length && !force) {
      if (gid && r() < CFG.guestP) Z.guest = { state: 'waiting' };
      if (iid && iid !== gid && !Z.intruder) {
        const money = z.tiles.filter(t => t.money).reduce((a, t) => a + (n[t.id] || 0), 0);
        if (r() < CFG.intruderP * (money ? 1 : .4)) { const ids = GD.BASE.intruderTable.filter(x => x[2] === z.id && x[3] !== 'person').map(x => x[0]); Z.intruder = { id: ids.length ? U.pick(ids, r) : iid, days: 0 }; }
      }
    }
    if (Z.intruder) Z.intruder.days++;
    did().came[z.id] = came;
    return came;
  }

  function levels(zoneId) { const z = GD.zone(zoneId), n = RL.counts(zoneId), unk = RL.unknown(zoneId, n), o = {}; z.species.forEach(sp => { if (!sp.stub) o[sp.id] = unk ? 0 : RL.level(RL.score(sp.id, n)); }); return o; }
  SIM.levels = levels;

  function income(extra) {
    const s = S(), I = CFG.income, inc = { base: I.base, big: 0, stay: 0, crop: (extra && extra.crop) || 0 };
    openZones().forEach(z => {
      const Z = s.z[z.id], n = RL.counts(z.id);
      z.tiles.filter(t => t.money).forEach(t => { inc.big += I.big * (n[t.id] || 0); });
      z.hard.forEach(sp => { if (Z.here[sp.id]) { const st = SIM.stage(sp.id); if (st === 3) inc.stay += I.settle; else if (st === 2) inc.stay += I.stay; } });
    });
    inc.sum = inc.base + inc.big + inc.stay + inc.crop;
    s.money += inc.sum;
    return inc;
  }

  // 오늘의 소식: 그날의 땅과 이웃의 상태에서 만든다. 안 해도 되고 보상이 없다.
  // 글은 자료(news.json)의 것을 먼저 쓰고, 없으면 바탕 글을 쓴다.
  const GUEST_NEWS = { field: 'visitors_coming', stream: 'anglers_coming', forest: 'hikers_coming', coast: 'tourists_coming' };
  const SMALL_NEWS = { field: 'straw_choice', forest: 'forage_choice', coast: 'clam_choice' };
  const WARN_NEWS = { stream: 'strange_fish', forest: 'sika_sign', coast: 'strange_grass' };
  function makeNews() {
    const s = S(), zid = s.zone, Z = s.z[zid], z = GD.zone(zid), out = [], n = RL.counts(zid);
    const add = (ids) => { const t = GD.newsText(ids, zid); if (t && !out.some(o => o.text === t)) out.push({ id: [].concat(ids)[0], text: t }); };
    const passed = Z.traces.filter(t => t.type === 'passed'), hidden = Z.traces.filter(t => t.type === 'hidden');
    const money = z.tiles.filter(t => t.money).reduce((a, t) => a + (n[t.id] || 0), 0);
    if (Z.guest) add([GUEST_NEWS[zid], 'guest']);
    if (Z.intruder) add('intruder');
    if (z.species.some(sp => SIM.stage(sp.id) === 3 && Z.here[sp.id] && s.rec[sp.id] < 3)) add('settled');
    if (passed.some(t => t.sp === 'otter')) add('otter_dropping');
    if (passed.some(t => t.sp === 'goral')) add('goral_dropping');
    if (passed.length) add(['footprint', 'trace_near', 'passed']);
    if (Z.here.scopsowl) add('owl_sound');
    if (hidden.length) add(['hidden_near', 'hidden']);
    if (Z.trash.length) add(['vinyl', 'trash']);
    if (Z.hardCame && !Z.intruder && money && WARN_NEWS[zid] && s.day % 2 === 0) add(WARN_NEWS[zid]);
    if (zid === 'stream' && s.day === 1) add('spawn_season');
    if (zid === 'stream' && n.weir) add('water_pooling');
    if (zid === 'coast' && s.day % 2 === 1) add('low_tide');
    if (zid === 'coast' && n['@sandfence']) add('dune_grows');
    if (zid === 'field' && n.paddy > (n['@watergate'] || 0) && ['crane', 'stork'].some(id => (did().lv0[zid] || {})[id] === 0) && s.day % 3 === 2) add('watergate_hint');
    if (SMALL_NEWS[zid] && n.soldable > n.sold && s.day % 3 === 1) add(SMALL_NEWS[zid]);
    if (s.watchedYesterday) add('calm_far');
    if (z.species.some(sp => Z.here[sp.id] && SIM.stage(sp.id) === 2)) add('stay');
    if (z.species.some(sp => Z.here[sp.id] && s.rec[sp.id] < SIM.stage(sp.id))) add('dex');
    const lv = did().lv0[zid] || {}; if (z.species.some(sp => lv[sp.id] === 1 && !Z.here[sp.id])) add('near');
    if (s.day === CFG.yearDays) add('lastday');
    if (!out.length) add('quiet');
    return out.slice(0, 3);
  }
  SIM.makeNews = makeNews;

  SIM.startDay = function (opt) {
    opt = opt || {};
    const s = S();
    s.today = freshToday(); s.clock = 0; SIM.speed = 1; lastPhase = 'dawn';
    openZones().forEach(z => { arrive(z, opt.force, opt.ensure); did().lv0[z.id] = levels(z.id); });
    // 깃든 자리로 돌아온 이웃
    openZones().forEach(z => z.species.forEach(sp => { const nm = s.names[sp.id], h = s.z[z.id].here[sp.id]; if (nm && h && s.z[z.id].tiles[nm.cell]) { h.cell = nm.cell; did().back.push(sp.id); } }));
    did().income = income(opt);
    did().news = makeNews();
    did().money0 = s.money;
    GD.state.saveNow();
    GD.emit('morning');
  };

  /* ---------- 하루의 끝: 편안함을 셈한다 ---------- */
  function account() {
    const s = S(), C = CFG.comfort, T = did(), log = {};
    openZones().forEach(z => {
      const Z = s.z[z.id], n = RL.counts(z.id), care = RL.care(z.id, n);
      let carePts = 0;
      z.items.forEach(i => { if (i.id !== 'watergate' && n['@' + i.id] > 0) carePts += C[i.id] !== undefined ? C[i.id] : 2; });
      if (n.soldable >= 2 && care.foodLeft >= .7) carePts += C.food;
      carePts = Math.min(C.careMax, carePts);
      const guarded = (n['@sign'] || 0) + (n['@blind'] || 0) > 0;
      let hit = T.guestHit[z.id] || 0;
      if (Z.guest && Z.guest.state === 'waiting') hit += guarded ? 2 : C.intruderLeft;      // 불청객을 내버려 둠
      if (Z.intruder) hit += C.intruderLeft;
      z.species.forEach(sp => {
        if (sp.stub) return;
        const c0 = s.comfort[sp.id] || 0; let c1 = c0;
        if (Z.here[sp.id]) {
          const SL = RL.level(RL.stayScore(sp.id, n, z.id));
          const g = C.stayGain[SL] + (T.watched[sp.id] ? C.watched : 0) + carePts - (T.spooked[sp.id] ? C.spooked : 0) - (T.dug[sp.id] ? C.dug : 0) - hit;
          c1 = U.clamp(c0 + g, 0, 100);
        } else if (c0 > 0) {
          c1 = RL.level(RL.score(sp.id, n)) === 0 ? Math.floor(c0 / 2) : Math.max(0, c0 - C.awayDrop);
        }
        s.comfort[sp.id] = c1; log[sp.id] = [c0, c1];
      });
    });
    return log;
  }
  SIM.account = account;

  // 취침을 누르면 뜨는 오늘의 결산
  SIM.settlement = function () {
    const s = S(), T = did(), rows = [];
    const nameOf = (zid, id) => { const z = GD.zone(zid); return (z.tile[id] || z.item[id] || { name: id }).name; };
    const lvWord = (zid, changedFn) => {
      // 그 일을 하지 않았다면 가능성이 어땠을지와 견준다
      const z = GD.zone(zid), n = RL.counts(zid), m = changedFn(Object.assign({}, n)), up = [], down = [];
      z.species.forEach(sp => { if (sp.stub) return; const a = RL.level(RL.score(sp.id, m)), b = RL.level(RL.score(sp.id, n)); if (b > a) up.push(sp.name); else if (b < a) down.push(sp.name); });
      const parts = [];
      if (up.length) parts.push('내일 ' + U.josa(U.joinNames(up), '이/가') + ' 올 가능성이 오름');
      if (down.length) parts.push(U.josa(U.joinNames(down), '이/가') + ' 올 가능성이 내림');
      return parts.join('. ') || '가능성의 단계는 그대로임';
    };
    const byTo = {};
    for (const k in T.paint) { const [zid, from, to] = k.split('|'); (byTo[zid + '|' + to] = byTo[zid + '|' + to] || []).push([from, T.paint[k]]); }
    for (const k in byTo) {
      const [zid, to] = k.split('|'), cnt = byTo[k].reduce((a, p) => a + p[1], 0), z = GD.zone(zid);
      const t = z.tile[to];
      rows.push([nameOf(zid, to) + ' ' + cnt + '칸 ' + (t && t.money ? '설치' : '조성'),
        lvWord(zid, m => { byTo[k].forEach(p => { m[to] -= p[1]; m[p[0]] = (m[p[0]] || 0) + p[1]; }); return m; }) + (t && t.money ? '. 매일 돈이 들어옴' : '')]);
    }
    for (const k in T.item) {
      const [zid, id] = k.split('|'), c = T.item[k]; if (!c) continue;
      const care = id !== 'watergate';
      rows.push([nameOf(zid, id) + ' ' + Math.abs(c) + '개 ' + (c > 0 ? '설치' : '거둠'),
        care ? (c > 0 ? '와 있는 이웃이 더 편히 머묾' : '돌봄이 줄어듦') : lvWord(zid, m => { m['@' + id] -= c; return m; })]);
    }
    if (T.sold) rows.push(['작은 벌이 ' + T.sold + '칸', '돈 +' + T.soldMoney + '. 이웃의 먹이가 줄어듦']);
    const watched = Object.keys(T.watched).map(id => GD.SP[id].name);
    if (watched.length) rows.push([U.joinNames(watched) + ' 관찰', '편안함이 오름']);
    T.recs.forEach(r => rows.push([GD.SP[r.sp].name + '의 ' + GD.STG[r.k] + '을 도감에 적음', '돈 +' + CFG.income.record[r.k - 1]]));
    if (T.traces.length) rows.push(['흔적 ' + T.traces.length + '개 찾음', 'AI가 ' + U.joinNames(T.traces.filter((v, i, a) => a.indexOf(v) === i).map(id => GD.SP[id].name)) + '에 대해 더 자세히 말해 줌']);
    if (T.trash) rows.push(['폐비닐 ' + T.trash + '개 주움', '돈 +' + T.trash * CFG.income.trash + '. 와 있는 이웃의 편안함이 오름']);
    for (const zid in T.guest) rows.push([T.guest[zid] === 'taken' ? '손님을 받음' : '손님을 돌려보냄', T.guest[zid] === 'taken' ? '돈 +' + CFG.income.guest + '. 편안함이 깎임' : '이웃이 조용히 지냄']);
    openZones().forEach(z => { const Z = s.z[z.id]; if (Z.guest && Z.guest.state === 'waiting') rows.push(['구경꾼을 내버려 둠', '이웃의 편안함이 깎임']); if (Z.intruder) rows.push([U.josa(GD.INTRUDER[Z.intruder.id].name, '을/를') + ' 내버려 둠', '이웃의 편안함이 깎임']); });
    T.fixed.forEach(id => rows.push([U.josa(GD.INTRUDER[id].name, '을/를') + ' 걷어 냄', '이웃이 다시 편히 지냄']));
    Object.keys(T.spooked).forEach(id => rows.push([U.josa(GD.SP[id].name, '을/를') + ' 놀라게 함', '편안함이 깎임']));
    Object.keys(T.dug).forEach(id => rows.push([U.josa(GD.SP[id].name, '이/가') + ' 머무는 칸을 바꿈', '편안함이 깎임']));
    T.expand.forEach(zid => rows.push([GD.zone(zid).name + '의 땅을 넓힘', '가꿀 칸이 늘어남']));
    if (T.decor) rows.push(['꾸밈 ' + T.decor + '개', '보호구역의 모습이 달라짐']);
    // 내일의 가능성
    const tomorrow = [];
    openZones().forEach(z => {
      const n = RL.counts(z.id), unk = RL.unknown(z.id, n), lv0 = T.lv0[z.id] || {};
      z.species.forEach(sp => {
        if (sp.stub) return;
        const silent = RL.silent(sp.id) || unk;
        tomorrow.push({ zone: z.id, sp: sp.id, lv: unk ? 0 : RL.level(RL.score(sp.id, n)), lv0: lv0[sp.id] || 0, stay: RL.level(RL.stayScore(sp.id, n, z.id)), silent, here: !!s.z[z.id].here[sp.id], stage: SIM.stage(sp.id), comfort: s.comfort[sp.id] });
      });
    });
    return { rows, tomorrow, money: s.money, moneyDelta: s.money - (T.money0 || s.money) };
  };

  /* ---------- 다음 아침, 해 넘김 ---------- */
  SIM.nextMorning = function (opt) {
    const s = S();
    s.watchedYesterday = Object.keys(did().watched).length > 0;
    account();
    s.day++;
    if (s.day > CFG.yearDays && !(opt && opt.force)) { openZones().forEach(z => { s.z[z.id].here = {}; s.z[z.id].traces = []; s.z[z.id].trash = []; s.z[z.id].guest = null; }); GD.emit('actors'); GD.emit('yearEnd', SIM.yearSummary()); return 'yearEnd'; }
    SIM.startDay(opt);
    return 'morning';
  };
  SIM.yearSummary = function () {
    const s = S(), rows = [];
    openZones().forEach(z => z.species.forEach(sp => { if (sp.stub) return; const st = SIM.stage(sp.id); if (st || s.rec[sp.id]) rows.push({ zone: z.id, sp: sp.id, stage: st, rec: s.rec[sp.id] }); }));
    let crop = 0; openZones().forEach(z => { const n = RL.counts(z.id); z.cropOn.forEach(id => { crop += CFG.income.crop * (n[id] || 0); }); });
    return { year: s.year, rows, crop, money: s.money, names: Object.keys(s.names).map(id => ({ sp: id, name: s.names[id].name })) };
  };
  SIM.newYear = function () {
    const s = S(), sum = SIM.yearSummary(), C = CFG.comfort;
    s.annals.push({ year: s.year, rows: sum.rows, names: sum.names });
    s.year++; s.day = 1;
    GD.ALLSP.forEach(sp => { const c = s.comfort[sp.id] || 0; s.comfort[sp.id] = c >= C.settle ? C.nextYear.settle : c >= C.stay ? C.nextYear.stay : 0; });
    openZones().forEach(z => { s.z[z.id].sold = {}; });
    GD.emit('land', { zone: s.zone, all: true });
    SIM.startDay({ crop: sum.crop });
    return sum.crop;
  };

  /* ---------- 가꾸기 ---------- */
  function costOf(z, t) { return t.decor ? (CFG.decorCost[t.id] || 3) : (CFG.cost[t.costLevel] || 3); }
  SIM.tileCost = (zoneId, id) => { const z = GD.zone(zoneId); return costOf(z, z.tile[id]); };
  SIM.itemCost = (zoneId, id) => CFG.cost['보통'];
  SIM.itemOpen = function (zoneId, id) { return !(zoneId === 'field' && (id === 'sign' || id === 'blind')) || S().flags.careOpen; };
  const poor = () => ({ ok: false, msg: '돈이 모자라요', sub: '아침마다 수입이 들어와요. 작은 벌이를 하거나 폐비닐을 주울 수도 있어요.' });

  function disturb(zoneId, key, res) {       // 이웃이 머무는 칸을 건드리면 자리를 비킨다
    const Z = S().z[zoneId];
    for (const id in Z.here) { const h = Z.here[id]; if (h.cell === key && !h.away) { h.away = true; did().dug[id] = 1; res.left = (res.left || []).concat(id); } }
  }

  // tool: { t:'tile', id } | { t:'item', id } | { t:'small' } | { t:'decor', id }
  SIM.apply = function (zoneId, key, tool) {
    const s = S(), z = GD.zone(zoneId), Z = s.z[zoneId], cur = Z.tiles[key], T = did();
    if (cur === undefined) return { ok: false };
    const curT = z.tile[cur], res = { ok: true, keys: [key] };
    if (tool.t === 'tile') {
      const t = z.tile[tool.id]; if (!t) return { ok: false };
      if (curT.fixed) return { ok: false, msg: U.josa(curT.name, '은/는') + ' 그대로 둬요' };
      if (cur === tool.id) return { ok: false };
      const cost = costOf(z, t); if (s.money < cost) return poor();
      s.money -= cost;
      if (curT.money) { const back = Math.round(costOf(z, curT) * CFG.bigRefund); s.money += back; res.msg = U.josa(curT.name, '을/를') + ' 헐었어요 · 돈 +' + back; res.sub = '지은 값의 절반이 돌아와요.'; }
      // 새 칸에 놓을 수 없는 아이템은 거둬 둔다
      const it = Z.items[key];
      if (it) { for (const id in it) { const def = z.item[id]; if (!def || (def.placeOn.indexOf('*') < 0 && def.placeOn.indexOf(tool.id) < 0)) { delete it[id]; Z.stock[id] = (Z.stock[id] || 0) + 1; res.msg = res.msg || U.josa(def ? def.name : id, '은/는') + ' 거둬 뒀어요'; res.sub = res.sub || '다른 칸에 다시 놓을 때는 돈이 들지 않아요.'; } } if (!Object.keys(it).length) delete Z.items[key]; }
      delete Z.sold[key];
      Z.tiles[key] = tool.id;
      const pk = zoneId + '|' + cur + '|' + tool.id, rk = zoneId + '|' + tool.id + '|' + cur;
      if (T.paint[rk]) { T.paint[rk]--; if (!T.paint[rk]) delete T.paint[rk]; } else T.paint[pk] = (T.paint[pk] || 0) + 1;
      if (t.decor) T.decor++;
      tally('tiles'); disturb(zoneId, key, res);
    } else if (tool.t === 'item') {
      const def = z.item[tool.id]; if (!def) return { ok: false };
      const it = Z.items[key] || {}, ik = zoneId + '|' + tool.id;
      if (it[tool.id]) {
        delete it[tool.id]; if (!Object.keys(it).length) delete Z.items[key]; else Z.items[key] = it;
        Z.stock[tool.id] = (Z.stock[tool.id] || 0) + 1; T.item[ik] = (T.item[ik] || 0) - 1;
        res.msg = U.josa(def.name, '을/를') + ' 거뒀어요'; res.sub = '다른 칸에 다시 놓을 때는 돈이 들지 않아요.';
      } else {
        if (curT.fixed || curT.money) return { ok: false, msg: '여기에는 놓을 수 없어요' };
        if (def.placeOn.indexOf('*') < 0 && def.placeOn.indexOf(cur) < 0) return { ok: false, msg: U.josa(def.name, '은/는') + ' ' + def.placeOn.map(id => z.tile[id] ? z.tile[id].name : id).join(', ') + '에만 놓을 수 있어요' };
        if (!SIM.itemOpen(zoneId, tool.id)) return { ok: false, msg: '아직 살 수 없어요', sub: '어려운 발길의 이웃을 처음 도감에 적으면 살 수 있어요.' };
        if (Z.stock[tool.id] > 0) Z.stock[tool.id]--; else { const cost = SIM.itemCost(zoneId, tool.id); if (s.money < cost) return poor(); s.money -= cost; }
        it[tool.id] = 1; Z.items[key] = it; T.item[ik] = (T.item[ik] || 0) + 1; tally('items');
        res.msg = U.josa(def.name, '을/를') + ' 놓았어요'; res.sub = def.does ? def.does + '.' : '';
      }
    } else if (tool.t === 'small') {
      if (z.smallOn.indexOf(cur) < 0) return { ok: false, msg: z.smallOn.map(id => z.tile[id].name).join(', ') + '에서만 할 수 있어요' };
      if (Z.sold[key]) return { ok: false, msg: '이 칸에서는 올해 이미 거뒀어요' };
      Z.sold[key] = 1; s.money += CFG.income.small; T.sold++; T.soldMoney += CFG.income.small;
      res.msg = (z.earn.small ? z.earn.small.name : '작은 벌이') + ' · 돈 +' + CFG.income.small; res.sub = '이 칸에는 이웃이 먹을 것이 줄어요.';
    } else if (tool.t === 'decor') {
      if (curT.fixed) return { ok: false, msg: U.josa(curT.name, '은/는') + ' 그대로 둬요' };
      if (Z.decor[key] === tool.id) { delete Z.decor[key]; res.msg = '꾸밈을 거뒀어요'; }
      else { const cost = CFG.decorCost[tool.id] || 3; if (s.money < cost) return poor(); s.money -= cost; Z.decor[key] = tool.id; T.decor++; res.msg = U.josa((GD.DECOR.find(d => d.id === tool.id) || { name: '꾸밈' }).name, '을/를') + ' 놓았어요'; }
    } else return { ok: false };
    if (res.left && res.left.length && !res.msg) { res.msg = U.josa(U.joinNames(res.left.map(id => GD.SP[id].name)), '이/가') + ' 자리를 비켰어요'; res.sub = '머무는 칸을 바꾸면 편안함이 깎여요.'; }
    GD.state.save();
    GD.emit('land', { zone: zoneId, keys: res.keys });
    if (res.left) GD.emit('actors');
    return res;
  };

  SIM.expandCost = zoneId => CFG.expandCost[S().z[zoneId].rings + 1];
  SIM.expand = function (zoneId) {
    const s = S(), z = GD.zone(zoneId), Z = s.z[zoneId], next = Z.rings + 1, cost = CFG.expandCost[next];
    if (next > CFG.maxRings || cost === undefined) return { ok: false, msg: '더 넓힐 수 없어요' };
    if (s.money < cost) return poor();
    s.money -= cost; Z.rings = next; H.ring(next).forEach(k => { Z.tiles[k] = z.base; });
    did().expand.push(zoneId); GD.state.save(); GD.emit('land', { zone: zoneId, all: true });
    return { ok: true, msg: '땅을 한 겹 넓혔어요', sub: H.ring(next).length + '칸이 늘었어요.' };
  };

  /* ---------- 바라보기와 도감 ---------- */
  // 멀리서 조용히 바라봄 (도감에 적을 것이 없어도 편안함이 오른다)
  SIM.watched = function (spId) { const T = did(); if (T.watched[spId]) return false; T.watched[spId] = 1; tally('watch'); GD.emit('watched', spId); return true; };
  // 첫 아침 안내를 다시 볼 때: 그 이웃이 오늘 와 있지 않으면 내려앉게 한다 (잦은 발길의 쇠기러기에만 쓴다)
  SIM.ensureHere = function (zoneId, spId) {
    const s = S(), z = GD.zone(zoneId), Z = s.z[zoneId]; if (Z.here[spId] && !Z.here[spId].away) return;
    const cell = pickCell(z, Z, GD.SP[spId], U.rng(s.day * 31 + s.year), {}); if (!cell) return;
    Z.here[spId] = { cell }; s.met[spId] = true; if (!s.firstDay[spId]) s.firstDay[spId] = { y: s.year, d: s.day, t: Object.assign({}, s.tally || {}) };
    GD.emit('actors');
  };
  SIM.spooked = function (spId) { const T = did(); if (T.spooked[spId]) return false; T.spooked[spId] = 1; return true; };

  function spotName(sp, tileName) {
    const suf = { water: '못', paddy: '논', marsh: '늪', grass: '들', wood: '숲', reedbed: '갈대밭' };
    const Z = S().z[sp.zone], h = Z.here[sp.id], t = h ? Z.tiles[h.cell] : null;
    return sp.name + ' ' + (suf[t] || '터');
  }
  SIM.record = function (spId) {
    const s = S(), sp = GD.SP[spId], z = GD.zone(sp.zone), Z = s.z[sp.zone], T = did();
    const k = ++s.rec[spId]; T.recToday[spId] = 1; T.watched[spId] = 1; T.recs.push({ sp: spId, k });
    const gain = CFG.income.record[k - 1]; s.money += gain;
    const n = RL.counts(sp.zone), fd = s.firstDay[spId] || { y: s.year, d: s.day, t: {} };
    const info = { k, year: s.year, day: s.day, why: RL.silent(spId) ? '' : RL.why(spId, n), land: z.paintTiles.concat(z.tiles.filter(t => t.money)).filter(t => n[t.id]).map(t => t.name + ' ' + n[t.id]).join(', ') };
    if (k === 3) {
      info.days = (s.year - fd.y) * CFG.yearDays + (s.day - fd.d) + 1;
      const a = s.tally || {}, b = fd.t || {};
      info.did = '칸 ' + ((a.tiles || 0) - (b.tiles || 0)) + '번 바꿈, 아이템 ' + ((a.items || 0) - (b.items || 0)) + '개 놓음, 조용히 바라본 날 ' + ((a.watch || 0) - (b.watch || 0)) + '번, 폐비닐 ' + ((a.trash || 0) - (b.trash || 0)) + '개 주움';
    }
    (s.recInfo[spId] = s.recInfo[spId] || []).push(info);
    const out = { sp: spId, k, gain, events: [] };
    if (k === 1 && sp.tier === 'hard' && !s.flags.careOpen) { s.flags.careOpen = true; out.events.push('care'); }
    if (k === 3) {
      s.settledOn[spId] = { y: s.year, d: s.day };
      out.name = { sp: spId, zone: sp.zone, cell: (Z.here[spId] || {}).cell, suggest: spotName(sp) };
      if (sp.tier === 'hard') {
        const all = z.hard.every(h => s.rec[h.id] >= 3);
        const next = GD.ZONES.find(o => o.order === z.order + 1);
        if (next && !(s.z[next.id] && s.z[next.id].open) && !s.flags['opened_' + next.id]) {
          s.flags['opened_' + next.id] = true;
          if (next.ready && s.z[next.id]) {
            s.z[next.id].open = true;
            // 새로 열린 구역이 첫날에 텅 비어 있지 않게, 열리는 그날의 이웃을 바로 정한다
            arrive(next); did().lv0[next.id] = levels(next.id);
          }
          out.events.push({ open: next.id, ready: next.ready });
        }
        if (all && !Z.done) { Z.done = true; out.events.push({ done: z.id }); }
      }
    }
    GD.state.saveNow();
    GD.emit('record', out);
    return out;
  };
  SIM.nameSpot = function (spId, name) {
    const s = S(), sp = GD.SP[spId], Z = s.z[sp.zone], h = Z.here[spId];
    name = String(name || '').trim().slice(0, 12) || spotName(sp);
    s.names[spId] = { zone: sp.zone, cell: h ? h.cell : (s.names[spId] || {}).cell || '0,0', name, y: s.year, d: s.day };
    GD.state.saveNow(); GD.emit('objects'); return name;
  };

  /* ---------- 흔적, 폐비닐, 손님, 불청객 ---------- */
  SIM.findTrace = function (zoneId, i) {
    const s = S(), Z = s.z[zoneId], t = Z.traces[i]; if (!t || t.found) return null;
    t.found = true; s.traceRec[t.sp] = (s.traceRec[t.sp] || 0) + 1; did().traces.push(t.sp); tally('trace');
    const sp = GD.SP[t.sp], out = { trace: t, sp: t.sp };
    // 숨는 이웃은 모습이 아니라 흔적으로 처음 만난다
    if (t.type === 'hidden' && sp.hidden && !s.rec[t.sp] && Z.here[t.sp] && !did().recToday[t.sp]) out.rec = SIM.record(t.sp);
    GD.state.save(); GD.emit('objects'); GD.emit('trace', out);
    return out;
  };
  SIM.pickTrash = function (zoneId, i) {
    const s = S(), Z = s.z[zoneId], t = Z.trash[i]; if (!t || t.got) return false;
    t.got = true; s.money += CFG.income.trash; Z.cleaned++; did().trash++; tally('trash');
    for (const id in Z.here) s.comfort[id] = Math.min(100, (s.comfort[id] || 0) + CFG.comfort.trash);
    GD.state.save(); GD.emit('objects'); return true;
  };
  SIM.answerGuest = function (zoneId, take) {
    const s = S(), Z = s.z[zoneId]; if (!Z.guest || Z.guest.state !== 'waiting') return null;
    const n = RL.counts(zoneId), guarded = (n['@sign'] || 0) + (n['@blind'] || 0) > 0;
    if (take) { Z.guest.state = 'taken'; s.money += CFG.income.guest; did().guestHit[zoneId] = guarded ? CFG.comfort.guestHitGuarded : CFG.comfort.guestHit; did().guest[zoneId] = 'taken'; }
    else { Z.guest.state = 'sent'; did().guest[zoneId] = 'sent'; }
    GD.state.save(); return { take, guarded };
  };
  SIM.guestHitPreview = function (zoneId) { const n = RL.counts(zoneId); return (n['@sign'] || 0) + (n['@blind'] || 0) > 0 ? CFG.comfort.guestHitGuarded : CFG.comfort.guestHit; };
  SIM.fixIntruder = function (zoneId) {
    const s = S(), Z = s.z[zoneId]; if (!Z.intruder) return { ok: false };
    if (s.money < CFG.intruderFixCost) return poor();
    s.money -= CFG.intruderFixCost; did().fixed.push(Z.intruder.id); const id = Z.intruder.id; Z.intruder = null;
    GD.state.save(); GD.emit('actors'); return { ok: true, msg: U.josa(GD.INTRUDER[id].name, '을/를') + ' 걷어 냈어요', sub: '이웃이 다시 편히 지내요.' };
  };

  /* ---------- 구역 ---------- */
  SIM.setZone = function (zoneId) { const s = S(); if (!s.z[zoneId] || !s.z[zoneId].open) return false; s.zone = zoneId; did().news = makeNews(); GD.state.save(); GD.emit('zone', zoneId); return true; };
  SIM.newGame = function () { GD.state.reset(); SIM.startDay(); };
})();
