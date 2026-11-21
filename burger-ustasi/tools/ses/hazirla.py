#!/usr/bin/env python3
"""Burger Ustası: oyun seslerini ve müziği hazırlar (www/ses/*.mp3 + www/ses/sesler.json).

    pip install numpy scipy soundfile librosa        (ffmpeg + libmp3lame gerekir)
    python3 tools/ses/hazirla.py

Kaynaklar tools/ses/kaynak/ içinde (lisansların hepsi CC0; ayrıntı www/ses/LISANS.md). İki müzik dosyası büyük olduğu için
depoda yok; yoksa OpenGameArt'tan indirilir (URL aşağıda). Bozukluk ve kasa zili bu betikte sentezlenir (kendi kaydımız).
Her ses mono 44,1 kHz, tepe −1 dBFS'e göre ayarlı, kısa; müzik döngüleri başta ve sonda 0,5 sn "sarma" payıyla yazılır:
dosya = [döngünün son 0,5 sn'si] + döngü + [döngünün ilk 0,5 sn'si]. Oyun loopStart = 0,5 + δ, loopEnd = 0,5 + L + δ ile çalar;
MP3 kodlayıcının baştaki gecikmesi (δ) tarayıcıdan tarayıcıya değişse de döngü noktasının iki yanı aynı ses olduğu için boşluk/tık olmaz.
Whoosh/swoosh yok: hiçbir seste süzgeç kaydırması ya da hava sesi yok.
"""
import json, os, subprocess, urllib.request
import numpy as np
import soundfile as sf
import librosa
from scipy.signal import butter, sosfilt

KOK = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
KAY = os.path.join(KOK, 'tools', 'ses', 'kaynak')
CIK = os.path.join(KOK, 'www', 'ses')
SR = 44100
rng = np.random.default_rng(7)
MUZIK_URL = {
    'oga-happy-clappy-loop-owlishmedia.flac': 'https://opengameart.org/sites/default/files/HappyClappyLoop.wav',
    'oga-urban-shop-bpm92-mintodog.ogg': 'https://opengameart.org/sites/default/files/urban_shop_bpm92_0.ogg',
}


def yukle(ad, mono=True):
    p = os.path.join(KAY, ad)
    if not os.path.exists(p) and ad in MUZIK_URL:
        urllib.request.urlretrieve(MUZIK_URL[ad], p + '.indir')
        os.replace(p + '.indir', p)
    y, sr = librosa.load(p, sr=SR, mono=mono)
    return y


def K(ad):
    return yukle(f'kenney-{ad}.ogg')


def kirp(y, a, b):
    return y[int(a * SR):int(b * SR)].copy()


def zarf(y, gir=0.003, cik=0.03):
    y = y.copy(); n = len(y)
    g, c = min(n, int(gir * SR)), min(n, int(cik * SR))
    if g: y[:g] *= np.linspace(0, 1, g)
    if c: y[-c:] *= np.linspace(1, 0, c) ** 2
    return y


def sessizKirp(y, esik=0.01):
    a = np.where(np.abs(y) > esik * np.abs(y).max())[0]
    return y[max(0, a[0] - 64):a[-1] + 1] if len(a) else y


def suz(y, tip, f, d=2):
    return sosfilt(butter(d, f, tip, fs=SR, output='sos'), y)


def tepe(y, db=-1.0):
    m = np.abs(y).max()
    return y * (10 ** (db / 20) / m) if m > 0 else y


def karis(*parcalar):
    """[(ses, gecikme sn, kazanç)] → tek ses"""
    n = max(int(g * SR) + len(s) for s, g, _ in parcalar)
    o = np.zeros(n)
    for s, g, k in parcalar:
        i = int(g * SR); o[i:i + len(s)] += s * k
    return o


def yaz(ad, y, kbps=96, kanal=1, sr=SR):
    os.makedirs(CIK, exist_ok=True)
    tmp = os.path.join(CIK, ad + '.wav')
    sf.write(tmp, y.T if y.ndim == 2 else y, sr, subtype='PCM_16')
    yol = os.path.join(CIK, ad + '.mp3')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', tmp, '-ac', str(kanal), '-c:a', 'libmp3lame', '-b:a', f'{kbps}k', '-ar', str(sr), yol], check=True)
    os.remove(tmp)
    return os.path.getsize(yol)


# ---------- kendi sentezimiz: bozukluk ve kasa zili ----------
def bozukluk(f0, seed):
    r = np.random.default_rng(seed)
    t = np.arange(int(0.42 * SR)) / SR
    oran = [1.0, 1.59, 2.14, 2.65, 3.17, 3.83]
    y = np.zeros_like(t)
    for k, o in enumerate(oran):
        f = f0 * o * (1 + r.uniform(-0.006, 0.006))
        y += np.sin(2 * np.pi * f * t + r.uniform(0, 6)) * np.exp(-t * (9 + 7 * k)) * (0.9 ** k) * r.uniform(0.6, 1)
    tik = suz(r.standard_normal(int(0.004 * SR)), 'highpass', 5000) * np.linspace(1, 0, int(0.004 * SR))
    y[:len(tik)] += tik * 0.6
    # ikinci küçük zıplama (bozukluk tezgâha iki kez değer)
    y2 = np.roll(y, int(r.uniform(0.028, 0.045) * SR)) * 0.38
    y2[:int(0.028 * SR)] = 0
    return zarf(y + y2, 0.0005, 0.08)


