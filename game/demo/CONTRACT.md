# 깃들 데모: 세션끼리의 약속

세 세션이 나눠서 만든다. 이 파일은 서로 맞춰야 하는 것만 적는다. 고치지 말고, 바꿔야 하면 자기 폴더의 메모에 적어 알린다.

## 폴더와 주인

| 폴더 | 주인 | 내용 |
|---|---|---|
| `demo/` | 데모 만드는 세션 | 게임 코드. 다른 세션은 읽기만 한다 |
| `demo_content/` | 내용 자료 세션 | 구역, 이웃, 소식, 도감 글을 담은 자료 파일 |
| `demo_models/` | 간단한 모형 세션 | 코드로 그린 간단한 3D 모형 |

- 자기 폴더 밖의 파일은 고치지 않는다. 이 폴더의 다른 파일(`mockup_v2.html`, `*_meshy*.js`, `gitdeul_play.html`, `build_play.py`, 기획서 등)은 읽기만 한다.
- `gitdeul/`(GitHub 저장소 사본)은 건드리지 않는다. 커밋과 푸시를 하지 않는다.
- 바탕 문서는 `깃들_1차_기획서.md`다. 자세한 근거는 `깃들_기획서.md`, `게임_흐름_설계안.md`, `행동_문헌조사.md`에 있다.

## 구역 이름표

| id | 이름 | 제철 | 차례 |
|---|---|---|---|
| `field` | 겨울 들녘 | 겨울 | 1 |
| `stream` | 봄 냇가 | 봄 | 2 |
| `forest` | 여름 숲 | 여름 | 3 |
| `coast` | 가을 바닷가 | 가을 | 4 |

## 자리 이름표

| id | 이름 |
|---|---|
| `often` | 잦은 발길 |
| `seldom` | 뜸한 발길 |
| `hard` | 어려운 발길 |

## 이웃 이름표 (36종)

| id | 이름 | 구역 | 자리 | 갈래 |
|---|---|---|---|---|
| `crane` | 두루미 | field | hard | bird |
| `stork` | 황새 | field | hard | bird |
| `swan` | 큰고니 | field | hard | bird |
| `kestrel` | 황조롱이 | field | seldom | bird |
| `beangoose` | 큰기러기 | field | seldom | bird |
| `wfgoose` | 쇠기러기 | field | often | bird |
| `mallard` | 청둥오리 | field | often | bird |
| `eoreumchi` | 어름치 | stream | hard | fish |
| `gamdol` | 감돌고기 | stream | hard | fish |
| `otter` | 수달 | stream | hard | mammal |
| `mandarin` | 원앙 | stream | seldom | bird |
| `ssogari` | 쏘가리 | stream | seldom | fish |
| `ayu` | 은어 | stream | seldom | fish |
| `pirami` | 피라미 | stream | often | fish |
| `galgyeoni` | 참갈겨니 | stream | often | fish |
| `beodeulchi` | 버들치 | stream | often | fish |
| `goral` | 산양 | forest | hard | mammal |
| `flyingsquirrel` | 하늘다람쥐 | forest | hard | mammal |
| `scopsowl` | 소쩍새 | forest | seldom | bird |
| `hawkowl` | 솔부엉이 | forest | seldom | bird |
| `badger` | 오소리 | forest | seldom | mammal |
| `roedeer` | 노루 | forest | seldom | mammal |
| `chipmunk` | 다람쥐 | forest | often | mammal |
| `redsquirrel` | 청설모 | forest | often | mammal |
| `hare` | 멧토끼 | forest | often | mammal |
| `ghostcrab` | 달랑게 | coast | hard | crab |
| `spoonbillsandpiper` | 넓적부리도요 | coast | hard | bird |
| `seal` | 점박이물범 | coast | hard | mammal |
| `rugosa` | 해당화 | coast | seldom | plant |
| `fiddler` | 농게 | coast | seldom | crab |
| `sandbubbler` | 엽낭게 | coast | seldom | crab |
| `spoonbill` | 저어새 | coast | seldom | bird |
| `reed` | 갈대 | coast | often | plant |
| `suaeda` | 칠면초 | coast | often | plant |
| `mudcrab` | 칠게 | coast | often | crab |
| `heron` | 왜가리 | coast | often | bird |

## 불청객 이름표

| id | 이름 | 구역 | 갈래 |
|---|---|---|---|
| `visitors` | 구경꾼 | field | person |
| `bass` | 배스 | stream | fish |
| `bluegill` | 블루길 | stream | fish |
| `sika` | 꽃사슴 | forest | mammal |
| `spartina` | 영국갯끈풀 | coast | plant |

## 내용 자료의 모양 (`demo_content/`)

