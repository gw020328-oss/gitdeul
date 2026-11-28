/*
 * 깃들 데모: 간단한 3D 모형 (코드로만 그린다)
 *
 *   window.GD_SIMPLE.ids               41개 id (이웃 36종 + 불청객 5종)
 *   window.GD_SIMPLE.make(id, opts)    { group, height, update(dt, t, mode), ... }
 *
 * 규칙
 *  - 전역 THREE(r128)만 쓴다. 텍스처와 바깥 파일은 없다. 색은 꼭짓점 색으로만 준다.
 *  - 1 단위 = 1 m. 발밑 가운데가 원점, 위가 +Y, 앞이 +Z.
 *  - 한 모형은 삼각형 400개 안쪽이다.
 *  - mode: "idle", "feed", "alert", "move", "rest", 그리고 새만 "fly"(날개를 펴고 퍼덕임)
 *  - opts.stage: 1 들름, 2 머묾, 3 깃듦. 풀은 자란 정도(싹, 자람, 군락)로 쓴다.
 *
 * 크기: 종마다 대략의 실제 크기(미터)에 맞춘다. 값은 README.md에 있다.
 */
(function () {
"use strict";
const T = window.THREE;
if (!T) { console.error("GD_SIMPLE: THREE(r128)가 필요합니다"); return; }

const PI = Math.PI, sin = Math.sin, cos = Math.cos, abs = Math.abs, exp = Math.exp;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function mix(a, b, t) {
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t)),
        g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t)),
        l = Math.round(lerp(a & 255, b & 255, t));
  return (r << 16) | (g << 8) | l;
}
function rng(seed) { // 같은 id는 늘 같은 모양이 되도록 쓰는 난수
  let a = seed | 0;
  return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const damp = (cur, tgt, dt, rate) => cur + (tgt - cur) * (1 - exp(-dt * rate));

/* ---------- 색 (게임과 같게 sRGB 입력을 선형으로 바꿔 꼭짓점 색에 넣는다) ---------- */
const _cc = {};
function colr(h) { return _cc[h] || (_cc[h] = new T.Color(h).convertSRGBToLinear()); }

let _MAT = null;
function material() {
  return _MAT || (_MAT = new T.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.93, metalness: 0, side: T.DoubleSide }));
}

/* ---------- 삼각형 모으는 틀 ---------- */
const _v = new T.Vector3(), _e = new T.Euler(), _q = new T.Quaternion(), _s1 = new T.Vector3(1, 1, 1), _p = new T.Vector3();
function mat4(pos, rot) {
  const m = new T.Matrix4();
  _e.set(rot ? rot[0] : 0, rot ? rot[1] : 0, rot ? rot[2] : 0, "YXZ");
  _q.setFromEuler(_e);
  return m.compose(_p.set(pos ? pos[0] : 0, pos ? pos[1] : 0, pos ? pos[2] : 0), _q, _s1);
}

class Part {
  constructor() { this.p = []; this.c = []; this.n = 0; }
  P(m, x, y, z, i, a) { _v.set(x, y, z); if (m) _v.applyMatrix4(m); return [_v.x, _v.y, _v.z, i || 0, a || 0]; }
  vtx(v, color) {
    this.p.push(v[0], v[1], v[2]);
    const k = colr(typeof color === "function" ? color(v[0], v[1], v[2], v[3], v[4]) : color);
    this.c.push(k.r, k.g, k.b);
  }
  tri(a, b, c, color) { this.vtx(a, color); this.vtx(b, color); this.vtx(c, color); this.n++; }
  quad(a, b, c, d, color) { this.tri(a, b, c, color); this.tri(a, c, d, color); }
  // 타원체. 극이 z축. c 중심, r 반지름 [x,y,z]
  ell(c, r, o) {
    o = o || {};
    const w = o.w || 8, h = o.h || 5, m = mat4(c, o.rot), a0 = o.a0 || 0, rings = [];
    for (let i = 0; i <= h; i++) {
      const ph = PI * i / h, z = cos(ph) * r[2], rr = sin(ph), ring = [];
      if (i === 0 || i === h) ring.push(this.P(m, 0, 0, z, i, 0));
      else for (let j = 0; j < w; j++) { const th = 2 * PI * j / w + a0; ring.push(this.P(m, rr * cos(th) * r[0], rr * sin(th) * r[1], z, i, th)); }
      rings.push(ring);
    }
    this._join(rings, w, o.col);
    return this;
  }
  _join(rings, n, col) {
    for (let i = 0; i < rings.length - 1; i++) {
      const A = rings[i], B = rings[i + 1];
      for (let j = 0; j < n; j++) {
        const j2 = (j + 1) % n;
        if (A.length === 1) this.tri(A[0], B[j2], B[j], col);
        else if (B.length === 1) this.tri(A[j], A[j2], B[0], col);
        else this.quad(A[j], A[j2], B[j2], B[j], col);
      }
    }
  }
  // 로프트. st: [{z, rx, ry, cx, cy}] 을 z 방향으로 잇는다
  loft(st, o) {
    o = o || {};
    const n = o.n || 6, m = o.m || mat4(o.pos, o.rot), a0 = o.a0 || 0, rings = [];
    st.forEach((s, i) => {
      const cx = s.cx || 0, cy = s.cy || 0, ring = [];
      if (s.rx < 1e-5 && s.ry < 1e-5) ring.push(this.P(m, cx, cy, s.z, i, 0));
      else for (let j = 0; j < n; j++) { const th = 2 * PI * j / n + a0; ring.push(this.P(m, cx + s.rx * cos(th), cy + s.ry * sin(th), s.z, i, th)); }
      rings.push(ring);
    });
    this._join(rings, n, o.col);
    if (o.cap !== false) [0, rings.length - 1].forEach(k => {
      const R = rings[k]; if (R.length < 2) return;
      const s = st[k], c = this.P(m, s.cx || 0, s.cy || 0, s.z, k, 0);
      for (let j = 0; j < n; j++) this.tri(c, R[j], R[(j + 1) % n], o.col);
    });
    return this;
  }
  // 두 점 사이의 굵기가 변하는 관
  tube(a, b, r0, r1, o) {
    o = o || {};
    const d = _v.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]), L = d.length();
    _q.setFromUnitVectors(new T.Vector3(0, 0, 1), d.clone().normalize());
    const m = new T.Matrix4().compose(new T.Vector3(a[0], a[1], a[2]), _q.clone(), new T.Vector3(1, 1, 1));
    const sy = o.sy || 1;
    return this.loft([{ z: 0, rx: r0, ry: r0 * sy }, { z: L, rx: r1, ry: r1 * sy }], { n: o.n || 5, col: o.col, cap: o.cap !== undefined ? o.cap : false, m, a0: o.a0 });
  }
  // 볼록한 평면 조각 (지느러미, 잎, 귀 같은 납작한 것)
  poly(pts, col) {
    for (let i = 1; i < pts.length - 1; i++) this.tri(this.P(null, pts[0][0], pts[0][1], pts[0][2], 0, 0), this.P(null, pts[i][0], pts[i][1], pts[i][2], 0, 0), this.P(null, pts[i + 1][0], pts[i + 1][1], pts[i + 1][2], 0, 0), col);
    return this;
  }
  // 겉에 얹는 작은 무늬(점). 중심 c, 바깥 방향 nrm, 크기 s
  patch(c, nrm, s, col, k) {
    const n = new T.Vector3(nrm[0], nrm[1], nrm[2]).normalize();
    const u = new T.Vector3().crossVectors(n, new T.Vector3(0, 1, 0)); if (u.length() < 0.1) u.set(1, 0, 0); u.normalize();
    const w = new T.Vector3().crossVectors(n, u).normalize();
    const e = k === undefined ? 0.0015 : k, sx = s, sy = s * 0.85;
    const pt = (a, b) => [c[0] + n.x * e + u.x * a * sx + w.x * b * sy, c[1] + n.y * e + u.y * a * sx + w.y * b * sy, c[2] + n.z * e + u.z * a * sx + w.z * b * sy, 0, 0];
    this.quad(pt(-1, -1), pt(1, -1), pt(1, 1), pt(-1, 1), col);
    return this;
  }
  build() {
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(this.p, 3));
    g.setAttribute("color", new T.Float32BufferAttribute(this.c, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    const m = new T.Mesh(g, material());
    m.castShadow = true;
    m.userData.tris = this.n;
    return m;
  }
}
const part = () => new Part();
function G(parent, x, y, z) { const g = new T.Group(); g.position.set(x || 0, y || 0, z || 0); if (parent) parent.add(g); return g; }
function put(parent, p, x, y, z, rot) { const m = p.build(); m.position.set(x || 0, y || 0, z || 0); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); parent.add(m); return m; }

/* 꼭짓점이 놓인 자리를 단면 위에서 구하는 도움 함수 (무늬 점을 몸 겉에 놓을 때 쓴다) */
function stAt(st, z) {
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1], lo = Math.min(a.z, b.z), hi = Math.max(a.z, b.z);
    if (z >= lo && z <= hi) {
      const t = (z - a.z) / ((b.z - a.z) || 1);
      return { rx: lerp(a.rx, b.rx, t), ry: lerp(a.ry, b.ry, t), cx: lerp(a.cx || 0, b.cx || 0, t), cy: lerp(a.cy || 0, b.cy || 0, t) };
    }
  }
  const e = z < st[0].z === st[0].z < st[st.length - 1].z ? st[0] : st[st.length - 1];
  return { rx: e.rx, ry: e.ry, cx: e.cx || 0, cy: e.cy || 0 };
}
function surf(st, z, th, out) {
  const s = stAt(st, z), c = cos(th), n = sin(th);
  const nn = new T.Vector3(c / Math.max(s.rx, 1e-4), n / Math.max(s.ry, 1e-4), 0).normalize();
  return { p: [s.cx + s.rx * c, s.cy + s.ry * n, z], n: [nn.x, nn.y, nn.z] };
}

/* ---------- 모형을 마무리: 실제 크기에 맞추고 몸을 감싼다 ---------- */
function measure(obj) {
  obj.updateMatrixWorld(true);
  const box = new T.Box3(), v = new T.Vector3();
  obj.traverse(o => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); box.expandByPoint(v); }
  });
  return box;
}
function countTris(obj) { let n = 0; obj.traverse(o => { if (o.isMesh) n += o.geometry.attributes.position.count / 3; }); return n; }

/*
 * inner: 모양을 잡은 그룹(대충의 크기). cal: ["y"|"z"|"x", 미터]. 이 값으로 한 번에 같은 비율로 키운다.
 * upd(dt,t,mode): 움직임. extra: 모형에 더 붙일 것.
 */
