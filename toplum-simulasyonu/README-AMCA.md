# yapay-zeka/ — NPC yapay zekâsı (Eymen'in Claude'u, Claude 2)

Bu klasör oyundaki NPC'lerin (yapay zekâ karakterlerinin) sohbet ve anlama sistemidir. **Eymen ile Amca'nın anlaşması (26 Kasım 2026):**

- Şimdilik **ayrı** geliştiriliyor. Amca ve Claude 1 oyunun ekonomi ve sistem tarafını (`apps/`, `packages/`, `supabase/`, `ios/` ...) yürütür; Eymen ve Claude 2 yapay zekâyı geliştirmeye devam eder. İkisi ileride birleştirilecek.
- **Claude 1 bu klasöre dokunmaz.** Claude 2 de bu klasörün dışındaki koda dokunmaz (yalnız `CLAUDE_ILETISIM.md`'ye girdi yazar).
- Asıl çalışma Eymen'in deposunda: `eymensancar/eymensancar` → `toplum-simulasyonu/ana-menu/`. Bu klasör oradan **kopyalanır** (`toplum-simulasyonu/esitle-toplum.sh`); burada elle değiştirilmez, her güncellemede baştan yazılır.
- Deneme sürümü (tarayıcıda, Eymen'in hesabında): https://claude.ai/artifact/EG64D5NXMPFWpfQe4LjrEF. TestFlight'a bu klasörden bir şey gönderilmez.

## Ne var
- `index.html`: tarayıcıda çalışan deneme ana menüsü (ekonomi çekirdeği `toplum-cekirdek.js`, Amca'nın `packages/core`'unun derlenmiş hâli).
- `npc-dil.js`: Türkçe anlama (normalleştirme, mesaj türü sınıflandırıcısı: kurallar + küçük bir model) ve cümle kurma (yazım üslubu, kısaltma, yazım hatası).
- `npc-yz.js`: karar ve cevap (oyuncu mesajına cevap, özel mesajlar, konuşma takibi, kanal akışı).
- `npc-iplik.js`: NPC'lerin kendi aralarındaki konuşmalar (binlerce iplik; kaynakları `tools/iplik/`).
- `oyuncu-ilgi.js`: oyuncunun neye baktığını cihazda sayar (hiçbir yere gönderilmez) ve sohbeti buna göre yönlendirir; ilgi iplikleri ve tiyolar `tools/iplik/ilgi-*.json`.
- `npc-sss.js`: bilgi bankası (sık sorulan sorular; kaynakları `tools/sss/`).
- `NPC_YZ.md`: sistemin ayrıntılı notu.
- Testler: `node tools/npc-test.cjs`, `node tools/npc-dil-test.cjs`, sohbet sınavı `node tools/sohbet-sinav.cjs --korpus7` (ve `--korpus6`, `--korpus5`).

## Notlar
- Hepsi **çevrimdışı**: dış hizmet, büyük dil modeli, internet yok (oyun internetsiz de çalışacak).
- Saklı test setleri bu kopyaya konmaz; dürüst ölçüm için yalnız asıl depoda durur ve kimse (Claude'lar dahil) açmaz.
- Bu klasördeki dosyalar Türkçe harf içerir (`CLAUDE.md`'deki "kod ASCII" kuralı bu klasöre uygulanmaz; birleştirme sırasında ele alınacak).
