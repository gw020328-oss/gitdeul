/* 깃들 데모: 균형 모의 (화면 없이 규칙만 돌린다)
   쓰는 법: node demo/tools/balance_sim.js [판 수, 기본 120]
   하는 일: 네 구역을 따로따로 열어 놓고, 꾸준한 사람과 이틀에 한 번 하는 사람이
   첫 어려운 발길의 이웃을 깃들게 하기까지 며칠이 걸리는지 센다. 숫자는 demo/js/config.js 의 것이다.
   모의 속 사람이 하는 일: 손님은 돌려보내고, 불청객은 걷어 내고, 폐비닐과 흔적은 다 줍고,
   하루의 네 때마다 보이는 이웃을 모두 바라보고, 가장 점수가 오르는 칸 바꾸기를 고른다. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const JS = path.join(__dirname, '..', 'js');
const store = {};
const el = () => new Proxy({ style: {}, classList: { add() { }, remove() { }, toggle() { } }, dataset: {} }, { get: (t, k) => k in t ? t[k] : (() => el()) });
const ctx = {
  console, setTimeout: () => 0, clearTimeout() { }, Math, JSON, Date, Object, Array,
  localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
  document: { getElementById: el, addEventListener() { }, hidden: false, createElement: el, body: el() },
  location: { hash: '' }, addEventListener() { }, name: ''
};
ctx.window = ctx; vm.createContext(ctx);
for (const f of ['content_data.js', 'config.js', 'util.js', 'data_base.js', 'content.js', 'visuals.js', 'state.js', 'rules.js', 'sim.js'])
  vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), ctx, { filename: f });
const GD = ctx.GD, CFG = GD.CFG, SIM = GD.sim, RL = GD.rules;
GD.state.save = GD.state.saveNow = () => true;

function run(zid, policy, seed, maxDays) {
  const h0 = GD.util.hashStr; GD.util.hashStr = s => h0(s + '#' + seed);        // 판마다 다른 운
  GD.state.reset(); const S = GD.S; S.started = true; if (S.tut) S.tut.done = true;
  GD.ZONES.forEach(z => { if (S.z[z.id]) S.z[z.id].open = z.id === zid; }); S.zone = zid;
  const z = GD.zone(zid), Z = S.z[zid], hard = z.species.filter(s => s.tier === 'hard').map(s => s.id);
  SIM.startDay();
  const out = { arr: 0, stay: 0, settle: 0, who: '', chg: 0 };
  for (let d = 1; d <= maxDays; d++) {
    if (Z.guest && Z.guest.state === 'waiting') SIM.answerGuest(zid, false);
    if (Z.intruder) SIM.fixIntruder(zid);
    Z.trash.forEach((t, i) => SIM.pickTrash(zid, i));
    Z.traces.forEach((t, i) => SIM.findTrace(zid, i));
    for (const ph of CFG.phases) {
      S.clock = SIM.phaseStart(ph.id) + 1;
      for (const id of Object.keys(Z.here)) { if (SIM.canRecord(zid, id)) SIM.record(id); else if (SIM.visible(zid, id)) SIM.watched(id); }
    }
    for (const id of hard) {
      if (Z.here[id] && !out.arr) out.arr = d;
      if (S.rec[id] >= 2 && !out.stay) out.stay = d;
      if (S.rec[id] >= 3 && !out.settle) { out.settle = d; out.who = id; }
    }
    if (out.settle) break;
    if (policy !== 'idle' && (policy === 'diligent' || d % 2 === 1)) {
      const cap = policy === 'diligent' ? 6 : 3;
      for (let c = 0; c < cap; c++) {
        const n0 = RL.counts(zid), tg = hard.filter(id => !RL.silent(id));
        const val = n => Math.max(...tg.map(id => RL.score(id, n) + .6 * RL.stayScore(id, n, zid)), 0);
        let best = null; const base = val(n0), seen = {};
        for (const key of Object.keys(Z.tiles)) {
          const cur = Z.tiles[key];
          for (const t of z.paintTiles) {
            if (t.id === cur || seen[cur + '>' + t.id]) continue; seen[cur + '>' + t.id] = 1;
            if (z.tile[cur].fixed || SIM.tileCost(zid, t.id) > S.money) continue;
            const n = Object.assign({}, n0); n[cur]--; n[t.id] = (n[t.id] || 0) + 1;
            const g = val(n) - base; if (g > 1e-6 && (!best || g > best.g)) best = { g, key, tool: { t: 'tile', id: t.id } };
          }
        }
        if (!best) break;
        const r = SIM.apply(zid, best.key, best.tool); if (!r || !r.ok) break; out.chg++;
      }
    }
    if (SIM.nextMorning() === 'yearEnd') SIM.newYear();
  }
  out.money = S.money; GD.util.hashStr = h0;
  return out;
}

const N = +process.argv[2] || 120, q = (a, p) => a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(a.length * p))] : '-';
console.log('구역 | 사람 | 깃듦까지 간 판 | 첫 방문 | 첫 머묾 | 첫 깃듦 (가운데, 빠른 10%, 느린 10%) | 누가 | 칸 바꾼 수 | 남은 돈');
for (const z of GD.ZONES.filter(z => z.ready)) for (const p of ['diligent', 'light', 'idle']) {
  const R = []; for (let i = 0; i < (p === 'idle' ? Math.min(N, 40) : N); i++) R.push(run(z.id, p, i, 84));
  const ok = R.filter(r => r.settle), who = {}; ok.forEach(r => { who[r.who] = (who[r.who] || 0) + 1; });
  const med = k => q(R.filter(r => r[k]).map(r => r[k]), .5);
  console.log([z.name, { diligent: '꾸준히', light: '이틀에 한 번', idle: '아무것도 안 함' }[p], ok.length + '/' + R.length, med('arr'), med('stay'),
    q(ok.map(r => r.settle), .5) + ' (' + q(ok.map(r => r.settle), .1) + '~' + q(ok.map(r => r.settle), .9) + ')',
    Object.keys(who).map(k => GD.SP[k].name + ' ' + who[k]).join(', ') || '-', q(R.map(r => r.chg), .5), q(R.map(r => r.money), .5)].join(' | '));
}