function finish(id, inner, cal, upd, extra) {
  const group = new T.Group();
  group.name = "gd_" + id;
  group.add(inner);
  const bb = measure(inner), sz = bb.getSize(new T.Vector3());
  const cur = cal[0] === "y" ? sz.y : cal[0] === "z" ? sz.z : sz.x;
  const s = cal[1] / cur;
  inner.scale.setScalar(s);
  inner.position.y = -bb.min.y * s;
  const model = Object.assign({
    id, group, height: sz.y * s, length: sz.z * s, width: sz.x * s, tris: Math.round(countTris(inner)),
    update(dt, t, mode) { upd(clamp(dt || 0, 0, 0.1), t || 0, mode || "idle"); },
    dispose() { inner.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  }, extra || {});
  return model;
}

/* ====================================================================== */
/*                                 새                                      */
/* ====================================================================== */

// 부리: st 는 [길이 비율, 가로 반지름, 세로 반지름], 길이 len, 단면 n, 아래로 휜 정도 drop
function beakFn(len, st, cols, n, drop, z0f) {
  return (P, hr) => {
    const z0 = hr * (z0f || 1.25);
    P.loft(st.map(s => ({ z: z0 + s[0] * len, rx: s[1], ry: s[2], cy: -(drop || 0) * s[0] * s[0] * len })),
      { n: n || 4, col: Array.isArray(cols) ? ((x, y, z, i) => cols[Math.min(i, cols.length - 1)]) : cols });
  };
}

function legPart(len, r, col, toe) {
  const P = part();
  P.tube([0, 0, 0], [0, -len, 0], r, r * 0.7, { n: 4, col });
  if (toe) {
    const y = -len + 0.002;
    P.poly([[0, y, -toe * 0.15], [toe * 0.75, y, toe * 0.6], [0, y, toe * 1.15], [-toe * 0.75, y, toe * 0.6]], col);
  }
  return P;
}

function buildBird(S, ctl) {
  const O = S.cols, root = new T.Group(), air = G(root);
  const hip = S.hip, torso = G(air, 0, hip, 0), tilt = G(torso);
  tilt.rotation.x = -S.pitch;

  // 몸통
  const body = part();
  body.ell([0, 0, 0], [S.bw, S.bh, S.bl], { w: S.seg || 8, h: 5, col: O.body });
  if (S.bodyX) S.bodyX(body, S);
  put(tilt, body);

  // 꼬리
  const tl = S.tail.l, tw = S.tail.w;
  const tailG = G(tilt, 0, S.bh * 0.12, -S.bl * 0.86); tailG.rotation.x = S.tail.ang || 0;
  const tp = part();
  tp.loft([{ z: tl * 0.1, rx: tw * 0.35, ry: 0.004 }, { z: -tl * 0.5, rx: tw * 0.6, ry: 0.006 }, { z: -tl, rx: tw * (S.tail.tip || 0.5), ry: 0.004 }], { n: 4, col: O.tail });
  put(tailG, tp);

  // 날개 (접은 모양)
  const wing = S.wing, wings = [], spreads = [];
  [1, -1].forEach(sd => {
    const wg = G(tilt, sd * S.bw * 0.8, S.bh * 0.28, S.bl * (wing.z === undefined ? 0.3 : wing.z));
    const sg = G(wg); // 접은 날개를 옆으로 펼치는 마디 (wg 는 위아래로 퍼덕이는 마디)
    const wp = part();
    wp.loft([{ z: wing.l * 0.25, rx: wing.t * 0.6, ry: wing.h * 0.5 }, { z: 0, rx: wing.t, ry: wing.h }, { z: -wing.l * 0.5, rx: wing.t, ry: wing.h * 0.85 }, { z: -wing.l, rx: wing.t * 0.3, ry: wing.h * 0.1 }],
      { n: 5, col: O.wing || O.body });
    if (wing.x) wing.x(wp, wing);
    put(sg, wp, 0, -wing.h * 0.15, 0);
    wings.push(wg); spreads.push(sg);
  });
  if (S.sail) S.sail(tilt, S);

  // 목 (두 마디) 과 머리
  const [L1, L2] = S.neck.l, [r0, r1, r2] = S.neck.r;
  const n1 = G(tilt, 0, S.bh * 0.4, S.bl * 0.72); n1.rotation.order = "YXZ";
  const n2 = G(n1, 0, L1, 0);
  const hd = G(n2, 0, L2, 0);
  const np1 = part(); np1.tube([0, 0, 0], [0, L1, 0], r0, r1, { n: S.neck.n || 5, col: O.neck1 || O.neck, cap: true });
  put(n1, np1);
  const np2 = part(); np2.tube([0, 0, 0], [0, L2, 0], r1, r2, { n: S.neck.n || 5, col: O.neck2 || O.neck, cap: true });
  put(n2, np2);
  const hr = S.head.r, hp = part();
  hp.ell([0, 0, hr * 0.5], [hr * 0.85, hr, hr * 1.1], { w: 7, h: 4, col: O.head });
  hp.ell([hr * 0.76, hr * 0.28, hr * 0.78], [hr * 0.17, hr * 0.2, hr * 0.17], { w: 4, h: 3, col: O.eye || 0x1b1712 });
  hp.ell([-hr * 0.76, hr * 0.28, hr * 0.78], [hr * 0.17, hr * 0.2, hr * 0.17], { w: 4, h: 3, col: O.eye || 0x1b1712 });
  S.beak(hp, hr);
  if (S.headX) S.headX(hp, hr);
  put(hd, hp);

  // 다리
  const legLen = hip - S.bh * 0.3, legs = [];
  [1, -1].forEach(sd => {
    const lg = G(air, sd * S.legs.x, hip - S.bh * 0.3, S.legs.z || 0);
    put(lg, legPart(legLen, S.legs.r, O.leg, S.legs.toe));
    legs.push(lg);
  });
  if (S.extra) S.extra({ root, torso, tilt, n1, n2, hd, tailG, wings, legs, S });

  // 움직임
  const r1a = S.neck.a[0], r2a = S.neck.a[1], hd0 = S.neck.hd, F = S.feed || {}, A = S.alert || {}, R = S.rest || {};
  const cur = { a1: r1a, a2: r2a, hd: hd0, pitch: S.pitch, crouch: 0, wing: 0, yawN: 0, yawH: 0, y: 0, spread: 0, tuck: 0 };
  const FL = S.fly || { span: 1.6, flap: 3, legs: "tuck", neck: [1.45, 0] }, trail = FL.legs === "trail";
  let wingK = 0;
  const ph = (S.seed || 1) * 1.7, walk = S.walk || 5;
  function upd(dt, t, mode) {
    const tg = { a1: r1a, a2: r2a, hd: hd0, pitch: S.pitch, crouch: 0, wing: 0, yawN: 0, yawH: 0, y: 0, spread: 0, tuck: 0 };
    let lg = 0;
    const look = sin(t * 0.37 + ph) * sin(t * 0.91 + ph * 2);
    if (mode === "idle") {
      tg.a1 += 0.04 * sin(t * 1.3 + ph); tg.pitch += 0.012 * sin(t * 1.9);
      tg.yawH = look * 0.7; tg.yawN = look * 0.25;
    } else if (mode === "feed") {
      const c = 0.5 + 0.5 * sin(t * 2.4 + ph);
      tg.a1 = r1a + (F.a1 !== undefined ? F.a1 : 0.3) * (0.7 + 0.3 * c);
      tg.a2 = r2a + (F.a2 || 0) * (0.7 + 0.3 * c);
      tg.hd = F.hd !== undefined ? F.hd : 0.9;
      tg.pitch = S.pitch - (F.pitch || 0) * (0.75 + 0.25 * c);
      tg.crouch = F.crouch || 0;
      tg.yawN = sin(t * 0.5 + ph) * 0.15;
    } else if (mode === "alert") {
      tg.a1 = A.a1 !== undefined ? A.a1 : r1a - 0.25;
      tg.a2 = A.a2 !== undefined ? A.a2 : r2a * 0.3;
      tg.hd = A.hd !== undefined ? A.hd : 0.05;
      tg.pitch = S.pitch + (A.pitch || 0.06);
      tg.wing = 0.1; tg.yawN = sin(t * 0.9 + ph) * 0.7; tg.yawH = sin(t * 1.7 + ph) * 0.25;
    } else if (mode === "move") {
      lg = walk; tg.a1 += 0.09 * sin(t * walk * 2 + ph); tg.y = abs(sin(t * walk)) * 0.012;
      tg.yawH = look * 0.2;
    } else if (mode === "rest") {
      tg.crouch = R.crouch !== undefined ? R.crouch : 0.8;
      tg.a1 = R.a1 !== undefined ? R.a1 : r1a + 0.6; tg.a2 = R.a2 !== undefined ? R.a2 : r2a - 1.1; tg.hd = R.hd !== undefined ? R.hd : hd0 + 0.3;
      tg.pitch = S.pitch * 0.6; tg.y = 0;
    } else if (mode === "fly") { // 날개를 펴고 퍼덕인다. 다리는 접거나 뒤로 뻗는다
      tg.spread = 1; tg.tuck = 1; tg.a1 = FL.neck[0]; tg.a2 = FL.neck[1]; tg.hd = 0.0; tg.pitch = 0.06;
    }
    const k = 5;
    for (const key in cur) cur[key] = damp(cur[key], tg[key], dt, key === "y" ? 12 : (key === "spread" || key === "tuck") ? 8 : k);
    tilt.rotation.x = -cur.pitch;
    n1.rotation.x = cur.a1; n2.rotation.x = cur.a2;
    hd.rotation.x = cur.hd + cur.pitch - cur.a1 - cur.a2;
    n1.rotation.y = cur.yawN; hd.rotation.y = cur.yawH;
    const cr = cur.crouch * 0.55;
    torso.position.y = hip - cr * legLen + cur.y + 0.004 * sin(t * 1.7 + ph);
    const sp = cur.spread, tk = cur.tuck;
    legs.forEach(l => { l.scale.y = 1 - cr - (trail ? 0 : 0.5) * tk; });
    if (lg) { const a = sin(t * lg) * 0.55; legs[0].rotation.x = a; legs[1].rotation.x = -a; }
    else { const ta = tk * (trail ? 1.45 : 1.25); legs[0].rotation.x = damp(legs[0].rotation.x, ta, dt, 10); legs[1].rotation.x = damp(legs[1].rotation.x, ta, dt, 10); }
    // 날개: sp 가 0이면 접은 모양, 1이면 옆으로 활짝. 편 길이는 종마다의 실제 날개 편 길이(FL.span)에 맞춘다
    if (!wingK) { const rs = root.scale.x || 1; wingK = Math.max(1.3, (FL.span / 2 / rs - S.bw * 0.8) / S.wing.l); }
    const fw = t * FL.flap * 2 * PI + ph, fa = 0.8 * sp * (sin(fw) + 0.22 * sin(2 * fw + 0.6));
    spreads.forEach((sg, i) => {
      const sd = i ? -1 : 1;
      sg.rotation.set(sp * PI / 2, -sd * sp * PI / 2, 0);
      sg.scale.set(1, lerp(1, 1.7, sp), lerp(1, wingK, sp));
      wings[i].rotation.z = sd * (cur.wing + fa);
    });
    air.position.y = sp * (ctl && ctl.lift ? ctl.lift : 0) / (root.scale.x || 1);
    if (sp > 0.02) torso.position.y += sp * S.bh * 0.35 * sin(fw + 1.3);
    tailG.rotation.x = (S.tail.ang || 0) + (mode === "alert" ? 0.12 : 0) + 0.02 * sin(t * 1.1 + ph);
  }
  return { root, upd };
}

/* 새 종마다의 설계 (모두 미터. 마지막에 키에 맞춰 같은 비율로 키운다) */
const BIRD = {};
const B = (hex) => hex; // 읽기 쉽게

BIRD.crane = () => ({ // 두루미: 흰 몸, 검은 목 윗부분과 셋째날개깃, 붉은 정수리
  seed: 1, hip: 0.82, bl: 0.36, bh: 0.16, bw: 0.12, pitch: 0.2, walk: 3.6,
  legs: { x: 0.06, r: 0.012, toe: 0.07 },
  neck: { l: [0.3, 0.3], r: [0.034, 0.026, 0.022], a: [0.32, -0.5], hd: 0.2 },
  head: { r: 0.04 }, tail: { l: 0.16, w: 0.1, ang: -0.15 },
  wing: { l: 0.4, h: 0.13, t: 0.03, x: (P, w) => {} },
  cols: {
    body: (x, y, z) => z < -0.16 && y > -0.02 ? mix(0xf2f0ea, 0x1d1c20, sstep(-0.16, -0.3, z)) : 0xf2f0ea,
    wing: (x, y, z) => z < -0.1 ? 0x1d1c20 : 0xf2f0ea,
    tail: 0xf2f0ea, neck1: 0xf2f0ea, neck2: 0x23222a, head: 0x23222a, leg: 0x2c2b2d
  },
  beak: beakFn(0.13, [[0, 0.016, 0.017], [0.6, 0.012, 0.012], [1, 0.002, 0.003]], 0xc9c07a, 5),
  headX: (P, hr) => P.ell([0, hr * 0.8, hr * 0.35], [hr * 0.55, hr * 0.2, hr * 0.55], { w: 6, h: 3, col: 0xc8281f }),
  feed: { a1: 2.0, a2: 0.3, hd: 1.4, pitch: 0.5, crouch: 0.35 },
  alert: { a1: 0.05, a2: -0.2, hd: 0.15 }, rest: { crouch: 0.35, a1: 0.5, a2: -1.2 }
});

BIRD.stork = () => ({ // 황새: 흰 몸, 검은 날개깃, 굵고 곧은 검은 부리, 붉은 다리
  seed: 2, hip: 0.6, bl: 0.3, bh: 0.15, bw: 0.11, pitch: 0.28, walk: 3.4,
  legs: { x: 0.055, r: 0.012, toe: 0.07 },
  neck: { l: [0.22, 0.2], r: [0.036, 0.03, 0.026], a: [0.5, -0.55], hd: 0.3 },
  head: { r: 0.042 }, tail: { l: 0.15, w: 0.09, ang: -0.12 },
  wing: { l: 0.34, h: 0.12, t: 0.03 },
  cols: {
    body: 0xf4f3ee, wing: (x, y, z) => z < -0.1 ? 0x1b1b1e : 0xf4f3ee, tail: 0x1b1b1e, neck: 0xf4f3ee, head: 0xf4f3ee, leg: 0xb8382c
  },
  beak: beakFn(0.22, [[0, 0.028, 0.028], [0.6, 0.02, 0.02], [1, 0.003, 0.004]], 0x1e1e20, 5),
  headX: (P, hr) => { P.ell([hr * 0.72, hr * 0.15, hr * 0.8], [hr * 0.2, hr * 0.28, hr * 0.28], { w: 4, h: 3, col: 0xc23a2c }); P.ell([-hr * 0.72, hr * 0.15, hr * 0.8], [hr * 0.2, hr * 0.28, hr * 0.28], { w: 4, h: 3, col: 0xc23a2c }); },
  feed: { a1: 1.9, a2: 0.3, hd: 1.4, pitch: 0.45, crouch: 0.3 }, alert: { a1: 0.1, a2: -0.25 }
});

BIRD.swan = () => ({ // 큰고니: 흰 몸, 긴 S자 목, 부리 밑동의 노란 쐐기
  seed: 3, hip: 0.3, bl: 0.5, bh: 0.2, bw: 0.17, pitch: 0.08, walk: 3,
  legs: { x: 0.07, r: 0.016, toe: 0.09 },
  neck: { l: [0.4, 0.34], r: [0.04, 0.03, 0.026], a: [0.5, -0.95], hd: 0.25 },
  head: { r: 0.045 }, tail: { l: 0.2, w: 0.12, ang: 0.12 },
  wing: { l: 0.5, h: 0.17, t: 0.04, z: 0.2 },
  cols: { body: 0xf6f5f0, tail: 0xf6f5f0, neck: 0xf6f5f0, head: 0xf6f5f0, leg: 0x2a2a2c },
  beak: beakFn(0.13, [[0, 0.025, 0.026], [0.45, 0.022, 0.022], [0.55, 0.021, 0.021], [1, 0.012, 0.012]], [0xf0c32e, 0xf0c32e, 0x222224, 0x222224], 4, 0.2, 1.2),
  feed: { a1: 1.1, a2: 0.7, hd: 1.4, pitch: 0.3, crouch: 0.1 }, alert: { a1: 0.2, a2: -0.4 }, rest: { crouch: 0.9, a1: 0.9, a2: -1.5 }
});

BIRD.kestrel = () => ({ // 황조롱이: 붉은 갈색 등, 회색 머리, 긴 꼬리, 갈고리 부리
  seed: 4, hip: 0.13, bl: 0.12, bh: 0.065, bw: 0.055, pitch: 0.65, walk: 8,
  legs: { x: 0.028, r: 0.007, toe: 0.03 },
  neck: { l: [0.02, 0.015], r: [0.03, 0.028, 0.026], a: [0.2, -0.1], hd: 0.35 },
  head: { r: 0.035 }, tail: { l: 0.17, w: 0.06, ang: -0.1, tip: 0.65 },
  wing: { l: 0.16, h: 0.05, t: 0.014, x: (P) => {} },
  cols: {
    body: (x, y, z) => y < -0.01 || z > 0.07 && y < 0.02 ? 0xe0bd8f : 0xb4622e,
    wing: (x, y, z) => z < -0.09 ? 0x2a2420 : 0xb4622e,
    tail: (x, y, z, i) => i === 3 ? 0xd9d9d4 : i === 2 ? 0x25221f : 0x9aa3ab,
    neck: 0x9aa3ab, head: 0x9aa3ab, leg: 0xe0b83a
  },
  beak: beakFn(0.03, [[0, 0.011, 0.012], [0.6, 0.008, 0.011], [1, 0.002, 0.005]], [0xe6c43a, 0x2c2a26, 0x2c2a26], 4, 0.9, 1.2),
  bodyX: (P) => { for (let i = 0; i < 6; i++) { const a = [-0.6, 0.5, -0.3, 0.7, 0.2, -0.1][i], z = -0.04 + (i % 3) * -0.04; P.patch([a * 0.06, 0.06 - (i % 2) * 0.005, z], [a * 0.3, 1, 0], 0.011, 0x2a2420); } },
  feed: { a1: 0.4, a2: 0.3, hd: 1.0, pitch: 0.15 }, alert: { a1: 0.0, a2: 0, hd: 0.2 }, rest: { crouch: 0.4, a1: 0.3, a2: -0.3 }
});

BIRD.beangoose = () => ({ // 큰기러기: 갈색 몸, 어두운 머리와 목, 검은 부리의 주황 띠
  seed: 5, hip: 0.32, bl: 0.3, bh: 0.13, bw: 0.11, pitch: 0.1, walk: 4,
  legs: { x: 0.05, r: 0.012, toe: 0.06 },
  neck: { l: [0.15, 0.15], r: [0.03, 0.026, 0.023], a: [0.35, -0.5], hd: 0.3 },
  head: { r: 0.035 }, tail: { l: 0.1, w: 0.08, ang: 0.05 },
  wing: { l: 0.3, h: 0.1, t: 0.025 },
  cols: { body: (x, y, z) => y < -0.04 ? 0xe5d9c6 : z < -0.26 ? 0xf1eee7 : 0x8a7358, wing: 0x7d6750, tail: 0x5a4b3c, neck: 0x5a4636, head: 0x4a3a2c, leg: 0xe8872c },
  beak: beakFn(0.07, [[0, 0.02, 0.018], [0.5, 0.016, 0.014], [0.75, 0.014, 0.012], [1, 0.004, 0.005]], [0x24211e, 0xf2a130, 0xf2a130, 0x24211e], 4, 0.15),
  feed: { a1: 1.5, a2: 0.4, hd: 1.3, pitch: 0.3 }, alert: { a1: 0.0, a2: -0.2 }
});

BIRD.wfgoose = () => ({ // 쇠기러기: 큰기러기보다 작고, 이마가 희고, 배에 검은 얼룩
  seed: 6, hip: 0.26, bl: 0.24, bh: 0.11, bw: 0.09, pitch: 0.1, walk: 4.6,
  legs: { x: 0.04, r: 0.01, toe: 0.05 },
  neck: { l: [0.12, 0.12], r: [0.026, 0.023, 0.02], a: [0.35, -0.5], hd: 0.3 },
  head: { r: 0.03 }, tail: { l: 0.08, w: 0.07, ang: 0.05 },
  wing: { l: 0.24, h: 0.085, t: 0.022 },
  cols: { body: (x, y, z) => y < -0.03 ? (sin(x * 70 + z * 50) > 0.4 ? 0x2a2622 : 0xe3d8c6) : z < -0.21 ? 0xf1eee7 : 0x8c7a66, wing: 0x7a6a58, tail: 0x5d4f42, neck: 0x7e6a56, head: 0x75614f, leg: 0xe8872c },
  beak: beakFn(0.045, [[0, 0.016, 0.015], [0.6, 0.013, 0.012], [1, 0.004, 0.005]], 0xe69a88, 4, 0.1),
  headX: (P, hr) => P.ell([0, hr * 0.2, hr * 1.3], [hr * 0.55, hr * 0.5, hr * 0.28], { w: 5, h: 3, col: 0xf3f0ea }),
  feed: { a1: 1.4, a2: 0.4, hd: 1.3, pitch: 0.3 }, alert: { a1: 0.0, a2: -0.2 }
});

BIRD.mallard = () => ({ // 청둥오리(수컷): 녹색 머리, 흰 목테, 밤색 가슴, 노란 납작한 부리
  seed: 7, hip: 0.14, bl: 0.21, bh: 0.1, bw: 0.085, pitch: 0.12, walk: 6,
  legs: { x: 0.04, r: 0.009, toe: 0.045 },
  neck: { l: [0.07, 0.05], r: [0.03, 0.025, 0.022], a: [0.3, -0.3], hd: 0.3 },
  head: { r: 0.032 }, tail: { l: 0.07, w: 0.06, ang: 0.35, tip: 0.3 },
  wing: { l: 0.2, h: 0.065, t: 0.02 },
  cols: { body: (x, y, z) => y < -0.04 ? 0xd9d6cb : z > 0.12 ? 0x6e3b24 : z < -0.17 ? 0x1c1b1b : 0x9a978f, wing: 0x8a877f, tail: 0x1f1f20, neck1: (x, y) => y < 0.02 ? 0xf3f1ea : 0x1f6b43, neck2: 0x1f6b43, head: 0x1f6b43, leg: 0xe9892f },
  beak: beakFn(0.05, [[0, 0.02, 0.009], [0.6, 0.023, 0.008], [1, 0.016, 0.005]], 0xe3c33a, 4, 0.05),
  feed: { a1: 0.8, a2: 0.4, hd: 1.3, pitch: 0.4 }, alert: { a1: 0.1, a2: -0.2 }
});

BIRD.mandarin = () => ({ // 원앙(수컷): 주황 은행잎 모양 날개깃, 보랏빛 가슴, 붉은 부리, 흰 눈썹줄
  seed: 8, hip: 0.1, bl: 0.17, bh: 0.085, bw: 0.07, pitch: 0.15, walk: 6.5,
  legs: { x: 0.035, r: 0.008, toe: 0.04 },
  neck: { l: [0.05, 0.04], r: [0.026, 0.022, 0.02], a: [0.3, -0.3], hd: 0.3 },
  head: { r: 0.03 }, tail: { l: 0.07, w: 0.05, ang: 0.25 },
  wing: { l: 0.16, h: 0.06, t: 0.018 },
  cols: { body: (x, y, z) => y < -0.03 ? 0xf1ece0 : z > 0.1 ? 0x6f4166 : z > 0.07 ? 0xf1ece0 : 0x8a5a3a, wing: 0x4a5f78, tail: 0x3d4a5c, neck: 0xcf6a2c, head: 0x2f7a6a, leg: 0xe9a047 },
  beak: beakFn(0.03, [[0, 0.013, 0.01], [0.7, 0.012, 0.008], [1, 0.005, 0.004]], 0xd23a2f, 4, 0.05),
  headX: (P, hr) => {
    P.tube([hr * 0.55, hr * 0.55, hr * 1.0], [hr * 0.55, hr * 0.6, -hr * 0.9], 0.004, 0.003, { n: 3, col: 0xf6f2e8 });
    P.tube([-hr * 0.55, hr * 0.55, hr * 1.0], [-hr * 0.55, hr * 0.6, -hr * 0.9], 0.004, 0.003, { n: 3, col: 0xf6f2e8 });
    P.tube([0, hr * 0.6, -hr * 0.2], [0, hr * 0.45, -hr * 2.2], hr * 0.3, 0.004, { n: 4, col: 0x2f7a6a });
  },
  sail: (tilt, S) => {
    [1, -1].forEach(sd => { const P = part(); P.poly([[0, 0, 0], [sd * 0.012, 0.01, -0.02], [sd * 0.02, 0.09, -0.04], [sd * 0.02, 0.08, -0.09], [sd * 0.008, 0.01, -0.1]], 0xd9692b); put(tilt, P, sd * S.bw * 0.55, S.bh * 0.85, -0.02); });
  },
  feed: { a1: 0.7, a2: 0.3, hd: 1.2, pitch: 0.3 }, alert: { a1: 0.1, a2: -0.2 }
});

BIRD.scopsowl = () => ({ // 소쩍새: 아주 작은 올빼미, 귀깃 조금, 노란 눈
  seed: 9, hip: 0.08, bl: 0.085, bh: 0.055, bw: 0.055, pitch: 1.15, walk: 8, seg: 7,
  legs: { x: 0.022, r: 0.011, toe: 0.025 },
  neck: { l: [0.012, 0.01], r: [0.04, 0.04, 0.038], a: [0.05, 0], hd: 0.0 },
  head: { r: 0.045 }, tail: { l: 0.07, w: 0.05, ang: -0.1 },
  wing: { l: 0.1, h: 0.05, t: 0.016 },
  cols: { body: (x, y, z) => z > 0.03 ? 0xb8a68e : 0x86766a, wing: 0x7a6a5c, tail: 0x6f6054, neck: 0x8a7a6a, head: (x, y, z) => z > 0.03 && y < 0.03 ? 0xbfae98 : 0x86766a, leg: 0xb8a68e, eye: 0xe6c53a },
  beak: beakFn(0.016, [[0, 0.01, 0.01], [0.6, 0.007, 0.01], [1, 0.002, 0.004]], 0x2b2825, 4, 0.8, 1.45),
  headX: (P, hr) => { [1, -1].forEach(sd => P.tube([sd * hr * 0.6, hr * 0.8, hr * 0.2], [sd * hr * 0.75, hr * 1.5, hr * 0.1], hr * 0.2, 0.004, { n: 3, col: 0x6f6054 })); },
  feed: { a1: 0.2, a2: 0.1, hd: 0.7, pitch: 0.3 }, alert: { a1: -0.05, a2: 0, hd: 0 }, rest: { crouch: 0.3, a1: 0.1, a2: 0 }
});

BIRD.hawkowl = () => ({ // 솔부엉이: 어두운 갈색 등, 줄무늬 가슴, 큰 노란 눈, 귀깃 없음
  seed: 10, hip: 0.1, bl: 0.12, bh: 0.065, bw: 0.065, pitch: 1.05, walk: 7, seg: 7,
  legs: { x: 0.026, r: 0.011, toe: 0.028 },
  neck: { l: [0.012, 0.01], r: [0.05, 0.05, 0.048], a: [0.05, 0], hd: 0.0 },
  head: { r: 0.05 }, tail: { l: 0.12, w: 0.06, ang: -0.15 },
  wing: { l: 0.15, h: 0.055, t: 0.018 },
  cols: { body: (x, y, z) => z > 0.02 ? (sin(y * 160 + 1.0) > 0.1 ? 0x7a5a42 : 0xe4d7c2) : 0x5a4332, wing: 0x54402f, tail: (x, y, z, i) => i === 1 ? 0xc7b79d : 0x5b4535, neck: 0x6a5240, head: 0x5f4838, leg: 0xc9a43a, eye: 0xf0cf3a },
  beak: beakFn(0.016, [[0, 0.011, 0.011], [0.6, 0.008, 0.011], [1, 0.002, 0.004]], 0x3b3a2c, 4, 0.8, 1.45),
  feed: { a1: 0.2, a2: 0.1, hd: 0.7, pitch: 0.3 }, alert: { a1: -0.05, a2: 0, hd: 0 }, rest: { crouch: 0.3, a1: 0.1, a2: 0 }
});

BIRD.spoonbillsandpiper = () => ({ // 넓적부리도요: 아주 작은 물떼새, 부리 끝이 주걱 모양
  seed: 11, hip: 0.07, bl: 0.07, bh: 0.035, bw: 0.03, pitch: 0.18, walk: 11, seg: 7,
  legs: { x: 0.013, r: 0.0035, toe: 0.014 },
  neck: { l: [0.02, 0.016], r: [0.015, 0.013, 0.012], a: [0.3, -0.3], hd: 0.25 },
  head: { r: 0.018 }, tail: { l: 0.04, w: 0.025, ang: 0.0 },
  wing: { l: 0.07, h: 0.026, t: 0.008 },
  cols: { body: (x, y, z) => y < -0.01 ? 0xf0ede4 : 0x8b7d69, wing: 0x7a6c5a, tail: 0x6b6254, neck: 0xe9e4d8, head: (x, y) => y > 0.012 ? 0x8b7d69 : 0xece8dc, leg: 0x2a2a2a },
  beak: beakFn(0.05, [[0, 0.006, 0.006], [0.55, 0.0045, 0.0045], [0.8, 0.011, 0.0025], [1, 0.006, 0.0025]], 0x1f1f20, 6, 0.0, 1.2),
  feed: { a1: 0.9, a2: 0.2, hd: 1.2, pitch: 0.3 }, alert: { a1: 0.0, a2: -0.1 }
});

BIRD.spoonbill = () => ({ // 저어새: 흰 새, 검고 긴 주걱 부리와 검은 얼굴
  seed: 12, hip: 0.42, bl: 0.26, bh: 0.1, bw: 0.085, pitch: 0.22, walk: 4,
  legs: { x: 0.04, r: 0.009, toe: 0.05 },
  neck: { l: [0.16, 0.15], r: [0.026, 0.022, 0.02], a: [0.45, -0.5], hd: 0.35 },
  head: { r: 0.032 }, tail: { l: 0.1, w: 0.07, ang: -0.1 },
  wing: { l: 0.28, h: 0.09, t: 0.022 },
  cols: { body: (x, y, z) => z > 0.2 && y > -0.02 ? 0xf1dd9c : 0xf7f5ee, wing: 0xf7f5ee, tail: 0xf7f5ee, neck: 0xf7f5ee, head: (x, y, z) => z > 0.03 ? 0x25262a : 0xf7f5ee, leg: 0x26262a },
  beak: beakFn(0.2, [[0, 0.013, 0.01], [0.5, 0.011, 0.006], [0.8, 0.031, 0.0035], [1, 0.02, 0.0035]], 0x25262a, 6, 0.1, 1.2),
  headX: (P, hr) => { [1, -1].forEach(sd => P.tube([sd * 0.004, hr * 0.5, -hr * 0.4], [sd * 0.012, hr * 0.3, -hr * 2.2], 0.004, 0.0015, { n: 3, col: 0xf7f5ee })); },
  feed: { a1: 1.8, a2: 0.3, hd: 1.3, pitch: 0.45, crouch: 0.2 }, alert: { a1: 0.1, a2: -0.2 }
});

BIRD.heron = () => ({ // 왜가리: 회색 등, 흰 목과 머리, 검은 댕기, 노란 긴 부리
  seed: 13, hip: 0.52, bl: 0.28, bh: 0.11, bw: 0.085, pitch: 0.5, walk: 3.6,
  legs: { x: 0.045, r: 0.01, toe: 0.06 },
  neck: { l: [0.23, 0.22], r: [0.028, 0.022, 0.02], a: [0.7, -1.2], hd: 0.45 },
  head: { r: 0.033 }, tail: { l: 0.1, w: 0.06, ang: -0.2 },
  wing: { l: 0.3, h: 0.1, t: 0.02 },
  cols: { body: (x, y, z) => y < -0.04 ? 0xe8e8e2 : 0x8793a0, wing: (x, y, z) => z < -0.15 ? 0x2b2f36 : 0x8793a0, tail: 0x8793a0, neck: 0xf0f0ec, head: 0xf0f0ec, leg: 0x8b7d4a },
  beak: beakFn(0.17, [[0, 0.017, 0.016], [0.6, 0.012, 0.012], [1, 0.002, 0.003]], 0xdfb130, 5),
  headX: (P, hr) => {
    P.ell([0, hr * 0.5, hr * 0.3], [hr * 0.9, hr * 0.38, hr * 0.8], { w: 5, h: 3, col: 0x24262c });
    [1, -1].forEach(sd => P.tube([sd * 0.006, hr * 0.7, -hr * 0.4], [sd * 0.012, hr * 0.2, -hr * 3.2], 0.005, 0.0015, { n: 3, col: 0x24262c }));
  },
  feed: { a1: 1.6, a2: 1.4, hd: 1.4, pitch: 0.5, crouch: 0.25 }, alert: { a1: 0.15, a2: -0.6, hd: 0.2 }, rest: { crouch: 0.3, a1: 0.8, a2: -1.5 }
});

const BIRD_CAL = { crane: 1.4, stork: 1.1, swan: 1.2, kestrel: 0.3, beangoose: 0.75, wfgoose: 0.65, mallard: 0.38, mandarin: 0.3, scopsowl: 0.2, hawkowl: 0.29, spoonbillsandpiper: 0.14, spoonbill: 0.75, heron: 0.95 };

const REG = {}; // id -> (opts) => model
// 나는 모습: span 날개 편 길이(m), flap 1초에 날갯짓 횟수, legs 다리(trail 뒤로 뻗음, tuck 접음), neck 날 때의 목 [a1, a2]
// 값은 기억으로 정한 대략의 값이다. 확인 필요
const FLY = {
  crane: { span: 2.4, flap: 2.0, legs: "trail", neck: [1.45, 0.0] },
  stork: { span: 2.1, flap: 2.2, legs: "trail", neck: [1.45, 0.0] },
  swan: { span: 2.3, flap: 2.6, legs: "tuck", neck: [1.5, 0.0] },
  kestrel: { span: 0.75, flap: 6, legs: "tuck", neck: [0.4, 0.0] },
  beangoose: { span: 1.6, flap: 3.2, legs: "tuck", neck: [1.5, 0.0] },
  wfgoose: { span: 1.4, flap: 3.6, legs: "tuck", neck: [1.5, 0.0] },
  mallard: { span: 0.9, flap: 7, legs: "tuck", neck: [1.45, 0.0] },
  mandarin: { span: 0.7, flap: 8, legs: "tuck", neck: [1.4, 0.0] },
  scopsowl: { span: 0.55, flap: 6, legs: "tuck", neck: [0.3, 0.0] },
  hawkowl: { span: 0.66, flap: 5, legs: "tuck", neck: [0.3, 0.0] },
  spoonbillsandpiper: { span: 0.3, flap: 10, legs: "trail", neck: [1.4, 0.0] },
  spoonbill: { span: 1.3, flap: 3, legs: "trail", neck: [1.5, 0.0] },
  heron: { span: 1.7, flap: 2.2, legs: "trail", neck: [0.6, -1.4] }
};
Object.keys(BIRD).forEach(id => {
  REG[id] = (opts) => {
    const ctl = { lift: (opts && opts.flyLift) || 0 }, spec = BIRD[id]();
    spec.fly = FLY[id];
    const r = buildBird(spec, ctl);
    const m = finish(id, r.root, ["y", BIRD_CAL[id]], r.upd, { kind: "bird" });
    Object.defineProperty(m, "flyLift", { get() { return ctl.lift; }, set(v) { ctl.lift = v; }, enumerable: true });
    return m;
  };
});

/* ====================================================================== */
/*                               물고기                                    */
/* ====================================================================== */
// prof: [t(0 주둥이 ~ 1 꼬리자루), 가로 반지름, 세로 반지름] (몸길이 L의 비율)
function buildFish(S) {
  const L = S.L, root = new T.Group(), body = G(root);
  const tm = S.tm || 0.58, zm = L * (0.5 - tm);
  const all = S.prof.map(p => ({ z: L * (0.5 - p[0]), rx: p[1] * L * (S.ws || 1.25), ry: p[2] * L }));
  const cut = stAt(all, zm); cut.z = zm;
  const front = all.filter(s => s.z > zm + 1e-6).concat([cut]);
  const rear = [cut].concat(all.filter(s => s.z < zm - 1e-6)).map(s => Object.assign({}, s, { z: s.z - zm }));
  const cf = (sh) => (x, y, z, i, th) => S.col(sin(th), cos(th), 0.5 - (z + sh) / L, x, z + sh);
  const fp = part(), rp = part();
  fp.loft(front, { n: 8, col: cf(0), cap: true });
  rp.loft(rear, { n: 8, col: cf(zm), cap: true });
  const spotsOn = (P, st, sh, tmin, tmax) => (S.spots || []).forEach(sp => {
    if (sp.t < tmin || sp.t >= tmax) return;
    [sp.th, PI - sp.th].forEach(th => { const z = L * (0.5 - sp.t) - sh, q = surf(st, z, th); P.patch(q.p, q.n, sp.s * L, sp.col, 0.0012 * L / 0.3); });
  });
  spotsOn(fp, front, 0, 0, tm); spotsOn(rp, rear, zm, tm, 2);
  // 눈
  [1, -1].forEach(sd => { const q = surf(front, L * (0.5 - 0.075), sd > 0 ? 0.35 : PI - 0.35); fp.patch(q.p, q.n, 0.0125 * L, 0x15130f, 0.001 * L / 0.3); });
  // 등지느러미와 뒷지느러미
  (S.dorsal || []).forEach(d => {
    const z0 = L * (0.5 - d.t0), z1 = L * (0.5 - d.t1), top = z => stAt(all, z).ry, h = d.h * L, dz = z0 - z1;
    fp.poly([[0, top(z0) * 0.9, z0], [0, top(z0 - 0.2 * dz) + h, z0 - 0.2 * dz], [0, top(z0 - 0.75 * dz) + h * 0.35, z0 - 0.75 * dz], [0, top(z1) * 0.9, z1]], d.col);
  });
  if (S.anal) { const a = S.anal, z0 = L * (0.5 - a.t0), z1 = L * (0.5 - a.t1), bt = z => stAt(all, z).ry; fp.poly([[0, -bt(z0) * 0.9, z0], [0, -bt(z0) - a.h * L, z0 - 0.3 * (z0 - z1)], [0, -bt(z1) * 0.9, z1]], a.col); }
  const fm = put(body, fp), pivR = G(body, 0, 0, zm), rm = put(pivR, rp);
  // 꼬리지느러미 (위에서도 보이도록 비스듬히 눕힌다)
  const tailP = G(pivR, 0, 0, -L / 2 - zm);
  const tl = S.tail.l * L, sp = S.tail.sp * L, a = S.tail.ang === undefined ? 0.85 : S.tail.ang, ca = cos(a), sa = sin(a);
  const tp = part(), fk = S.tail.fork || 0.3;
  tp.poly([[0, 0, 0.01 * L], [sp * ca, sp * sa, -tl], [0, 0, -tl * (1 - fk)], [-sp * ca, -sp * sa, -tl]], S.tail.col);
  put(tailP, tp);
  // 가슴지느러미 (두 개, 위에서 보인다)
  const pecs = [1, -1].map(sd => {
    const z = L * (0.5 - (S.pec.t || 0.27)), s = stAt(all, z), g = G(body, sd * s.rx * 0.85, -s.ry * 0.35, z), P = part(), pl = S.pec.l * L;
    P.poly([[0, 0, 0.004 * L], [sd * pl * 0.95, -pl * 0.12, -pl * 0.8], [sd * pl * 0.3, -pl * 0.05, -pl * 1.15]], S.pec.col);
    put(g, P); return g;
  });
  const lift = S.maxRy || Math.max.apply(null, all.map(s => s.ry));
  body.position.y = lift;
  const ph = (S.seed || 1) * 1.3;
  let spd = 3, amp = 1, pit = 0, pecO = 0;
  const cur = { pit: 0, pecO: 0 };
  function upd(dt, t, mode) {
    const tg = { pit: 0, pecO: 0 }; let w = 3, am = 1;
    if (mode === "idle") { w = 2.6; am = 0.55; }
    else if (mode === "feed") { w = 3.2; am = 0.7; tg.pit = 0.35 + 0.15 * sin(t * 2.2 + ph); }
    else if (mode === "alert") { w = 1.2; am = 0.18; tg.pecO = 0.5; tg.pit = -0.05; }
    else if (mode === "move") { w = 8.5; am = 1.5; }
    else if (mode === "rest") { w = 1.2; am = 0.3; }
    for (const k in cur) cur[k] = damp(cur[k], tg[k], dt, 5);
    const ph1 = t * w + ph;
    body.rotation.y = 0.05 * am * sin(ph1 + 0.8);
    body.rotation.x = cur.pit;
    pivR.rotation.y = 0.13 * am * sin(ph1);
    tailP.rotation.y = 0.2 * am * sin(ph1 - 0.8);
    pecs.forEach((g, i) => { const sd = i ? -1 : 1; g.rotation.y = -sd * (0.15 + cur.pecO + 0.12 * sin(t * 3.4 + ph)); });
  }
  return { root, upd };
}

const FISH = {};
const FCOL = (back, side, belly) => (dors, cs, t) => dors > 0.6 ? back : dors > -0.3 ? side : belly;
FISH.eoreumchi = () => ({ // 어름치: 황갈색 몸, 몸 옆에 줄지어 박힌 검은 점
  seed: 1, L: 0.3, prof: [[0, 0.012, 0.012], [0.05, 0.045, 0.05], [0.2, 0.075, 0.09], [0.4, 0.085, 0.1], [0.6, 0.07, 0.085], [0.8, 0.04, 0.05], [1, 0.022, 0.03]],
  col: (d, c, t) => d > 0.6 ? 0x8e7b45 : d > -0.3 ? 0xc3a85a : 0xe6dcae,
  tail: { l: 0.17, sp: 0.1, col: 0xb89a55 }, pec: { l: 0.1, col: 0xc7ae68 },
  dorsal: [{ t0: 0.3, t1: 0.5, h: 0.1, col: 0xb39450 }], anal: { t0: 0.72, t1: 0.84, h: 0.05, col: 0xc7ae68 },
  spots: [0.25, 0.32, 0.39, 0.46, 0.53, 0.6, 0.67, 0.74].flatMap((t, i) => [{ t, th: 0.12, s: 0.014, col: 0x2a2418 }, { t: t + 0.03, th: 0.85, s: 0.012, col: 0x2a2418 }])
});
FISH.gamdol = () => ({ // 감돌고기: 가늘고 긴 몸, 뾰족한 주둥이, 옆구리의 굵은 검은 줄
  seed: 2, ws: 1.05, L: 0.12, prof: [[0, 0.006, 0.006], [0.1, 0.03, 0.035], [0.25, 0.045, 0.055], [0.5, 0.045, 0.055], [0.75, 0.03, 0.04], [1, 0.016, 0.025]],
  col: (d, c, t) => d > 0.8 ? 0x86724a : abs(d) < 0.5 ? 0x2a2824 : d < -0.5 ? 0xe8e2cc : 0x6b5c3e,
  tail: { l: 0.18, sp: 0.1, col: 0xb7ad8c }, pec: { l: 0.11, col: 0xcfc9ae },
  dorsal: [{ t0: 0.38, t1: 0.52, h: 0.1, col: 0xb7ad8c }], anal: { t0: 0.7, t1: 0.8, h: 0.05, col: 0xcfc9ae }
});
FISH.ssogari = () => ({ // 쏘가리: 노란 갈색 몸에 짙은 얼룩, 큰 머리, 높은 등지느러미
  seed: 3, L: 0.4, prof: [[0, 0.014, 0.014], [0.05, 0.05, 0.06], [0.2, 0.07, 0.11], [0.4, 0.075, 0.12], [0.6, 0.06, 0.1], [0.8, 0.035, 0.06], [1, 0.02, 0.035]],
  col: (d, c, t, x, z) => d < -0.6 ? 0xe3d6a0 : (d > 0.2 && sin(t * 26) > 0.2) ? 0x3b2c14 : d > 0.5 ? 0x7c6535 : 0xb29a4f,
  tail: { l: 0.16, sp: 0.1, col: 0x9c8444, fork: 0 }, pec: { l: 0.11, col: 0xc2a45c },
  dorsal: [{ t0: 0.22, t1: 0.42, h: 0.13, col: 0x8a7439 }, { t0: 0.43, t1: 0.7, h: 0.09, col: 0xa28a4a }], anal: { t0: 0.68, t1: 0.82, h: 0.07, col: 0xa28a4a },
  spots: [[0.3, 0.2], [0.38, 0.7], [0.48, 0.1], [0.55, 0.65], [0.62, 0.2], [0.7, 0.75], [0.24, 0.5]].map(a => ({ t: a[0], th: a[1], s: 0.018, col: 0x3a2d14 }))
});
FISH.ayu = () => ({ // 은어: 가늘고 은빛 도는 올리브색, 아가미 뒤의 노란 점
  seed: 4, ws: 1.1, L: 0.25, prof: [[0, 0.01, 0.01], [0.06, 0.035, 0.04], [0.25, 0.055, 0.07], [0.5, 0.055, 0.07], [0.75, 0.035, 0.05], [1, 0.018, 0.03]],
  col: (d, c, t) => d > 0.4 ? 0x8f9d6f : d > -0.3 ? 0xc3cbb0 : 0xeceee3,
  tail: { l: 0.16, sp: 0.09, col: 0xb7bda0 }, pec: { l: 0.1, col: 0xd6dbc3 },
  dorsal: [{ t0: 0.4, t1: 0.52, h: 0.08, col: 0xaab08f }], anal: { t0: 0.66, t1: 0.78, h: 0.05, col: 0xd6dbc3 },
  spots: [{ t: 0.2, th: 0.15, s: 0.02, col: 0xe8b838 }]
});
FISH.pirami = () => ({ // 피라미: 작고 날씬한 은빛 몸, 옆의 푸른 줄
  seed: 5, ws: 1.1, L: 0.13, prof: [[0, 0.01, 0.01], [0.06, 0.04, 0.05], [0.25, 0.055, 0.07], [0.5, 0.05, 0.065], [0.75, 0.035, 0.04], [1, 0.018, 0.025]],
  col: (d, c, t) => d > 0.6 ? 0x8a998f : abs(d) < 0.35 ? 0x7fa0bd : d < -0.5 ? 0xe6eae6 : 0xc2ccc6,
  tail: { l: 0.18, sp: 0.1, col: 0xdcab82 }, pec: { l: 0.11, col: 0xe3b890 },
  dorsal: [{ t0: 0.38, t1: 0.5, h: 0.09, col: 0xdcab82 }], anal: { t0: 0.66, t1: 0.8, h: 0.07, col: 0xe3b890 }
});
FISH.galgyeoni = () => ({ // 참갈겨니: 가늘고 긴 몸, 옆구리의 어두운 가로줄, 노란 지느러미
  seed: 6, ws: 1.1, L: 0.2, prof: [[0, 0.01, 0.01], [0.06, 0.035, 0.04], [0.25, 0.05, 0.062], [0.5, 0.047, 0.058], [0.75, 0.032, 0.038], [1, 0.016, 0.024]],
  col: (d, c, t) => d > 0.6 ? 0x7f7c58 : abs(d) < 0.3 ? 0x34332f : d < -0.5 ? 0xeae2c4 : 0xb5ad86,
  tail: { l: 0.17, sp: 0.1, col: 0xd9c070 }, pec: { l: 0.1, col: 0xd9c477 },
  dorsal: [{ t0: 0.4, t1: 0.52, h: 0.08, col: 0xcfb766 }], anal: { t0: 0.66, t1: 0.8, h: 0.06, col: 0xd9c477 }
});
FISH.beodeulchi = () => ({ // 버들치: 작고 통통한 갈색 몸, 짙은 얼룩
  seed: 7, L: 0.11, prof: [[0, 0.012, 0.012], [0.06, 0.045, 0.05], [0.25, 0.06, 0.075], [0.5, 0.055, 0.07], [0.75, 0.04, 0.05], [1, 0.025, 0.03]],
  col: (d, c, t) => d > 0.3 ? (sin(t * 22) > 0.35 ? 0x4d402c : 0x77654a) : d < -0.5 ? 0xcdbf9c : 0x8d7b58,
  tail: { l: 0.16, sp: 0.09, col: 0x8d7b58, fork: 0.15 }, pec: { l: 0.1, col: 0xa8966f },
  dorsal: [{ t0: 0.38, t1: 0.52, h: 0.09, col: 0x8d7b58 }], anal: { t0: 0.66, t1: 0.78, h: 0.05, col: 0xa8966f },
  spots: [{ t: 0.3, th: 0.5, s: 0.02, col: 0x3d3322 }, { t: 0.5, th: 0.4, s: 0.02, col: 0x3d3322 }, { t: 0.68, th: 0.5, s: 0.018, col: 0x3d3322 }]
});
FISH.bass = () => ({ // 배스(불청객): 녹색 등, 옆구리의 어두운 얼룩 띠, 큰 입, 등지느러미 둘
  seed: 8, L: 0.4, prof: [[0, 0.015, 0.015], [0.05, 0.05, 0.07], [0.2, 0.07, 0.11], [0.4, 0.075, 0.125], [0.6, 0.065, 0.11], [0.8, 0.04, 0.06], [1, 0.022, 0.035]],
  col: (d, c, t) => d > 0.4 ? 0x66783a : d > -0.5 ? 0x8a9a52 : 0xdcdcbc,
  tail: { l: 0.16, sp: 0.1, col: 0x6a7a40, fork: 0.12 }, pec: { l: 0.11, col: 0x9aa862 },
  dorsal: [{ t0: 0.25, t1: 0.43, h: 0.12, col: 0x56672f }, { t0: 0.44, t1: 0.68, h: 0.08, col: 0x66783a }], anal: { t0: 0.68, t1: 0.82, h: 0.07, col: 0x7d8b4a },
  spots: [0.2, 0.28, 0.36, 0.44, 0.52, 0.6, 0.68].map(t => ({ t, th: 0.15, s: 0.026, col: 0x2a3220 }))
});
FISH.bluegill = () => ({ // 블루길(불청객): 납작하고 둥근 몸, 세로 줄무늬, 검은 귓바퀴, 주황 배
  seed: 9, L: 0.2, prof: [[0, 0.012, 0.012], [0.06, 0.05, 0.07], [0.22, 0.075, 0.14], [0.45, 0.075, 0.15], [0.7, 0.05, 0.09], [1, 0.02, 0.035]],
  col: (d, c, t) => d < -0.3 ? 0xe7a040 : (sin(t * 34) > 0.3 ? 0x4f5d34 : 0x7a8a50),
  tail: { l: 0.14, sp: 0.09, col: 0x7a8a50, fork: 0.15 }, pec: { l: 0.12, col: 0xa8b070 },
  dorsal: [{ t0: 0.26, t1: 0.62, h: 0.13, col: 0x6a7942 }], anal: { t0: 0.58, t1: 0.76, h: 0.07, col: 0xcf9a50 },
  spots: [{ t: 0.2, th: 0.2, s: 0.03, col: 0x1b2430 }]
});
const FISH_CAL = { eoreumchi: 0.3, gamdol: 0.12, ssogari: 0.4, ayu: 0.25, pirami: 0.13, galgyeoni: 0.2, beodeulchi: 0.11, bass: 0.4, bluegill: 0.2 };
Object.keys(FISH).forEach(id => {
  REG[id] = () => { const r = buildFish(FISH[id]()); return finish(id, r.root, ["z", FISH_CAL[id]], r.upd, { kind: "fish" }); };
});

/* ====================================================================== */
/*                                 게                                      */
/* ====================================================================== */
function chelaPart(W, sc, col, tip) {
  const P = part();
  P.ell([0, 0, W * 0.16 * sc], [W * 0.1 * sc, W * 0.08 * sc, W * 0.16 * sc], { w: 6, h: 3, col });
  P.tube([W * 0.04 * sc, 0, W * 0.28 * sc], [W * 0.03 * sc, 0, W * 0.5 * sc], W * 0.045 * sc, 0.0004, { n: 3, col: tip || col, cap: false });
  return P;
}
function buildCrab(S) {
  const W = S.W, root = new T.Group(), legH = W * S.legH;
  const bodyG = G(root, 0, legH, 0);
  const cp = part();
  cp.ell([0, 0, 0], [W * 0.5, W * S.thick, W * S.depth], { w: 8, h: 4, col: (x, y, z) => y > 0 ? S.col : mix(S.col, 0xffffff, 0.35) });
  put(bodyG, cp);
  // 눈자루
  const eyes = [1, -1].map(sd => {
    const g = G(bodyG, sd * W * S.eyeX, W * S.thick * 0.6, W * S.depth * 0.72);
    const P = part(); P.tube([0, 0, 0], [sd * W * 0.03, W * S.eyeH, W * 0.03], W * 0.018, W * 0.03, { n: 3, col: S.col, cap: true });
    P.ell([sd * W * 0.03, W * S.eyeH + W * 0.015, W * 0.04], [W * 0.032, W * 0.032, W * 0.032], { w: 4, h: 3, col: 0x15130f });
    put(g, P); return g;
  });
  // 걷는 다리: 한쪽에 네 개
  const legs = [];
  [1, -1].forEach(sd => {
    for (let i = 0; i < 4; i++) {
      const z = (0.55 - i * 0.36) * W * S.depth, g = G(bodyG, sd * W * 0.44, 0, z), P = part();
      const lz = z * 0.5, kx = sd * W * 0.62, ky = W * 0.12, fx = sd * W * (0.78 + 0.03 * i), fy = -legH, fz = lz - W * 0.05 * i;
      P.tube([0, 0, 0], [kx - sd * W * 0.44, ky, lz - z], W * 0.03, W * 0.022, { n: 3, col: S.leg });
      P.tube([kx - sd * W * 0.44, ky, lz - z], [fx - sd * W * 0.44, fy, fz - z], W * 0.022, W * 0.012, { n: 3, col: S.leg });
      put(g, P); legs.push({ g, sd, i });
    }
  });
  // 집게: 팔과 집게손
  const claws = [1, -1].map(sd => {
    const sc = (sd > 0 ? S.big : S.small) || 1, g = G(bodyG, sd * W * 0.3, W * S.thick * 0.3, W * S.depth * 0.85);
    const A = part(); A.tube([0, 0, 0], [sd * W * 0.12 * sc, W * 0.02, W * 0.18 * sc], W * 0.035 * sc, W * 0.03 * sc, { n: 3, col: S.claw, cap: true });
    put(g, A);
    const h = G(g, sd * W * 0.12 * sc, W * 0.02, W * 0.18 * sc);
    const C = chelaPart(W, sc, S.claw, S.tip); put(h, C, 0, 0, 0, [0, sd * -0.25, 0]);
    return { g, h, sd, sc };
  });
  const ph = (S.seed || 1) * 2.1, cur = { lift: 0, low: 0, wave: 0 };
  function upd(dt, t, mode) {
    const tg = { lift: 0, low: 0, wave: 0 };
    let sc = 0;
    if (mode === "idle") { tg.wave = S.wave ? 1 : 0; }
    else if (mode === "feed") { tg.wave = 0; }
    else if (mode === "alert") { tg.lift = 1; }
    else if (mode === "move") { sc = 1; }
    else if (mode === "rest") { tg.low = 1; }
    for (const k in cur) cur[k] = damp(cur[k], tg[k], dt, 6);
    bodyG.position.y = legH * (1 + 0.25 * cur.lift - 0.5 * cur.low) + (sc ? abs(sin(t * 14)) * W * 0.03 : 0);
    legs.forEach(l => {
      const w = sc ? sin(t * 14 + l.i * 1.4 + (l.sd > 0 ? 0 : PI)) * 0.5 : sin(t * 1.6 + l.i + ph) * 0.03 * (mode === "idle" ? 1 : 0);
      l.g.rotation.y = w * 0.6; l.g.rotation.z = -l.sd * (cur.low * 0.35 - cur.lift * 0.12) + (sc ? w * 0.15 : 0);
    });
    eyes.forEach((e, i) => { e.rotation.z = -(i ? -1 : 1) * (0.12 + 0.1 * sin(t * 2.1 + ph + i)) * (1 - cur.low * 0.8) - (i ? -1 : 1) * cur.low * 0.9; });
    claws.forEach((c, i) => {
      const big = c.sc > 1.5;
      let rx = 0, ry = 0, rz = 0;
      if (big && cur.wave > 0.01) { rz = c.sd * -(0.2 + 0.5 * (0.5 + 0.5 * sin(t * 3.2 + ph))) * cur.wave; rx = -0.5 * cur.wave * (0.5 + 0.5 * sin(t * 3.2 + ph)); }
      if (mode === "feed") { rx = -0.45 * (0.5 + 0.5 * sin(t * 4.5 + ph + i * PI)); ry = c.sd * -0.25; }
      if (mode === "alert") { rx = -0.8; rz = c.sd * -0.35; }
      if (mode === "rest") { rx = 0.25; }
      if (sc) { rx = 0.15 * sin(t * 14 + i); }
      c.g.rotation.set(damp(c.g.rotation.x, rx, dt, 9), damp(c.g.rotation.y, ry, dt, 9), damp(c.g.rotation.z, rz, dt, 9));
    });
  }
  return { root, upd };
}
const CRAB = {};
CRAB.ghostcrab = () => ({ seed: 1, W: 0.035, thick: 0.17, depth: 0.42, legH: 0.2, col: 0xd9caa3, leg: 0xe2d3ae, claw: 0xeadccb, tip: 0xf3e9d8, eyeX: 0.22, eyeH: 0.13, big: 1.0, small: 1.0 });
CRAB.fiddler = () => ({ seed: 2, W: 0.035, thick: 0.17, depth: 0.36, legH: 0.18, col: 0x5f6a58, leg: 0x7b6a4c, claw: 0xd8512b, tip: 0xe8714a, eyeX: 0.15, eyeH: 0.1, big: 2.4, small: 0.55, wave: true });
CRAB.sandbubbler = () => ({ seed: 3, W: 0.011, thick: 0.3, depth: 0.5, legH: 0.18, col: 0x8f9ba8, leg: 0xb9a888, claw: 0xc9bca3, tip: 0xd8cdb8, eyeX: 0.12, eyeH: 0.07, big: 0.8, small: 0.8 });
CRAB.mudcrab = () => ({ seed: 4, W: 0.03, thick: 0.14, depth: 0.3, legH: 0.17, col: 0x6c6a4a, leg: 0x8a7a54, claw: 0x8f7650, tip: 0xc9a05a, eyeX: 0.34, eyeH: 0.2, big: 1.2, small: 1.2 });
const CRAB_CAL = { ghostcrab: 0.035, fiddler: 0.035, sandbubbler: 0.011, mudcrab: 0.03 };
Object.keys(CRAB).forEach(id => {
  REG[id] = () => { const r = buildCrab(CRAB[id]()); return finish(id, r.root, ["x", CRAB_CAL[id] * 1.5], r.upd, { kind: "crab" }); };
});

/* ====================================================================== */
/*                                 풀                                      */
/* ====================================================================== */
// 리본 모양 잎. 아래에서 위로 4마디. 휘어진 방향 az
function blade(P, bx, by, bz, len, wid, lean, bend, az, c0, c1) {
  const dx = cos(az), dz = sin(az), nx = -dz, nz = dx, pts = [];
  for (let k = 0; k <= 3; k++) {
    const t = k / 3, off = sin(lean) * len * t + bend * len * t * t, up = len * t * cos(lean) - bend * len * t * t * 0.5, w = wid * (1 - 0.88 * t);
    pts.push([[bx + dx * off + nx * w, by + up, bz + dz * off + nz * w, k, 0], [bx + dx * off - nx * w, by + up, bz + dz * off - nz * w, k, 0]]);
  }
  const col = (x, y, z, k) => mix(c0, c1, k / 3);
  for (let k = 0; k < 3; k++) P.quad(pts[k][0], pts[k][1], pts[k + 1][1], pts[k + 1][0], col);
}
function leafD(P, bx, by, bz, dx, dy, dz, len, wid, col) { // 마름모 잎
  const d = new T.Vector3(dx, dy, dz).normalize(), s = new T.Vector3().crossVectors(d, new T.Vector3(0, 1, 0)); if (s.length() < 0.1) s.set(1, 0, 0); s.normalize();
  const m = [bx + d.x * len * 0.45, by + d.y * len * 0.45, bz + d.z * len * 0.45];
  P.tri([bx, by, bz, 0, 0], [m[0] + s.x * wid, m[1] + s.y * wid, m[2] + s.z * wid, 1, 0], [bx + d.x * len, by + d.y * len, bz + d.z * len, 2, 0], col);
  P.tri([bx, by, bz, 0, 0], [m[0] - s.x * wid, m[1] - s.y * wid, m[2] - s.z * wid, 1, 0], [bx + d.x * len, by + d.y * len, bz + d.z * len, 2, 0], col);
}
// 풀 모형의 공통 틀. tufts: 포기마다 [x, z, 크기 배율(stage 1,2,3)] 와 만드는 함수
function buildPlant(S, stage) {
  const root = new T.Group(), r = rng(S.seed || 3), tufts = [];
  S.tufts.forEach((tf, k) => {
    const sc = tf.s[stage - 1]; if (!sc) return;
    const g = G(root, tf.x, 0, tf.z), inner = G(g); inner.scale.setScalar(sc);
    S.tuft(inner, r, stage, k, tf);
    tufts.push({ g, k, ph: r() * 6.28, sc });
  });
  const ampl = S.sway || 0.04;
  function upd(dt, t, mode) {
    const wind = mode === "alert" ? 1.8 : mode === "move" ? 1.5 : 1;
    tufts.forEach(o => {
      o.g.rotation.z = ampl * wind * sin(t * 1.15 + o.ph + o.g.position.x * 2) + 0.01 * sin(t * 3.1 + o.ph);
      o.g.rotation.x = ampl * 0.7 * wind * sin(t * 0.9 + o.ph * 1.3 + o.g.position.z * 2);
    });
  }
  return { root, upd };
}
function makePlant(id, S, calY, opts) {
  const ref = buildPlant(S, 3), bb0 = measure(ref.root), s = calY / bb0.getSize(new T.Vector3()).y;
  ref.root.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  const group = new T.Group(); group.name = "gd_" + id;
  const holder = G(group); holder.scale.setScalar(s);
  let upd = () => {};
  const model = {
    id, group, kind: "plant", stage: 0, height: 0, length: 0, width: 0, tris: 0,
    setStage(n) {
      n = clamp(Math.round(n), 1, 3);
      for (let i = holder.children.length - 1; i >= 0; i--) { const c = holder.children[i]; c.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); holder.remove(c); }
      const r = buildPlant(S, n); holder.add(r.root); upd = r.upd;
      const bb = measure(r.root), sz = bb.getSize(new T.Vector3());
      model.stage = n; model.height = sz.y * s; model.length = sz.z * s; model.width = sz.x * s; model.tris = Math.round(countTris(r.root));
    },
    update(dt, t, mode) { upd(clamp(dt || 0, 0, 0.1), t || 0, mode || "idle"); },
    dispose() { holder.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); }
  };
  model.setStage(opts && opts.stage || 3);
  return model;
}

