#!/bin/bash
# 팜맵 공간정보 2025년판의 나머지 시도. 경기도(15104483)는 따로 받았다.
# 쓰는 법: pull_farmmap_rest.sh <받을 폴더>
out="$1"
here="$(cd "$(dirname "$0")" && pwd)"
while read id name; do
  u=$(curl -sS "https://www.data.go.kr/data/$id/fileData.do" | grep -o "fn_fileDataDown('[0-9]*', 'uddi:[0-9a-f_-]*'" | head -1 | grep -o 'uddi:[0-9a-f_-]*')
  if [ -z "$u" ]; then echo "$id $name NO-UDDI"; continue; fi
  python3 "$here/pull_datagokr.py" "$id" "$u" "$out/farmmap_${name}_20251231" 2>&1 | tail -1 | sed 's/.*farmmap_/farmmap_/'
done <<'LIST'
15104481 metro
15104490 gangwon
15104484 chungbuk
15104485 chungnam
15104486 jeonbuk
15104487 jeonnam
15104488 gyeongbuk
15104489 gyeongnam
15104491 jeju
LIST
echo DONE
