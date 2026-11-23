#!/bin/bash
# Copernicus DEM GLO-30: 한국을 덮는 조각 (북위 33~38, 동경 124~131). 공개 저장소, 계정 불필요.
cd "$1" || exit 1
for la in 33 34 35 36 37 38; do for lo in 124 125 126 127 128 129 130 131; do
  t="Copernicus_DSM_COG_10_N${la}_00_E${lo}_00_DEM"
  curl -sS -f -o "$t.tif" "https://copernicus-dem-30m.s3.amazonaws.com/$t/$t.tif" 2>/dev/null && ls -la "$t.tif" | awk '{print $5,$9}' || rm -f "$t.tif"
done; done
echo DONE
