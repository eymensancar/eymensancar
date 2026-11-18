#!/usr/bin/env python3
"""Two Beeps - 1. bolum ses efektleri ve Daisy'nin iki bip'i.

Calistir:  python3 src/sfx_uret.py      (hepsi; --yalniz-pilot / --yalniz-yeni ile bir kismi)
Gerekenler: Python 3 + numpy, ffmpeg (yalniz kaynak kesitleri okumak icin).

Her ses sabit tohumla (seed) sentezlenir; ayni betik ayni dosyalari uretir.
Tek dis kaynak ortam sesi: assets/sfx/kaynak/ altindaki iki CC0 kesit
(OpenGameArt "Park Ambiences", Thimras). Kesitler su komutlarla alindi:
  ffmpeg -ss 138 -t 24 -i park_ambience_birds.wav -c:a pcm_s24le park_ambience_birds_138-162s.wav
  ffmpeg -ss 40  -t 24 -i park_ambience_wind.wav  -c:a pcm_s24le park_ambience_wind_40-64s.wav

Cikti: 48 kHz, 24 bit WAV. Tek seferlik sesler mono, ortam sesi stereo.
Tepe (4x asiri ornekleme ile olculen gercek tepe) en cok -3.5 dBFS.
Bas/son: sessizlikten baslar, kosinus solmayla biter (tik yok).
"""
import math
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000
KOK = Path(__file__).resolve().parents[1]
SFX = KOK / "assets" / "sfx"
ADAY = SFX / "adaylar"
KAYNAK = SFX / "kaynak"
TP = 2 * math.pi


# ---------------------------------------------------------------- temel araclar
def t_ax(sure):
    return np.arange(int(round(sure * SR))) / SR


def buf(sure):
    return np.zeros(int(round(sure * SR)))


def ekle(hedef, parca, bas):
    """parca'yi hedef'e bas (sn) konumundan itibaren ekler (tasan kisim kesilir)."""
    i = int(round(bas * SR))
    if i >= len(hedef):
        return hedef
    n = min(len(parca), len(hedef) - i)
    hedef[i:i + n] += parca[:n]
    return hedef


def svf(x, fc, q=0.707, mod="lp"):
    """TPT durum-degisken filtre (Zavalishin). fc sabit ya da ornek basina dizi."""
    x = np.asarray(x, float)
    fc = np.broadcast_to(np.clip(np.asarray(fc, float), 10, SR * 0.45), x.shape)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    a1 = 1.0 / (1.0 + g * (g + k))
    a2 = g * a1
    a3 = g * a2
    lp = np.empty_like(x)
    bp = np.empty_like(x)
    ic1 = ic2 = 0.0
    xs, A1, A2, A3 = x.tolist(), a1.tolist(), a2.tolist(), a3.tolist()
    lpl, bpl = [0.0] * len(xs), [0.0] * len(xs)
    for i in range(len(xs)):
        v3 = xs[i] - ic2
        v1 = A1[i] * ic1 + A2[i] * v3
        v2 = ic2 + A2[i] * ic1 + A3[i] * v3
        ic1 = 2 * v1 - ic1
        ic2 = 2 * v2 - ic2
        lpl[i] = v2
        bpl[i] = v1
    lp[:] = lpl
    bp[:] = bpl
    if mod == "lp":
        return lp
    if mod == "bp":
        return bp * k  # tepe kazanci ~1
    if mod == "hp":
        return x - k * bp - lp
    raise ValueError(mod)


def fft_renk(x, egri):
    """Dairesel (dongu dostu) sifir-fazli FFT filtresi; egri(f) -> dogrusal kazanc."""
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(x.shape[0], 1 / SR)
    gk = egri(f)
    if X.ndim == 2:
        gk = gk[:, None]
    return np.fft.irfft(X * gk, n=x.shape[0], axis=0)


def butter_lp(f, fc, n=2):
    return 1 / np.sqrt(1 + (f / fc) ** (2 * n))


def butter_hp(f, fc, n=2):
    return 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-6)) ** (2 * n))


def gurultu(rng, sure):
    return rng.standard_normal(int(round(sure * SR)))


def zarf_ust(sure, atak, sonum, tepe=1.0):
    """atak (sn) dogrusal yukselis, sonra exp dusus (sonum: -60 dB'e kadar sure)."""
    t = t_ax(sure)
    e = np.exp(-6.9 * np.maximum(t - atak, 0) / max(sonum, 1e-4))
    if atak > 0:
        e = np.where(t < atak, t / atak, e)
    return e * tepe


def oyun_env(sure, tepe, dur):
    """Oyundaki env(): 12 ms'de .0001'den tepe'ye, dur'da .0001'e ustel."""
    t = t_ax(sure)
    e = np.where(t < 0.012, 1e-4 * (tepe / 1e-4) ** (t / 0.012),
                 tepe * (1e-4 / tepe) ** (np.clip((t - 0.012) / (dur - 0.012), 0, 1)))
    e[t > dur] = 0
    return e


def kaydir_sin(f, sure, faz0=0.0):
    """Frekansi zamanla degisen sinus (f: dizi ya da sabit)."""
    n = int(round(sure * SR))
    f = np.broadcast_to(np.asarray(f, float), (n,))
    faz = faz0 + TP * np.cumsum(f) / SR
    return np.sin(faz - TP * f[0] / SR)  # ilk ornek faz0'da


def ustel_kayma(f1, f2, sure, kayma_suresi=None):
    t = t_ax(sure)
    d = kayma_suresi or sure
    return f1 * (f2 / f1) ** np.clip(t / d, 0, 1)


def modal(frek, sonumler, genlik, sure, rng=None, sapma=0.0):
    """Sonumlu sinuslerin toplami (metal/tas tinilari)."""
    t = t_ax(sure)
    y = np.zeros_like(t)
    for f, d, a in zip(frek, sonumler, genlik):
        if rng is not None and sapma:
            f *= 1 + rng.uniform(-sapma, sapma)
        y += a * np.sin(TP * f * t) * np.exp(-6.9 * t / d)
    return y


def yanki(x, kuyruk=0.6, karisim=0.18, on_gecikme=0.012, parlaklik=5000, seed=7):
    """Sentetik dis mekan yankisi: ustel sonumlu, alcak geciren gurultu tepkisi."""
    rng = np.random.default_rng(seed)
    n = int(kuyruk * SR)
    t = np.arange(n) / SR
    ir = rng.standard_normal(n) * np.exp(-6.9 * t / kuyruk)
    ir = fft_renk(ir, lambda f: butter_lp(f, parlaklik, 1))
    ir[: int(on_gecikme * SR)] = 0
    ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    islak = np.fft.irfft(np.fft.rfft(x, nfft) * np.fft.rfft(ir, nfft), nfft)[:L]
    kuru = np.concatenate([x, np.zeros(n)])
    return kuru + karisim * islak


def tane(rng, f_alt, f_ust, uz_alt, uz_ust, q_alt=1.0, q_ust=3.0):
    """Kisa filtrelenmis gurultu tanesi (citirti, hisirti, moloz)."""
    uz = rng.uniform(uz_alt, uz_ust)
    n = gurultu(rng, uz + 0.01)
    e = zarf_ust(uz + 0.01, 0.0006, uz)
    f = math.exp(rng.uniform(math.log(f_alt), math.log(f_ust)))
    return svf(n * e, f, rng.uniform(q_alt, q_ust), "bp")


def dc_kes(x, fc=22):
    return svf(x, fc, 0.707, "hp")


