// NPC dil motoru testi: node tools/npc-dil-test.cjs
// Her satir GECTI/KALDI yazar; sonda ornek uretimler. Bir test kalirsa cikis kodu 1.
'use strict';
const path = require('path');
const D = require(path.join(__dirname, '..', 'npc-dil.js'));

let gecen = 0, kalan = 0;
const kalanlar = [];
function test(ad, kosul, ayrinti) {
  if (kosul) { gecen++; console.log('GEÇTİ  ' + ad); }
  else { kalan++; kalanlar.push(ad); console.log('KALDI  ' + ad + (ayrinti ? '  -> ' + ayrinti : '')); }
}
function esit(ad, gercek, beklenen) {
  test(ad, JSON.stringify(gercek) === JSON.stringify(beklenen), 'beklenen ' + JSON.stringify(beklenen) + ', gelen ' + JSON.stringify(gercek));
}

// ---------------------------------------------------------------
// 0. API
// ---------------------------------------------------------------
['normal', 'dilBul', 'niyetBul', 'uret', 'stillendir', 'takmaAd'].forEach(f => test('API: ' + f + ' fonksiyon', typeof D[f] === 'function'));
['de', 'e', 'den', 'in', 'i', 'le'].forEach(f => test('API: ek.' + f, typeof D.ek[f] === 'function'));
test('API: globalThis.NPCDil', globalThis.NPCDil === D);

// ---------------------------------------------------------------
// 1. normal()
// ---------------------------------------------------------------
{
  const n = D.normal('SLM KNK NBR, İYİ MİSİN? Işık');
  esit('normal: Türkçe küçültme + kısaltma', n.kucuk, 'selam kanka ne haber iyi misin ışık');
  esit('normal: katli', n.katli, 'selam kanka ne haber iyi misin isik');
  test('normal: kelimeler dizi', Array.isArray(n.kelimeler) && n.kelimeler.length === 7);
  esit('normal: ham korunur', n.ham, 'SLM KNK NBR, İYİ MİSİN? Işık');
  esit('normal: mrb/tşk/tmm/bi', D.normal('mrb tşk tmm bi bakarım').kucuk, 'merhaba teşekkürler tamam bir bakarım');
  esit('normal: nap / napıyon', D.normal('napıyon').kucuk, 'ne yapıyorsun');
  esit('normal: sağol, eyw, hcm, kib, bb', D.normal('sağol eyw hcm kib bb').kucuk, 'sağ ol eyvallah hocam kendine iyi bak bay bay');
  esit('normal: meraba, nslsn', D.normal('meraba nslsn').kucuk, 'merhaba nasılsın');
  esit('normal: sayılar korunur', D.normal('1.500.000 tl, 1,5 milyon!').kucuk, '1.500.000 tl 1,5 milyon');
  esit('normal: uzatılmış harfler', D.normal('selaaaam').kucuk, 'selam');
  esit('normal: -yo ağzı', D.normal('param yetmiyo').kucuk, 'param yetmiyor');
  esit('normal: -yosun/-yon', D.normal('kaç veriyosun nerden yazıyon').kucuk, 'kaç veriyorsun nereden yazıyorsun');
  esit('normal: bitişik soru eki', D.normal('kuryemisin varmı olurmu').kucuk, 'kurye misin var mı olur mu');
  esit('normal: alıyomusunuz', D.normal('eleman alıyomusunuz').kucuk, 'eleman alıyor musunuz');
  esit('normal: gelecek zaman ağzı', D.normal('alıcam gelicem yapıcaz açcam').kucuk, 'alacağım geleceğim yapacağız açacağım');
  esit('normal: hocam/amcam/kocam bozulmaz', D.normal('hocam amcam kocam').kucuk, 'hocam amcam kocam');
  esit('normal: satıyomuşsun', D.normal('satıyomuşsun').kucuk, 'satıyormuşsun');
  esit('normal: sry/nope/evt', D.normal('sry nope evt').kucuk, 'kusura bakma hayır evet');
}

