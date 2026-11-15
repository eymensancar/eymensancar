# Two Beeps — müzik

`python3 src/muzik_uret.py` üç dosyayı numpy ile sentezler (dış kaynak yok). Tempo (`BPM`) ve ton (`TONIC`) betiğin başında tek yerden değişir.

## Kimlik
- **Tempo:** 120 BPM, 4/4. Bir cümle = 2 ölçü = **4 sn**.
- **Ton:** Re Dorian/minör (Dm9 – Si♭ – Fa – Do).
- **Tema:** La La | Re' Do La | Sol La. İlk iki kısa La, Daisy'nin "iki bip"i. Cevabı Fa Fa | Mi Re Do | Re; soru biçimi La La | Re' … Mi' (çözülmez).
- **Tınılar:** marimba (melodi), pizzicato bas, yumuşak pad, alçak "tum-tum" nabız, oda yankısı. 1–4 kHz bandı karışımın ~20 dB altında: anlatıcıya yer.

## Dosyalar (48 kHz, stereo, 24-bit, gerçek tepe −3 dBFS)
| Dosya | Süre | Ölçülen | Anlatıcı altında |
|---|---|---|---|
| `assets/music/tema-ana.wav` | 64 sn | −19,9 LUFS | −10 dB |
| `assets/music/gerilim.wav` | 16 sn, döngü | −14,5 LUFS | −15 dB |
| `assets/music/vurgu-son.wav` | 3 sn | −15,3 LUFS | −3 dB (tek başına) |

**Seviye kuralı:** anlatıcı −14 LUFS'e getirilir; müzik konuşma altında ≈ **−30 LUFS** (sese göre −16 dB), anlatım boşluklarında 0,3 sn'lik geçişle ≈ **−24 LUFS**'e çıkar. `vurgu-son` konuşmasız çalar, ≈ −18 LUFS.

## tema-ana.wav bölümleri ve kesme noktaları
Kesme/uzatma noktaları **her 4 sn'de bir**: 0, 4, 8 … 60. Her nokta bir cümle başıdır; 30–50 ms geçişle kesilir.
- **0–8 giriş, merak:** pad, uzaktan iki bip, temanın yarısı.
- **8–32 oyunbaz:** pizz bas, tema/cevap sırayla. Uzatmak için 8–16 (Dm–Si♭) ya da 24–32 bloğu tekrar edilir.
- **32–44 gerilim:** ikili nabız, sekizlik ostinato, yükselen "iki bip", +3,5 dB tırmanış. 32–36 tekrar edilerek uzatılabilir.
- **44 sn — ana kesme:** son vuruş boş, karışım 43,5–44 sn arasında −40 dB'e iner; düşüş anı buraya oturur.
- **44–56 soru:** nabız yok, tema Mi'de asılı kalır. 44–48 tekrar edilerek uzatılabilir.
- **56–64 kuyruk:** son akor söner.

`gerilim.wav` dikişsiz döngü; temayla aynı tempo/ton, 4 sn sınırında başlatılır.

`vurgu-son.wav`: iki bip (La La) + yukarı beşli (Mi), altında Si♭maj7(#11).

## Sonraki bölümlerde çeşitleme
`tema_ana()` içindeki akor planı değiştirilir; tema ve vurgu sabit kalır.
- **2 (Ant), 6 (Ironline), 7:** sıcak — tema pad'de yavaş, cevap Fa majörde.
- **3 (Hale), 8:** pizz basta kromatik iniş, tema Si♭'de.
- **4 (Two Beeps):** iki bip tek başına ritim olur; tema marimba yerine pizzde.
- **5, 9:** gerilim katmanı daha uzun, tempo aynı.
- **10:** tema çözülür: soru biçimi Mi yerine Re'ye iner; son "iki bip" majör akorla (veda).