const PLANT = {};
PLANT.reed = () => ({ // 갈대: 키 큰 포기, 끝에 갈색 이삭
  seed: 5, sway: 0.05,
  tufts: [[0, 0, [0.16, 0.5, 1]], [0.22, 0.08, [0.14, 0.45, 0.92]], [-0.2, 0.1, [0, 0.4, 0.95]], [0.08, -0.22, [0, 0.35, 0.85]], [-0.14, -0.16, [0, 0, 0.9]], [0.3, -0.12, [0, 0, 0.8]]].map(a => ({ x: a[0], z: a[1], s: a[2] })),
  tuft(g, r, stage, k) {
    const h = 2.4 * (0.85 + 0.15 * r()), P = part(), lean = (r() - 0.5) * 0.2;
    P.tube([0, 0, 0], [lean * h * 0.3, h, 0], 0.014, 0.007, { n: 3, col: (x, y) => mix(0x8a9650, 0xc9b673, clamp(y / h, 0, 1)) });
    for (let i = 0; i < 3; i++) blade(P, 0, h * (0.18 + 0.17 * i), 0, h * 0.42, 0.04, 0.55 + 0.1 * i, 0.45, r() * 6.28, 0x8c9a4c, 0xb5ae62);
    put(g, P);
    if (stage >= 3) { const E = part(); E.ell([lean * h * 0.3, h + 0.2, 0], [0.04, 0.04, 0.2], { w: 5, h: 3, rot: [-PI / 2, 0, 0], col: (x, y) => mix(0xc8b48c, 0x9a8670, clamp((y - h) / 0.4, 0, 1)) }); put(g, E); }
  }
});
PLANT.spartina = () => ({ // 영국갯끈풀(불청객): 빽빽한 억센 포기, 연한 녹색
  seed: 6, sway: 0.035,
  tufts: [[0, 0, [0.35, 0.65, 1]], [0.2, 0.05, [0.3, 0.6, 0.95]], [-0.18, 0.1, [0, 0.55, 1]], [0.06, -0.2, [0, 0.5, 0.9]], [-0.12, -0.15, [0, 0, 0.9]], [0.28, -0.14, [0, 0, 0.8]], [-0.3, -0.05, [0, 0, 0.85]]].map(a => ({ x: a[0], z: a[1], s: a[2] })),
  tuft(g, r, stage) {
    const P = part(), h = 0.85 * (0.85 + 0.3 * r());
    for (let i = 0; i < 5; i++) blade(P, (r() - 0.5) * 0.05, 0, (r() - 0.5) * 0.05, h * (0.75 + 0.25 * r()), 0.03, 0.12 + 0.3 * r(), 0.3 * r(), i * 1.26 + r() * 0.6, 0x7d9a45, 0xb4c066);
    put(g, P);
    if (stage >= 3) { const E = part(); E.tube([0, h * 0.85, 0], [0.03, h * 1.2, 0.02], 0.008, 0.005, { n: 3, col: 0xcdc276 }); put(g, E); }
  }
});
PLANT.suaeda = () => ({ // 칠면초: 낮고 통통한 풀, 자라며 붉게 물든다
  seed: 7, sway: 0.03,
  tufts: [[0, 0, [0.5, 0.8, 1]], [0.14, 0.07, [0.45, 0.75, 0.95]], [-0.13, 0.1, [0, 0.7, 1]], [0.05, -0.14, [0, 0.65, 0.9]], [-0.1, -0.12, [0, 0, 0.9]], [0.2, -0.08, [0, 0, 0.85]], [-0.24, -0.02, [0, 0, 0.8]]].map(a => ({ x: a[0], z: a[1], s: a[2] })),
  tuft(g, r, stage) {
    const P = part(), c0 = [0x6fa64a, 0xb08a4a, 0xb0243a][stage - 1], c1 = [0x9bc965, 0xcf6a48, 0x7a2160][stage - 1];
    for (let i = 0; i < 4; i++) {
      const a = i * 1.57 + r(), l = 0.12 + 0.2 * r(), h = 0.2 + 0.15 * r(), lx = cos(a) * l, lz = sin(a) * l;
      P.tube([0, 0, 0], [lx, h, lz], 0.024, 0.014, { n: 3, col: (x, y) => mix(c0, c1, clamp(y / 0.35, 0, 1)) });
      P.tube([lx, h, lz], [lx * 1.25, h + 0.07, lz * 1.25], 0.009, 0.001, { n: 3, col: c1 });
    }
    put(g, P);
  }
});
PLANT.rugosa = () => ({ // 해당화: 가시 돋은 관목, 분홍 꽃과 붉은 열매
  seed: 8, sway: 0.03,
  tufts: [[0, 0, [0.22, 0.55, 1]], [0.2, 0.1, [0.2, 0.5, 0.95]], [-0.22, 0.05, [0, 0.5, 0.95]], [0.08, -0.22, [0, 0.45, 0.9]], [-0.12, -0.2, [0, 0, 0.85]], [0.3, -0.12, [0, 0, 0.8]]].map(a => ({ x: a[0], z: a[1], s: a[2] })),
  tuft(g, r, stage) {
    const P = part(), h = 1.1 * (0.8 + 0.3 * r()), tx = (r() - 0.5) * 0.4, tz = (r() - 0.5) * 0.4;
    P.tube([0, 0, 0], [tx * 0.5, h * 0.55, tz * 0.5], 0.02, 0.014, { n: 3, col: 0x6b4a35 });
    P.tube([tx * 0.5, h * 0.55, tz * 0.5], [tx, h, tz], 0.014, 0.008, { n: 3, col: 0x7a5640 });
    for (let i = 0; i < 11; i++) {
      const f = 0.2 + 0.8 * (i / 10), a = i * 2.4 + r(), by = h * f, bx = lerp(0, tx, f), bz = lerp(0, tz, f);
      leafD(P, bx, by, bz, cos(a), 0.35, sin(a), 0.26, 0.075, (x, y, z, k) => mix(0x4a7a3a, 0x6f9a48, k / 2));
    }
    if (stage >= 3) {
      P.poly([[tx + 0.0, h + 0.04, tz], [tx + 0.1, h + 0.08, tz + 0.01], [tx + 0.07, h + 0.13, tz + 0.1], [tx - 0.05, h + 0.13, tz + 0.09], [tx - 0.09, h + 0.08, tz - 0.01]], 0xd9468a);
      P.quad([tx - 0.025, h + 0.14, tz + 0.03], [tx + 0.025, h + 0.14, tz + 0.03], [tx + 0.025, h + 0.14, tz + 0.07], [tx - 0.025, h + 0.14, tz + 0.07], 0xf0c040);
      [[0.1, -0.2, 0.6], [-0.12, 0.1, 0.45]].forEach(q => P.ell([tx * q[2] + q[0], h * q[2], tz * q[2] + q[1]], [0.035, 0.035, 0.035], { w: 4, h: 2, col: 0xd4452a }));
    }
    put(g, P);
  }
});
const PLANT_CAL = { reed: 2.6, spartina: 0.95, suaeda: 0.35, rugosa: 1.25 };
Object.keys(PLANT).forEach(id => { REG[id] = (opts) => makePlant(id, PLANT[id](), PLANT_CAL[id], opts); });

