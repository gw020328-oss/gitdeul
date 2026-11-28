# 게임

깃들의 데모다. 로그인과 서버 없이 브라우저에서 돈다. 저장은 각자의 브라우저에 된다.

바로 해 보기: https://gw020328-oss.github.io/gitdeul/

| 폴더 | 무엇 |
|---|---|
| `demo/` | 게임 코드. 실행 방법, 파일 구조, 임시로 둔 것, 확인하지 못한 것은 `demo/README.md`에 있다 |
| `demo_content/` | 네 구역과 이웃 36종의 자료(JSON). 짐작으로 채운 곳은 `demo_content/README.md`에 있다 |
| `demo_models/` | 코드로 그린 간단한 모형 41개 |

내 컴퓨터에서 돌리기

```bash
cd game
python3 -m http.server 8765 --bind 127.0.0.1
```

그리고 `http://localhost:8765/demo/index.html`을 연다.

한 파일로 묶기

```bash
python3 game/demo/build.py
```

`game/깃들_데모.html`이 만들어진다. 이 파일은 저장소에 올리지 않는다.

기준이 되는 문서는 `docs/깃들_1차_기획서.md`다. AI 판단은 아직 임시 규칙이고, 모델을 연결할 자리는 `demo/js/rules.js`다.
