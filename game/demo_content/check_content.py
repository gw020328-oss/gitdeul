# 내용 자료 점검: python3 -I demo_content/check_content.py
import json, re, os, sys
here=os.path.dirname(os.path.abspath(__file__)); root=os.path.dirname(here)
con=open(os.path.join(root,"demo","CONTRACT.md"),encoding="utf-8").read()
def table(title):
    sec=con.split(title,1)[1].split("\n## ",1)[0]
    return [[c.strip().strip("`") for c in l.strip("|").split("|")] for l in sec.splitlines() if l.startswith("|") and not l.startswith("|--") and not l.startswith("| id")]
nb={r[0]:r for r in table("## 이웃 이름표")}
ib={r[0]:r for r in table("## 불청객 이름표")}
zb={r[0]:r for r in table("## 구역 이름표")}
tiers={r[0] for r in table("## 자리 이름표")}
Z=json.load(open(os.path.join(here,"zones.json"),encoding="utf-8"))
S=json.load(open(os.path.join(here,"species.json"),encoding="utf-8"))
N=json.load(open(os.path.join(here,"news.json"),encoding="utf-8"))
err=[]
def e(m): err.append(m)
zones={z["id"]:z for z in Z["zones"]}
if set(zones)!=set(zb): e("구역 id 불일치 %s"%(set(zones)^set(zb)))
sp={s["id"]:s for s in S["species"]}
if len(sp)!=len(S["species"]): e("이웃 id 중복")
if set(sp)!=set(nb): e("이웃 id 불일치 %s"%(set(sp)^set(nb)))
for i,s in sp.items():
    r=nb.get(i)
    if not r: continue
    if (s["name"],s["zone"],s["tier"],s["kind"])!=(r[1],r[2],r[3],r[4]): e("이웃 이름표와 다름: %s"%i)
    zt={t["id"] for t in zones[s["zone"]]["tiles"]}
    zi={t["id"] for t in zones[s["zone"]]["items"]}|{zones[s["zone"]]["earn"]["small"]["id"]}
    for k in ("likes","dislikes"):
        for x in s[k]:
            if x["tile"] not in zt: e("%s %s 칸 id 없음: %s"%(i,k,x["tile"]))
            if x["weight"] not in ("strong","some"): e("%s weight"%i)
    for x in s.get("itemLikes",[]):
        if x["item"] not in zi: e("%s itemLikes 없는 아이템 %s"%(i,x["item"]))
    for p in s["dayPart"]:
        if p not in ("dawn","day","dusk","night"): e("%s dayPart"%i)
    if s["basis"] not in ("model","literature"): e("%s basis"%i)
    if set(s["stages"])!={"visit","stay","settle"} or not all(s["stages"].values()): e("%s stages"%i)
    if s["story"]["checked"] and not s["story"]["sources"]: e("%s checked인데 출처 없음"%i)
    if s["badgesChecked"] is not True and s["id"]!="eoreumchi": e("%s 표지 미확인"%i)
ints=[]
for z in zones.values():
    ints.append(z["intruder"]["id"]); ints+=z["intruder"].get("also",[])
    zt={t["id"] for t in z["tiles"]}
    for it in z["items"]:
        for p in it["placeOn"]:
            if p!="*" and p not in zt: e("%s 아이템 placeOn 없음 %s"%(z["id"],p))
    for t in z["tiles"]:
        if t["costLevel"] not in ("조금","보통","많이","아주 많이",None): e("costLevel %s"%t["id"])
    if z["aiDetail"] not in ("count","lack","unknown","conflict"): e("aiDetail")
if set(ints)!=set(ib) or len(ints)!=5: e("불청객 id 불일치 %s"%(set(ints)^set(ib)))
if {x["id"] for x in Z["intruders"]}!=set(ib): e("intruders 목록 불일치")
nz=set(zb)|{"*"}
for n in N["news"]:
    if n["zone"] not in nz: e("소식 구역 %s"%n["id"])
ids=[n["id"] for n in N["news"]]
if len(ids)!=len(set(ids)): e("소식 id 중복")
raw="".join(open(os.path.join(here,f),encoding="utf-8").read() for f in ("zones.json","species.json","news.json"))
for pat,name in ((r"[\U0001F300-\U0001FAFF☀-➿]","이모지"),(r"[←-⇿⟰-⟿⤀-⥿]|->|=>","화살표"),("귀하|흔하|희귀","값 매기는 말")):
    if re.search(pat,raw): e("금지: "+name+" "+re.search(pat,raw).group())
print("이웃",len(sp),"불청객",len(ints),"소식",len(ids))
print("오류",len(err)); [print(" -",m) for m in err]
sys.exit(1 if err else 0)