// ---------------------------------------------------------------
// 2. Niyet doğruluğu
// ---------------------------------------------------------------
const baglam = {
  adlar: ['Mehmet', 'Ayşe Yılmaz', 'Can', 'Selin', 'Burak Kaya', 'Zeynep'],
  oyuncuAd: 'Eymen',
  meslekler: { kurye: 'Kurye', garson: 'Garson', muhasebeci: 'Muhasebeci' }
};
const ORNEK = [
  // selam
  ['selam', 'selam'], ['merhaba', 'selam'], ['slm', 'selam'], ['Selamün aleyküm', 'selam'], ['mrb herkese', 'selam'],
  ['günaydın millet', 'selam'], ['sa', 'selam'], ['hey', 'selam'],
  // hal_hatir
  ['nasılsın', 'hal_hatir'], ['naber', 'hal_hatir'], ['selam nasılsın', 'hal_hatir'], ['nbr knk', 'hal_hatir'],
  ['ne var ne yok', 'hal_hatir'], ['napıyon', 'hal_hatir'], ['iyi misin abi', 'hal_hatir'], ['nslsn', 'hal_hatir'],
  // tesekkur
  ['teşekkürler', 'tesekkur'], ['tşk', 'tesekkur'], ['sağol abi', 'tesekkur'], ['çok teşekkür ederim yardımın için', 'tesekkur'],
  ['eyvallah', 'tesekkur'], ['tesekkurler kanka', 'tesekkur'],
  // veda
  ['görüşürüz', 'veda'], ['bb', 'veda'], ['hadi ben kaçtım', 'veda'], ['iyi geceler herkese', 'veda'], ['kendine iyi bak', 'veda'],
  ['sonra konuşuruz', 'veda'],
  // tebrik
  ['tebrikler!', 'tebrik'], ['hayırlı olsun yeni dükkanın', 'tebrik'], ['helal olsun sana', 'tebrik'], ['tebrik ederim kursu bitirmişsin', 'tebrik'],
  ['bravo', 'tebrik'],
  // ozur
  ['özür dilerim', 'ozur'], ['kusura bakma geç yazdım', 'ozur'], ['pardon yanlışlıkla yazdım', 'ozur'], ['affedersin', 'ozur'],
  // evet / hayir
  ['evet', 'evet'], ['aynen', 'evet'], ['tabii', 'evet'], ['olur', 'evet'], ['hayır', 'hayir'], ['yok', 'hayir'],
  ['istemiyorum', 'hayir'], ['yok kalsın', 'hayir'], ['gerek yok', 'hayir'],
  // is_ariyorum
  ['iş arıyorum', 'is_ariyorum'], ['is ariyorum yardim edin', 'is_ariyorum'], ['kurye olarak iş arıyorum', 'is_ariyorum'],
  ['eleman arayan var mı', 'is_ariyorum'], ['işsizim ne yapsam', 'is_ariyorum'], ['beni işe alır mısın', 'is_ariyorum'],
  ['garson arayan var mı', 'is_ariyorum'], ['çalışacak bir yer arıyorum', 'is_ariyorum'], ['iş lazım acil', 'is_ariyorum'],
  // eleman_ariyorum
  ['eleman arıyorum', 'eleman_ariyorum'], ['kafeme garson arıyorum', 'eleman_ariyorum'], ['kurye aranıyor', 'eleman_ariyorum'],
  ['dükkanıma eleman lazım', 'eleman_ariyorum'], ['personel alımı yapıyoruz', 'eleman_ariyorum'], ['ekibimize muhasebeci arıyoruz', 'eleman_ariyorum'],
  // maas_sorusu
  ['maaşlar ne kadar', 'maas_sorusu'], ['kurye ne kadar kazanıyor', 'maas_sorusu'], ['memur maaşı kaç', 'maas_sorusu'],
  ['ayda ne kadar kazanıyorsun', 'maas_sorusu'], ['garsonlar kaç para alıyor', 'maas_sorusu'],
  // meslek_tavsiyesi
  ['hangi meslek daha iyi', 'meslek_tavsiyesi'], ['kurye mi olsam garson mu', 'meslek_tavsiyesi'], ['ne iş yapayım', 'meslek_tavsiyesi'],
  ['muhasebeci olmak mantıklı mı', 'meslek_tavsiyesi'], ['hangisi daha çok kazandırır', 'meslek_tavsiyesi'], ['usta olsam mı', 'meslek_tavsiyesi'],
  // kurs_sorusu
  ['muhasebe kursu kaç gün sürüyor', 'kurs_sorusu'], ['kurs almak mantıklı mı', 'kurs_sorusu'], ['kademe atlamak için ne lazım', 'kurs_sorusu'],
  ['sertifika nasıl alınıyor', 'kurs_sorusu'], ['kursa başladın mı', 'kurs_sorusu'],
  // mulk_satiyorum
  ['satılık dairem var', 'mulk_satiyorum'], ['Kadıköyde dükkan satıyorum', 'mulk_satiyorum'], ['arsamı satmak istiyorum', 'mulk_satiyorum'],
  ['dairemi kiraya veriyorum', 'mulk_satiyorum'], ['evimi satacağım alan var mı', 'mulk_satiyorum'], ['satılık 2+1 ilgilenen var mı', 'mulk_satiyorum'],
  // mulk_ariyorum
  ['kiralık daire arıyorum', 'mulk_ariyorum'], ['satılık ev var mı', 'mulk_ariyorum'], ['ev almak istiyorum', 'mulk_ariyorum'],
  ['Beşiktaşta dükkan bakıyorum', 'mulk_ariyorum'], ['arsa arıyoruz', 'mulk_ariyorum'], ['1+1 lazım acil', 'mulk_ariyorum'],
  ['kiralık ev nerede bulurum', 'mulk_ariyorum'],
  // fiyat_sorusu
  ['bu daire kaç para', 'fiyat_sorusu'], ['fiyatı ne kadar', 'fiyat_sorusu'], ['Üsküdarda daireler kaça', 'fiyat_sorusu'],
  ['metrekare fiyatı ne', 'fiyat_sorusu'], ['dükkan fiyatları pahalı mı', 'fiyat_sorusu'],
  // ekonomi
  ['dolar ne olur sizce', 'ekonomi'], ['faizler artacak mı', 'ekonomi'], ['enflasyon çok yüksek', 'ekonomi'], ['altın mı alsam', 'ekonomi'],
  ['her şeye zam geldi', 'ekonomi'], ['borsa nasıl', 'ekonomi'], ['piyasa çok durgun', 'ekonomi'], ['yatırım için ne önerirsin', 'ekonomi'],
  // kredi_sorusu
  ['kredi çekmeli miyim', 'kredi_sorusu'], ['bankadan kredi nasıl alınır', 'kredi_sorusu'], ['borcumu nasıl kapatırım', 'kredi_sorusu'],
  ['taksit ödemezsem ne olur', 'kredi_sorusu'], ['kredi faizi kaç', 'kredi_sorusu'],
  // bayram
  ['iyi bayramlar', 'bayram'], ['bayramınız mübarek olsun', 'bayram'], ['mutlu yıllar herkese', 'bayram'], ['Ramazan Bayramınız kutlu olsun', 'bayram'],
  ['29 Ekim kutlu olsun', 'bayram'],
  // dert
  ['moralim çok bozuk', 'dert'], ['param bitti', 'dert'], ['bu ay zarar ettim', 'dert'], ['battım ya', 'dert'], ['canım sıkkın', 'dert'],
  ['of ya hiçbir şey yolunda değil', 'dert'], ['işten kovuldum', 'dert'], ['geçinemiyorum artık', 'dert'], ['çok yoruldum bugün', 'dert'],
  // kisisel_meslek
  ['ne iş yapıyorsun', 'kisisel_meslek'], ['mesleğin ne', 'kisisel_meslek'], ['sen ne iş yapıyosun', 'kisisel_meslek'],
  ['nerede çalışıyorsun', 'kisisel_meslek'], ['ne is yapiyorsun abi', 'kisisel_meslek'],
  // kisisel_yer
  ['nerelisin', 'kisisel_yer'], ['nerdesin', 'kisisel_yer'], ['nerede oturuyorsun', 'kisisel_yer'], ['memleket neresi', 'kisisel_yer'],
  ['hangi şehirdesin', 'kisisel_yer'],
  // kisisel_ad
  ['adın ne', 'kisisel_ad'], ['ismin ne', 'kisisel_ad'], ['sen kimsin', 'kisisel_ad'], ['tanışalım mı', 'kisisel_ad'],
  // bot_musun
  ['bot musun', 'bot_musun'], ['sen gerçek misin', 'bot_musun'], ['yapay zeka mısın', 'bot_musun'], ['robot musun la', 'bot_musun'],
  ['gerçek insan mısın', 'bot_musun'], ['npc misin', 'bot_musun'],
  // iltifat
  ['çok iyisin', 'iltifat'], ['harikasın abi', 'iltifat'], ['sen bir tanesin', 'iltifat'], ['çok yardımcısın teşekkür', 'iltifat'],
  ['kralsın', 'iltifat'], ['iyi ki varsın', 'iltifat'],
  // hakaret
  ['salak mısın', 'hakaret'], ['aptal', 'hakaret'], ['amk ya', 'hakaret'], ['s*ktir git', 'hakaret'], ['gerizekalı', 'hakaret'],
  ['defol', 'hakaret'], ['a.q', 'hakaret'], ['mal mısın sen', 'hakaret'],
  // saka
  ['hahaha', 'saka'], ['sjsjsjs', 'saka'], ['ksksksk', 'saka'], ['çok komik', 'saka'], [':D', 'saka'], ['ahahah olmaz böyle', 'saka'],
  ['xd', 'saka'],
  // yardim
  ['oyun nasıl oynanır', 'yardim'], ['ne yapmalıyım', 'yardim'], ['yeniyim yardım eder misiniz', 'yardim'], ['nasıl para kazanırım', 'yardim'],
  ['nereden başlamalıyım', 'yardim'], ['ipucu verir misin', 'yardim'],
  // zam_istegi
  ['zam istiyorum', 'zam_istegi'], ['maaşımı artırır mısın', 'zam_istegi'], ['patron zam yapar mısın', 'zam_istegi'], ['maaşım çok az', 'zam_istegi'],
  ['zam ne zaman', 'zam_istegi'],
  // yetki_istegi
  ['bana yetki verir misin', 'yetki_istegi'], ['beni müdür yap', 'yetki_istegi'], ['terfi istiyorum', 'yetki_istegi'], ['kasaya ben bakabilir miyim', 'yetki_istegi'],
  // teklif
  ['30 bine olur mu', 'teklif'], ['1.6 milyona alırım', 'teklif'], ['500 bin veririm', 'teklif'], ['son fiyat 2 milyon', 'teklif'],
  ['34k maaşa çalışırım', 'teklif'], ['1,5 milyona satar mısın', 'teklif'], ['teklifim 900 bin', 'teklif'],
  // oneri_kabul
  ['tamam anlaştık', 'oneri_kabul'], ['kabul ediyorum', 'oneri_kabul'], ['teklifini kabul ediyorum', 'oneri_kabul'], ['razıyım', 'oneri_kabul'],
  ['ben varım', 'oneri_kabul'],
  // genel
  ['bugün hava çok güzel', 'genel'], ['dün maç izledim', 'genel'], ['kedi besliyorum', 'genel'],
  // kurallara bakmadan sonradan yazılan cümleler (ezber denetimi)
  ['slm millet nasılsınız', 'hal_hatir'], ['herkese merhabalar', 'selam'], ['abi çok sağ ol eksik olma', 'tesekkur'],
  ['hadi ben yatıyorum iyi geceler', 'veda'], ['yeni dükkanın hayırlı uğurlu olsun', 'tebrik'], ['ya kusura bakmayın geç kaldım', 'ozur'],
  ['aynen öyle', 'evet'], ['yok abi istemem', 'hayir'], ['herhangi bir iş olsa yaparım iş var mı', 'is_ariyorum'],
  ['bize bir garson lazım', 'eleman_ariyorum'], ['muhasebeciler ayda kaç para kazanıyor', 'maas_sorusu'],
  ['sence hangi mesleği seçeyim', 'meslek_tavsiyesi'], ['emlak kursu ne kadar sürüyor', 'kurs_sorusu'],
  ['elimdeki arsayı satıyorum', 'mulk_satiyorum'], ['kadıköyde kiralık 1+1 bakıyorum', 'mulk_ariyorum'], ['şu dükkan kaça satılır', 'fiyat_sorusu'],
  ['dolar yine uçtu', 'ekonomi'], ['kredi çekmek mantıklı mı şu an', 'kredi_sorusu'], ['kurban bayramınız mübarek olsun', 'bayram'],
  ['bu ay çok kötü geçti param kalmadı', 'dert'], ['sen ne iş yaparsın', 'kisisel_meslek'], ['aslen nerelisin', 'kisisel_yer'],
  ['ismin neydi', 'kisisel_ad'], ['sen bot musun yoksa', 'bot_musun'], ['çok tatlısın ya', 'iltifat'], ['sen tam bir aptalsın', 'hakaret'],
  ['jsjsjsjs öldüm', 'saka'], ['bu oyunda ne yapmam lazım', 'yardim'], ['patron maaşıma biraz zam olsa', 'zam_istegi'],
  ['dükkanı ben yöneteyim mi', 'yetki_istegi'], ['800 bine veriyorsan alırım', 'teklif'], ['tamam o zaman anlaştık', 'oneri_kabul'],
  ['akşam ne yesek', 'genel'], ['naptın bugün', 'hal_hatir'], ['eyw kanka', 'tesekkur'], ['iş bulamıyorum yardım', 'is_ariyorum'],
  ['maaş ne kadar veriyorsunuz', 'maas_sorusu'], ['ev fiyatları çok arttı', 'ekonomi'], ['faiz oranı ne kadar', 'ekonomi'],
  ["istanbul'da ev almak istiyorum", 'mulk_ariyorum'], ['yorgunluktan öldüm', 'dert'], ['hahah çok iyi', 'saka'],
  ['bana bir iş ver', 'is_ariyorum'], ['kurye lazım mı', 'eleman_ariyorum'],
  // genel kalip varyantlari (kor set gelistirmesinden sonra; her kural icin farkli yazilmis cumleler)
  // agiz -yo/-yon, bitisik soru eki
  ['maaş yetmiyo ya', 'dert'], ['kira ödeyemiyom bu ay', 'dert'], ['param hiç yetmiyo', 'dert'],
  ['kaç para veriyonuz', 'maas_sorusu'], ['ayda kaç veriyosunuz', 'maas_sorusu'], ['ne kadar ödüyonuz', 'maas_sorusu'],
  ['garsonmusun', 'kisisel_meslek'], ['muhasebecimisin sen', 'kisisel_meslek'], ['sen usta mısın', 'kisisel_meslek'],
  ['izmirde misin', 'kisisel_yer'], ['ankaradamısın', 'kisisel_yer'], ['bursalı var mı burda', 'kisisel_yer'],
  ['nerden yazıyon', 'kisisel_yer'], ['hangi şehirden yazıyosun', 'kisisel_yer'], ['nereli olduğunu sorsam', 'kisisel_yer'],
  // -lik ariyorum / X alinir
  ['kuryelik arıyorum', 'is_ariyorum'], ['şoförlük bakıyorum', 'is_ariyorum'], ['muhasebecilik arıyorum bilen var mı', 'is_ariyorum'],
  ['kurye alınır', 'eleman_ariyorum'], ['kafeye garson alıcam', 'eleman_ariyorum'], ['dükkana bir kasiyer alıyoruz', 'eleman_ariyorum'],
  ['garson alıyo musunuz', 'is_ariyorum'], ['kim kurye alıyor', 'is_ariyorum'], ['eleman alan yer var mı', 'is_ariyorum'],
  ['bi iş bulun bana', 'is_ariyorum'], ['iş olan varsa yazsın', 'is_ariyorum'], ['her türlü işte çalışırım', 'is_ariyorum'],
  // nasil -ilir / ne ise yarar
  ['dükkan nasıl kiralanır', 'yardim'], ['maaş nasıl yükseltilir', 'yardim'], ['nasıl para biriktiririm', 'yardim'],
  ['kum saati ne işe yarıyor', 'yardim'], ['itibar ne işe yarar', 'yardim'], ['ayarlar nerede', 'yardim'],
  // ortaklik
  ['ortak olalım mı', 'teklif'], ['birlikte bir kafe kuralım', 'teklif'], ['beraber arsa alalım mı', 'teklif'],
  // tebrik
  ['helal olsun be', 'tebrik'], ['maşallah çok iyi gidiyorsun', 'tebrik'], ['ellerine sağlık dükkan çok güzel olmuş', 'tebrik'],
  // ozur / hayir / evet / veda
  ['sry geç kaldım', 'ozur'], ['kb yanlış yazdım', 'ozur'], ['sorry', 'ozur'],
  ['nope', 'hayir'], ['yook', 'hayir'], ['evt', 'evet'],
  ['ben kaçayım artık', 'veda'], ['hoşçakal kanka', 'veda'], ['hadi ben gidiyorum', 'veda'],
  // saka
  ['hahahaha', 'saka'], ['ahahahah çok iyi', 'saka'], ['asdfghj', 'saka'], ['zengin olunca hepinize kahve ısmarlarım', 'saka'],
  // kisisel_ad / bot
  ['isminiz ne', 'kisisel_ad'], ['nickin ne demek', 'kisisel_ad'], ['kullanıcı adın neden böyle', 'kisisel_ad'],
  ['bunlar bot mu', 'bot_musun'], ['burada gerçek kişi var mı', 'bot_musun'], ['hepsi npc mi', 'bot_musun'],
  // iltifat / hakaret
  ['çok akıllısın ya', 'iltifat'], ['ne güzel anlatıyorsun', 'iltifat'], ['çok bilgilisiniz', 'iltifat'], ['salak bot', 'hakaret'],
  // maas
  ['prim veriliyor mu', 'maas_sorusu'], ['yevmiye ne kadar', 'maas_sorusu'], ['net maaş ne kadar', 'maas_sorusu'],
  // meslek tavsiyesi / kurs
  ['en garanti meslek hangisi', 'meslek_tavsiyesi'], ['kuryelikten sonra ne yapayım', 'meslek_tavsiyesi'], ['usta olmaya değer mi', 'meslek_tavsiyesi'],
  ['sınav ne zaman', 'kurs_sorusu'], ['ehliyet nasıl alınır', 'kurs_sorusu'], ['muhasebeci olmak için ne gerekiyor', 'kurs_sorusu'],
  // fiyat / ekonomi
  ['biraz iner mi', 'fiyat_sorusu'], ['en son kaça olur', 'fiyat_sorusu'], ['daireler ucuzlar mı', 'fiyat_sorusu'],
  ['kiralar neden bu kadar arttı', 'ekonomi'], ['dolar düşer mi', 'ekonomi'], ['market zamlanmış yine', 'ekonomi'],
  // mulk
  ['kadıköyde ev var mı', 'mulk_ariyorum'], ['ucuz dükkan lazım', 'mulk_ariyorum'], ['kiralık 2+1 Üsküdar', 'mulk_ariyorum'],
  ['dükkanımı devrediyorum', 'mulk_satiyorum'], ['kafeyi devredicem alan olur mu', 'mulk_satiyorum'], ['evi satıp araba alcam alacak var mı', 'mulk_satiyorum'],
  // dert
  ['iflas ettim', 'dert'], ['kredim onaylanmadı', 'dert'], ['çalışanlarım istifa etti', 'dert'], ['dolandırıcıya param gitti dolandırıldım', 'dert'],
  // zam / yetki
  ['bu ay da zam yok', 'zam_istegi'], ['biraz daha fazla verseniz', 'zam_istegi'], ['maaşımı 35 bine çıkarır mısın', 'zam_istegi'],
  ['admin olabilir miyim', 'yetki_istegi'], ['moderatör alımı var mı', 'yetki_istegi'], ['bedava para verir misin', 'yetki_istegi'],
  // atif
  ['kurye arıyormuşsun', 'is_ariyorum'], ['arsa satıyormuşsun daha duruyor mu', 'mulk_ariyorum'], ['dükkan hâlâ kiralık mı', 'mulk_ariyorum'],
  // selam
  ['naber gençler', 'selam'], ['selam ahali', 'selam'], ['oyuna yeni katıldım herkese selam', 'selam'], ['hayırlı günler', 'selam']
];
let dogru = 0;
const yanlislar = [];
ORNEK.forEach(([cumle, beklenen]) => {
  const r = D.niyetBul(cumle, baglam);
  if (r.niyet === beklenen) dogru++;
  else yanlislar.push(`  "${cumle}" -> ${r.niyet} (beklenen ${beklenen}, ikinci ${r.ikinci})`);
});
const oran = dogru / ORNEK.length;
console.log(`\nNiyet örnekleri: ${ORNEK.length}, doğru ${dogru}, oran %${(oran * 100).toFixed(1)}`);
if (yanlislar.length) console.log('Yanlışlar:\n' + yanlislar.join('\n'));
test(`niyet: en az 150 örnek (${ORNEK.length})`, ORNEK.length >= 150);
test(`niyet: doğruluk >= %90 (%${(oran * 100).toFixed(1)})`, oran >= 0.9);
const kapsanan = new Set(ORNEK.map(o => o[1]));
D.NIYETLER.forEach(n => test('niyet: örneklerde var: ' + n, kapsanan.has(n)));
{
  const r = D.niyetBul('kaç para kazanıyorsun?', baglam);
  test('niyetBul: alanlar', 'niyet' in r && 'guven' in r && 'ikinci' in r && 'soru' in r && 'kufur' in r && 'varlik' in r);
  test('niyetBul: guven 0..1', r.guven > 0 && r.guven <= 1);
  test('soru: "?" ile', r.soru === true);
  test('soru: mi eki', D.niyetBul('kurs aldın mı', baglam).soru === true);
  test('soru: nasıl', D.niyetBul('nasıl oynanıyor', baglam).soru === true);
  test('soru: düz cümle soru değil', D.niyetBul('bugün çok çalıştım', baglam).soru === false);
}

