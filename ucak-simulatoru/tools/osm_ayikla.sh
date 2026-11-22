#!/usr/bin/env bash
# Türkiye OSM özütünden (openstreetmap.fr) gereken katmanları çıkarır. osmium-tool gerekir. Çıktı: tools/raw/osm/
set -e; cd "$(dirname "$0")/raw/osm"
[ -s turkey.osm.pbf ] || curl -o turkey.osm.pbf https://download.openstreetmap.fr/extracts/europe/turkey-latest.osm.pbf
P=turkey.osm.pbf
osmium tags-filter $P w/building r/building -o bina.pbf --overwrite
osmium tags-filter $P w/aeroway=runway,taxiway,apron w/aerodrome nwr/aeroway=aerodrome -o aero.pbf --overwrite
osmium tags-filter $P w/natural=coastline -o kiyi.pbf --overwrite
osmium tags-filter $P nwr/landuse=forest,farmland,residential,industrial,commercial,retail,meadow,orchard,vineyard,grass,farmyard,quarry,reservoir,basin,cemetery,allotments,plant_nursery,greenhouse_horticulture,military,construction,brownfield,railway nwr/natural=wood,scrub,water,wetland,bare_rock,sand,beach,glacier,grassland,heath,scree nwr/leisure=park,golf_course,nature_reserve nwr/waterway=riverbank -o ortu.pbf --overwrite
osmium tags-filter $P w/waterway=river -o nehir.pbf --overwrite
osmium tags-filter $P w/highway=motorway,trunk,primary,secondary,tertiary,motorway_link,trunk_link -o yol.pbf --overwrite
osmium export kiyi.pbf -f geojsonseq -o kiyi.geojsonseq --overwrite --geometry-types=linestring
osmium export aero.pbf -f geojsonseq -o aero.geojsonseq --overwrite
osmium export nehir.pbf -f geojsonseq -o nehir.geojsonseq --overwrite --geometry-types=linestring
osmium export ortu.pbf -f geojsonseq -o ortu.geojsonseq --overwrite --geometry-types=polygon
echo BITTI