/* ====================================================================== */
/*                         네발짐승 (노루, 수달 …)                          */
/* ====================================================================== */
const DEFPROF = [[-1, 0.12, 0.12], [-0.85, 0.62, 0.7], [-0.5, 0.95, 1], [0, 1, 1], [0.5, 0.95, 0.95], [0.85, 0.7, 0.75], [1, 0.3, 0.3]];

function buildQuad(S) {
  const O = S.cols, root = new T.Group(), hip = S.hip, pitch0 = S.pitch || 0;
  const torso = G(root, 0, hip, 0), tilt = G(torso);
  tilt.rotation.x = -pitch0;
  const stn = (S.prof || DEFPROF).map(p => ({ z: p[0] * S.bl, rx: p[1] * S.bw, ry: p[2] * S.bh, cy: (p[3] || 0) * S.bh }));
  const bp = part();
  bp.loft(stn, { n: S.n || 8, col: O.body });
  if (S.bodyX) S.bodyX(bp, S, stn);
  put(tilt, bp);
  if (S.haunch) { const hp = part(); [1, -1].forEach(sd => hp.ell([sd * S.bw * 0.78, -S.bh * 0.05, -S.bl * 0.55], S.haunch, { w: 5, h: 3, col: O.body })); put(tilt, hp); }
  if (S.flaps) { const fl = part(); S.flaps(fl, S); put(tilt, fl); }

  // 다리
  const LG = S.legs, legLen = hip - S.bh * 0.15, legs = [];
  [[1, LG.zf, LG.rf], [-1, LG.zf, LG.rf], [1, LG.zh, LG.rh], [-1, LG.zh, LG.rh]].forEach((a, i) => {
    const g = G(root, a[0] * S.bw * LG.x, hip - S.bh * 0.15, a[1] * S.bl), P = part();
    const r = a[2];
    P.tube([0, 0, 0], [0, -legLen, 0], r, r * 0.5, { n: 4, col: (x, y) => y < -legLen * 0.88 ? (O.hoof || O.leg) : O.leg });
    if (LG.toe) P.poly([[0, -legLen + 0.002, -LG.toe * 0.2], [LG.toe * 0.5, -legLen + 0.002, LG.toe * 0.8], [-LG.toe * 0.5, -legLen + 0.002, LG.toe * 0.8]], O.hoof || O.leg);
    put(g, P); legs.push(g);
  });

  // 목과 머리
  const nl = S.neck.l, n1 = G(tilt, 0, S.bh * (S.neck.y === undefined ? 0.35 : S.neck.y), S.bl * (S.neck.z || 0.8));
  n1.rotation.order = "YXZ";
  const np = part(); np.tube([0, 0, 0], [0, nl, 0], S.neck.r0, S.neck.r1, { n: 6, col: O.neck || O.body, cap: true }); put(n1, np);
  const hd = G(n1, 0, nl, 0), [hx, hy, hz] = S.head.r, hp = part();
  hp.ell([0, 0, hz * 0.4], [hx, hy, hz * 0.62], { w: 7, h: 4, col: O.head });
  const sl = S.head.sl, sr = S.head.sr;
  hp.loft([{ z: hz * 0.7, rx: sr[0], ry: sr[1] }, { z: hz * 0.7 + sl * 0.55, rx: sr[0] * 0.82, ry: sr[1] * 0.78 }, { z: hz * 0.7 + sl, rx: sr[0] * 0.6, ry: sr[1] * 0.55 }], { n: 6, col: O.snout || O.head });
  hp.ell([0, sr[1] * 0.3, hz * 0.7 + sl], [sr[0] * 0.5, sr[1] * 0.4, sr[0] * 0.35], { w: 4, h: 2, col: O.nose || 0x1d1a18 });
  [1, -1].forEach(sd => hp.patch([sd * hx * 0.93, hy * 0.28, hz * 0.52], [sd, 0.15, 0.1], hy * 0.26, 0x14110e, 0.0025));
  if (S.headX) S.headX(hp, S);
  put(hd, hp);
  const ears = [];
  if (S.ear) [1, -1].forEach(sd => {
    const eg = G(hd, ...S.ear.pos(hx, hy, hz, sd)), ep = part(); S.ear.build(ep, sd); put(eg, ep); ears.push({ g: eg, sd });
  });

  // 꼬리
  const tailG = G(tilt, 0, S.bh * (S.tailY === undefined ? 0.2 : S.tailY), -S.bl * 0.97);
  if (S.tail) { const tp = part(); S.tail(tp, S); put(tailG, tp); }
  if (S.extra) S.extra({ root, tilt, hd, n1, tailG, S });

  const rest = S.neck, F = S.feed || {}, A = S.alert || {}, R = S.rest || {};
  const cur = { a1: rest.a, hd: rest.hd, pitch: pitch0, crouch: 0, tailUp: 0, ear: 0, yawN: 0, yawH: 0, y: 0 };
  const ph = (S.seed || 1) * 1.9, walk = S.walk || 5;
  function upd(dt, t, mode) {
    const tg = { a1: rest.a, hd: rest.hd, pitch: pitch0, crouch: 0, tailUp: 0, ear: 0, yawN: 0, yawH: 0, y: 0 };
    let lg = 0;
    const look = sin(t * 0.33 + ph) * sin(t * 0.87 + ph * 2);
    if (mode === "idle") { tg.yawH = look * 0.6; tg.yawN = look * 0.2; tg.ear = 0.15 * sin(t * 0.7 + ph) * (sin(t * 0.23 + ph) > 0.7 ? 3 : 0); }
    else if (mode === "feed") { const c = 0.5 + 0.5 * sin(t * 3 + ph); tg.a1 = F.a1 !== undefined ? F.a1 : rest.a + 0.9; tg.hd = (F.hd !== undefined ? F.hd : 1.0) + 0.1 * c; tg.pitch = pitch0 - (F.pitch || 0.1); tg.crouch = F.crouch || 0; tg.yawN = sin(t * 0.5 + ph) * 0.12; }
    else if (mode === "alert") { tg.a1 = A.a1 !== undefined ? A.a1 : rest.a - 0.25; tg.hd = A.hd !== undefined ? A.hd : 0.0; tg.pitch = pitch0 + 0.06; tg.tailUp = 1; tg.ear = 0.5; tg.yawN = sin(t * 0.8 + ph) * 0.5; tg.yawH = sin(t * 1.5 + ph) * 0.2; }
    else if (mode === "move") { lg = walk; tg.y = abs(sin(t * walk)) * 0.02; tg.yawH = look * 0.15; tg.a1 = rest.a + 0.05 * sin(t * walk * 2 + ph); }
    else if (mode === "rest") { tg.crouch = R.crouch !== undefined ? R.crouch : 0.6; tg.a1 = R.a1 !== undefined ? R.a1 : rest.a + 0.3; tg.hd = R.hd !== undefined ? R.hd : rest.hd + 0.4; tg.pitch = pitch0 * 0.5; }
    for (const k in cur) cur[k] = damp(cur[k], tg[k], dt, k === "y" ? 12 : 5);
    tilt.rotation.x = -cur.pitch;
    n1.rotation.x = cur.a1; n1.rotation.y = cur.yawN;
    hd.rotation.x = cur.hd + cur.pitch - cur.a1; hd.rotation.y = cur.yawH;
    const cr = cur.crouch * 0.6;
    torso.position.y = hip - cr * legLen * 0.9 + cur.y;
    legs.forEach(l => { l.scale.y = 1 - cr * 0.9; });
    tilt.scale.y = 1 + 0.012 * sin(t * 1.8 + ph);
    if (lg) { const a = sin(t * lg) * 0.55; legs[0].rotation.x = a; legs[3].rotation.x = a; legs[1].rotation.x = -a; legs[2].rotation.x = -a; }
    else legs.forEach(l => { l.rotation.x = damp(l.rotation.x, 0, dt, 10); });
    tailG.rotation.x = cur.tailUp * (S.tailLift || 0.5);
    tailG.rotation.y = 0.25 * sin(t * (mode === "move" ? 7 : 1.7) + ph) * (S.tailWag === undefined ? 1 : S.tailWag);
    ears.forEach(e => { e.g.rotation.z = e.sd * (S.ear.flick || 0.3) * cur.ear * 2 + e.sd * 0.02 * sin(t * 2 + ph); });
  }
  return { root, upd };
}