// ---------------------------------------------------------------
// 3. Varlıklar
// ---------------------------------------------------------------
const tutarlar = [
  ['34 bin', 34000], ['34.000', 34000], ['34k', 34000], ['1,5 milyon', 1500000], ['1.500.000 tl', 1500000], ['500 lira', 500],
  ['2 milyon', 2000000], ['1.6 milyona alırım', 1600000], ['maaş 28.075 TL', 28075], ['750.000₺', 750000], ['yüz bin lira', 100000],
  ['iki buçuk milyon', 2500000], ['bir milyon beş yüz bin', 1500000], ['30 bine olur mu', 30000], ['45bin', 45000],
  ['3 gün sonra', null], ['2+1 daire', null], ['%5 faiz', null], ['2026 yılında', null], ['23 nisan', null], ['merhaba', null]
];
tutarlar.forEach(([m, b]) => esit('tutar: "' + m + '"', D.niyetBul(m, baglam).varlik.tutar, b));
const meslekler = [
  ['taksiciyim', 'nakliyeci'], ['elektrikçi arıyorum', 'usta'], ['tesisatçı lazım', 'usta'], ['kasiyer olarak çalışıyorum', 'market_calisani'],
  ['inşaatta çalışıyorum', 'insaat_iscisi'], ['devlet memuruyum', 'memur'], ['kurye arıyoruz', 'kurye'], ['garsonluk yaptım', 'garson'],
  ['muhasebe biliyorum', 'muhasebeci'], ['emlakçıyım', 'emlak_danismani'], ['emlak ofisi açtım', 'emlak_ofisi_sahibi'],
  ['döviz bürosu işletiyorum', 'doviz_burosu_sahibi'], ['ithalat yapıyorum', 'ithalat_ihracat'], ['müteahhitim', 'muteahhit'],
  ['fabrikatör oldum', 'fabrikator'], ['taşeron firmam var', 'tasaron'], ['kafe sahibiyim', 'kafe_sahibi'], ['bakkalım', 'dukkan_sahibi'],
  ['kamyon şoförüyüm', 'nakliyeci'], ['bugün hava güzel', null],
  ['fabrikama muhasebeci alıyorum', 'muhasebeci'], ['kafeye kurye lazım', 'kurye'], ['inşaat şirketime usta arıyorum', 'usta']
];
meslekler.forEach(([m, b]) => esit('meslek: "' + m + '"', D.niyetBul(m, baglam).varlik.meslek, b));
const mulkler = [
  ['ev arıyorum', 'daire'], ['konut kredisi', 'daire'], ['1+1 kiralık', 'daire'], ['dükkan satıyorum', 'dukkan'], ['arsa lazım', 'arsa'],
  ['tarla aldım', 'arsa'], ['daireler kaça', 'daire'], ['evet', null], ['mağaza açacağım', 'dukkan']
];
mulkler.forEach(([m, b]) => esit('mülk: "' + m + '"', D.niyetBul(m, baglam).varlik.mulk, b));
const yerler = [
  ["Kadıköy'de oturuyorum", 'Kadıköy'], ['besiktasta', 'Beşiktaş'], ['Üsküdar tarafı', 'Üsküdar'], ['ankaradayim', 'Ankara'],
  ['izmirliyim', 'İzmir'], ['sarıyerde ev', 'Sarıyer'], ["Ataşehir'den yazıyorum", 'Ataşehir'], ['Çankaya iyi', 'Çankaya'],
  ['bursalıyım', 'Bursa'], ['istanbulda', 'İstanbul'], ['Fatih\'te dükkan', 'Fatih'], ['Fatih abi selam', null], ['silerim', null],
  ['kartaldan', 'Kartal'], ['merhaba', null]
];
yerler.forEach(([m, b]) => esit('yer: "' + m + '"', D.niyetBul(m, baglam).varlik.yer, b));
const kisiler = [
  ['Mehmet abi selam', 'Mehmet'], ['@Selin naber', 'Selin'], ["Ayşe'ye sordum", 'Ayşe Yılmaz'], ['zeynep haklı', 'Zeynep'],
  ['canım sıkkın', null], ['Can geldi mi', 'Can'], ['Burak Kaya ne diyor', 'Burak Kaya'], ["Mehmet'in dükkanı", 'Mehmet'],
  ['Eymen burada', null], ['selam millet', null]
];
kisiler.forEach(([m, b]) => esit('kişi: "' + m + '"', D.niyetBul(m, baglam).varlik.kisi, b));
esit('kanal: global', D.niyetBul('global kanalda yazdım', baglam).varlik.kanal, 'global');
esit('kanal: dm', D.niyetBul('dm atarım', baglam).varlik.kanal, 'dm');
esit('kanal: yok', D.niyetBul('selam', baglam).varlik.kanal, null);

