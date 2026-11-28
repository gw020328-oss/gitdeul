/* 깃들 데모: 걷는 화면 (1인칭)
   W A S D 로 걷고, Shift 로 뛴다. 화면을 한 번 누르면 마우스를 누르지 않고도 시점이 돈다(Esc 로 푼다).
   마우스 잠금이 안 되는 환경이면, 누르지 않고 움직이기만 해도 시점이 돈다.
   가만히 서서 이웃을 바라보면 도감에 적힌다. 흔적과 폐비닐은 가까이 가면 줍는다. C 로 앉아서 바라보면 시간이 빨리 간다. */
(function () {
  const CFG = GD.CFG, H = GD.hex, V = GD.vis, WL = V.WL, W3 = GD.w3, SIM = GD.sim, Wk = CFG.walk;
  const WK = GD.walk = { pos: { x: 0, z: 0 }, yaw: 0, pitch: -.04, eyeY: .5, bob: 0, stillT: 0, sit: false, sitK: 0, obs: 0, obsSp: null, lookT: {}, keys: {}, locked: false, freeLook: false, moving: false, fast: false };
  const keys = WK.keys;
  const active = () => GD.view && GD.view.mode === 'walk' && GD.view.tw >= 1 && !GD.ui.modalOpen() && GD.S.started;

  /* ---------- 서는 자리 ---------- */
  function canStand(x, z) {
    if (!W3.inZone(x, z) || W3.sample(x, z) < WL - .16) return false;
    const k = H.atK(x, z), t = GD.S.z[W3.T.zone].tiles[k];
    if (t === 'house' || t === 'greenhouse' || t === 'pavilion') { const c = H.centerK(k); if (Math.hypot(x - c[0], z - c[1]) < H.R * .62) return false; }
    return true;
  }
  WK.toSpawn = function () {
    const z = GD.zone(GD.S.zone), Z = GD.S.z[z.id]; let best = null, bd = 1e9;
    const want = H.centerK(z.cfg.spawn || '0,0');
    for (const k in Z.tiles) { const c = H.centerK(k); if (!canStand(c[0], c[1]) || W3.sample(c[0], c[1]) < WL + .01) continue; const d = Math.hypot(c[0] - want[0], c[1] - want[1]); if (d < bd) { bd = d; best = c; } }
    best = best || want; WK.pos.x = best[0]; WK.pos.z = best[1];
    WK.yaw = Math.atan2(WK.pos.x, WK.pos.z); WK.pitch = -.04; WK.eyeY = Math.max(W3.sample(WK.pos.x, WK.pos.z), WL) + Wk.eye;
  };
  WK.ensure = function () { if (!canStand(WK.pos.x, WK.pos.z)) WK.toSpawn(); };

  /* ---------- 시점 ---------- */
  const look = (dx, dy) => { const k = .0026 * (GD.S.settings.look || 1); WK.yaw -= dx * k; WK.pitch = Math.max(-1.1, Math.min(1.1, WK.pitch - dy * k)); };
  // 마우스 잠금을 건다. 안 되면(막힌 환경, Esc 직후 등) 잠금 없이 움직이기만 해도 도는 방식으로 바꾸고, 다음에 누를 때 다시 걸어 본다.
  WK.lock = function () {
    const cv = W3.canvas; if (WK.locked) return;
    if (!cv.requestPointerLock) { WK.freeLook = true; return; }
    try { const p = cv.requestPointerLock(); if (p && p.catch) p.catch(() => { WK.freeLook = true; GD.emit('look'); }); } catch (e) { WK.freeLook = true; }
  };
  WK.unlock = function () { if (document.pointerLockElement) document.exitPointerLock(); };
  document.addEventListener('pointerlockchange', () => { WK.locked = document.pointerLockElement === W3.canvas; if (WK.locked) WK.freeLook = false; GD.emit('look'); });
  document.addEventListener('pointerlockerror', () => { WK.freeLook = true; GD.emit('look'); });
  window.addEventListener('mousemove', e => {
    if (!active()) return;
    if (WK.locked) look(e.movementX, e.movementY);
    else if ((WK.freeLook && e.target === W3.canvas) || (e.buttons & 1 && e.target === W3.canvas)) look(e.movementX, e.movementY);
  });
  window.addEventListener('keydown', e => { keys[e.code] = true; });
  window.addEventListener('keyup', e => { keys[e.code] = false; });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

  /* ---------- 앉아서 바라보기 ---------- */
  WK.setSit = function (on) {
    if (WK.sit === on) return; WK.sit = on; SIM.speed = on ? CFG.sitSpeed : 1; GD.emit('sit', on);
  };

  /* ---------- 한 장면 ---------- */
  WK.update = function (dt) {
    const on = active(), pos = WK.pos; let mv = false;
    if (on) {
      if (keys.ArrowLeft || keys.KeyQ) WK.yaw += dt * 1.5; if (keys.ArrowRight || keys.KeyE) WK.yaw -= dt * 1.5;
      const f = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0), sd = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0);
      WK.fast = !!(keys.ShiftLeft || keys.ShiftRight);
      if (f || sd) {
        if (WK.sit) WK.setSit(false);
        const dx = -Math.sin(WK.yaw) * f + Math.cos(WK.yaw) * sd, dz = -Math.cos(WK.yaw) * f - Math.sin(WK.yaw) * sd, l = Math.hypot(dx, dz), sp = (WK.fast ? Wk.run : Wk.speed) * dt;
        const tryMove = (nx, nz) => { if (!canStand(nx, nz)) return false; for (const a of GD.actors.list) { if (a.gone || a.move === 'hover' || a.move === 'swim' || a.move === 'plant' || a.state === 'fly' || a.state === 'land') continue; const d1 = Math.hypot(a.x - nx, a.z - nz); if (d1 < .34 && d1 < Math.hypot(a.x - pos.x, a.z - pos.z)) return false; } pos.x = nx; pos.z = nz; return true; };
        if (tryMove(pos.x + dx / l * sp, pos.z + dz / l * sp) || tryMove(pos.x + dx / l * sp, pos.z) || tryMove(pos.x, pos.z + dz / l * sp)) { mv = true; WK.bob += dt * (WK.fast ? 11 : 7); }
      }
    }
    WK.moving = mv; WK.stillT = mv ? 0 : WK.stillT + dt;
    WK.sitK += ((WK.sit ? 1 : 0) - WK.sitK) * Math.min(1, dt * 4);
    const target = Math.max(W3.sample(pos.x, pos.z), WL) + Wk.eye - WK.sitK * .22 + Math.sin(WK.bob) * .006;
    WK.eyeY += (target - WK.eyeY) * Math.min(1, dt * 8);
    return { x: pos.x, z: pos.z, on: on, still: WK.stillT, fast: WK.fast && mv };
  };

  // 줍기와 바라보기. 한 일이 있으면 알림으로 내보낸다.
  WK.interact = function (dt) {
    if (!active()) { if (WK.obs) { WK.obs = 0; WK.obsSp = null; GD.emit('obs'); } return; }
    const S = GD.S, zid = S.zone, Z = S.z[zid], pos = WK.pos;
    Z.trash.forEach((t, i) => { if (!t.got && Math.hypot(t.x - pos.x, t.z - pos.z) < Wk.pick) { if (SIM.pickTrash(zid, i)) GD.emit('toast', { msg: '폐비닐을 주웠어요 · 돈 +' + CFG.income.trash, sub: '들판이 깨끗해졌어요. 와 있는 이웃이 조금 더 편안해해요.' }); } });
    Z.traces.forEach((t, i) => { if (!t.found && Math.hypot(t.x - pos.x, t.z - pos.z) < Wk.pick) SIM.findTrace(zid, i); });
    // 바라보기: 가만히 서서 이웃 쪽을 보고 있어야 한다
    let tgt = null, any = null;
    if (WK.stillT > .4) {
      const fx = -Math.sin(WK.yaw), fz = -Math.cos(WK.yaw); let bd = 99;
      for (const a of GD.actors.list) {
        if (a.gone || a.intruder || a.guest || a.state === 'away' || a.state === 'fly') continue;
        const dx = a.x - pos.x, dz = a.z - pos.z, d = Math.hypot(dx, dz), range = Wk.watchRange * (a.move === 'floater' || a.move === 'hover' ? 1.25 : 1);
        if (d < range && d < bd && (dx * fx + dz * fz) / (d || 1) > .86) { bd = d; any = a.sp; tgt = SIM.canRecord(zid, a.sp) ? a.sp : null; }
      }
    }
    const before = WK.obs, beforeSp = WK.obsSp;
    if (tgt) { if (WK.obsSp !== tgt) { WK.obsSp = tgt; WK.obs = 0; } WK.obs += dt / Wk.watchTime; if (WK.obs >= 1) { WK.obs = 0; WK.obsSp = null; SIM.record(tgt); } }
    else {
      WK.obs = Math.max(0, WK.obs - dt * .8); if (WK.obs === 0) WK.obsSp = null;
      if (any && !S.today.watched[any]) { WK.lookT[any] = (WK.lookT[any] || 0) + dt; if (WK.lookT[any] > 3) { WK.lookT[any] = 0; if (SIM.watched(any)) GD.emit('toast', { msg: '조용히 지켜봤어요', sub: GD.util.josa(GD.SP[any].name, '이/가') + ' 조금 더 편안해해요.' }); } }
    }
    if (before !== WK.obs || beforeSp !== WK.obsSp) GD.emit('obs');
  };
  GD.on('morning', () => { WK.lookT = {}; WK.obs = 0; WK.obsSp = null; WK.setSit(false); GD.emit('obs'); });
  GD.on('zone', () => { WK.obs = 0; WK.obsSp = null; GD.emit('obs'); });
  // 앉아서 시간을 보내다가 해가 지면 일어선다. 잠자리에 들지, 더 있을지는 그때 정한다.
  GD.on('phase', ph => { if (ph === 'dusk' && WK.sit) WK.setSit(false); });
})();