function earLeaf(len, wid, col, tilt, thick) { // 납작한 귀
  return (P, sd) => P.loft([{ z: 0, rx: wid * 0.6, ry: thick || 0.004 }, { z: len * 0.45, rx: wid, ry: thick || 0.004 }, { z: len, rx: 0, ry: 0 }], { n: 4, col, rot: [0, 0, 0], m: mat4([0, 0, 0], [-tilt[0], sd * tilt[1], sd * tilt[2]]) });
}
const MAM = {};

MAM.otter = () => ({ // 수달: 길고 낮은 몸, 굵은 꼬리, 밝은 턱과 배
  seed: 1, hip: 0.1, bl: 0.3, bh: 0.075, bw: 0.065, pitch: 0, walk: 7, n: 7,
  legs: { x: 0.7, zf: 0.6, zh: -0.62, rf: 0.02, rh: 0.024, toe: 0.04 },
  neck: { l: 0.06, r0: 0.05, r1: 0.044, a: 0.7, hd: 0.5 }, head: { r: [0.043, 0.04, 0.09], sl: 0.025, sr: [0.032, 0.022] },
  cols: { body: (x, y) => y < -0.025 ? 0xb89d7c : 0x5a4330, leg: 0x4b3827, head: (x, y, z) => y < -0.01 && z > 0.03 ? 0xc3a888 : 0x56402e, snout: 0xc3a888, neck: 0x5a4330 },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.7, hy * 0.7, hz * 0.1], build: earLeaf(0.02, 0.012, 0x56402e, [-0.9, 0.5, 0.3]), flick: 0.2 },
  tail: (P) => P.loft([{ z: 0.02, rx: 0.036, ry: 0.034 }, { z: -0.1, rx: 0.04, ry: 0.036 }, { z: -0.25, rx: 0.025, ry: 0.022, cy: -0.01 }, { z: -0.4, rx: 0.003, ry: 0.003, cy: -0.02 }], { n: 6, col: 0x4f3a29 }),
  feed: { a1: 1.5, hd: 1.0, pitch: 0.1, crouch: 0.3 }, alert: { a1: 0.2, hd: 0.2 }, rest: { crouch: 0.8, a1: 0.9, hd: 0.9 }
});
MAM.badger = () => ({ // 오소리: 낮고 땅딸막한 몸, 흰 얼굴에 눈을 지나는 검은 줄
  seed: 2, hip: 0.17, bl: 0.3, bh: 0.125, bw: 0.115, pitch: -0.03, walk: 6, n: 8,
  legs: { x: 0.68, zf: 0.6, zh: -0.62, rf: 0.032, rh: 0.034, toe: 0.05 },
  neck: { l: 0.07, r0: 0.08, r1: 0.07, a: 0.6, hd: 0.5 }, head: { r: [0.06, 0.055, 0.11], sl: 0.07, sr: [0.04, 0.032] },
  cols: { body: (x, y) => y < -0.05 ? 0x2c2926 : 0x7e7970, leg: 0x2a2724, head: 0xe9e5da, neck: 0x6a665e, snout: 0xe9e5da, nose: 0x14110f },
  headX: (P, S) => { [1, -1].forEach(sd => P.tube([sd * 0.03, 0.043, 0.2], [sd * 0.048, 0.04, 0.02], 0.014, 0.016, { n: 3, col: 0x24211e })); },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.75, hy * 0.7, hz * 0.0], build: earLeaf(0.03, 0.022, 0x2c2926, [-0.7, 0.6, 0.3]), flick: 0.2 },
  tail: (P) => P.loft([{ z: 0.0, rx: 0.04, ry: 0.04 }, { z: -0.08, rx: 0.045, ry: 0.04 }, { z: -0.16, rx: 0.004, ry: 0.004 }], { n: 5, col: 0x7e7970 }),
  feed: { a1: 1.4, hd: 1.0, pitch: 0.1, crouch: 0.25 }, alert: { a1: 0.1, hd: 0.2 }, rest: { crouch: 0.8, a1: 0.9, hd: 0.9 }
});
MAM.goral = () => ({ // 산양: 회갈색 털, 흰 턱밑, 뒤로 휘는 짧은 검은 뿔
  seed: 3, hip: 0.45, bl: 0.46, bh: 0.17, bw: 0.12, pitch: 0.02, walk: 4.6, n: 8,
  legs: { x: 0.65, zf: 0.62, zh: -0.62, rf: 0.036, rh: 0.04 },
  neck: { l: 0.2, r0: 0.085, r1: 0.06, a: 0.55, hd: 0.7, y: 0.45 }, head: { r: [0.055, 0.065, 0.13], sl: 0.06, sr: [0.04, 0.045] },
  cols: { body: (x, y) => y < -0.1 ? 0xb39e80 : 0x76624c, leg: 0x99835f, hoof: 0x24201d, head: (x, y, z) => y < -0.01 && z > 0.05 ? 0xe8e1d3 : 0x6f5c48, neck: (x, y) => y > 0.1 ? 0x6f5c48 : 0xe8e1d3, snout: 0xcfc3ad, nose: 0x1d1a18 },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.85, hy * 0.6, hz * 0.15], build: earLeaf(0.07, 0.025, 0x6f5c48, [-0.2, 1.1, 0.5]), flick: 0.25 },
  headX: (P) => [1, -1].forEach(sd => { P.tube([sd * 0.025, 0.055, 0.05], [sd * 0.03, 0.15, -0.0], 0.016, 0.008, { n: 4, col: 0x252220 }); P.tube([sd * 0.03, 0.15, -0.0], [sd * 0.03, 0.17, -0.07], 0.008, 0.002, { n: 4, col: 0x252220 }); }),
  tail: (P) => P.tube([0, 0, 0], [0, -0.03, -0.07], 0.02, 0.005, { n: 3, col: 0x5a4a39 }),
  feed: { a1: 2.5, hd: 1.3, pitch: 0.2, crouch: 0.3 }, alert: { a1: 0.1, hd: 0.2 }, rest: { crouch: 0.75, a1: 0.7, hd: 0.8 }
});
const spotsFn = (list) => (P, S, stn) => list.forEach(a => { const q = surf(stn, a[0] * S.bl, a[1]); P.patch(q.p, q.n, a[2], a[3], 0.002); });
MAM.roedeer = () => ({ // 노루: 붉은 갈색, 엉덩이의 흰 무늬, 큰 귀, 가는 다리, 작은 뿔(수컷)
  seed: 4, hip: 0.56, bl: 0.58, bh: 0.17, bw: 0.12, pitch: -0.05, walk: 4.2, n: 8,
  legs: { x: 0.62, zf: 0.62, zh: -0.7, rf: 0.026, rh: 0.032 },
  neck: { l: 0.3, r0: 0.075, r1: 0.045, a: 0.5, hd: 0.55, y: 0.5 }, head: { r: [0.05, 0.058, 0.115], sl: 0.08, sr: [0.034, 0.036] },
  cols: { body: (x, y, z) => z < -0.5 && y > -0.12 ? 0xf1ebdd : y < -0.1 ? 0xd9c3a0 : 0x9a6a45, leg: 0xb08a62, hoof: 0x2a2420, head: 0x946443, neck: 0x9a6a45, snout: 0xcba57a, nose: 0x16120f },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.8, hy * 0.7, hz * 0.0], build: earLeaf(0.1, 0.035, 0x9d5f38, [-0.1, 1.0, 0.7]), flick: 0.3 },
  headX: (P) => [1, -1].forEach(sd => { P.tube([sd * 0.025, 0.05, 0.03], [sd * 0.035, 0.16, -0.02], 0.009, 0.006, { n: 3, col: 0xd9ceb4 }); P.tube([sd * 0.035, 0.12, -0.0], [sd * 0.035, 0.17, 0.06], 0.006, 0.002, { n: 3, col: 0xd9ceb4 }); }),
  tail: (P) => P.tube([0, 0, 0], [0, -0.02, -0.04], 0.015, 0.004, { n: 3, col: 0xf1ebdd }),
  feed: { a1: 2.4, hd: 1.2, pitch: 0.2, crouch: 0.15 }, alert: { a1: 0.1, hd: 0.15 }, rest: { crouch: 0.75, a1: 0.5, hd: 0.7 }
});
MAM.sika = () => ({ // 꽃사슴(불청객): 붉은 갈색 몸에 흰 점, 가지 갈라진 뿔
  seed: 5, hip: 0.68, bl: 0.72, bh: 0.21, bw: 0.14, pitch: -0.04, walk: 4, n: 8,
  legs: { x: 0.62, zf: 0.62, zh: -0.7, rf: 0.03, rh: 0.036 },
  neck: { l: 0.4, r0: 0.09, r1: 0.055, a: 0.5, hd: 0.55, y: 0.5 }, head: { r: [0.055, 0.065, 0.13], sl: 0.1, sr: [0.038, 0.04] },
  cols: { body: (x, y, z) => z < -0.62 && y > -0.12 ? 0xf0e4cc : y < -0.14 ? 0xe3cfa6 : 0x9c5c36, leg: 0xb87a4c, hoof: 0x2a2420, head: 0x9a5430, neck: 0xa8582f, snout: 0xc89a6c, nose: 0x16120f },
  bodyX: (P, S, stn) => spotsFn([[-0.3, 0.9, 0.022], [-0.1, 1.2, 0.022], [0.15, 0.8, 0.022], [0.35, 1.1, 0.022], [0.55, 0.7, 0.02], [-0.45, 0.6, 0.02], [-0.25, 0.2, 0.022], [0.05, 0.3, 0.022], [0.3, 0.3, 0.022], [-0.2, 2.9, 0.022], [0.05, 2.7, 0.022], [0.3, 2.8, 0.022], [-0.4, 2.5, 0.02]].map(a => [a[0], a[1], a[2], 0xf3ead6]))(P, S, stn),
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.8, hy * 0.7, hz * 0.0], build: earLeaf(0.11, 0.04, 0x9a5430, [-0.1, 1.0, 0.7]), flick: 0.3 },
  headX: (P) => [1, -1].forEach(sd => { P.tube([sd * 0.03, 0.055, 0.03], [sd * 0.06, 0.2, -0.04], 0.011, 0.008, { n: 3, col: 0xd9ceb4 }); P.tube([sd * 0.05, 0.14, -0.02], [sd * 0.05, 0.2, 0.08], 0.007, 0.002, { n: 3, col: 0xd9ceb4 }); P.tube([sd * 0.06, 0.2, -0.04], [sd * 0.08, 0.3, -0.1], 0.008, 0.002, { n: 3, col: 0xd9ceb4 }); }),
  tail: (P) => P.tube([0, 0, 0], [0, -0.02, -0.07], 0.02, 0.006, { n: 3, col: 0xe8dcc2 }),
  feed: { a1: 2.4, hd: 1.2, pitch: 0.2, crouch: 0.15 }, alert: { a1: 0.1, hd: 0.15 }, rest: { crouch: 0.75, a1: 0.5, hd: 0.7 }
});
MAM.hare = () => ({ // 멧토끼: 갈색 몸, 긴 귀와 굵은 뒷다리, 하얀 배
  seed: 6, hip: 0.12, bl: 0.22, bh: 0.085, bw: 0.07, pitch: -0.2, walk: 8, n: 7, haunch: [0.045, 0.085, 0.1],
  legs: { x: 0.7, zf: 0.62, zh: -0.55, rf: 0.014, rh: 0.02, toe: 0.04 },
  neck: { l: 0.05, r0: 0.05, r1: 0.04, a: 0.7, hd: 0.6, y: 0.4 }, head: { r: [0.042, 0.045, 0.085], sl: 0.035, sr: [0.028, 0.026] },
  cols: { body: (x, y) => y < -0.05 ? 0xefe9dc : 0xa9855c, leg: 0xb59268, head: 0xa8845a, neck: 0xa9855c, snout: 0xcdb28c, nose: 0x3a2a24 },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.55, hy * 0.7, hz * 0.05], build: (P, sd) => { P.loft([{ z: 0, rx: 0.02, ry: 0.004 }, { z: 0.06, rx: 0.026, ry: 0.004 }, { z: 0.13, rx: 0.016, ry: 0.004 }, { z: 0.16, rx: 0.002, ry: 0.002 }], { n: 4, col: (x, y, z, i) => i >= 2 ? 0x2a2622 : 0xa9855c, m: mat4([0, 0, 0], [-1.9, sd * 0.25, sd * 0.15]) }); }, flick: 0.35 },
  tail: (P) => P.ell([0, 0.01, -0.02], [0.022, 0.025, 0.03], { w: 5, h: 3, col: 0xf2ede2 }),
  feed: { a1: 1.4, hd: 1.1, pitch: 0.1, crouch: 0.25 }, alert: { a1: 0.2, hd: 0.1, pitch: 0.25 }, rest: { crouch: 0.9, a1: 0.9, hd: 0.9 }
});
MAM.chipmunk = () => ({ // 다람쥐: 작은 몸, 등의 검은 줄 다섯 개, 위로 든 꼬리
  seed: 7, hip: 0.05, bl: 0.075, bh: 0.04, bw: 0.036, pitch: 0.18, walk: 11, n: 7,
  legs: { x: 0.7, zf: 0.6, zh: -0.6, rf: 0.008, rh: 0.01, toe: 0.02 },
  neck: { l: 0.025, r0: 0.026, r1: 0.024, a: 0.6, hd: 0.4 }, head: { r: [0.027, 0.028, 0.05], sl: 0.02, sr: [0.016, 0.015] },
  cols: { body: (x, y) => y < -0.015 ? 0xf0e8d8 : 0xb78a52, leg: 0xc5a070, head: 0xb28350, neck: 0xb78a52, snout: 0xd8c09a, nose: 0x2a2220 },
  bodyX: (P, S) => [-0.022, -0.011, 0, 0.011, 0.022].forEach((x, i) => { const y = S.bh * Math.sqrt(Math.max(0.05, 1 - (x / S.bw) * (x / S.bw))) + 0.001; P.tube([x, y, 0.03], [x, y, -0.065], 0.0035, 0.0035, { n: 3, col: i % 2 ? 0xe9d6ae : 0x2a211a }); }),
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.75, hy * 0.75, hz * 0.0], build: earLeaf(0.018, 0.012, 0xa5784a, [-0.9, 0.7, 0.3]), flick: 0.2 },
  tail: (P) => P.loft([{ z: 0.0, rx: 0.014, ry: 0.014 }, { z: -0.04, rx: 0.02, ry: 0.016, cy: 0.025 }, { z: -0.08, rx: 0.022, ry: 0.014, cy: 0.07 }, { z: -0.1, rx: 0.004, ry: 0.004, cy: 0.11 }], { n: 5, col: 0x9b7447 }),
  feed: { a1: 1.2, hd: 1.0, pitch: 0.2, crouch: 0.3 }, alert: { a1: 0.2, hd: 0.2, pitch: 0.4 }, rest: { crouch: 0.9, a1: 0.7, hd: 0.7 }
});
MAM.redsquirrel = () => ({ // 청설모: 회갈색 털, 흰 배, 크고 풍성한 꼬리, 귀 끝의 털
  seed: 8, hip: 0.07, bl: 0.1, bh: 0.055, bw: 0.045, pitch: 0.4, walk: 9, n: 7,
  legs: { x: 0.7, zf: 0.6, zh: -0.6, rf: 0.01, rh: 0.014, toe: 0.025 },
  neck: { l: 0.03, r0: 0.036, r1: 0.032, a: 0.5, hd: 0.5 }, head: { r: [0.033, 0.034, 0.06], sl: 0.022, sr: [0.02, 0.019] },
  cols: { body: (x, y, z) => y < -0.02 ? 0xeee8dc : 0x6f6558, leg: 0x61574b, head: 0x6c6255, neck: 0x6f6558, snout: 0xcfc4b0, nose: 0x1d1a18 },
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.7, hy * 0.8, hz * 0.0], build: (P, sd) => { earLeaf(0.025, 0.014, 0x5b5247, [-0.9, 0.5, 0.2])(P, sd); P.tube([0, 0.0, 0.022], [sd * 0.005, 0.01, 0.05], 0.004, 0.001, { n: 3, col: 0x453d34 }); }, flick: 0.2 },
  tail: (P) => P.loft([{ z: 0.0, rx: 0.018, ry: 0.018 }, { z: -0.06, rx: 0.03, ry: 0.028, cy: 0.03 }, { z: -0.09, rx: 0.036, ry: 0.032, cy: 0.1 }, { z: -0.06, rx: 0.03, ry: 0.028, cy: 0.17 }, { z: -0.03, rx: 0.003, ry: 0.003, cy: 0.2 }], { n: 6, col: (x, y, z, i) => mix(0x5f564a, 0x8c8272, i / 4) }),
  feed: { a1: 1.0, hd: 0.9, pitch: 0.25, crouch: 0.25 }, alert: { a1: 0.0, hd: 0.2, pitch: 0.55 }, rest: { crouch: 0.9, a1: 0.7, hd: 0.7 }
});
MAM.flyingsquirrel = () => ({ // 하늘다람쥐: 큰 눈, 회갈색 몸, 옆구리의 날개막, 납작하고 넓은 꼬리
  seed: 9, hip: 0.05, bl: 0.08, bh: 0.04, bw: 0.045, pitch: 0.15, walk: 10, n: 7,
  legs: { x: 0.75, zf: 0.55, zh: -0.55, rf: 0.009, rh: 0.011, toe: 0.02 },
  neck: { l: 0.025, r0: 0.032, r1: 0.03, a: 0.5, hd: 0.4 }, head: { r: [0.032, 0.033, 0.055], sl: 0.015, sr: [0.017, 0.016] },
  cols: { body: (x, y) => y < -0.02 ? 0xece6da : 0x9a8f80, leg: 0x8a7f70, head: 0x9a8f80, neck: 0x9a8f80, snout: 0xcfc6b6, nose: 0x1d1a18 },
  flaps: (P) => [1, -1].forEach(sd => P.poly([[sd * 0.04, -0.005, 0.045], [sd * 0.085, -0.025, 0.04], [sd * 0.09, -0.03, -0.04], [sd * 0.04, -0.005, -0.05]], 0x857a6b)),
  headX: (P) => [1, -1].forEach(sd => P.patch([sd * 0.03, 0.01, 0.035], [sd, 0.2, 0.2], 0.008, 0x0c0a08, 0.004)),
  ear: { pos: (hx, hy, hz, sd) => [sd * hx * 0.7, hy * 0.8, hz * 0.0], build: earLeaf(0.02, 0.012, 0x8a7f70, [-0.9, 0.5, 0.2]), flick: 0.2 },
  tail: (P) => P.loft([{ z: 0.0, rx: 0.012, ry: 0.01 }, { z: -0.06, rx: 0.03, ry: 0.008 }, { z: -0.13, rx: 0.034, ry: 0.007 }, { z: -0.15, rx: 0.002, ry: 0.002 }], { n: 4, col: 0x8d8272 }),
  feed: { a1: 1.1, hd: 1.0, pitch: 0.2, crouch: 0.3 }, alert: { a1: 0.1, hd: 0.2, pitch: 0.35 }, rest: { crouch: 0.9, a1: 0.7, hd: 0.7 }
});
const MAM_CAL = { otter: ["z", 1.1], badger: ["z", 0.78], goral: ["y", 0.85], roedeer: ["y", 0.95], sika: ["y", 1.3], hare: ["z", 0.55], chipmunk: ["z", 0.25], redsquirrel: ["y", 0.3], flyingsquirrel: ["z", 0.27] };
Object.keys(MAM).forEach(id => {
  REG[id] = () => { const r = buildQuad(MAM[id]()); return finish(id, r.root, MAM_CAL[id], r.upd, { kind: "mammal" }); };
});

