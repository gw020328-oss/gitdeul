/* 깃들 데모: 화면의 글과 창
   알림(아침 소식), AI 패널, 칸과 아이템 고르기, 도감, 지도, 오늘의 결산, 설정.
   게임의 규칙은 여기에 없다. sim.js 가 알린 것을 받아 보여 주기만 한다. */
(function () {
  const CFG = GD.CFG, U = GD.util, H = GD.hex, V = GD.vis, RL = GD.rules, SIM = GD.sim, esc = U.esc;
  const UI = GD.ui = {};
  const $ = id => document.getElementById(id);
  const S = () => GD.S;
  const tag = (k) => '<span class="tag ' + ({ temp: 'temp', game: 'game', literature: 'lit', model: 'model' }[k]) + '">' + GD.BASIS[k] + '</span>';
  let palTab = 'tile', selSp = null, dirty = true;
  UI.dirty = () => { dirty = true; };

  /* ================= 알림 ================= */
  UI.toast = function (msg, sub, ms, cls, html) {
    const box = $('notes'), n = document.createElement('div'); n.className = 'card note' + (cls ? ' ' + cls : '');
    n.innerHTML = '<span>' + (html ? msg : esc(msg)) + '</span>' + (sub ? '<small>' + (html ? sub : esc(sub)) + '</small>' : '');
    box.appendChild(n); while (box.children.length > 3) box.removeChild(box.firstChild);
    requestAnimationFrame(() => n.classList.add('on'));
    const kill = () => { n.classList.remove('on'); setTimeout(() => n.remove(), 500); };
    const t = setTimeout(kill, ms || 5200); n.addEventListener('click', () => { clearTimeout(t); kill(); });
    return n;
  };

  /* ================= 창 ================= */
  const queue = []; let open = false;
  UI.modalOpen = () => open || $('intro').style.display !== 'none';
  function show(m) {
    open = true; SIM.paused = true;
    $('mh').textContent = m.title; $('mb').innerHTML = m.html; const box = $('mbtn'); box.innerHTML = '';
    $('modal').firstElementChild.className = 'card' + (m.wide ? ' wide' : '');
    (m.btns || [['닫기']]).forEach((b, i) => { const e = document.createElement('button'); e.textContent = b[0]; if (b[2] || (i && !b[3])) e.className = 'b2'; e.onclick = () => { const keep = b[1] && b[1]() === false; if (!keep) UI.close(); }; box.appendChild(e); });
    $('modal').style.display = 'flex'; if (GD.walk) GD.walk.unlock(); $('obs').style.display = 'none';
    if (m.after) m.after();
  }
  UI.modal = function (title, html, btns, opt) { const m = Object.assign({ title, html, btns }, opt || {}); if (open) queue.push(m); else show(m); };
  UI.close = function () { $('modal').style.display = 'none'; open = false; SIM.paused = $('intro').style.display !== 'none'; if (queue.length) show(queue.shift()); UI.dirty(); };

  /* ================= 늘 보이는 것 ================= */
  const stageWord = (sp) => GD.STG[SIM.stage(sp)] || '';
  function hereWord(Z, spId) {
    const h = Z.here[spId]; if (!h) return null;
    if (h.away) return '자리를 비켰어요';
    const sp = GD.SP[spId];
    if (sp.hidden && !S().rec[spId]) return '흔적만 있어요';
    if (sp.dayPart.indexOf(SIM.phase().id) < 0) return '지금은 보이지 않아요';
    return '지금 와 있어요';
  }
  function topCard() {
    const s = S(), z = GD.zone(s.zone), Z = s.z[s.zone], ph = SIM.phase();
    $('ttl').textContent = z.name + (Z.done ? ' · ' + z.keeper + (s.keeper ? ' ' + s.keeper : '') : '');
    $('sub').textContent = s.year + '해째 ' + z.season + ' · ' + s.day + '일째 / ' + CFG.yearDays + ' · ' + ph.name;
    const L = s.today && s.today.income;
    $('coin').innerHTML = '돈 <b>' + s.money + '</b>' + tag('game') + (L ? '<small>오늘 아침 +' + L.sum + ' (기본 ' + L.base + (L.big ? ' · 돈 되는 칸 ' + L.big : '') + (L.stay ? ' · 보전 ' + L.stay : '') + (L.crop ? ' · 수확 ' + L.crop : '') + ')</small>' : '');
    $('clk').className = SIM.canSleep() ? 'sleep' : '';
  }
  function newsBox() {
    const s = S(), T = s.today, z = GD.zone(s.zone); if (!T) { $('news').innerHTML = ''; return; }
    const came = (T.came[s.zone] || []).map(id => GD.SP[id].name);
    $('news').innerHTML = '<b>오늘의 소식</b><div class="who">' + (came.length ? '오늘 온 이웃: ' + esc(came.join(', ')) : '오늘은 아무도 오지 않았어요') + '</div><ul>' + T.news.map(n => '<li>' + esc(n.text) + '</li>').join('') + '</ul>';
  }
  function guestBox() {
    const s = S(), z = GD.zone(s.zone), Z = s.z[s.zone]; let h = '';
    if (Z.guest && Z.guest.state === 'waiting') {
      const g = z.earn.guest || { name: '손님' }, hit = SIM.guestHitPreview(s.zone), n = RL.counts(s.zone), guarded = (n['@sign'] || 0) + (n['@blind'] || 0) > 0;
      h += '<b>' + esc(U.josa(g.name, '이/가')) + ' 찾아왔어요</b>받으면 돈이 되지만 이웃의 편안함이 깎여요. ' + (s.zone === 'field' ? (guarded ? '푯말이나 가림막 덕에 멀리서만 보게 할 수 있어요.' : '푯말이나 가림막이 있으면 덜 깎여요.') : '') + ' 내버려 둬도 편안함이 깎여요.'
        + '<div><button class="p" data-g="send">돌려보낸다</button><button data-g="take">받는다 (돈 +' + CFG.income.guest + ', 편안함 -' + hit + ')</button></div>';
    }
    if (Z.intruder) {
      const it = GD.INTRUDER[Z.intruder.id], zi = z.intruder || {};
      h += (h ? '<div style="height:8px"></div>' : '') + '<b>불청객: ' + esc(it.name) + '</b>' + esc((it.harm || zi.harm || '이웃의 편안함이 깎인다') + '. 막는 법: ' + (it.counter || zi.counter || []).join(', ') + '.')
        + '<div><button class="p" data-g="fix">걷어 낸다 (돈 ' + CFG.intruderFixCost + ')</button></div>';
    }
    $('guest').innerHTML = h;
  }
  $('guest').addEventListener('click', e => {
    const g = e.target.dataset && e.target.dataset.g; if (!g) return; const zid = S().zone;
    if (g === 'fix') { const r = SIM.fixIntruder(zid); UI.toast(r.msg || '', r.sub); }
    else { const r = SIM.answerGuest(zid, g === 'take'); if (r) UI.toast(r.take ? '손님을 받았어요 · 돈 +' + CFG.income.guest : '손님을 돌려보냈어요', r.take ? '오늘 이웃들은 조금 불편해해요.' : '이웃이 조용히 지내요.'); GD.emit('actors'); }
    UI.dirty();
  });

  /* ---------- AI 패널 ---------- */
  function aiPanel() {
    const s = S(), zid = s.zone, z = GD.zone(zid), Z = s.z[zid], n = RL.counts(zid), unk = RL.unknown(zid, n);
    $('aisays').textContent = '고민: ' + (z.dilemma || '') + ' · 이 구역의 AI는 ' + ({ count: '무엇을 몇 칸 바꿀지까지 말해 줘요', lack: '무엇이 모자란지만 말해 줘요', unknown: '어려운 발길은 아직 모른다고 말해요', conflict: '알려 주지만 다 들어줄 수는 없어요' }[z.aiDetail] || '');
    if (!selSp || GD.SP[selSp].zone !== zid) selSp = null;
    let h = '';
    for (const sp of z.species) {
      const silent = RL.silent(sp.id) || unk, L = RL.level(RL.score(sp.id, n)), SL = RL.level(RL.stayScore(sp.id, n, zid)), st = SIM.stage(sp.id), hw = hereWord(Z, sp.id);
      h += '<div class="row' + (selSp === sp.id ? ' on' : '') + '" data-sp="' + sp.id + '"><div class="l1">' + (Z.here[sp.id] ? '<i class="here" title="오늘 와 있어요"></i>' : '') + '<b>' + esc(sp.name) + '</b><span class="tier">' + GD.TIER[sp.tier] + '</span>'
        + '<span class="lv l' + (silent ? 'x' : L) + '">' + (silent ? '아직 모름' : GD.LV[L]) + '</span></div>'
        + '<p>' + esc(unk ? '이런 땅은 본 적이 없어요.' : silent ? (sp.stub ? '아직 내용 자료가 없어요.' : '관찰 기록이 없어서 AI가 아직 몰라요.') : RL.why(sp.id, n)) + '</p>'
        + '<p class="st">머물 가능성 ' + (silent ? '아직 모름' : GD.LV[SL]) + ' · ' + (st ? GD.STG[st] + ' · 편안함 ' + Math.round(s.comfort[sp.id]) + (hw ? ' · ' + hw : '') : '아직 온 적 없음') + '</p>'
        + '<i class="cf"><u style="width:' + (s.comfort[sp.id] || 0) + '%"></u></i></div>';
    }
    $('rows').innerHTML = h;
    let ex;
    const pick = selSp || (z.species.find(sp => !sp.stub && !RL.silent(sp.id) && RL.level(RL.score(sp.id, n)) < 2) || {}).id;
    if (unk) ex = RL.explain(zid, z.species[0].id, n);
    else if (!pick) ex = '올 가능성이 모두 높아요. 그래도 매번 오는 건 아니에요. 머물게 하려면 조용히 지켜보고 돌봄 아이템을 놓아 보세요.';
    else ex = RL.explain(zid, pick, n);
    $('exp').textContent = ex;
    const care = RL.care(zid, n);
    $('ainote').innerHTML = '돌봄: ' + (care.list.length ? esc(care.list.join(', ')) : '아직 없음') + '. 돌봄이 있으면 온 이웃이 더 편히 머물러요.<br>오고 머무는 판단은 진짜 모델 대신 ' + tag('temp') + '이 하고 있어요. 돈의 숫자와 흔적이 생기는 빈도는 ' + tag('game') + '이에요.';
  }
  $('rows').addEventListener('click', e => { const c = e.target.closest('.row'); if (c) { selSp = selSp === c.dataset.sp ? null : c.dataset.sp; GD.emit('aiPick', c.dataset.sp); UI.dirty(); } });

  /* ---------- 칸, 돌봄, 벌이, 꾸밈 ---------- */
  const TABS = [['tile', '칸'], ['care', '돌봄'], ['earn', '벌이'], ['decor', '꾸밈']];
  const sameTool = (a, b) => a && b && a.t === b.t && a.id === b.id;
  function palette() {
    const s = S(), zid = s.zone, z = GD.zone(zid), Z = s.z[zid], n = RL.counts(zid), tool = GD.tend.tool;
    $('tabs').innerHTML = TABS.map(t => '<span class="' + (palTab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</span>').join('');
    const chip = (t, sw, label, em, cls) => '<div class="chip' + (sameTool(tool, t) ? ' sel' : '') + (cls ? ' ' + cls : '') + '" data-tool=\'' + JSON.stringify(t) + '\'><i style="background:' + sw + '"></i>' + esc(label) + (em ? ' <em>' + esc(em) + '</em>' : '') + '</div>';
    let h = '', note = '';
    if (palTab === 'tile') {
      h = z.paintTiles.map(t => chip({ t: 'tile', id: t.id }, V.swatch(t.id), t.name, n[t.id] + '칸')).join('');
      note = '칸 바꾸기는 한 칸에 돈 ' + SIM.tileCost(zid, z.paintTiles[0].id) + '. 칸을 고르고 땅의 육각형 칸을 누르세요. 누른 채 끌면 이어서 바뀌어요.';
      if (tool && tool.t === 'tile' && z.tile[tool.id] && !z.tile[tool.id].money && !z.tile[tool.id].decor) note = z.tile[tool.id].name + ': ' + z.tile[tool.id].goodFor + '. 한 칸에 돈 ' + SIM.tileCost(zid, tool.id) + '.' + (z.tile[tool.id].engine ? ' (게임 쪽에서 임시로 넣은 칸)' : '');
    } else if (palTab === 'care') {
      h = z.items.map(i => { const open2 = SIM.itemOpen(zid, i.id), st = Z.stock[i.id] || 0; return chip({ t: 'item', id: i.id }, V.itemSwatch[i.id] || '#a08b62', i.name, n['@' + i.id] + '개' + (st ? ' · 가진 것 ' + st : ''), open2 ? '' : 'off'); }).join('')
        + (n.soldable ? '<div class="chip info">남겨 둔 먹이 <em>' + (n.soldable - n.sold) + ' / ' + n.soldable + '칸</em></div>' : '');
      note = '아이템은 돈 ' + SIM.itemCost(zid) + '. 놓은 것을 다시 누르면 거둬요. 거둔 것은 돈 없이 다시 놓을 수 있어요. 먹이는 팔지 않고 남겨 두면 돼요.';
      if (tool && tool.t === 'item' && z.item[tool.id]) { const it = z.item[tool.id]; note = it.name + ': ' + it.does + '. 놓는 곳: ' + (it.placeOn.indexOf('*') >= 0 ? '아무 칸' : it.placeOn.map(id => z.tile[id] ? z.tile[id].name : id).join(', ')) + '.' + (SIM.itemOpen(zid, it.id) ? '' : ' 어려운 발길의 이웃을 처음 도감에 적으면 살 수 있어요.') + (it.engine ? ' (쉴 자리를 구역마다 무엇으로 할지는 아직 정해지지 않아 임시로 둔 것)' : ''); }
    } else if (palTab === 'earn') {
      h = z.tiles.filter(t => t.money).map(t => chip({ t: 'tile', id: t.id }, V.swatch(t.id), t.name, n[t.id] + '칸 · 매일 +' + CFG.income.big)).join('');
      const sm = z.earn.small; if (sm) h += chip({ t: 'small' }, '#d9bf6a', sm.name, '남은 칸 ' + (n.soldable - n.sold));
      const ec = SIM.expandCost(zid); h += '<div class="chip' + (ec === undefined ? ' off' : '') + '" data-act="expand"><i style="background:#c9d6c2"></i>땅 넓히기 <em>' + (ec === undefined ? '다 넓혔어요' : '돈 ' + ec) + '</em></div>';
      const big = z.tiles.find(t => t.money);
      note = (big ? '돈 되는 칸은 짓는 데 돈 ' + SIM.tileCost(zid, big.id) + ', 매일 +' + CFG.income.big + '. 헐면 절반이 돌아와요. ' + (z.earn.big && z.earn.big.price ? '대가: ' + z.earn.big.price + '. ' : '') : '')
        + (sm ? sm.name + '는 한 칸에 한 해 한 번, 돈 +' + CFG.income.small + '. 남기면 먹이가 돼요' + (sm.leaveFor ? '(' + sm.leaveFor + ')' : '') + '. ' : '') + '어려운 발길의 이웃이 머물면 보전 수입이 매일 들어와요.';
    } else {
      h = GD.DECOR.map(d => chip(d.occupy ? { t: 'tile', id: d.id } : { t: 'decor', id: d.id }, V.decorSwatch[d.id], d.name, '돈 ' + CFG.decorCost[d.id])).join('');
      note = '꾸밈은 내 보호구역을 꾸며요. 길과 정자는 칸을 차지해서 이웃의 판단에 들어가요. 돌담은 상관이 없어요.';
    }
    $('chips').innerHTML = h; $('palnote').innerHTML = esc(note) + tag('game') + (z.hasWalk ? '' : '<br>이 구역은 걷는 화면이 준비 중이에요. 이웃에 마우스를 가만히 올려 두면 바라보는 것이고, 옅은 고리(흔적)는 눌러서 찾아요.');
  }
  $('tabs').addEventListener('click', e => { const t = e.target.dataset.tab; if (t) { palTab = t; GD.emit('palTab', t); UI.dirty(); } });
  $('chips').addEventListener('click', e => {
    const c = e.target.closest('.chip'); if (!c) return;
    if (c.dataset.act === 'expand') { const r = SIM.expand(S().zone); UI.toast(r.msg, r.sub); UI.dirty(); return; }
    if (c.dataset.tool) { GD.tend.tool = JSON.parse(c.dataset.tool); UI.dirty(); }
  });

  function buttons() {
    const s = S(), z = GD.zone(s.zone), walk = GD.view.mode === 'walk', can = SIM.canSleep();
    $('bMode').innerHTML = walk ? '땅 가꾸러 가기 <kbd>M</kbd>' : (z.hasWalk ? '걸으러 가기 <kbd>M</kbd>' : '걷는 화면은 준비 중');
    $('bMode').disabled = !walk && !z.hasWalk;
    $('bSleep').innerHTML = can ? '잠자리에 들기 <kbd>Z</kbd>' : '해가 지면 잘 수 있어요';
    $('bSleep').disabled = !can;
    $('bSit').classList.toggle('on', !!GD.walk.sit);
    $('bSit').innerHTML = GD.walk.sit ? '일어서기 <kbd>C</kbd>' : '앉아서 바라보기 <kbd>C</kbd>';
    $('tag').textContent = 'W A S D 걷기 · Shift 뛰기 · ' + (GD.walk.locked ? '마우스로 둘러보기 (Esc로 풀기)' : GD.walk.freeLook ? '마우스를 움직여 둘러보기' : '화면을 한 번 누르면 마우스로 둘러봐요') + ' · C 앉기 · M 가꾸기 · B 도감 · T 지도 · N 소리';
  }
  UI.refresh = function () {
    if (!S() || !S().today) return;
    topCard(); newsBox(); guestBox(); buttons();
    if (GD.view.mode === 'tend') { aiPanel(); palette(); }
  };
  UI.frame = function () {
    const w = Math.round(S().clock / CFG.dayLen * 1000) / 10; if (UI._w !== w) { UI._w = w; $('clku').style.width = w + '%'; }
    if (dirty) { dirty = false; UI.refresh(); }
  };
  function obsBar() {
    const walk = GD.view.mode === 'walk', src = walk ? GD.walk : GD.tend, o = $('obs');
    if (!src.obsSp || src.obs <= 0) { o.style.display = 'none'; return; }
    o.style.display = 'block'; $('obst').textContent = U.josa(GD.SP[src.obsSp].name, '을/를') + ' 가만히 바라보는 중'; $('obsb').style.width = Math.round(src.obs * 100) + '%';
  }
  GD.on('obs', obsBar);

  /* ================= 아침 소식 ================= */
  GD.on('morning', () => {
    if (GD.tut && GD.tut.quietMorning()) { UI.dirty(); return; }      // 첫 아침의 첫날에는 아침 소식을 띄우지 않는다
    const s = S(), T = s.today, z = GD.zone(s.zone), came = (T.came[s.zone] || []).map(id => GD.SP[id].name);
    let head = came.length ? '오늘은 ' + U.josa(U.joinNames(came), '이/가') + ' 찾아왔어요.' : '오늘 아침에는 아무도 오지 않았어요.';
    const lines = [];
    T.back.forEach(id => { const nm = s.names[id]; if (nm && nm.zone === s.zone) lines.push(U.josa(GD.SP[id].name, '이/가') + ' \'' + nm.name + '\'' + U.josa(nm.name, '으로/로').slice(nm.name.length) + ' 돌아왔어요.'); });
    SIM.openZones().forEach(o => { if (o.id === s.zone) return; const c = (T.came[o.id] || []).map(id => GD.SP[id].name); lines.push(o.name + ': ' + (c.length ? U.josa(U.joinNames(c), '이/가') + ' 왔어요.' : '조용해요.')); });
    T.news.forEach(n => lines.push(n.text));
    UI.toast('<b>' + s.day + '일째 아침</b> · ' + esc(head), '<ul>' + lines.map(l => '<li>' + esc(l) + '</li>').join('') + '</ul>', 15000, 'morning', true);
    UI.dirty();
  });
  GD.on('phase', ph => {
    if (ph === 'dusk') UI.toast('해 질 녘이에요', '이제 잠자리에 들 수 있어요. 해 질 녘에만 나오는 이웃도 있어요.');
    else if (ph === 'night') UI.toast('밤이 됐어요', '밤에 다니는 이웃이 나올 때예요.');
    else if (ph === 'day') UI.toast('날이 밝았어요');
    UI.dirty();
  });
  GD.on('toast', o => UI.toast(o.msg, o.sub, o.ms));
  GD.on('ui', UI.dirty); GD.on('land', UI.dirty); GD.on('zone', UI.dirty); GD.on('look', UI.dirty); GD.on('sit', UI.dirty);
  GD.on('spooked', sp => UI.toast('너무 가까이 갔어요', U.josa(GD.SP[sp].name, '이/가') + ' 놀라 물러났어요. 오늘은 편안함이 깎여요. 천천히 다가가세요.'));
  GD.on('trace', o => {
    const sp = GD.SP[o.sp], what = GD.TRACE[o.trace.what] || '흔적';
    if (o.trace.type === 'passed') UI.toast(sp.name + '의 ' + U.josa(what, '을/를') + ' 찾았어요', '다녀간 흔적이에요. 가까워지고 있어요. AI가 ' + sp.name + '에 대해 더 자세히 말해 줘요.', 7000);
    else UI.toast(sp.name + '의 ' + U.josa(what, '을/를') + ' 찾았어요', '숨은 이웃의 흔적이에요. 지금 어딘가에 있어요. ' + (sp.dayPart.length < 4 ? '나오는 때: ' + sp.dayPart.map(p => CFG.phases.find(x => x.id === p).name).join(', ') + '.' : ''), 7000);
    UI.dirty();
  });

  /* ================= 도감에 적힘, 이름 짓기, 구역 열림 ================= */
  GD.on('record', o => {
    const s = S(), sp = GD.SP[o.sp], scene = [sp.stages.visit, sp.stages.stay, sp.stages.settle][o.k - 1] || '';
    let sub = (scene ? scene.replace(/\.$/, '') + '. ' : '') + '돈 +' + o.gain + '.';
    if (o.events.indexOf('care') >= 0) sub += ' 푯말과 가림막을 살 수 있게 됐어요.';
    if (o.k === 1) sub += ' ' + GD.TIER_LINE[sp.tier] + '.';
    UI.toast(sp.name + '의 ' + GD.STG[o.k] + '을 도감에 적었어요', sub, 8000);
    if (o.name) UI.modal(U.josa(sp.name, '이/가') + ' 깃들었어요', esc(U.josa(sp.name, '이/가') + ' 이 땅을 제 터로 삼았어요. 깃든 자리에 이름을 지어 주세요. 이웃이 아니라 땅의 이름이에요. 팻말이 서고, 지도와 도감에 남아요.')
      + '<p><input type="text" id="nm" maxlength="12" value="' + esc(o.name.suggest) + '"></p>', [['이 이름으로 짓기', () => { const nm = SIM.nameSpot(o.sp, $('nm').value); UI.toast('\'' + nm + '\' 팻말을 세웠어요'); }]], { after: () => { const i = $('nm'); i.focus(); i.select(); } });
    o.events.forEach(ev => {
      if (ev.open) { const nz = GD.zone(ev.open); UI.modal(U.josa(nz.name, '이/가') + ' 열렸어요', esc(U.josa(sp.name, '이/가') + ' 깃들었어요. 깃듦이 다음 구역을 여는 열쇠예요.') + '<small>' + (ev.ready ? '지도(T)에서 ' + esc(U.josa(nz.name, '으로/로')) + ' 갈 수 있어요. 날은 모든 구역에서 같이 가요. 돈도 하나로 써요.' : '이 구역의 내용 자료는 아직 준비 중이에요.') + '</small>', [['계속 가꾸기'], ['지도 보기', () => { setTimeout(UI.map, 0); }]]); }
      if (ev.done) { const dz = GD.zone(ev.done); UI.modal(dz.name + '을 완성했어요', '어려운 발길의 이웃이 모두 깃들었어요. 들머리에 솟대가 섰어요. 이제 "' + esc(dz.keeper) + '"라고 불려요.<small>' + s.year + '해째 ' + s.day + '일째에 완성했어요. 완성은 끝이 아니에요. 해마다 이웃이 돌아오는지 지켜보게 돼요.</small>', [['계속 가꾸기']]); GD.emit('objects'); }
    });
    UI.dirty();
  });

  /* ================= 오늘의 결산과 잠 ================= */
  const lvChip = (lv, silent) => '<span class="lv l' + (silent ? 'x' : lv) + '">' + (silent ? '아직 모름' : GD.LV[lv]) + '</span>';
  UI.sleep = function (forced) {
    if (!SIM.canSleep() || open) return;
    const st = SIM.settlement(), s = S();
    let h = '<table><tr><th>오늘 한 일</th><th>달라진 것</th></tr>' + (st.rows.length ? st.rows.map(r => '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') : '<tr><td>둘러보기만 했어요</td><td>땅은 그대로예요</td></tr>') + '</table>';
    h += '<h3>내일의 가능성' + tag('temp') + '</h3><table><tr><th>이웃</th><th>올 가능성</th><th>아침과 견주면</th><th>머물 가능성</th></tr>';
    st.tomorrow.filter(t => t.zone === s.zone).forEach(t => { const sp = GD.SP[t.sp]; h += '<tr><td>' + esc(sp.name) + (t.here ? ' · ' + GD.STG[t.stage] : '') + '</td><td>' + lvChip(t.lv, t.silent) + '</td><td>' + (t.silent ? '' : t.lv > t.lv0 ? '올랐어요' : t.lv < t.lv0 ? '내렸어요' : '그대로') + '</td><td>' + lvChip(t.stay, t.silent) + '</td></tr>'; });
    h += '</table>';
    const other = SIM.openZones().filter(z => z.id !== s.zone);
    if (other.length) h += '<small>다른 구역: ' + other.map(z => z.name + ' ' + st.tomorrow.filter(t => t.zone === z.id && !t.silent && t.lv === 2).length + '종이 높음').join(', ') + '</small>';
    h += '<small>가능성이 높아도 매번 오지는 않아요. 오고 안 오고는 AI가 정해요. 오늘 돈은 ' + (st.moneyDelta >= 0 ? '+' : '') + st.moneyDelta + ', 지금 ' + st.money + '이에요.</small>';
    const go = () => { UI.close(); UI.fadeTo(() => { const r = SIM.nextMorning(); }); return false; };
    UI.modal(s.day + '일째의 결산', h, forced ? [['잠자리에 들기', go]] : [['잠자리에 들기', go], ['조금 더 있기']]);
  };
  UI.fadeTo = function (fn) { const f = $('fade'); f.classList.add('on'); SIM.paused = true; setTimeout(() => { fn(); f.classList.remove('on'); SIM.paused = open; UI.dirty(); }, 700); };
  GD.on('nightEnd', () => { UI.toast('밤이 깊었어요', '오늘을 마무리해요.'); UI.sleep(true); });
  GD.on('yearEnd', sum => {
    const s = S(), rows = sum.rows.map(r => '<tr><td>' + esc(GD.zone(r.zone).name) + '</td><td>' + esc(GD.SP[r.sp].name) + '</td><td>' + (GD.STG[r.stage] || '오지 않음') + '</td><td>도감 ' + r.rec + ' / 3</td></tr>').join('');
    UI.modal(sum.year + '해째가 끝났어요', '철새와 여름새가 떠났어요. 이번 해의 기록이에요.<table>' + (rows || '<tr><td>아직 만난 이웃이 없어요</td></tr>') + '</table>'
      + (sum.names.length ? '<p>이름을 지은 자리: ' + esc(sum.names.map(n => n.name).join(', ')) + '</p>' : '') + '모은 돈 ' + sum.money + ' · 수확 수입 +' + sum.crop + tag('game')
      + '<small>깃들었던 이웃은 땅이 머물 만하게 남아 있으면 다음 해 첫 며칠 안에 돌아와요. 돌아오는지도 AI가 정해요. 도감의 기록과 자리의 이름은 그대로 남아요.</small>',
      [['다음 해로', () => { UI.close(); UI.fadeTo(() => { const crop = SIM.newYear(); UI.toast('새 해가 왔어요', '수확으로 돈 +' + crop + '. 작은 벌이도 새로 할 수 있어요.', 7000); }); return false; }]]);
  });

  /* ================= 도감 ================= */
  let dexZone = null, dexSp = null;
  function dexHtml() {
    const s = S(); dexZone = dexZone || s.zone; const z = GD.zone(dexZone), Z = s.z[dexZone];
    const total = GD.ALLSP.reduce((a, sp) => a + (s.rec[sp.id] || 0), 0);
    let h = '<div class="dex"><div class="list"><div class="ztab">' + GD.ZONES.map(o => '<span class="' + (o.id === dexZone ? 'on' : '') + (s.z[o.id] && s.z[o.id].open ? '' : ' lock') + '" data-z="' + o.id + '">' + o.name + '</span>').join('') + '</div>';
    z.species.forEach(sp => {
      const k = s.rec[sp.id] || 0, st = SIM.stage(sp.id), hw = Z ? hereWord(Z, sp.id) : null;
      h += '<div class="drow' + (k || s.met[sp.id] ? ' seen' : '') + (hw === '지금 와 있어요' ? ' here' : '') + (dexSp === sp.id ? ' on' : '') + '" data-sp="' + sp.id + '"><span class="dots">' + [1, 2, 3].map(i => '<i class="' + (k >= i ? 'on' : '') + '"></i>').join('') + '</span><span class="nm">' + esc(sp.name) + '<small>' + GD.TIER[sp.tier] + '</small></span><span class="stt">' + (hw || (st ? GD.STG[st] : '아직 못 만남')) + '</span></div>';
    });
    h += '<small>적은 기록 ' + total + ' / ' + GD.ALLSP.length * 3 + '. 왔다고 저절로 적히지 않아요. 단계마다 찾아가 바라봐야 적혀요.</small></div><div class="det">';
    const sp = dexSp && GD.SP[dexSp].zone === dexZone ? GD.SP[dexSp] : null;
    if (!sp) h += '<p style="color:#8c8771">왼쪽에서 이웃을 고르세요. 서른여섯 종이 네 구역에 나뉘어 있어요.</p>';
    else {
      const k = s.rec[sp.id] || 0, info = s.recInfo[sp.id] || [], nm = s.names[sp.id];
      h += '<h2>' + esc(sp.name) + (sp.sci ? '<small>' + esc(sp.sci) + '</small>' : '') + '</h2><div>' + GD.TIER[sp.tier] + ' · ' + GD.TIER_LINE[sp.tier] + '</div>';
      h += sp.badges.map(b => '<span class="stamp' + (sp.badgesChecked ? '' : ' q') + '">' + esc(b) + '</span>').join('') + (sp.badges.length && !sp.badgesChecked ? '<small class="in">표지는 확인 중이에요</small>' : '');
      h += '<div class="rec" style="border-color:transparent;padding-left:0;margin:8px 0 0"><span class="dim">판단의 근거:</span> 지금은 ' + tag('temp') + ' · 모델을 연결하면 ' + tag(sp.basis === 'literature' ? 'literature' : 'model') + (sp.basis === 'literature' ? ' 좌표 자료가 없어 발표된 연구로 판단해요.' : '') + '</div>';
      if (nm) h += '<p>깃든 자리의 이름: <b>' + esc(nm.name) + '</b> (' + nm.y + '해째 ' + nm.d + '일째)</p>';
      if (s.traceRec[sp.id]) h += '<p>찾은 흔적: ' + s.traceRec[sp.id] + '번</p>';
      const scenes = [sp.stages.visit, sp.stages.stay, sp.stages.settle];
      for (let i = 1; i <= 3; i++) {
        const r = info.find(x => x.k === i);
        h += '<div class="rec' + (r ? ' on' : '') + '"><b>' + GD.STG[i] + '</b> ';
        if (!r) h += '<span class="dim">' + (i === 1 ? '찾아온 이웃을 처음 바라보면 적혀요' : i === 2 ? '머묾이 된 이웃을 바라보면 적혀요' : '깃듦이 된 이웃을 바라보면 적혀요') + '</span>';
        else {
          h += '<span class="dim">' + r.year + '해째 ' + r.day + '일째</span>' + (scenes[i - 1] ? '<p>' + esc(scenes[i - 1]) + '</p>' : '');
          if (i < 3) h += '<p><span class="dim">' + (i === 1 ? '온 까닭' : '머문 까닭') + ':</span> ' + esc(r.why || 'AI가 아직 모르는 이웃이에요') + '</p><p><span class="dim">그날의 내 땅:</span> ' + esc(r.land) + '</p>';
          if (i === 2) h += '<p><span class="dim">실제 이야기' + (sp.story.checked ? '' : ' (임시, 확인 중)') + ':</span> ' + esc(sp.story.text || '아직 적지 못했어요') + '</p>' + (sp.story.sources || []).map(u => /^https?:/.test(u) ? '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(u) + '</a><br>' : '<span class="dim">출처: ' + esc(u) + '</span><br>').join('');
          if (i === 3) h += '<p><span class="dim">깃들기까지:</span> ' + r.days + '일</p><p><span class="dim">그동안 내가 한 일:</span> ' + esc(r.did) + '</p>';
        }
        h += '</div>';
      }
      if (k < 2) h += '<small>실제 이야기는 머묾을 적으면 열려요.</small>';
    }
    return h + '</div></div>';
  }
  UI.dex = function () {
    if (open) return;
    UI.modal((S().park || '깃들 보호구역') + ' 도감' + (S().keeper ? ' · 지킴이 ' + S().keeper : ''), dexHtml(), [['닫기']], { wide: true });
    $('mb').onclick = e => {
      const zt = e.target.closest('[data-z]'), r = e.target.closest('.drow');
      if (zt) { dexZone = zt.dataset.z; dexSp = null; } else if (r) dexSp = r.dataset.sp; else return;
      $('mb').innerHTML = dexHtml();
    };
  };

  /* ================= 지도 ================= */
  function mapSvg() {
    const s = S(), RB = 100, SQ3 = Math.sqrt(3), pos = [[110, 110], [260, 110 + RB * SQ3 / 2], [410, 110], [560, 110 + RB * SQ3 / 2]];
    let g = '';
    GD.ZONES.forEach((z, i) => {
      const [cx, cy] = pos[i], Z = s.z[z.id], openZ = Z && Z.open, pts = H.corners(cx, cy, RB, true).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
      g += '<polygon points="' + pts + '" fill="' + (openZ ? V.zoneColor[z.id] : '#ddd6c6') + '" stroke="' + (z.id === s.zone ? '#5c8062' : '#b9ab8e') + '" stroke-width="' + (z.id === s.zone ? 4 : 1.5) + '"/>';
      if (openZ) {
        const rr = RB * .92 / (SQ3 * (Z.rings + .5)), k = rr / H.R;
        for (const key in Z.tiles) { const c = H.centerK(key), t = Z.tiles[key], wet = t === 'paddy' && Z.items[key] && Z.items[key].watergate; g += '<polygon points="' + H.corners(cx + c[0] * k, cy + c[1] * k, rr * .94, false).map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ') + '" fill="' + (wet ? V.tile('paddy+watergate').sw : V.swatch(t)) + '"/>'; }
        for (const id in s.names) { const nm = s.names[id]; if (nm.zone !== z.id) continue; const c = H.centerK(nm.cell); g += '<circle cx="' + (cx + c[0] * k) + '" cy="' + (cy + c[1] * k) + '" r="4" fill="#b8623e" stroke="#fff" stroke-width="1.5"/>'; }
      } else g += '<text x="' + cx + '" y="' + (cy + 5) + '" text-anchor="middle" font-size="14" fill="#8c8771">' + z.name + '</text>';
    });
    return '<svg id="mapsvg" viewBox="0 0 670 310">' + g + '</svg>';
  }
  UI.map = function () {
    if (open || document.body.classList.contains('tut')) return;      // 지도는 첫 아침을 마친 둘째 날에 처음 보인다
    GD.emit('mapOpen');
    const s = S(); let cards = '';
    GD.ZONES.forEach((z, i) => {
      const Z = s.z[z.id], openZ = Z && Z.open, prev = GD.ZONES[i - 1], settled = z.hard.filter(sp => s.rec[sp.id] >= 3).length;
      let st;
      if (!z.ready) st = s.flags['opened_' + z.id] ? '열렸지만 내용 자료가 준비 중이에요' : '준비 중';
      else if (!openZ) st = prev.name + '에서 어려운 발길의 이웃 한 종이 깃들면 열려요';
      else st = (Z.done ? '완성했어요. 솟대가 섰어요. ' : '') + '깃든 어려운 발길 ' + settled + ' / ' + z.hard.length + (z.hasWalk ? '' : ' · 걷는 화면은 준비 중');
      const names = Object.keys(s.names).filter(id => s.names[id].zone === z.id).map(id => s.names[id].name);
      cards += '<div class="zcard' + (z.id === s.zone ? ' cur' : '') + '"><b>' + z.name + (z.id === s.zone ? ' · 지금 여기' : '') + '</b>' + esc(st) + (names.length ? '<br>이름을 지은 자리: ' + esc(names.join(', ')) : '') + (openZ && z.id !== s.zone ? '<br><button data-go="' + z.id + '">이 구역으로 가기</button>' : '') + '</div>';
    });
    UI.modal((S().park || '깃들 보호구역') + ' 지도', mapSvg() + '<div class="zrow">' + cards + '</div><small>구역은 큰 육각형이고 서로 변을 맞대고 있어요. 그 안의 칸은 작은 육각형이에요. 붉은 점은 이름을 지은 자리예요. 날은 열린 구역 모두에서 같이 가요.</small>' + (GD.dev && GD.dev.on ? '<button class="mbtn b2" data-dev="open">개발용: 모두 열기</button>' : ''), [['닫기']], { wide: true });
    $('mb').onclick = e => {
      const go = e.target.dataset.go, dv = e.target.dataset.dev;
      if (go) { UI.close(); GD.goZone(go); }
      if (dv) { GD.dev.openAll(); UI.close(); UI.map(); }
    };
  };

  /* ================= 설정 ================= */
  UI.settings = function () {
    if (open) return;
    const s = S(), q = s.settings.quality, info = GD.contentInfo, ws = GD.w3.stats();
    const seg = (name, opts, cur) => '<span class="seg">' + opts.map(o => '<span class="' + (o[0] === cur ? 'on' : '') + '" data-' + name + '="' + o[0] + '">' + o[1] + '</span>').join('') + '</span>';
    const h = '<div class="set"><label>그래픽</label>' + seg('q', Object.keys(CFG.quality).map(k => [k, CFG.quality[k].name]), q)
      + '<div class="line">화면이 끊기면 낮음으로 바꿔 보세요. 바꾸면 화면을 다시 불러와요. 지금 초당 장면 수는 <b id="fpsnow">' + (GD.fps ? GD.fps.now : '') + '</b>이에요. 낮음은 그림자와 물 반사를 끄고 간단한 모형을 써요.</div>'
      + '<label>소리</label>' + seg('snd', [['on', '켜기'], ['off', '끄기']], s.settings.sound ? 'on' : 'off')
      + '<label>마우스로 둘러보는 빠르기</label>' + seg('look', [[.6, '느리게'], [1, '보통'], [1.5, '빠르게']], s.settings.look)
      + '<label>저장</label><div class="line">' + (GD.state.storageOk() ? '이 브라우저에 저절로 저장돼요. 새로 고쳐도 이어져요.' : '이 브라우저는 저장소를 쓸 수 없어요. 창을 닫으면 사라지니 파일로 내보내 두세요.') + '</div>'
      + '<button class="mbtn b2" data-act="export">파일로 내보내기</button><button class="mbtn b2" data-act="import">파일에서 불러오기</button><button class="mbtn b2" data-act="reset">처음부터 다시</button><input type="file" id="impf" accept=".json,application/json" style="display:none">'
      + '<label>이름</label><div class="line">지킴이 <input type="text" id="setKeeper" maxlength="10" style="width:120px;font-size:13px;padding:4px 8px" value="' + esc(s.keeper || '') + '"> 보호구역 <input type="text" id="setPark" maxlength="14" style="width:160px;font-size:13px;padding:4px 8px" value="' + esc(s.park || '') + '"> <button class="mbtn b2" data-act="names" style="margin:0;padding:5px 12px;font-size:13px">바꾸기</button></div>'
      + '<label>안내</label><div class="line">처음 온 사람을 위한 첫 아침 안내를 다시 볼 수 있어요. 지금 하던 판은 그대로 두고, 들녘의 새벽으로 돌아가 한 번 더 밟아요.</div><button class="mbtn b2" data-act="tut">첫 아침 다시 보기</button>'
      + '<label>이 데모에 대하여</label><div class="line">AI의 판단은 모두 임시 규칙이에요. 실제 모델은 아직 연결하지 않았어요. 숫자는 모두 임시예요. 내용 자료: 구역 ' + info.zones.length + '곳, 이웃 ' + info.species + '종' + (info.stubs ? ' (자료 없는 종 ' + info.stubs + ')' : '') + '. 간단한 모형: ' + (window.GD_SIMPLE ? '있음' : '없음(임시 덩어리로 보여요)') + '.</div></div>';
    UI.modal('설정', h, [['닫기']]);
    $('mb').onclick = e => {
      const d = e.target.dataset;
      if (d.q && d.q !== s.settings.quality) { s.settings.quality = d.q; s.settings.autoChecked = true; GD.state.saveNow(); location.reload(); }
      else if (d.snd) { s.settings.sound = d.snd === 'on'; if (GD.audio) GD.audio.setMute(!s.settings.sound); GD.state.save(); UI.close(); UI.settings(); }
      else if (d.look) { s.settings.look = +d.look; GD.state.save(); UI.close(); UI.settings(); }
      else if (d.act === 'export') GD.state.exportFile();
      else if (d.act === 'import') $('impf').click();
      else if (d.act === 'names') { s.keeper = $('setKeeper').value.trim().slice(0, 10) || '지킴이'; s.park = $('setPark').value.trim().slice(0, 14) || '깃들 보호구역'; GD.state.saveNow(); UI.toast('이름을 바꿨어요', s.park + ' · 지킴이 ' + s.keeper); UI.dirty(); }
      else if (d.act === 'tut') { UI.close(); GD.tut.start(true); }
      else if (d.act === 'reset') { UI.close(); UI.modal('처음부터 다시 할까요', '지금까지의 땅, 도감, 돈, 자리의 이름이 모두 지워져요. 되돌릴 수 없어요.', [['지우고 처음부터', () => { GD.state.reset(); GD.state.saveNow(); location.reload(); }, true], ['그만두기', null, false, true]]); }
    };
    $('impf').onchange = e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { GD.state.importText(rd.result); location.reload(); } catch (er) { UI.toast('불러오지 못했어요', er.message); } }; rd.readAsText(f); };
  };

  /* ================= 버튼과 키 ================= */
  UI.bind = function () {
    $('bDex').onclick = UI.dex; $('bMap').onclick = UI.map; $('bSet').onclick = UI.settings;
    $('bMode').onclick = () => GD.toggleMode(); $('bSleep').onclick = () => UI.sleep(false);
    $('bSit').onclick = () => GD.walk.setSit(!GD.walk.sit);
    window.addEventListener('keydown', e => {
      if (e.target && e.target.tagName === 'INPUT') { if (e.code === 'Enter' && open) { const b = $('mbtn').firstElementChild; if (b) b.click(); } return; }
      if ($('intro').style.display !== 'none') return;
      if (open) { if (e.code === 'Escape') { const bs = $('mbtn').children; if (bs.length === 1 && bs[0].textContent === '닫기') UI.close(); } return; }
      if (e.code === 'KeyM') GD.toggleMode();
      else if (e.code === 'KeyB') UI.dex();
      else if (e.code === 'KeyT') UI.map();
      else if (e.code === 'KeyZ') UI.sleep(false);
      else if (e.code === 'KeyC' && GD.view.mode === 'walk') GD.walk.setSit(!GD.walk.sit);
      else if (e.code === 'KeyN') { const s = S(); s.settings.sound = !s.settings.sound; if (GD.audio) GD.audio.setMute(!s.settings.sound); UI.toast(s.settings.sound ? '소리를 켰어요' : '소리를 껐어요'); }
    });
  };

  /* ================= 시작 화면 ================= */
  // 시작 화면: 제목과 부제, 시작하기. 새로 시작하면 이름 두 개를 짓는다(비워 두면 기본 이름).
  UI.intro = function (hasSave, onStart) {
    const box = $('introbtn'); box.innerHTML = '';
    const b = (label, fn, b2) => { const e = document.createElement('button'); e.textContent = label; if (b2) e.className = 'b2'; e.onclick = fn; box.appendChild(e); };
    const start = (fresh, names) => { $('intro').style.display = 'none'; document.body.classList.remove('pre'); SIM.paused = false; onStart(fresh, names); };
    const askNames = () => {
      $('introA').style.display = 'none'; $('introB').style.display = 'block'; $('nmKeeper').focus();
      const go = () => start(true, { keeper: $('nmKeeper').value.trim().slice(0, 10) || '지킴이', park: $('nmPark').value.trim().slice(0, 14) || '깃들 보호구역' });
      $('nmGo').onclick = go; $('nmKeeper').onkeydown = $('nmPark').onkeydown = e => { e.stopPropagation(); if (e.code === 'Enter') go(); };
    };
    if (hasSave) { const s = S(); b('이어서 하기', () => start(false)); let armed = false; b('처음부터 다시', e => { if (armed) { askNames(); return; } armed = true; e.target.textContent = '기록을 지우고 시작하려면 한 번 더 누르세요'; }, true); $('introsave').textContent = '저장된 기록: ' + (s.park ? s.park + ', ' : '') + s.year + '해째 ' + s.day + '일째, 돈 ' + s.money + '.'; }
    else { b('시작하기', askNames); $('introsave').textContent = GD.state.storageOk() ? '' : '이 브라우저는 저장소를 쓸 수 없어요. 설정에서 파일로 내보낼 수 있어요.'; }
  };
})();