def zil(f0, sure=1.1, parl=1.0):
    t = np.arange(int(sure * SR)) / SR
    y = np.zeros_like(t)
    for o, g, d in [(1, 1, 2.6), (2.0, 0.45, 3.5), (3.01, 0.28 * parl, 5), (4.2, 0.16 * parl, 7), (5.43, 0.1 * parl, 9)]:
        y += np.sin(2 * np.pi * f0 * o * t) * np.exp(-t * d) * g
    return zarf(y, 0.0015, 0.12)


def dongu_yaz(ad, y, kbps, pay=0.5, xf=0.01):
    """y: (kanal, n) tam döngü. Döngü noktasına 10 ms çapraz geçiş, başa/sona 0,5 sn sarma payı."""
    n = int(xf * SR)
    r = np.linspace(0, 1, n)
    L = y[:, n:].copy()
    L[:, -n:] = y[:, -n:] * np.cos(r * np.pi / 2) + y[:, :n] * np.sin(r * np.pi / 2)
    p = int(pay * SR)
    dosya = np.concatenate([L[:, -p:], L, L[:, :p]], axis=1)
    dosya = dosya / max(1e-9, np.abs(dosya).max()) * 10 ** (-1.5 / 20)
    b = yaz(ad, dosya, kbps, kanal=y.shape[0])
    return {'pay': pay, 'uzunluk': round(L.shape[1] / SR, 5), 'kb': round(b / 1024, 1)}