모두 UTF-8 JSON이다. 숫자로 된 값(값, 확률, 빠르기)은 넣지 않는다. 숫자는 게임 코드 쪽에서 정한다.

`zones.json`

```json
{ "zones": [ {
  "id": "field", "name": "겨울 들녘", "season": "겨울", "order": 1,
  "walk": "논둑을 걷는다", "dilemma": "넓이를 어떻게 나눌까",
  "aiDetail": "count",
  "tiles":  [ { "id": "paddy", "name": "논", "goodFor": "추수한 논의 낟알이 두루미와 기러기의 먹이다", "costLevel": "조금" } ],
  "items":  [ { "id": "watergate", "name": "물꼬", "placeOn": ["paddy"], "does": "그 논에 물을 얕게 댄다", "kind": "care" } ],
  "earn":   { "big":   { "id": "greenhouse", "name": "비닐하우스", "price": "먹이터가 사라진다" },
              "small": { "id": "straw", "name": "볏짚 팔기", "leaveFor": "두루미가 먹는다" },
              "guest": { "id": "visitors", "name": "구경꾼" } },
  "intruder": { "id": "visitors", "when": "어려운 발길이 왔다는 소문", "harm": "새들의 편안함이 깎인다", "counter": ["푯말", "가림막"] }
} ] }
```

- `aiDetail`: `count`(무엇을 몇 칸 바꿀지까지), `lack`(무엇이 모자란지만), `unknown`(어려운 발길은 아직 모름), `conflict`(알려 주지만 다 들어줄 수는 없음)
- `costLevel`: 조금, 보통, 많이, 아주 많이
- 칸과 아이템의 id는 영어 소문자 낱말로 짓는다. 들녘의 칸 id는 `paddy`, `marsh`, `water`, `reedbed`, `grass`, `wood`, `house`, `greenhouse`로 한다.

`species.json`

```json
{ "species": [ {
  "id": "crane", "zone": "field", "name": "두루미", "sci": "Grus japonensis",
  "tier": "hard", "kind": "bird",
  "badges": ["천연기념물", "멸종위기 I급"], "badgesChecked": true,
  "dayPart": ["day"], "hidden": false,
  "basis": "model",
  "likes":    [ { "tile": "paddy", "weight": "strong", "why": "낟알을 주워 먹는다", "from": "기획서 11.1" } ],
  "dislikes": [ { "tile": "greenhouse", "weight": "strong", "why": "먹이터가 사라진다", "from": "기획서 11.1" } ],
  "stages": { "visit": "부부가 번갈아 고개를 들며 경계한다", "stay": "가족이 깃을 다듬는다", "settle": "한 쌍이 춤추고 함께 운다" },
  "traces": ["footprint", "feather", "dropping"],
  "story": { "text": "…", "sources": ["https://…"], "checked": true }
} ] }
```

- `dayPart`: `dawn`, `day`, `dusk`, `night` 가운데 만날 수 있는 때
- `hidden`: 처음에 모습이 아니라 흔적이나 소리로 만나는 이웃이면 true
- `basis`: `model`(자료가 있어 모델로 판단할 종), `literature`(자료가 없어 문헌 규칙으로 가는 종)
- `weight`: `strong`, `some`
- `from`: 그 말의 출처. 문서에 없는 짐작이면 `"짐작"`이라고 적는다. 지어낸 사실을 확인된 것처럼 적지 않는다.
- `checked`가 false인 글은 화면에 임시라고 표시한다.

`news.json`

```json
{ "news": [ { "id": "footprint", "zone": "*", "text": "논둑에 발자국이 보여요", "when": "다녀간 흔적이 생긴 날" } ] }
```

## 간단한 모형의 모양 (`demo_models/`)

`simple_models.js` 한 파일이다. 전역 `THREE`(r128)를 쓴다. 바깥 파일을 읽지 않는다.

```js
window.GD_SIMPLE = {
  ids: ["crane", "stork", …],            // 이웃 36종과 불청객 5종
  make(id, opts) {                        // opts.stage: 1 들름, 2 머묾, 3 깃듦 (풀은 자란 정도)
    return {
      group,                              // THREE.Group. 발밑 가운데가 원점, 위가 +Y, 앞이 +Z
      height,                             // 미터로 잰 실제 키 (1 단위 = 1 m)
      update(dt, t, mode) {}              // mode: "idle", "feed", "alert", "move", "rest"
    };
  }
};
```

- 텍스처 없이 색만 쓴다. 한 모형은 삼각형 400개 안쪽으로 한다.
- 크기는 실제 크기에 맞춘다. 게임 쪽에서 필요하면 키운다.
- `preview.html`에서 41개를 한 화면에 늘어놓아 눈으로 확인할 수 있게 한다.
