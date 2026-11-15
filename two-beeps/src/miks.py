#!/usr/bin/env python3
"""Two Beeps: bir bölümün tam ses miksi (+ isteğe bağlı son video).

Kullanım:
  python3 src/miks.py                  # Part 1: out/part1-miks.wav + ölçüm raporu + out/miks-*.png
  python3 src/miks.py --mux            # ayrıca out/part1-video.mp4 varsa out/part1.mp4
  python3 src/miks.py --bolum 2        # src/part2.timeline.json + src/part2.cues.json
  python3 src/miks.py --cues baska.json --anim anlar.json --olcme

Bölüme özgü her şey cue dosyasında (biçim: dosyanın "_belge" alanı ve docs/MIKS.md).
Animatör anları (TB.cuesA / TB.cuesB) src/shots/*.js içinden node ile kendiliğinden okunur;
cue satırındaki ["A.kol", "s16.t1-0.39"] gibi listelerde önce animatör anı, yoksa tahmin kullanılır.

Akış: kaynaklar ffmpeg ile 48 kHz float okunur -> katlara (muzik, ortam, efekt, bip) yerleşir ->
cümle zamanlarından hesaplanan kısma zarfı (sidechain yerine, öngörülebilir) + cue'daki kısma pencereleri ->
40 Hz alçak kesim (arka plan) -> toplam -> -14 LUFS'e kazanç (ffmpeg ebur128 ile ölçülür) ->
4x aşırı örneklemeli tepe sınırlayıcı (gerçek tepe <= -1 dBTP) -> 24 bit WAV -> ölçüm."""
import argparse, json, math, os, re, subprocess, sys, tempfile, types
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SR = 48000
KATLAR = ('muzik', 'ortam', 'efekt', 'darbe', 'bip')
ARKA = ('muzik', 'ortam', 'efekt', 'darbe')


def db2a(d):
    return 10.0 ** (np.asarray(d, dtype=np.float64) / 20.0)


def a2db(a):
    return 20.0 * np.log10(np.maximum(a, 1e-12))


def rms_db(x):
    return float(a2db(np.sqrt(np.mean(np.square(x)))) if x.size else -240.0)


# ------------------------------------------------------------------ dosya okuma/yazma
_cache = {}


def oku(yol):
    """ffmpeg ile 48 kHz float32 okur; (örnek, kanal) dizisi döner (1 ya da 2 kanal)."""
    if yol in _cache:
        return _cache[yol]
    ch = int(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=channels',
                             '-of', 'csv=p=0', yol], capture_output=True, text=True, check=True).stdout.strip())
    ch = min(ch, 2)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', yol, '-f', 'f32le', '-ac', str(ch), '-ar', str(SR), '-'],
                         capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32).astype(np.float64).reshape(-1, ch)
    _cache[yol] = x
    return x


def yaz_wav(yol, x):
    """Stereo 24 bit PCM."""
    import wave
    x = np.clip(x, -1.0, 1.0 - 2 ** -23)
    q = np.round(x * 2 ** 23).astype(np.int32).reshape(-1)
    b = np.empty((q.size, 3), np.uint8)
    b[:, 0] = q & 0xFF
    b[:, 1] = (q >> 8) & 0xFF
    b[:, 2] = (q >> 16) & 0xFF
    with wave.open(yol, 'wb') as w:
        w.setnchannels(x.shape[1]); w.setsampwidth(3); w.setframerate(SR); w.writeframes(b.tobytes())


def ebur128(yol):
    """ffmpeg ebur128: bütünleşik LUFS, LRA, gerçek tepe (dBTP)."""
    r = subprocess.run(['ffmpeg', '-nostats', '-hide_banner', '-i', yol, '-af', 'ebur128=peak=true:framelog=quiet',
                       '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = r[r.rfind('Summary:'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+|-inf)', s).group(1).replace('-inf', '-240'))
    return dict(I=g('I'), LRA=g('LRA'), TP=g('Peak'))


# ------------------------------------------------------------------ süzgeçler (scipy yok: FFT ile)
def hp_fft(x, fc, n=2):
    """Butterworth büyüklük eğrili alçak kesim (faz yok), bütün sinyal üzerinde."""
    if fc <= 0:
        return x
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    h = 1.0 / np.sqrt(1.0 + (fc / np.maximum(f, 1e-6)) ** (2 * n))
    return np.fft.irfft(X * h[:, None], n=x.shape[0], axis=0)


