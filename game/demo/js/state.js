/* 깃들 데모: 게임의 상태와 저장
   상태는 GD.S 하나에 다 들어 있다. 브라우저의 localStorage 에 자동으로 저장한다.
   localStorage 를 못 쓰는 환경이면 창 이름(window.name)에 임시로 담아 새로 고침만 버틴다. */
(function () {
  const CFG = GD.CFG, H = GD.hex;
  const ST = GD.state = {};
  let storageOk = null, dirty = false, timer = 0;

  function newZone(z, open) {
    const tiles = {};
    const start = (z.cfg && z.cfg.start) || {};
    H.disk(CFG.startRings).forEach(k => { tiles[k] = start[k] && z.tile[start[k]] ? start[k] : z.base; });
    return {
      open: !!open, done: false, rings: CFG.startRings,
      tiles,               // 칸: "q,r" -> 칸 종류
      items: {},           // 아이템: "q,r" -> { 아이템 id: 1 }
      stock: {},           // 가진 것: 아이템 id -> 남은 개수
      sold: {},            // 올해 작은 벌이를 한 칸
      decor: {},           // 칸을 차지하지 않는 꾸밈: "q,r" -> 꾸밈 id
      here: {},            // 오늘 와 있는 이웃: 종 id -> { cell, away }
      traces: [],          // 오늘의 흔적
      trash: [],           // 오늘의 폐비닐
      guest: null,         // 오늘 온 손님: { state: 'waiting' | 'taken' | 'sent' }
      intruder: null,      // 들어와 있는 불청객: { id, days }
      hardCame: false,     // 어려운 발길이 한 번이라도 왔는가
      cleaned: 0
    };
  }
  ST.newZone = newZone;

  ST.fresh = function () {
    const S = {
      v: 1, zone: 'field', mode: 'tend',
      year: 1, day: 1, clock: 0, money: CFG.startMoney,
      started: false,
      keeper: '', park: '',                 // 지킴이 이름, 보호구역 이름
      tut: { done: false, step: 0 },        // 첫 아침 안내를 어디까지 했는가
      seen: {},                             // 처음 마주칠 때의 한 줄 알림 가운데 이미 본 것
      settings: { quality: CFG.defaultQuality, sound: true, autoChecked: false, look: 1 },
      flags: { careOpen: false, allOpen: false },
      comfort: {}, met: {}, rec: {}, recInfo: {}, traceRec: {}, names: {}, settledOn: {}, firstDay: {},
      z: {},
      today: null,
      annals: []           // 연보: 해마다의 결산
    };
    GD.ZONES.forEach((z, i) => { if (z.ready) S.z[z.id] = newZone(z, i === 0); });
    GD.ALLSP.forEach(s => { S.comfort[s.id] = 0; S.rec[s.id] = 0; });
    return S;
  };

  // 저장된 내용에 새로 생긴 칸이 빠져 있으면 채운다
  function patch(S) {
    const F = ST.fresh();
    if (S.tut === undefined) S.tut = { done: !!S.started, step: 0 };   // 예전 저장을 가진 사람은 안내를 끝낸 것으로 본다
    for (const k in F) if (S[k] === undefined) S[k] = F[k];
    for (const k in F.settings) if (S.settings[k] === undefined) S.settings[k] = F.settings[k];
    for (const k in F.flags) if (S.flags[k] === undefined) S.flags[k] = F.flags[k];
    GD.ZONES.forEach(z => {
      if (!z.ready) return;
      if (!S.z[z.id]) S.z[z.id] = F.z[z.id];
      const Z = S.z[z.id], FZ = F.z[z.id];
      for (const k in FZ) if (Z[k] === undefined) Z[k] = FZ[k];
      // 자료가 바뀌어 없어진 칸 종류는 바탕 칸으로 돌린다
      for (const k in Z.tiles) if (!z.tile[Z.tiles[k]]) Z.tiles[k] = z.base;
    });
    GD.ALLSP.forEach(s => { if (S.comfort[s.id] === undefined) S.comfort[s.id] = 0; if (S.rec[s.id] === undefined) S.rec[s.id] = 0; });
    if (!S.z[S.zone] || !S.z[S.zone].open) S.zone = 'field';
    if (!CFG.quality[S.settings.quality]) S.settings.quality = CFG.defaultQuality;
    return S;
  }

  function testStorage() {
    if (storageOk !== null) return storageOk;
    try { localStorage.setItem('gitdeul_test', '1'); localStorage.removeItem('gitdeul_test'); storageOk = true; }
    catch (e) { storageOk = false; }
    return storageOk;
  }
  ST.storageOk = testStorage;

  ST.load = function () {
    let raw = null;
    if (testStorage()) { try { raw = localStorage.getItem(CFG.saveKey); } catch (e) { raw = null; } }
    if (!raw && typeof window.name === 'string' && window.name.indexOf('GDSAVE:') === 0) raw = window.name.slice(7);
    if (raw) {
      try { const S = JSON.parse(raw); if (S && S.v === 1 && S.z) { GD.S = patch(S); return true; } }
      catch (e) { console.warn('[깃들] 저장된 내용을 읽지 못했어요', e); }
    }
    GD.S = ST.fresh();
    return false;
  };

  ST.saveNow = function () {
    dirty = false;
    const raw = JSON.stringify(GD.S);
    let ok = false;
    if (testStorage()) { try { localStorage.setItem(CFG.saveKey, raw); ok = true; } catch (e) { ok = false; } }
    if (!ok) { try { window.name = 'GDSAVE:' + raw; } catch (e) { } }
    ST.lastSaved = Date.now(); ST.lastOk = ok;
    return ok;
  };
  // 바뀔 때마다 부르면 조금 뒤에 한 번만 저장한다
  ST.save = function () { dirty = true; if (!timer) timer = setTimeout(() => { timer = 0; if (dirty) ST.saveNow(); }, 800); };

  ST.reset = function () {
    if (testStorage()) { try { localStorage.removeItem(CFG.saveKey); } catch (e) { } }
    try { if (typeof window.name === 'string' && window.name.indexOf('GDSAVE:') === 0) window.name = ''; } catch (e) { }
    const keep = GD.S ? GD.S.settings : null;
    GD.S = ST.fresh();
    if (keep) GD.S.settings = keep;
  };

  // 저장 내용을 파일로 내보낸다
  ST.exportFile = function () {
    const raw = JSON.stringify(GD.S, null, 1);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    a.download = '깃들_저장_' + GD.S.year + '해_' + GD.S.day + '일.json';
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // 파일에서 불러온다. 성공하면 true 를 돌려주는 약속을 준다.
  ST.importText = function (text) {
    const S = JSON.parse(text);
    if (!S || S.v !== 1 || !S.z || typeof S.day !== 'number') throw new Error('깃들 저장 파일이 아니에요');
    GD.S = patch(S); ST.saveNow();
    return true;
  };

  window.addEventListener('beforeunload', () => { if (GD.S && GD.S.started) ST.saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && GD.S && GD.S.started) ST.saveNow(); });
})();
