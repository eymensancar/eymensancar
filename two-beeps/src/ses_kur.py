"""Anlatıcı kaydından bir bölümün ses izini ve zaman çizelgesini kurar.
Kullanım: python3 src/ses_kur.py --part N        (N = 1..10; birden çok: --part 2,3,4 ya da --part all)
          seçenekler: --soru yok (bitiş sorusu kartını kapat), --kuru (ses yazma, yalnız rapor + timeline)
Girdi: assets/voice/ham.wav (bütün dizi, tek kayıt), assets/voice/kelimeler.json (ASR kelime zamanları),
       src/partN.kurgu.json (cümleler: text, nefes, mark; notlar.isaretAni, notlar.bitis, notlar.sureHesabi),
       docs/YAYIN.md ("Bölüm bölüm" tablosu: bitiş sorusu ve sonraki bölümün "Previously" satırı).
Çıktı: out/partN-voice.wav, src/partN.timeline.json.
Bölümün kayıttaki yeri: bütün bölümlerin metni kayıttaki kelimelerle bir kez hizalanır (Needleman–Wunsch,
bulanık kelime eşleşmesi: ASR "aunt"/"Ant", "daphne"/"Defne" gibi hataları tolere eder). Cümle sınırı, iki
cümlenin eşleşen kelimeleri arasındaki en uzun sessizlikten kesilir. Altyazı metni her zaman kurgu json'undan.
Kayıt cümle aralarındaki sessizliklerden kesilir; her cümleden sonra en az BASE + nefes kadar boşluk bırakılır."""
import argparse, difflib, json, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(f'{ROOT}/assets/voice/kelimeler.json'))
LEAD = 0.35          # ilk kelimeden önce
BASE = 0.28          # her cümle arasında en az
PAD = 0.07           # kesimde kelimenin önü/arkası
BEEP_AFTER = 0.95    # son cümle sonu -> bitişteki tek bip
CARD_AFTER = 1.6     # son cümle sonu -> bitiş kartı (tek bip varsa)
CARD_NOBEEP = 0.4    # tek bip yoksa
SORU_CARD = 4.7      # soru kartı ekranda (YAYIN.md); en az 4,5
PARTS = 10
norm = lambda s: re.sub(r"[^a-z0-9']", '', s.lower().replace('’', "'"))


def kurgu(n):
    return json.load(open(f'{ROOT}/src/part{n}.kurgu.json'))


# ------------------------------------------------------------------ hizalama
_sim = {}
def sim(a, b):
    if a == b: return 1.0
    k = (a, b)
    if k not in _sim: _sim[k] = difflib.SequenceMatcher(None, a, b).ratio()
    return _sim[k]


def hizala(script, asr):
    """script, asr: normalize kelime listeleri. Dönüş: her script kelimesi için asr indeksi (eşleşme ya da yer değiştirme) ya da None."""
    n, m = len(script), len(asr)
    G = -1.0
    def sc(a, b):
        s = sim(a, b)
        return 2.0 if s == 1 else (1.0 if s >= 0.67 else -1.0)
    # bant: iki dizi aynı sırada; kayma en çok BAND kelime
    BAND = max(60, abs(n - m) + 40)
    NEG = -1e9
    H = [[NEG] * (m + 1) for _ in range(n + 1)]
    B = [[0] * (m + 1) for _ in range(n + 1)]
    H[0][0] = 0
    for j in range(1, min(m, BAND) + 1): H[0][j] = j * G; B[0][j] = 2
    for i in range(1, n + 1):
        c = i * m / n
        j0, j1 = max(0, int(c - BAND)), min(m, int(c + BAND))
        Hi, Hp, Bi, a = H[i], H[i - 1], B[i], script[i - 1]
        if j0 == 0: Hi[0] = i * G; Bi[0] = 1
        for j in range(max(1, j0), j1 + 1):
            d = Hp[j - 1] + sc(a, asr[j - 1]); u = Hp[j] + G; l = Hi[j - 1] + G
            if d >= u and d >= l: Hi[j] = d; Bi[j] = 0
            elif u >= l: Hi[j] = u; Bi[j] = 1
            else: Hi[j] = l; Bi[j] = 2
    i, j, res = n, m, [None] * n
    while i > 0 or j > 0:
        b = B[i][j] if i > 0 and j > 0 else (1 if j == 0 else 2)
        if b == 0: res[i - 1] = j - 1; i -= 1; j -= 1
        elif b == 1: i -= 1
        else: j -= 1
    return res


