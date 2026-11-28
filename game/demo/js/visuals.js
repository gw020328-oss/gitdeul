/* 깃들 데모: 칸의 생김새
   칸 종류마다 높이(h), 흙의 색(c), 자라는 것(veg), 눈이 쌓이는 정도(snow), 작은 그림의 색(sw)을 적는다.
   자료 파일에는 숫자가 없으므로 생김새는 여기서 정한다. 목록에 없는 칸은 이름으로 어림해서 만든다. */
(function () {
  const V = GD.vis = {};
  V.WL = -0.05;          // 물의 높이
  V.OUT_H = 0.03;        // 구역 바깥 땅의 높이

  const T = {
    /* 겨울 들녘 */
    paddy:      { h: 0.0,   c: [.76, .65, .44], veg: 'stubble', snow: -.08, sw: '#cdb47c' },
    'paddy+watergate': { h: -.085, c: [.38, .32, .22], veg: 'stubble', snow: -1, sw: '#9db3ad' },
    marsh:      { h: -.05,  c: [.52, .5, .31],  veg: 'marsh',  snow: -.25, sw: '#8f9a6b', rough: .13 },
    water:      { h: -.34,  c: [.3, .34, .31],  veg: null,     snow: -1,   sw: '#86aebd', rough: .05 },
    reedbed:    { h: -.02,  c: [.65, .56, .37], veg: 'reed',   snow: -.16, sw: '#c2a467', rough: .04 },
    grass:      { h: .05,   c: [.7, .66, .42],  veg: 'grass',  snow: 0,    sw: '#cfc48f' },
    wood:       { h: .1,    c: [.42, .43, .28], veg: 'pine',   snow: .1,   sw: '#4f6f55', rough: .1 },
    house:      { h: .06,   c: [.7, .63, .48],  veg: 'yard',   snow: -.02, sw: '#b9a27c' },
    greenhouse: { h: .04,   c: [.6, .56, .44],  veg: null,     snow: -.3,  sw: '#eef1ee' },
    path:       { h: .03,   c: [.66, .57, .42], veg: null,     snow: -.5,  sw: '#bfa77e' },
    pavilion:   { h: .05,   c: [.68, .62, .45], veg: 'yard',   snow: -.3,  sw: '#a4855c' },
    /* 봄 냇가 */
    riffle:     { h: -.1,   c: [.55, .56, .5],  veg: 'pebble', sw: '#a9c7c9' },
    pool:       { h: -.36,  c: [.24, .33, .34], veg: null,     sw: '#4f8496' },
    riparian:   { h: .06,   c: [.4, .5, .28],   veg: 'tree',   sw: '#6f9a5c', rough: .08 },
    farmland:   { h: .02,   c: [.62, .55, .34], veg: 'crop',   sw: '#c9b56a' },
    farm:       { h: .02,   c: [.62, .55, .34], veg: 'crop',   sw: '#c9b56a' },
    bank:       { h: .04,   c: [.66, .64, .5],  veg: 'yard',   sw: '#cdc6a0' },
    bankwood:   { h: .06,   c: [.4, .5, .28],   veg: 'tree',   sw: '#6f9a5c', rough: .08 },
    village:    { h: .06,   c: [.66, .62, .55], veg: 'hut',    sw: '#c2b6a2' },
    weir:       { h: -.02,  c: [.6, .6, .58],   veg: 'weir',   sw: '#9a9a96' },
    /* 여름 숲 */
    broadleaf:  { h: .12,   c: [.3, .45, .22],  veg: 'tree',   sw: '#5f9a4e', rough: .12 },
    conifer:    { h: .14,   c: [.25, .38, .24], veg: 'pine',   sw: '#3f6f4c', rough: .12 },
    valley:     { h: -.14,  c: [.4, .45, .4],   veg: 'pebble', sw: '#7fb0b8' },
    rock:       { h: .22,   c: [.52, .5, .47],  veg: 'boulder', sw: '#9d978c', rough: .18 },
    meadow:     { h: .05,   c: [.5, .6, .3],    veg: 'grass',  sw: '#a9c26a' },
    clearing:   { h: .04,   c: [.58, .52, .36], veg: 'stump',  sw: '#bfa56f' },
    /* 가을 바닷가 */
    mud:        { h: -.03,  c: [.42, .38, .33], veg: null,     sw: '#8a7b6c' },
    sand:       { h: .0,    c: [.82, .74, .56], veg: null,     sw: '#e2cf9f' },
    mixed:      { h: -.015, c: [.62, .56, .44], veg: 'pebble', sw: '#b9a888' },
    creek:      { h: -.2,   c: [.34, .4, .4],   veg: null,     sw: '#6f9fb0' },
    channel:    { h: -.2,   c: [.34, .4, .4],   veg: null,     sw: '#6f9fb0' },
    dune:       { h: .12,   c: [.86, .78, .6],  veg: 'grass',  sw: '#ead9a8', rough: .1 },
    farmflat:   { h: -.08,  c: [.4, .45, .46],  veg: 'weir',   sw: '#8fa3a8' },
    saltpan:    { h: -.03,  c: [.75, .76, .74], veg: null,     sw: '#dcdedb' }
  };
  V.tiles = T;

  // 이름으로 어림하기: 자료의 칸 id 가 위 목록과 다를 때
  const GUESS = [
    [/riffle|rapid|shallow|shoal/, 'riffle'], [/pool|deep/, 'pool'], [/ripar|bank|waterside|streamwood/, 'riparian'],
    [/farm|field|crop/, 'farmland'], [/village|town|house/, 'village'], [/weir|dam/, 'weir'],
    [/broad|oak|decid/, 'broadleaf'], [/conif|pine/, 'conifer'], [/valley|gorge|brook|stream/, 'valley'], [/rock|cliff|stone/, 'rock'],
    [/meadow|grass/, 'meadow'], [/clear|cut|log/, 'clearing'],
    [/mud|silt/, 'mud'], [/sand/, 'sand'], [/mix/, 'mixed'], [/creek|channel|tidal/, 'creek'], [/dune/, 'dune'], [/aqua|fishfarm|cage/, 'farm'], [/salt/, 'saltpan'],
    [/water|pond|lake/, 'water'], [/marsh|wet/, 'marsh'], [/reed/, 'reedbed'], [/wood|forest/, 'wood']
  ];
  const cache = {};
  V.tile = function (id) {
    if (T[id]) return T[id];
    if (cache[id]) return cache[id];
    for (const [re, to] of GUESS) if (re.test(id)) return (cache[id] = T[to]);
    const h = Math.abs(GD.util.hashStr(id)) % 360, f = (n) => { const k = (n + h / 30) % 12; return .55 - .18 * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return (cache[id] = { h: .03, c: [f(0), f(8), f(4)], veg: null, sw: 'hsl(' + h + ',30%,60%)' });
  };
  V.swatch = id => V.tile(id).sw || '#bbb';
  V.itemSwatch = { watergate: '#9db3ad', sign: '#8a6a45', blind: '#b79a5f', rest: '#7d8f6a', fishway: '#7fa7b5', bankgrass: '#8aa860', nestbox: '#a07a4c', pathblock: '#7a6a52', sandfence: '#c9a86a', channelopen: '#6f9fb0' };
  V.decorSwatch = { wall: '#9d978c', path: '#bfa77e', pavilion: '#a4855c' };
  // 구역의 큰 육각형 색 (지도)
  V.zoneColor = { field: '#d9cfa6', stream: '#a9cdd0', forest: '#8fb27c', coast: '#e3c9a0' };
})();