def sentez(ad):
    """Asset'te karşılığı olmayan küçük sesler (yönetmene: sfx_uret.py'ye taşınabilir)."""
    if ad == '@tink':   # ince kalem/mürekkep 'tink'i: halat_gerilme'deki tel tink'iyle aynı kısmiler
        t = np.arange(int(0.6 * SR)) / SR
        y = sum(a * np.sin(2 * np.pi * f * t) * np.exp(-t / d) for f, d, a in
                [(3120, 0.30, 1.0), (4870, 0.16, 0.4), (7010, 0.08, 0.2)])
        y *= 1 - np.exp(-t / 0.002)
        y *= db2a(-14) / np.max(np.abs(y))       # tepe -14 dBFS (kazanç satırdan)
        return y[:, None]
    raise SystemExit(f'bilinmeyen sentez: {ad}')


# ------------------------------------------------------------------ zaman ifadeleri
class Zaman:
    def __init__(self, tl, anim):
        ns = {k: float(v) for k, v in tl['cues'].items()}
        for s in tl['sentences']:
            ns[f"s{s['i']}"] = types.SimpleNamespace(t0=float(s['t0']), t1=float(s['t1']))
        ns['dur'] = float(tl['duration'])
        for k in ('A', 'B'):
            ns[k] = types.SimpleNamespace(**{re.sub(r'\W', '_', a): float(b) for a, b in anim.get(k, {}).items()})
        self.ns = ns

    def __call__(self, e):
        if e is None:
            return None
        if isinstance(e, (int, float)):
            return float(e)
        if isinstance(e, list):
            hata = None
            for x in e:
                try:
                    return self(x)
                except (NameError, AttributeError) as h:
                    hata = h
            raise SystemExit(f'zaman çözülemedi: {e} ({hata})')
        return float(eval(e, {'__builtins__': {}}, self.ns))


def anim_oku(tl_yol, yol=None):
    """Animatör anları: --anim JSON ({"A":{..},"B":{..}}) ya da src/shots/*.js içindeki TB.cuesA/TB.cuesB."""
    if yol:
        return json.load(open(yol))
    shots = sorted(os.path.join(ROOT, 'src', 'shots', f) for f in os.listdir(os.path.join(ROOT, 'src', 'shots'))
                   if f.endswith('.js')) if os.path.isdir(os.path.join(ROOT, 'src', 'shots')) else []
    if not shots:
        return {}
    js = r"""
const fs=require('fs'),vm=require('vm');const [tlp,...files]=process.argv.slice(1);
const id=u=>u, TB={shots:[],overlays:[],imgs:{},tl:JSON.parse(fs.readFileSync(tlp,'utf8')),shot(){},overlay(){},
 img(){return {}},pic(){return {}},clamp:(x,a,b)=>Math.max(a==null?0:a,Math.min(b==null?1:b,x)),lerp:(a,b,u)=>a+(b-a)*u,
 seg(t,a,b){return TB.clamp((t-a)/(b-a))},rand:()=>.5,ease:new Proxy({},{get:()=>id}),sentence:i=>TB.tl.sentences[i-1]};
const c={TB,console:{log(){},warn(){},error(){}},Math,JSON,Object,Array,Number,String,Image:function(){},
 document:{getElementById:()=>null,createElement:()=>({getContext:()=>null})}};c.window=c;c.self=c;c.globalThis=c;
vm.createContext(c);for(const f of files){try{vm.runInContext(fs.readFileSync(f,'utf8'),c,{filename:f,timeout:2000})}catch(e){}}
const g=o=>{if(typeof o==='function'){try{o=o(TB.tl)}catch(e){o={}}};const r={};
 for(const [k,v] of Object.entries(o||{}))if(typeof v==='number'&&isFinite(v))r[k]=v;return r};
process.stdout.write(JSON.stringify({A:g(TB.cuesA),B:g(TB.cuesB)}));"""
    try:
        on = [f'{ROOT}/src/cizim.js'] if os.path.exists(f'{ROOT}/src/cizim.js') else []   # sahneler window.Cizim ister
        r = subprocess.run(['node', '-e', js, tl_yol, *on, *shots], capture_output=True, text=True, timeout=30)
        return json.loads(r.stdout or '{}')
    except Exception as e:  # node yoksa tahminler kullanılır
        print('uyarı: animatör anları okunamadı:', e)
        return {}