const kufurlu = ['amk', 'aq', 'a.q', 'siktir', 's*ktir', 'orospu', 'piç', 'ibne', 'şerefsiz', 'yavşak', 'amına', 'oç', 'o.ç', 'mk ya',
  'sg lan', 'pezevenk', 'kahpe', 'yarrak', 'AMK', 'serefsiz'];
const temiz = ['sıkıldım', 'sikildim', 'sıkıntı', 'sikinti var', 'sıkışık', 'amin', 'amca', 'merhaba', 'sık sık', 'Sıkıcı', 'aşk', 'mal aldım',
  'bokser', 'akşam', 'gotik', 'kaşık', 'sıcak', 'siciliyim'];
kufurlu.forEach(w => test('küfür tespit: "' + w + '"', D.niyetBul(w, baglam).kufur === true));
temiz.forEach(w => test('küfür değil: "' + w + '"', D.niyetBul(w, baglam).kufur === false));

const diller = [
  ['merhaba nasılsın', 'tr'], ['selam abi iş var mı', 'tr'], ['tesekkurler kanka', 'tr'], ['Hello everyone, how are you?', 'en'],
  ['anyone hiring?', 'en'], ['Hallo zusammen, wie geht es euch?', 'de'], ['Guten Morgen', 'de'], ['¡Hola a todos!', 'es'],
  ['hola que tal amigos', 'es'], ['Salam, necəsən?', 'az'], ['salam qardaş necesen', 'az'], ['مرحبا كيف حالك', 'ar'],
  ['marhaba habibi', 'ar'], ['günaydın', 'tr'], ['Kadıköy\'de satılık daire', 'tr']
];
diller.forEach(([m, b]) => esit('dil: "' + m + '"', D.dilBul(m), b));

