#!/usr/bin/env python3
"""Two Beeps — dizi müziği üretici (yalnız numpy).

Üretir (48 kHz, stereo, 24-bit WAV, tepe -3 dBFS):
  assets/music/tema-ana.wav   1. bölüm boyunca çalan ana tema (64 sn)
  assets/music/vurgu-son.wav  bölüm sonu imzası (3 sn)
  assets/music/gerilim.wav    döngülenebilir gerilim katmanı (16 sn)

Tempo ve ton yalnız aşağıdaki iki sabitten değişir. Bir "cümle" = 2 ölçü
(8 vuruş); 120 BPM'de 4 sn eder ve bütün kesme noktaları cümle sınırındadır.
Çalıştır:  python3 src/muzik_uret.py
"""
import os
import wave
import numpy as np

# ---- tek yerden ayar --------------------------------------------------------
BPM = 120          # tempo
TONIC = 62         # tonik MIDI notası (62 = D4; ton: Re Dorian/minör)
SEED = 7           # rastgelelik (faz, detune, yankı) sabit: aynı çıktı
# -----------------------------------------------------------------------------

SR = 48000
BEAT = 60.0 / BPM
BAR = 4 * BEAT
PHRASE = 2 * BAR                     # kesme/uzatma birimi (120 BPM'de 4 sn)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "music")
rng = np.random.default_rng(SEED)

# Tema (TONIC'e göre yarım ton, vuruş başlangıcı, süre vuruş). Re'de:
# La La | Re' Do La | Sol La   -> "iki bip" iki kısa La ile başlar.
MOTIF = [(7, 0.0, 0.5), (7, 0.5, 0.5), (12, 1.0, 1.0), (10, 2.0, 0.5),
         (7, 2.5, 1.5), (5, 4.0, 1.0), (7, 5.0, 2.0)]
# Cevap: Fa Fa | Mi Re Do | Re (inen, kapanan)
ANSWER = [(3, 0.0, 0.5), (3, 0.5, 0.5), (2, 1.0, 1.0), (0, 2.0, 0.5),
          (-2, 2.5, 1.5), (0, 4.0, 3.0)]
# Soru: La La | Re' ... Mi' (çözülmeden asılı kalır)
QUESTION = [(7, 0.0, 0.5), (7, 0.5, 0.5), (12, 1.0, 2.0), (14, 4.0, 4.0)]

# Akorlar (TONIC'e göre; D=0 E=2 F=3 G=5 A=7 Bb=8 C=10 C#=11). Pad bir oktav
# aşağıda çalar; ilk ses bas köküdür.
CH = {
    "Dm9":       [0, 7, 14, 15],     # D A E F
    "Bb":        [-4, 3, 8, 12],     # Bb F Bb D
    "F":         [3, 7, 10, 15],     # F A C F
    "C":         [-2, 5, 10, 14],    # C G C E
    "Gm":        [-7, 0, 5, 8],      # G D G Bb
    "Asus":      [-5, 7, 12, 14],    # A A D E
    "Bbmaj7#11": [-4, 7, 12, 14],    # Bb A D E  (soru rengi)
}


def hz(semi):
    return 440.0 * 2 ** ((TONIC + semi - 69) / 12.0)


def cents(c):
    return 2 ** (c / 1200.0)


# ---------------------------------------------------------------- yardımcılar
def fft_eq(x, gain_fn):
    """Sıfır fazlı EQ: gain_fn(f_hz) -> doğrusal kazanç."""
    n = x.shape[-1]
    nfft = 1 << int(np.ceil(np.log2(n + 1)))
    X = np.fft.rfft(x, nfft)
    f = np.fft.rfftfreq(nfft, 1 / SR)
    X *= gain_fn(f)
    return np.fft.irfft(X, nfft)[..., :n]


def lp(f, fc, order=2):
    return 1.0 / np.sqrt(1.0 + (f / fc) ** (2 * order))


def hp(f, fc, order=2):
    f = np.maximum(f, 1e-3)
    return 1.0 / np.sqrt(1.0 + (fc / f) ** (2 * order))


def bell(f, fc, db, q):
    f = np.maximum(f, 1e-3)
    return 10 ** (db / 20 * np.exp(-(np.log2(f / fc) * q) ** 2))