# ------------------------------------------------------------------ yerleştirme
def satir_sesi(r, Z, dur):
    """Bir cue satırını (stereo dizi, başlangıç örneği) olarak hazırlar."""
    d = r['dosya']
    x = sentez(d) if d.startswith('@') else oku(os.path.join(ROOT, 'assets', d))
    t = Z(r['t'])
    ss = float(r.get('ss', 0))
    if 'son' in r:
        L = Z(r['son']) - t
    elif 'sure' in r:
        L = float(r['sure'])
    else:
        L = x.shape[0] / SR - ss
    L = min(L, dur - t)
    i0 = int(round(ss * SR))
    n = int(round(L * SR))
    if n <= 0:
        return None, 0
    if r.get('dongu'):
        reps = int(math.ceil(n / x.shape[0])) + 1
        y = np.concatenate([x[i0:]] + [x] * reps, axis=0)[:n]  # döngü dosyaları dikişsiz üretildi
    else:
        y = x[i0:i0 + n]
    y = y.copy()
    # solmalar (en az 3 ms tık önleme; döngülerde 50 ms)
    m = y.shape[0]
    fi = max(float(r.get('fadein', 0.05 if r.get('dongu') else 0.003)), 0.003)
    fo = max(float(r.get('fadeout', 0.05 if r.get('dongu') else 0.003)), 0.003)
    k = min(m, int(fi * SR)); y[:k] *= np.sin(0.5 * np.pi * np.arange(k) / k)[:, None] ** 2
    k = min(m, int(fo * SR)); y[m - k:] *= np.cos(0.5 * np.pi * np.arange(k) / k)[:, None] ** 2
    y *= db2a(r.get('db', 0))
    # panorama (sabit güç, ortada iki kanal 1.0: anlatıcıyla aynı ölçek)
    p = float(r.get('pan', 0))
    th = (p + 1) * np.pi / 4
    gl, gr = np.cos(th) * np.sqrt(2), np.sin(th) * np.sqrt(2)
    if y.shape[1] == 1:
        y = np.hstack([y * gl, y * gr])
    elif p:
        y = y * np.array([min(1, gl), min(1, gr)])
    return y, int(round(t * SR))


def yerlestir(bus, y, i):
    a, b = max(i, 0), min(i + y.shape[0], bus.shape[0])
    if b > a:
        bus[a:b] += y[a - i:b - i]


def zarf(N, tl, cue, Z):
    """Kat başına kazanç zarfı (lineer): konuşma kısması + kısma pencereleri. 1 kHz denetim hızında hesaplanır."""
    k = cue.get('konusma_kisma', {})
    atak, bir = float(k.get('atak', 0.08)), float(k.get('birakma', 0.4))
    tc = np.arange(0, N / SR + 0.002, 0.001)
    konus = np.zeros_like(tc)
    for s in tl['sentences']:
        t0, t1 = float(s['t0']), float(s['t1'])
        tr = np.interp(tc, [t0 - atak, t0, t1, t1 + bir], [0, 1, 1, 0], left=0, right=0)
        konus = np.maximum(konus, tr)
    out = {}
    for kat in KATLAR:
        ddb = konus * float(k.get('db', {}).get(kat, 0))
        pen = np.zeros_like(tc)
        for w in cue.get('kisma', []):
            if kat not in w['katlar']:
                continue
            a, b, s = Z(w['t0']), Z(w['t1']), float(w.get('solma', 0.05))
            tr = np.interp(tc, [a - s, a, b, b + s], [0, 1, 1, 0], left=0, right=0)
            pen = np.minimum(pen, tr * float(w['db']))
        g = db2a(ddb + pen)
        out[kat] = np.interp(np.arange(N) / SR, tc, g)
    return out, np.interp(np.arange(N) / SR, tc, konus)