// ---------------------------------------------------------------
// 4. Ek uyumu
// ---------------------------------------------------------------
const E = D.ek;
const ekler = [
  ['de', 'Kadıköy', "Kadıköy'de"], ['de', 'Beşiktaş', "Beşiktaş'ta"], ['e', 'Üsküdar', "Üsküdar'a"], ['den', 'Kartal', "Kartal'dan"],
  ['in', 'Eymen', "Eymen'in"], ['in', 'Ayşe', "Ayşe'nin"], ['e', 'Ankara', "Ankara'ya"], ['de', 'İzmir', "İzmir'de"],
  ['e', 'Sarıyer', "Sarıyer'e"], ['den', 'Ataşehir', "Ataşehir'den"], ['e', '5', "5'e"], ['e', '6', "6'ya"],
  ['e', '1.500.000 TL', "1.500.000 TL'ye"], ['e', '1.500.000 ₺', "1.500.000 ₺'ye"], ['de', '3', "3'te"], ['de', '4', "4'te"],
  ['den', '5', "5'ten"], ['de', '100', "100'de"], ['e', '1000', "1000'e"], ['in', '1.500.000', "1.500.000'in"],
  ['e', '40', "40'a"], ['de', '2026', "2026'da"], ['i', 'Kadıköy', "Kadıköy'ü"], ['i', 'Ayşe', "Ayşe'yi"], ['i', 'Beşiktaş', "Beşiktaş'ı"],
  ['le', 'Eymen', "Eymen'le"], ['le', 'Ayşe', "Ayşe'yle"], ['in', 'Murat', "Murat'ın"], ['in', 'Ömer', "Ömer'in"],
  ['in', 'Okan', "Okan'ın"], ['in', 'Ufuk', "Ufuk'un"], ['in', 'Üsküdar', "Üsküdar'ın"], ['e', 'Kemal', "Kemal'e"],
  ['de', 'Bakırköy', "Bakırköy'de"], ['de', 'Esenyurt', "Esenyurt'ta"], ['den', 'Şişli', "Şişli'den"], ['e', 'Tuzla', "Tuzla'ya"],
  ['de', 'Pendik', "Pendik'te"], ['den', 'Beykoz', "Beykoz'dan"], ['e', 'İstanbul', "İstanbul'a"], ['de', 'AVM', "AVM'de"],
  ['e', 'Muhasebe Kursu', "Muhasebe Kursu'na"], ['de', 'Kahve Durağı', "Kahve Durağı'nda"], ['i', 'Ramazan Bayramı', "Ramazan Bayramı'nı"],
  ['i', '23 Nisan', "23 Nisan'ı"], ['e', 'Mehmet Ali', "Mehmet Ali'ye"], ['de', 'daire', 'dairede'], ['e', 'dükkan', 'dükkana'],
  ['i', 'arsa', 'arsayı'], ['e', 'durak', 'durağa'], ['den', 'market', "marketten"], ['li', 'Kadıköy', 'Kadıköylü'], ['li', 'İzmir', 'İzmirli'],
  ['e', 'yılbaşı', 'yılbaşına'], ['e', 'saat', 'saate']
];
ekler.forEach(([f, s, b]) => esit('ek.' + f + '(' + s + ')', E[f](s), b));
test('ek: en az 40 örnek (' + ekler.length + ')', ekler.length >= 40);

