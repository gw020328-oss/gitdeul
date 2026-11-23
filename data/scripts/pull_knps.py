# 공공데이터포털 15107939 (국립공원공단_국립공원 생물자원 현황)의 올해 판과 지난 해 파일을 모두 받는다.
# 쓰는 법: python3 pull_knps.py <판 목록 txt: 날짜와 번호> <받을 폴더>
import re, sys, json, time, html, urllib.parse, urllib.request, os

page, outdir = sys.argv[1], sys.argv[2]
vers = [tuple(l.split()) for l in open(page, encoding="utf-8") if l.strip()]
print(len(vers), "versions", flush=True)

B = "https://www.data.go.kr"


def post(path, d):
    req = urllib.request.Request(B + path, data=urllib.parse.urlencode(d).encode())
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.loads(r.read().decode("utf-8", "replace"))


tot = 0
for nm, pk in vers:
    tag = nm
    try:
        j = post("/tcs/dss/selectFileDataDownload.do", {
            "publicDataDetailPk": pk, "publicDataPk": "15107939", "atchFileId": "",
            "fileDetailSn": "1", "publicDataTyCode": "PR0051",
            "url": "/tcs/dss/selectFileDataDownload.do"})
        if not j.get("status"):
            print(tag, "ERR", j.get("error"), flush=True)
            continue
        u = B + "/cmm/cmm/fileDownload.do?" + urllib.parse.urlencode({
            "atchFileId": j["atchFileId"], "fileDetailSn": j["fileDetailSn"],
            "dataNm": j["dataSetFileDetailInfo"]["dataNm"]})
        with urllib.request.urlopen(u, timeout=180) as r:
            b = r.read()
            cd = urllib.parse.unquote(r.headers.get("content-disposition", ""))
        e = re.search(r'\.([A-Za-z0-9]{2,4})["\']?\s*$', cd)
        fn = os.path.join(outdir, "knps_%s.%s" % (tag, e.group(1).lower() if e else "bin"))
        with open(fn, "wb") as fh:
            fh.write(b)
        tot += len(b)
        print(tag, len(b), os.path.basename(fn), flush=True)
    except Exception as ex:
        print(tag, "FAIL", repr(ex)[:200], flush=True)
    time.sleep(0.5)
print("DONE", tot)