def koruma(voice, bg, k, tl):
    """Anlatıcı koruyucu: anlatıcı sesliyken arka plan kısa dönemde anlatıcının en az `fark` dB altında kalır.
    Anlatıcı seviyesi 50 ms RMS, ±`tut` sn en yüksek tutulur (kelime aralarında da korur). En çok `en_cok` dB kısar;
    atak 20 ms, bırakma 300 ms. Planlı kısmanın üstüne yalnız taşan anlarda (geçici efekt) çalışır."""
    fark, en_cok, tut = float(k.get('fark', 14)), float(k.get('en_cok', -12)), float(k.get('tut', 0.12))
    hop = int(0.01 * SR); nb = voice.shape[0] // hop
    e = lambda x: a2db(np.sqrt(np.convolve(np.square(x[:nb * hop].mean(1)).reshape(nb, hop).mean(1), np.ones(5) / 5, 'same')))
    ve, be = e(voice), e(bg)
    h = int(tut / 0.01)
    vh = np.max(np.stack([np.roll(ve, i) for i in range(-h, h + 1)]), 0)
    tc = (np.arange(nb) + 0.5) * 0.01
    icinde = np.zeros(nb, bool)                  # yalnız cümle içinde (boşluktaki darbelere dokunmaz)
    for s in tl['sentences']:
        icinde |= (tc >= float(s['t0']) - 0.05) & (tc <= float(s['t1']) + 0.05)
    hedef = np.minimum(vh, ve + float(k.get('kelime_arasi', 8)))  # kelime arasında tutma en çok 8 dB
    need = np.where(icinde & (vh > -35), np.clip(hedef - fark - be, en_cok, 0), 0.0)
    g = need.copy()
    for i in range(len(g) - 2, -1, -1):          # 20 ms atak (ileri bakış)
        g[i] = min(g[i], g[i + 1] + 3.0)
    for i in range(1, len(g)):                   # 300 ms bırakma
        g[i] = min(g[i], g[i - 1] + 0.4)
    return db2a(np.interp(np.arange(voice.shape[0]), (np.arange(nb) + 0.5) * hop, g))


# ------------------------------------------------------------------ master
def gercek_tepe_blok(x, blok=48):
    """4x aşırı örneklemeli tepe, blok (1 ms) başına (doğrusal). Bellek için kanal kanal FFT."""
    N = x.shape[0]
    pk = np.zeros(N)
    for c in range(x.shape[1]):
        X = np.fft.rfft(x[:, c])
        up = np.fft.irfft(X, n=4 * N) * 4
        pk = np.maximum(pk, np.abs(up).reshape(N, 4).max(1))
        pk = np.maximum(pk, np.abs(x[:, c]))
    nb = int(math.ceil(N / blok))
    pk = np.pad(pk, (0, nb * blok - N))
    return pk.reshape(nb, blok).max(1)


def sinirla(x, esik_db, blok=48, atak_db=1.2, birak_db=0.04):
    """İleri bakışlı tepe sınırlayıcı: blok başına gereken kısma, geriye doğru rampa (atak), ileri bırakma."""
    pk = gercek_tepe_blok(x, blok)
    need = np.minimum(0.0, esik_db - a2db(pk))
    g = need.copy()
    for i in range(len(g) - 2, -1, -1):           # atak: tepeden önce iner (ileri bakış)
        g[i] = min(g[i], g[i + 1] + atak_db)
    for i in range(1, len(g)):                    # bırakma: yavaş döner
        g[i] = min(g[i], g[i - 1] + birak_db)
    tb = (np.arange(len(g)) + 0.5) * blok
    gs = db2a(np.interp(np.arange(x.shape[0]), tb, g))
    return x * gs[:, None], gs, float(g.min())


