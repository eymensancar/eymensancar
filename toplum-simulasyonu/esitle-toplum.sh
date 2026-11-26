#!/bin/bash
# NPC yapay zekâsını (ana-menu) amcanın deposundaki ayrı klasöre (yapay-zeka/) kopyalar.
# Saklı test setleri GİTMEZ: yalnız bu depoda kalır (diğer Claude görüp ezberlemesin diye).
# Kullanım: bash toplum-simulasyonu/esitle-toplum.sh [/home/user/toplumsimulasyonu]
set -e
BURA="$(cd "$(dirname "$0")" && pwd)"
HEDEF="${1:-/home/user/toplumsimulasyonu}/yapay-zeka"
python3 - "$BURA/ana-menu" "$HEDEF" "$BURA/README-AMCA.md" <<'PY'
import os, sys, shutil, fnmatch
kaynak, hedef, oku = sys.argv[1:4]
DISLA = ['*-sakli.json', 'tools/korpus2/*', 'tools/korpus/tekil.json', 'tools/korpus/diyalog.json', '*/node_modules/*', '*.DS_Store']
dis = lambda r: any(fnmatch.fnmatch(r, d) for d in DISLA)
if os.path.isdir(hedef): shutil.rmtree(hedef)
for kok, _, dosyalar in os.walk(kaynak):
    for f in dosyalar:
        tam = os.path.join(kok, f); r = os.path.relpath(tam, kaynak)
        if dis(r): continue
        h = os.path.join(hedef, r); os.makedirs(os.path.dirname(h), exist_ok=True); shutil.copy2(tam, h)
shutil.copy2(oku, os.path.join(hedef, 'README.md'))
PY
echo "kopyalandi: $HEDEF ($(du -sh "$HEDEF" | cut -f1)); sakli dosya: $(find "$HEDEF" -name '*sakli*' | wc -l)"
