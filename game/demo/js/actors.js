/* 깃들 데모: 땅 위의 이웃
   오늘 와 있는 이웃을 3D로 세우고 움직인다.
   - 두루미, 황새, 큰고니: 그림에서 만든 모형(demo/models). 자세를 섞어 움직인다.
   - 나머지와 그래픽 '낮음': demo_models 의 간단한 모형(GD_SIMPLE). 그것도 없으면 여기 있는 임시 덩어리.
   이웃에게 직접 닿는 행동은 없다. 가까이 가면 경계하고, 더 가까이 가거나 뛰면 달아난다. */
(function () {
  const CFG = GD.CFG, U = GD.util, H = GD.hex, V = GD.vis, WL = V.WL, W3 = GD.w3;
  const A = GD.actors = { list: [] };
  const SCALE = 1 / 2.68;                 // 1m 가 땅에서 얼마인가 (두루미 1.5m = 0.56)
  const loads = [];
  A.ready = () => Promise.all(loads);

  /* ---------- 그림에서 만든 모형 ---------- */
  const MESHY = {};
  function meshy(name, order) {
    if (MESHY[name] !== undefined) return MESHY[name];
    const D = window[name]; if (!D || !D.poses || !D.poses.stand) return (MESHY[name] = null);
    const dec = (b, T) => { const bin = atob(b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new T(u.buffer); };
    const fp = o => { const a = dec(o.p, Int16Array), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] * D.scale; return new THREE.Float32BufferAttribute(f, 3); };
    const fn = o => { const a = dec(o.n, Int8Array), f = new Float32Array(a.length); for (let i = 0; i < a.length; i++) f[i] = a[i] / 127; return new THREE.Float32BufferAttribute(f, 3); };
    const g = new THREE.BufferGeometry(), P = D.poses, ks = (order || D.order).filter(k => P[k]);
    g.setAttribute('position', fp(P.stand)); g.setAttribute('normal', fn(P.stand));
    const u16 = dec(D.uv, Uint16Array), uv = new Float32Array(u16.length); for (let i = 0; i < u16.length; i++) uv[i] = u16[i] / 65535; g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(new THREE.BufferAttribute(dec(D.idx, Uint16Array), 1));
    g.morphAttributes.position = ks.map(k => fp(P[k])); g.morphAttributes.normal = ks.map(k => fn(P[k]));
    const m = new THREE.MeshStandardMaterial({ morphTargets: true, morphNormals: true, roughness: .72, envMapIntensity: .4 });
    loads.push(new Promise(res => new THREE.TextureLoader().load(D.tex, t => { t.flipY = false; t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; m.map = t; m.needsUpdate = true; res(); }, undefined, () => res())));
    return (MESHY[name] = { geo: g, mat: m, n: ks.length });
  }
  A.preload = function () {
    if (W3.Q.simple && window.GD_SIMPLE) return;      // 낮음: 무거운 모형을 올리지 않는다
    meshy('CRANE_M'); meshy('STORK_M'); meshy('SWAN_M', ['feed', 'alert', 'feedHalf', 'feedQ1', 'feedQ3']);
  };
  function meshyMesh(M, s) { const m = new THREE.Mesh(M.geo, M.mat); m.morphTargetInfluences = new Array(M.n).fill(0); m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.scale.setScalar(s); return m; }

  /* ---------- 간단한 모형이 없을 때의 임시 덩어리 ---------- */
  const BLOB = { bird: [.5, 0xe8e4da], fish: [.25, 0x8fa0a8], mammal: [.6, 0x8a6f52], crab: [.06, 0xb5694a], plant: [.6, 0x8a9c5a], person: [1.7, 0x6f8f6a] };
  function blob(kind) {
    const b = BLOB[kind] || BLOB.bird, g = new THREE.Group(), m = W3.mat(W3.HX(b[1]), { roughness: .8 });
    const body = new THREE.Mesh(W3.G.sph, m); body.scale.set(b[0] * .3, b[0] * .3, b[0] * .5); body.position.y = b[0] * (kind === 'fish' || kind === 'crab' ? .3 : .6); body.castShadow = true; g.add(body);
    if (kind !== 'fish' && kind !== 'crab' && kind !== 'plant') { const h = new THREE.Mesh(W3.G.sph, m); h.scale.setScalar(b[0] * .16); h.position.set(0, b[0] * .95, b[0] * .3); g.add(h); }
    return { group: g, height: b[0], length: b[0], update() { } };
  }
  function simple(id, kind, stage) {
    if (window.GD_SIMPLE && (!GD_SIMPLE.has || GD_SIMPLE.has(id))) { try { return GD_SIMPLE.make(id, { stage: stage || 1 }); } catch (e) { console.warn('[깃들] 간단한 모형을 만들지 못했어요', id, e); } }
    return blob(kind);
  }
  A.simple = simple;

  /* ---------- 어떻게 움직이는 이웃인가 ---------- */
  const MOVE = {   // 종마다의 움직임. 없으면 갈래(kind)로 정한다.
    crane: 'walker', stork: 'walker', swan: 'floater', mallard: 'floater', mandarin: 'floater', kestrel: 'hover',
    scopsowl: 'perch', hawkowl: 'perch', flyingsquirrel: 'perch', seal: 'lounger'
  };
  const KIND_MOVE = { bird: 'ground', mammal: 'ground', fish: 'swim', crab: 'ground', plant: 'plant', person: 'stand' };
  const COUNT = {  // 단계(들름, 머묾, 깃듦)에 따라 몇이 보이는가
    crane: [2, 3, 3], stork: [1, 1, 3], swan: [2, 2, 3], wfgoose: [3, 4, 6], beangoose: [2, 3, 4], mallard: [2, 3, 4], kestrel: [1, 1, 1],
    fish: [3, 4, 6], crab: [2, 3, 5], plant: [3, 5, 8], mammal: [1, 1, 2], bird: [1, 2, 3]
  };
  const isWater = (x, z, depth) => W3.inZone(x, z) && W3.sample(x, z) < WL - (depth || .035);
  const isLand = (x, z, wade) => { if (!W3.inZone(x, z) || W3.sample(x, z) < WL - (wade || .02)) return false; const t = W3.tileAt(x, z); return t !== 'house' && t !== 'greenhouse' && t !== 'pavilion'; };

  function clear(keep) { for (const a of A.list) { if (keep && keep.indexOf(a) >= 0) continue; W3.ACT.remove(a.obj); if (a.rings) a.rings.forEach(r => { W3.ACT.remove(r); r.geometry.dispose(); r.material.dispose(); }); } A.list.length = 0; if (keep) keep.forEach(a => A.list.push(a)); }

  function spawnOne(spId, kind, moveType, cell, i, stage, board, extra) {
    const c = H.centerK(cell), r = U.rng(U.hashStr(spId + cell) + i * 7 + GD.S.day);
    const a = Object.assign({ sp: spId, kind, move: moveType, cell, i, stage, zone: GD.S.zone, pitch: 0, state: 'idle', t: 1 + r() * 4, clock: r() * 5, yaw: r() * 6.283, wf: 0, wa: 0, walk: 0, ph: 0, calm: 0, alt: 0, gone: false, wary: CFG.wary[stage] || 1 }, extra || {});
    // 자리 잡기
    const ok = moveType === 'floater' ? (x, z) => isWater(x, z) : moveType === 'swim' ? (x, z) => isWater(x, z, .05) : moveType === 'walker' ? (x, z) => isLand(x, z, .1) : (x, z) => isLand(x, z);
    a.ok = ok; let x = c[0], z = c[1];
    for (let k = 0; k < 14; k++) { const ang = r() * 6.283, d = (k < 10 ? .12 + r() * .34 : r() * .15) * (i ? 1 : .5), px = c[0] + Math.cos(ang) * d, pz = c[1] + Math.sin(ang) * d; if (ok(px, pz)) { x = px; z = pz; break; } }
    a.x = x; a.z = z; a.home = { x: c[0], z: c[1] }; a.tx = x; a.tz = z; a.spot = { x, z };
    // 모형
    const useMeshy = !(W3.Q.simple && window.GD_SIMPLE) && !board;
    const M = useMeshy ? (spId === 'crane' ? meshy('CRANE_M') : spId === 'stork' ? meshy('STORK_M') : spId === 'swan' ? meshy('SWAN_M') : null) : null;
    if (M) {
      const s = spId === 'crane' ? [.56, .54, .5][i % 3] : spId === 'stork' ? .43 : [.273, .26, .25][i % 3];
      a.meshy = true; a.h = s; a.obj = meshyMesh(M, s); a.size = spId === 'swan' ? s * 1.6 : s;
      if (spId === 'swan') { a.rings = [.42 * s, .67 * s].map((rr, k) => { const o = new THREE.Mesh(new THREE.RingGeometry(rr - .004, rr + .004, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .34 - k * .14, depthWrite: false })); o.rotation.x = -Math.PI / 2; W3.ACT.add(o); return o; }); }
    } else {
      const mdl = simple(spId, kind, stage); a.mdl = mdl;
      const size = Math.max(mdl.height || .3, mdl.length || 0, .02);
      // 작은 이웃은 보이도록 키운다. 판 위(걷는 화면이 없는 구역)에서는 더 크게 보여 준다.
      let sc = SCALE; const min = board ? (kind === 'fish' ? .5 : .4) : (kind === 'fish' ? .22 : kind === 'crab' ? .1 : .15);
      if (size * sc < min) sc = min / size; if (board && kind !== 'plant') sc = Math.max(sc, Math.min(.55 / size, SCALE * 1.6));
      a.scale = sc; a.size = Math.max(mdl.height || .3, .03) * sc;
      const g = new THREE.Group(); g.rotation.order = 'YXZ'; mdl.group.scale.setScalar(sc); g.add(mdl.group); a.obj = g;
      g.traverse(o => { if (o.isMesh) { o.castShadow = kind !== 'fish'; o.frustumCulled = false; } });
    }
    // 나무 위에 앉는 이웃: 그 칸이나 이웃 칸의 나무를 골라 가지 높이에 앉힌다. 나무가 없으면 땅에 앉는다.
    if (moveType === 'perch') {
      let ts = W3.trees(cell); if (!ts.length) for (const nk of H.neighbors(cell)) { ts = W3.trees(nk); if (ts.length) break; }
      if (ts.length) { const t = ts[Math.floor(r() * ts.length)]; a.x = t[0] + t[3]; a.z = t[1] + t[4]; a.perchY = t[2]; a.yaw = Math.atan2(t[3], t[4]); }
    }
    W3.ACT.add(a.obj); A.list.push(a); place(a, 0); return a;
  }

  // 오늘 와 있고 지금 볼 수 있는 이웃을 세운다
  // reason 이 'arrive' 면(아침, 때가 바뀔 때) 새로 온 새는 날아와 내려앉고, 나올 때가 지난 새는 날아서 떠난다
  A.sync = function (reason) {
    const S = GD.S, zid = S.zone, z = GD.zone(zid), Z = S.z[zid], boardZone = !z.hasWalk, arrive = reason === 'arrive' && z.hasWalk;
    const prev = {}; A.list.forEach(a => { if (!a.gone && a.zone === zid) prev[a.sp] = 1; });
    const leave = arrive ? A.list.filter(a => !a.gone && a.zone === zid && a.state !== 'fly' && flies(a) && !a.intruder && !GD.sim.visible(zid, a.sp)) : [];
    clear(leave);
    leave.forEach(a => { const ang = Math.atan2(a.z, a.x) + (Math.random() - .5) * 1.2; startFly(a, Math.cos(ang), Math.sin(ang), true); });
    for (const spId in Z.here) {
      if (!GD.sim.visible(zid, spId)) continue;
      const sp = GD.SP[spId], h = Z.here[spId], stage = Math.max(1, GD.sim.stage(spId));
      const mv = MOVE[spId] || KIND_MOVE[sp.kind] || 'ground', n = (COUNT[spId] || COUNT[sp.kind] || [1, 1, 2])[stage - 1];
      for (let i = 0; i < n; i++) { const a = spawnOne(spId, sp.kind, mv, h.cell, i, stage, boardZone); if (arrive && !prev[spId] && !a.meshy && flies(a) && (mv === 'ground' || mv === 'floater' || mv === 'walker')) startLand(a); }
    }
    // 불청객과 손님
    if (Z.intruder) {
      const it = GD.INTRUDER[Z.intruder.id], cells = Object.keys(Z.tiles), r = U.rng(U.hashStr(it.id) + S.day);
      const want = { fish: ['pool', 'weir', 'riffle'], mammal: ['clearing'], plant: ['mud', 'mixed'] }[it.kind] || [];
      let cell = null; for (const w of want) { const c = cells.filter(k => Z.tiles[k] === w); if (c.length) { cell = c[Math.floor(r() * c.length)]; break; } }
      cell = cell || cells[Math.floor(r() * cells.length)];
      for (let i = 0; i < (it.kind === 'plant' ? 5 : 2); i++) spawnOne(it.id, it.kind, KIND_MOVE[it.kind] || 'ground', cell, i, 1, boardZone, { intruder: true });
    }
    if (Z.guest && Z.guest.state !== 'sent') {
      const hk = Object.keys(Z.tiles).find(k => Z.tiles[k] === 'house') || H.key(Z.rings, -Z.rings), nb = H.neighbors(hk).filter(k => Z.tiles[k] !== undefined && Z.tiles[k] !== 'water');
      if (nb.length) for (let i = 0; i < 2; i++) spawnOne('visitors', 'person', 'stand', nb[0], i, 1, boardZone, { guest: true });
    }
    GD.emit('actorsReady');
  };

  /* ---------- 움직임 ---------- */
  function place(a, dt) {
    const o = a.obj;
    if (a.meshy && a.sp === 'swan') {
      o.position.set(a.x, WL - .1 * a.h + Math.sin(a.clock * 1.3) * .003, a.z); o.rotation.y = a.yaw; o.rotation.z = Math.sin(a.clock * .9) * .012;
      if (a.rings) for (const r of a.rings) { r.position.set(a.x, WL + .003, a.z); r.visible = o.visible; }
    } else if (a.meshy) {
      o.position.set(a.x, W3.sample(a.x, a.z) - .004 + Math.abs(Math.sin(a.ph)) * .005 * a.walk + a.alt, a.z); o.rotation.y = a.yaw;
    } else {
      let y;
      if (a.baseY !== undefined && (a.state === 'fly' || a.state === 'land')) y = a.baseY;
      else if (a.perchY !== undefined) y = a.perchY;
      else if (a.move === 'floater') y = WL - .012 + Math.sin(a.clock * 1.3) * .003;
      else if (a.move === 'swim') y = WL - (a.size || .05) * .5 + Math.sin(a.clock * 1.7 + a.i) * .004;   // 등이 물 위로 조금 보인다
      else y = Math.max(W3.sample(a.x, a.z), a.move === 'plant' ? WL - .01 : -9) - .003;
      o.position.set(a.x, y + a.alt, a.z); o.rotation.y = a.yaw; o.rotation.x = a.pitch || 0; a.y0 = y;
    }
  }
  // 모형의 앞: 그림에서 만든 모형은 +X, 간단한 모형은 +Z
  const faceYaw = (a, mx, mz) => a.meshy ? Math.atan2(-mz, mx) : Math.atan2(mx, mz);
  function turn(a, ty, dt, rate) { let dy = ty - a.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); a.yaw += dy * Math.min(1, dt * rate); }
  function step(a, mx, mz, speed, dt, look, rate) {     // 막히면 옆으로 비켜 간다
    for (const ang of [0, .9, -.9, 1.7, -1.7]) {
      const dx = mx * Math.cos(ang) - mz * Math.sin(ang), dz = mx * Math.sin(ang) + mz * Math.cos(ang), nx = a.x + dx * speed * dt, nz = a.z + dz * speed * dt;
      if (a.ok(nx + dx * look, nz + dz * look)) { a.x = nx; a.z = nz; turn(a, faceYaw(a, dx, dz), dt, rate || 3.5); return true; }
    }
    return false;
  }
  function spook(a) { if (GD.sim.spooked(a.sp)) GD.emit('spooked', a.sp); }

  /* ---------- 날기 ----------
     간단한 모형의 새는 'fly' 모드에서 날개를 펴고 퍼덕인다. 방향과 높이는 여기서 옮긴다.
     그림에서 만든 모형(두루미, 황새, 큰고니)에는 나는 자세가 없어서, 날아오르는 순간 간단한 모형으로 바꾼다. */
  const flies = a => a.kind === 'bird' && !!window.GD_SIMPLE && (!GD_SIMPLE.has || GD_SIMPLE.has(a.sp)) && (!a.meshy || CFG.walk.heavyFly);
  function toSimple(a) {
    if (!a.meshy) return;
    const mdl = simple(a.sp, a.kind, a.stage), g = new THREE.Group(); g.rotation.order = 'YXZ';
    const sc = a.sp === 'swan' ? SCALE : a.h / Math.max(.2, mdl.height || 1);      // 선 키를 무거운 모형과 맞춘다
    mdl.group.scale.setScalar(sc); g.add(mdl.group); g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
    g.position.copy(a.obj.position); W3.ACT.remove(a.obj); if (a.rings) { a.rings.forEach(r => { W3.ACT.remove(r); r.geometry.dispose(); r.material.dispose(); }); a.rings = null; }
    a.y0 = a.sp === 'swan' ? WL - .012 : g.position.y - a.alt;
    a.obj = g; a.mdl = mdl; a.meshy = false; a.scale = sc; a.swapped = true; W3.ACT.add(g);
  }
  function startFly(a, dx, dz, leaving) {
    if (a.state === 'fly') return;
    a.leaving = !!leaving;
    toSimple(a);
    const l = Math.hypot(dx, dz) || 1, big = (a.mdl && a.mdl.height || .5) > .9;
    a.fx = dx / l; a.fz = dz / l; a.state = 'fly'; a.ft = 0; a.fv = .1; a.vmax = big ? 1.5 : 1.9; a.climb = big ? .5 : .7; a.land = null;
    a.baseY = (a.y0 !== undefined ? a.y0 : a.obj.position.y) ; a.obj.visible = true;
  }
  function updFly(a, dt) {                // 처음에는 낮게 달리듯 뜨고, 날갯짓이 붙으면 빠르게 올라간다
    a.ft += dt; a.fv = Math.min(a.vmax, a.fv + dt * 1.25);
    a.alt += dt * Math.min(a.climb, .06 + a.ft * a.climb * .55);
    a.x += a.fx * a.fv * dt; a.z += a.fz * a.fv * dt; turn(a, faceYaw(a, a.fx, a.fz), dt, 7);
    a.pitch += (-.26 - a.pitch) * Math.min(1, dt * 2.5); a.mode = 'fly';
    if (a.ft > (A.flyTime || 8) || Math.hypot(a.x, a.z) > W3.zoneR + 9) {
      a.gone = true; a.obj.visible = false;
      if (!a.leaving && !a.swapped) a.back = A.returnAfter || CFG.walk.returnAfter;     // 놀라서 날아간 새는 조용해지면 돌아온다
    }
  }
  function startLand(a) {                 // 멀리서 날아와 제자리에 내려앉는다
    const ang = Math.random() * 6.283, D = 3 + Math.random() * 1.5;
    a.land = { x0: a.x + Math.cos(ang) * D, z0: a.z + Math.sin(ang) * D, x1: a.x, z1: a.z, h: 1.3 + Math.random() * .6, t: -(a.i * .4 + Math.random() * .5), dur: 3.2 + Math.random() * .6 };
    a.baseY = a.y0; a.state = 'land'; a.x = a.land.x0; a.z = a.land.z0; a.alt = a.land.h; a.obj.visible = false;
  }
  function updLand(a, dt) {
    const L = a.land; L.t += dt; if (L.t < 0) return;
    const u = Math.min(1, L.t / L.dur), e = 1 - (1 - u) * (1 - u);
    a.obj.visible = true; a.x = L.x0 + (L.x1 - L.x0) * e; a.z = L.z0 + (L.z1 - L.z0) * e; a.alt = L.h * Math.pow(1 - u, 1.6);
    a.yaw = faceYaw(a, L.x1 - L.x0, L.z1 - L.z0); a.pitch = -.3 * U.sstep(.55, 1, u) * (1 - U.sstep(.93, 1, u)); a.mode = u < .94 ? 'fly' : 'idle';
    if (u >= 1) { a.state = 'idle'; a.t = 1 + Math.random() * 2; a.alt = 0; a.pitch = 0; a.land = null; }
  }

  function updWalker(a, dt, P) {          // 두루미와 황새
    const Wk = CFG.walk, quiet = P.still > 4, rA = quiet ? 0 : (P.fast ? Wk.alertRun : Wk.alert), rB = quiet ? .4 : (P.fast ? Wk.fleeRun : Wk.flee);
    const dx = a.x - P.x, dz = a.z - P.z, d = P.on ? Math.hypot(dx, dz) / a.wary : 99;
    let wantFeed = 0, wantAlert = 0, move = null, speed = 0; a.alt = 0;
    if (d < rB && P.fast && flies(a)) { spook(a); const sp2 = (a.i - 1) * .3; startFly(a, dx * Math.cos(sp2) - dz * Math.sin(sp2), dx * Math.sin(sp2) + dz * Math.cos(sp2)); return; }   // 뛰어오면 날아오른다
    if (d < rB) { a.state = 'away'; move = [dx / (d || 1), dz / (d || 1)]; speed = d < .45 ? .85 : .45; wantAlert = 1; a.calm = 3; spook(a); }
    else if (d < rA || a.calm > 0) { a.calm = d < rA ? Math.max(a.calm, 2) : a.calm - dt; wantAlert = 1; a.state = 'alert'; }
    else {
      if (a.state === 'alert' || a.state === 'away') { a.state = 'look'; a.t = 1.5; }
      if (a.t <= 0) {
        if (a.state === 'feed') {
          if (a.stage === 3 && a.sp === 'crane' && Math.random() < .35) { a.state = 'dance'; a.t = 4; }
          else if (Math.random() < .5) { a.state = 'look'; a.t = (a.stage === 1 ? 2.5 : 1.5) + Math.random() * 2.5; }
          else { a.state = 'stroll'; a.t = 7; const ang = Math.random() * 6.283, rr = .25 + Math.random() * .45; a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr; }
        } else { a.state = 'feed'; a.t = (a.stage === 1 ? 3 : 5) + Math.random() * 6; }
      }
      if (a.state === 'feed') wantFeed = .9 + .1 * Math.sin(a.clock * 4.6);
      if (a.state === 'dance') { wantAlert = .5 + .5 * Math.sin(a.clock * 5); a.alt = Math.abs(Math.sin(a.clock * 4.2)) * .05; a.yaw += dt * 1.4 * (a.i % 2 ? 1 : -1); }
      if (a.state === 'stroll') { const ex = a.tx - a.x, ez = a.tz - a.z, l = Math.hypot(ex, ez); if (l < .05) { a.state = 'feed'; a.t = 5 + Math.random() * 5; } else { move = [ex / l, ez / l]; speed = .15; } }
    }
    let moving = 0;
    if (move) { moving = step(a, move[0], move[1], speed, dt, .15) ? 1 : 0; if (!moving && a.state === 'stroll') { a.state = 'feed'; a.t = 4; } }
    a.wf += (wantFeed - a.wf) * Math.min(1, dt * 2); a.wa += (wantAlert - a.wa) * Math.min(1, dt * 3.2); a.walk += (moving - a.walk) * Math.min(1, dt * 6); if (moving) a.ph += dt * speed * 18.5;
    if (a.state === 'alert' && a.prev !== 'alert' && a.prev !== 'away' && a.sp === 'crane' && GD.audio) GD.audio.craneCall(a.x, a.z, .5);
    a.prev = a.state;
    if (a.meshy) {
      const sn = Math.sin(a.ph), inf = a.obj.morphTargetInfluences; inf[0] = a.wf * (1 - a.wa); inf[1] = a.wa; inf[2] = Math.max(0, sn) * a.walk; inf[3] = Math.max(0, -sn) * a.walk;
      if (inf.length > 6) { const f = inf[0], t = c => Math.max(0, 1 - Math.abs(f - c) * 4); inf[0] = Math.max(0, 4 * f - 3); inf[5] = t(.25); inf[4] = t(.5); inf[6] = t(.75); }
    } else a.mode = moving ? 'move' : wantAlert > .5 ? 'alert' : wantFeed ? 'feed' : 'idle';
  }
  function updFloater(a, dt, P) {         // 큰고니, 청둥오리, 원앙
    const dx = a.x - P.x, dz = a.z - P.z, d = P.on ? Math.hypot(dx, dz) / a.wary : 99, rA = P.fast ? CFG.walk.alertRun * .8 : 1.3, rB = P.fast ? CFG.walk.fleeRun * .8 : .9;
    let wantFeed = 0, wantAlert = 0, move = null, speed = 0;
    if (d < rB && P.fast && flies(a)) { spook(a); const sp2 = (a.i - 1) * .3; startFly(a, dx * Math.cos(sp2) - dz * Math.sin(sp2), dx * Math.sin(sp2) + dz * Math.cos(sp2)); return; }   // 뛰어오면 물을 차고 날아오른다
    if (d < rA) { a.state = 'alert'; wantAlert = 1; if (d < rB) { move = [dx / (d || 1), dz / (d || 1)]; speed = .1; spook(a); } a.t = 2; }
    else {
      if (a.state === 'alert') { a.state = 'float'; a.t = 1.5; }
      if (a.t <= 0) { if (a.state === 'dip') { a.state = 'float'; a.t = 5 + Math.random() * 6; const ang = Math.random() * 6.283, rr = .1 + Math.random() * .3; a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr; } else { a.state = 'dip'; a.t = 2.5 + Math.random() * 2.5; } }
      if (a.state === 'dip') wantFeed = .92 + .08 * Math.sin(a.clock * 3.1);
      if (a.state !== 'dip') { const ex = a.tx - a.x, ez = a.tz - a.z, l = Math.hypot(ex, ez); if (l > .04) { move = [ex / l, ez / l]; speed = .035; } }
    }
    let moving = false; if (move) moving = step(a, move[0], move[1], speed, dt, (a.h || .15) * .8, 1.2);
    a.wf += (wantFeed - a.wf) * Math.min(1, dt * 1.4); a.wa += (wantAlert - a.wa) * Math.min(1, dt * 2.5);
    if (a.meshy) { const f = a.wf * (1 - a.wa), inf = a.obj.morphTargetInfluences; inf[1] = a.wa; if (inf.length > 4) { const t = q => Math.max(0, 1 - Math.abs(f - q) * 4); inf[0] = Math.max(0, 4 * f - 3); inf[3] = t(.25); inf[2] = t(.5); inf[4] = t(.75); } else { inf[0] = Math.max(0, 2 * f - 1); if (inf.length > 2) inf[2] = f < .5 ? 2 * f : 2 * (1 - f); } }
    else a.mode = wantAlert > .5 ? 'alert' : wantFeed ? 'feed' : moving ? 'move' : 'idle';
  }
  function updGround(a, dt, P) {          // 기러기, 짐승, 게: 먹고, 살피고, 조금씩 옮겨 다닌다
    const Wk = CFG.walk, dx = a.x - P.x, dz = a.z - P.z, d = P.on ? Math.hypot(dx, dz) / a.wary : 99, quiet = P.still > 4;
    const rA = quiet ? .3 : (P.fast ? Wk.alertRun : Wk.alert), rB = quiet ? .3 : (P.fast ? Wk.fleeRun : Wk.flee);
    let move = null, speed = 0;
    if (d < rB) { spook(a); if (a.kind === 'bird') { const sp2 = ((a.i % 3) - 1) * .35; startFly(a, dx * Math.cos(sp2) - dz * Math.sin(sp2), dx * Math.sin(sp2) + dz * Math.cos(sp2)); return; } a.state = 'away'; move = [dx / (d || 1), dz / (d || 1)]; speed = a.kind === 'crab' ? .5 : .9; a.calm = 3; }
    else if (d < rA || a.calm > 0) { a.calm = d < rA ? Math.max(a.calm, 2) : a.calm - dt; a.state = 'alert'; if (P.on) turn(a, faceYaw(a, -dx, -dz) + (a.kind === 'bird' ? 1.2 : 0), dt, 2); }
    else {
      if (a.state === 'alert' || a.state === 'away') { a.state = 'idle'; a.t = 1.5; }
      if (a.t <= 0) {
        if (a.state === 'feed') { if (Math.random() < .5) { a.state = 'idle'; a.t = (a.stage === 1 ? 2.5 : 1.2) + Math.random() * 2; } else { a.state = 'stroll'; a.t = 6; const ang = Math.random() * 6.283, rr = .15 + Math.random() * .4; a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr; } }
        else if (a.state === 'rest') { a.state = 'feed'; a.t = 4 + Math.random() * 5; }
        else { a.state = a.stage >= 2 && Math.random() < .3 ? 'rest' : 'feed'; a.t = (a.stage === 1 ? 3 : 5) + Math.random() * 5; }
      }
      if (a.state === 'stroll') { const ex = a.tx - a.x, ez = a.tz - a.z, l = Math.hypot(ex, ez); if (l < .04) { a.state = 'feed'; a.t = 4 + Math.random() * 4; } else { move = [ex / l, ez / l]; speed = a.kind === 'crab' ? .1 : .13; } }
    }
    let moving = false; if (move) { moving = step(a, move[0], move[1], speed, dt, .08); if (!moving && a.state === 'stroll') { a.state = 'feed'; a.t = 3; } }
    a.mode = moving ? 'move' : a.state === 'alert' || a.state === 'away' ? 'alert' : a.state === 'feed' ? 'feed' : a.state === 'rest' ? 'rest' : 'idle';
  }
  function updSwim(a, dt, P) {            // 물고기: 물속을 천천히 돈다. 뛰어서 다가오면 흩어진다.
    if (P && P.on && P.fast) { const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz); if (d < 1.1) { spook(a); a.tx = a.x + dx / (d || 1) * .6; a.tz = a.z + dz / (d || 1) * .6; a.t = 2; } }
    if (a.t <= 0) { a.t = 2 + Math.random() * 4; const ang = Math.random() * 6.283, rr = .1 + Math.random() * .4; a.tx = a.home.x + Math.cos(ang) * rr; a.tz = a.home.z + Math.sin(ang) * rr; }
    const ex = a.tx - a.x, ez = a.tz - a.z, l = Math.hypot(ex, ez); let moving = false;
    if (l > .03) moving = step(a, ex / l, ez / l, .12, dt, .06, 2.5);
    a.mode = moving ? 'move' : 'idle';
  }
  function updHover(a, dt) {              // 황조롱이: 들판 위에 떠서 살핀다
    const s = a.stage, rr = s === 1 ? .0 : .5, w = s === 1 ? 0 : .35;
    a.orb = (a.orb || 0) + dt * w; a.x = a.home.x + Math.cos(a.orb) * rr; a.z = a.home.z + Math.sin(a.orb) * rr;
    const base = s === 1 ? .0 : 1.1;
    if (s === 3) { a.dive = (a.dive || 0) + dt; const c = a.dive % 14; a.alt = c > 12 ? base * (1 - Math.sin((c - 12) / 2 * Math.PI) * .8) : base; }
    else a.alt = base + Math.sin(a.clock * 1.1) * .04;
    if (w) a.yaw = faceYaw(a, -Math.sin(a.orb), Math.cos(a.orb));
    a.mode = s === 1 ? 'idle' : 'fly';      // 떠 있을 때는 날갯짓을 한다
  }
  function updStill(a, dt) { a.mode = a.kind === 'person' ? (Math.sin(a.clock * .4) > .3 ? 'alert' : 'idle') : (a.state === 'rest' ? 'rest' : 'idle'); if (a.t <= 0) { a.t = 6 + Math.random() * 6; a.state = a.state === 'rest' ? 'idle' : 'rest'; } }

  A.update = function (dt, P, t) {
    for (const a of A.list) {
      if (a.gone) {
        // 가만히 서 있거나 멀리 떨어져 있으면 제자리로 돌아와 내려앉는다
        if (a.back !== undefined) {
          if (!P.on || P.still > 1 || Math.hypot(P.x - a.spot.x, P.z - a.spot.z) > 3.2) a.back -= dt;
          if (a.back <= 0) { a.back = undefined; a.gone = false; a.x = a.spot.x; a.z = a.spot.z; a.alt = 0; a.pitch = 0; a.state = 'idle'; a.baseY = undefined; place(a, 0); startLand(a); }
        }
        continue;
      }
      a.clock += dt; a.t -= dt;
      if (a.state === 'fly') updFly(a, dt);
      else if (a.state === 'land') updLand(a, dt);
      else if (a.move === 'walker') updWalker(a, dt, P);
      else if (a.move === 'floater') updFloater(a, dt, P);
      else if (a.move === 'ground') updGround(a, dt, P);
      else if (a.move === 'swim') updSwim(a, dt, P);
      else if (a.move === 'hover') updHover(a, dt);
      else updStill(a, dt);
      if (a.gone) continue;
      place(a, dt);
      if (a.mdl && a.mdl.update && a.move !== 'plant') a.mdl.update(dt, a.clock, a.mode || 'idle');
      else if (a.mdl && a.mdl.update) a.mdl.update(dt, a.clock, 'idle');
    }
  };
  // 한 종이 지금 보이는가(달아나지 않았는가)
  A.present = spId => A.list.some(a => a.sp === spId && !a.gone);

})();