# ------------------------------------------------------------------ ana
def main():
    ap = argparse.ArgumentParser(description='Two Beeps bölüm miksi')
    ap.add_argument('--bolum', type=int, default=1)
    ap.add_argument('--tl', help='zaman çizelgesi (varsayılan src/partN.timeline.json)')
    ap.add_argument('--cues', help='cue listesi (varsayılan src/partN.cues.json)')
    ap.add_argument('--anim', help='animatör anları JSON {"A":{...},"B":{...}} (verilmezse src/shots/*.js okunur)')
    ap.add_argument('--out', help='çıkış WAV (varsayılan out/partN-miks.wav)')
    ap.add_argument('--mux', action='store_true', help='out/partN-video.mp4 varsa sesle birleştir -> out/partN.mp4')
    ap.add_argument('--video', help='görüntü dosyası (varsayılan out/partN-video.mp4)')
    ap.add_argument('--olcme', action='store_true', help='ölçüm raporu ve PNG üretme')
    a = ap.parse_args()
    n = a.bolum
    tl_yol = a.tl or f'{ROOT}/src/part{n}.timeline.json'
    cue_yol = a.cues or f'{ROOT}/src/part{n}.cues.json'
    out = a.out or f'{ROOT}/out/part{n}-miks.wav'
    tl = json.load(open(tl_yol))
    cue = json.load(open(cue_yol))
    anim = anim_oku(tl_yol, a.anim)
    if anim.get('A') or anim.get('B'):
        print('animatör anları:', anim)
    Z = Zaman(tl, anim)
    dur = float(tl['duration'])
    N = int(round(dur * SR))

    # anlatıcı
    an = cue.get('anlatici', {})
    vy = os.path.normpath(os.path.join(ROOT, 'assets', an.get('dosya', '../' + tl['voice'])))
    v = oku(vy).mean(1)[:N] * db2a(an.get('db', 0))
    voice = np.zeros((N, 2)); voice[:v.size] = v[:, None]

    # katlar
    bus = {k: np.zeros((N, 2)) for k in KATLAR}
    for r in cue['satirlar']:
        y, i = satir_sesi(r, Z, dur)
        if y is not None:
            yerlestir(bus[r.get('kat', 'efekt')], y, i)
    g, konus = zarf(N, tl, cue, Z)
    for k in KATLAR:
        bus[k] *= g[k][:, None]
        if k != 'bip':
            bus[k] = hp_fft(bus[k], 40)      # telefon: 40 Hz altı yalnız tepe payı yer
    kg = koruma(voice, sum(bus[k] for k in ARKA), cue.get('koruma', {}), tl)
    for k in ('muzik', 'ortam', 'efekt'):          # darbe katı korumasız: boşluğa yerleştirilir
        bus[k] *= kg[:, None]
    bg = sum(bus[k] for k in ARKA)
    mix = voice + bg + bus['bip']

    # seviye: -14 LUFS'e kazanç, sonra gerçek tepe sınırı (iki tur)
    hedef = cue.get('hedef', {})
    hI, hTP = float(hedef.get('lufs', -14)), float(hedef.get('tp', -1))
    kaz = 0.0
    esik = hTP - 0.5
    tmp = tempfile.mkdtemp()
    for tur in range(3):
        y = mix * db2a(kaz)
        y, gs, gmin = sinirla(y, esik)
        yaz_wav(f'{tmp}/m.wav', y)
        m = ebur128(f'{tmp}/m.wav')
        print(f'tur {tur + 1}: kazanç {kaz:+.2f} dB, sınırlayıcı en çok {gmin:.2f} dB -> {m["I"]:.2f} LUFS, {m["TP"]:.2f} dBTP')
        if abs(m['I'] - hI) <= 0.15 and m['TP'] <= hTP:
            break
        kaz += hI - m['I']
        if m['TP'] > hTP:
            esik -= (m['TP'] - hTP) + 0.1
    os.makedirs(os.path.dirname(out), exist_ok=True)
    yaz_wav(out, y)
    print('yazıldı:', os.path.relpath(out, ROOT))

    if not a.olcme:
        sm = db2a(kaz) * gs[:, None]
        olc(out, tl, cue, Z, {'anlatici': voice * sm, 'arka': bg * sm, 'bip': bus['bip'] * sm,
                               **{k: bus[k] * sm for k in ARKA}}, n)
    if a.mux:
        video = a.video or f'{ROOT}/out/part{n}-video.mp4'
        if not os.path.exists(video):
            print('görüntü yok, mux atlandı:', os.path.relpath(video, ROOT))
        else:
            mp4 = f'{ROOT}/out/part{n}.mp4'
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', video, '-i', out, '-map', '0:v:0', '-map', '1:a:0',
                            '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', str(SR), '-t', f'{dur:.3f}',
                            '-movflags', '+faststart', mp4], check=True)
            d = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4],
                               capture_output=True, text=True).stdout.strip()
            print('yazıldı:', os.path.relpath(mp4, ROOT), 'süre', d)


