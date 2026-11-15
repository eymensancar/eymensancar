#!/usr/bin/env python3
"""Two Beeps - 1. bolum ses efektleri ve Daisy'nin iki bip'i.

Calistir:  python3 src/sfx_uret.py      (two-beeps/ kokunden ya da herhangi bir yerden)
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
            ikinci_db=0.0, parlak=6000, seed=1):
    rng = np.random.default_rng(seed)
    bas = 0.04
    y = buf(bas + 2 * acik + ara + 0.1)
    b = bip_tonu(acik, f0, kismi, atak, birak, cizirti)
    for i, kz in enumerate([1.0, 10 ** (ikinci_db / 20)]):
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


# ---------------------------------------------------------------- ana
def main():
    print("Two Beeps sfx uretiliyor ->", SFX)
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
