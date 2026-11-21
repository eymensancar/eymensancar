# Burger Ustası: sesler ve müzik (kaynaklar ve lisanslar)

Bütün dosyalar `tools/ses/hazirla.py` ile üretilir (kırpma, sessizlik temizliği, ses düzeyi, döngü payı, MP3). Kaynakların hepsi
**CC0 1.0 (kamu malı)**: ticari kullanım serbest, atıf gerekmez (yine de burada yazıyoruz). Bozukluk sesi ve kasa zili bizim sentezimiz.
Whoosh/swoosh yok. Lisanslar 21 Kasım 2026'da kaynağın kendi sayfasında tek tek denetlendi.

| Oyundaki ses | Dosya | Kaynak | Yazar | Lisans |
|---|---|---|---|---|
| Izgara cızırtısı (döngü) | `cizirti.mp3` | Freesound #382680 "Sizzling & Popping Bacon" (9,5–14,2 sn) https://freesound.org/people/mricken1/sounds/382680/ | mricken1 | CC0 |
| Fritöz kızarma (döngü), yağa iniş | `fritoz.mp3`, `fritoz_dal.mp3` | Freesound #667767 "Chips frying in a deep fat fryer" https://freesound.org/people/nicandali/sounds/667767/ (+ Kenney Impact `impactSoft_medium_002`) | nicandali | CC0 |
| Fritöz sepeti (patatesi alınca) | `fritoz_al.mp3` | Freesound #637625 "kitchen restaurant fries deep fryer basket pickup" https://freesound.org/people/kyles/sounds/637625/ | kyles | CC0 |
| Bıçak / doğrama (3 vuruş) | `bicak1-3.mp3` | Freesound #101733 "chopping_meat.wav" https://freesound.org/people/helenacm/sounds/101733/ | helenacm | CC0 |
| Hazır çanı (köfte pişti, patates kızardı) | `hazir.mp3` | Kenney Impact Sounds `impactBell_heavy_003` https://kenney.nl/assets/impact-sounds | Kenney | CC0 |
| Malzemenin burgere konması | `kon_ekmek1-3`, `kon_kofte1-2`, `kon_peynir1-3`, `kon_tursu1-2` | Kenney Impact Sounds `impactSoft_medium_*`, `impactGeneric_light_*` | Kenney | CC0 |
| Tepsiye koyma | `tepsi1-3.mp3` | Kenney Impact Sounds `impactWood_light_000-002` | Kenney | CC0 |
| Servis (tepsi müşteriye) | `servis1-2.mp3` | Kenney Impact Sounds `impactPlate_light_000/002` | Kenney | CC0 |
| Bozukluk şıngırtısı (3 çeşit) | `para1-3.mp3` | kendi sentezimiz (madeni para titreşim kipleri + ikinci küçük sekme), `hazirla.py` → `bozukluk()` | Burger Ustası | bizim |
| Kasa | `kasa.mp3` | Kenney Casino Audio `chips-handle-3` (çekmece) + kendi zil sentezimiz (`zil()`) https://kenney.nl/assets/casino-audio | Kenney + biz | CC0 |
| Dokunuş, düğme, uyarı, doğrama tamam | `dokun`, `tik`, `uyari`, `tamam` | Kenney Interface Sounds `select_002`, `click_001`, `tick_002`, `confirmation_001` https://kenney.nl/assets/interface-sounds | Kenney | CC0 |
| Gün başı, gün sonu, satın alma (kısa jingle) | `gun_basla`, `gun_sonu`, `satin` | Kenney Music Jingles `jingles_PIZZI08`, `PIZZI10`, `PIZZI16` (pizzicato yaylılar) https://kenney.nl/assets/music-jingles | Kenney | CC0 |
| Oyun müziği, iki katman | `muzik_oyun_a.mp3` (ezgi/akor), `muzik_oyun_b.mp3` (vurmalı) | OpenGameArt "Happy Clappy Loop" https://opengameart.org/content/happy-clappy-loop (~110 BPM, piyano + el çırpma; katmanlar parçanın kendisinden ayrıldı: HPSS) | OwlishMedia | CC0 |
| Ana menü müziği | `muzik_menu.mp3` | OpenGameArt "Urban Shop" https://opengameart.org/content/urban-shop (92 BPM, döngü) | MintoDog | CC0 |

Notlar:
- Freesound dosyaları sitenin herkese açık önizleme kopyasından (HQ MP3) alındı; lisans sesin kendisi için geçerlidir (CC0).
- Kenney paketlerinin lisans dosyası (`License.txt`, CC0) paketlerin içinde; kaynak dosyalar `tools/ses/kaynak/`.
- Oyun müziği 110 BPM (istenen aralık 100–120). Menü parçası daha sakin (92 BPM). Sözlü jingle/seslendirme yok.
- Toplam boyut `sesler.json` → `toplamKB` (~1 MB).
