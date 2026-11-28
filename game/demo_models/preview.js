/* 미리보기: 41개를 한 화면에 늘어놓는다. 해시: top side iso / idle feed alert move rest / s1 s2 s3 / real / only=id,id / test */
(function () {
const NAMES = {crane:"두루미",stork:"황새",swan:"큰고니",kestrel:"황조롱이",beangoose:"큰기러기",wfgoose:"쇠기러기",mallard:"청둥오리",eoreumchi:"어름치",gamdol:"감돌고기",otter:"수달",mandarin:"원앙",ssogari:"쏘가리",ayu:"은어",pirami:"피라미",galgyeoni:"참갈겨니",beodeulchi:"버들치",goral:"산양",flyingsquirrel:"하늘다람쥐",scopsowl:"소쩍새",hawkowl:"솔부엉이",badger:"오소리",roedeer:"노루",chipmunk:"다람쥐",redsquirrel:"청설모",hare:"멧토끼",ghostcrab:"달랑게",spoonbillsandpiper:"넓적부리도요",seal:"점박이물범",rugosa:"해당화",fiddler:"농게",sandbubbler:"엽낭게",spoonbill:"저어새",reed:"갈대",suaeda:"칠면초",mudcrab:"칠게",heron:"왜가리",visitors:"구경꾼",bass:"배스",bluegill:"블루길",sika:"꽃사슴",spartina:"영국갯끈풀"};
const H = location.hash.replace("#", "").split(/[&,]/).filter(Boolean);
const has = k => H.includes(k);
const arg = k => { const m = location.hash.match(new RegExp(k + "=([^&]+)")); return m ? m[1].split(",") : null; };
window.onerror = (m, s, l) => { document.getElementById("err").textContent += "오류: " + m + " (" + l + ")\n"; };

let view = has("top") ? "top" : has("iso") ? "iso" : "side";
let mode = ["feed", "alert", "move", "rest", "fly"].find(has) || "idle";
let stage = has("s1") ? 1 : has("s2") ? 2 : 3;
let real = has("real");
const only = arg("only");
const ids = only ? only : GD_SIMPLE.ids;

if (has("test")) {
  const out = [];
  let bad = 0;
  ids.forEach(id => {
    [1, 2, 3].forEach(st => {
      try {
        const m = GD_SIMPLE.make(id, { stage: st });
        const tris = m.tris;
        ["idle", "feed", "alert", "move", "rest", "fly"].forEach(md => { for (let i = 0; i < 40; i++) m.update(0.05, i * 0.05, md); });
        let nan = false;
        m.group.traverse(o => { if (o.isMesh) { const a = o.geometry.attributes.position.array; for (let i = 0; i < a.length; i++) if (!isFinite(a[i])) { nan = true; break; } } });
        const ok = tris <= 400 && !nan && isFinite(m.height) && m.height > 0;
        if (!ok) bad++;
        if (st === 3 || !ok) out.push((ok ? "OK  " : "BAD ") + id + " s" + st + " tris=" + tris + " h=" + m.height.toFixed(3) + " len=" + m.length.toFixed(3) + " w=" + m.width.toFixed(3) + (nan ? " NaN" : ""));
        m.dispose();
      } catch (e) { bad++; out.push("ERR " + id + " s" + st + " " + e.message); }
    });
  });
  out.push("count=" + GD_SIMPLE.ids.length + " bad=" + bad);
  const pre = document.createElement("pre"); pre.id = "out"; pre.textContent = out.join("\n"); document.body.appendChild(pre);
  return;
}

const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
R.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
R.setSize(innerWidth, innerHeight);
R.outputEncoding = THREE.sRGBEncoding;
R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95;
R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(R.domElement);
const S = new THREE.Scene(); S.background = new THREE.Color(0xe9dcc6).convertSRGBToLinear();
S.add(new THREE.HemisphereLight(new THREE.Color(0xc4d6ee).convertSRGBToLinear(), new THREE.Color(0xe6caa4).convertSRGBToLinear(), 0.75));
const sun = new THREE.DirectionalLight(new THREE.Color(1, 0.79, 0.56).convertSRGBToLinear(), 2.2);
sun.position.set(-6, 9, 5); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 }); sun.shadow.bias = -0.0004;
S.add(sun);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ color: 0x5a4634, opacity: 0.25 }));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; S.add(ground);

