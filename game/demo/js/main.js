/* 깃들 데모: 시작과 한 장면씩 도는 고리
   파일들을 잇는 곳이다. 화면 바꾸기(걷기와 가꾸기), 구역 옮기기, 초당 장면 수 재기, 개발 스위치. */
(function () {
  const CFG = GD.CFG, W3 = GD.w3, SIM = GD.sim, WK = GD.walk, TD = GD.tend, UI = GD.ui, A = GD.actors;
  const $ = id => document.getElementById(id);
  const view = GD.view = { mode: 'tend', tw: 1, to: 'tend' };
  const from = { pos: new THREE.Vector3(), q: new THREE.Quaternion(), fov: 29 }, toP = new THREE.Vector3(), toQ = new THREE.Quaternion(), fpE = new THREE.Euler(0, 0, 0, 'YXZ');
  const hash = location.hash || '';

  function setBody() { document.body.classList.toggle('walk', view.mode === 'walk'); document.body.classList.toggle('tend', view.mode !== 'walk'); }
  function setMode(mode, instant) {
    const z = GD.zone(GD.S.zone); if (mode === 'walk' && !z.hasWalk) mode = 'tend';
    view.mode = mode; GD.S.mode = mode;
    if (mode === 'walk') { WK.ensure(); W3.setMode('walk'); } else { WK.unlock(); WK.setSit(false); W3.showHover(null); }
    if (instant) { view.tw = 1; W3.setMode(mode); } else { view.tw = 0; from.pos.copy(W3.cam.position); from.q.copy(W3.cam.quaternion); from.fov = W3.cam.fov; }
    setBody(); UI.dirty();
  }
  GD.setMode = setMode;
  GD.toggleMode = function () {
    if (view.tw < 1 || UI.modalOpen() || !GD.S.started) return;
    const z = GD.zone(GD.S.zone);
    if (view.mode === 'tend' && !z.hasWalk) { UI.toast('이 구역의 걷는 화면은 준비 중이에요', '가꾸는 화면에서 이웃을 바라보고 흔적을 찾을 수 있어요.'); return; }
    setMode(view.mode === 'walk' ? 'tend' : 'walk'); if (view.mode === 'walk') WK.lock();
  };
  GD.goZone = function (zoneId) { if (zoneId === GD.S.zone) return; UI.fadeTo(() => { SIM.setZone(zoneId); }); };

  /* ---------- 알림을 받아 3D 를 맞춘다 ---------- */
  function refreshWorld(reason) { W3.rebuildObjects(); A.sync(reason); UI.dirty(); }
  GD.on('land', o => { if (o.zone !== GD.S.zone) return; W3.updateCells(o.all ? null : o.keys); W3.rebuildObjects(); });
  GD.on('objects', () => W3.rebuildObjects());
  GD.on('actors', () => A.sync());
  GD.on('phase', () => A.sync('arrive'));
  GD.on('morning', () => {
    refreshWorld('arrive');
    const z = GD.zone(GD.S.zone);
    if (z.hasWalk && GD.S.day + GD.S.year > 2) { WK.toSpawn(); setMode('walk', true); } else if (!z.hasWalk) setMode('tend', true);
  });
  GD.on('zone', zoneId => { W3.build(zoneId); TD.defaultTool(); TD.az = .677; TD.zoom = 1; WK.toSpawn(); setMode('tend', true); refreshWorld(); UI.toast(GD.zone(zoneId).name + '에 왔어요', GD.zone(zoneId).hasWalk ? '' : '이 구역은 가꾸는 화면에서 이웃을 만나요.'); });
  W3.canvas = $('c');
  $('c').addEventListener('click', () => { if (view.mode === 'walk' && view.tw >= 1 && !UI.modalOpen()) WK.lock(); });

  /* ---------- 초당 장면 수 ---------- */
  const fps = GD.fps = { now: 0, n: 0, t: 0, worst: 0, log: [], show: /fps|dev/.test(hash) };
  function fpsFrame(dtReal) {
    fps.n++; fps.t += dtReal; fps.worst = Math.max(fps.worst, dtReal);
    if (fps.t >= 1) {
      fps.now = Math.round(fps.n / fps.t); fps.log.push(fps.now); if (fps.log.length > 30) fps.log.shift();
      if (fps.show) { const st = W3.stats(); $('fps').style.display = 'block'; $('fps').textContent = '초당 ' + fps.now + '장면 · 가장 느린 장면 ' + Math.round(fps.worst * 1000) + 'ms\n그리기 ' + st.calls + '번 · 세모 ' + Math.round(st.tris / 1000) + '천 · ' + CFG.quality[st.quality].name + ' · 화소 배율 ' + st.dpr.toFixed(2); }
      const e = $('fpsnow'); if (e) e.textContent = fps.now;
      fps.n = 0; fps.t = 0; fps.worst = 0; autoCheck();
    }
  }
  let autoT = 0;
  function autoCheck() {      // 처음 몇 초가 느리면 그래픽을 낮추자고 묻는다
    const s = GD.S; if (!s.started || s.settings.autoChecked || document.hidden) return;
    autoT++; if (autoT < 7) return;
    const last = fps.log.slice(-5), avg = last.reduce((a, b) => a + b, 0) / last.length;
    s.settings.autoChecked = true; GD.state.save();
    const order = ['high', 'mid', 'low'], i = order.indexOf(s.settings.quality);
    if (avg >= CFG.autoLowerFps || i >= 2) return;
    // 창이 가려져 있어도 장면 수가 떨어진다. 장면 하나를 그리는 데 걸리는 시간을 직접 재서, 정말 느릴 때만 묻는다.
    const ms = W3.bench(6); fps.benchMs = ms;
    if (1000 / ms < CFG.autoLowerFps * 1.4) UI.modal('화면이 끊기나요', '지금 초당 ' + Math.round(avg) + '장면이에요. 그래픽을 ' + CFG.quality[order[i + 1]].name + '으로 낮추면 더 부드러워져요. 설정에서 언제든 바꿀 수 있어요.', [['낮추기', () => { s.settings.quality = order[i + 1]; GD.state.saveNow(); location.reload(); }], ['그대로 두기']]);
  }

  /* ---------- 한 장면 ---------- */
  let last = performance.now(), saveT = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const real = (now - last) / 1000, dt = Math.min(.05, real); last = now;
    step(dt); fpsFrame(real);
  }
  function step(dt) {
    const S = GD.S, started = S.started && S.today;
    if (started) SIM.tick(dt);
    const P = WK.update(dt);
    A.update(dt, P, W3.uTime.value);
    if (started) { WK.interact(dt); TD.update(dt); GD.tut.frame(dt); }
    W3.setTime(S.clock / CFG.dayLen);
    // 카메라
    const walk = view.mode === 'walk';
    if (walk) { fpE.set(WK.pitch, WK.yaw, 0, 'YXZ'); toQ.setFromEuler(fpE); toP.set(WK.pos.x, WK.eyeY, WK.pos.z); } else TD.camPose(toP, toQ);
    const toF = walk ? 52 : 29, cam = W3.cam;
    if (view.tw < 1) {
      view.tw = Math.min(1, view.tw + dt / 1.4); const e = view.tw * view.tw * (3 - 2 * view.tw);
      cam.position.lerpVectors(from.pos, toP, e); cam.quaternion.copy(from.q).slerp(toQ, e); cam.fov = from.fov + (toF - from.fov) * e; cam.updateProjectionMatrix();
      if (!walk && e > .3 && W3.mode !== 'tend') W3.setMode('tend');
      if (view.tw >= 1) UI.dirty();
    } else { cam.position.copy(toP); cam.quaternion.copy(toQ); if (cam.fov !== toF) { cam.fov = toF; cam.updateProjectionMatrix(); } }
    // 걷는 화면이 있는 구역에서는 위에서 볼 때 이웃을 보여 주지 않는다. 어디에 있는지는 걸어서 찾는다.
    const z = GD.zone(S.zone);
    W3.ACT.visible = !z.hasWalk || walk || view.tw < 1;
    W3.objectsFrame(W3.uTime.value, WK.pos.x, WK.pos.z, walk || !z.hasWalk);
    if (GD.audio) GD.audio.frame(dt, walk && view.tw >= 1, WK.moving, WK.bob, WK.pos, WK.yaw, WK.eyeY);
    W3.render(dt);
    if (started) { UI.frame(); saveT += dt; if (saveT > 10) { saveT = 0; GD.state.save(); } }
  }
  GD.step = step;

  /* ---------- 개발 스위치: 주소 끝에 #dev 를 붙이면 보인다 ---------- */
  const DEV = GD.dev = {
    on: /dev/.test(hash),
    speed(v) { SIM.devSpeed = v; },
    toPhase(id) { GD.S.clock = SIM.phaseStart(id) + 1; },
    nextMorning(force) { const r = SIM.nextMorning({ force: !!force }); if (r === 'yearEnd') return r; return r; },
    money(n) { GD.S.money += n || 100; UI.dirty(); },
    comfort(n) { const S = GD.S, Z = S.z[S.zone]; for (const id in Z.here) S.comfort[id] = Math.min(100, (S.comfort[id] || 0) + (n || 50)); UI.dirty(); },
    openAll() { const S = GD.S; GD.ZONES.forEach(z => { if (z.ready && S.z[z.id]) S.z[z.id].open = true; }); S.flags.allOpen = true; GD.state.save(); UI.dirty(); },
    // 시험용: 지금 구역의 와 있는 이웃을 모두 바로 바라본 것으로 친다
    watchAll() { const S = GD.S, out = []; for (const id in S.z[S.zone].here) { if (SIM.canRecord(S.zone, id)) out.push(SIM.record(id)); else SIM.watched(id); } return out; },
    bench(n) { return W3.bench(n || 40); }
  };
  function devPanel() {
    if (!DEV.on) return; const d = $('dev'); d.style.display = 'block';
    d.innerHTML = '<b>개발 스위치</b><br>' + [['x1', 'speed', 1], ['x10', 'speed', 10], ['x60', 'speed', 60], ['해 질 녘으로', 'toPhase', 'dusk'], ['밤으로', 'toPhase', 'night'], ['다음 아침', 'nextMorning', 0], ['모두 오게', 'nextMorning', 1], ['돈 +100', 'money', 100], ['편안함 +50', 'comfort', 50], ['모두 열기', 'openAll', 0]]
      .map(b => '<button data-f="' + b[1] + '" data-a="' + b[2] + '">' + b[0] + '</button>').join('');
    d.onclick = e => { const f = e.target.dataset.f; if (!f) return; const a = e.target.dataset.a; DEV[f](isNaN(+a) ? a : +a); UI.dirty(); };
  }

  /* ---------- 시작 ---------- */
  function boot() {
    if (!window.THREE) { $('err').textContent = '3D 라이브러리(three.js)를 불러오지 못했어요. 인터넷에 연결돼 있는지 확인해 주세요.'; return; }
    const hasSave = GD.state.load() && GD.S.started && GD.S.today;
    const qm = hash.match(/q=(low|mid|high)/); if (qm) GD.S.settings.quality = qm[1];
    W3.init($('c'), GD.S.settings.quality); W3.initObjects(); A.preload();
    if (/noui/.test(hash)) document.body.classList.add('noui');
    W3.build(GD.S.zone); W3.rebuildObjects();
    UI.bind(); TD.bind(); GD.tut.bind(); TD.defaultTool(); devPanel();
    WK.toSpawn(); setMode('tend', true); SIM.paused = true;
    UI.intro(hasSave, (fresh, names) => {
      if (fresh || !hasSave) {
        GD.state.reset(); GD.S.started = true; if (names) { GD.S.keeper = names.keeper; GD.S.park = names.park; }
        W3.build(GD.S.zone); TD.defaultTool();
        if (/notut/.test(hash)) GD.S.tut.done = true;      // 시험용: 안내 없이 시작한다
        SIM.startDay({ ensure: ['wfgoose'] });      // 첫 아침에는 잦은 발길의 쇠기러기가 반드시 나온다
        if (!GD.S.tut.done) GD.tut.start(false);
      }
      else { GD.S.started = true; SIM.resetPhase(); refreshWorld(); if (GD.S.mode === 'walk' && GD.zone(GD.S.zone).hasWalk) setMode('walk', true); UI.toast(GD.S.year + '해째 ' + GD.S.day + '일째를 이어서 해요'); GD.tut.resume(); }
      UI.dirty();
    });
    if (/auto/.test(hash)) { $('introbtn').firstElementChild.click(); if ($('introB').style.display === 'block') $('nmGo').click(); }     // 시험용: 시작 화면을 건너뛴다
    A.ready().then(() => { last = performance.now(); requestAnimationFrame(frame); });
  }
  boot();
})();
