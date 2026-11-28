/* 깃들 데모: 3D 땅
   육각형 칸에서 지형을 만들어 낸다. 걷는 화면과 가꾸는 화면이 같은 땅을 본다.
   - 지형: 육각형 칸을 잘게 나눈 세모 그물. 칸의 경계에서 높이와 색이 섞인다.
   - 칸을 바꾸면 그 칸과 이웃 칸의 풀과 나무만 다시 만든다(예전 맛보기는 전부 다시 지어서 끊겼다).
   - 그래픽 설정(낮음, 보통, 높음)에 따라 화소 수, 그림자, 물 반사, 후처리, 풀의 양이 달라진다. */
(function () {
  const CFG = GD.CFG, U = GD.util, H = GD.hex, V = GD.vis, WL = V.WL;
  const W3 = GD.w3 = {};
  const SQ3 = Math.sqrt(3), OUT = 2, BOT = -0.86;
  const C = (r, g, b) => new THREE.Color(r, g, b).convertSRGBToLinear();
  const HX = h => new THREE.Color(h).convertSRGBToLinear();
  let R, S, cam, Q, sun, hemi, dome, ground, comp = null, water = null, waterMat = null, NM = null;
  const uTime = { value: 0 };
  const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .9, envMapIntensity: .55 }, o || {}));
  W3.mat = mat; W3.C = C; W3.HX = HX; W3.uTime = uTime;

  /* ================= 처음 한 번 ================= */
  W3.init = function (canvas, quality) {
    Q = W3.Q = Object.assign({ id: quality }, CFG.quality[quality] || CFG.quality.mid);
    W3.canvas = canvas;
    R = W3.R = new THREE.WebGLRenderer({ canvas, antialias: Q.aa, powerPreference: 'high-performance' });
    R.shadowMap.enabled = Q.shadow > 0; R.shadowMap.type = Q.id === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    R.info.autoReset = false;
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = .9; R.outputEncoding = THREE.sRGBEncoding;
    S = W3.scene = new THREE.Scene();
    S.fog = new THREE.FogExp2(HX(0xe9d6ba), .007);
    cam = W3.cam = new THREE.PerspectiveCamera(29, 1, .05, 90);
    W3.LAND = new THREE.Group(); W3.OBJ = new THREE.Group(); W3.FAR = new THREE.Group(); W3.ACT = new THREE.Group(); W3.OUTG = new THREE.Group();
    S.add(W3.LAND, W3.OBJ, W3.FAR, W3.ACT, W3.OUTG);
    buildSky(); buildLights(); buildWaterTex(); buildSnow(); buildGeoms();
    resize(); buildPost();
    window.addEventListener('resize', resize);
  };

  function pixelRatio() {
    const w = window.innerWidth || 1, h = window.innerHeight || 1;
    let d = Math.min(window.devicePixelRatio || 1, Q.dpr);
    const max = { low: 1.3e6, mid: 2.4e6, high: 4.2e6 }[Q.id] || 2.4e6;     // 화면에 그리는 화소 수의 위
    if (w * h * d * d > max) d = Math.sqrt(max / (w * h));
    return d;
  }
  function resize() {
    const w = window.innerWidth || 1, h = window.innerHeight || 1, d = pixelRatio();
    W3.dpr = d; R.setPixelRatio(d); R.setSize(w, h, false);
    cam.aspect = w / h; cam.updateProjectionMatrix();
    if (comp) comp.setSize(w * d, h * d);
  }
  W3.resize = resize;

  /* ---------- 하늘 ---------- */
  const sunDir = new THREE.Vector3(-7, 3.4, -1.6).normalize(), skyTint = new THREE.Vector3(1, 1, 1);
  function buildSky() {
    // 물과 깃털에 비치는 하늘
    const sky = new THREE.Scene(), g = new THREE.SphereGeometry(30, 32, 24), col = [], p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).normalize(), e = v.y, c = new THREE.Color();
      if (e > 0) c.setRGB(.86, .74, .6).lerp(new THREE.Color(.36, .55, .82), U.sstep(0, .6, e)); else c.setRGB(.62, .54, .44);
      const s = Math.max(0, v.dot(sunDir)); c.r += Math.pow(s, 8) * .5 + Math.pow(s, 90) * 5; c.g += Math.pow(s, 8) * .33 + Math.pow(s, 90) * 3.6; c.b += Math.pow(s, 8) * .15 + Math.pow(s, 90) * 2;
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    sky.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, toneMapped: false })));
    const pm = new THREE.PMREMGenerator(R); S.environment = pm.fromScene(sky, .03).texture; pm.dispose(); g.dispose();
    // 눈에 보이는 하늘: 낮은 해와 엷은 구름
    const sm = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: { uTime, sunDir: { value: sunDir }, uTint: { value: skyTint } },
      vertexShader: 'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `varying vec3 vDir;uniform vec3 sunDir;uniform vec3 uTint;uniform float uTime;
      float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
      float fbm(vec2 p){return n(p)*.5+n(p*2.03+7.)*.25+n(p*4.1+3.)*.15+n(p*8.3)*.1;}
      void main(){vec3 d=normalize(vDir);float e=d.y;vec3 hor=vec3(.94,.86,.74),zen=vec3(.58,.72,.88),gnd=vec3(.93,.88,.79);
       vec3 c=e>0.?mix(hor,zen,smoothstep(0.,.5,e)):mix(hor,gnd,smoothstep(0.,-.3,e));
       float s=max(dot(d,sunDir),0.);c+=vec3(1.,.72,.42)*(pow(s,8.)*.3+pow(s,400.)*2.)*smoothstep(-.06,.03,e);
       if(e>.015){vec2 p=d.xz/(e+.14)*1.1+vec2(uTime*.004,0.);float cl=smoothstep(.5,.8,fbm(p))*smoothstep(.015,.16,e);vec3 cc=mix(vec3(1.,.95,.88),vec3(1.,.82,.66),pow(s,2.));c=mix(c,cc,cl*.8);}
       c*=uTint;c=pow(min(c,vec3(1.)),vec3(2.2));gl_FragColor=vec4(c,1.);
       #include <encodings_fragment>
      }`
    });
    dome = new THREE.Mesh(new THREE.SphereGeometry(70, 32, 20), sm); dome.renderOrder = -10; dome.frustumCulled = false; S.add(dome);
  }
  function buildLights() {
    hemi = new THREE.HemisphereLight(HX(0xc4d6ee), HX(0xe6caa4), .3); S.add(hemi);
    sun = new THREE.DirectionalLight(C(1, .79, .56), 2.3); S.add(sun); S.add(sun.target);
    if (Q.shadow) { sun.castShadow = true; sun.shadow.mapSize.set(Q.shadow, Q.shadow); sun.shadow.bias = -.0006; sun.shadow.normalBias = .014; }
    ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), Q.shadow ? new THREE.ShadowMaterial({ color: HX(0x5a4634), opacity: .2, fog: false }) : new THREE.MeshBasicMaterial({ visible: false }));
    ground.rotation.x = -Math.PI / 2; ground.position.y = BOT; ground.receiveShadow = true; S.add(ground);
  }

  /* 하루의 빛: t 는 0(새벽 시작)에서 1(밤 끝)까지 */
  const KEYS = [
    { t: 0.00, el: .16, az: -2.5, sun: [1, .62, .46], si: 1.1, hi: .24, tint: [.86, .74, .78], fog: [.80, .72, .72], ex: .66 },
    { t: 0.15, el: .30, az: -2.9, sun: [1, .79, .56], si: 2.2, hi: .30, tint: [1, 1, 1], fog: [.914, .84, .73], ex: .88 },
    { t: 0.40, el: .52, az: -3.5, sun: [1, .86, .70], si: 2.4, hi: .34, tint: [1, 1, 1], fog: [.914, .84, .73], ex: .92 },
    { t: 0.62, el: .30, az: -4.2, sun: [1, .76, .52], si: 2.2, hi: .30, tint: [1, .96, .9], fog: [.92, .82, .70], ex: .88 },
    { t: 0.74, el: .14, az: -4.6, sun: [1, .5, .28], si: 1.5, hi: .22, tint: [1, .78, .62], fog: [.88, .66, .52], ex: .74 },
    { t: 0.82, el: .40, az: -1.2, sun: [.55, .64, .95], si: .55, hi: .17, tint: [.36, .42, .6], fog: [.30, .35, .48], ex: .52 },
    { t: 1.00, el: .55, az: -1.8, sun: [.55, .64, .95], si: .5, hi: .14, tint: [.26, .31, .48], fog: [.22, .26, .38], ex: .44 }
  ];
  const _c = new THREE.Color();
  W3.exposureMul = 1;
  W3.setTime = function (t) {
    let i = 0; while (i < KEYS.length - 2 && t > KEYS[i + 1].t) i++;
    const a = KEYS[i], b = KEYS[i + 1], f = U.sstep(a.t, b.t, t), L = (x, y) => x + (y - x) * f, L3 = (x, y) => [L(x[0], y[0]), L(x[1], y[1]), L(x[2], y[2])];
    // 해 질 녘에서 밤으로 넘어갈 때는 해가 지고 달이 뜬다: 방향을 섞지 않고 바꾼다
    const jump = Math.abs(a.az - b.az) > 2, el = jump ? (f < .5 ? a.el * (1 - f * 2) : b.el * (f * 2 - 1)) : L(a.el, b.el), az = jump ? (f < .5 ? a.az : b.az) : L(a.az, b.az);
    sunDir.set(Math.cos(az) * Math.cos(el), Math.sin(el) + .02, Math.sin(az) * Math.cos(el)).normalize();
    const sc = L3(a.sun, b.sun), si = L(a.si, b.si) * (jump ? Math.abs(f * 2 - 1) * .8 + .2 : 1);
    sun.color.copy(C(sc[0], sc[1], sc[2])); sun.intensity = si;
    hemi.intensity = L(a.hi, b.hi);
    const tn = L3(a.tint, b.tint); skyTint.set(tn[0], tn[1], tn[2]);
    const fg = L3(a.fog, b.fog); S.fog.color.copy(C(fg[0], fg[1], fg[2]));
    R.toneMappingExposure = L(a.ex, b.ex) * W3.exposureMul;
    const e = W3.extent || 5;
    sun.position.copy(sunDir).multiplyScalar(e * 3);
    if (Q.shadow) { const c = sun.shadow.camera; if (c.right !== e) { c.left = -e; c.right = e; c.top = e; c.bottom = -e; c.near = .5; c.far = e * 6; c.updateProjectionMatrix(); } }
  };

  /* ---------- 물 ---------- */
  function buildWaterTex() {
    const k = document.createElement('canvas'); k.width = k.height = 128; const g = k.getContext('2d'), im = g.createImageData(128, 128);
    const hgt = (x, y) => U.fbm(x / 13, y / 5.5) + .4 * U.fbm(x / 4.5, y / 2.5);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) { const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1), q = (y * 128 + x) * 4; im.data[q] = 128 + dx * 420; im.data[q + 1] = 128 + dy * 420; im.data[q + 2] = 255; im.data[q + 3] = 255; }
    g.putImageData(im, 0, 0); NM = new THREE.CanvasTexture(k); NM.wrapS = NM.wrapT = THREE.MirroredRepeatWrapping; NM.repeat.set(1, 1);
    W3.NM2 = NM.clone(); W3.NM2.needsUpdate = true;
    waterMat = new THREE.MeshStandardMaterial({ color: C(.3, .46, .54), roughness: .12, metalness: .55, envMapIntensity: 1.25, transparent: true, opacity: .86, normalMap: NM, normalScale: new THREE.Vector2(.35, .35) });
    waterMat.onBeforeCompile = sh => {     // 물결 무늬가 땅의 자리에 붙어 있도록 한다
      sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\nvUv=(uvTransform*vec3(position.x*.95,position.z*.95,1.)).xy;\n#endif');
    };
  }
  function buildWater(tris) {
    if (water) { W3.LAND.remove(water); water.geometry.dispose(); water = null; }
    if (!tris.length) return;
    const g = new THREE.BufferGeometry();
    if (Q.mirror && THREE.Reflector) {
      // 높음: 장면을 한 번 더 그려서 비춘다. 세모들을 눕혀 놓은 평면으로 준다.
      const p = new Float32Array(tris.length); for (let i = 0, j = 0; i < tris.length; i += 3, j += 3) { p[j] = tris[i]; p[j + 1] = -tris[i + 2]; p[j + 2] = 0; }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      const w = window.innerWidth * W3.dpr * .5, h = window.innerHeight * W3.dpr * .5;
      water = new THREE.Reflector(g, {
        clipBias: .002, textureWidth: Math.max(256, Math.min(1024, Math.round(w))), textureHeight: Math.max(256, Math.min(1024, Math.round(h))), color: 0x000000, shader: {
          uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, tNormal: { value: null }, uTime: { value: 0 } },
          vertexShader: 'uniform mat4 textureMatrix;varying vec4 vUv;varying vec3 vW;void main(){vUv=textureMatrix*vec4(position,1.);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
          fragmentShader: `uniform vec3 color;uniform sampler2D tDiffuse;uniform sampler2D tNormal;uniform float uTime;varying vec4 vUv;varying vec3 vW;
          void main(){vec2 q=vW.xz*.95;vec3 a=texture2D(tNormal,q+vec2(uTime*.006,uTime*.004)).xyz*2.-1.;vec3 b=texture2D(tNormal,q*1.9-vec2(uTime*.005,0.)).xyz*2.-1.;vec2 d=(a.xy+b.xy)*.5;
           vec3 V=normalize(cameraPosition-vW);float F=.03+.97*pow(1.-max(V.y,0.),4.);
           vec4 uv=vUv;uv.xy+=d*.017*uv.w;vec3 refl=texture2DProj(tDiffuse,uv).rgb;
           vec3 col=mix(color,refl,clamp(F*1.1+.22,0.,1.));gl_FragColor=vec4(col,mix(.6,.97,F));
           #include <encodings_fragment>
          }`}
      });
      water.material.uniforms.color.value = C(.3, .46, .54); water.material.uniforms.tNormal.value = NM; water.material.uniforms.uTime = uTime; water.material.transparent = true;
      water.rotation.x = -Math.PI / 2; water.position.y = WL;
    } else {
      // 낮음, 보통: 하늘만 비추는 가벼운 물
      const p = new Float32Array(tris.length), nr = new Float32Array(tris.length), uv = new Float32Array(tris.length / 3 * 2);
      for (let i = 0, j = 0; i < tris.length; i += 3, j += 2) { p[i] = tris[i]; p[i + 1] = WL; p[i + 2] = tris[i + 2]; nr[i + 1] = 1; uv[j] = tris[i]; uv[j + 1] = tris[i + 2]; }
      g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      water = new THREE.Mesh(g, waterMat); water.receiveShadow = true;
    }
    water.renderOrder = 2; W3.LAND.add(water);
  }

  /* ---------- 눈발 ---------- */
  const SNOW = { box: [9, 5, 9] };
  function buildSnow() {
    SNOW.n = Q.snow; const g = new THREE.BufferGeometry(), a = new Float32Array(SNOW.n * 3), r = U.rng(321); SNOW.seed = new Float32Array(SNOW.n * 3);
    for (let i = 0; i < SNOW.n * 3; i++) SNOW.seed[i] = r();
    g.setAttribute('position', new THREE.BufferAttribute(a, 3)); SNOW.g = g;
    const k = document.createElement('canvas'); k.width = k.height = 32; const c = k.getContext('2d'), gr = c.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, 32, 32);
    SNOW.pts = new THREE.Points(g, new THREE.PointsMaterial({ size: .023, map: new THREE.CanvasTexture(k), transparent: true, opacity: .85, depthWrite: false, sizeAttenuation: true })); SNOW.pts.frustumCulled = false; S.add(SNOW.pts);
  }
  function snowFrame(t, cx, cy, cz) {
    const p = SNOW.g.attributes.position.array, bx = SNOW.box[0], by = SNOW.box[1], bz = SNOW.box[2], m = (v, b) => ((v % b) + b) % b - b / 2;
    for (let i = 0; i < SNOW.n; i++) { const sx = SNOW.seed[i * 3], sy = SNOW.seed[i * 3 + 1], sz = SNOW.seed[i * 3 + 2]; p[i * 3] = cx + m(sx * bx + t * .12 + Math.sin(t * .6 + sy * 20) * .08 - cx, bx); p[i * 3 + 1] = cy + m(sy * by - t * (.22 + sx * .12) - cy, by); p[i * 3 + 2] = cz + m(sz * bz + Math.cos(t * .5 + sx * 20) * .08 - cz, bz); }
    SNOW.g.attributes.position.needsUpdate = true;
  }

  /* ---------- 후처리 (높음에서만) ---------- */
  function buildPost() {
    if (!Q.post || !THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    const w = window.innerWidth * W3.dpr, h = window.innerHeight * W3.dpr;
    const rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat, encoding: THREE.sRGBEncoding });
    comp = new THREE.EffectComposer(R, rt); comp.addPass(new THREE.RenderPass(S, cam));
    comp.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), .16, .7, .9));
    comp.addPass(new THREE.ShaderPass({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;c*=vec3(1.035,1.0,.95);c=c*.95+.035;float l=dot(c,vec3(.3,.59,.11));c=mix(vec3(l),c,1.08);float d=distance(vUv,vec2(.5,.52));c*=mix(1.,.87,smoothstep(.4,.9,d));gl_FragColor=vec4(c,1.);}'
    }));
  }

  /* ================= 지형 ================= */
  const T = W3.T = {};      // 지금 구역의 지형 자료
  let terrMat, skirtMat, skirt = null, inner = null, outer = null;
  const DIR6 = [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 180 * (30 + 60 * i); return [Math.cos(a), Math.sin(a)]; });

  function visOf(Z, key) {           // 칸의 생김새. 물꼬가 놓인 논은 물 댄 논이 된다.
    const t = Z.tiles[key]; if (t === undefined) return OUTV;
    if (t === 'paddy' && Z.items[key] && Z.items[key].watergate) return V.tile('paddy+watergate');
    return V.tile(t);
  }
  const OUTV = { h: V.OUT_H, c: [.74, .68, .46], snow: .04, veg: null, out: true };
  // 바닷가: 서쪽이 바다다. 0 이면 뭍, 1 이면 바다.
  const seaK = x => T.sea ? U.sstep(-W3.zoneR * .45, -W3.zoneR - .4, x) : 0;

  function buildTopology(zoneId) {
    const Z = GD.S.z[zoneId], rings = Z.rings, k = Q.sub, s = H.R / k, M = k * (2 * (rings + OUT) + 2), size = 2 * M + 1;
    T.zone = zoneId; T.rings = rings; T.k = k; T.s = s; T.M = M; T.size = size;
    T.HS = new Float32Array(size * size).fill(V.OUT_H); T.SN = new Float32Array(size * size);
    T.cells = H.disk(rings + OUT); T.ci = {}; T.cells.forEach((key, i) => { T.ci[key] = i; });
    T.inZone = T.cells.map(key => H.distK(key) <= rings);
    const vid = new Int32Array(size * size).fill(-1), va = [], vb = [], vcells = [], inIdx = [], outIdx = [], triCell = [];
    const vert = (a, b) => {
      const q = (b + M) * size + (a + M); if (vid[q] >= 0) return vid[q];
      const x = a * s * SQ3 / 2, z = s * (a / 2 + b), set = [];
      for (const d of DIR6) { const ck = H.atK(x + d[0] * s * .2, z + d[1] * s * .2), ci = T.ci[ck] === undefined ? -1 : T.ci[ck]; if (set.indexOf(ci) < 0) set.push(ci); }
      vid[q] = va.length; va.push(a); vb.push(b); vcells.push(set); return vid[q];
    };
    for (let b = -M; b < M; b++) for (let a = -M; a < M; a++) {
      for (let h = 0; h < 2; h++) {
        const ca = a + (h ? 2 / 3 : 1 / 3), cb = b + (h ? 2 / 3 : 1 / 3), cx = ca * s * SQ3 / 2, cz = s * (ca / 2 + cb), ci = T.ci[H.atK(cx, cz)];
        if (ci === undefined) continue;
        const v = h ? [vert(a + 1, b), vert(a, b + 1), vert(a + 1, b + 1)] : [vert(a, b), vert(a, b + 1), vert(a + 1, b)];
        (T.inZone[ci] ? inIdx : outIdx).push(v[0], v[1], v[2]);
        if (T.inZone[ci]) triCell.push(ci);
      }
    }
    const n = va.length;
    T.n = n; T.va = va; T.vb = vb; T.vcells = vcells; T.inIdx = inIdx; T.outIdx = outIdx;
    T.pos = new THREE.BufferAttribute(new Float32Array(n * 3), 3); T.col = new THREE.BufferAttribute(new Float32Array(n * 3), 3); T.nor = new THREE.BufferAttribute(new Float32Array(n * 3), 3);
    const uv = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) { const x = va[i] * s * SQ3 / 2, z = s * (va[i] / 2 + vb[i]); T.pos.array[i * 3] = x; T.pos.array[i * 3 + 2] = z; uv[i * 2] = x * 1.9; uv[i * 2 + 1] = z * 1.9; }
    T.uv = new THREE.BufferAttribute(uv, 2);
    // 구역의 가장자리 변: 흙 단면을 세울 자리
    const edge = {}; const E = (p, q) => { const key = p < q ? p + '_' + q : q + '_' + p; edge[key] = edge[key] ? 0 : [p, q]; };
    for (let i = 0; i < inIdx.length; i += 3) { E(inIdx[i], inIdx[i + 1]); E(inIdx[i + 1], inIdx[i + 2]); E(inIdx[i + 2], inIdx[i]); }
    T.rim = Object.keys(edge).filter(k2 => edge[k2]).map(k2 => edge[k2]);
    if (!terrMat) { terrMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .96, envMapIntensity: .35, normalMap: W3.NM2, normalScale: new THREE.Vector2(.4, .4) }); skirtMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide, envMapIntensity: .2 }); }
    for (const m of [inner, outer]) if (m) { W3.LAND.remove(m); m.geometry.dispose(); }
    const mk = idx => { const g = new THREE.BufferGeometry(); g.setAttribute('position', T.pos); g.setAttribute('color', T.col); g.setAttribute('normal', T.nor); g.setAttribute('uv', T.uv); g.setIndex(idx); const m = new THREE.Mesh(g, terrMat); m.receiveShadow = true; m.castShadow = Q.id === 'high'; m.frustumCulled = false; W3.LAND.add(m); return m; };
    inner = mk(inIdx); outer = mk(outIdx);
    W3.extent = H.extent(rings) + .6;
    W3.zoneR = SQ3 * H.R * (rings + .5);
  }

  const BUND_H = .062, BUND_C = [.64, .59, .38], SNOWC = [.86, .875, .91];
  function cellHeight(v, x, z) {
    let h = v.h;
    if (v.rough) h += (U.fbm(x * 3, z * 3) - .5) * v.rough;
    if (v.out) { h += (U.fbm(x * .8 + 2, z * .8) - .5) * .03; const k = seaK(x); if (k) h = h * (1 - k) - .3 * k; }
    return h;
  }
  function computeLand() {
    const Z = GD.S.z[T.zone], z = GD.zone(T.zone), snowy = !!z.cfg.snow, n = T.n, P = T.pos.array, Cc = T.col.array, s = T.s, M = T.M, size = T.size;
    const cv = T.cells.map(key => visOf(Z, key)); T.cv = cv;
    const padd = T.cells.map(key => Z.tiles[key] === 'paddy' || Z.tiles[key] === 'farmland');
    for (let i = 0; i < n; i++) {
      const x = P[i * 3], zz = P[i * 3 + 2], cs = T.vcells[i]; let h = 0, r = 0, g = 0, b = 0, sb = 0, bund = false;
      for (const ci of cs) { const v = ci < 0 ? OUTV : cv[ci]; h += cellHeight(v, x, zz); r += v.c[0]; g += v.c[1]; b += v.c[2]; sb += v.snow === undefined ? -1 : v.snow; if (ci >= 0 && padd[ci]) bund = true; }
      const k = cs.length; h /= k; r /= k; g /= k; b /= k; sb /= k;
      if (bund && k > 1) { h = Math.max(h, BUND_H); r = BUND_C[0]; g = BUND_C[1]; b = BUND_C[2]; sb = -.05; }
      let sn = snowy ? U.sstep(.5, .6, U.fbm(x * .9 + 3, zz * .9 + 7) + sb) : 0; if (h < WL + .014) sn = 0;
      const m = .9 + .2 * U.vnoise(x * 9, zz * 9);
      r = r * m * (1 - sn) + SNOWC[0] * sn; g = g * m * (1 - sn) + SNOWC[1] * sn; b = b * m * (1 - sn) + SNOWC[2] * sn; h += sn * .014;
      P[i * 3 + 1] = h; _c.setRGB(r, g, b).convertSRGBToLinear(); Cc[i * 3] = _c.r; Cc[i * 3 + 1] = _c.g; Cc[i * 3 + 2] = _c.b;
      const q = (T.vb[i] + M) * size + (T.va[i] + M); T.HS[q] = h; T.SN[q] = sn;
    }
    // 법선: 안쪽과 바깥쪽 그물이 이어지도록 한꺼번에 셈한다
    const N = T.nor.array; N.fill(0);
    for (const idx of [T.inIdx, T.outIdx]) for (let i = 0; i < idx.length; i += 3) {
      const a = idx[i] * 3, b2 = idx[i + 1] * 3, c = idx[i + 2] * 3, ux = P[b2] - P[a], uy = P[b2 + 1] - P[a + 1], uz = P[b2 + 2] - P[a + 2], vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      N[a] += nx; N[a + 1] += ny; N[a + 2] += nz; N[b2] += nx; N[b2 + 1] += ny; N[b2 + 2] += nz; N[c] += nx; N[c + 1] += ny; N[c + 2] += nz;
    }
    for (let i = 0; i < n; i++) { const l = Math.hypot(N[i * 3], N[i * 3 + 1], N[i * 3 + 2]) || 1; N[i * 3] /= l; N[i * 3 + 1] /= l; N[i * 3 + 2] /= l; }
    T.pos.needsUpdate = true; T.col.needsUpdate = true; T.nor.needsUpdate = true;
    // 물: 물 높이보다 낮은 곳이 있는 세모만
    const wt = [];
    for (let i = 0; i < T.inIdx.length; i += 3) { const a = T.inIdx[i] * 3, b2 = T.inIdx[i + 1] * 3, c = T.inIdx[i + 2] * 3; if (Math.min(P[a + 1], P[b2 + 1], P[c + 1]) < WL + .004) wt.push(P[a], 0, P[a + 2], P[b2], 0, P[b2 + 2], P[c], 0, P[c + 2]); }
    buildWater(wt);
    buildSkirt();
  }
  function buildSkirt() {       // 흙 단면: 가꾸는 화면에서 구역이 큰 육각형 덩어리로 보인다
    if (skirt) { W3.LAND.remove(skirt); skirt.geometry.dispose(); }
    const P = T.pos.array, pos = [], col = [], idx = [];
    T.rim.forEach((e, k) => {
      const base = pos.length / 3;
      for (const vi of e) {
        const x = P[vi * 3], h = P[vi * 3 + 1], z = P[vi * 3 + 2], wet = h < WL, n = .86 + .28 * U.vnoise(x * 2.3 + z * 1.7, 3.1);
        const ys = [Math.max(h, WL), h, h - .07, h - .2, -.5, BOT];
        const cs = [wet ? [.62, .78, .8] : [.3, .22, .15], wet ? [.3, .44, .47] : [.3, .22, .15], [.31, .23, .16], [.45, .33, .22], [.56, .42, .29], [.64, .5, .36]];
        ys.forEach((y, r) => { pos.push(x, y, z); const nn = r < 2 ? 1 : n * (.93 + .14 * U.vnoise(x * 5 + z * 3, r * 3.3)); _c.setRGB(cs[r][0] * nn, cs[r][1] * nn, cs[r][2] * nn).convertSRGBToLinear(); col.push(_c.r, _c.g, _c.b); });
      }
      for (let r = 0; r < 5; r++) { const a = base + r, b = a + 1, c = base + 6 + r, d = c + 1; idx.push(a, b, c, b, d, c); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    skirt = new THREE.Mesh(g, skirtMat); skirt.castShadow = !!Q.shadow; skirt.receiveShadow = true; skirt.visible = W3.mode !== 'walk'; W3.LAND.add(skirt);
  }

  // 땅의 높이
  W3.sample = function (x, z) {
    const s = T.s, M = T.M, size = T.size, af = x / (s * SQ3 / 2), bf = z / s - af / 2;
    let i = Math.floor(af), j = Math.floor(bf);
    if (i < -M || j < -M || i >= M || j >= M) return V.OUT_H;
    const fa = af - i, fb = bf - j, q = (j + M) * size + (i + M), HS = T.HS;
    if (fa + fb <= 1) return HS[q] * (1 - fa - fb) + HS[q + 1] * fa + HS[q + size] * fb;
    return HS[q + size + 1] * (fa + fb - 1) + HS[q + 1] * (1 - fb) + HS[q + size] * (1 - fa);
  };
  W3.snowAt = function (x, z) { const s = T.s, M = T.M, af = x / (s * SQ3 / 2), i = Math.round(af), j = Math.round(z / s - af / 2); if (i < -M || j < -M || i > M || j > M) return 0; return T.SN[(j + M) * T.size + (i + M)]; };
  W3.tileAt = function (x, z) { const Z = GD.S.z[T.zone]; return Z.tiles[H.atK(x, z)] || null; };
  W3.inZone = function (x, z) { const p = H.at(x, z); return H.dist(p[0], p[1]) <= T.rings; };

  /* ================= 풀과 나무 (한 번에 그리는 묶음) ================= */
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
  const G = {}, LAYER = {};
  function sway(m, amp, useY) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = uTime; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <project_vertex>',
        'vec4 mvPosition=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nmvPosition=instanceMatrix*mvPosition;float ph=instanceMatrix[3].x*2.6+instanceMatrix[3].z*1.9;float kk=' + (useY ? 'position.y' : '1.0') + ';mvPosition.x+=(sin(uTime*1.1+ph)+.3*sin(uTime*2.3+ph*1.7))*' + amp.toFixed(4) + '*kk;mvPosition.z+=cos(uTime*.9+ph)*' + (amp * .5).toFixed(4) + '*kk;\n#endif\nmvPosition=modelViewMatrix*mvPosition;gl_Position=projectionMatrix*mvPosition;');
    }; return m;
  }
  function buildGeoms() {
    G.blade = new THREE.ConeGeometry(1, 1, 4, 1, true); G.blade.translate(0, .5, 0);
    G.stem = new THREE.CylinderGeometry(.55, 1, 1, 5, 1, true); G.stem.translate(0, .5, 0);
    G.plume = new THREE.LatheGeometry([[0, 0], [.8, .14], [1, .4], [.7, .72], [.25, .92], [0, 1]].map(p => new THREE.Vector2(p[0], p[1])), 5);
    G.cone = new THREE.ConeGeometry(1, 1, 9); G.cone.translate(0, .5, 0);
    G.cyl = new THREE.CylinderGeometry(.75, 1, 1, 7); G.cyl.translate(0, .5, 0);
    G.branch = new THREE.ConeGeometry(1, 1, 5); G.branch.translate(0, .5, 0); G.branch.rotateZ(-Math.PI / 2);
    G.ico = new THREE.IcosahedronGeometry(1, 1);
    G.rock = new THREE.DodecahedronGeometry(1, 0);
    G.bale = new THREE.CylinderGeometry(1, 1, 1, 8);
    G.box = new THREE.BoxGeometry(1, 1, 1); G.box.translate(0, .5, 0);
    G.roof = new THREE.ConeGeometry(1, 1, 4); G.roof.translate(0, .5, 0); G.roof.rotateY(Math.PI / 4);
    G.sph = new THREE.SphereGeometry(1, 12, 8);
    const white = o => mat(0xffffff, Object.assign({ roughness: 1 }, o || {}));
    const hi = Q.id === 'high', sh = !!Q.shadow;
    const def = (name, geo, m, shadow) => { LAYER[name] = { geo, mat: m, shadow: sh && shadow, near: null, far: null }; };
    def('stubble', G.blade, white(), hi);
    def('grass', G.blade, sway(white(), .006, true), false);
    def('stem', G.stem, sway(white(), .022, true), hi);
    def('leaf', G.blade, sway(white({ side: THREE.DoubleSide }), .012, false), false);
    def('plume', G.plume, sway(white({ emissive: C(.5, .38, .2), emissiveIntensity: .2 }), .024, false), hi);
    def('trunk', G.cyl, mat(C(.36, .27, .2), { roughness: 1 }), true);
    def('branch', G.branch, white({ roughness: .95 }), true);
    def('bsnow', G.branch, mat(C(.87, .885, .92), { roughness: .85, envMapIntensity: .3 }), false);
    def('tip', G.cone, white({ roughness: .95 }), true);
    def('crown', G.ico, white({ roughness: .95, flatShading: true }), true);
    def('rock', G.rock, white({ flatShading: true }), true);
    def('bale', G.bale, mat(C(.85, .75, .42), { roughness: 1 }), true);
    def('box', G.box, white({ roughness: .9 }), true);
    def('roof', G.roof, white({ roughness: .8, flatShading: true }), true);
    W3.G = G;
  }
  // 한 묶음에 넣을 것들을 모으는 그릇
  function bag() { const o = {}; for (const k in LAYER) o[k] = { m: [], c: [] }; return o; }
  function put(b, layer, col) { const L = b[layer]; _m.toArray(L.m, L.m.length); if (col) L.c.push(col.r, col.g, col.b); else L.c.push(1, 1, 1); }
  function mk(x, y, z, rx, ry, rz, sx, sy, sz) { _e.set(rx, ry, rz, 'XYZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); return _m.compose(_p, _q, _s); }
  function mk2(x, y, z, tilt, az, sx, sy, sz) { _e.set(tilt, az, 0, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); return _m.compose(_p, _q, _s); }
  function mkb(x, y, z, az, tilt, l, th, w) { _e.set(0, az, tilt, 'YZX'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(l, th, w); return _m.compose(_p, _q, _s); }
  const _top = new THREE.Vector3();

  function pine(b, x, z, s, r, y, far, snowy) {
    const by = (y !== undefined ? y : W3.sample(x, z)) - .01, rot = r() * 6, tiers = far ? 5 : (Q.id === 'low' ? 6 : 9), Hh = .8 * s, tone = .85 + r() * .3;
    mk(x, by, z, 0, 0, 0, .02 * s, Hh * .92, .02 * s); put(b, 'trunk');
    for (let k = 0; k < tiers; k++) {
      const f = k / (tiers - 1), yk = by + Hh * (.2 + .7 * f), len = s * (.24 * (1 - f) + .04), n = far ? 6 : Math.round(9 - 4 * f), tilt = -.42 + .3 * f;
      for (let j = 0; j < n; j++) {
        const az = rot + k * .8 + j / n * 6.283 + (r() - .5) * .3, l = len * (.8 + r() * .4), w = l * (far ? .56 : .38), th = l * .15, tl = tilt + (r() - .5) * .12;
        mkb(x, yk, z, az, tl, l, th, w); put(b, 'branch', C(.13 * tone + r() * .03, .27 * tone + r() * .04, .17 * tone + r() * .03));
        if (snowy && r() < .78) { mkb(x, yk + th * .6, z, az, tl, l * .78, th * .5, w * .78); put(b, 'bsnow'); }
      }
    }
    mk(x, by + Hh * .88, z, 0, rot, 0, .028 * s, .15 * s, .028 * s); put(b, 'tip', C(.15 * tone, .3 * tone, .19 * tone));
  }
  function reed(b, px, pz, hh, r) {
    const h = W3.sample(px, pz); if (h < WL - .03) return;
    const rx = (r() - .5) * .22 + .04, rz = (r() - .5) * .22, ry = r() * 6, base = Math.max(h, WL) - .01, sc = C(.74 + r() * .1, .6 + r() * .08, .34 + r() * .05);
    mk(px, base, pz, rx, ry, rz, .0033, hh, .0033); put(b, 'stem', sc);
    _e.set(rx, ry, rz, 'XYZ'); _top.set(0, hh, 0).applyEuler(_e);
    const tx = _top.x, ty = _top.y, tz = _top.z;
    for (let k = 0; k < 2; k++) { const f = .3 + r() * .4; mk2(px + tx * f, base + ty * f, pz + tz * f, .7 + r() * .6, r() * 6.28, .0048, .09 + r() * .1, .0012); put(b, 'leaf', sc); }
    const pc = C(.9 + r() * .06, .82 + r() * .06, .62 + r() * .1);
    for (let k = 0; k < 3; k++) { mk2(px + tx, base + ty - .003, pz + tz, .22 + k * .2 + r() * .14, 1.57 + (r() - .5) * .9, .0034 + r() * .001, .06 + r() * .035, .0034 + r() * .001); put(b, 'plume', pc); }
  }
  // 칸 안의 아무 곳
  function rndIn(key, r, margin) {
    const c = H.centerK(key), k = 1 - (margin || .06);
    for (let i = 0; i < 12; i++) { const dx = (r() * 2 - 1) * H.R * .866, dz = (r() * 2 - 1) * H.R; if (H.atK(c[0] + dx / k, c[1] + dz / k) === key) return [c[0] + dx, c[1] + dz]; }
    return c;
  }
  const TREES = {};          // 칸마다 나무가 선 자리와 높이. 나무 위에 앉는 이웃이 쓴다.
  W3.trees = key => TREES[key] || [];
  function genCell(key, outVeg) {
    const Z = GD.S.z[T.zone], z = GD.zone(T.zone), b = bag(), tile = Z.tiles[key], v = visOf(Z, key), veg = outVeg || v.veg, snowy = !!z.cfg.snow;
    const trees = []; if (!outVeg) TREES[key] = trees;
    const r = U.rng(U.hashStr(key) * 31 + 5), d = Q.veg, bl = d >= 1 ? 5 : d >= .6 ? 4 : 3, c = H.centerK(key);
    const clump = (px, pz, col, tiltMax, hMin, hVar, layer) => { const h = W3.sample(px, pz); if (h < WL + .012) return; for (let k = 0; k < bl; k++) { mk2(px + (r() - .5) * .02, h - .004, pz + (r() - .5) * .02, .1 + r() * tiltMax, r() * 6.28, .0034, hMin + r() * hVar, .0034); put(b, layer, col); } };
    if (veg === 'stubble' || veg === 'crop') {
      const green = veg === 'crop';
      for (let a = -6; a <= 6; a++) for (let q = -6; q <= 6; q++) {
        const px = c[0] + a * .09 + (r() - .5) * .02, pz = c[1] + q * .085 + (r() - .5) * .02, keep = r() < d;
        if (!keep || H.atK(c[0] + (px - c[0]) * 1.16, c[1] + (pz - c[1]) * 1.16) !== key) continue;
        const h = W3.sample(px, pz), col = green ? C(.38 + r() * .1, .58 + r() * .1, .25) : C(.8 + r() * .08, .67 + r() * .06, .38 + r() * .05);
        for (let k = 0; k < bl; k++) { mk2(px + (r() - .5) * .012, h - .005, pz + (r() - .5) * .012, r() * .42, r() * 6.28, .0032, (green ? .05 : .03) + r() * .038, .0032); put(b, 'stubble', col); }
      }
      if (z.smallOn.indexOf(tile) >= 0 && !Z.sold[key]) for (let a = 0; a < 4; a++) { const p = rndIn(key, r, .3); mk(p[0], Math.max(W3.sample(p[0], p[1]), WL) + .03, p[1], Math.PI / 2, 0, r() * 3.1, .035, .1, .035); put(b, 'bale'); }
    } else if (veg === 'grass' || veg === 'yard' || veg === 'marsh' || veg === 'stump') {
      const n = Math.round((veg === 'grass' ? 210 : veg === 'marsh' ? 90 : 70) * d), summer = !snowy;
      for (let a = 0; a < n; a++) { const p = rndIn(key, r); const col = veg === 'marsh' ? C(.5 + r() * .1, .52 + r() * .08, .28) : summer ? C(.4 + r() * .14, .58 + r() * .1, .26 + r() * .06) : C(.74 + r() * .1, .66 + r() * .08, .38 + r() * .06); clump(p[0], p[1], col, .6, .045, .075, 'grass'); }
      if (veg === 'marsh') for (let a = 0; a < Math.round(80 * d); a++) { const p = rndIn(key, r); reed(b, p[0], p[1], .2 + r() * .18, r); }
      if (veg === 'stump') for (let a = 0; a < 5; a++) { const p = rndIn(key, r, .25); mk(p[0], W3.sample(p[0], p[1]) - .01, p[1], 0, r() * 6, 0, .03 + r() * .015, .05 + r() * .03, .03 + r() * .015); put(b, 'trunk'); }
    } else if (veg === 'reed') {
      for (let a = 0; a < Math.round(300 * d); a++) { const p = rndIn(key, r, .03); reed(b, p[0], p[1], .3 + r() * .28, r); }
    } else if (veg === 'pine') {
      for (let a = 0; a < 5; a++) { const p = rndIn(key, r, .22), s = .9 + r() * .4; trees.push([p[0], p[1], W3.sample(p[0], p[1]) + .8 * s * .42, .1 * s, 0]); pine(b, p[0], p[1], s, r, undefined, false, snowy); }
      for (let a = 0; a < Math.round(40 * d); a++) { const p = rndIn(key, r); clump(p[0], p[1], C(.6 + r() * .1, .56 + r() * .08, .34), .6, .04, .06, 'grass'); }
    } else if (veg === 'tree') {
      // 넓은잎나무: 걸을 때 올려다보이도록 사람 키의 두세 배로 세운다. 줄기 옆으로 낮은 가지 하나를 내어 부엉이가 앉을 자리로 쓴다.
      for (let a = 0; a < 4; a++) {
        const p = rndIn(key, r, .28), s = 1.7 + r() * .8, by = W3.sample(p[0], p[1]) - .01, tone = .85 + r() * .3, ba = r() * 6.283;
        if (W3.sample(p[0], p[1]) < WL) continue;
        mk(p[0], by, p[1], 0, r() * 6, 0, .026 * s, .5 * s, .026 * s); put(b, 'trunk');
        mk(p[0], by + .3 * s, p[1], 0, -ba, -Math.PI / 2 + .3, .008 * s, .13 * s, .008 * s); put(b, 'trunk');
        trees.push([p[0], p[1], by + .3 * s + .034 * s, Math.cos(ba) * .1 * s, Math.sin(ba) * .1 * s]);
        for (let k = 0; k < 3; k++) { mk(p[0] + (r() - .5) * .14 * s, by + (.52 + k * .1 + r() * .05) * s, p[1] + (r() - .5) * .14 * s, r() * 3, r() * 3, 0, (.17 - k * .03) * s, (.14 - k * .02) * s, (.17 - k * .03) * s); put(b, 'crown', C(.24 * tone + r() * .05, .46 * tone + r() * .08, .2 * tone)); }
      }
      for (let a = 0; a < Math.round(50 * d); a++) { const p = rndIn(key, r); clump(p[0], p[1], C(.36 + r() * .1, .55 + r() * .1, .24), .6, .04, .06, 'grass'); }
    } else if (veg === 'pebble' || veg === 'boulder') {
      const big = veg === 'boulder', n = big ? 5 : Math.round(12 * d);
      for (let a = 0; a < n; a++) { const p = rndIn(key, r, big ? .25 : .08), s = big ? .12 + r() * .14 : .02 + r() * .035, h = W3.sample(p[0], p[1]); mk(p[0], h + s * .25, p[1], r() * 3, r() * 3, r() * 3, s * 1.3, s * (big ? 1.1 : .7), s); const t = .46 + r() * .16; put(b, 'rock', C(t, t * .97, t * .92)); }
    } else if (veg === 'hut') {
      for (let a = 0; a < 3; a++) { const p = rndIn(key, r, .35), h = W3.sample(p[0], p[1]) - .01, ry = r() * 3, s = .9 + r() * .3; mk(p[0], h, p[1], 0, ry, 0, .16 * s, .1 * s, .12 * s); put(b, 'box', C(.92, .88, .8)); mk(p[0], h + .1 * s, p[1], 0, ry, 0, .15 * s, .08 * s, .12 * s); put(b, 'roof', C(.5 + r() * .2, .32, .26)); }
    } else if (veg === 'weir') {
      for (let a = -3; a <= 3; a++) { mk(c[0] + a * .14, Math.min(W3.sample(c[0] + a * .14, c[1]), WL) - .04, c[1], 0, 0, 0, .13, .12, .1); put(b, 'box', C(.62, .62, .6)); }
    }
    if (tile === 'path') for (let a = 0; a < 10; a++) { const p = rndIn(key, r, .1), s = .012 + r() * .014; mk(p[0], W3.sample(p[0], p[1]) + s * .2, p[1], r() * 3, r() * 3, r() * 3, s * 1.3, s * .6, s); const t = .5 + r() * .14; put(b, 'rock', C(t, t * .96, t * .9)); }
    return b;
  }
  const VEG = {};
  function fill(which, bags, parent) {
    for (const name in LAYER) {
      const L = LAYER[name]; let n = 0; for (const b of bags) n += b[name].m.length / 16;
      let mesh = L[which];
      if (mesh && (n > mesh.userData.cap || !n)) { parent.remove(mesh); mesh.dispose(); mesh = L[which] = null; }
      if (!n) continue;
      if (!mesh) {
        const cap = Math.ceil(n * 1.25) + 16; mesh = L[which] = new THREE.InstancedMesh(L.geo, L.mat, cap); mesh.userData.cap = cap;
        mesh.instanceColor = new THREE.BufferAttribute(new Float32Array(cap * 3), 3);
        mesh.castShadow = L.shadow && which !== 'far'; mesh.receiveShadow = which !== 'far'; mesh.frustumCulled = false; parent.add(mesh);
      }
      const ma = mesh.instanceMatrix.array, ca = mesh.instanceColor.array; let o = 0;
      for (const b of bags) { const src = b[name]; if (!src.m.length) continue; ma.set(src.m, o * 16); ca.set(src.c, o * 3); o += src.m.length / 16; }
      mesh.count = n; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true;
    }
  }
  function refreshVeg(keys) {
    const Z = GD.S.z[T.zone];
    if (!keys) {
      for (const k in VEG) delete VEG[k]; for (const k in TREES) delete TREES[k]; keys = Object.keys(Z.tiles);
      // 구역 바깥 두 겹: 걸을 때 구역이 풍경과 이어져 보이도록 풀이나 나무를 세운다
      const ov = GD.zone(T.zone).cfg.outVeg, bags = [];
      if (ov) T.cells.forEach((k, i) => { if (!T.inZone[i]) bags.push(genCell(k, ov)); });
      fill('out', bags, W3.OUTG);
    }
    keys.forEach(k => { if (Z.tiles[k] !== undefined) { const b = genCell(k); for (const n in b) { b[n].m = new Float32Array(b[n].m); b[n].c = new Float32Array(b[n].c); } VEG[k] = b; } });
    fill('near', Object.keys(VEG).map(k => VEG[k]), W3.LAND);
  }

  /* ---------- 구역 너머의 풍경 (걸을 때만 보인다) ---------- */
  let farBuilt = null;
  function buildFar() {
    const z = GD.zone(T.zone), snowy = !!z.cfg.snow, rIn = W3.zoneR + .8, sig = T.zone + rIn.toFixed(2), sea = !!z.cfg.sea;
    if (farBuilt === sig) return; farBuilt = sig;
    for (const o of W3.FAR.children.slice()) { W3.FAR.remove(o); if (o.geometry && !o.isInstancedMesh) o.geometry.dispose(); }
    for (const n in LAYER) LAYER[n].far = null;
    // 너른 들: 가운데가 뚫린 둥근 띠
    const SEG = 56, RING = 22, pos = [], col = [], idx = [];
    for (let j = 0; j <= RING; j++) {
      const f = j / RING, d = rIn + (72 - rIn) * f * f;
      for (let i = 0; i <= SEG; i++) {
        const a = i / SEG * 6.2832, x = Math.cos(a) * d, zz = Math.sin(a) * d, sk = sea ? U.sstep(-rIn * .35, -rIn - .5, x) : 0, y = (-.02 + (U.fbm(x * .15 + 2, zz * .15) - .5) * .3 * U.sstep(rIn + 1, rIn + 8, d)) * (1 - sk) - .7 * sk;
        pos.push(x, y, zz);
        const sn = snowy ? U.sstep(.44, .6, U.fbm(x * .21 + 3, zz * .21 + 7)) : 0, k = .9 + .2 * U.vnoise(x * .7, zz * .7), g0 = z.cfg.farColor || (snowy ? [.74, .66, .46] : [.5, .6, .34]);
        _c.setRGB(g0[0] * k * (1 - sn) + .86 * sn, g0[1] * k * (1 - sn) + .875 * sn, g0[2] * k * (1 - sn) + .91 * sn).convertSRGBToLinear(); col.push(_c.r, _c.g, _c.b);
      }
    }
    for (let j = 0; j < RING; j++) for (let i = 0; i < SEG; i++) { const a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d2 = c + 1; idx.push(a, c, b, b, c, d2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, envMapIntensity: .3 })); m.receiveShadow = true; W3.FAR.add(m);
    const r = U.rng(123), mh1 = mat(snowy ? C(.52, .53, .5) : C(.36, .46, .34), { roughness: 1, envMapIntensity: .2 }), mh2 = mat(snowy ? C(.58, .64, .72) : C(.46, .56, .6), { roughness: 1, envMapIntensity: .2 });
    for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283 + r() * .3, d = 26 + r() * 6, h = new THREE.Mesh(G.sph, mh1); if (sea && Math.cos(a) < .15) continue; h.position.set(Math.cos(a) * d, -.4, Math.sin(a) * d); h.scale.set(7 + r() * 6, 1.2 + r() * 1.5, 5 + r() * 4); h.rotation.y = r() * 3; W3.FAR.add(h); }
    for (let i = 0; i < 18; i++) { const a = i / 18 * 6.283 + r() * .3, d = 39 + r() * 9, h = new THREE.Mesh(G.sph, mh2); if (sea && Math.cos(a) < .15) continue; h.position.set(Math.cos(a) * d, -.5, Math.sin(a) * d); h.scale.set(10 + r() * 8, 3 + r() * 4, 7 + r() * 5); h.rotation.y = r() * 3; W3.FAR.add(h); }
    const b = bag();
    for (let i = 0; i < Q.far; i++) { const a = r() * 6.283, d = rIn + 2.5 + r() * 22, x = Math.cos(a) * d, zz = Math.sin(a) * d, s = 1 + r() * .9; if (sea && x < 3) continue; pine(b, x, zz, s, r, 0, true, snowy); }
    fill('far', [b], W3.FAR);
    if (sea) {                 // 바다: 구역의 물과 겹치지 않게 아주 조금 낮춘다
      const sg = new THREE.PlaneGeometry(170, 170); sg.rotateX(-Math.PI / 2);
      const sm = new THREE.Mesh(sg, waterMat); sm.position.y = WL - .004; sm.renderOrder = 1; W3.FAR.add(sm);
    }
  }

  /* ================= 밖에서 부르는 것 ================= */
  // 구역의 땅을 처음부터 짓는다 (구역을 옮기거나 땅을 넓혔을 때)
  W3.build = function (zoneId) {
    const zc = GD.zone(zoneId).cfg; T.sea = !!zc.sea; W3.exposureMul = zc.exposure || 1;
    W3.zoneR = SQ3 * H.R * (GD.S.z[zoneId].rings + .5);
    OUTV.c = zc.snow ? [.74, .68, .46] : zc.farColor || V.tile(GD.zone(zoneId).base).c;
    buildTopology(zoneId); computeLand(); refreshVeg(null); buildFar();
    SNOW.pts.visible = !!GD.zone(zoneId).cfg.snow;
    W3.setMode(W3.mode || 'tend');
    GD.emit('built', zoneId);
  };
  // 칸이 바뀌었을 때: 높이와 색을 다시 셈하고, 바뀐 칸과 이웃 칸의 풀만 다시 만든다
  W3.updateCells = function (keys) {
    const Z = GD.S.z[T.zone];
    if (!keys || Z.rings !== T.rings) { W3.build(T.zone); return; }
    computeLand();
    const set = {}; keys.forEach(k => { set[k] = 1; H.neighbors(k).forEach(n => { if (Z.tiles[n] !== undefined) set[n] = 1; }); });
    refreshVeg(Object.keys(set));
  };
  W3.setMode = function (mode) {
    W3.mode = mode; const walk = mode === 'walk';
    W3.FAR.visible = walk; W3.OUTG.visible = walk; if (outer) outer.visible = walk; if (skirt) skirt.visible = !walk; ground.visible = !walk;
    S.fog.density = walk ? .028 : .007;
  };
  W3.render = function (dt) {
    uTime.value += dt;
    if (NM) { NM.offset.x += dt * .004; NM.offset.y += dt * .0025; }
    if (SNOW.pts.visible) snowFrame(uTime.value, cam.position.x, Math.max(cam.position.y, 1.2), cam.position.z);
    dome.position.copy(cam.position);
    R.info.reset();              // 그리기 횟수를 한 장면 단위로 센다(그림자, 반사, 후처리까지 더해서)
    if (comp) comp.render(); else R.render(S, cam);
  };
  W3.stats = function () { return { calls: R.info.render.calls, tris: R.info.render.triangles, geoms: R.info.memory.geometries, tex: R.info.memory.textures, dpr: W3.dpr, quality: Q.id }; };
  // 초당 장면 수를 재는 데 쓴다: 장면을 n번 그리고 한 장에 걸린 시간(ms)을 돌려준다
  W3.bench = function (n) {
    const gl = R.getContext(), px = new Uint8Array(4), one = () => { if (comp) comp.render(); else R.render(S, cam); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    for (let i = 0; i < 3; i++) one();
    const t0 = performance.now(); for (let i = 0; i < n; i++) one();
    const ms = (performance.now() - t0) / n; R.info.reset(); one();     // 숫자 판에는 마지막 한 장면만 남긴다
    return ms;
  };
})();