def main():
    meta = {'sesler': {}, 'muzik': {}}
    S = {}

    # ızgara cızırtısı (döngü): pastırma cızırtısının en düzenli 4 sn'si, uçları çapraz geçişli
    y = yukle('freesound-382680-mricken1-sizzling-bacon.mp3')
    y = suz(kirp(y, 9.5, 14.2), 'highpass', 250)
    S['cizirti'] = ('dongu', y)
    # fritöz kızarma döngüsü: patates kızarması kaydından 5 sn (alçak geçiren yok, yalnız gürültü tabanı)
    y = yukle('freesound-667767-nicandali-chips-frying.mp3')
    S['fritoz'] = ('dongu', suz(kirp(y, 8.0, 13.6), 'highpass', 180))
    # yağa iniş: aynı kaydın 1,3 sn'si, ani başlangıç ve sönüş (gerçek kayıt, süzgeç kaydırması yok) + yumuşak düşme
    d = kirp(y, 14.0, 15.4)
    tt = np.arange(len(d)) / SR
    d = d * np.minimum(1, tt / 0.01) * (1.8 * np.exp(-tt * 1.6) + 0.15)
    S['fritoz_dal'] = ('tek', [karis((zarf(d, 0.005, 0.3), 0.04, 1.0), (sessizKirp(K('impactSoft_medium_002')), 0.0, 0.7))])
    # fritöz sepeti (alınca): sepet tıkırtısı
    y = yukle('freesound-637625-kyles-fryer-basket.mp3')
    S['fritoz_al'] = ('tek', [zarf(sessizKirp(kirp(y, 6.45, 7.0)), 0.002, 0.08)])
    # hazır çanı: Kenney zil vuruşu
    S['hazir'] = ('tek', [zarf(sessizKirp(K('impactBell_heavy_003')), 0.001, 0.15)])
    # bıçak: satırla tahtaya vuruşlar (3 farklı vuruş)
    y = yukle('freesound-101733-helenacm-chopping-meat.mp3')
    on = librosa.onset.onset_detect(y=y, sr=SR, units='samples', backtrack=True)
    vur = sorted([y[a:a + int(0.2 * SR)] for a in on if a + int(0.2 * SR) < len(y)], key=lambda s: -np.abs(s).max())[:3]
    S['bicak'] = ('tek', [zarf(v, 0.001, 0.07) for v in vur])
    # malzemenin burgere konması
    S['kon_ekmek'] = ('tek', [sessizKirp(K(f'impactSoft_medium_00{i}')) for i in (0, 1, 3)])
    S['kon_kofte'] = ('tek', [karis((sessizKirp(K(f'impactSoft_medium_00{i}')), 0, 1), (sessizKirp(K('impactGeneric_light_000')), 0.004, 0.25)) for i in (2, 1)])
    S['kon_peynir'] = ('tek', [sessizKirp(K(f'impactGeneric_light_00{i}')) for i in (0, 1, 2)])
    S['kon_tursu'] = ('tek', [sessizKirp(K(f'impactGeneric_light_00{i}')) for i in (1, 2)])
    # tepsiye koyma (tahta tepsi), servis (tepsi müşteriye: tabak sesi)
    S['tepsi'] = ('tek', [sessizKirp(K(f'impactWood_light_00{i}')) for i in (0, 1, 2)])
    S['servis'] = ('tek', [zarf(sessizKirp(K(f'impactPlate_light_00{i}')), 0.001, 0.12) for i in (0, 2)])
    # bozukluk (kendi sentezimiz) ve kasa (tahta çekmece vuruşu + kendi zilimiz)
    S['para'] = ('tek', [bozukluk(f, s) for f, s in ((3150, 1), (3420, 2), (2890, 3))])
    S['kasa'] = ('tek', [karis((sessizKirp(K('chips-handle-3')), 0, 0.5), (zil(1568, 1.0), 0.05, 0.8), (zil(2093, 0.8, 0.7), 0.09, 0.45))])
    # dokunuş, düğme, uyarı, doğrama tamam
    S['dokun'] = ('tek', [sessizKirp(K('select_002'))])
    S['tik'] = ('tek', [sessizKirp(K('click_001'))])
    S['uyari'] = ('tek', [karis((sessizKirp(K('tick_002')), 0, 1), (sessizKirp(K('tick_002')), 0.09, 0.8))])
    S['tamam'] = ('tek', [sessizKirp(K('confirmation_001'))])
    # jingle'lar (pizzicato yaylılar)
    S['gun_basla'] = ('tek', [sessizKirp(K('jingles_PIZZI08'))])
    S['gun_sonu'] = ('tek', [sessizKirp(K('jingles_PIZZI10'))])
    S['satin'] = ('tek', [sessizKirp(K('jingles_PIZZI16'))])

    toplam = 0
    for ad, (tur, v) in S.items():
        if tur == 'dongu':
            y = v
            y = y / np.abs(y).max() * 10 ** (-3 / 20)
            m = dongu_yaz(ad, y[None, :], 64)
            meta['sesler'][ad] = {'dongu': True, **m}
            toplam += m['kb']
        else:
            liste = []
            for i, y in enumerate(v):
                y = tepe(zarf(y, 0.001, 0.02), -1.0)
                dad = ad if len(v) == 1 else f'{ad}{i + 1}'
                kb = yaz(dad, y, 80) / 1024
                toplam += kb
                liste.append(dad)
            meta['sesler'][ad] = {'dosya': liste}
    # müzik: oyun döngüsü iki katman (HPSS: ezgi/akor + vurmalı), menü ayrı parça
    y = yukle('oga-happy-clappy-loop-owlishmedia.flac', mono=False)
    Hs, Ps = [], []
    for ch in y:
        D = librosa.stft(ch)
        H, P = librosa.decompose.hpss(D, margin=1.0)
        Hs.append(librosa.istft(H, length=len(ch))); Ps.append(librosa.istft(P, length=len(ch)))
    Hs, Ps = np.array(Hs), np.array(Ps)
    ust = max(np.abs(Hs).max(), np.abs(Ps).max())
    for ad, z in (('muzik_oyun_a', Hs), ('muzik_oyun_b', Ps)):
        n = int(0.01 * SR); r = np.linspace(0, 1, n)
        L = z[:, n:].copy(); L[:, -n:] = z[:, -n:] * np.cos(r * np.pi / 2) + z[:, :n] * np.sin(r * np.pi / 2)
        p = int(0.5 * SR)
        dosya = np.concatenate([L[:, -p:], L, L[:, :p]], axis=1) / ust * 10 ** (-1.5 / 20)   # iki katman aynı ölçekte
        b = yaz(ad, dosya, 64, kanal=1)
        meta['muzik'][ad] = {'pay': 0.5, 'uzunluk': round(L.shape[1] / SR, 5), 'kb': round(b / 1024, 1), 'bpm': 110}
        toplam += b / 1024
    y = yukle('oga-urban-shop-bpm92-mintodog.ogg', mono=False)
    m = dongu_yaz('muzik_menu', y, 48)
    meta['muzik']['muzik_menu'] = {**m, 'bpm': 92}
    toplam += m['kb']
    meta['toplamKB'] = round(toplam)
    with open(os.path.join(CIK, 'sesler.json'), 'w') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    # ses.js içindeki liste (oyun dosya adlarını ve döngü noktalarını buradan bilir)
    import re
    liste = {'sesler': {k: ({'dongu': True, 'pay': v['pay'], 'uzunluk': v['uzunluk']} if v.get('dongu') else {'dosya': v['dosya']}) for k, v in meta['sesler'].items()},
             'muzik': {k: {'pay': v['pay'], 'uzunluk': v['uzunluk']} for k, v in meta['muzik'].items()}}
    js = os.path.join(KOK, 'www', 'js', 'ses.js')
    t = open(js, encoding='utf-8').read()
    t = re.sub(r'/\*LISTE>\*/.*?/\*<LISTE\*/', lambda m: '/*LISTE>*/var LISTE=' + json.dumps(liste, ensure_ascii=False, separators=(',', ':')) + ';/*<LISTE*/', t, flags=re.S)
    open(js, 'w', encoding='utf-8').write(t)
    print(json.dumps(meta, ensure_ascii=False)[:2000])
    print('toplam', round(toplam), 'KB')


if __name__ == '__main__':
    main()
