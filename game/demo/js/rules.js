/* 깃들 데모: AI 판단 자리에 넣어 둔 임시 규칙
   실제 모델이 들어올 자리다. 모델을 연결할 때는 이 파일의 score, stayScore, unknown 만 바꾸면 된다.
   판단은 칸 종류별 개수로 한다. 칸의 위치는 쓰지 않는다(기획서 8장).
   - 들녘 7종: 아래 FIELD 에 손으로 적은 규칙
   - 나머지 종: 자료의 likes, dislikes 로 만든 규칙 */
(function () {
  const CFG = GD.CFG, U = GD.util, cl = (v) => Math.max(0, Math.min(1, v));
  const RL = GD.rules = {};

  /* 칸 종류별 개수. 아이템은 '@id' 로 센다(놓을 수 있는 칸에 놓인 것만). */
  RL.counts = function (zoneId, Zopt) {
    const z = GD.zone(zoneId), Z = Zopt || GD.S.z[zoneId], n = { cells: 0, sold: 0, soldable: 0 };
    z.tiles.forEach(t => { n[t.id] = 0; });
    z.items.forEach(i => { n['@' + i.id] = 0; });
    for (const k in Z.tiles) {
      const t = Z.tiles[k]; n[t] = (n[t] || 0) + 1; n.cells++;
      if (z.smallOn.indexOf(t) >= 0) { n.soldable++; if (Z.sold[k]) n.sold++; }
      const it = Z.items[k];
      if (it) for (const id in it) { const def = z.item[id]; if (def && (def.placeOn.indexOf('*') >= 0 || def.placeOn.indexOf(t) >= 0)) n['@' + id]++; }
    }
    n.intruder = Z.intruder ? 1 : 0;
    return n;
  };

  /* ---------- 들녘의 임시 규칙 ---------- */
  const f = n => ({
    P: n.paddy || 0, Q: n['@watergate'] || 0, M: n.marsh || 0, W: n.water || 0, R: n.reedbed || 0,
    F: n.wood || 0, G: n.grass || 0, H: n.greenhouse || 0, S: n.sold || 0, N: n.cells || 37
  });
  const open = a => 1 - cl((a.F - 5) / 8);
  const hk = a => 1 - .85 * cl((a.H - 2) / 6);
  const fed = a => a.P - .6 * a.S;
  const tail = (a, s) => { if (a.H > 2) s += ' 비닐하우스가 많아 내려앉기를 꺼려요.'; if (a.F > 5) s += ' 숲이 넓어 시야가 막히는 건 불리해요.'; return s; };
  const FIELD = {
    crane: {
      opts: ['paddy', '@watergate', 'marsh'],
      score(n) { const a = f(n), food = cl(fed(a) / 8), roost = cl((a.Q + .5 * a.M) / 3); return (.55 * food + .45 * roost) * (.4 + .6 * open(a)) * hk(a); },
      why(n) {
        const a = f(n), food = fed(a) / 8, roost = (a.Q + .5 * a.M) / 3;
        return tail(a, food >= 1 && roost >= 1 ? '먹이를 찾을 논도, 밤에 쉴 얕은 물도 넉넉해요.'
          : food < 1 && food <= roost + .3 ? (a.P >= 8 ? '논은 넓은데, 볏짚을 판 논이 많아 먹이가 모자라요.' : '낟알을 주워 먹을 논이 아직 모자라요.')
            : '논은 있는데, 밤에 쉴 얕은 물이 모자라요. 논에 물꼬를 놓아 보세요.');
      },
      parts(n) { const a = f(n); return '먹이가 되는 논 ' + Math.max(0, Math.round(fed(a) * 10) / 10) + ' / 8, 쉴 얕은 물 ' + (a.Q + .5 * a.M) + ' / 3'; }
    },
    swan: {
      opts: ['water', 'reedbed', 'marsh'],
      score(n) { const a = f(n), w = cl(a.W / 6), e = cl((a.M + a.R) / 3); return w * (.6 + .4 * e) * (.5 + .5 * open(a)) * hk(a); },
      why(n) { const a = f(n); return tail(a, a.W === 0 ? '내려앉을 넓은 물이 없어요.' : a.W < 6 ? '물이 있지만 아직 좁아요.' : a.M + a.R < 3 ? '물은 넓은데, 물가에 습지나 갈대가 적어요.' : '넓은 물과 물가 풀숲이 다 있어요.'); },
      parts(n) { const a = f(n); return '물 ' + a.W + ' / 6, 물가의 습지와 갈대 ' + (a.M + a.R) + ' / 3'; }
    },
    stork: {
      opts: ['marsh', '@watergate', 'paddy'],
      score(n) { const a = f(n), sh = cl((a.M + a.Q) / 5), fd = cl(a.P / 6); return sh * (.7 + .3 * fd) * (.5 + .5 * open(a)) * hk(a); },
      why(n) { const a = f(n), sh = a.M + a.Q; return tail(a, sh < 3 ? '먹이를 잡을 얕은 물가가 거의 없어요.' : sh < 5 ? '얕은 물가가 생겼지만 아직 좁아요.' : a.P < 2 ? '얕은 물가는 넉넉한데, 곁에 논이 적어요.' : '얕은 물가와 논이 함께 있어요.'); },
      parts(n) { const a = f(n); return '얕은 물가(습지와 물 댄 논) ' + (a.M + a.Q) + ' / 5, 논 ' + a.P + ' / 6'; }
    },
    kestrel: {
      opts: ['grass', 'paddy'],
      score(n) { const a = f(n), hunt = cl((a.G + .4 * a.P) / 12), perch = .75 + .25 * cl(a.F / 2); return hunt * perch * (1 - .6 * cl((a.H - 2) / 6)) * (1 - cl((a.F - 8) / 8)); },
      why(n) { const a = f(n); return a.G + .4 * a.P < 8 ? '들쥐를 잡을 트인 풀밭이 모자라요.' : a.F < 1 ? '풀밭은 넓은데, 앉아서 살필 나무가 없어요.' : a.F > 8 ? '숲이 넓어 사냥할 트인 땅이 줄었어요.' : '사냥할 풀밭과 앉을 나무가 있어요.'; },
      parts(n) { const a = f(n); return '트인 풀밭과 논 ' + Math.round((a.G + .4 * a.P) * 10) / 10 + ' / 12, 앉을 숲 ' + a.F + ' / 2'; }
    },
    beangoose: {
      opts: ['paddy', 'water', 'marsh'],
      score(n) { const a = f(n), food = cl(fed(a) / 7), roost = cl((a.W + a.M + .5 * a.Q) / 3); return (.6 * food + .4 * roost) * (.5 + .5 * open(a)) * hk(a); },
      why(n) { const a = f(n), food = fed(a) / 7, roost = (a.W + a.M + .5 * a.Q) / 3; return tail(a, food >= 1 && roost >= 1 ? '먹을 논과 밤을 날 물가가 다 있어요.' : food < roost ? '낟알을 주워 먹을 논이 모자라요.' : '논은 있는데, 밤을 날 물가가 모자라요.'); },
      parts(n) { const a = f(n); return '먹이가 되는 논 ' + Math.max(0, Math.round(fed(a) * 10) / 10) + ' / 7, 밤을 날 물가 ' + (a.W + a.M + .5 * a.Q) + ' / 3'; }
    },
    wfgoose: {
      opts: ['paddy'],
      score(n) { const a = f(n); return cl(fed(a) / 5) * (.5 + .5 * open(a)) * hk(a); },
      why(n) { const a = f(n); return tail(a, fed(a) >= 5 ? '낟알이 남은 논이 넉넉해요.' : fed(a) >= 3.5 ? '낟알이 남은 논이 있어요. 조금 더 넓으면 좋아요.' : a.P >= 5 ? '논은 있는데, 볏짚을 판 논이 많아 먹이가 모자라요.' : '낟알을 주워 먹을 논이 모자라요.'); },
      parts(n) { const a = f(n); return '먹이가 되는 논 ' + Math.max(0, Math.round(fed(a) * 10) / 10) + ' / 5'; }
    },
    mallard: {
      opts: ['water', 'marsh'],
      score(n) { const a = f(n); return cl((a.W + .6 * a.M + .6 * a.Q) / 3) * (1 - .5 * cl((a.H - 3) / 6)); },
      why(n) { const a = f(n); return a.W + .6 * a.M + .6 * a.Q >= 3 ? '떠서 쉴 물이 넉넉해요.' : a.W + a.M + a.Q === 0 ? '떠서 쉴 물이 없어요.' : '물가가 생겼지만 아직 좁아요.'; },
      parts(n) { const a = f(n); return '물과 얕은 물가 ' + Math.round((a.W + .6 * a.M + .6 * a.Q) * 10) / 10 + ' / 3'; }
    }
  };
  RL.custom = FIELD;

  /* ---------- 자료로 만드는 규칙 (냇가, 숲, 바닷가) ---------- */
  const NEED = { strong: 5, some: 3, item: 2 }, WGT = { strong: 2, some: 1, item: .6 };
  const PEN = { strong: { pen: .85, free: 1, span: 5 }, some: { pen: .5, free: 2, span: 6 } };
  const cnt = (n, id) => n['@' + id] !== undefined ? n['@' + id] : (n[id] || 0);
  // 좋아하는 칸과 좋아하는 아이템을 한 줄로 세운다. 아이템은 한두 개면 넉넉하다.
  function likeList(sp) {
    const z = GD.zone(sp.zone);
    return sp.likes.concat((sp.itemLikes || []).filter(l => z.item[l.item] && l.item !== 'sign').map(l => ({ tile: l.item, weight: 'item', why: l.why })));
  }
  // 놓을 칸이 하나도 없는 아이템(보가 없을 때의 물고기 길)은 세지 않는다
  function usable(sp, l, n) {
    if (l.weight !== 'item') return true;
    const it = GD.zone(sp.zone).item[l.tile]; if (!it || it.placeOn.indexOf('*') >= 0) return true;
    return it.placeOn.some(id => (n[id] || 0) > 0);
  }
  function likeParts(sp, n) { return likeList(sp).filter(l => usable(sp, l, n)).map(l => ({ l, part: cl(cnt(n, l.tile) / (NEED[l.weight] || 3)), w: WGT[l.weight] || 1 })); }
  function genericScore(sp, n) {
    const ps = likeParts(sp, n); let s = .5;
    if (ps.length) { let a = 0, b = 0; ps.forEach(p => { a += p.w * p.part; b += p.w; }); s = a / b; }
    sp.dislikes.forEach(d => { const p = PEN[d.weight] || PEN.some; s *= 1 - p.pen * cl((cnt(n, d.tile) - p.free) / p.span); });
    return s;
  }
  const tileName = (sp, id) => { const z = GD.zone(sp.zone); return (z.tile[id] || z.item[id] || { name: id }).name; };
  // 가장 모자란 것 하나
  function lacking(sp, n) { const ps = likeParts(sp, n).filter(p => p.part < 1); ps.sort((a, b) => (a.part - b.part) || (b.w - a.w)); return ps[0] || null; }
  function tooMuch(sp, n) { return sp.dislikes.filter(d => { const p = PEN[d.weight] || PEN.some; return cnt(n, d.tile) > p.free; })[0] || null; }
  function genericWhy(sp, n) {
    if (sp.stub) return '아직 내용 자료가 없는 이웃이에요.';
    const lk = lacking(sp, n), dk = tooMuch(sp, n);
    let s = lk ? U.josa(tileName(sp, lk.l.tile), '이/가') + (lk.part === 0 ? ' 없어요.' : ' 모자라요.') + (lk.l.why ? ' (' + lk.l.why + ')' : '')
      : (sp.likes.length ? '바라는 땅이 갖춰졌어요.' : '바라는 땅을 아직 몰라요.');
    if (dk) s += ' ' + U.josa(tileName(sp, dk.tile), '이/가') + ' 많아 꺼려요.';
    return s;
  }

  /* ---------- 밖에서 쓰는 것 ---------- */
  RL.score = function (spId, n) { const c = FIELD[spId]; return cl(c ? c.score(n) : genericScore(GD.SP[spId], n)); };
  RL.level = s => s >= CFG.levelCut[1] ? 2 : s >= CFG.levelCut[0] ? 1 : 0;
  RL.why = function (spId, n) { const c = FIELD[spId]; return c ? c.why(n) : genericWhy(GD.SP[spId], n); };
  RL.parts = function (spId, n) {
    const c = FIELD[spId]; if (c) return c.parts(n);
    const sp = GD.SP[spId]; return likeList(sp).map(l => tileName(sp, l.tile) + ' ' + cnt(n, l.tile) + ' / ' + (NEED[l.weight] || 3)).join(', ');
  };

  // 돌봄이 얼마나 돼 있는가(0~1). 푯말, 가림막, 쉴 자리, 남겨 둔 먹이.
  RL.care = function (zoneId, n) {
    const z = GD.zone(zoneId); let c = 0; const list = [];
    z.items.forEach(i => { if (i.id !== 'watergate' && n['@' + i.id] > 0) { c += 1; list.push(i.name); } });
    const left = n.soldable ? 1 - n.sold / n.soldable : 0;
    if (n.soldable >= 2 && left >= .7) { c += 1; list.push('남겨 둔 먹이'); }
    return { ratio: cl(c / 3), list, foodLeft: left };
  };
  // 머무는가: 오는 조건이 넉넉하고, 돌봄이 돼 있고, 불청객이 없을수록 머문다.
  RL.stayScore = function (spId, n, zoneId) {
    const care = RL.care(zoneId || GD.SP[spId].zone, n);
    return cl(RL.score(spId, n) * (.74 + .26 * care.ratio) * (n.intruder ? .8 : 1));
  };
  // 본 적 없는 땅: 한 종류가 땅을 거의 다 덮으면 모른다고 말한다.
  RL.unknown = function (zoneId, n) {
    const N = n.cells || 37;
    if (zoneId === 'field') { const a = f(n); return a.W > .33 * N || a.M > .28 * N || a.W + a.M + a.Q > .55 * N || a.F > .5 * N; }
    const z = GD.zone(zoneId);
    return z.paintTiles.some(t => t.id !== z.base && (n[t.id] || 0) > .6 * N);
  };
  // AI 가 이 종에 대해 모른다고 말하는가 (구역의 aiDetail 과 종의 근거에 따라)
  RL.silent = function (spId) {
    const sp = GD.SP[spId], z = GD.zone(sp.zone);
    if (GD.S.traceRec[spId]) return false;          // 흔적을 찾으면 더 말해 준다
    return (z.aiDetail === 'unknown' && sp.tier === 'hard') || sp.stub;
  };

  /* 무엇을 몇 칸 바꾸면 한 단계 오르는가를 찾는다 */
  RL.hint = function (spId, n, zoneId) {
    const sp = GD.SP[spId], z = GD.zone(zoneId || sp.zone), L = RL.level(RL.score(spId, n));
    if (L === 2) return null;
    const c = FIELD[spId];
    const opts = c ? c.opts : likeList(sp).map(l => z.item[l.tile] ? '@' + l.tile : l.tile);
    let best = null;
    const donors = z.paintTiles.map(t => t.id);
    for (const T of opts) {
      for (let k = 1; k <= 10; k++) {
        const m = Object.assign({}, n);
        if (T[0] === '@') {                         // 아이템: 놓을 수 있는 칸이 남아 있어야 한다
          const def = z.item[T.slice(1)]; if (!def) break;
          const room = def.placeOn.indexOf('*') >= 0 ? m.cells : def.placeOn.reduce((a, id) => a + (m[id] || 0), 0);
          if ((m[T] || 0) + k > room) break;
          m[T] = (m[T] || 0) + k;
        } else {
          if (!z.tile[T] || z.tile[T].money) break;
          m[T] += k; let left = k;
          const order = [z.base].concat(donors.filter(d => d !== z.base));
          for (const D of order) { if (D === T) continue; const likes = sp.likes.some(l => l.tile === D) || (c && c.opts.indexOf(D) >= 0); if (likes) continue; const t = Math.min(left, m[D] || 0); m[D] -= t; left -= t; if (!left) break; }
          if (left) break;
        }
        if (RL.level(RL.score(spId, m)) > L) { if (!best || k < best.k) best = { T, k, L }; break; }
      }
    }
    // 꺼리는 칸을 줄이는 길
    const bad = (c ? ['greenhouse', 'wood'] : sp.dislikes.map(d => d.tile)).filter(id => z.tile[id]);
    for (const T of bad) for (let k = 1; k <= (n[T] || 0); k++) {
      const m = Object.assign({}, n); m[T] -= k; m[z.base] = (m[z.base] || 0) + k;
      if (RL.level(RL.score(spId, m)) > L) { if (!best || k <= best.k) best = { T, k, L, less: true }; break; }
    }
    return best;
  };
  RL.hintText = function (spId, h, zoneId) {
    const sp = GD.SP[spId], z = GD.zone(zoneId || sp.zone), to = GD.LV[h.L + 1];
    const end = U.josa(sp.name, '이/가') + ' 올 가능성이 \'' + to + '\'으로 올라가요.';
    if (h.T[0] === '@') { const it = z.item[h.T.slice(1)]; const on = it.placeOn.indexOf('*') >= 0 ? '칸' : z.tile[it.placeOn[0]].name; return on + ' ' + h.k + '칸에 ' + U.josa(it.name, '을/를') + ' 놓으면 ' + end; }
    const nm = z.tile[h.T].name;
    return U.josa(nm, '을/를') + ' ' + h.k + (h.less ? '칸 줄이면 ' : '칸 더 두면 ') + end;
  };

  /* 설명: 구역마다 말해 주는 범위가 다르다 (자료의 aiDetail)
     count 무엇을 몇 칸 바꿀지까지 / lack 무엇이 모자란지만 / unknown 어려운 발길은 아직 모름 / conflict 알려 주지만 다 들어줄 수는 없음
     흔적을 찾은 종은 한 단계 더 자세히 말해 준다. */
  RL.explain = function (zoneId, spId, n) {
    const z = GD.zone(zoneId), sp = GD.SP[spId], traced = !!GD.S.traceRec[spId];
    if (RL.unknown(zoneId, n)) return '이런 땅은 관찰 기록에 거의 없어요. 그래서 AI는 짐작하지 않고 모른다고 말해요.';
    if (RL.silent(spId)) return sp.stub ? U.josa(sp.name, '은/는') + ' 아직 내용 자료가 없어요.' : U.josa(sp.name, '은/는') + ' 관찰 기록이 없어서 AI가 아직 몰라요. 흔적을 찾으면 조금 더 알 수 있어요.';
    const L = RL.level(RL.score(spId, n));
    let detail = z.aiDetail; if (traced) detail = detail === 'unknown' ? 'lack' : 'count';
    if (L === 2) return U.josa(sp.name, '이/가') + ' 올 가능성이 높아요. 그래도 매번 오는 건 아니에요. 머물게 하려면 조용히 지켜보고 돌봄 아이템을 놓아 보세요.';
    let s;
    if (detail === 'count') { const h = RL.hint(spId, n, zoneId); s = h ? RL.hintText(spId, h, zoneId) : U.josa(sp.name, '은/는') + ' 칸 몇 개로는 부족해요. 땅을 더 크게 바꿔야 해요.'; if (traced) s += ' 지금은 ' + RL.parts(spId, n) + '이에요.'; }
    else s = sp.name + ': ' + RL.why(spId, n);
    if (z.aiDetail === 'conflict') { const c = RL.conflict(zoneId, spId, n); if (c) s += ' ' + c; }
    return s;
  };
  // 한 이웃이 바라는 것을 늘리면 다른 이웃이 바라는 것이 줄어드는가
  RL.conflict = function (zoneId, spId, n) {
    const z = GD.zone(zoneId), sp = GD.SP[spId], lk = lacking(sp, n); if (!lk) return '';
    const A = lk.l.tile;
    for (const o of z.species) {
      if (o.id === spId || o.stub) continue;
      const hates = o.dislikes.some(d => d.tile === A);
      const oWant = o.likes.filter(l => l.weight === 'strong' && l.tile !== A && !sp.likes.some(x => x.tile === l.tile))[0];
      if (hates) return U.josa(tileName(sp, A), '을/를') + ' 늘리면 ' + U.josa(o.name, '이/가') + ' 꺼려요. 다 들어줄 수는 없어요.';
      if (oWant && n.cells && (n[z.base] || 0) < 3) return U.josa(tileName(sp, A), '을/를') + ' 늘리려면 ' + U.josa(o.name, '이/가') + ' 바라는 ' + U.josa(tileName(sp, oWant.tile), '을/를') + ' 줄여야 해요. 다 들어줄 수는 없어요.';
    }
    return '';
  };
})();