const cols = only ? Math.min(only.length, 4) : 8, rows = Math.ceil(ids.length / cols), CELL = 1.6, ROW = 2.1;
let models = [], cam, lab = document.getElementById("lab");
function build() {
  models.forEach(m => { S.remove(m.wrap); m.m.dispose(); });
  models = []; lab.innerHTML = "";
  ids.forEach((id, k) => {
    const m = GD_SIMPLE.make(id, { stage }); if ("flyLift" in m) m.flyLift = m.height * 0.6;
    const wrap = new THREE.Group(); wrap.add(m.group);
    const dim = Math.max(m.height, m.length, m.width), fit = real ? 1 : (CELL * 0.78) / dim;
    wrap.scale.setScalar(fit);
    const c = k % cols, r = Math.floor(k / cols);
    if (view === "side") wrap.position.set(0, (rows - 1 - r) * ROW, (c - (cols - 1) / 2) * CELL);
    else wrap.position.set((c - (cols - 1) / 2) * CELL, 0, (r - (rows - 1) / 2) * CELL * 1.35);
    if (real) wrap.position.set(view === "side" ? 0 : (k - (ids.length - 1) / 2) * 1.2, 0, view === "side" ? (k - (ids.length - 1) / 2) * 1.2 : 0);
    S.add(wrap);
    const d = document.createElement("div"); d.className = "l";
    const f = v => v >= 0.1 ? v.toFixed(2) + " m" : (v * 100).toFixed(1) + " cm";
    d.innerHTML = "<b>" + NAMES[id] + "</b>" + id + "<br>키 " + f(m.height) + " · 길이 " + f(m.length) + "<br>삼각형 " + m.tris;
    lab.appendChild(d);
    models.push({ id, m, wrap, d });
  });
  setCam();
}
function setCam() {
  const asp = innerWidth / innerHeight, w = real ? ids.length * 1.2 : cols * CELL;
  const h = view === "side" ? rows * ROW : rows * CELL * 1.35;
  const ext = Math.max(w / asp, h) / 2 * (view === "iso" ? 1.2 : view === "side" ? 1.12 : 1.04);
  cam = new THREE.OrthographicCamera(-ext * asp, ext * asp, ext, -ext, -50, 50);
  if (view === "top") { cam.position.set(0, 20, 0.001); cam.up.set(0, 0, -1); cam.lookAt(0, 0, 0); }
  else if (view === "iso") { cam.position.set(10, 12, 12); cam.lookAt(0, 0.3, 0); }
  else { const cy = (rows - 1) * ROW / 2 + 0.75; cam.position.set(-20, cy, 0); cam.up.set(0, 1, 0); cam.lookAt(0, cy, 0); }
  ground.visible = view !== "side";
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
}
function bar() {
  const b = document.getElementById("bar"); b.innerHTML = "<b>깃들 간단한 모형 " + ids.length + "개</b> 보기:";
  const btn = (txt, on, f) => { const e = document.createElement("button"); e.textContent = txt; if (on) e.className = "on"; e.onclick = f; b.appendChild(e); };
  [["side", "옆"], ["top", "위"], ["iso", "비스듬"]].forEach(([v, t]) => btn(t, view === v, () => { view = v; build(); bar(); }));
  b.appendChild(document.createTextNode(" 움직임:"));
  [["idle", "가만히"], ["feed", "먹기"], ["alert", "경계"], ["move", "이동"], ["rest", "쉬기"], ["fly", "날기(새)"]].forEach(([v, t]) => btn(t, mode === v, () => { mode = v; bar(); }));
  b.appendChild(document.createTextNode(" 자람:"));
  [1, 2, 3].forEach(v => btn(v, stage === v, () => { stage = v; build(); bar(); }));
  btn(real ? "실제 크기 끄기" : "실제 크기", real, () => { real = !real; build(); bar(); });
}
build(); bar();
models.forEach(o => { for (let i = 0; i < 80; i++) o.m.update(0.05, 3 + i * 0.05, mode); }); // 해시로 정한 움직임이 바로 보이도록 미리 돌려 둔다
if (has("nobar")) document.getElementById("bar").style.display = "none";
addEventListener("resize", () => { R.setSize(innerWidth, innerHeight); setCam(); });
let last = performance.now(), T0 = performance.now();
const v3 = new THREE.Vector3();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; const t = (now - T0) / 1000 + 3;
  models.forEach(o => o.m.update(dt, t, mode));
  R.render(S, cam);
  models.forEach(o => { (view === "side" ? v3.set(o.wrap.position.x, o.wrap.position.y - 0.05, o.wrap.position.z) : v3.set(o.wrap.position.x, 0, o.wrap.position.z + CELL * (view === "iso" ? 0.3 : 0.43))).project(cam); o.d.style.left = (v3.x * 0.5 + 0.5) * innerWidth + "px"; o.d.style.top = (-v3.y * 0.5 + 0.5) * innerHeight + "px"; });
  window.__frames = (window.__frames || 0) + 1;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();