def pan2(m, p):
    """p: -1 sol, +1 sağ (sabit güç)."""
    a = (p + 1) * np.pi / 4
    return np.stack([m * np.cos(a), m * np.sin(a)])


class Bus:
    def __init__(self, seconds):
        self.x = np.zeros((2, int(seconds * SR) + 1))

    def add(self, sig, t, gain=1.0):
        i = int(round(t * SR))
        if i >= self.x.shape[1]:
            return
        n = min(sig.shape[1], self.x.shape[1] - i)
        self.x[:, i:i + n] += gain * sig[:, :n]


# ---------------------------------------------------------------- çalgılar
def marimba(f, dur, vel=1.0, pan=0.0):
    """Tokmaklı tahta: 1, 3.93, 9.2 kısmi ses, hızlı sönen üstler, tık sesi."""
    L = dur + 1.6
    t = np.arange(int(L * SR)) / SR
    tau = 0.55 * (440 / f) ** 0.4
    out = np.zeros((2, t.size))
    for k, det in enumerate((-4, 4)):
        ff = f * cents(det)
        ph = rng.uniform(0, 2 * np.pi, 3)
        s = (np.sin(2 * np.pi * ff * t + ph[0]) * np.exp(-t / tau)
             + 0.15 * np.sin(2 * np.pi * ff * 3.93 * t + ph[1]) * np.exp(-t / (tau * 0.18))
             + 0.05 * np.sin(2 * np.pi * ff * 9.2 * t + ph[2]) * np.exp(-t / 0.02))
        out += pan2(s, np.clip(pan + (k - 0.5) * 0.3, -1, 1))
    att = np.minimum(t / 0.003, 1.0)
    click = rng.standard_normal(t.size) * np.exp(-t / 0.004) * 0.08
    click = fft_eq(click, lambda fr: lp(fr, 3000) * hp(fr, 400))
    out = out * att + pan2(click, pan)
    rel = np.clip((dur + 1.4 - t) / 0.2, 0, 1)     # nota bitince sön
    return out * rel * vel * 0.5


def pizz(f, vel=1.0, pan=0.0):
    """Pizzicato yaylı: sönen harmonikler, gövde rezonansı, hafif perde düşüşü."""
    L = 1.4
    t = np.arange(int(L * SR)) / SR
    s = np.zeros(t.size)
    drop = 1 + 0.004 * np.exp(-t / 0.03)
    for n in range(1, 16):
        fn = f * n * (1 + 0.0004 * n * n)
        if fn > 5000:
            break
        a = n ** -1.1 * lp(fn, 1200, 1)
        s += a * np.sin(2 * np.pi * np.cumsum(fn * drop) / SR + rng.uniform(0, 6.28)) \
            * np.exp(-t / (0.45 / (1 + 0.5 * n)))
    s *= np.minimum(t / 0.004, 1.0)
    s = fft_eq(s, lambda fr: bell(fr, 220, 3, 1.5) * hp(fr, 50))
    return pan2(s, pan) * vel * 0.45


def pad(semis, dur, vel=1.0, att=1.2, rel=1.8, fc=700.0, bright=0.0):
    """Yumuşak yaylı/synth pad: dedektörlü testere kısmi sesleri, alçak geçiren."""
    L = dur + rel
    t = np.arange(int(L * SR)) / SR
    out = np.zeros((2, t.size))
    for semi in semis:
        f0 = hz(semi - 12)
        for v, det in enumerate((-8, -2, 5, 9)):
            f = f0 * cents(det + rng.uniform(-1, 1))
            lfo = 1 + 0.0015 * np.sin(2 * np.pi * rng.uniform(0.15, 0.35) * t + rng.uniform(0, 6))
            phase = 2 * np.pi * np.cumsum(np.full(t.size, f) * lfo) / SR
            s = np.zeros(t.size)
            for n in range(1, 24):
                if f * n > 3500:
                    break
                a = (1 / n) * lp(f * n, fc * (1 + bright), 2)
                s += a * np.sin(n * phase + rng.uniform(0, 6.28))
            out += pan2(s, (-0.7, -0.25, 0.25, 0.7)[v])
    env = np.minimum(t / att, 1.0) ** 2
    env *= np.clip((L - t) / rel, 0, 1) ** 1.5
    return out * env * vel * 0.05