// ---------------------------------------------------------------
// 5. Üretim: her anahtar, 3 tohum x 3 stil
// ---------------------------------------------------------------
const SLOT = {
  ad: 'Selin', oyuncuAd: 'Eymen', meslek: 'kurye', yer: 'Kadıköy', tutar: '1.500.000 ₺', isletme: 'Kahve Durağı',
  kurs: 'Muhasebe Kursu', mulk: 'daire', sayi: '2', gun: '3 gün', ay: 'Kasım', kisi: 'Mehmet', konu: 'Ramazan Bayramı'
};
const STILLER = [
  { resmi: 0.9, emoji: 0, kisaltma: 0, hata: 0, nese: 0.2, uzunluk: 0.9, ascii: false, buyukHarf: true },
  { resmi: 0.1, emoji: 0.9, kisaltma: 0.9, hata: 0.6, nese: 0.8, uzunluk: 0.2, ascii: false, buyukHarf: false },
  { resmi: 0.4, emoji: 0.4, kisaltma: 0.3, hata: 0.1, nese: -0.6, uzunluk: 0.5, ascii: true }
];
const GEREKLI = [];
['selam', 'hal_hatir', 'tesekkur', 'veda', 'tebrik', 'ozur', 'evet', 'hayir', 'is_ariyorum', 'eleman_ariyorum', 'maas_sorusu',
  'meslek_tavsiyesi', 'kurs_sorusu', 'mulk_satiyorum', 'mulk_ariyorum', 'fiyat_sorusu', 'ekonomi', 'kredi_sorusu', 'bayram', 'dert',
  'kisisel_meslek', 'kisisel_yer', 'kisisel_ad', 'bot_musun', 'iltifat', 'hakaret', 'saka', 'yardim', 'teklif', 'genel', 'anlamadim',
  'tanidik_selam', 'tavsiye_meslek', 'is_teklif_ediyorum', 'zam_istegi'].forEach(n => GEREKLI.push('cevap.' + n));
