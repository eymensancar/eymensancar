"""Anlatıcı kaydından bir bölümün ses izini ve zaman çizelgesini kurar.
Kullanım: python3 src/ses_kur.py   (şimdilik yalnız Part 1)
Girdi: assets/voice/ham.wav (bütün dizi, tek kayıt), assets/voice/kelimeler.json (kelime zamanları).
Çıktı: out/part1-voice.wav, src/part1.timeline.json.
Kayıt cümle aralarındaki sessizliklerden kesilir; her cümleden sonra en az `nefes` kadar boşluk bırakılır."""
import json, subprocess, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W = json.load(open(f'{ROOT}/assets/voice/kelimeler.json'))
LEAD = 0.35          # ilk kelimeden önce
BASE = 0.28          # her cümle arasında en az
END_TAIL = 4.3       # son cümleden sonra bitiş (tek bip + en az 2,5 sn bitiş kartı)
# (metin, cümleden sonra ek nefes, işaret)
S = [
 ("Grandpa left me three things.", .2, None), ("A crane.", .2, None), ("A debt.", .2, None),
 ("And a list, with one line I'm not allowed to read.", .4, None),
 ("Ten buildings to take down.", .1, None), ("Nine, in old black ink.", .1, None),
 ("The tenth is scratched out.", .2, None), ("In blue.", .3, None), ("And the blue is fresh.", .8, "ink"),
 ("The crane is called Daisy.", .1, None), ("She is older than my dad, and she hates mornings.", .3, None),
 ("Job one: an old chimney, in an empty lot.", .2, None),
 ("The night before, I flattened forty towers in Demolition Master.", 0, None),
 ("In the game, you just try again.", .2, None), ("Real chimneys don't.", .8, "real"),
 ("I pulled the lever.", .1, None), ("Daisy beeped.", 1.05, "beep"), ("Twice.", .35, None),
 ("I ignored her.", .2, None), ("The chimney fell the wrong way.", .5, "fall"), ("Nobody was near.", .2, None),
 ("My professor says, that's called luck.", .5, None), ("In the bricks, I found a stamp.", .1, None),
 ("Two letters.", .15, None), ("H, and K.", .6, "stamp"), ("And I keep thinking about that beep.", .1, None),
 ("Daisy beeped twice before it fell.", .3, None), ("Like she knew.", 0, "end"),
]
norm = lambda s: re.sub(r"[^a-z0-9']", '', s.lower())
# Part 1: kayıttaki ilk 139 kelime ("Like she knew." ile biter)
P = [w for w in W if w[0] < 47.4]
i = 0; segs = []
for text, nefes, mark in S:
    n = len(text.split())
    # kayıtta sayı farkı olabilir (ör. "forty" -> "40"): cümle sonunu noktalama ile bul
    j = i
    last = norm(text.split()[-1])
    while j < len(P) and not (j - i >= n - 2 and (norm(P[j][2]) == last or P[j][2][-1] in '.?!,' and j - i >= n - 1)): j += 1
    j = min(j, len(P) - 1)
    segs.append(dict(text=text, nefes=nefes, mark=mark, src=P[i:j + 1])); i = j + 1
assert i == len(P), (i, len(P))
PAD = 0.07
t = LEAD; parts = []; out = []
for k, s in enumerate(segs):
    a = max(0, s['src'][0][0] - PAD); b = s['src'][-1][1] + PAD
    if k + 1 < len(segs): b = min(b, segs[k + 1]['src'][0][0] - 0.02)
    if k: a = max(a, segs[k - 1]['src'][-1][1] + 0.02)
    dur = b - a
    words = s['text'].split(); src = s['src']
    if len(words) == len(src): wt = [(w, t + x[0] - a, t + x[1] - a) for w, x in zip(words, src)]
    else:
        t0 = t + src[0][0] - a; t1 = t + src[-1][1] - a; L = sum(len(w) + 1 for w in words); c = 0; wt = []
        for w in words: wt.append((w, t0 + (t1 - t0) * c / L, t0 + (t1 - t0) * (c + len(w) + 1) / L)); c += len(w) + 1
    out.append(dict(i=k + 1, text=s['text'], t0=round(wt[0][1], 3), t1=round(wt[-1][2], 3), mark=s['mark'],
                    words=[dict(w=w, t0=round(x, 3), t1=round(y, 3)) for w, x, y in wt]))
    parts.append((a, dur, t)); t += dur + (BASE + s['nefes'] if k + 1 < len(segs) else 0)
total = round(t + END_TAIL, 3)
flt = ';'.join(f"[0:a]atrim={a:.3f}:{a + d:.3f},asetpts=PTS-STARTPTS,afade=t=in:d=0.015,afade=t=out:st={d - 0.03:.3f}:d=0.03,adelay={int(o * 1000)}:all=1[s{n}]" for n, (a, d, o) in enumerate(parts))
flt += ';' + ''.join(f'[s{n}]' for n in range(len(parts))) + f"amix=inputs={len(parts)}:normalize=0,apad=whole_dur={total},loudnorm=I=-15:TP=-1.5:LRA=7[o]"
os.makedirs(f'{ROOT}/out', exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', f'{ROOT}/assets/voice/ham.wav', '-filter_complex', flt, '-map', '[o]', '-ar', '48000', '-ac', '1', f'{ROOT}/out/part1-voice.wav'], check=True)
marks = {s['mark']: s for s in out if s['mark']}
tl = dict(part=1, parts=10, title='THE CHIMNEY', next=dict(part=2, title='THE ANT'), fps=30, w=1080, h=1920, duration=total,
          voice='out/part1-voice.wav', sentences=out,
          cues=dict(beep=round(marks['beep']['t1'] + 0.22, 3), fall=round(marks['fall']['t0'], 3), stamp=round(marks['stamp']['t1'], 3),
                    voiceEnd=out[-1]['t1'], endBeep=round(out[-1]['t1'] + 0.95, 3), endCard=round(out[-1]['t1'] + 1.6, 3)))
json.dump(tl, open(f'{ROOT}/src/part1.timeline.json', 'w'), indent=1, ensure_ascii=False)
print('süre', total); [print(f"{s['i']:2d} {s['t0']:6.2f} {s['t1']:6.2f} {s['mark'] or '':6} {s['text']}") for s in out]; print(tl['cues'])