def thump(f, vel=1.0):
    """Alçak nabız: yumuşak, perdesi hafif düşen sinüs (kalp atışı gibi)."""
    t = np.arange(int(0.6 * SR)) / SR
    fr = f * (1 + 0.6 * np.exp(-t / 0.025))
    s = np.sin(2 * np.pi * np.cumsum(fr) / SR) + 0.15 * np.sin(4 * np.pi * np.cumsum(fr) / SR)
    s *= np.minimum(t / 0.004, 1) * np.exp(-t / 0.13)
    return pan2(s, 0) * vel * 0.6


def tick(vel=1.0, pan=0.0):
    """Çok hafif, yüksek tıkırtı (konuşma bandının üstünde)."""
    t = np.arange(int(0.08 * SR)) / SR
    s = rng.standard_normal(t.size) * np.exp(-t / 0.012)
    s = fft_eq(s, lambda fr: hp(fr, 7000, 3) * lp(fr, 13000))
    return pan2(s, pan) * vel * 0.06


# ---------------------------------------------------------------- oda yankısı
def room_ir(rt60=1.3, length=2.2, predelay=0.014):
    n = int(length * SR)
    t = np.arange(n) / SR
    ir = np.zeros((2, n))
    for c in range(2):
        noise = rng.standard_normal(n)
        # frekansa bağlı sönüm: tizler daha çabuk söner (iki bandın karışımı)
        lo = fft_eq(noise, lambda f: lp(f, 2500)) * np.exp(-6.9 * t / rt60)
        hi = fft_eq(noise, lambda f: hp(f, 2500)) * np.exp(-6.9 * t / (rt60 * 0.45))
        ir[c] = lo + 0.6 * hi
        for d, g in ((0.007, 0.5), (0.013, 0.35), (0.021, 0.3), (0.029, 0.2)):   # erken yansıma
            ir[c, int((d + c * 0.0017) * SR)] += g * 3
    ir *= np.minimum(t / 0.01, 1)
    pd = int(predelay * SR)
    ir = np.concatenate([np.zeros((2, pd)), ir[:, :n - pd]], axis=1)
    return ir / np.sqrt(np.sum(ir ** 2, axis=1, keepdims=True))


IR = None


def reverb(x, wet, circular=False):
    global IR
    if IR is None:
        IR = room_ir()
    n = x.shape[1]
    m = IR.shape[1]
    if circular:
        nfft = n
        y = np.stack([np.fft.irfft(np.fft.rfft(x[c]) * np.fft.rfft(_wrap(IR[c], n)), n) for c in range(2)])
    else:
        nfft = 1 << int(np.ceil(np.log2(n + m)))
        y = np.stack([np.fft.irfft(np.fft.rfft(x[c], nfft) * np.fft.rfft(IR[c], nfft), nfft)[:n] for c in range(2)])
    y = fft_eq(y, lambda f: hp(f, 180) * lp(f, 6000))
    return x + wet * y


def _wrap(ir, n):
    out = np.zeros(n)
    for i in range(0, ir.size, n):
        seg = ir[i:i + n]
        out[:seg.size] += seg
    return out


# ---------------------------------------------------------------- mix/çıkış
def master(x):
    """Konuşma bandını (1–4 kHz) hafifçe oy, çok alçak uğultuyu kes."""
    return fft_eq(x, lambda f: hp(f, 32, 2) * bell(f, 2200, -4.0, 0.9) * bell(f, 380, -1.5, 1.2))


def true_peak(x, os_=4):
    n = x.shape[1]
    X = np.fft.rfft(x, axis=1)
    y = np.fft.irfft(X, n * os_, axis=1) * os_
    return np.max(np.abs(y))


def write_wav(path, x, peak_db=-3.0, fade_in=0.0, fade_out=0.0):
    x = x.copy()
    if fade_in:
        k = int(fade_in * SR)
        x[:, :k] *= np.linspace(0, 1, k)
    if fade_out:
        k = int(fade_out * SR)
        x[:, -k:] *= np.linspace(1, 0, k) ** 2
    x *= 10 ** (peak_db / 20) / true_peak(x)
    q = np.clip(np.round(x.T * (2 ** 23 - 1)), -2 ** 23, 2 ** 23 - 1).astype("<i4")
    b = q.reshape(-1, 1).view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)
    print(f"{os.path.relpath(path, ROOT)}  {x.shape[1] / SR:.2f} sn")


