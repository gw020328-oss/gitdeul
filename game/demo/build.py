# 깃들 데모를 묶는다.
#   python3 demo/build.py
#
# 하는 일
#   1. demo_content/ 의 자료(zones.json, species.json, news.json)를 demo/js/content_data.js 로 옮긴다.
#      내용 자료를 고친 뒤에는 이 스크립트를 다시 돌려야 게임에 반영된다.
#   2. demo/index.html 과 그 안의 파일들을 한 파일로 묶어, 이 폴더의 위에 '깃들_데모.html' 을 만든다.
#      그 파일 하나만 내려받아 더블클릭하면 돈다. three.js 만 인터넷(CDN)에서 불러온다.
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, "깃들_데모.html")


def read(path):
    return io.open(path, encoding="utf-8").read()


def write(path, text):
    io.open(path, "w", encoding="utf-8").write(text)


# ---------- 1. 내용 자료 ----------
content = {}
cdir = os.path.join(ROOT, "demo_content")
for name, key in (("zones.json", "zones"), ("species.json", "species"), ("news.json", "news")):
    p = os.path.join(cdir, name)
    if not os.path.exists(p):
        print("없음:", name, "(바탕 자료로 돈다)")
        continue
    data = json.loads(read(p))
    content[key] = data.get(key, [])
    if key == "zones" and "intruders" in data:
        content["intruders"] = data["intruders"]
js = "/* build.py 가 demo_content/ 에서 만든 파일이다. 손으로 고치지 않는다. */\nwindow.GD_CONTENT = " + (
    json.dumps(content, ensure_ascii=False, separators=(",", ":")) if content else "null") + ";\n"
write(os.path.join(HERE, "js", "content_data.js"), js)
print("내용 자료: 구역 %d, 이웃 %d, 소식 %d" % (len(content.get("zones", [])), len(content.get("species", [])), len(content.get("news", []))))

# ---------- 2. 한 파일로 묶기 ----------
html = read(os.path.join(HERE, "index.html"))


def inline_css(m):
    return "<style>\n" + read(os.path.join(HERE, m.group(1))) + "</style>"


html, n = re.subn(r'<link rel="stylesheet" href="([^"]+)">', inline_css, html)
assert n == 1, "css"

a, b = html.index("<!--GAME-->"), html.index("<!--/GAME-->")
game = html[a:b]
parts = []
for src in re.findall(r'<script src="([^"]+)"></script>', game):
    p = os.path.normpath(os.path.join(HERE, src))
    if not os.path.exists(p):
        print("없음:", src, "(빼고 묶는다)")
        continue
    code = read(p).replace("</script", "<\\/script")
    parts.append("<script>/* %s */\n%s\n</script>" % (os.path.basename(src), code))
html = html[:a] + "\n".join(parts) + "\n" + html[b + len("<!--/GAME-->"):]
html = html.replace("<title>깃들 데모</title>", "<title>깃들 데모</title>\n<!-- demo/build.py 가 만든 파일이다. 고칠 때는 demo/ 의 파일을 고치고 다시 묶는다. -->")
write(OUT, html)
print("만든 파일:", OUT, "(%.1f MB)" % (os.path.getsize(OUT) / 1e6))