def gercek_tepe(x):
    """4x asiri orneklemeyle yaklasik gercek tepe."""
    x = np.atleast_2d(x.T).T if x.ndim == 1 else x
    n = x.shape[0]
    X = np.fft.rfft(x, axis=0)
    Y = np.zeros((4 * n // 2 + 1, x.shape[1]), complex)
    Y[: X.shape[0]] = X
    y = np.fft.irfft(Y, n=4 * n, axis=0) * 4
    return float(np.max(np.abs(y)))


def bitir(x, tepe_db=-3.5, sol_bas=0.003, sol_son=0.04, dongu=False):
    x = np.asarray(x, float)
    if not dongu:
        x = dc_kes(x) if x.ndim == 1 else np.stack([dc_kes(c) for c in x.T], 1)
    nb, ns = int(sol_bas * SR), int(sol_son * SR)
    w = np.ones(x.shape[0])
    if nb:
        w[:nb] = 0.5 - 0.5 * np.cos(np.pi * np.arange(nb) / nb)
    if ns:
        w[-ns:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(ns) / ns)
    w[0] = w[-1] = 0.0
    x = x * (w if x.ndim == 1 else w[:, None])
    hedef = 10 ** (tepe_db / 20)
    x = x * hedef / (gercek_tepe(x) + 1e-12)
    return x


def yaz(ad, x, klasor=SFX):
    klasor.mkdir(parents=True, exist_ok=True)
    x = np.asarray(x)
    kanal = 1 if x.ndim == 1 else x.shape[1]
    i = np.clip(np.round(x * (2 ** 23 - 1)), -(2 ** 23), 2 ** 23 - 1).astype("<i4")
    b = i.reshape(-1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(str(klasor / ad), "wb") as w:
        w.setnchannels(kanal)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)
    print(f"  {klasor.name}/{ad}: {x.shape[0] / SR:.2f} sn")


def oku_kaynak(ad):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(KAYNAK / ad), "-ac", "2",
                          "-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(float)


# ---------------------------------------------------------------- iki bip
def bip_tonu(sure, f0, kismi, atak, birak, cizirti=0.0, kayma=True, rng=None):
    """Tek bip: toplamsal kismi sesler + yumusak zarf + baslangicta hafif perde kaymasi."""
    t = t_ax(sure)
    f = np.full_like(t, f0)
    if kayma:
        f *= 1 + 0.015 * np.exp(-t / 0.012)           # baslangicta hafif "cirp"
        f *= 1 - 0.012 * np.clip((t - (sure - 0.05)) / 0.05, 0, 1)  # sonda hafif dusus
    faz = TP * np.cumsum(f) / SR
    y = np.zeros_like(t)
    for k, a in kismi:
        if k * f0 < SR * 0.4:
            y += a * np.sin(k * faz)
    if cizirti:
        y *= 1 + cizirti * np.sin(TP * 50 * t)        # eski elektromekanik korna titresimi
    e = np.ones_like(t)
    na, nr = int(atak * SR), int(birak * SR)
    e[:na] = np.sin(0.5 * np.pi * np.arange(na) / na) ** 2
    e[-nr:] = np.cos(0.5 * np.pi * np.arange(nr) / nr) ** 2
    return y * e


def role_tik(rng, seviye):
    n = gurultu(rng, 0.012) * zarf_ust(0.012, 0.0003, 0.006)
    return svf(n, 3200, 1.2, "bp") * seviye


def iki_bip(f0, kismi, acik, ara, atak, birak, cizirti, tik, yanki_k, yanki_m,
            ikinci_db=0.0, parlak=6000, seed=1, adet=2):
    rng = np.random.default_rng(seed)
    bas = 0.04
    y = buf(bas + 2 * acik + ara + 0.1)
    b = bip_tonu(acik, f0, kismi, atak, birak, cizirti)
    for i, kz in enumerate([1.0, 10 ** (ikinci_db / 20)][:adet]):
        t0 = bas + i * (acik + ara)
        ekle(y, b * kz, t0)
        if tik:
            ekle(y, role_tik(rng, tik) * kz, t0 - 0.004)
    y = fft_renk(np.concatenate([y, np.zeros(SR // 4)]), lambda f: butter_lp(f, parlak, 2))
    return yanki(y, yanki_k, yanki_m, 0.018, 4500, seed)


def daisy_bipleri():
    # A: modern geri vites uyarisi gibi; kare dalgaya yakin 1 kHz, sert.
    a = iki_bip(1000, [(k, 1 / k) for k in (1, 3, 5, 7, 9, 11)], 0.18, 0.12,
                0.003, 0.006, 0.0, 0.0, 0.25, 0.08, parlak=9000, seed=11)
    # B: eski vinc kornasi: 830 Hz (G#5), sicak ama telefonda net (2-3. kismiler 1.7-2.5 kHz),
    #    hafif baslangic cirpi, sonda minik dusus, 50 Hz titresim, role tiki, kisa dis yanki.
    kismi_b = [(1, 1.0), (2, 0.55), (3, 0.42), (4, 0.16), (5, 0.12), (6, 0.05), (7, 0.04)]
    b = iki_bip(830.6, kismi_b, 0.20, 0.13, 0.006, 0.03, 0.07, 0.12, 0.45, 0.16,
                parlak=6000, seed=12)
    # C: iki ses (besli araligi) eski kamyon kornasi; daha alcak ve burundan.
    kismi_c = [(1, 1.0), (1.5, 0.8), (2, 0.35), (3, 0.3), (4.5, 0.12), (6, 0.08)]
    c = iki_bip(622.3, kismi_c, 0.24, 0.14, 0.015, 0.04, 0.10, 0.0, 0.45, 0.14,
                parlak=3500, seed=13)
    # Yumusak (veda): B'nin ayni perdesi ve ritmi, daha koyu tini, yavas atak, uzun yanki,
    # ikinci bip biraz daha sessiz (yorgun ama tanidik).
    kismi_s = [(1, 1.0), (2, 0.28), (3, 0.12), (4, 0.03)]
    s = iki_bip(830.6, kismi_s, 0.22, 0.20, 0.035, 0.12, 0.03, 0.02, 1.4, 0.30,
                ikinci_db=-2.5, parlak=3000, seed=14)
    return a, b, c, s


# ---------------------------------------------------------------- kagit, kalem
def kagit_hisirti():
    rng = np.random.default_rng(21)
    sure = 1.5
    y = buf(sure)
    t = t_ax(sure)
    # iki el hareketi: kagidi alip acmak
    hareket = np.exp(-((t - 0.32) / 0.16) ** 2) + 0.8 * np.exp(-((t - 0.95) / 0.2) ** 2)
    for i in range(int(sure * 260)):
        tt = rng.uniform(0, sure - 0.03)
        if rng.random() < hareket[int(tt * SR)]:
            ekle(y, tane(rng, 1800, 8000, 0.001, 0.006, 0.8, 2.5) * rng.uniform(0.2, 1.0) ** 2, tt)
    hava = svf(gurultu(rng, sure), 900, 0.6, "bp") * hareket * 0.12
    y += hava
    # sonda kagidin kucuk "sap"i
    ekle(y, tane(rng, 2500, 3500, 0.012, 0.014, 1.0, 1.2) * 1.4, 1.18)
    return yanki(y, 0.25, 0.08, 0.008, 6000, 21)


def kalem_karalama():
    rng = np.random.default_rng(22)
    sure = 1.8
    y = buf(sure)
    ekle(y, tane(rng, 2200, 2600, 0.006, 0.008, 1.2, 1.5) * 0.8, 0.05)   # kalem kagida degiyor
    t0 = 0.09
    for i in range(10):                                                  # ileri-geri karalama
        uz = rng.uniform(0.11, 0.15) * (1 - 0.02 * i)
        tt = t_ax(uz)
        e = np.sin(np.pi * tt / uz) ** 1.5
        dokusu = 0.6 + 0.4 * np.abs(svf(rng.standard_normal(len(tt)), 260, 0.7))  # tanecikli surtunme
        dokusu = dokusu / np.max(dokusu)
        f = 3200 + 1600 * (tt / uz if i % 2 == 0 else 1 - tt / uz)       # yon degisince tini kayar
        z = svf(rng.standard_normal(len(tt)), f, 0.9, "bp") * e * dokusu
        z += 0.3 * svf(rng.standard_normal(len(tt)), 7000, 0.7, "hp") * e
        ekle(y, z * rng.uniform(0.55, 1.0), t0)
        t0 += uz + rng.uniform(0.005, 0.02)
    return yanki(y, 0.2, 0.06, 0.006, 7000, 22)


# ---------------------------------------------------------------- dizel motor
def atesleme(rng, guc, sure=0.09):
    """Tek silindir atesleme: egzoz 'cug'u + dizel vuruntu tikirtisi + gevsek sac titresimi."""
    t = t_ax(sure)
    f = 72 * (1 + 0.04 * rng.standard_normal())
    cug = np.sin(TP * f * t) * np.exp(-t / 0.022) * (1 - np.exp(-t / 0.002))
    puf = svf(rng.standard_normal(len(t)) * np.exp(-t / 0.018), 850, 0.9)
    vuruntu = svf(rng.standard_normal(len(t)) * np.exp(-t / 0.0035), 2600, 2.2, "bp")
    sac = svf(rng.standard_normal(len(t)) * np.exp(-t / 0.03), 950, 4.0, "bp")
    cug = np.tanh(2 * cug) / np.tanh(2)
    return guc * (0.6 * cug + 1.4 * puf + 1.3 * vuruntu * rng.uniform(0.6, 1.2) + 0.7 * sac)


def motor_akis(rng, olaylar, sure, dongu=False):
    """olaylar: [(zaman, guc)] -> motor sesi; dongu=True ise kuyruklar basa sarar."""
    y = buf(sure)
    n = len(y)
    for tt, g in olaylar:
        p = atesleme(rng, g)
        i = int(tt * SR)
        if dongu:
            idx = (i + np.arange(len(p))) % n
            np.add.at(y, idx, p)
        else:
            ekle(y, p, tt)
    return y


def rolanti_olaylari(rng, sure, hiz, bas=0.0):
    olay, t, k = [], bas, 0
    while t < sure:
        g = (1.15 if k % 4 == 0 else 1.0) * (1 + 0.08 * rng.standard_normal())  # eski motor dengesizligi
        olay.append((t, g))
        t += (1 / hiz) * (1 + 0.03 * rng.standard_normal())
        k += 1
    return olay


def govde(y):
    """Motor govdesi ve kabin rengi: 180 Hz govde rezonansi, ust uclari yumusat."""
    return fft_renk(y, lambda f: butter_lp(f, 3800, 2) * butter_hp(f, 60, 2)
                    * (1 + 1.2 * np.exp(-((f - 180) / 60) ** 2)) * (1 + 0.8 * np.exp(-((f - 700) / 300) ** 2)))


def dizel_rolanti():
    rng = np.random.default_rng(31)
    sure = 6.0
    hiz = 22.0
    adim = sure / round(sure * hiz)
    olay = []
    for k in range(int(round(sure * hiz))):
        g = (1.15 if k % 4 == 0 else 1.0) * (1 + 0.08 * rng.standard_normal())
        olay.append(((k * adim + 0.002 * rng.standard_normal()) % sure, g))
    y = motor_akis(rng, olay, sure, dongu=True)
    # dongu dostu mekanik ugultu (dairesel FFT filtresi)
    ug = fft_renk(rng.standard_normal(len(y)), lambda f: np.exp(-((f - 1400) / 500) ** 2)) * 0.05
    return govde(y + ug)


def dizel_calistirma():
    rng = np.random.default_rng(32)
    sure = 6.0
    t = t_ax(sure)
    y = buf(sure)
    # mars motoru: 1.5 sn; sikistirma zamaninda perde ve guc duser (4.5 Hz)
    mt = 1.5
    tm = t_ax(mt)
    sik = 0.5 + 0.5 * np.cos(TP * 4.5 * tm)
    fm = (150 + 40 * np.clip(tm / 0.4, 0, 1)) * (1 - 0.12 * sik)
    faz = TP * np.cumsum(fm) / SR
    mars = sum(np.sin(k * faz) / k for k in range(1, 12))
    mars = svf(mars, 1800, 0.8) * (0.55 + 0.45 * (1 - sik))
    disli = svf(rng.standard_normal(len(tm)), 3000, 1.5, "bp") * 0.25 * (1 - sik)
    e = np.clip(tm / 0.05, 0, 1) * np.clip((mt - tm) / 0.12, 0, 1)
    ekle(y, (mars * 0.35 + disli) * e, 0.05)
    # mars sirasinda donen motorun sikistirma cuflemesi
    for k in range(int(mt * 4.5)):
        ekle(y, atesleme(rng, 0.35), 0.12 + k / 4.5)
    # yakalama: once oksuren birkac atesleme, sonra devir 6->34 Hz cikar, 22 Hz'e oturur
    olay = [(1.38, 0.9), (1.52, 0.7), (1.62, 1.1)]
    tt = 1.75
    while tt < sure:
        if tt < 2.3:
            hz = 8 + (34 - 8) * (tt - 1.75) / 0.55
        elif tt < 3.4:
            hz = 34 - 12 * (tt - 2.3) / 1.1
        else:
            hz = 22
        g = 1.25 if tt < 2.6 else 1.0
        olay.append((tt, g * (1 + 0.1 * rng.standard_normal())))
        tt += (1 / hz) * (1 + 0.03 * rng.standard_normal())
    y += motor_akis(rng, olay, sure)
    y += svf(rng.standard_normal(len(t)), 1400, 1.0, "bp") * 0.05 * np.clip((t - 1.4) / 0.3, 0, 1)
    return govde(y)


# ---------------------------------------------------------------- kol, halat
def kol_cekme():
    rng = np.random.default_rng(41)
    y = buf(1.0)
    ekle(y, tane(rng, 1200, 1500, 0.008, 0.01, 1.0, 1.2) * 0.4, 0.02)   # ele alma
    tt = 0.08
    for i in range(4):                                                  # cirit (mandal) tiklari
        n = gurultu(rng, 0.003) * np.hanning(int(0.003 * SR))
        k = modal([2250, 3700, 5200], [0.018, 0.012, 0.008], [1, 0.6, 0.3], 0.03, rng, 0.03)
        ekle(y, (np.convolve(n, k)[: int(0.03 * SR)]) * 0.08, tt)
        tt += 0.06 + 0.012 * i
    # son kilitlenme: agir metal "klonk" + alcak vurus
    kl = 0.44
    ekle(y, modal([182, 431, 968, 1757, 2911], [0.25, 0.16, 0.09, 0.05, 0.03],
                  [0.5, 0.55, 0.4, 0.25, 0.15], 0.5, rng, 0.01), kl)
    tm = t_ax(0.15)
    ekle(y, np.sin(TP * np.cumsum(90 * (60 / 90) ** (tm / 0.08)) / SR) * np.exp(-tm / 0.04) * 0.5, kl)
    ekle(y, tane(rng, 900, 1300, 0.02, 0.025, 0.8, 1.0) * 0.9, kl)
    return yanki(y, 0.35, 0.12, 0.012, 5000, 41)


def halat_gerilme():
    rng = np.random.default_rng(42)
    sure = 2.8
    t = t_ax(sure)
    y = buf(sure)
    # takil-kay gicirtisi: duzensiz itki dizisi, metal rezonatorlerden gecer
    gerg = np.clip(t / 2.2, 0, 1)
    tt, itki = 0.1, np.zeros(len(t))
    while tt < sure - 0.2:
        faz = 0.5 + 0.5 * np.sin(TP * 1.3 * tt + 1.0)                    # gicirti obekleri
        if faz > 0.35:
            itki[int(tt * SR)] = rng.uniform(0.4, 1.0) * (0.4 + 0.6 * gerg[int(tt * SR)])
        tt += 1 / (30 + 70 * gerg[int(tt * SR)] + rng.uniform(-8, 8))
    gicir = sum(a * svf(itki, f, 18, "bp") for f, a in [(640, 1.0), (1370, 0.7), (2480, 0.45)])
    y += gicir * 2.0
    # gerilen celik halatin inleyisi: sertlikli tel, perde 95->140 Hz
    f = 95 + 45 * gerg ** 1.3
    faz = TP * np.cumsum(f) / SR
    inle = sum(np.sin(n * faz * math.sqrt(1 + 0.002 * n * n)) / n * (0.4 if n == 1 else 1) for n in range(1, 13))
    inle *= (0.15 + 0.85 * gerg) * (1 + 0.3 * np.sin(TP * 5.5 * t))
    inle *= np.clip((2.75 - t) / 0.45, 0, 1) ** 2                       # gerilme oturur, ses soner
    y += svf(inle, 2200, 0.8) * 0.12
    y += svf(rng.standard_normal(len(t)), 300 + 300 * gerg, 0.7) * 0.15 * gerg * np.clip((2.75 - t) / 0.45, 0, 1)
    # sonda bir telin yerine oturma "tink"i
    ekle(y, modal([3120, 4870, 7010], [0.35, 0.2, 0.1], [1, 0.4, 0.2], 0.5, rng) * 0.12, 2.35)
    return yanki(y, 0.5, 0.15, 0.015, 5000, 42)


# ---------------------------------------------------------------- yikim
def darbe_cekirdek(rng, guc, f1=75, f2=38, sonum=0.35, crunch_sonum=0.4, sure=2.0):
    t = t_ax(sure)
    f = ustel_kayma(f1, f2, sure, 0.4)
    bum = np.sin(TP * np.cumsum(f) / SR) * np.exp(-t / sonum) * (1 - np.exp(-t / 0.002))
    bum = np.tanh(2.5 * bum) / np.tanh(2.5) * 0.7                     # doyum: telefonda duyulan ust harmonikler
    bum2 = np.sin(2 * TP * np.cumsum(f) / SR) * np.exp(-t / (sonum * 0.6)) * 0.5
    crunch = svf(rng.standard_normal(len(t)) * np.exp(-t / crunch_sonum),
                 ustel_kayma(2600, 280, sure, crunch_sonum * 2), 0.7)
    tik = svf(rng.standard_normal(len(t)) * np.exp(-t / 0.004), 1200, 0.7, "hp")
    return guc * (bum + bum2 + 1.5 * crunch + 0.7 * tik)


def moloz(rng, y, bas, son, yogunluk, buyuk=0.3):
    """Tugla citirti / dusen parcalar: yogunlugu ustel azalan taneler."""
    tt = bas
    while tt < son:
        k = math.exp(-3 * (tt - bas) / (son - bas))
        r = rng.random()
        if r < 0.6:
            g = tane(rng, 700, 3800, 0.004, 0.03, 1.2, 4.0) * rng.uniform(0.15, 0.6)
        elif r < 0.85:
            g = modal([rng.uniform(1600, 2100), rng.uniform(2900, 3500)], [0.02, 0.012],
                      [1, 0.6], 0.04) * rng.uniform(0.1, 0.35)              # tugla-tugla "tak"
        else:
            tm = t_ax(0.12)
            g = (np.sin(TP * rng.uniform(110, 180) * tm) * np.exp(-tm / 0.03)
                 + 0.5 * svf(rng.standard_normal(len(tm)) * np.exp(-tm / 0.03), 900)) * buyuk
        ekle(y, g * k, tt)
        tt += rng.exponential(1 / (yogunluk * (0.15 + k)))
    return y


def top_darbe():
    rng = np.random.default_rng(51)
    y = buf(2.0)
    ekle(y, darbe_cekirdek(rng, 1.0, sure=1.9), 0.01)
    ekle(y, modal([162, 409, 771, 1223], [0.6, 0.4, 0.25, 0.15], [0.12, 0.1, 0.07, 0.04], 1.2), 0.01)
    moloz(rng, y, 0.05, 1.6, 90)
    return yanki(y, 0.6, 0.2, 0.025, 4000, 51)


def tugla_catirti():
    rng = np.random.default_rng(52)
    y = buf(2.6)
    for i in range(3):                                                 # harc catlamasi
        ekle(y, tane(rng, 1500, 3000, 0.002, 0.006, 3, 6) * 1.2, 0.02 + 0.05 * i + rng.uniform(0, 0.02))
    moloz(rng, y, 0.05, 2.3, 140, buyuk=0.22)
    return yanki(y, 0.5, 0.15, 0.02, 5000, 52)


def baca_devrilme():
    rng = np.random.default_rng(53)
    sure = 9.0
    t = t_ax(sure)
    y = buf(sure)
    # 0-1.2 sn: catlaklar hizlanir
    tt = 0.05
    while tt < 1.3:
        ekle(y, tane(rng, 1200, 3500, 0.002, 0.01, 2, 6) * rng.uniform(0.3, 0.9), tt)
        tt += rng.uniform(0.04, 0.25) * (1.3 - tt) + 0.02
    # 0.4-2.7 sn: egilme inlemesi (alcak gurultu + tas gicirtisi)
    e = np.clip((t - 0.4) / 2.0, 0, 1) ** 1.5 * np.clip((2.75 - t) / 0.08, 0, 1)
    y += svf(rng.standard_normal(len(t)), 150 + 350 * e, 1.2) * e * 0.5
    itki = np.zeros(len(t))
    tt = 0.8
    while tt < 2.6:
        itki[int(tt * SR)] = rng.uniform(0.3, 1)
        tt += 1 / rng.uniform(20, 45)
    y += sum(a * svf(itki, f, 10, "bp") for f, a in [(310, 1.0), (720, 0.6)]) * 0.5 * e
    # 1.9-2.75: dusus hissi (oyundaki whoosh gibi bant gecirgeni yukari kayar)
    w = np.clip((t - 1.9) / 0.85, 0, 1) * np.clip((2.78 - t) / 0.05, 0, 1)
    y += svf(rng.standard_normal(len(t)), 250 * (1400 / 250) ** w, 1.4, "bp") * w ** 2 * 0.5
    # 2.75: ana darbe + uzun gumburtu
    ekle(y, darbe_cekirdek(rng, 1.3, 62, 28, 1.2, 1.1, 5.0), 2.75)
    gum = np.clip((t - 2.75) / 0.05, 0, 1) * np.exp(-np.maximum(t - 2.75, 0) / 1.6)
    y += svf(rng.standard_normal(len(t)), 120 + 250 * gum, 0.8) * gum * 0.9
    for tt, g in [(3.15, 0.45), (3.55, 0.3), (4.25, 0.22)]:            # ikincil parca darbeleri
        ekle(y, darbe_cekirdek(rng, g, 110, 55, 0.2, 0.25, 1.0), tt)
    moloz(rng, y, 2.8, 6.8, 120, buyuk=0.45)
    # 3.4-9: toz: yumusak hisirti kabarir, esintiyle dalgalanir, kum serpintisi
    d = np.clip((t - 3.2) / 1.3, 0, 1) ** 2 * np.exp(-np.maximum(t - 4.5, 0) / 1.8)
    toz = svf(rng.standard_normal(len(t)), 3500, 0.5, "bp") + 0.6 * svf(rng.standard_normal(len(t)), 1500, 0.6, "bp")
    y += toz * d * (1 + 0.35 * np.sin(TP * 0.6 * t)) * 0.12
    tt = 3.6
    while tt < 8.5:
        ekle(y, tane(rng, 4000, 9000, 0.001, 0.004, 1, 2) * 0.12 * math.exp(-(tt - 3.6) / 2.0), tt)
        tt += rng.exponential(0.02)
    return yanki(y, 0.9, 0.2, 0.03, 3500, 53)


# ---------------------------------------------------------------- ortam, kesif, oyun
def ortam_bos_arsa():
    """CC0 kus + ruzgar kesitleri; 20 sn, sonu basa capraz solmayla birlesik (dongu)."""
    kus = oku_kaynak("park_ambience_birds_138-162s.wav")
    ruz = oku_kaynak("park_ambience_wind_40-64s.wav")
    L, X = 20 * SR, 2 * SR
    kus = fft_renk(kus, lambda f: butter_hp(f, 300, 2))               # uzak sehir ugultusunu al
    ruz = fft_renk(ruz, lambda f: butter_hp(f, 120, 2) * butter_lp(f, 4000, 1))
    m = kus * 1.0 + ruz * 0.35
    a, b = m[:L], m[L:L + X]
    w = np.sin(0.5 * np.pi * np.arange(X) / X)[:, None]
    a[:X] = a[:X] * w + b * np.sqrt(1 - w ** 2)                         # esit guclu capraz solma
    return a


def damga_kesif():
    rng = np.random.default_rng(61)
    y = buf(2.0)
    for i, tt in enumerate([0.02, 0.17]):                               # tasin tozunu silen el
        uz = 0.13
        tm = t_ax(uz)
        z = svf(rng.standard_normal(len(tm)), 5000, 0.8, "bp") * np.sin(np.pi * tm / uz) ** 2
        ekle(y, z * (0.35 - 0.1 * i), tt)
    # parlama: Daisy'nin bip perdesi (G#5) ve beslisi (D#6), cam/zil tinisi
    for f0, tt, a in [(830.6, 0.34, 0.6), (1244.5, 0.46, 0.5), (2489.0, 0.58, 0.12)]:
        ekle(y, modal([f0, f0 * 2.76, f0 * 5.4], [1.1, 0.45, 0.2], [1, 0.25, 0.08], 1.4)
             * (1 - np.exp(-t_ax(1.4) / 0.003)) * a, tt)
    return yanki(y, 1.3, 0.3, 0.02, 6000, 61)


def oyun_yikim():
    """Demolition Master'in WebAudio seslerinin tinisi: blip + boom + pop'lar + kasa (sfxCash)."""
    rng = np.random.default_rng(71)
    y = buf(1.6)
    # blip(240): kare dalga, 80 ms'de yarim perdeye iner
    tb = t_ax(0.12)
    fb = 240 * 0.5 ** np.clip(tb / 0.08, 0, 1)
    kare = sum(np.sin(k * TP * np.cumsum(fb) / SR) / k for k in range(1, 30, 2))
    ekle(y, kare * oyun_env(0.12, 0.12, 0.09), 0.0)
    # boom(k=1, f=90, dur=.8): sinus f->28 Hz + alcak geciren gurultu 2400->140 Hz
    t0, dur = 0.1, 0.8
    tm = t_ax(dur + 0.05)
    fs = 90 * (28 / 90) ** np.clip(tm / dur, 0, 1)
    ekle(y, np.sin(TP * np.cumsum(fs) / SR) * oyun_env(dur + 0.05, 0.8, dur), t0)
    ekle(y, svf(rng.uniform(-1, 1, len(tm)), 2400 * (140 / 2400) ** np.clip(tm / dur, 0, 1), 0.707)
         * oyun_env(dur + 0.05, 0.55, dur), t0)
    ekle(y, svf(rng.uniform(-1, 1, len(tm)), 3000, 0.707, "hp") * oyun_env(dur + 0.05, 0.2, 0.25), t0)
    # pop(f): tuglalar havaya sicrar
    for i, f in enumerate([520, 660, 780, 940]):
        tp = t_ax(0.14)
        fp = f * 1.6 ** np.clip(tp / 0.07, 0, 1)
        ekle(y, np.sin(TP * np.cumsum(fp) / SR) * oyun_env(0.14, 0.09 * 2.5, 0.1), 0.28 + i * 0.07)
    # sfxCash: 1320/1760/2640 Hz sinus, 70 ms arayla + 4 kHz ustu tik
    for i, f in enumerate([1320, 1760, 2640]):
        tc = t_ax(0.4)
        ekle(y, np.sin(TP * f * tc) * oyun_env(0.4, 0.12 * 2.5, 0.35), 0.72 + i * 0.07)
    ekle(y, svf(rng.uniform(-1, 1, int(0.12 * SR)), 4000, 0.707, "hp") * oyun_env(0.12, 0.3, 0.1), 0.72)
    return y


# ================================================================ 2-10. bolum kitapligi
# KALICI KURAL (Eymen, 15 Kasim 2026): whoosh/swoosh, hava/hisirti, firca/silme gibi
# filtreli gurultu suprumesi YOK. Bu bolumdeki seslerde gurultu yalniz <= 10 ms'lik
# vurus baslangici (tetikleyici) olarak ya da gercek kayit kesiti (kagit, kalem, adim,
# dizel) olarak bulunur. Govde her zaman tonlu (sonumlu sinusler, itki dizisi gicirtisi).

_KAYNAK_ON = {}


def kaynak_mono(ad):
    """kaynak/ altindaki bir kaydi mono, 48 kHz dizi olarak (onbellekli) dondurur."""
    if ad not in _KAYNAK_ON:
        _KAYNAK_ON[ad] = oku_kaynak(ad).mean(axis=1)
    return _KAYNAK_ON[ad]


def kesit(ad, bas, sure, sol_bas=0.02, sol_son=0.08):
    x = kaynak_mono(ad)[int(bas * SR):int((bas + sure) * SR)].copy()
    nb, ns = int(sol_bas * SR), int(sol_son * SR)
    if nb:
        x[:nb] *= np.sin(0.5 * np.pi * np.arange(nb) / nb) ** 2
    if ns:
        x[-ns:] *= np.cos(0.5 * np.pi * np.arange(ns) / ns) ** 2
    return x / (np.max(np.abs(x)) + 1e-12)


def hiz_degistir(x, oran, sure):
    """Degisken hizli okuma (varispeed): oran(t) dizisi; perde ve tempo birlikte degisir."""
    n = int(round(sure * SR))
    oran = np.broadcast_to(np.asarray(oran, float), (n,))
    konum = np.cumsum(oran) - oran[0]
    konum = np.mod(konum, len(x) - 1)        # kaynak kisa kalirsa basa sarar (rolanti duz)
    return np.interp(konum, np.arange(len(x)), x)


def tetik(rng, sure=0.003, fc=5000):
    """En cok birkac ms'lik vurus tetikleyicisi (gurultu kuyrugu hemen soner)."""
    t = t_ax(sure * 4)
    n = rng.standard_normal(len(t)) * np.exp(-t / (sure / 3))
    return svf(n, fc, 0.7)


def vurus(rng, frek, sonum, genlik, sure, tet=0.25, tet_fc=5000, sapma=0.015):
    """Tonlu vurus: sonumlu kismi sesler + cok kisa tetik."""
    y = modal(list(frek), list(sonum), list(genlik), sure, rng, sapma)
    y *= 1 - np.exp(-t_ax(sure) / 0.0006)
    if tet:
        g = tetik(rng, 0.003, tet_fc)
        m = min(len(g), len(y))
        y[:m] += (tet * g / (np.max(np.abs(g)) + 1e-12) * (np.max(np.abs(y)) + 1e-9))[:m]
    return y


def gumle(f1, f2, sonum, sure, doyum=2.0):
    """Perdesi dusen alcak sinus (tok govde); doyum telefonda duyulan harmonikleri ekler."""
    t = t_ax(sure)
    f = f1 * (f2 / f1) ** np.clip(t / (sonum * 1.5), 0, 1)
    y = np.sin(TP * np.cumsum(f) / SR) * np.exp(-t / sonum) * (1 - np.exp(-t / 0.0015))
    return np.tanh(doyum * y) / np.tanh(doyum)


def gicirti(rng, f, rez, sure, genlik=None, sapma=0.08):
    """Takil-kay gicirtisi: perdesi f(t) olan itki dizisi + rezonatorler (tonlu, gurultusuz)."""
    n = int(round(sure * SR))
    f = np.broadcast_to(np.asarray(f, float), (n,))
    faz = np.cumsum(f * (1 + sapma * svf(rng.standard_normal(n), 30, 0.7))) / SR
    itki = np.zeros(n)
    idx = np.nonzero(np.diff(np.floor(faz)) > 0)[0] + 1
    itki[idx] = rng.uniform(0.6, 1.0, len(idx))
    y = sum(a * svf(itki, fr, q, "bp") for fr, q, a in rez)
    if genlik is not None:
        y *= genlik
    return y


def tonlu_motor(rng, f, sure, kismi=12, egim=0.9, parlak=1.0):
    """Yumusak benzinli motor: atesleme frekansinin harmonikleri + yavas titreme (tonlu)."""
    n = int(round(sure * SR))
    f = np.broadcast_to(np.asarray(f, float), (n,))
    faz = TP * np.cumsum(f) / SR
    y = np.zeros(n)
    for k in range(1, kismi + 1):
        y += np.sin(k * faz + rng.uniform(0, TP)) / k ** egim * (parlak if k > 4 else 1)
    am = 1 + 0.12 * svf(rng.standard_normal(n), 12, 0.7) / 0.1
    return y * np.clip(am, 0.6, 1.4)


def zarf(sure, noktalar):
    """Parcali dogrusal zarf: [(t, deger), ...]."""
    t = t_ax(sure)
    tt, vv = zip(*noktalar)
    return np.interp(t, tt, vv)


def oyun_ton(f1, f2, dur, vol, tip="sine", sure=None):
    """Oyundaki tone(): perde ustel f1->f2, kazanc vol'dan .0001'e ustel (dalga bant sinirli)."""
    sure = sure or dur + 0.03
    t = t_ax(sure)
    f = f1 * (max(f2, 20) / f1) ** np.clip(t / dur, 0, 1)
    faz = TP * np.cumsum(f) / SR
    if tip == "sine":
        y = np.sin(faz)
    elif tip == "triangle":
        y = sum((-1) ** ((k - 1) // 2) * np.sin(k * faz) / k ** 2 for k in range(1, 20, 2)) * 8 / np.pi ** 2
    else:  # square
        y = sum(np.sin(k * faz) / k for k in range(1, 26, 2) if k * f1 < 16000) * 4 / np.pi
    g = vol * (1e-4 / vol) ** np.clip(t / dur, 0, 1)
    g[t > dur] = 0
    g *= 1 - np.exp(-t / 0.002)
    return y * g


# ---------------------------------------------------------------- Daisy
def daisy_tek_ve_hatira():
    kismi_b = [(1, 1.0), (2, 0.55), (3, 0.42), (4, 0.16), (5, 0.12), (6, 0.05), (7, 0.04)]
    args = (830.6, kismi_b, 0.20, 0.13, 0.006, 0.03, 0.07, 0.12, 0.45, 0.16)
    tek = iki_bip(*args, parlak=6000, seed=12, adet=1)       # daisy-beep.wav'in ilk tonu, ayni tohum
    cift = iki_bip(*args, parlak=6000, seed=12)
    hat = fft_renk(np.concatenate([cift, np.zeros(SR)]), lambda f: butter_lp(f, 1400, 2))
    hat = yanki(hat, 1.8, 0.55, 0.05, 1800, 81)
    return tek, hat


def dizel_kayit():
    """Gercek dizel kaydi; 2,5 kHz ustu kisilir ki hizlaninca hisirti gibi suprulmesin."""
    return fft_renk(kaynak_mono("fs-dizel-rolanti.wav"), lambda f: butter_lp(f, 2500, 2))


def daisy_motor_hareket():
    x = dizel_kayit()[int(1.0 * SR):]
    sure = 3.0
    t = t_ax(sure)
    s = np.clip((t - 0.3) / 0.8, 0, 1)
    oran = 1.0 + 0.3 * s * s * (3 - 2 * s)
    y = hiz_degistir(x, oran, sure) * (0.8 + 0.2 * s)
    rng = np.random.default_rng(82)
    ekle(y, vurus(rng, [310, 720, 1350], [0.08, 0.05, 0.03], [1, 0.5, 0.25], 0.3) * 0.25, 0.32)  # vites
    return y


def daisy_durus():
    x = dizel_kayit()[int(5.0 * SR):]
    sure = 2.6
    t = t_ax(sure)
    s = np.clip(t / 1.0, 0, 1)
    oran = 1.3 - 0.3 * s * s * (3 - 2 * s)
    y = hiz_degistir(x, oran, sure) * (1.0 - 0.2 * s)
    rng = np.random.default_rng(83)
    fr = zarf(0.35, [(0, 1850), (0.35, 1790)])                     # minik fren cirlamasi (tonlu)
    ci = np.sin(TP * np.cumsum(fr) / SR) * zarf(0.35, [(0, 0), (0.05, 1), (0.25, 0.7), (0.35, 0)])
    ekle(y, ci * 0.06, 0.55)
    ekle(y, vurus(rng, [140, 330, 610], [0.12, 0.08, 0.05], [1, 0.5, 0.3], 0.4) * 0.35, 0.95)  # govde oturur
    return y


def daisy_son_kaldiris():
    x = dizel_kayit()[int(2.0 * SR):]
    sure = 7.0
    t = t_ax(sure)
    oran = zarf(sure, [(0, 1.0), (0.9, 1.35), (1.6, 1.22), (5.0, 1.25), (5.8, 1.0), (7, 1.0)])
    yuk = zarf(sure, [(0, 0.8), (0.9, 1.0), (1.6, 1.15), (5.0, 1.15), (5.8, 0.85), (7, 0.8)])
    y = hiz_degistir(x, oran, sure) * yuk
    rng = np.random.default_rng(84)
    # hidrolik pompa: tonlu inilti, yuk altinda perde yukselir
    fh = zarf(sure, [(0, 180), (1.6, 205), (5.0, 262), (5.8, 230), (7, 230)])
    faz = TP * np.cumsum(fh) / SR
    hid = (np.sin(faz) + 0.5 * np.sin(2 * faz) + 0.25 * np.sin(3 * faz)) * zarf(
        sure, [(0, 0), (1.2, 0), (1.8, 1), (5.0, 1), (5.7, 0), (7, 0)])
    y += hid * 0.05
    for k in range(13):                                              # vinc tamburu mandal tiklari
        ekle(y, vurus(rng, [1900, 3100], [0.02, 0.012], [1, 0.5], 0.06) * 0.07, 1.9 + k * 0.24)
    ekle(y, vurus(rng, [160, 380, 700], [0.15, 0.1, 0.06], [1, 0.5, 0.3], 0.5) * 0.3, 5.75)  # yuk oturur
    return y


def daisy_siperlik(iner=True):
    rng = np.random.default_rng(85 if iner else 86)
    sure = 0.9
    y = buf(sure)
    f = zarf(0.6, [(0, 115), (0.6, 88)] if iner else [(0, 92), (0.6, 112)])
    faz = TP * np.cumsum(f) / SR
    nefes = (np.sin(faz) + 0.4 * np.sin(2 * faz) + 0.2 * np.sin(3 * faz)) * np.sin(np.pi * t_ax(0.6) / 0.6) ** 2
    ekle(y, nefes * (0.5 if iner else 0.25), 0.02)                   # hidrolik "ic cekis" (tonlu)
    ekle(y, vurus(rng, [2200, 3600, 5300], [0.03, 0.02, 0.012], [1, 0.5, 0.25], 0.1) * 0.4,
         0.6 if iner else 0.03)                                      # kucuk metal tik
    return y


def kanca_zincir():
    rng = np.random.default_rng(87)
    sure = 1.6
    y = buf(sure)
    tt = 0.02
    for k in range(9):
        f0 = rng.uniform(2300, 3000)
        ekle(y, vurus(rng, [f0, f0 * 1.62, f0 * 2.31], [0.05, 0.03, 0.02], [1, 0.5, 0.3], 0.1)
             * 0.5 * math.exp(-k / 4), tt)
        tt += rng.uniform(0.07, 0.16) * (1 + k * 0.08)
    return yanki(y, 0.4, 0.12, 0.012, 5000, 87)


# ---------------------------------------------------------------- kapilar, posta kutusu
def kapi_kolu_kilitli(seed):
    rng = np.random.default_rng(seed)
    y = buf(0.7)
    tt = 0.01
    for k in range(rng.integers(3, 5)):
        ekle(y, vurus(rng, [1750, 2900, 4300], [0.035, 0.02, 0.012], [1, 0.6, 0.3], 0.08) * 0.6, tt)
        ekle(y, vurus(rng, [120, 260, 450], [0.06, 0.04, 0.03], [1, 0.5, 0.3], 0.1, tet=0.1) * 0.6, tt + 0.004)
        tt += rng.uniform(0.07, 0.11)
    return yanki(y, 0.35, 0.15, 0.01, 4000, seed)


def kapi_gicirti():
    rng = np.random.default_rng(91)
    sure = 1.0
    ekle_t = 0.02
    f = zarf(0.8, [(0, 45), (0.15, 110), (0.45, 75), (0.8, 55)])
    g = zarf(0.8, [(0, 0), (0.06, 1), (0.6, 0.8), (0.8, 0)])
    y = buf(sure)
    ekle(y, gicirti(rng, f, [(620, 7, 1.0), (1150, 8, 0.6), (1900, 9, 0.35)], 0.8, g), ekle_t)
    return yanki(y, 0.5, 0.2, 0.012, 4000, 91)


def kapi_kapanis():
    rng = np.random.default_rng(92)
    y = buf(0.9)
    ekle(y, vurus(rng, [88, 176, 395, 760], [0.18, 0.12, 0.07, 0.04], [1, 0.6, 0.35, 0.2], 0.6, tet=0.15), 0.01)
    ekle(y, gumle(95, 70, 0.05, 0.3) * 0.5, 0.01)
    ekle(y, vurus(rng, [2100, 3500], [0.02, 0.012], [1, 0.5], 0.06) * 0.35, 0.03)    # dil yuvaya girer
    ekle(y, vurus(rng, [2400, 3900], [0.015, 0.01], [1, 0.5], 0.05) * 0.25, 0.07)
    return yanki(y, 0.6, 0.22, 0.015, 3500, 92)


def posta_kapagi():
    rng = np.random.default_rng(93)
    y = buf(0.9)
    f = zarf(0.25, [(0, 260), (0.25, 420)])
    ekle(y, gicirti(rng, f, [(1500, 12, 1.0), (2800, 14, 0.5)], 0.25,
                    zarf(0.25, [(0, 0), (0.04, 1), (0.25, 0)])) * 0.25, 0.01)   # mentese
    ekle(y, vurus(rng, [610, 1480, 2550, 3900], [0.3, 0.18, 0.1, 0.06], [1, 0.6, 0.4, 0.2], 0.6), 0.27)
    return yanki(y, 0.35, 0.12, 0.01, 5000, 93)


def posta_zarf_dusme():
    rng = np.random.default_rng(94)
    y = buf(0.7)
    ekle(y, kesit("fs-kagit-hisirti.wav", 1.05, 0.12, 0.003, 0.06) * 0.35, 0.0)
    ekle(y, vurus(rng, [175, 420, 890, 1450], [0.14, 0.09, 0.06, 0.04], [1, 0.6, 0.35, 0.15], 0.5, tet=0.05), 0.07)
    return y


# ---------------------------------------------------------------- adimlar
_ADIM = {"toprak": ["Fantozzi-SandL1", "Fantozzi-SandR1", "Fantozzi-SandL2", "Fantozzi-SandR2"],
         "cakil": ["Fantozzi-StoneL1", "Fantozzi-StoneR1", "Fantozzi-StoneL2", "Fantozzi-StoneR2"]}


def adim_kayit(zemin, i):
    x = kaynak_mono(f"fantozzi/{_ADIM[zemin][i]}.wav").copy()
    x = svf(x, 60, 0.707, "hp")
    return x / np.max(np.abs(x))


def adim_dizi(zemin, adet, ara=0.44):
    y = buf(ara * (adet - 1) + 0.6)
    for i in range(adet):
        ekle(y, adim_kayit(zemin, i % 4) * (1.0, 0.85, 0.95, 0.8)[i % 4], i * ara)
    return y


def adim_tahta(seed):
    rng = np.random.default_rng(seed)
    y = buf(0.5)
    ekle(y, gumle(115, 90, 0.04, 0.2) * 0.7, 0.0)                     # topuk
    ekle(y, vurus(rng, [215, 540, 980, 1700], [0.07, 0.05, 0.03, 0.02], [1, 0.6, 0.35, 0.15], 0.3, tet=0.12) * 0.6, 0.0)
    ekle(y, vurus(rng, [260, 610, 1150], [0.05, 0.03, 0.02], [1, 0.5, 0.2], 0.2) * 0.3, 0.07)   # burun
    g = zarf(0.2, [(0, 0), (0.03, 1), (0.2, 0)])
    ekle(y, gicirti(rng, zarf(0.2, [(0, 70), (0.2, 95)]), [(480, 8, 1), (900, 8, 0.5)], 0.2, g) * 0.04, 0.09)
    return yanki(y, 0.45, 0.15, 0.01, 4000, seed)


# ---------------------------------------------------------------- kagit, kalem (gercek kayit)
def kagit_kesitleri():
    k = "fs-kagit-hisirti.wav"
    rng = np.random.default_rng(95)
    masa = kesit(k, 5.4, 0.25, 0.01, 0.08) * 0.6
    ekle(masa, vurus(rng, [190, 450, 900], [0.04, 0.025, 0.015], [1, 0.5, 0.25], 0.08, tet=0.1) * 0.5, 0.16)
    takvim_otur = buf(0.35)
    ekle(takvim_otur, kesit(k, 3.3, 0.18, 0.01, 0.08) * 0.5, 0.0)
    ekle(takvim_otur, vurus(rng, [240, 560, 1050], [0.04, 0.025, 0.015], [1, 0.5, 0.2], 0.1, tet=0.1) * 0.6, 0.12)
    cep = kesit(k, 2.0, 0.35, 0.02, 0.12) * 0.7
    ekle(cep, gumle(130, 100, 0.03, 0.12) * 0.35, 0.22)
    return {
        "zarf-cekme.wav": kesit(k, 0.95, 0.6, 0.02, 0.12),
        "mektup-acma.wav": kesit(k, 6.15, 0.85, 0.02, 0.15),
        "kagit-rulo.wav": kesit(k, 8.6, 0.8, 0.03, 0.15),
        "takvim-kavra.wav": kesit(k, 4.2, 0.35, 0.01, 0.1),
        "takvim-oturma.wav": takvim_otur,
        "kagit-masaya.wav": masa,
        "liste-cebe.wav": cep,
        "kalem-satir.wav": kesit("fs-kalem-karalama.wav", 5.1, 0.8, 0.02, 0.1),
    }


def kalem_tink():
    """miks.py '@tink' ile ayni: P1 halat tinkinin kismileri (P9 mavi murekkep)."""
    t = t_ax(0.6)
    y = sum(a * np.sin(TP * f * t) * np.exp(-t / d) for f, d, a in
            [(3120, 0.30, 1.0), (4870, 0.16, 0.4), (7010, 0.08, 0.2)])
    return y * (1 - np.exp(-t / 0.002))


# ---------------------------------------------------------------- dokunus, kumas, para
def parmak_dokunus():
    rng = np.random.default_rng(101)
    y = buf(0.3)
    ekle(y, vurus(rng, [185, 430, 900], [0.03, 0.02, 0.012], [1, 0.4, 0.15], 0.15, tet=0.05), 0.005)
    ekle(y, vurus(rng, [2600, 4100], [0.006, 0.004], [1, 0.4], 0.03, tet=0) * 0.15, 0.005)
    return y


def kumas_pat(adet=1, ara=0.25, seed=102):
    rng = np.random.default_rng(seed)
    y = buf(ara * (adet - 1) + 0.35)
    for i in range(adet):
        p = gumle(125 - 10 * i, 92, 0.035, 0.2)
        n = svf(tetik(rng, 0.006, 600), 900, 0.7)
        p[:len(n)] += 0.4 * n / np.max(np.abs(n))                    # kumas temasi (6 ms)
        ekle(y, p * (1 - 0.15 * i), i * ara)
    return y


def telefon_cebe():
    rng = np.random.default_rng(103)
    y = buf(0.5)
    ekle(y, kumas_pat(1, seed=103) * 0.6, 0.0)
    ekle(y, gumle(105, 85, 0.04, 0.2) * 0.5, 0.16)
    ekle(y, vurus(rng, [1900, 3000], [0.01, 0.006], [1, 0.4], 0.03) * 0.08, 0.17)   # telefon cebe oturur
    return y


def sapka_cikarma():
    rng = np.random.default_rng(104)
    y = buf(0.6)
    ekle(y, gumle(140, 110, 0.03, 0.15) * 0.4, 0.0)                    # kece sapka kalkar
    n = svf(tetik(rng, 0.008, 500), 700, 0.7)
    ekle(y, n / np.max(np.abs(n)) * 0.2, 0.0)
    ekle(y, gumle(100, 80, 0.05, 0.25) * 0.6, 0.22)                   # sapka dizine/gogsune iner
    return y


def para_fit(rng, k=1.0):
    f0 = 2100 * rng.uniform(0.94, 1.06)
    p = vurus(rng, [f0, f0 * 1.58, f0 * 2.47], [0.012, 0.008, 0.005], [1, 0.6, 0.35], 0.06, tet=0.35, tet_fc=6000)
    p += 0.25 * np.pad(gumle(240, 180, 0.012, 0.04), (0, int(0.02 * SR)))  # kagidin kucuk govdesi
    return p * k


def para_sayma(adet):
    rng = np.random.default_rng(105)
    y = buf(0.2 * (adet - 1) + 0.15)
    for i in range(adet):
        ekle(y, para_fit(rng, rng.uniform(0.8, 1.0)), 0.005 + i * 0.2)
    return y


# ---------------------------------------------------------------- araba, lastik
def araba_yaklasma_durma():
    rng = np.random.default_rng(111)
    sure = 3.4
    f = zarf(sure, [(0, 46), (1.6, 34), (2.3, 26), (2.75, 26), (3.1, 14), (3.4, 12)])
    g = zarf(sure, [(0, 0), (0.4, 0.25), (2.0, 0.85), (2.35, 1.0), (2.75, 0.9), (3.2, 0), (3.4, 0)])
    m = tonlu_motor(rng, f, sure, egim=1.0)
    y = fft_renk(np.concatenate([m * g, np.zeros(SR // 2)]), lambda fr: butter_lp(fr, 1600, 2) * butter_hp(fr, 50, 2))
    ekle(y, vurus(rng, [95, 210, 420], [0.12, 0.08, 0.05], [1, 0.5, 0.25], 0.4, tet=0.05) * 0.3, 2.4)  # yaylanma
    return y


def araba_yaylanma():
    rng = np.random.default_rng(112)
    y = buf(1.2)
    for i, tt in enumerate([0.0, 0.33, 0.6]):
        ekle(y, gumle(85, 70, 0.07, 0.3) * (0.7 ** i), tt)
        g = zarf(0.25, [(0, 0), (0.05, 1), (0.25, 0)])
        ekle(y, gicirti(rng, zarf(0.25, [(0, 55), (0.25, 75)]), [(420, 8, 1), (880, 9, 0.5)], 0.25, g) * 0.1 * 0.6 ** i, tt + 0.02)
    return y


def araba_kapi(kapanis=True):
    rng = np.random.default_rng(113 if kapanis else 114)
    y = buf(0.8)
    if kapanis:
        ekle(y, vurus(rng, [72, 145, 262, 520, 940], [0.14, 0.1, 0.07, 0.05, 0.03], [1, 0.7, 0.4, 0.25, 0.12], 0.5, tet=0.15), 0.005)
        ekle(y, gumle(80, 60, 0.05, 0.3) * 0.6, 0.005)
        ekle(y, vurus(rng, [1700, 2900], [0.025, 0.015], [1, 0.5], 0.06) * 0.25, 0.02)
    else:
        ekle(y, vurus(rng, [1500, 2600, 4000], [0.02, 0.012, 0.008], [1, 0.5, 0.25], 0.05) * 0.5, 0.005)  # kol
        ekle(y, vurus(rng, [1800, 3100], [0.02, 0.012], [1, 0.5], 0.05) * 0.45, 0.07)                       # kilit
        ekle(y, gumle(95, 80, 0.06, 0.3) * 0.5, 0.11)                                                       # conta ayrilir
    return yanki(y, 0.4, 0.12, 0.01, 4000, 113)


def araba_kalkis():
    rng = np.random.default_rng(115)
    sure = 4.6
    f = zarf(sure, [(0, 26), (0.3, 28), (1.4, 55), (1.6, 40), (2.6, 58), (4.6, 60)])
    g = zarf(sure, [(0, 0.6), (0.3, 0.9), (1.4, 1.0), (2.2, 0.7), (4.4, 0.05), (4.6, 0)])
    m = tonlu_motor(rng, f, sure, egim=0.9) * g
    m = fft_renk(np.concatenate([m, np.zeros(SR // 2)]), lambda fr: butter_lp(fr, 1700, 2) * butter_hp(fr, 50, 2))
    for i in range(4):                                               # lastik altinda birkac cakil
        ekle(m, adim_kayit("cakil", i) * 0.12, 0.25 + i * 0.13)
    return m


def lastik_yuvarlanma():
    rng = np.random.default_rng(116)
    y = buf(2.2)
    tt, ara = 0.0, 0.26
    while tt < 1.9:
        ekle(y, gumle(rng.uniform(90, 105), 80, 0.05, 0.25) * 0.6
             + 0.4 * vurus(rng, [190, 380], [0.05, 0.03], [1, 0.4], 0.25, tet=0.05), tt)
        tt += ara
        ara *= 1.06
    return y


def lastik_oturma():
    rng = np.random.default_rng(117)
    y = buf(1.5)
    tt, ara, g = 0.0, 0.22, 1.0
    for k in range(9):                                               # yalpalama: hizlanan, sonen vuruslar
        ekle(y, (gumle(98, 80, 0.04, 0.2) * 0.6 + 0.4 * vurus(rng, [200, 410], [0.04, 0.025], [1, 0.4], 0.2, tet=0.03)) * g, tt)
        tt += ara
        ara *= 0.72
        g *= 0.8
    ekle(y, gumle(85, 65, 0.09, 0.4) * 0.8, tt + 0.03)               # yere oturur
    return y


# ---------------------------------------------------------------- kucuk tiklar, masa
def telefon_dokunus():
    """Oyundaki SFX.place: 1200 Hz kare, 50 ms (bant sinirli, biraz yumusak) + parmak."""
    rng = np.random.default_rng(121)
    y = buf(0.15)
    ekle(y, svf(svf(oyun_ton(1200, 1200, 0.05, 0.6, "square"), 5000), 5000), 0.004)
    ekle(y, vurus(rng, [220, 520], [0.015, 0.01], [1, 0.4], 0.05, tet=0.05) * 0.3, 0.0)
    return y


def kucuk_tik(seed, frek, sonum, govde=None):
    rng = np.random.default_rng(seed)
    y = buf(0.25)
    ekle(y, vurus(rng, frek, sonum, [1, 0.5, 0.25][:len(frek)], 0.1, tet=0.2), 0.003)
    if govde:
        ekle(y, vurus(rng, govde, [0.025, 0.015], [1, 0.4], 0.1, tet=0) * 0.5, 0.003)
    return y


def lamba_dugme():
    rng = np.random.default_rng(122)
    y = buf(0.3)
    ekle(y, vurus(rng, [2600, 4100, 6000], [0.008, 0.006, 0.004], [1, 0.5, 0.25], 0.05, tet=0.2) * 0.4, 0.003)  # bas
    ekle(y, vurus(rng, [2300, 3700, 5400], [0.015, 0.01, 0.006], [1, 0.5, 0.25], 0.08, tet=0.3), 0.045)       # sap
    ekle(y, vurus(rng, [880, 1520], [0.025, 0.015], [1, 0.4], 0.08, tet=0) * 0.4, 0.045)
    return y


def tutam_boing():
    t = t_ax(0.45)
    f = 420 * (1 + 0.07 * np.sin(TP * 9 * t) * np.exp(-t / 0.18))
    faz = TP * np.cumsum(f) / SR
    return (np.sin(faz) + 0.2 * np.sin(2 * faz)) * np.exp(-t / 0.12) * (1 - np.exp(-t / 0.004))


def sandalye():
    rng = np.random.default_rng(123)
    y = buf(1.0)
    g = zarf(0.3, [(0, 0), (0.05, 1), (0.3, 0)])
    ekle(y, gicirti(rng, zarf(0.3, [(0, 60), (0.3, 85)]), [(520, 7, 1), (980, 8, 0.5)], 0.3, g) * 0.25, 0.0)
    ekle(y, vurus(rng, [170, 430, 860, 1500], [0.08, 0.05, 0.03, 0.02], [1, 0.6, 0.3, 0.15], 0.3, tet=0.12), 0.3)
    ekle(y, vurus(rng, [190, 470, 920], [0.07, 0.045, 0.03], [1, 0.5, 0.25], 0.3, tet=0.12) * 0.7, 0.36)
    return yanki(y, 0.45, 0.15, 0.01, 4000, 123)


def masa_koyma():
    rng = np.random.default_rng(124)
    y = buf(0.9)
    ekle(y, vurus(rng, [72, 150, 330, 610, 1050], [0.2, 0.14, 0.09, 0.05, 0.03], [1, 0.7, 0.45, 0.25, 0.12], 0.6, tet=0.12), 0.005)
    ekle(y, gumle(85, 62, 0.07, 0.35) * 0.6, 0.005)
    ekle(y, vurus(rng, [160, 360, 700], [0.08, 0.05, 0.03], [1, 0.5, 0.25], 0.3, tet=0.1) * 0.45, 0.06)  # ikinci ayak
    return yanki(y, 0.5, 0.15, 0.01, 3500, 124)


def kutu_koyma():
    rng = np.random.default_rng(125)
    y = buf(0.6)
    ekle(y, vurus(rng, [128, 255, 510, 880], [0.08, 0.05, 0.03, 0.02], [1, 0.6, 0.3, 0.15], 0.3, tet=0.1), 0.005)
    ekle(y, gumle(110, 85, 0.04, 0.2) * 0.5, 0.005)
    return yanki(y, 0.4, 0.12, 0.01, 4000, 125)


def cay_bardagi():
    rng = np.random.default_rng(126)
    y = buf(1.2)
    ekle(y, vurus(rng, [2950, 5150, 7600], [0.45, 0.25, 0.12], [1, 0.45, 0.2], 0.9, tet=0.15) * 0.5, 0.005)
    ekle(y, vurus(rng, [180, 420], [0.03, 0.02], [1, 0.4], 0.1, tet=0.05) * 0.4, 0.005)      # tabak
    ekle(y, vurus(rng, [2990, 5190, 7650], [0.3, 0.18, 0.1], [1, 0.4, 0.2], 0.7, tet=0.1) * 0.2, 0.09)
    return y


def karton_bardak():
    rng = np.random.default_rng(127)
    y = buf(0.4)
    ekle(y, vurus(rng, [310, 720, 1300], [0.03, 0.02, 0.012], [1, 0.5, 0.25], 0.15, tet=0.1), 0.005)
    ekle(y, gumle(140, 110, 0.03, 0.12) * 0.5, 0.005)
    return y


# ---------------------------------------------------------------- oyun (Demolition Master tinisi)
def oyun_sesleri():
    rng = np.random.default_rng(131)
    timesup = buf(0.7)                                              # SFX.fail
    for i, f in enumerate([392, 330, 262]):
        ekle(timesup, oyun_ton(f, f * 0.97, 0.25, 0.7, "triangle"), i * 0.16)
    demolished = buf(0.8)                                           # SFX.fanfare + coin
    for i, f in enumerate([523, 659, 784, 1047]):
        ekle(demolished, oyun_ton(f, f, 0.22, 0.8, "triangle"), i * 0.11)
    ekle(demolished, oyun_ton(1320, 1760, 0.12, 0.7, "triangle"), 0.44)
    kart = buf(0.3)                                                 # SFX.coin
    ekle(kart, oyun_ton(1320, 1760, 0.12, 0.7, "triangle"), 0.0)
    kepenk = buf(0.5)                                               # sfxClose kepengi: tonlu tikirti dizisi (28 Hz)
    for k in range(10):
        ekle(kepenk, vurus(rng, [1700, 2650], [0.012, 0.008], [1, 0.4], 0.03, tet=0.05)
             * math.sin(np.pi * (k + 0.5) / 10), 0.005 + k / 28)
    return {"oyun-timesup.wav": timesup, "oyun-demolished.wav": demolished,
            "oyun-kart.wav": kart, "oyun-kepenk.wav": kepenk}


# ---------------------------------------------------------------- yikim (hafif, tonlu)
def su_kulesi_darbe():
    rng = np.random.default_rng(141)
    y = buf(2.6)
    ekle(y, vurus(rng, [212, 538, 1021, 1634, 2398], [1.2, 0.8, 0.5, 0.35, 0.25], [1, 0.7, 0.5, 0.3, 0.18], 2.4, tet=0.2), 0.01)
    ekle(y, gumle(72, 45, 0.12, 0.6) * 1.2, 0.01)
    return yanki(y, 0.7, 0.18, 0.025, 3500, 141)


def beton_parca(rng, k=1.0):
    f0 = rng.uniform(650, 1350)
    p = vurus(rng, [f0, f0 * 2.31, f0 * 3.92], [0.035, 0.02, 0.012], [1, 0.5, 0.25], 0.12, tet=0.2)
    if rng.random() < 0.35:
        p += np.pad(gumle(rng.uniform(120, 170), 90, 0.03, 0.08), (0, int(0.04 * SR))) * 0.8
    return p * k


def beton_parcalari(sure=1.8, seed=142, yogunluk=22):
    rng = np.random.default_rng(seed)
    y = buf(sure + 0.2)
    tt = 0.0
    while tt < sure:
        k = math.exp(-2.5 * tt / sure)
        ekle(y, beton_parca(rng, rng.uniform(0.3, 1.0) * k), tt)
        tt += rng.exponential(1 / (yogunluk * (0.2 + k)))
    return y


def su_kulesi_yere():
    rng = np.random.default_rng(143)
    y = buf(3.2)
    ekle(y, gumle(60, 36, 0.35, 1.4) * 1.3, 0.01)
    ekle(y, vurus(rng, [96, 181, 312, 468, 731, 1090], [0.7, 0.55, 0.4, 0.3, 0.2, 0.14],
                  [1, 0.8, 0.6, 0.4, 0.25, 0.15], 2.0, tet=0.25), 0.01)    # bos tank govdesi
    ekle(y, beton_parcalari(1.4, 144, 18) * 0.35, 0.08)
    return yanki(y, 0.8, 0.2, 0.03, 3000, 143)


def kule_egilme():
    rng = np.random.default_rng(145)
    sure = 1.4
    g = zarf(sure, [(0, 0), (0.3, 0.6), (1.1, 1.0), (1.4, 0)])
    y = gicirti(rng, zarf(sure, [(0, 28), (1.4, 52)]), [(180, 10, 1), (420, 12, 0.6), (760, 12, 0.3)], sure, g)
    return yanki(y, 0.6, 0.2, 0.02, 3000, 145)


def siva_catlak():
    rng = np.random.default_rng(146)
    y = buf(0.9)
    tt = 0.0
    for k in range(9):
        f0 = rng.uniform(2500, 5000)
        ekle(y, vurus(rng, [f0, f0 * 1.7], [0.008, 0.005], [1, 0.4], 0.03, tet=0.3) * rng.uniform(0.3, 1) * math.exp(-k / 6), tt)
        tt += rng.uniform(0.03, 0.12)
    for k in range(4):                                               # dusen zerreler: minik tink
        f0 = rng.uniform(3500, 6000)
        ekle(y, vurus(rng, [f0], [0.01], [1], 0.03, tet=0) * 0.12, 0.35 + k * rng.uniform(0.06, 0.12))
    return y


def duduk_uzak():
    t = t_ax(0.5)
    f = 2850 * (1 + 0.012 * np.sin(TP * 34 * t))                     # bilyeli duduk titresimi
    faz = TP * np.cumsum(f) / SR
    g = zarf(0.5, [(0, 0), (0.025, 1), (0.42, 0.9), (0.5, 0)]) * (1 + 0.25 * np.sin(TP * 34 * t))
    y = (np.sin(faz) + 0.15 * np.sin(2 * faz)) * g
    y = fft_renk(np.concatenate([y, np.zeros(SR // 4)]), lambda fr: butter_lp(fr, 3500, 2))
    return yanki(y, 1.4, 0.5, 0.06, 2500, 147)


def kule_inis():
    """40 kat yavasca oturur: kat kat tonlu vuruslar + derin, dalgalanan tonlu gumburtu; suprume yok."""
    rng = np.random.default_rng(148)
    sure = 11.0
    t = t_ax(sure)
    y = buf(sure)
    tt, ara, k = 0.5, 0.26, 0
    while tt < 6.4:                                                  # kat kat
        g = 0.35 + 0.65 * min(1, (tt - 0.5) / 4)
        ekle(y, gumle(rng.uniform(55, 72), 40, 0.18, 0.7) * g * 0.6, tt)
        f0 = rng.uniform(280, 420)
        ekle(y, vurus(rng, [f0, f0 * 2.2], [0.06, 0.04], [1, 0.4], 0.2, tet=0.1) * g * 0.25, tt)
        tt += ara
        ara = max(0.12, ara * 0.95)
        k += 1
    ekle(y, gumle(50, 30, 1.0, 3.5, 1.5) * 1.3, 6.7)                 # son oturma
    gov = np.zeros(len(t))                                           # derin govde: alcak kismi sesler
    for f, a in [(41, 1.0), (55, 0.8), (62, 0.6), (82, 0.5), (110, 0.35), (123, 0.25), (165, 0.15)]:
        am = 0.6 + 0.4 * np.sin(TP * rng.uniform(0.3, 1.1) * t + rng.uniform(0, TP))
        gov += a * np.sin(TP * f * t + rng.uniform(0, TP)) * am
    gov = np.tanh(1.5 * gov / 2) * zarf(sure, [(0, 0), (1.0, 0.25), (6.4, 1.0), (7.2, 1.0), (10.6, 0), (11, 0)])
    y += gov * 0.5
    ekle(y, beton_parcalari(3.0, 149, 10) * 0.12, 6.8)
    y = fft_renk(y, lambda fr: butter_lp(fr, 2200, 2))               # uzaktan izleniyor
    return yanki(y, 1.5, 0.25, 0.05, 1500, 148)


def teneke_kapak():
    rng = np.random.default_rng(151)
    y = buf(1.6)
    for tt in (0.0, 0.14):                                           # tirnakla zorlama
        ekle(y, vurus(rng, [3300, 5200], [0.01, 0.006], [1, 0.4], 0.04, tet=0.2) * 0.25, tt)
    ekle(y, vurus(rng, [1120, 2480, 3900, 5600], [0.25, 0.15, 0.09, 0.05], [1, 0.6, 0.35, 0.2], 0.5, tet=0.2), 0.3)  # pop
    tt, ara, g = 0.6, 0.16, 0.5
    for k in range(7):                                               # kapak yere konur, yalpalar
        ekle(y, vurus(rng, [1050, 2350, 3700], [0.08, 0.05, 0.03], [1, 0.5, 0.25], 0.15, tet=0.1) * g, tt)
        tt += ara
        ara *= 0.7
        g *= 0.75
    return yanki(y, 0.4, 0.1, 0.01, 5000, 151)


def tas_kaldirma():
    rng = np.random.default_rng(152)
    y = buf(1.5)
    ekle(y, vurus(rng, [360, 830, 1520], [0.04, 0.025, 0.015], [1, 0.5, 0.25], 0.15, tet=0.15) * 0.6, 0.0)  # tas oynar
    for k in range(3):
        ekle(y, beton_parca(rng, 0.15), 0.08 + k * 0.07)
    ekle(y, adim_kayit("toprak", 2) * 0.25, 0.12)                    # topraktan ayrilir (gercek kayit)
    ekle(y, gumle(120, 85, 0.06, 0.3) * 0.6, 0.95)                    # yana konur
    ekle(y, vurus(rng, [340, 790, 1460], [0.05, 0.03, 0.02], [1, 0.5, 0.25], 0.2, tet=0.12) * 0.5, 0.95)
    return y


# ---------------------------------------------------------------- ortamlar (dongu)
def dongu_yerlestir(y, parca, tt):
    n = len(y)
    idx = (int(tt * SR) + np.arange(len(parca))) % n
    np.add.at(y, idx, parca)


def yagmur_kabin():
    """Kabin cati sacina damlalar: her damla tonlu bir ping (duz gurultu yok); 12 sn dongu."""
    rng = np.random.default_rng(161)
    sure = 12.0
    y = buf(sure)
    tt = 0.0
    while tt < sure:
        yog = 0.75 + 0.25 * math.sin(TP * tt / sure)                 # dongu boyu periyodik yogunluk
        f0 = math.exp(rng.uniform(math.log(1700), math.log(4200)))
        a = rng.lognormal(-1.2, 0.6)
        p = modal([f0, f0 * 1.53], [rng.uniform(0.012, 0.035), 0.01], [1, 0.3], 0.06) * (1 - np.exp(-t_ax(0.06) / 0.0005))
        if rng.random() < 0.3:
            p += np.pad(gumle(rng.uniform(230, 380), 200, 0.02, 0.05, 1.0), (0, int(0.01 * SR))) * 0.6
        dongu_yerlestir(y, p * a, tt)
        tt += rng.exponential(1 / (16 * yog))
    for k in range(int(sure / 0.75)):                                # oluktan duzenli damla: "blup"
        tb = t_ax(0.09)
        fb = 950 * (1.6 ** np.clip(tb / 0.02, 0, 1))
        bl = np.sin(TP * np.cumsum(fb) / SR) * np.exp(-tb / 0.03) * (1 - np.exp(-tb / 0.001))
        dongu_yerlestir(y, bl * 0.25, k * 0.75 + 0.3)
    return fft_renk(y, lambda fr: butter_lp(fr, 4500, 1))            # kabin icinden


def kabin_cami_damla():
    rng = np.random.default_rng(162)
    y = buf(0.4)
    ekle(y, vurus(rng, [3200, 5400], [0.008, 0.005], [1, 0.4], 0.03, tet=0.1) * 0.4, 0.003)
    tb = t_ax(0.12)
    fb = 1100 * (1.55 ** np.clip(tb / 0.025, 0, 1))
    ekle(y, np.sin(TP * np.cumsum(fb) / SR) * np.exp(-tb / 0.035) * (1 - np.exp(-tb / 0.001)), 0.006)
    return y


def oda_tonu():
    """Bekleme salonu: 50 Hz sebekenin 100 Hz ugultusu + havalandirma tonlari; 10 sn dongu (tam devir)."""
    sure = 10.0
    t = t_ax(sure)
    y = np.zeros(len(t))
    for f, a in [(100, 1.0), (200, 0.35), (300, 0.2), (400, 0.08), (178.3, 0.25), (247.1, 0.15)]:
        y += a * np.sin(TP * f * t) * (1 + 0.15 * np.sin(TP * 0.3 * t + f))
    return y


def numarator_ding():
    rng = np.random.default_rng(163)
    y = vurus(rng, [1318.5, 2637, 3955, 3620], [1.4, 0.7, 0.4, 0.3], [1, 0.3, 0.12, 0.08], 1.8, tet=0.05, sapma=0)
    return yanki(y, 1.0, 0.18, 0.02, 4000, 163)


def saat_tiktak():
    rng = np.random.default_rng(164)
    sure = 4.0
    y = buf(sure)
    for k in range(4):
        fr = [3100, 4700] if k % 2 == 0 else [2750, 4150]
        p = vurus(rng, fr, [0.008, 0.005], [1, 0.4], 0.05, tet=0.2) + 0.4 * vurus(rng, [900], [0.02], [1], 0.05, tet=0)
        dongu_yerlestir(y, p, 0.05 + k)
    return y


def sehir_uzak():
    """Kule tahliyesi, uzak sehir: CC0 kus kesiti (inceltilmis) + uzak trafik tonlari + iki uzak korna; 20 sn dongu."""
    rng = np.random.default_rng(165)
    kus = oku_kaynak("park_ambience_birds_138-162s.wav")[2 * SR:].mean(axis=1)
    L, X = 20 * SR, 2 * SR
    kus = fft_renk(kus, lambda f: butter_hp(f, 500, 2)) * 0.45
    a, b = kus[:L].copy(), kus[L:L + X]
    w = np.sin(0.5 * np.pi * np.arange(X) / X)
    a[:X] = a[:X] * w + b * np.sqrt(1 - w ** 2)
    t = t_ax(20)
    trafik = np.zeros(L)
    for f in (63.1, 71.4, 84.2, 97.6, 126.3, 142.8):                 # 20 sn'de tam devir icin 0,05 Hz katlari
        f = round(f * 20) / 20
        am = 0.55 + 0.45 * np.sin(TP * round(rng.uniform(0.1, 0.4) * 20) / 20 * t + rng.uniform(0, TP))
        trafik += np.sin(TP * f * t + rng.uniform(0, TP)) * am
    y = a + trafik * 0.004
    for tt, (f1, f2) in [(6.3, (392, 494)), (14.8, (440, 554))]:     # uzak korna (tonlu, yumusak)
        tk = t_ax(0.35)
        k = sum(np.sin(TP * f * tk) + 0.3 * np.sin(TP * 2 * f * tk) for f in (f1, f2))
        k *= zarf(0.35, [(0, 0), (0.03, 1), (0.3, 1), (0.35, 0)])
        k = yanki(fft_renk(np.pad(k, (0, SR // 4)), lambda fr: butter_lp(fr, 900, 2)), 1.2, 0.6, 0.08, 1200, 166)
        dongu_yerlestir(y, k * 0.01, tt)
    return np.stack([y, np.roll(y, 480)], 1)                          # 10 ms kaydirma: hafif genislik


# ---------------------------------------------------------------- yeni kitaplik
def yeni_kitaplik():
    print("2-10. bolum kitapligi ->", SFX)
    tek, hat = daisy_tek_ve_hatira()
    yaz("daisy-beep-tek.wav", bitir(tek))
    yaz("daisy-beep-hatira.wav", bitir(hat, -9, sol_son=0.4))
    yaz("daisy-motor-hareket.wav", bitir(daisy_motor_hareket(), sol_bas=0.12, sol_son=0.2))
    yaz("daisy-durus.wav", bitir(daisy_durus(), sol_bas=0.05, sol_son=0.6))
    yaz("daisy-son-kaldiris.wav", bitir(daisy_son_kaldiris(), sol_bas=0.15, sol_son=0.8))
    yaz("daisy-siperlik-iner.wav", bitir(daisy_siperlik(True)))
    yaz("daisy-siperlik-kalkar.wav", bitir(daisy_siperlik(False)))
    yaz("kanca-zincir.wav", bitir(kanca_zincir()))
    yaz("kapi-kolu-kilitli-1.wav", bitir(kapi_kolu_kilitli(171)))
    yaz("kapi-kolu-kilitli-2.wav", bitir(kapi_kolu_kilitli(172)))
    yaz("kapi-gicirti.wav", bitir(kapi_gicirti()))
    yaz("kapi-kapanis.wav", bitir(kapi_kapanis()))
    yaz("posta-kapagi.wav", bitir(posta_kapagi()))
    yaz("posta-zarf-dusme.wav", bitir(posta_zarf_dusme()))
    yaz("adim-toprak-tek.wav", bitir(adim_dizi("toprak", 1)))
    yaz("adim-toprak-4.wav", bitir(adim_dizi("toprak", 4)))
    yaz("adim-cakil-tek.wav", bitir(adim_dizi("cakil", 1)))
    yaz("adim-cakil-4.wav", bitir(adim_dizi("cakil", 4, 0.5)))
    tah = buf(1.1)
    ekle(tah, adim_tahta(173), 0.0)
    ekle(tah, adim_tahta(174) * 0.9, 0.5)
    yaz("adim-tahta-tek.wav", bitir(adim_tahta(173)))
    yaz("adim-tahta-2.wav", bitir(tah))
    for ad, x in kagit_kesitleri().items():
        yaz(ad, bitir(x))
    yaz("kalem-tink.wav", bitir(kalem_tink(), sol_son=0.1))
    yaz("parmak-dokunus.wav", bitir(parmak_dokunus()))
    yaz("kumas-pat.wav", bitir(kumas_pat(1)))
    yaz("kumas-pat-2.wav", bitir(kumas_pat(2)))
    yaz("telefon-cebe.wav", bitir(telefon_cebe()))
    yaz("sapka-cikarma.wav", bitir(sapka_cikarma()))
    yaz("para-fit.wav", bitir(para_sayma(1)))
    yaz("para-sayma-7.wav", bitir(para_sayma(7)))
    yaz("araba-yaklasma-durma.wav", bitir(araba_yaklasma_durma(), sol_bas=0.05, sol_son=0.2))
    yaz("araba-yaylanma.wav", bitir(araba_yaylanma()))
    yaz("araba-kapi-acma.wav", bitir(araba_kapi(False)))
    yaz("araba-kapi-kapanis.wav", bitir(araba_kapi(True)))
    yaz("araba-kalkis.wav", bitir(araba_kalkis(), sol_bas=0.05, sol_son=0.3))
    yaz("lastik-yuvarlanma.wav", bitir(lastik_yuvarlanma()))
    yaz("lastik-oturma.wav", bitir(lastik_oturma()))
    yaz("telefon-dokunus.wav", bitir(telefon_dokunus(), sol_son=0.01))
    yaz("fener-tik.wav", bitir(kucuk_tik(181, [4200, 6100], [0.008, 0.005]), sol_son=0.02))
    yaz("kart-klips.wav", bitir(kucuk_tik(182, [3500, 5600, 8000], [0.02, 0.012, 0.006], [1200, 2100]), sol_son=0.02))
    yaz("lamba-dugme.wav", bitir(lamba_dugme(), sol_son=0.02))
    yaz("tutam-boing.wav", bitir(tutam_boing(), sol_son=0.05))
    yaz("sandalye.wav", bitir(sandalye()))
    yaz("masa-koyma.wav", bitir(masa_koyma()))
    yaz("kutu-koyma.wav", bitir(kutu_koyma()))
    yaz("cay-bardagi.wav", bitir(cay_bardagi(), sol_son=0.1))
    yaz("karton-bardak.wav", bitir(karton_bardak()))
    for ad, x in oyun_sesleri().items():
        yaz(ad, bitir(x, sol_son=0.02))
    yaz("su-kulesi-darbe.wav", bitir(dc_kes(su_kulesi_darbe(), 40), sol_son=0.3))
    yaz("su-kulesi-yere.wav", bitir(dc_kes(su_kulesi_yere(), 40), sol_son=0.4))
    yaz("kule-egilme.wav", bitir(kule_egilme(), sol_son=0.2))
    yaz("beton-parcalari.wav", bitir(beton_parcalari()))
    yaz("siva-catlak.wav", bitir(siva_catlak()))
    yaz("duduk-uzak.wav", bitir(duduk_uzak(), -6, sol_son=0.3))
    yaz("kule-inis.wav", bitir(dc_kes(kule_inis(), 30), sol_bas=0.05, sol_son=1.5))
    yaz("teneke-kapak.wav", bitir(teneke_kapak()))
    yaz("tas-kaldirma.wav", bitir(tas_kaldirma()))
    yaz("yagmur-kabin-dongu.wav", bitir(yagmur_kabin(), -12, 0.005, 0.005, dongu=True))
    yaz("kabin-cami-damla.wav", bitir(kabin_cami_damla(), sol_son=0.05))
    yaz("oda-tonu-dongu.wav", bitir(oda_tonu(), -18, 0.005, 0.005, dongu=True))
    yaz("numarator-ding.wav", bitir(numarator_ding(), -6, sol_son=0.3))
    yaz("saat-tiktak-dongu.wav", bitir(saat_tiktak(), -9, 0.005, 0.005, dongu=True))
    yaz("sehir-uzak-dongu.wav", bitir(sehir_uzak(), -12, 0.005, 0.005, dongu=True))


# ---------------------------------------------------------------- ana
def main():
    import sys
    if "--yalniz-yeni" not in sys.argv:
        pilot()
    if "--yalniz-pilot" not in sys.argv:
        yeni_kitaplik()


def pilot():
    print("Two Beeps sfx (1. bolum) uretiliyor ->", SFX)
    a, b, c, s = daisy_bipleri()
    yaz("daisy-beep-a-geri-vites.wav", bitir(a), ADAY)
    yaz("daisy-beep-b-eski-korna.wav", bitir(b), ADAY)
    yaz("daisy-beep-c-iki-ses.wav", bitir(c), ADAY)
    yaz("daisy-beep.wav", bitir(b))                       # secilen: B
    yaz("daisy-beep-soft.wav", bitir(s, -9.5, sol_son=0.3))
    yaz("kagit-hisirti.wav", bitir(kagit_hisirti()))
    yaz("kalem-karalama.wav", bitir(kalem_karalama()))
    yaz("dizel-calistirma.wav", bitir(dizel_calistirma(), sol_son=0.4))
    yaz("dizel-rolanti-dongu.wav", bitir(dizel_rolanti(), -6, 0.005, 0.005, dongu=True))
    yaz("kol-cekme.wav", bitir(kol_cekme()))
    yaz("halat-gerilme.wav", bitir(halat_gerilme()))
    yaz("top-darbe.wav", bitir(dc_kes(dc_kes(top_darbe(), 40), 40), sol_son=0.3))
    yaz("tugla-catirti.wav", bitir(dc_kes(dc_kes(tugla_catirti(), 40), 40), sol_son=0.2))
    yaz("baca-devrilme.wav", bitir(dc_kes(dc_kes(baca_devrilme(), 40), 40), sol_son=1.0))
    yaz("ortam-bos-arsa-dongu.wav", bitir(ortam_bos_arsa(), -12, 0.005, 0.005, dongu=True))
    yaz("damga-kesif.wav", bitir(damga_kesif(), -4.5, sol_son=0.3))
    yaz("oyun-yikim.wav", bitir(oyun_yikim()))


if __name__ == "__main__":
    main()