def play_line(bus, line, t0, oct_=0, vel=1.0, pan=0.0, accent_beeps=True):
    for i, (semi, b, d) in enumerate(line):
        v = vel * (1.05 if (accent_beeps and i < 2) else 0.85)
        bus.add(marimba(hz(semi + 12 * oct_), d * BEAT, v, pan + rng.uniform(-0.1, 0.1)), t0 + b * BEAT)


# ---------------------------------------------------------------- parçalar
def tema_ana():
    """Cümle (4 sn) planı:
       0-1  giriş (0-8): pad + uzaktan iki bip, tema ilk kez yarım
       2-7  oyunbaz (8-32): pizz bas, tıkırtı, tema/cevap sırayla
       8-10 gerilim (32-44): ikili nabız, sekizlik ostinato, yükselen akor
       11-13 soru (44-56): nabız yok, tema çözülmeden asılı kalır; 56-64 kuyruk
    """
    plan = ["Dm9", "Dm9",
            "Dm9", "Bb", "F", "C", "Dm9", "Bb",
            "Bb", "Gm", "Asus",
            "Bbmaj7#11", "Gm", "Bbmaj7#11"]
    total = 16 * PHRASE
    mel, bass, padb, perc = Bus(total), Bus(total), Bus(total), Bus(total)
    for p, ch in enumerate(plan):
        t0 = p * PHRASE
        semis = CH[ch]
        # --- pad
        if p < 2:
            padb.add(pad(semis, PHRASE, 0.7 + 0.15 * p, att=2.5), t0)
        elif p < 8:
            padb.add(pad(semis, PHRASE, 0.8), t0)
        elif p < 11:
            padb.add(pad(semis, PHRASE - BEAT, 0.95 + 0.15 * (p - 8), att=0.6, rel=0.25,
                         bright=0.4 * (p - 7)), t0)
        else:
            dur = PHRASE if p < 13 else 2 * PHRASE
            padb.add(pad(semis, dur, 0.75, att=1.8, rel=3.0 if p == 13 else 1.8, fc=600), t0)
        # --- melodi
        if p == 0:
            for b in (2.0, 2.5):  # uzaktan iki bip
                mel.add(marimba(hz(19), 0.4 * BEAT, 0.35, 0.3), t0 + b * BEAT)
        elif p == 1:
            play_line(mel, MOTIF[:3], t0 + 2 * BEAT, vel=0.55)
        elif 2 <= p < 8:
            play_line(mel, MOTIF if p % 2 == 0 else ANSWER, t0, vel=0.8)
        elif 8 <= p < 11:
            for b in (0, 0.5, 4, 4.5):                    # "iki bip" yükselerek
                mel.add(marimba(hz(7 + (p - 8) * 2), 0.4 * BEAT, 0.6 + 0.12 * (p - 8), 0.2),
                        t0 + b * BEAT)
        elif p == 11:
            play_line(mel, QUESTION, t0, vel=0.7)
        elif p == 13:
            for b in (0.0, 0.5):
                mel.add(marimba(hz(19), 0.4 * BEAT, 0.3, -0.3), t0 + b * BEAT)
        # --- bas (pizz)
        root = semis[0] - 12
        if 2 <= p < 8:
            pat = [(0, 0), (2, 7), (3.5, 0), (4, 0), (6, 7), (7.5, 12)]
            for b, iv in pat:
                bass.add(pizz(hz(root + iv), 0.8 if b % 2 == 0 else 0.55, -0.15), t0 + b * BEAT)
            for b in np.arange(0.5, 8, 1.0):
                perc.add(tick(0.7 if p >= 4 else 0.4, 0.35), t0 + b * BEAT)
        elif 8 <= p < 11:
            ost = [0, 7, 12, 7]
            for k in range(15 if p == 10 else 16):          # son vuruş boş: 44. sn temiz
                v = 0.55 + 0.25 * (k % 4 == 0) + 0.06 * (p - 8)
                bass.add(pizz(hz(-12 + ost[k % 4]), v, -0.1), t0 + k * 0.5 * BEAT)
            for b in range(0, 7 if p == 10 else 8):         # ikili nabız: tum-tum
                perc.add(thump(hz(-24), 0.8), t0 + b * BEAT)
                perc.add(thump(hz(-24), 0.45), t0 + (b + 0.25) * BEAT)
                perc.add(tick(0.9, -0.3), t0 + (b + 0.5) * BEAT)
        elif p == 11:
            bass.add(pizz(hz(-16), 0.6), t0)
        elif p == 13:
            bass.add(pizz(hz(-16), 0.5), t0)
        if p in (0, 2, 6):
            perc.add(thump(hz(-24), 0.35), t0)
    padx = fft_eq(padb.x, lambda f: bell(f, 450, -3.0, 0.8))   # anlatıcı gövdesine yer aç
    mix = (reverb(mel.x, 0.55) + reverb(bass.x, 0.25) + reverb(padx, 0.3)
           + reverb(perc.x, 0.15))
    # gerilim: 32 -> 44 sn arasında yaklaşık +3.5 dB tırmanış
    t = np.arange(mix.shape[1]) / SR
    # giriş ve soru bölümleri biraz öne (sessiz ama duyulur), gerilimde tırmanış
    mix *= np.interp(t, [0, 2 * PHRASE - 0.5, 2 * PHRASE, 8 * PHRASE, 11 * PHRASE - BEAT, 11 * PHRASE],
                     [1.5, 1.5, 1.0, 1.0, 1.5, 1.5])
    # 44. sn öncesi son vuruşta yankıyı da kıs: kesme noktası tertemiz
    i0, i1 = int((11 * PHRASE - BEAT) * SR), int(11 * PHRASE * SR)
    mix[:, i0:i1] *= np.linspace(1, 0.25, i1 - i0)
    return master(mix)


