# 공공데이터포털 파일 자료 한 건을 받는다. 크기만 볼 때는 끝에 size 를 붙인다.
# 쓰는 법: python3 pull_datagokr.py <자료 번호> <uddi 번호> <저장할 파일 앞이름> [size]
import re, sys, json, urllib.parse, urllib.request

pk, detail, prefix = sys.argv[1], sys.argv[2], sys.argv[3]
only_size = len(sys.argv) > 4 and sys.argv[4] == "size"
B = "https://www.data.go.kr"
d = {"publicDataDetailPk": detail, "publicDataPk": pk, "atchFileId": "", "fileDetailSn": "1",
     "publicDataTyCode": "PR0051", "url": "/tcs/dss/selectFileDataDownload.do"}
req = urllib.request.Request(B + "/tcs/dss/selectFileDataDownload.do", data=urllib.parse.urlencode(d).encode())
with urllib.request.urlopen(req, timeout=60) as r:
    j = json.loads(r.read().decode("utf-8", "replace"))
if not j.get("status"):
    raise SystemExit("ERR " + str(j.get("error")))
u = B + "/cmm/cmm/fileDownload.do?" + urllib.parse.urlencode({
    "atchFileId": j["atchFileId"], "fileDetailSn": j["fileDetailSn"],
    "dataNm": j["dataSetFileDetailInfo"]["dataNm"]})
with urllib.request.urlopen(u, timeout=600) as r:
    cd = urllib.parse.unquote(r.headers.get("content-disposition", ""))
    size = r.headers.get("content-length")
    print(pk, j["dataSetFileDetailInfo"]["dataNm"], "| size", size, "|", cd[-60:], flush=True)
    if only_size:
        raise SystemExit(0)
    e = re.search(r'\.([A-Za-z0-9]{2,4})["\']?\s*$', cd)
    fn = prefix + "." + (e.group(1).lower() if e else "bin")
    n = 0
    with open(fn, "wb") as fh:
        while True:
            b = r.read(1 << 20)
            if not b:
                break
            fh.write(b)
            n += len(b)
print("saved", fn, n)
