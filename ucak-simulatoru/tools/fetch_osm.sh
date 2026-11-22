#!/usr/bin/env bash
# OpenStreetMap verisini Overpass API'den indirir (ODbL, (c) OpenStreetMap contributors).
# Cikti: tools/raw/*.json (depoya girmez). Sonra: python3 tools/build_data.py
set -u
cd "$(dirname "$0")"
mkdir -p raw
EP="${OVERPASS:-https://maps.mail.ru/osm/tools/overpass/api/interpreter}"
S=40.955; N=41.215; W=28.80; E=29.14
q() { # ad sorgu
  local f="raw/$1.json"
  [ -s "$f" ] && grep -q '"elements"' "$f" && ! grep -q '"remark"' "$f" && { echo "var: $f"; return; }
  for t in 1 2 3; do
    curl -s -m 400 --data-urlencode "data=$2" "$EP" -o "$f"
    if grep -q '"elements"' "$f" && ! grep -q 'runtime error' "$f"; then echo "tamam: $f $(wc -c <"$f")"; return; fi
    echo "tekrar: $f"; sleep 10
  done
}
BB="($S,$W,$N,$E)"
q coast "[out:json][timeout:300];way[natural=coastline](40.90,28.70,41.27,29.25);out geom;"
q water "[out:json][timeout:300];(way[natural=water]$BB;relation[natural=water]$BB;way[waterway=riverbank]$BB;);out geom;"
q green "[out:json][timeout:300];(way[leisure~'^(park|garden|golf_course|pitch)$']$BB;way[landuse~'^(forest|grass|meadow|cemetery|recreation_ground|farmland|orchard)$']$BB;way[natural~'^(wood|scrub|grassland|heath)$']$BB;relation[landuse=forest]$BB;relation[natural=wood]$BB;relation[leisure=park]$BB;);out geom;"
q roads "[out:json][timeout:300];way[highway~'^(motorway|trunk|primary|secondary|tertiary|motorway_link|trunk_link)$']$BB;out geom;"
q aero "[out:json][timeout:300];(way[aeroway~'^(runway|taxiway|apron)$']$BB;);out geom;"
q bridges "[out:json][timeout:300];(way[man_made=bridge]$BB;way[bridge=yes][highway~'^(motorway|trunk|primary|secondary)$']$BB;);out geom;"
q rail "[out:json][timeout:300];way[railway~'^(rail|light_rail|subway)$'][tunnel!=yes]$BB;out geom;"
# binalar parca parca; sunucu zaman asimina ugrayan yogun parcalar dorde bolunur
for la in $(seq 0 5); do for lo in $(seq 0 6); do
  s=$(python3 -c "print(round($S+$la*0.045,3))"); n=$(python3 -c "print(round(min($N,$S+($la+1)*0.045),3))")
  w=$(python3 -c "print(round($W+$lo*0.05,3))"); e=$(python3 -c "print(round(min($E,$W+($lo+1)*0.05),3))")
  quad=0; ls raw/b_${la}_${lo}_*.json >/dev/null 2>&1 && quad=1
  [ $quad = 0 ] && q "b_${la}_${lo}" "[out:json][timeout:300];way[building]($s,$w,$n,$e);out geom qt;"
  if [ $quad = 1 ] || ! python3 -c "import json;json.load(open('raw/b_${la}_${lo}.json'))" 2>/dev/null; then
    rm -f "raw/b_${la}_${lo}.json"
    ms=$(python3 -c "print(round(($s+$n)/2,4))"); mw=$(python3 -c "print(round(($w+$e)/2,4))")
    q "b_${la}_${lo}_a" "[out:json][timeout:300];way[building]($s,$w,$ms,$mw);out geom qt;"
    q "b_${la}_${lo}_b" "[out:json][timeout:300];way[building]($s,$mw,$ms,$e);out geom qt;"
    q "b_${la}_${lo}_c" "[out:json][timeout:300];way[building]($ms,$w,$n,$mw);out geom qt;"
    q "b_${la}_${lo}_d" "[out:json][timeout:300];way[building]($ms,$mw,$n,$e);out geom qt;"
  fi
done; done