def vurgu_son():
    """İki bip + çözülmeyen Si♭maj7(#11): her bölüm sonunda aynı."""
    total = 3.0
    b = Bus(total)
    b.add(marimba(hz(7), 0.3 * BEAT, 0.9, 0.15), 0.05)              # bip
    b.add(marimba(hz(7), 0.3 * BEAT, 0.8, 0.15), 0.05 + 0.5 * BEAT) # bip
    b.add(marimba(hz(14), 1.6, 0.8, -0.1), 0.05 + 1.5 * BEAT)       # Mi: soru (yukarı beşli)
    b.add(pad(CH["Bbmaj7#11"], 1.6, 1.1, att=0.5, rel=0.9, fc=650), 0.3)
    b.add(pizz(hz(-16), 0.7), 0.05 + 1.5 * BEAT)
    x = reverb(b.x, 0.5)
    return master(x)


def gerilim():
    """16 sn (4 cümle), dairesel yankıyla dikişsiz döngü."""
    L = 4 * PHRASE
    n = int(round(L * SR))
    b = Bus(L + 3.0)
    prog = ["Bb", "C", "Bb", "Asus"]
    for p, ch in enumerate(prog):
        t0 = p * PHRASE
        b.add(pad(CH[ch], PHRASE, 0.85, att=0.8, rel=0.8, fc=650, bright=0.2 * (p == 3)), t0)
        ost = [0, 7, 12, 7]
        for k in range(16):
            b.add(pizz(hz(-12 + ost[k % 4]), 0.5 + 0.2 * (k % 4 == 0), -0.1), t0 + k * 0.5 * BEAT)
        for k in range(8):
            b.add(thump(hz(-24), 0.75), t0 + k * BEAT)
            b.add(thump(hz(-24), 0.4), t0 + (k + 0.25) * BEAT)
            b.add(tick(0.8, 0.3 * (-1) ** k), t0 + (k + 0.5) * BEAT)
        for k in (0, 0.5):
            b.add(marimba(hz(19 + (p == 3) * 2), 0.4 * BEAT, 0.4, 0.25), t0 + k * BEAT)
    # sondan taşan kuyruğu başa sar (dikişsiz döngü)
    x = b.x[:, :n].copy()
    tail = b.x[:, n:]
    x[:, :tail.shape[1]] += tail
    return master(reverb(x, 0.3, circular=True))


def main():
    os.makedirs(OUT, exist_ok=True)
    write_wav(os.path.join(OUT, "tema-ana.wav"), tema_ana(), fade_in=0.01, fade_out=1.5)
    write_wav(os.path.join(OUT, "vurgu-son.wav"), vurgu_son(), fade_in=0.005, fade_out=0.6)
    write_wav(os.path.join(OUT, "gerilim.wav"), gerilim())


if __name__ == "__main__":
    main()