def bolumleri_bul():
    """Bütün bölümlerin cümlelerini kayıttaki kelime aralıklarına (src) yerleştirir. Dönüş: {n: [cümle dict + src]}"""
    sents = []                                      # (n, k, dict)
    for n in range(1, PARTS + 1):
        if os.path.exists(f'{ROOT}/src/part{n}.kurgu.json'):
            for k, s in enumerate(kurgu(n)['sentences']): sents.append((n, k, s))
    toks, own = [], []
    for si, (_, _, s) in enumerate(sents):
        for w in s['text'].split(): toks.append(norm(w)); own.append(si)
    asr = [norm(w[2]) for w in W]
    al = hizala(toks, asr)
    first, last, hit = [None] * len(sents), [None] * len(sents), [0] * len(sents)
    for ti, ai in enumerate(al):
        si = own[ti]
        if ai is None: continue
        if first[si] is None or ai < first[si]: first[si] = ai
        if last[si] is None or ai > last[si]: last[si] = ai
        if sim(toks[ti], asr[ai]) >= 0.67: hit[si] += 1
    # eşleşmesi olmayan cümle: komşulardan
    for si in range(len(sents)):
        if first[si] is None:
            raise SystemExit(f'cümle kayıtta bulunamadı: P{sents[si][0]} #{sents[si][1] + 1} {sents[si][2]["text"]!r}')
    # cümle sınırı: k'nın son eşleşen kelimesi ile k+1'in ilk eşleşen kelimesi arasındaki en uzun boşluk
    start, end = [0] * len(sents), [0] * len(sents)
    start[0] = first[0]
    for si in range(len(sents) - 1):
        a, b = last[si], max(first[si + 1], last[si] + 1)
        cut, best = a, -1
        for x in range(a, b):
            g = W[x + 1][0] - W[x][1]
            if g > best: best, cut = g, x
        end[si] = cut; start[si + 1] = cut + 1
    end[-1] = len(W) - 1 if last[-1] >= len(W) - 3 else last[-1]
    out = {}
    for si, (n, k, s) in enumerate(sents):
        d = dict(s); d['src'] = W[start[si]:end[si] + 1]; d['_hit'] = hit[si]
        out.setdefault(n, []).append(d)
    return out


# ------------------------------------------------------------------ YAYIN.md
def yayin():
    """docs/YAYIN.md 'Bölüm bölüm' tablosu -> {n: {durum, a, b, prev, tur}} + özel satırlar."""
    p = f'{ROOT}/docs/YAYIN.md'
    if not os.path.exists(p): return {}, {}
    txt = open(p, encoding='utf-8').read()
    rows = {}
    for ln in txt.splitlines():
        m = re.match(r'^\|\s*(\d+)\s*\|(.*)\|\s*$', ln)
        if not m: continue
        cols = [c.strip() for c in m.group(2).split('|')]
        if len(cols) < 4: continue
        tur = 'secim'
        if re.search(r'\*\s*Tahmin', cols[0], re.I): tur = 'tahmin'
        if re.search(r'\*\s*A[çc][ıi]k', cols[0], re.I): tur = 'acik'
        bt = lambda c: (re.findall(r'`([^`]*)`', c) or [None])[0]
        a, b = bt(cols[1]), bt(cols[2])
        rows[int(m.group(1))] = dict(tur=tur, durum=bt(cols[0]), a=a, b=b, prev=bt(cols[3]))
    ozel = {}
    for m in re.finditer(r'^- \*\*(\d+):\*\*(.*)$', txt, re.M):
        n, body = int(m.group(1)), m.group(2)
        s = re.search(r'Satır:\s*`([^`]*)`', body)
        if s: ozel.setdefault(n, {})['satir'] = s.group(1)
        c = re.search(r'Çip yerine\s*`([^`]*)`\s*ve\s*`([^`]*)`', body)
        if c: ozel.setdefault(n, {}).update(cip=[c.group(1), c.group(2)])
    return rows, ozel


def soru_kur(n, K, rows, ozel):
    if 'soru' in K: return K['soru']              # kurgu json'unda elle (null = kapalı)
    r = rows.get(n)
    if not r or not r.get('durum'): return None
    nx = K.get('next')
    s = dict(tur=r['tur'], durum=r['durum'], a=r['a'], b=r['b'],
             baslik={'secim': 'WHAT WOULD YOU DO?', 'tahmin': 'YOUR GUESS?', 'acik': 'YOUR TURN'}[r['tur']],
             satir=(f'Comment A or B · Part {nx["part"]} shows what Ant did' if nx else 'Tell us in the comments'))
    o = ozel.get(n, {})
    if o.get('satir'): s['satir'] = o['satir']
    if o.get('cip'): s['cip'] = o['cip']; s['satir'] = None
    return s


