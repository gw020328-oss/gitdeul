#!/bin/bash
# ESA WorldCover 10m 2021 v200: 한국을 덮는 여섯 조각. 공개 저장소, 계정 불필요.
cd "$1" || exit 1
for t in N33E123 N33E126 N33E129 N36E123 N36E126 N36E129; do
  f="ESA_WorldCover_10m_2021_v200_${t}_Map.tif"
  curl -sS -f -o "$f" "https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/$f" && ls -la "$f" | awk '{print $5,$9}'
done
echo DONE