/* ====================================================================== */
/*                              점박이물범                                  */
/* ====================================================================== */
REG.seal = () => {
  const root = new T.Group(), L = 1.5, ry = 0.2, rx = 0.24, cy = ry;
  const prof = [[0.72, 0.12, 0.12], [0.52, 0.22, 0.18], [0.2, 0.25, 0.2], [-0.1, 0.22, 0.18], [-0.4, 0.16, 0.13], [-0.65, 0.09, 0.08], [-0.78, 0.035, 0.045]];
  const front = prof.slice(0, 4).map(p => ({ z: p[0], rx: p[1], ry: p[2], cy: p[2] })), pivZ = -0.1;
  const rear = [prof[3]].concat(prof.slice(4)).map(p => ({ z: p[0] - pivZ, rx: p[1], ry: p[2], cy: p[2] }));
  const body = G(root), fp = part(), rp = part();
  const colf = (sh) => (x, y, z, i, th) => sin(th) > 0.5 ? 0x7e7f7e : sin(th) < -0.2 ? 0xd0cdc5 : 0x9a9b99;
  fp.loft(front, { n: 8, col: colf(0) }); rp.loft(rear, { n: 8, col: colf(pivZ) });
  const rnd = rng(11);
  for (let i = 0; i < 22; i++) {
    const z = 0.6 - rnd() * 1.3, th = rnd() * 1.9 + 0.2, sd = rnd() < 0.5 ? 1 : -1;
    const useF = z > pivZ, st = useF ? front : rear, q = surf(st, z - (useF ? 0 : pivZ), sd > 0 ? th : PI - th);
    (useF ? fp : rp).patch(q.p, q.n, 0.03 + rnd() * 0.02, 0x3d3e3f, 0.002);
  }
  put(body, fp);
  const pivR = G(body, 0, 0, pivZ); put(pivR, rp);
  // 뒷지느러미 (모아 붙인 모양)
  const hf = part(); hf.poly([[0, ry * 0.5, 0], [0.16, ry * 0.5, -0.2], [0.1, ry * 0.45, -0.32], [-0.1, ry * 0.45, -0.32], [-0.16, ry * 0.5, -0.2]], 0x777877);
  const hfG = G(pivR, 0, 0, -0.72 - pivZ); put(hfG, hf);
  // 머리
  const neck = G(body, 0, ry * 1.2, 0.5), headG = G(neck, 0, 0, 0.0);
  const hp = part();
  hp.ell([0, 0.01, 0.11], [0.12, 0.11, 0.15], { w: 8, h: 5, col: (x, y) => y > 0.04 ? 0x7d7e7d : 0x9d9e9b });
  hp.ell([0, -0.01, 0.27], [0.06, 0.05, 0.055], { w: 6, h: 3, col: 0xa5a6a2 });
  hp.ell([0, 0.03, 0.32], [0.022, 0.015, 0.015], { w: 4, h: 2, col: 0x15130f });
  [1, -1].forEach(sd => { hp.patch([sd * 0.085, 0.03, 0.15], [sd, 0.1, 0.2], 0.016, 0x0f0d0b, 0.003); for (let k = 0; k < 2; k++) hp.tube([sd * 0.03, -0.015 + k * 0.012, 0.25], [sd * 0.1, -0.03 + k * 0.03, 0.27], 0.002, 0.001, { n: 3, col: 0xe8e4da }); });
  hp.patch([0.0, 0.085, 0.1], [0, 1, 0], 0.03, 0x3d3e3f, 0.002); hp.patch([0.045, 0.07, 0.04], [0.4, 1, 0], 0.025, 0x3d3e3f, 0.002); hp.patch([-0.05, 0.07, 0.06], [-0.4, 1, 0], 0.025, 0x3d3e3f, 0.002);
  put(headG, hp, 0, 0, 0);
  // 앞지느러미
  const ff = [1, -1].map(sd => { const g = G(body, sd * rx * 0.8, ry * 0.6, 0.35), P = part(); P.poly([[0, 0, 0], [sd * 0.17, -0.03, -0.1], [sd * 0.2, -0.04, -0.03], [sd * 0.12, -0.02, 0.06]], 0x808180); put(g, P); return g; });
  const cur = { head: 0.0, lift: 0 };
  function upd(dt, t, mode) {
    const tg = { head: 0, lift: 0 };
    let hr = 0.04 * sin(t * 1.3), crawl = 0;
    if (mode === "idle") { tg.head = 0.2 + 0.1 * sin(t * 0.4); }
    else if (mode === "feed") { tg.head = -0.5 + 0.3 * sin(t * 1.6); }
    else if (mode === "alert") { tg.head = 0.55; tg.lift = 1; }
    else if (mode === "move") { crawl = 1; tg.head = 0.25; }
    else if (mode === "rest") { tg.head = -0.15; }
    for (const k in cur) cur[k] = damp(cur[k], tg[k], dt, 4);
    neck.rotation.x = -cur.head;
    body.rotation.x = crawl ? 0.05 * sin(t * 6) : 0;
    body.position.y = crawl ? 0.015 + 0.02 * abs(sin(t * 6)) : 0;
    pivR.rotation.y = crawl ? 0.2 * sin(t * 6) : 0.03 * sin(t * 1.1);
    pivR.rotation.x = crawl ? 0.12 * sin(t * 6 + 1) : 0;
    body.scale.y = 1 + 0.015 * sin(t * 1.7);
    ff.forEach((g, i) => { const sd = i ? -1 : 1; g.rotation.y = sd * (crawl ? 0.5 * sin(t * 6 + i * PI) : 0.1 * sin(t * 1.2)); g.rotation.z = sd * -0.1; });
    hfG.rotation.x = 0.04 * sin(t * 1.4);
  }
  return finish("seal", root, ["z", 1.5], upd, { kind: "mammal" });
};