# ------------------------------------------------------------------ bir bölüm
def kur(n, segs, rows, ozel, soru_acik=True, kuru=False):
    K = kurgu(n); notlar = K.get('notlar', {})
    # kelime sayısı denetimi
    nk = sum(len(s['text'].split()) for s in segs); na = sum(len(s['src']) for s in segs)
    print(f'\n=== Part {n} · {K["title"]}: metin {nk} kelime, kayıt {na} kelime ({na - nk:+d}); kayıt {segs[0]["src"][0][0]:.2f}–{segs[-1]["src"][-1][1]:.2f} sn')
    uyar = []
    t = LEAD; parts = []; out = []
    for k, s in enumerate(segs):
        a = max(0, s['src'][0][0] - PAD); b = s['src'][-1][1] + PAD
        if k + 1 < len(segs): b = min(b, segs[k + 1]['src'][0][0] - 0.02)
        if k: a = max(a, segs[k - 1]['src'][-1][1] + 0.02)
        elif s.get('_prevEnd') is not None: a = max(a, s['_prevEnd'] + 0.02)
        dur = b - a
        words = s['text'].split(); src = s['src']
        if len(words) == len(src): wt = [(w, t + x[0] - a, t + x[1] - a) for w, x in zip(words, src)]
        else:
            t0 = t + src[0][0] - a; t1 = t + src[-1][1] - a; L = sum(len(w) + 1 for w in words); c = 0; wt = []
            for w in words: wt.append((w, t0 + (t1 - t0) * c / L, t0 + (t1 - t0) * (c + len(w) + 1) / L)); c += len(w) + 1
        d = dict(i=k + 1, text=s['text'], t0=round(wt[0][1], 3), t1=round(wt[-1][2], 3), mark=s.get('mark'),
                 words=[dict(w=w, t0=round(x, 3), t1=round(y, 3)) for w, x, y in wt])
        for f in ('kim', 'alinti', 'karakterDisi'):
            if s.get(f) not in (None, False): d[f] = s[f]
        out.append(d)
        diff = len(src) - len(words); frac = s['_hit'] / len(words)
        bayrak = ''
        if abs(diff) >= 2 or frac < 0.6 or dur / max(1, len(words)) > 0.9 or dur / max(1, len(words)) < 0.12:
            bayrak = '  <-- KUŞKULU'; uyar.append(k + 1)
        print(f'{k + 1:2d} {dur:5.2f} sn  {len(words):2d}/{len(src):2d} kel  eşl {frac:4.0%}  {s["text"]}'
              + (f'   [kayıt: {" ".join(x[2] for x in src)}]' if diff or frac < 1 else '') + bayrak)
        parts.append((a, dur, t)); t += dur + (BASE + s.get('nefes', 0) if k + 1 < len(segs) else 0)
    # bitiş
    bitis = notlar.get('bitis', '') or ''
    tek_bip = bool(re.search(r'tek bip', bitis, re.I)) and not re.search(r'tek bip[^.]*yok', bitis, re.I)
    m = re.search(r'(\d+[,.]\d+)\s*bitiş', notlar.get('sureHesabi', '') or '')
    tail = float(m.group(1).replace(',', '.')) if m else 4.3
    voiceEnd = out[-1]['t1']
    soru = soru_kur(n, K, rows, ozel) if soru_acik else None
    endCard = round(voiceEnd + (CARD_AFTER if tek_bip else CARD_NOBEEP), 3)
    total = round(t + tail, 3)
    # soru kartı en az SORU_CARD sn; son bölümde (next yok) kurgu notlarındaki bitiş payı geçerli
    if soru and K.get('next'): total = round(max(total, endCard + SORU_CARD), 3)
    # işaretler
    spec = notlar.get('isaretAni', {})
    cues = {}
    for s in out:
        mk = s['mark']
        if not mk: continue
        if mk in cues: print(f'uyarı: "{mk}" işareti iki kez; ilki kullanıldı'); continue
        sp = str(spec.get(mk, 't0')); mm = re.match(r'\s*(t0|t1)\s*([+-]\s*\d+(?:[.,]\d+)?)?', sp)
        base = s['t1'] if mm and mm.group(1) == 't1' else s['t0']
        off = float(mm.group(2).replace(' ', '').replace(',', '.')) if mm and mm.group(2) else 0
        cues[mk] = round(base + off, 3); cues[mk + 'End'] = s['t1']
        if cues[mk] != s['t0']: cues[mk + 'Start'] = s['t0']
    cues['voiceEnd'] = voiceEnd
    if tek_bip: cues['endBeep'] = round(voiceEnd + BEEP_AFTER, 3)
    cues['endCard'] = endCard
    # pilotla aynı sıra: beep, fall, stamp önce
    prev = None
    if n > 1:
        r = rows.get(n - 1, {})
        prev = r.get('prev') or re.sub(r'^Previously:\s*', '', (notlar.get('oncekiBolumde') or {}).get('metin', '')) or None
    tl = dict(part=n, parts=PARTS, title=K['title'])
    if K.get('next'): tl['next'] = K['next']
    # tanıma aracı tek kelimelik bir cümleye sıfır süre verdiyse (ör. "Ant."), komşu boşluğun içinde makul bir süre aç: altyazı boş kalmasın
    for _i, _s in enumerate(out):
        if _s['t1'] - _s['t0'] < 0.2:
            _lo = out[_i - 1]['t1'] + 0.12 if _i else 0.0
            _hi = out[_i + 1]['t0'] - 0.12 if _i + 1 < len(out) else _s['t1'] + 0.6
            _a = max(_lo, min(_s['t0'], _hi - 0.6)); _b = min(_hi, max(_s['t1'], _a + 0.6))
            _s['t0'], _s['t1'] = round(_a, 3), round(_b, 3)
            _n = len(_s['words'])
            for _k, _w in enumerate(_s['words']): _w['t0'] = round(_a + (_b - _a) * _k / _n, 3); _w['t1'] = round(_a + (_b - _a) * (_k + 1) / _n, 3)
    tl.update(fps=30, w=1080, h=1920, duration=total, voice=f'out/part{n}-voice.wav', sentences=out, cues=cues)
    if prev: tl['prev'] = prev
    if soru: tl['soru'] = soru
    if not kuru:
        flt = ';'.join(f"[0:a]atrim={a:.3f}:{a + d:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={d - 0.03:.3f}:d=0.03,adelay={int(o * 1000)}:all=1[s{i}]" for i, (a, d, o) in enumerate(parts))
        flt += ';' + ''.join(f'[s{i}]' for i in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,apad=whole_dur={total},loudnorm=I=-15:TP=-1.5:LRA=7[o]"
        os.makedirs(f'{ROOT}/out', exist_ok=True)
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{ROOT}/assets/voice/ham.wav', '-filter_complex', flt, '-map', '[o]', '-ar', '48000', '-ac', '1', f'{ROOT}/out/part{n}-voice.wav'], check=True)
    json.dump(tl, open(f'{ROOT}/src/part{n}.timeline.json', 'w'), indent=1, ensure_ascii=False)
    print(f'süre {total} sn (ses sonu {voiceEnd}, kart {endCard}–{total} = {total - endCard:.2f} sn{", soru kartı" if soru else ""}{", tek bip" if tek_bip else ", bip yok"})'
          + ('' if 55 <= total <= 62 else '  <-- HEDEF DIŞI (55–62)'))
    if abs(na - nk) >= 3: print(f'UYARI: kayıt/metin kelime farkı {na - nk:+d}')
    if uyar: print('kuşkulu cümleler:', uyar)
    return dict(n=n, title=K['title'], total=total, voiceEnd=voiceEnd, card=round(total - endCard, 2), nk=nk, na=na, uyar=uyar, soru=bool(soru))


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--part', default='1', help='1..10, "2,3" ya da "all"')
    ap.add_argument('--soru', default='var', choices=['var', 'yok'])
    ap.add_argument('--kuru', action='store_true', help='ses dosyası yazma')
    a = ap.parse_args()
    ns = list(range(1, PARTS + 1)) if a.part == 'all' else [int(x) for x in a.part.split(',')]
    ns = [n for n in ns if os.path.exists(f'{ROOT}/src/part{n}.kurgu.json')]
    B = bolumleri_bul(); rows, ozel = yayin()
    for n in range(2, PARTS + 1):            # bölümün ilk cümlesi önceki bölümün sesine taşmasın
        if n in B and n - 1 in B: B[n][0]['_prevEnd'] = B[n - 1][-1]['src'][-1][1]
    R = [kur(n, B[n], rows, ozel, a.soru == 'var', a.kuru) for n in ns]
    if len(R) > 1:
        print('\nBölüm | süre | ses sonu | kart | kelime metin/kayıt | soru | kuşkulu')
        for r in R: print(f"{r['n']:5d} | {r['total']:5.1f} | {r['voiceEnd']:6.2f} | {r['card']:4.1f} | {r['nk']}/{r['na']} | {'var' if r['soru'] else '-'} | {r['uyar'] or '-'}")
