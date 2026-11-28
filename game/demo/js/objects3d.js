/* 깃들 데모: 땅 위의 물건
   집, 비닐하우스, 아이템(물꼬, 푯말, 가림막, 쉴 자리 등), 꾸밈(돌담, 정자), 자리 이름 팻말, 솟대, 흔적, 폐비닐.
   개수가 적어서 바뀔 때마다 통째로 다시 놓는다. 모형은 모두 데모용 임시 모형이다. */
(function () {
  const W3 = GD.w3, H = GD.hex, U = GD.util, V = GD.vis, WL = V.WL;
  const C = W3.C, mat = W3.mat;
  let M = null, G = null;
  const own = [];          // 다시 놓을 때 버릴 것들
  const texCache = {};

  function init() {
    G = W3.G;
    M = {
      wood: mat(C(.54, .42, .27), { roughness: .9 }), dark: mat(C(.33, .23, .15)), board: mat(C(.95, .92, .83), { roughness: .8 }),
      wall: mat(C(.95, .92, .85)), stone: mat(C(.56, .54, .5), { flatShading: true }), tile: mat(C(.2, .21, .25), { roughness: .7 }),
      snow: mat(C(.87, .885, .92), { roughness: .85, envMapIntensity: .3 }), straw: mat(C(.82, .7, .4), { roughness: 1 }),
      house: mat(C(.96, .97, .95), { roughness: .32, transparent: true, opacity: .9, envMapIntensity: .9 }), rib: mat(C(.6, .64, .61), { roughness: .6 }),
      trash: mat(C(.17, .18, .2), { roughness: .5, flatShading: true }), print: mat(C(.25, .2, .16), { roughness: 1 }), white: mat(C(.95, .95, .93), { roughness: .8 }),
      pot: mat(C(.26, .17, .12), { roughness: .35, envMapIntensity: .9 }), green: mat(C(.4, .5, .3), { roughness: 1 }), net: mat(C(.42, .5, .55), { roughness: .8 }),
      glow: new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.35, .5) }),
      hint: new THREE.MeshBasicMaterial({ color: 0xfff2c4, transparent: true, opacity: .0, depthWrite: false, fog: false }),
      ring: new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: .75, depthWrite: false, fog: false, side: THREE.DoubleSide })
    };
    G.post = new THREE.CylinderGeometry(1, 1, 1, 6); G.post.translate(0, .5, 0);
    G.gh = new THREE.CylinderGeometry(.17, .17, .74, 14, 1, false, 0, Math.PI); G.gh.rotateZ(Math.PI / 2); G.gh.rotateY(Math.PI / 2);
    G.rib = new THREE.TorusGeometry(.172, .006, 4, 10, Math.PI);
    G.hintGeo = new THREE.OctahedronGeometry(.03, 0);
    G.ringGeo = new THREE.RingGeometry(.1, .13, 24); G.ringGeo.rotateX(-Math.PI / 2);
    G.hexRing = new THREE.RingGeometry(H.R * .86, H.R * .97, 6, 1, Math.PI / 6); G.hexRing.rotateX(-Math.PI / 2);
    G.hexFill = new THREE.CircleGeometry(H.R * .97, 6, Math.PI / 6); G.hexFill.rotateX(-Math.PI / 2);
    // 가꾸는 화면에서 마우스가 올라간 칸
    const hov = new THREE.Group();
    const a = new THREE.Mesh(G.hexRing, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .85, depthTest: false, fog: false }));
    const b = new THREE.Mesh(G.hexFill, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .16, depthTest: false, fog: false }));
    a.renderOrder = 999; b.renderOrder = 998; hov.add(a, b); hov.visible = false; W3.scene.add(hov); W3.hover = hov;
  }
  const add = (geo, m, x, y, z, parent, shadow) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = shadow !== false; o.receiveShadow = true; parent.add(o); return o; };
  const box = (w, h, d, m, x, y, z, parent) => { const o = add(G.box, m, x, y - h / 2, z, parent); o.scale.set(w, h, d); return o; };
  const post = (r, h, m, x, y, z, parent) => { const o = add(G.post, m, x, y, z, parent); o.scale.set(r, h, r); return o; };
  const ground = (x, z) => Math.max(W3.sample(x, z), WL);
  function groupAt(x, z, ry) { const g = new THREE.Group(); g.position.set(x, ground(x, z) - .008, z); g.rotation.y = ry || 0; W3.OBJ.add(g); return g; }

  /* ---------- 집 ---------- */
  function house(key) {
    const c = H.centerK(key), g = groupAt(c[0], c[1], .42); g.scale.setScalar(1.05);
    const b = (w, h, d, m, x, y, z) => box(w, h, d, m, x, y, z, g);
    b(.74, .04, .46, M.stone, 0, .02, 0); b(.66, .2, .38, M.wall, 0, .14, 0);
    [-.33, -.11, .11, .33].forEach(x => { b(.022, .2, .022, M.dark, x, .14, .19); b(.022, .2, .022, M.dark, x, .14, -.19); }); b(.68, .022, .022, M.dark, 0, .235, .19);
    b(.1, .15, .014, M.dark, 0, .115, .193);
    [-.22, .22].forEach(x => { const w = new THREE.Mesh(G.box, M.glow); w.scale.set(.11, .085, .012); w.position.set(x, .15 - .0425, .193); g.add(w); b(.13, .012, .016, M.dark, x, .15, .195); b(.012, .1, .016, M.dark, x, .15, .195); });
    const prism = (hw, hgt, len, m, y) => { const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, hgt); sh.closePath(); const ge = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }); ge.translate(0, 0, -len / 2); ge.rotateY(Math.PI / 2); own.push(ge); return add(ge, m, 0, y, 0, g); };
    prism(.3, .2, .86, M.tile, .24); if (GD.zone(W3.T.zone).cfg.snow) prism(.255, .185, .82, M.snow, .268);
    b(.05, .16, .05, M.wall, .2, .38, -.08);
    b(.52, .016, .1, M.dark, 0, .052, .25);
    [[-.5, .1, .045], [-.58, .02, .036], [-.48, -.02, .03]].forEach(([x, z, s]) => { const p = add(G.sph, M.pot, x, s * 1.05, z, g); p.scale.set(s, s * 1.15, s); });
  }
  function greenhouse(key) {
    const c = H.centerK(key), g = groupAt(c[0], c[1], 0);
    for (const dx of [-.19, .19]) { add(G.gh, M.house, dx, .0, 0, g); for (const dz of [-.36, -.12, .12, .36]) { const t = add(G.rib, M.rib, dx, 0, dz, g, false); } }
  }
  function pavilion(key) {
    const c = H.centerK(key), g = groupAt(c[0], c[1], .3);
    box(.46, .03, .46, M.dark, 0, .045, 0, g);
    for (const [x, z] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) post(.018, .3, M.dark, x, .04, z, g);
    const r = add(G.roof, M.tile, 0, .34, 0, g); r.scale.set(.42, .16, .42);
  }

  /* ---------- 아이템과 꾸밈 ---------- */
  const SLOT = [[.0, .34], [.3, -.17], [-.3, -.17], [.0, -.36], [.3, .17], [-.3, .17]];   // 한 칸에 여러 개가 놓일 때의 자리
  function item(id, key, slot) {
    const c = H.centerK(key), o = SLOT[slot % SLOT.length], x = c[0] + o[0], z = c[1] + o[1], g = groupAt(x, z, U.hashStr(key + id) % 6);
    if (id === 'watergate') { post(.012, .13, M.wood, -.06, 0, 0, g); post(.012, .13, M.wood, .06, 0, 0, g); box(.15, .016, .02, M.wood, 0, .135, 0, g); box(.1, .07, .012, M.dark, 0, .08, 0, g); }
    else if (id === 'sign') { post(.011, .2, M.wood, 0, 0, 0, g); const b = box(.13, .075, .012, M.board, 0, .225, 0, g); }
    else if (id === 'blind') { for (const px of [-.2, 0, .2]) post(.01, .26, M.wood, px, 0, 0, g); box(.44, .19, .012, M.straw, 0, .25, 0, g); }
    else if (id === 'rest') { const d = add(G.bale, M.straw, 0, .012, 0, g); d.scale.set(.15, .02, .15); for (let i = 0; i < 5; i++) { const a = i / 5 * 6.283; post(.006, .07, M.wood, Math.cos(a) * .17, 0, Math.sin(a) * .17, g); } }
    else if (id === 'nestbox') { post(.012, .3, M.wood, 0, 0, 0, g); box(.08, .1, .08, M.wood, 0, .38, 0, g); const h = add(G.sph, M.dark, 0, .34, .041, g, false); h.scale.set(.017, .017, .006); }
    else if (id === 'pathblock' || id === 'sandfence') { for (const px of [-.18, -.06, .06, .18]) post(.009, .14, M.wood, px, 0, 0, g); box(.42, .012, .012, M.wood, 0, .1, 0, g); box(.42, .012, .012, M.wood, 0, .14, 0, g); }
    else if (id === 'fishway') { for (let i = 0; i < 4; i++) box(.12, .02, .1, M.stone, 0, .02 + i * .022, -.15 + i * .1, g); }
    else if (id === 'bankgrass') { for (let i = 0; i < 9; i++) { const a = i * 2.4, r = .05 + (i % 3) * .05; const p = add(G.blade, M.green, Math.cos(a) * r, 0, Math.sin(a) * r, g, false); p.scale.set(.012, .16 + (i % 4) * .03, .012); p.rotation.z = (i % 3 - 1) * .2; } }
    else if (id === 'channelopen') { box(.3, .012, .05, M.net, 0, .02, 0, g); post(.008, .1, M.wood, -.15, 0, 0, g); post(.008, .1, M.wood, .15, 0, 0, g); }
    else { post(.011, .16, M.wood, 0, 0, 0, g); const s = add(G.sph, M.board, 0, .18, 0, g); s.scale.setScalar(.03); }
  }
  function wall(key, bagOut) {
    const c = H.centerK(key), r = U.rng(U.hashStr(key) + 3);
    for (let e = 0; e < 4; e++) {          // 여섯 변 가운데 네 변에 쌓는다
      const a0 = Math.PI / 180 * (30 + 60 * e), a1 = Math.PI / 180 * (90 + 60 * e), R2 = H.R * .93;
      for (let k = 0; k < 9; k++) for (let l = 0; l < 2; l++) {
        const t = (k + .5 * l) / 9, x = c[0] + (Math.cos(a0) * (1 - t) + Math.cos(a1) * t) * R2, z = c[1] + (Math.sin(a0) * (1 - t) + Math.sin(a1) * t) * R2, s = .024 + r() * .012;
        const o = add(G.rock, M.stone, x + (r() - .5) * .01, ground(x, z) + .016 + l * .034, z + (r() - .5) * .01, W3.OBJ); o.scale.set(s * 1.25, s * .9, s); o.rotation.set(r() * 3, r() * 3, r() * 3);
      }
    }
  }
  function nameTex(text) {
    if (texCache[text]) return texCache[text];
    const k = document.createElement('canvas'); k.width = 256; k.height = 96; const g = k.getContext('2d');
    g.fillStyle = '#f3ead4'; g.fillRect(0, 0, 256, 96); g.strokeStyle = '#8a6a45'; g.lineWidth = 6; g.strokeRect(3, 3, 250, 90);
    g.fillStyle = '#3d3a32'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 44; g.font = '600 ' + fs + 'px "Apple SD Gothic Neo","Noto Sans KR",sans-serif';
    while (g.measureText(text).width > 228 && fs > 18) { fs -= 2; g.font = '600 ' + fs + 'px "Apple SD Gothic Neo","Noto Sans KR",sans-serif'; }
    g.fillText(text, 128, 50);
    const t = new THREE.CanvasTexture(k); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; texCache[text] = t; return t;
  }
  function namePost(key, name) {          // 깃든 자리의 이름 팻말
    const c = H.centerK(key), x = c[0] + H.R * .42, z = c[1] + H.R * .42, g = groupAt(x, z, -.6);
    post(.013, .3, M.wood, -.11, 0, 0, g); post(.013, .3, M.wood, .11, 0, 0, g);
    box(.32, .12, .016, M.wood, 0, .33, 0, g);
    const m = new THREE.MeshStandardMaterial({ map: nameTex(name), roughness: .85 }); own.push(m);
    for (const s of [1, -1]) { const p = new THREE.Mesh(G.plane || (G.plane = new THREE.PlaneGeometry(.3, .1)), m); p.position.set(0, .27, s * .009); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
  }
  function sotdae(zoneId) {               // 구역을 완성하면 서는 솟대
    const Z = GD.S.z[zoneId]; let key = Object.keys(Z.tiles).find(k => Z.tiles[k] === 'house');
    const c = key ? H.centerK(key) : H.center(Z.rings, -Z.rings), x = c[0] - H.R * .5, z = c[1] + H.R * .45, g = groupAt(x, z, .5);
    post(.016, .95, M.wood, 0, 0, 0, g);
    const b = add(G.sph, M.wood, .02, .98, 0, g); b.scale.set(.095, .04, .04);
    const hd = add(G.sph, M.wood, .12, 1.02, 0, g); hd.scale.setScalar(.028);
  }

  /* ---------- 흔적과 폐비닐 ---------- */
  W3.traceObj = []; W3.trashObj = [];
  function trace(t, i, board) {
    const g = groupAt(t.x, t.z, U.hashStr(t.sp + i) % 6); g.userData = { i };
    if (t.what === 'footprint') for (let k = 0; k < 4; k++) { const p = add(G.sph, M.print, (k % 2 ? .02 : -.02), .004, -.09 + k * .06, g, false); p.scale.set(.016, .004, .022); }
    else if (t.what === 'feather') { const p = add(G.sph, M.white, 0, .01, 0, g, false); p.scale.set(.012, .004, .06); p.rotation.y = .5; const q = post(.002, .05, M.white, 0, .008, .03, g); q.rotation.x = Math.PI / 2; }
    else if (t.what === 'dropping') for (let k = 0; k < 3; k++) { const p = add(G.sph, M.white, (k - 1) * .03, .006, (k % 2) * .025, g, false); p.scale.set(.018, .006, .015); }
    else if (t.what === 'tower') for (let k = 0; k < 7; k++) { const a = k * 2.2, r = k < 5 ? .05 : .015; const p = add(G.rock, M.stone, Math.cos(a) * r, .02 + (k >= 5 ? .03 : 0), Math.sin(a) * r, g, false); p.scale.setScalar(.028); }
    else { const p = add(G.sph, M.print, 0, .006, 0, g, false); p.scale.set(.04, .005, .04); }
    // 걷는 화면: 가까이 가면 옅게 반짝인다. 걷는 화면이 없는 구역: 판 위에 옅은 고리로 보인다.
    if (board) { const r = new THREE.Mesh(G.ringGeo, M.ring); r.position.y = .07; r.renderOrder = 5; g.add(r); g.userData.ring = r; }
    else { const h = new THREE.Mesh(G.hintGeo, M.hint.clone()); own.push(h.material); h.position.y = .16; g.add(h); g.userData.hint = h; }
    W3.traceObj[i] = g;
  }
  function trash(t, i) { const g = groupAt(t.x, t.z, i * 1.7); const o = add(G.rock, M.trash, 0, .02, 0, g); o.scale.set(.075, .022, .055); g.userData = { i }; W3.trashObj[i] = g; }

  /* ---------- 다시 놓기 ---------- */
  W3.rebuildObjects = function () {
    if (!M) init();
    for (const o of W3.OBJ.children.slice()) W3.OBJ.remove(o);
    own.forEach(o => o.dispose && o.dispose()); own.length = 0; W3.traceObj = []; W3.trashObj = [];
    const zoneId = W3.T.zone, z = GD.zone(zoneId), Z = GD.S.z[zoneId], s = GD.S;
    for (const key in Z.tiles) { const t = Z.tiles[key]; if (t === 'house') house(key); else if (t === 'greenhouse') greenhouse(key); else if (t === 'pavilion') pavilion(key); }
    for (const key in Z.items) { let k = 0; for (const id in Z.items[key]) item(id, key, k++); }
    for (const key in Z.decor) if (Z.decor[key] === 'wall') wall(key);
    for (const sp in s.names) { const nm = s.names[sp]; if (nm.zone === zoneId && Z.tiles[nm.cell] !== undefined) namePost(nm.cell, nm.name); }
    if (Z.done) sotdae(zoneId);
    Z.traces.forEach((t, i) => { if (!t.found) trace(t, i, !z.hasWalk); });
    Z.trash.forEach((t, i) => { if (!t.got) trash(t, i); });
  };
  // 흔적의 반짝임: 가까울수록 또렷하다
  W3.objectsFrame = function (t, px, pz, walking) {
    for (let i = 0; i < W3.traceObj.length; i++) {
      const g = W3.traceObj[i]; if (!g) continue;
      if (g.userData.hint) { const d = Math.hypot(g.position.x - px, g.position.z - pz), h = g.userData.hint; h.visible = walking && d < 3.2; if (h.visible) { h.material.opacity = (1 - d / 3.2) * (.45 + .25 * Math.sin(t * 3 + i)); h.position.y = .16 + Math.sin(t * 1.7 + i) * .015; h.rotation.y = t; } }
      if (g.userData.ring) { g.userData.ring.scale.setScalar(1 + .12 * Math.sin(t * 2.4 + i)); }
    }
  };
  W3.showHover = function (key, ok) { if (!W3.hover) return; if (!key) { W3.hover.visible = false; return; } const c = H.centerK(key); W3.hover.position.set(c[0], .2, c[1]); W3.hover.visible = true; W3.hover.children[0].material.color.set(ok === false ? 0xffb4a0 : 0xffffff); };
  W3.initObjects = init;
})();
