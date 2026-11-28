/* 깃들 데모: 작은 도우미와 육각형 계산 */
(function () {
  const U = GD.util = {};

  // 씨앗으로 만드는 난수. 같은 씨앗이면 같은 차례가 나온다.
  U.rng = function (seed) {
    let a = seed | 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  };
  U.hashStr = function (s) { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };
  const hash = (x, y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  U.vnoise = function (x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (hash(xi, yi) * (1 - u) + hash(xi + 1, yi) * u) * (1 - v) + (hash(xi, yi + 1) * (1 - u) + hash(xi + 1, yi + 1) * u) * v;
  };
  U.fbm = (x, y) => U.vnoise(x, y) * .5 + U.vnoise(x * 2.1 + 7, y * 2.1 + 3) * .3 + U.vnoise(x * 4.3 + 1, y * 4.3 + 5) * .2;
  U.sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  U.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.pick = (arr, r) => arr[Math.floor(r() * arr.length)];

  // 받침에 따라 조사를 고른다. josa('두루미','이/가') -> '두루미가'
  U.josa = function (word, pair) {
    const [a, b] = pair.split('/');
    const c = word.charCodeAt(word.length - 1);
    let has = false;
    if (c >= 0xAC00 && c <= 0xD7A3) {
      const jong = (c - 0xAC00) % 28;
      has = jong !== 0;
      if (pair === '으로/로' && jong === 8) has = false;
    }
    return word + (has ? a : b);
  };
  // ['두루미','쇠기러기'] -> '두루미와 쇠기러기'
  U.joinNames = function (names) {
    if (!names.length) return '';
    let s = names[0];
    for (let i = 1; i < names.length; i++) s = (i === names.length - 1 ? U.josa(s, '과/와') + ' ' : s + ', ') + names[i];
    return s;
  };
  U.esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- 육각형 ----------
     뾰족한 쪽이 위아래를 보는 육각형이고, 칸의 자리는 (q, r) 두 숫자로 적는다.
     가운데가 (0,0)이고 둘레로 한 겹씩 늘어난다. 세 겹이면 37칸이다. */
  const H = GD.hex = {};
  const SQ3 = Math.sqrt(3);
  H.R = GD.CFG.hexR;
  H.key = (q, r) => q + ',' + r;
  H.parse = k => { const i = k.indexOf(','); return [+k.slice(0, i), +k.slice(i + 1)]; };
  H.center = (q, r) => [SQ3 * H.R * (q + r / 2), 1.5 * H.R * r];
  H.centerK = k => { const p = H.parse(k); return H.center(p[0], p[1]); };
  H.dist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
  H.distK = k => { const p = H.parse(k); return H.dist(p[0], p[1]); };
  H.at = function (x, z) {            // 땅 위의 한 점이 어느 칸인가
    const qf = (SQ3 / 3 * x - z / 3) / H.R, rf = (2 / 3 * z) / H.R, sf = -qf - rf;
    let q = Math.round(qf), r = Math.round(rf), s = Math.round(sf);
    const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
    return [q, r];
  };
  H.atK = (x, z) => { const p = H.at(x, z); return H.key(p[0], p[1]); };
  H.DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  H.neighbors = k => { const p = H.parse(k); return H.DIRS.map(d => H.key(p[0] + d[0], p[1] + d[1])); };
  H.ring = function (n) {              // n번째 겹의 칸들
    if (n === 0) return ['0,0'];
    const out = []; let q = -n, r = n;   // 왼쪽 아래에서 시작
    for (let d = 0; d < 6; d++) for (let i = 0; i < n; i++) { out.push(H.key(q, r)); q += H.DIRS[d][0]; r += H.DIRS[d][1]; }
    return out;
  };
  H.disk = function (n) { let out = []; for (let i = 0; i <= n; i++) out = out.concat(H.ring(i)); return out; };
  H.extent = rings => H.R * (1.5 * rings + 1);   // 가운데에서 가장 먼 꼭짓점까지
  // 화면(지도, 작은 그림)에 쓸 육각형의 꼭짓점. flat이면 납작한 쪽이 위.
  H.corners = function (cx, cy, rad, flat) {
    const pts = [];
    for (let i = 0; i < 6; i++) { const a = Math.PI / 180 * (60 * i + (flat ? 0 : 30)); pts.push([cx + rad * Math.cos(a), cy + rad * Math.sin(a)]); }
    return pts;
  };

  /* ---------- 알림 주고받기 ---------- */
  const subs = {};
  GD.on = (type, fn) => { (subs[type] = subs[type] || []).push(fn); };
  GD.emit = (type, a, b) => { (subs[type] || []).forEach(fn => { try { fn(a, b); } catch (e) { console.error('[깃들]', type, e); } }); };
})();