# ------------------------------------------------------------------ ölçüm
def olc(yol, tl, cue, Z, st, n):
    print('\n== ölçüm ==')
    m = ebur128(yol)
    print(f'bütünleşik {m["I"]:.1f} LUFS, LRA {m["LRA"]:.1f} LU, gerçek tepe {m["TP"]:.1f} dBTP (ffmpeg ebur128)')
    mix = _oku_taze(yol)
    seg = lambda x, a, b: x[int(a * SR):int(b * SR)]
    # konuşma içi: anlatıcı - arka plan
    print('\ncümle içi RMS (dBFS)   anlatıcı  arka    fark')
    farklar = []
    for s in tl['sentences']:
        a, b = float(s['t0']), float(s['t1'])
        va, ba = rms_db(seg(st['anlatici'], a, b)), rms_db(seg(st['arka'], a, b))
        farklar.append((va - ba, s['i']))
        print(f"  {s['i']:2d} {a:6.2f}-{b:6.2f}   {va:6.1f}  {ba:6.1f}  {va - ba:5.1f}{'  <12!' if va - ba < 12 else ''}")
    # 200 ms pencereler: en kötü an
    w = int(0.2 * SR); kotu = (99, 0)
    for s in tl['sentences']:
        for i in range(int(float(s['t0']) * SR), int(float(s['t1']) * SR) - w + 1, w // 2):
            va, ba = rms_db(st['anlatici'][i:i + w]), rms_db(st['arka'][i:i + w])
            if va > -40 and va - ba < kotu[0]:
                kotu = (va - ba, i / SR)
    print(f'en düşük fark: cümle {min(farklar)[1]} ({min(farklar)[0]:.1f} dB); 200 ms pencerede (kelime arası dahil) {kotu[0]:.1f} dB @ {kotu[1]:.2f} sn')
    # sesli 100 ms pencereler (anlatıcı > -30 dBFS): kaçı 12 dB kuralını tutuyor
    w = int(0.1 * SR); fs = []
    for s in tl['sentences']:
        for i in range(int(float(s['t0']) * SR), int(float(s['t1']) * SR) - w + 1, w):
            va = rms_db(st['anlatici'][i:i + w])
            if va > -30:
                fs.append((va - rms_db(st['arka'][i:i + w]), i / SR))
    fs.sort()
    print(f"sesli 100 ms pencereler: {len(fs)}, %{100 * sum(f >= 12 for f, _ in fs) / len(fs):.1f}'i >= 12 dB; en kötü 3: "
          + ', '.join(f'{f:.1f} dB @ {t:.1f}' for f, t in fs[:3]))
    print('\ncümle arası RMS (dBFS, miks):')
    ss = tl['sentences']
    print('  ' + ' '.join(f"{float(ss[i]['t1']):.1f}:{rms_db(seg(mix, float(ss[i]['t1']) + .05, float(ss[i + 1]['t0']) - .05)):.0f}"
                          for i in range(len(ss) - 1) if float(ss[i + 1]['t0']) - float(ss[i]['t1']) > 0.2))
    # bipler
    others = st['anlatici'] + st['arka']
    for ad, t, L in [('iki bip', Z('beep'), 0.62), ('tek bip', Z('endBeep'), 0.28)]:
        bp, ot = seg(st['bip'], t, t + L), seg(others, t, t + L)
        pre = seg(others, t - 0.3, t)
        print(f'{ad} @ {t:.2f}: bip RMS {rms_db(bp):.1f} tepe {a2db(np.abs(bp).max()):.1f} | geri kalan her şey RMS {rms_db(ot):.1f} '
              f'tepe {a2db(np.abs(ot).max()):.1f} | bip öncesi 0,3 sn {rms_db(pre):.1f} dBFS')
    # sessizlikler
    print('\nsessizlik (miks, bip hariç; hedef < -45 dBFS):')
    s15, s16 = [s for s in ss if s['i'] == 15][0], [s for s in ss if s['i'] == 16][0]
    for ad, a, b in [("'Real chimneys don't.' sonrası", float(s15['t1']) + 0.05, float(s16['t0']) - 0.15),
                     ('bitiş, bip öncesi', Z('voiceEnd') + 0.10, Z('endBeep') - 0.01),
                     ('bitiş, bip sonrası', Z('endBeep') + 0.40, Z('endCard') - 0.01),
                     ('bitiş kartı (rüzgâr + vurgu)', Z('endCard'), Z('dur'))]:
        x = seg(mix, a, b)
        print(f'  {ad:32s} {a:6.2f}-{b:6.2f}: RMS {rms_db(x):6.1f}  tepe {a2db(np.abs(x).max()):6.1f}')
    # telefon: darbelerde 120 Hz üstü
    for ad, t in [('top darbe', Z('s19.t1') + 0.06), ('baca yere', Z('s20.t1') + 0.12)]:
        x = seg(st['darbe'], t, t + 0.4).mean(1)
        X = np.abs(np.fft.rfft(x)) ** 2; f = np.fft.rfftfreq(x.size, 1 / SR)
        print(f'{ad} @ {t:.2f}: 120 Hz üstü enerji %{100 * X[f >= 120].sum() / X.sum():.0f}, '
              f'tepe {a2db(np.abs(seg(st["darbe"], t, t + 0.4)).max()):.1f} dBFS')
    gorseller(yol, tl, Z, st, mix, n)


def _oku_taze(yol):
    _cache.pop(yol, None)
    return oku(yol)


def gorseller(yol, tl, Z, st, mix, n):
    o = os.path.dirname(yol)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', yol, '-lavfi',
                    'showwavespic=s=1800x360:split_channels=0:colors=#2b6cb0:scale=sqrt', '-frames:v', '1',
                    f'{o}/miks-dalga.png'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', yol, '-lavfi',
                    'showspectrumpic=s=1600x512:mode=combined:scale=log:fscale=log:legend=1', f'{o}/miks-spektrum.png'],
                   check=True)
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        return
    W, H, L, T = 1800, 520, 50, 20
    im = Image.new('RGB', (W, H), (250, 250, 247)); d = ImageDraw.Draw(im)
    dur = float(tl['duration'])
    X = lambda t: L + (W - L - 10) * t / dur
    Y = lambda db: T + (H - T - 30) * (-db) / 70
    for s in tl['sentences']:
        d.rectangle([X(float(s['t0'])), T, X(float(s['t1'])), H - 30], fill=(232, 238, 246))
    for db in range(0, 71, 10):
        d.line([L, Y(-db), W - 10, Y(-db)], fill=(215, 215, 210)); d.text((5, Y(-db) - 6), f'-{db}', fill=(90, 90, 90))
    for t in range(0, int(dur) + 1, 5):
        d.text((X(t) - 6, H - 24), f'{t}', fill=(90, 90, 90))
    for k, v in tl['cues'].items():
        d.line([X(v), T, X(v), H - 30], fill=(200, 120, 40)); d.text((X(v) + 2, T), k, fill=(170, 90, 20))
    hop = int(0.05 * SR)
    for ad, renk in [('anlatici', (30, 30, 30)), ('muzik', (60, 110, 200)), ('ortam', (60, 160, 90)),
                     ('efekt', (190, 70, 60)), ('darbe', (140, 40, 160)), ('bip', (230, 150, 0))]:
        x = st[ad]; pts = []
        for i in range(0, x.shape[0] - hop, hop):
            r = max(rms_db(x[i:i + hop]), -70)
            pts.append((X(i / SR), Y(r)))
        d.line(pts, fill=renk, width=2)
    d.text((L + 5, H - 12), 'RMS 50 ms (dBFS): black=voice  blue=music  green=ambience  red=sfx  purple=impact  orange=beep;  shaded=sentences',
           fill=(40, 40, 40))
    im.save(f'{o}/miks-seviye.png')
    print('görseller: out/miks-dalga.png, out/miks-spektrum.png, out/miks-seviye.png')


if __name__ == '__main__':
    main()
