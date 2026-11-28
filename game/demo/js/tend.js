/* 깃들 데모: 가꾸는 화면 (위에서 봄)
   구역이 큰 육각형으로 보인다. 칸을 눌러 바꾸고, 아이템과 꾸밈을 놓는다.
   걷는 화면이 아직 없는 구역(냇가, 숲, 바닷가)은 이 화면에서 이웃을 바라보고 흔적을 찾는다:
   이웃에 마우스를 가만히 올려 두면 바라보는 것이고, 옅은 고리(흔적)를 누르면 찾은 것이다. */
(function () {
  const CFG = GD.CFG, H = GD.hex, W3 = GD.w3, SIM = GD.sim, U = GD.util;
  const TD = GD.tend = { tool: null, hover: null, az: .677, zoom: 1, obs: 0, obsSp: null, lookT: {}, mouse: null };
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), pln = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3(), v3 = new THREE.Vector3();
  let lastKey = null, rotDrag = false;
  const active = () => GD.view && GD.view.mode === 'tend' && GD.view.tw >= 1 && !GD.ui.modalOpen() && GD.S.started;
  const isBoard = () => !GD.zone(GD.S.zone).hasWalk;

  TD.defaultTool = function () { const z = GD.zone(GD.S.zone); TD.tool = z.paintTiles.length ? { t: 'tile', id: (z.paintTiles.find(t => t.id !== z.base) || z.paintTiles[0]).id } : null; };

  // 위에서 내려다보는 카메라의 자리
  TD.camPose = function (pos, q) {
    const d = 4.15 * (W3.zoneR || 3.8) * TD.zoom, el = .54, asp = Math.max(1, 1.35 / Math.max(.5, W3.cam.aspect));
    pos.set(Math.sin(TD.az) * Math.cos(el) * d * asp, Math.sin(el) * d * asp, Math.cos(TD.az) * Math.cos(el) * d * asp);
    const c = W3.cam.clone(); c.position.copy(pos); c.lookAt(0, -.75, 0); q.copy(c.quaternion);
  };

  function cellAt(e) {
    const cv = W3.canvas, r = cv.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, W3.cam);
    if (!ray.ray.intersectPlane(pln, hit)) return null;
    const k = H.atK(hit.x, hit.z); return GD.S.z[GD.S.zone].tiles[k] !== undefined ? k : null;
  }
  function use(key) {
    if (!TD.tool) return;
    const res = SIM.apply(GD.S.zone, key, TD.tool);
    if (res.msg) GD.emit('toast', { msg: res.msg, sub: res.sub });
    if (res.ok) { if (GD.audio) GD.audio.tick(); GD.emit('ui'); }
  }
  function traceAt() {            // 누른 자리 가까이에 흔적이 있는가
    const Z = GD.S.z[GD.S.zone]; let best = -1, bd = .3;
    Z.traces.forEach((t, i) => { if (t.found) return; const d = Math.hypot(t.x - hit.x, t.z - hit.z); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  TD.bind = function () {
    const cv = W3.canvas;
    cv.addEventListener('pointermove', e => {
      TD.mouse = { x: e.clientX, y: e.clientY };
      if (!active()) { W3.showHover(null); TD.hover = null; return; }
      if (rotDrag) { TD.az -= e.movementX * .006; return; }
      const k = cellAt(e); TD.hover = k; W3.showHover(k);
      if (k && (e.buttons & 1) && TD.tool && (TD.tool.t === 'tile' || TD.tool.t === 'small') && k !== lastKey) { lastKey = k; use(k); }
    });
    cv.addEventListener('pointerdown', e => {
      if (!active()) return;
      if (e.button === 2 || e.button === 1) { rotDrag = true; return; }
      const k = cellAt(e); if (!k) return;
      if (isBoard()) { const i = traceAt(); if (i >= 0) { SIM.findTrace(GD.S.zone, i); return; } }
      lastKey = k; use(k);
    });
    window.addEventListener('pointerup', () => { rotDrag = false; lastKey = null; });
    cv.addEventListener('pointerleave', () => { W3.showHover(null); TD.hover = null; TD.mouse = null; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { if (!active()) return; e.preventDefault(); TD.zoom = U.clamp(TD.zoom * (e.deltaY > 0 ? 1.08 : .93), .45, 1.5); }, { passive: false });
  };

  // 한 장면: 카메라 돌리기와, 판 위에서 바라보기
  TD.update = function (dt) {
    if (!active()) { if (TD.obs) { TD.obs = 0; TD.obsSp = null; GD.emit('obs'); } return; }
    const keys = GD.walk.keys;
    if (keys.KeyQ || keys.ArrowLeft) TD.az += dt * 1.1; if (keys.KeyE || keys.ArrowRight) TD.az -= dt * 1.1;
    if (!isBoard() || !TD.mouse) { if (TD.obs) { TD.obs = 0; TD.obsSp = null; GD.emit('obs'); } return; }
    // 마우스에서 가장 가까운 이웃
    const cv = W3.canvas, r = cv.getBoundingClientRect(), zid = GD.S.zone; let any = null, bd = 46;
    for (const a of GD.actors.list) {
      if (a.gone || a.guest) continue;
      v3.set(a.x, a.obj.position.y + (a.size || .1) * .5, a.z).project(W3.cam);
      const sx = r.left + (v3.x * .5 + .5) * r.width, sy = r.top + (-v3.y * .5 + .5) * r.height, d = Math.hypot(sx - TD.mouse.x, sy - TD.mouse.y);
      if (d < bd) { bd = d; any = a; }
    }
    const before = TD.obs, beforeSp = TD.obsSp;
    if (any && any.intruder) { TD.pointAt = any.sp; }
    else TD.pointAt = null;
    const sp = any && !any.intruder ? any.sp : null, tgt = sp && SIM.canRecord(zid, sp) ? sp : null;
    if (tgt) { if (TD.obsSp !== tgt) { TD.obsSp = tgt; TD.obs = 0; } TD.obs += dt / CFG.walk.watchTime; if (TD.obs >= 1) { TD.obs = 0; TD.obsSp = null; SIM.record(tgt); } }
    else {
      TD.obs = Math.max(0, TD.obs - dt * .8); if (TD.obs === 0) TD.obsSp = null;
      if (sp && !GD.S.today.watched[sp]) { TD.lookT[sp] = (TD.lookT[sp] || 0) + dt; if (TD.lookT[sp] > 3) { TD.lookT[sp] = 0; if (SIM.watched(sp)) GD.emit('toast', { msg: '조용히 지켜봤어요', sub: U.josa(GD.SP[sp].name, '이/가') + ' 조금 더 편안해해요.' }); } }
    }
    if (before !== TD.obs || beforeSp !== TD.obsSp) GD.emit('obs');
  };
  GD.on('morning', () => { TD.lookT = {}; TD.obs = 0; TD.obsSp = null; GD.emit('obs'); });
})();