['gunaydin', 'iyi_aksamlar', 'is_degisti', 'kurs_basladi', 'kurs_bitti', 'ay_sonu_iyi', 'ay_sonu_kotu', 'mulk_aldi', 'mulk_satti',
  'isletme_acti', 'isletme_kapandi', 'eleman_ariyor', 'is_ariyor', 'satilik', 'ekonomi_zam', 'ekonomi_genel', 'bayram', 'ozel_gun',
  'motivasyon', 'soru', 'gorev_bitti', 'yorgun', 'kredi_cekti', 'bagis', 'zengin_oldu', 'sirket_ici', 'npc_cevap'].forEach(n => GEREKLI.push('paylasim.' + n));
['zam_istegi', 'zam_tesekkur', 'maas_dusurme_tepki', 'istifa', 'is_teklifi', 'mulk_teklifi', 'mulk_teklif_kabul', 'mulk_teklif_red',
  'yetki_verildi', 'yetki_red', 'basvuru_kabul', 'basvuru_pazarlik', 'basvuru_red', 'isten_cikarildi', 'calisan_rapor', 'cevap_genel'].forEach(n => GEREKLI.push('dm.' + n));
['kar', 'zarar', 'calisan'].forEach(n => GEREKLI.push('rapor.' + n));
['en', 'de', 'es', 'az', 'ar'].forEach(d => ['selam', 'paylasim', 'cevap'].forEach(t => GEREKLI.push('global.' + d + '.' + t)));

const mevcut = new Set(D.anahtarlar());
GEREKLI.forEach(a => test('anahtar var: ' + a, mevcut.has(a)));

// sablon sayisi ve cesitlilik
D.anahtarlar().forEach(a => {
  const n = D._sablon[a].length;
  const enAz = a.indexOf('global.') === 0 ? 8 : 7;
  test(`kalıp sayısı ${a} (${n})`, n >= enAz);
});

let uretimHatasi = 0;
const HATA_RE = /[{}\[\]]|undefined|null|NaN/;
GEREKLI.filter(a => mevcut.has(a)).forEach(a => {
  const sonuclar = new Set();
  let sorun = '';
  [1, 2, 3].forEach(tohum => STILLER.forEach((st, si) => {
    let m;
    try { m = D.uret(a, SLOT, st, D.rngOlustur(tohum * 7919 + si)); }
    catch (e) { sorun = 'istisna: ' + e.message; return; }
    if (typeof m !== 'string' || !m.trim()) sorun = 'boş';
    else if (HATA_RE.test(m)) sorun = 'kalıntı: ' + m;
    else if (D.kufurVar(m)) sorun = 'küfür: ' + m;
    sonuclar.add(m);
  }));
  // slotsuz uretim de calismali
  try {
    const m = D.uret(a, {}, {}, D.rngOlustur(5));
    if (!m || HATA_RE.test(m)) sorun = 'slotsuz: ' + m;
  } catch (e) { sorun = 'slotsuz istisna: ' + e.message; }
  if (sorun) uretimHatasi++;
  test('üret: ' + a + ' (' + sonuclar.size + ' farklı)', !sorun && sonuclar.size >= 3, sorun || ('yalnız ' + sonuclar.size + ' farklı'));
});

