/* 깃들 데모: 첫 아침 (처음 온 사람을 위한 안내)
   글로 길게 설명하지 않고 한 번에 하나씩 직접 해 보게 한다. 안내는 화면 아래에 한 줄만 뜬다.
   다음 차례로 넘어가는 것은 "다음" 버튼이 아니라 그 일을 실제로 했을 때다. 헤매면 잠시 뒤 귀띔으로 바뀐다.
   어디까지 했는지는 GD.S.tut 에 저장된다. 끝냈거나 건너뛰면 다시 나오지 않는다(설정에서 다시 볼 수 있다).
   첫 아침에 다루지 않는 것은 처음 마주칠 때 한 줄로 한 번만 알려 준다(아래 TIPS). */
(function () {
  const CFG = GD.CFG, SIM = GD.sim, U = GD.util, H = GD.hex;
  const TU = GD.tut = {};
  const $ = id => document.getElementById(id);
  const S = () => GD.S;
  const SP = 'wfgoose';            // 첫 아침에 만나는 이웃. 잦은 발길이라 반드시 나온다.
  let t = 0, yawAcc = 0, lastYaw = null, watched = false, glowEl = null, shown = '', btnFn = null, tipT = 0, tipUntil = 0, pollT = 0;

  TU.active = () => !!(S() && S().tut && !S().tut.done && S().tut.step > 0);
  // 첫 아침의 첫날에는 아침 소식을 띄우지 않는다. 둘째 날 아침에 처음 보여 준다.
  TU.quietMorning = () => { const s = S(); return !!(s && s.tut && !s.tut.done && s.tut.step < 7); };

  /* ---------- 화면 아래의 한 줄 ---------- */
  function say(line, btn, fn, tip) {
    const key = line + '|' + (btn || '') + '|' + (tip ? 1 : 0);
    if (key === shown) return; shown = key; btnFn = fn || null;
    const box = $('tut'); box.style.display = line ? 'flex' : 'none'; box.classList.toggle('tip', !!tip);
    $('tutline').textContent = line; $('tutbtn').style.display = btn ? '' : 'none'; $('tutbtn').textContent = btn || '';
    $('tutskip').style.display = tip ? 'none' : '';
  }
  function glow(id) { const e = id ? $(id) : null; if (e === glowEl) return; if (glowEl) glowEl.classList.remove('tutglow'); glowEl = e; if (e) e.classList.add('tutglow'); }
  function setStep(n) { S().tut.step = n; t = 0; enter(n); GD.state.save(); GD.ui.dirty(); }
  function setup() { GD.actors.returnAfter = 2.5; GD.actors.flyTime = 4; document.body.classList.toggle('tut', S().tut.step < 8); }
  function teardown() { GD.actors.returnAfter = null; GD.actors.flyTime = null; SIM.clockMax = null; document.body.classList.remove('tut'); glow(null); say(''); }

  function enter(n) {
    const s = S();
    SIM.clockMax = n < 7 ? SIM.phaseStart('dusk') - 4 : null;           // 차례를 다 밟기 전에는 해가 지지 않는다
    if (n === 2) { s.tut.px = GD.walk.pos.x; s.tut.pz = GD.walk.pos.z; }
    if (n === 2 && SIM.phase().id === 'dawn') s.clock = SIM.phaseStart('day') + .1;   // 날이 밝으면서 쇠기러기가 내려앉는다
    if (n === 7 && !SIM.canSleep()) s.clock = SIM.phaseStart('dusk') + .1;            // 해 질 녘부터만 잠들 수 있다
    document.body.classList.toggle('tut', n < 8);
  }

  /* ---------- 시작, 이어 하기, 끝 ---------- */
  TU.start = function (replay) {
    const s = S();
    s.tut = { done: false, step: 1, day0: s.day, year0: s.year, t0: (s.tally && s.tally.tiles) || 0, straw: '', ai: false, replay: !!replay };
    if (replay) {            // 설정의 '첫 아침 다시 보기': 지금 하던 판에서 들녘의 새벽으로 돌아가 다시 밟는다
      if (s.zone !== 'field') SIM.setZone('field');
      SIM.ensureHere('field', SP); delete s.today.watched[SP]; s.clock = 1; SIM.resetPhase(); GD.emit('phase', SIM.phase().id);
    }
    watched = false; yawAcc = 0; lastYaw = null;
    GD.walk.toSpawn(); GD.setMode('walk', true); setup(); setStep(1);
  };
  TU.resume = function () { if (!TU.active()) return; const s = S(); watched = !!(s.today.recToday[SP] || s.today.watched[SP]); setup(); t = 0; enter(s.tut.step); };
  TU.finish = function (skipped) {
    const s = S(); s.tut.done = true; s.tut.step = 0; teardown(); s.seen = s.seen || {}; if (!skipped) s.seen.news = 1; GD.state.saveNow(); GD.ui.dirty();
    if (skipped) GD.ui.toast('안내를 건너뛰었어요', '설정에서 첫 아침을 다시 볼 수 있어요.');
  };
  GD.on('record', o => { if (o.sp === SP) watched = true; });
  GD.on('watched', sp => { if (sp === SP) watched = true; });
  GD.on('aiPick', () => { if (TU.active()) S().tut.ai = true; });
  GD.on('mapOpen', () => { if (TU.active() && S().tut.step === 8) TU.finish(false); });

  /* ---------- 한 장면 ---------- */
  function geese() { return GD.actors.list.filter(a => a.sp === SP); }
  function whichWay(tx, tz) {       // 가야 할 곳이 보는 쪽에서 어디인가
    const W = GD.walk, vx = tx - W.pos.x, vz = tz - W.pos.z, l = Math.hypot(vx, vz) || 1, f = (-Math.sin(W.yaw) * vx - Math.cos(W.yaw) * vz) / l, r = (Math.cos(W.yaw) * vx - Math.sin(W.yaw) * vz) / l;
    return f > .8 ? '앞쪽' : f < -.5 ? '뒤쪽' : r > 0 ? '오른쪽' : '왼쪽';
  }
  TU.frame = function (dt) {
    const s = S(); if (!s || !s.started) return;
    if (!TU.active()) { tips(dt); return; }
    if (GD.ui.modalOpen()) return;
    t += dt;
    const st = s.tut.step, W = GD.walk, walk = GD.view.mode === 'walk', Z = s.z.field, name = GD.SP[SP].name;
    if (st === 1) {
      if (lastYaw !== null) yawAcc += Math.abs(W.yaw - lastYaw); lastYaw = W.yaw; glow(null);
      say(t < 14 ? '첫 아침이에요. 마우스를 움직여 들녘을 둘러보세요.' : '화면을 한 번 누르면 마우스로 둘러볼 수 있어요. 방향키 왼쪽과 오른쪽으로도 돌아요.');
      if (!walk) { say('M을 눌러 들녘으로 내려가 보세요.'); glow('bMode'); }
      else if (yawAcc > 1.1 || (W.moving && t > 1.5)) setStep(2);
    } else if (st === 2) {
      const h = Z.here[SP], c = h ? H.centerK(h.cell) : [0, 0], d = Math.hypot(c[0] - W.pos.x, c[1] - W.pos.z);
      if (!walk) { say('M을 눌러 들녘으로 내려가 보세요.'); glow('bMode'); }
      else { glow(null); say(t < 16 ? 'W A S D로 걸어서 볏짚이 놓인 논까지 가 보세요.' : '논은 ' + whichWay(c[0], c[1]) + '에 있어요. 그쪽으로 돌아서 W를 누르면 앞으로 걸어요.'); }
      // 몇 걸음이라도 직접 걸어서, 쇠기러기가 눈에 들어올 만한 거리까지 와야 넘어간다
      const walked = Math.hypot(W.pos.x - s.tut.px, W.pos.z - s.tut.pz);
      if (walk && walked > .9 && d < 3.2) setStep(3);
    } else if (st === 3 || st === 4) {
      const gs = geese(), up = gs.length && gs.every(a => a.gone || a.state === 'fly'), down = gs.filter(a => !a.gone && a.state !== 'fly' && a.state !== 'land');
      const near = down.some(a => Math.hypot(a.x - W.pos.x, a.z - W.pos.z) < 2.5);
      glow(null);
      if (st === 4 && watched) { setStep(5); return; }
      if (!walk) { say('M을 눌러 들녘으로 내려가 보세요.'); glow('bMode'); }
      else if (!gs.length) say('날이 밝으면 ' + U.josa(name, '이/가') + ' 논에 내려앉아요. 조금만 기다려 보세요.');
      else if (up) say(U.josa(name, '이/가') + ' 놀라 날아올랐어요. 가만히 서 있으면 다시 내려앉아요.');
      else if (st === 3) {
        say(t < 18 ? '논에 ' + name + ' 무리가 있어요. 자주 찾아오는 \'잦은 발길\'의 이웃이에요. 천천히 걸어서 다가가 보세요.' : '뛰거나 바짝 붙으면 날아올라요. Shift를 누르지 말고 ' + whichWay(gs[0].x, gs[0].z) + '으로 걸어가세요.');
        if (near && t > 4) setStep(4);          // '잦은 발길'을 읽을 틈을 준다
      } else say(t < 18 ? '몇 걸음 떨어져 멈추고, 화면 가운데의 점을 ' + name + '에 맞춘 채 가만히 바라보세요.' : '움직이지 않고 3초쯤 바라보면 도감에 적혀요. 멀면 조금 더 다가가고, 가까우면 한두 걸음 물러나세요.');
    } else if (st === 5) {
      glow('coin'); say('도감에 \'들름\'이 적혔어요. 왼쪽 위의 돈도 조금 늘었어요. 이웃을 지켜보면 이렇게 돌아오는 것이 있어요.');
      if (t > 7) setStep(6);
    } else if (st === 6) {
      const paints = ((s.tally && s.tally.tiles) || 0) - s.tut.t0;
      if (s.today.sold > 0 && !s.tut.straw) s.tut.straw = 'sold';
      if (walk) { glow('bMode'); say('이제 M을 눌러 땅을 가꾸러 가 보세요.'); }
      else if (paints < 2 && s.money >= 3) { glow('pal'); say(t < 25 ? '아래에서 칸을 하나 고르고, 땅의 육각형 칸을 눌러 두 칸을 바꿔 보세요. 한 칸에 돈 3이 들어요. (' + Math.max(0, paints) + ' / 2)' : '습지나 물을 고른 뒤 풀밭 칸을 눌러 보세요. 왼쪽 AI의 판단이 바로 달라져요. (' + Math.max(0, paints) + ' / 2)'); }
      else if (!s.tut.straw) { glow('pal'); say('\'벌이\'에서 볏짚 팔기를 골라 논을 누르면 돈을 받아요. 남겨 두면 이웃의 먹이가 돼요. 팔지 남길지 골라 보세요.', '남겨 둘게요', () => { s.tut.straw = 'left'; t = 0; GD.ui.toast('볏짚을 남겨 뒀어요', '기러기와 두루미가 낟알을 주워 먹어요.'); }); }
      else if (!s.tut.ai) { glow('ai'); say('왼쪽 \'AI의 판단\'에서 이웃 이름을 눌러 보세요. 무엇을 바꾸면 내일 올지 말해 줘요.'); }
      else setStep(7);
    } else if (st === 7) {
      if (s.day !== s.tut.day0 || s.year !== s.tut.year0) { setStep(8); return; }
      glow('bSleep'); say('해가 지고 있어요. 오른쪽 아래 \'잠자리에 들기\'로 오늘의 결산을 보고 잠드세요.');
    } else if (st === 8) {
      glow('bMap'); say('둘째 날 아침이에요. 위에 아침 소식이 떴어요. T를 누르면 지도가 보여요. 이제부터는 자유예요.');
      if (t > 18) TU.finish(false);
    }
  };

  /* ---------- 처음 마주칠 때 한 줄 (한 번만) ---------- */
  const near = (list, flag, r) => { const W = GD.walk; return GD.view.mode === 'walk' && list.some(o => !o[flag] && Math.hypot(o.x - W.pos.x, o.z - W.pos.z) < r); };
  const TIPS = [
    ['news', (s, Z) => s.today.news.length && (s.day > 1 || s.year > 1), '오른쪽 위의 오늘의 소식은 할 거리를 알려 줘요. 안 해도 되고 따로 받는 것은 없어요.'],
    ['trash', (s, Z) => near(Z.trash, 'got', 2.6), '검게 보이는 것은 날려 온 폐비닐이에요. 가까이 가면 주워요. 돈을 조금 받고 이웃도 편안해해요.'],
    ['trace', (s, Z) => near(Z.traces, 'found', 3), '반짝이는 것은 이웃이 남긴 흔적이에요. 가까이 가면 찾아져요. 도감에 적히고 AI가 더 자세히 말해 줘요.'],
    ['guest', (s, Z) => Z.guest && Z.guest.state === 'waiting', '손님이 왔어요. 오른쪽 위에서 받을지 돌려보낼지 골라요. 받으면 돈이 되지만 이웃의 편안함이 깎여요.'],
    ['intruder', (s, Z) => !!Z.intruder, '불청객이 들어왔어요. 내버려 두면 이웃의 편안함이 깎여요. 오른쪽 위에서 걷어 낼 수 있어요.'],
    ['care', (s, Z) => s.flags.careOpen, '푯말과 가림막을 살 수 있게 됐어요. \'돌봄\'에서 골라 칸에 놓으면 사람 발길이 줄어 이웃이 더 편히 머물러요.'],
    ['watergate', (s, Z) => TU.careTab && s.zone === 'field', '물꼬를 논에 놓으면 그 논에 물이 얕게 고여요. 두루미와 황새가 찾는 땅이에요.'],
    ['stay', (s, Z) => GD.zone(s.zone).species.some(sp => Z.here[sp.id] && SIM.stage(sp.id) === 2 && s.rec[sp.id] < 2), '머무는 이웃이 생겼어요. 다시 찾아가 바라보면 도감에 \'머묾\'이 적혀요.'],
    ['settled', (s, Z) => GD.zone(s.zone).species.some(sp => Z.here[sp.id] && SIM.stage(sp.id) === 3 && s.rec[sp.id] < 3), '깃든 이웃이 있어요. 찾아가 바라보면 그 자리에 이름을 지을 수 있어요. 이웃이 아니라 땅의 이름이에요.'],
    ['zone', (s, Z) => s.zone !== 'field', '구역마다 칸과 이웃이 달라요. 날과 돈은 모든 구역이 함께 써요. 지도(T)에서 오갈 수 있어요.']
  ];
  GD.on('palTab', tab => { if (tab === 'care') TU.careTab = true; });
  function tips(dt) {
    const s = S(); if (!s.today || GD.ui.modalOpen()) return;
    if (tipUntil > 0) { tipUntil -= dt; if (tipUntil <= 0) say(''); return; }
    pollT += dt; if (pollT < .5) return; pollT = 0;
    s.seen = s.seen || {}; const Z = s.z[s.zone];
    for (const [id, cond, text] of TIPS) {
      if (s.seen[id]) continue;
      let ok = false; try { ok = !!cond(s, Z); } catch (e) { ok = false; }
      if (ok) { s.seen[id] = 1; GD.state.save(); say(text, null, null, true); tipUntil = 10; return; }
    }
  }

  TU.bind = function () {
    $('tutskip').onclick = () => { if (TU.active()) TU.finish(true); };
    $('tutbtn').onclick = () => { if (btnFn) btnFn(); };
  };
})();
