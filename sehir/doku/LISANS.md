# Dokular

Hepsi **CC0 1.0** (kamu malı; atıf zorunlu değil). Kaynak: [ambientCG](https://ambientcg.com) (yapan: Lennart Demes / ambientCG). Ham dosyalar 1K-JPG paketlerinin `*_Color.jpg` haritasıdır (`https://ambientcg.com/get?file=<Ad>_1K-JPG.zip`); normal/pürüz haritaları kullanılmadı.

| Dosya | Boyut | Kaynak | Kullanım |
|---|---|---|---|
| `cim.jpg` | 1024 px | [Grass004](https://ambientcg.com/view?id=Grass004) | arazi: çim |
| `toprak.jpg` | 512 px | [Ground067](https://ambientcg.com/view?id=Ground067) | arazi: çıplak toprak, kızıl diyar zemini |
| `kaya.jpg` | 512 px | [Rock023](https://ambientcg.com/view?id=Rock023) | arazi: dik yamaç kayası (yandan izdüşüm) |
| `cakil.jpg` | 512 px | [Gravel022](https://ambientcg.com/view?id=Gravel022) | arazi: nehir/göl kıyısı çakılı |
| `paket.jpg` | 512 px | R: [Snow006](https://ambientcg.com/view?id=Snow006) (gri), G: [Ground080](https://ambientcg.com/view?id=Ground080) (gri), B: kendi ürettiğimiz döşenebilir 1/f gürültüsü | arazi: kar, kum, tekrar kırıcı gürültü; su deseni |
| `nesne.jpg` | 1024 px (2×2 karo) | sol üst [Bark014](https://ambientcg.com/view?id=Bark014), sağ üst [Moss003](https://ambientcg.com/view?id=Moss003), sol alt [Rock030](https://ambientcg.com/view?id=Rock030), sağ alt [Ground054](https://ambientcg.com/view?id=Ground054) | ağaç kabuğu, yaprak kütlesi, kaya, ince tanecik (kaktüs, kristal, mantar, karlı çam) |

## Yapılan işlem (hepsinde)
1. 1024 px ham görüntü hedef boyuta küçültüldü (Lanczos).
2. Geniş lekeler kısmen düzlendi (görüntü, sarmalı Gauss bulanığının 0,35–0,7 kuvvetine bölündü): döşeme tekrarı daha az göze batar.
3. Her kanal kendi ortalamasına bölünüp 0,5 ile çarpıldı ("ortalaması 0,5 gri"). Gölgelendirici dokuyu ×2 ile çarpıp biyom rengiyle boyar; renkler `gorunum.js`'ten ayarlanır, dokular yalnız ayrıntı ve renk oynaması taşır. Kontrast ve doygunluk doku başına ayarlandı.
4. `paket.jpg`: kar ve kum griye çevrilip ayrı kanallara kondu (renk alt örneklemesi kapalı, 4:4:4).
5. `nesne.jpg`: dört doku 480 px'e küçültülüp 512 px'lik karolara kondu; her karonun çevresinde 16 px sarmalı pay var (mip taşması için).

Üretim betiği ve ham indirmeler depoda değil (`/tmp/doku-ham/`, betik `doku_yap.py`); yukarıdaki adımlar yeniden üretmek için yeterlidir.