// determinizm
esit('üret: aynı tohum aynı sonuç', D.uret('cevap.selam', SLOT, STILLER[1], D.rngOlustur(42)), D.uret('cevap.selam', SLOT, STILLER[1], D.rngOlustur(42)));
{
  let farkli = new Set();
  for (let i = 0; i < 40; i++) farkli.add(D.uret('paylasim.gunaydin', { yer: 'Kadıköy' }, {}, D.rngOlustur(i)));
  test('üret: 40 tohumda en az 15 farklı günaydın (' + farkli.size + ')', farkli.size >= 15);
}
// bot_musun: asla gercek insan demez, karakter der
{
  let iyi = true;
  for (let i = 0; i < 60; i++) {
    const m = D.uret('cevap.bot_musun', SLOT, STILLER[i % 3], D.rngOlustur(i));
    const f = D.katla(D.kucult(m));
    if (!/karakter/.test(f) || /gercek insan(im)?\b|insanim|bot degilim/.test(f)) { iyi = false; console.log('   sorunlu: ' + m); }
  }
  test('bot_musun: hep "karakter" der, "gerçek insanım" demez', iyi);
}
// stil etkileri
{
  const r = D.uret('cevap.hal_hatir', { oyuncuAd: 'Eymen' }, { resmi: 1, emoji: 0, kisaltma: 0, hata: 0, uzunluk: 0.5 }, D.rngOlustur(3));
  test('stil resmi: büyük harf + noktalama', /^\p{Lu}/u.test(r) && /[.!?]$/.test(r), r);
  test('stil resmi: "sen" kalmaz', !/(^|\s)sen(\s|[?.!,]|$)/i.test(r), r);
  const a = D.stillendir('Günaydın, işler çok güzel gidiyor', { ascii: true, emoji: 0 }, D.rngOlustur(1));
  test('stil ascii: Türkçe harf yok', !/[çğıöşüÇĞİÖŞÜ]/.test(a), a);
  const k = D.stillendir('selam, tamam bir bakarım teşekkürler', { kisaltma: 1, resmi: 0.2, emoji: 0, hata: 0 }, D.rngOlustur(2));
  test('stil kısaltma: slm/tmm/bi/tşk görülür', /slm|tmm|bi |tşk/.test(k), k);
  let emojiVar = false;
  for (let i = 0; i < 10; i++) if (/\p{Extended_Pictographic}/u.test(D.stillendir('harika bir gün', { emoji: 1, nese: 0.9 }, D.rngOlustur(i)))) emojiVar = true;
  test('stil emoji: yüksek emoji ile emoji gelir', emojiVar);
  let emojiYok = true;
  for (let i = 0; i < 10; i++) if (/\p{Extended_Pictographic}/u.test(D.stillendir('harika bir gün', { emoji: 0 }, D.rngOlustur(i)))) emojiYok = false;
  test('stil emoji: emoji 0 iken yok', emojiYok);
  // hata ve kisaltma yuksekken slot degerleri (sayi, yer, ad) hic bozulmamali
  let sayiBozuk = false;
  for (let i = 0; i < 60; i++) {
    const h = D.uret(i % 2 ? 'paylasim.satilik' : 'paylasim.eleman_ariyor', SLOT, { hata: 1, kisaltma: 0.8, resmi: 0.1, emoji: 0 }, D.rngOlustur(i));
    const kadVar = /kad/i.test(h), sayiVar = /1[.,]?5/.test(h), kahveVar = /kahve/i.test(h);
    if ((kadVar && !/Kadıköy/.test(h)) || (sayiVar && h.indexOf('1.500.000 ₺') < 0) || (kahveVar && !/Kahve Durağı/.test(h))) {
      sayiBozuk = true; console.log('   bozuk: ' + h);
    }
  }
  test('stil hata: sayılar ve adlar bozulmaz', !sayiBozuk);
  const sabit = D.stillendir("Mehmet Kadıköy'de 1.500.000 ₺ istiyor", { hata: 1, resmi: 0.5, buyukHarf: true, emoji: 0 }, D.rngOlustur(9));
  test('stil hata: büyük harfli ad ve sayı dokunulmaz', /^Mehmet Kadıköy'de 1\.500\.000 ₺/.test(sabit), sabit);
  test('büyük harf sayıdan sonraki kelimeye geçmez', !/₺ Mı/.test(D.uret('cevap.teklif', { tutar: '1.500.000 ₺' }, { buyukHarf: true, resmi: 0.9, uzunluk: 0 }, D.rngOlustur(1))));
}
// takma ad ve veri
{
  test('veri: erkek adları >= 150 (' + D.veri.erkekAdlari.length + ')', D.veri.erkekAdlari.length >= 150);
  test('veri: kadın adları >= 150 (' + D.veri.kadinAdlari.length + ')', D.veri.kadinAdlari.length >= 150);
  test('veri: soyadları >= 200 (' + D.veri.soyadlari.length + ')', D.veri.soyadlari.length >= 200);
  test('veri: İstanbul 39 ilçe', D.veri.istanbulIlceleri.length === 39);
  test('veri: yerler >= 15 il', D.veri.yerler.length >= 15);
  ['en', 'de', 'es', 'az', 'ar'].forEach(d => {
    const y = D.veri.yabanci[d];
    test('veri: yabancı ' + d, y && y.adlar.length >= 10 && y.soyadlar.length >= 10 && y.sehirler.length >= 5);
  });
  const tekrar = new Set(D.veri.erkekAdlari).size === D.veri.erkekAdlari.length && new Set(D.veri.soyadlari).size === D.veri.soyadlari.length;
  test('veri: tekrar yok', tekrar);
  const ta = new Set();
  for (let i = 0; i < 30; i++) ta.add(D.takmaAd('Ahmet', 'Yılmaz', D.rngOlustur(i)));
  test('takmaAd: çeşitli (' + ta.size + ')', ta.size >= 10);
  test('takmaAd: ascii ve boşluksuz', [...ta].every(x => /^[A-Za-z0-9._]+$/.test(x)), [...ta].join(' '));
  test('kimlikUygun: ünlü ad-soyad reddedilir', D.kimlikUygun('Cem', 'Yılmaz') === false && D.kimlikUygun('Cem', 'Taş') === true);
  esit('paraYaz', D.paraYaz(1500000), '1.500.000 ₺');
}

// ---------------------------------------------------------------
// 6. Örnek üretimler (göz kontrolü)
// ---------------------------------------------------------------
console.log('\n================ ÖRNEK ÜRETİMLER ================');
const ornekStil = [{ resmi: 0.2, emoji: 0.5, kisaltma: 0.3, hata: 0.05, nese: 0.5, uzunluk: 0.5 }, { resmi: 0.8, emoji: 0.1, kisaltma: 0, hata: 0, nese: 0.2, uzunluk: 0.7, buyukHarf: true }];
GEREKLI.filter(a => mevcut.has(a)).forEach((a, i) => {
  const s1 = D.uret(a, SLOT, ornekStil[0], D.rngOlustur(100 + i));
  const s2 = D.uret(a, SLOT, ornekStil[1], D.rngOlustur(200 + i));
  console.log(a.padEnd(28) + ' | ' + s1 + '\n' + ''.padEnd(28) + ' | ' + s2);
});

console.log(`\nSONUÇ: ${gecen} GEÇTİ, ${kalan} KALDI  (niyet doğruluğu %${(oran * 100).toFixed(1)}, ${ORNEK.length} örnek)`);
if (kalan) { console.log('Kalanlar: ' + kalanlar.join(' | ')); process.exitCode = 1; }
