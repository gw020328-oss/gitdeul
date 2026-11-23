# GBIF 공개 검색 API로 한국의 겨울(11~3월) eBird 관찰 기록을 받는다. 계정이 필요 없다.
# 한 번의 질의는 10만 건까지만 넘길 수 있어서 해와 달로 나눠 받는다.
import json, gzip, csv, sys, time, urllib.parse, urllib.request
OUT = sys.argv[1]
UA = {"User-Agent": "python-urllib (student research script)"}
API = "https://api.gbif.org/v1/"
def get(path, p=None):
    url = API + path + ("?" + urllib.parse.urlencode(p) if p else "")
    for k in range(6):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.load(r)
        except Exception as e:
            time.sleep(3 + 4 * k)
    raise SystemExit("failed: " + url)
ds = get("dataset/search", {"q": "EOD eBird Observation Dataset", "limit": 5})
EOD = [d["key"] for d in ds["results"] if "ebird" in d["title"].lower()][0]
print("dataset", EOD, flush=True)
F = ["gbifID", "eventID", "species", "speciesKey", "decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters", "year", "month", "day", "individualCount", "stateProvince"]
n = 0
with gzip.open(OUT, "wt", encoding="utf-8", newline="") as fh:
    w = csv.writer(fh); w.writerow(F)
    for y in range(2010, 2027):
        for m in (1, 2, 3, 11, 12):
            base = {"country": "KR", "datasetKey": EOD, "year": y, "month": m, "hasCoordinate": "true"}
            tot = get("occurrence/search", dict(base, limit=0))["count"]
            if tot > 100000: print("WARNING over 100k", y, m, tot, flush=True)
            off = 0
            while off < min(tot, 100000):
                r = get("occurrence/search", dict(base, limit=300, offset=off))
                for o in r["results"]:
                    w.writerow([o.get(k, "") for k in F])
                n += len(r["results"]); off += 300
                if r.get("endOfRecords"): break
                time.sleep(0.15)
            print(y, m, tot, "total", n, flush=True)
print("DONE", n, flush=True)
