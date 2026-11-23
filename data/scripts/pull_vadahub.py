# 해양수산부 공동활용체계(vadahub.go.kr)의 표 미리보기를 쪽마다 받아 csv로 적는다.
# 쓰는 법: python3 pull_vadahub.py <표 이름> <bsisDtaSn> <열 이름들, 쉼표로> <저장할 csv.gz>
import sys, json, gzip, csv, time, urllib.parse, urllib.request

table, sn, cols, out = sys.argv[1], sys.argv[2], sys.argv[3].split(","), sys.argv[4]
URL = "https://www.vadahub.go.kr/user/meta/selectSankeyDataTableInfo.do"


def page(start, draw):
    p = [("draw", draw), ("start", start), ("length", 1000), ("columnSize", len(cols)),
         ("gubun", "map"), ("relateDtaNm", table), ("maskingYn", "N"), ("bsisDtaSn", sn),
         ("order[0][column]", 0), ("order[0][dir]", "desc"),
         ("search[value]", ""), ("search[regex]", "false")]
    for i, c in enumerate(cols):
        p += [("columns[%d][data]" % i, c), ("columns[%d][name]" % i, ""),
              ("columns[%d][searchable]" % i, "true"), ("columns[%d][orderable]" % i, "true"),
              ("columns[%d][search][value]" % i, ""), ("columns[%d][search][regex]" % i, "false")]
    req = urllib.request.Request(URL, data=urllib.parse.urlencode(p).encode())
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


n, start, draw, total = 0, 0, 1, None
with gzip.open(out, "wt", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh)
    w.writerow(cols)
    while True:
        res = page(start, draw)
        d = res.get("data") or []
        if total is None:
            total = res.get("recordsTotal") or res.get("setRecordsTotal")
        for row in d:
            w.writerow([row.get(c, "") if row.get(c) is not None else "" for c in cols])
        n += len(d)
        print(start, len(d), "of", total, flush=True)
        if len(d) < 1000:
            break
        start += 1000
        draw += 1
        time.sleep(0.4)
print("DONE", n)