/* ====================================================================== */
/*                          구경꾼 (사람, 불청객)                           */
/* ====================================================================== */
REG.visitors = () => {
  const root = new T.Group(), hipY = 0.92;
  const body = G(root);
  const tp = part();
  tp.ell([0, 0, 0], [0.19, 0.115, 0.3], { w: 8, h: 5, rot: [-PI / 2, 0, 0], col: (x, y) => y > 0.16 ? 0x6f8f6a : 0x6f8f6a });
  const torso = G(body, 0, hipY + 0.28, 0); put(torso, tp);
  const bag = part(); bag.ell([0, 0, 0], [0.14, 0.08, 0.22], { w: 7, h: 4, rot: [-PI / 2, 0, 0], col: 0xb86b3a });
  put(torso, bag, 0, 0.0, -0.15);
  const bino = part(); bino.ell([0, 0, 0], [0.07, 0.035, 0.045], { w: 5, h: 3, col: 0x2a2a2c }); put(torso, bino, 0, 0.05, 0.12);
  const neck = G(body, 0, hipY + 0.6, 0), head = G(neck, 0, 0.12, 0);
  const hp = part();
  hp.ell([0, 0, 0], [0.085, 0.1, 0.095], { w: 8, h: 5, col: (x, y, z) => y > 0.075 ? 0x4f6a8a : 0xd8b090 });
  hp.poly([[-0.1, 0.075, 0.0], [0.1, 0.075, 0.0], [0.09, 0.07, 0.15], [-0.09, 0.07, 0.15]], 0x4f6a8a);
  put(head, hp);
  const legs = [1, -1].map(sd => { const g = G(body, sd * 0.09, hipY, 0), P = part(); P.tube([0, 0, 0], [0, -hipY, 0], 0.065, 0.045, { n: 5, col: (x, y) => y < -hipY * 0.92 ? 0x3a2f28 : 0x4a4a52 }); P.poly([[-0.05, -hipY + 0.01, -0.05], [0.05, -hipY + 0.01, -0.05], [0.05, -hipY + 0.01, 0.12], [-0.05, -hipY + 0.01, 0.12]], 0x3a2f28); put(g, P); return g; });
  const arms = [1, -1].map(sd => { const g = G(body, sd * 0.235, hipY + 0.52, 0), P = part(); P.tube([0, 0, 0], [sd * 0.02, -0.5, 0.04], 0.05, 0.04, { n: 5, col: (x, y) => y < -0.42 ? 0xd8b090 : 0x6f8f6a }); put(g, P); return g; });
  const cur = { lean: 0, arm: 0, crouch: 0 };
  function upd(dt, t, mode) {
    const tg = { lean: 0, arm: 0, crouch: 0 };
    let w = 0;
    if (mode === "feed") { tg.lean = 0.35; tg.crouch = 0.25; }
    else if (mode === "alert") { tg.arm = 1.8; }
    else if (mode === "move") { w = 5; }
    else if (mode === "rest") { tg.crouch = 0.12; tg.lean = 0.08; }
    for (const k in cur) cur[k] = damp(cur[k], tg[k], dt, 5);
    body.rotation.x = cur.lean; body.position.y = -cur.crouch * 0.3 + (w ? abs(sin(t * w)) * 0.03 : 0.006 * sin(t * 1.6));
    const a = w ? sin(t * w) * 0.6 : 0;
    legs[0].rotation.x = a - cur.crouch * 0.9; legs[1].rotation.x = -a - cur.crouch * 0.9;
    arms[0].rotation.x = -a * 0.8; arms[1].rotation.x = a * 0.8 - cur.arm;
    head.rotation.y = w ? 0 : sin(t * 0.4) * sin(t * 0.9) * 0.6;
  }
  return finish("visitors", root, ["y", 1.7], upd, { kind: "person" });
};

/* ====================================================================== */
const IDS = ["crane","stork","swan","kestrel","beangoose","wfgoose","mallard","eoreumchi","gamdol","otter","mandarin","ssogari","ayu","pirami","galgyeoni","beodeulchi","goral","flyingsquirrel","scopsowl","hawkowl","badger","roedeer","chipmunk","redsquirrel","hare","ghostcrab","spoonbillsandpiper","seal","rugosa","fiddler","sandbubbler","spoonbill","reed","suaeda","mudcrab","heron","visitors","bass","bluegill","sika","spartina"];
window.GD_SIMPLE = {
  ids: IDS.slice(),
  has(id) { return !!REG[id]; },
  make(id, opts) {
    if (!REG[id]) throw new Error("GD_SIMPLE: 모르는 id " + id);
    return REG[id](Object.assign({ stage: 3 }, opts || {}));
  }
};
})();
