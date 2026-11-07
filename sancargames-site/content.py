# sancargames.com sayfalarını üretir: Türkçe kökte, İngilizce en/ altında. python3 build.py
import os, html
OUT = os.path.join(os.path.dirname(__file__), 'site')
STORE = 'https://apps.apple.com/app/id6823286892'
YT = 'https://www.youtube.com/@demolitionmastergame'
IG = 'https://www.instagram.com/demolitionmaster.game/'
MAIL = 'support@sancargames.com'
FONTS = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Figtree:wght@400;500;600;700&display=swap">'
APPLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.7c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>'
YT_I = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9l5.8 3.1z"/></svg>'
IG_I = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>'

# her sayfa: (tr dosyası, en dosyası)
P = {'home': ('index.html', 'en/index.html'), 'yk': ('yikim-ustasi.html', 'en/demolition-master.html'),
     'sy': ('sayi-yolu.html', 'en/number-path.html'), 'sup': ('destek.html', 'en/support.html'),
     'pyk': ('gizlilik-yikim-ustasi.html', 'en/privacy-demolition-master.html'),
     'psy': ('gizlilik-sayi-yolu.html', 'en/privacy-number-path.html')}

def rel(frm, to):
    return os.path.relpath(os.path.join(OUT, to), os.path.dirname(os.path.join(OUT, frm))).replace(os.sep, '/')

L = {
 'tr': dict(games='Oyunlar', support='Destek', privacy='Gizlilik', live='Yayında', soon='Yakında', other='EN', other_label='English',
   badge_s="App Store'dan", badge_b='İndirin', more='Oyunu incele', rights='Tüm hakları saklıdır.',
   copy='Kopyala', copied='Kopyalandı', free='Ücretsiz · iPhone ve iPad', soon_store="App Store'da yakında.",
   yk='Yıkım Ustası', yk_sub='Fizik tabanlı yıkım bulmacası', sy='Sayı Yolu', sy_sub='Yol çizme bulmacası', fd='Fenerli Dedektif', fd_sub='Işıkla çözülen kaçış odaları'),
 'en': dict(games='Games', support='Support', privacy='Privacy', live='Out now', soon='Coming soon', other='TR', other_label='Türkçe',
   badge_s='Download on the', badge_b='App Store', more='See the game', rights='All rights reserved.',
   copy='Copy', copied='Copied', free='Free · iPhone and iPad', soon_store='Coming soon to the App Store.',
   yk='Demolition Master', yk_sub='Physics demolition puzzle', sy='Number Path', sy_sub='Path-drawing puzzle', fd='Lantern Detective', fd_sub='Escape rooms solved with light'),
}

def page(key, lang, title, desc, body, nav_cur=None):
    me = P[key][0 if lang == 'tr' else 1]; other = P[key][1 if lang == 'tr' else 0]; t = L[lang]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    css = rel(me, 'assets/style.css')
    cur = lambda k: ' aria-current="page"' if nav_cur == k else ''
    head = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<link rel="alternate" hreflang="tr" href="https://sancargames.com/{P[key][0].replace('index.html','')}">
<link rel="alternate" hreflang="en" href="https://sancargames.com/{P[key][1].replace('index.html','')}">
<link rel="icon" href="{rel(me,'assets/img/favicon.png')}">
{FONTS}
<link rel="stylesheet" href="{css}">
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="{a('home')}"><span class="mk" aria-hidden="true">S</span>Sancar Games</a>
  <nav class="nav" aria-label="{t['games']}">
    <a class="hide-s" href="{a('home')}#oyunlar"{cur('games')}>{t['games']}</a>
    <a href="{a('sup')}"{cur('sup')}>{t['support']}</a>
    <a class="lang" href="{rel(me, other)}" hreflang="{'en' if lang=='tr' else 'tr'}" aria-label="{t['other_label']}">{t['other']}</a>
  </nav>
</div></header>
<main>
'''
    foot = f'''</main>
<footer class="foot-site"><div class="wrap">
  <span>© 2026 Sancar Games. {t['rights']}</span>
  <nav aria-label="footer">
    <a href="{a('sup')}">{t['support']}</a>
    <a href="{a('pyk')}">{t['privacy']}: {t['yk']}</a>
    <a href="{a('psy')}">{t['privacy']}: {t['sy']}</a>
    <a href="{rel(me, other)}">{t['other_label']}</a>
  </nav>
</div></footer>
<script>
document.querySelectorAll('[data-copy]').forEach(function(b){{b.addEventListener('click',function(){{
  var t=b.getAttribute('data-copy'),ok=function(){{b.textContent='{t['copied']}';setTimeout(function(){{b.textContent='{t['copy']}'}},1600)}};
  var sel=function(){{var c=b.parentNode.querySelector('code'),r=document.createRange();r.selectNodeContents(c);var s=getSelection();s.removeAllRanges();s.addRange(r)}};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(t).then(ok,sel);else sel()}})}});
</script>
</body>
</html>
'''
    path = os.path.join(OUT, me); os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(head + body + foot)

def badge(t): return f'<a class="badge" href="{STORE}" target="_blank" rel="noopener">{APPLE}<span><small>{t["badge_s"]}</small><b>{t["badge_b"]}</b></span></a>'
def img(me, n): return rel(me, 'assets/img/' + n)
def phone(me, n, alt=''): return f'<div class="phone"><img src="{img(me,n)}" alt="{html.escape(alt)}" loading="lazy"></div>'
def mailbox(t): return f'<div class="mailbox"><code>{MAIL}</code><button type="button" data-copy="{MAIL}">{t["copy"]}</button></div>'

# ---------------- ana sayfa ----------------
HOME = {
 'tr': dict(title='Sancar Games', desc='Sancar Games, iPhone ve iPad için bulmaca ve fizik oyunları geliştiren bağımsız bir oyun stüdyosu.',
   h1='Kısa, zekice ve sade oyunlar.', lead='Sancar Games, iPhone ve iPad için bulmaca ve fizik oyunları geliştiren bağımsız bir oyun stüdyosu. Birkaç dakikada oynanan, bırakması zor oyunlar yapıyoruz.',
   count='3 oyun', yk_d='Binanın taşıyıcı noktasını bul, patlayıcıyı doğru yere koy ve kuleyi tek hamlede indir. Her bina gerçek fizikle, parça parça çöker.',
   sy_d='Her kareden bir kez geçen tek bir yol çiz; kırmızı sayılara tam o adımda bas. Her gün yeni bir bulmaca.',
   fd_d='Karanlık odalarda fenerini gezdir, gizli ipuçlarını bul, şifreli sandığı aç ve kapıdan çık.',
   studio='Stüdyo', studio_t='Oyunlarımızı baştan sona kendimiz tasarlıyor ve her bölümü oynayarak dengeliyoruz. Hedefimiz basit: açtığın anda anlaşılan, kapattıktan sonra aklında kalan oyunlar.',
   contact='İletişim', contact_t='Bir oyunla ilgili sorun, iş birliği ya da basın için bize yazın.'),
 'en': dict(title='Sancar Games', desc='Sancar Games is an independent studio making puzzle and physics games for iPhone and iPad.',
   h1='Short, clever and simple games.', lead='Sancar Games is an independent studio making puzzle and physics games for iPhone and iPad. We make games you play in a few minutes and find hard to put down.',
   count='3 games', yk_d="Find the tower's load-bearing point, place the charge in the right spot and bring it down in one move. Every building collapses piece by piece with real physics.",
   sy_d='Draw one path that visits every square exactly once and step on each red number at exactly that step. A new puzzle every day.',
   fd_d='Sweep your lantern through dark rooms, find hidden clues, crack the coded chest and escape.',
   studio='Studio', studio_t="We design every game ourselves from start to finish and balance every level by playing it. Our goal is simple: games you understand the moment you open them and remember after you close them.",
   contact='Contact', contact_t='Write to us about a game, a partnership or press.'),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = HOME[lang]; me = P['home'][0 if lang == 'tr' else 1]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    body = f'''<section class="wrap hero">
  <h1>{h['h1']}</h1>
  <p>{h['lead']}</p>
</section>
<section class="wrap sec" id="oyunlar">
  <div class="sec-h"><h2>{t['games']}</h2><span class="label">{h['count']}</span></div>
  <article class="feature">
    <div>
      <div class="ghead"><img src="{img(me,'icon-yk.jpg')}" alt=""><div><h3>{t['yk']}</h3><div class="sub">{t['yk_sub']}</div></div></div>
      <span class="status live">{t['live']}</span>
      <p class="desc">{h['yk_d']}</p>
      <div class="actions">{badge(t)}<a class="more" href="{a('yk')}">{t['more']} →</a></div>
    </div>
    <div class="phones">{phone(me,'yk-1.jpg')}{phone(me,'yk-3.jpg')}</div>
  </article>
  <div class="grid2">
    <article class="card">
      <div class="ghead"><img src="{img(me,'icon-sy.jpg')}" alt=""><div><h3>{t['sy']}</h3><div class="sub">{t['sy_sub']}</div></div></div>
      <p>{h['sy_d']}</p>
      <div class="foot"><span class="status soon">{t['soon']}</span><a class="more" href="{a('sy')}">{t['more']} →</a></div>
    </article>
    <article class="card">
      <div class="ghead"><img src="{img(me,'icon-fd.jpg')}" alt=""><div><h3>{t['fd']}</h3><div class="sub">{t['fd_sub']}</div></div></div>
      <p>{h['fd_d']}</p>
      <div class="foot"><span class="status soon">{t['soon']}</span></div>
    </article>
  </div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{h['studio']}</h2></div>
  <div class="about"><span class="label">Sancar Games</span><p>{h['studio_t']}</p></div>
</section>
<section class="wrap sec" id="iletisim">
  <div class="sec-h"><h2>{h['contact']}</h2></div>
  <p class="muted">{h['contact_t']}</p>
  {mailbox(t)}
</section>
'''
    page('home', lang, h['title'], h['desc'], body, 'games')

# ---------------- Yıkım Ustası ----------------
YK = {
 'tr': dict(title='Yıkım Ustası · Sancar Games', lead="Binanın taşıyıcı noktasını bul, patlayıcıyı doğru yere koy ve kuleyi tek hamlede indir. Her bina gerçek fizikle, parça parça çöker.",
   feats=[('Gerçek fizik', 'Her bina blok blok, gerçek fizikle çöker. Aynı bina iki kez aynı şekilde yıkılmaz.'),
          ('Doğru alet, doğru yer', 'Balyoz, kesici, yıkım topu ve C4. Her binayı en az hamleyle indirmenin yolunu ara.'),
          ('Kombo ve dükkân', 'Art arda yıkımlarla kombo çarpanını büyüt, altınla yeni makineler ve görünümler aç.')],
   follow='Takip et', help='Yardım', langs='20 dilde oynanır.'),
 'en': dict(title='Demolition Master: Tower Blast · Sancar Games', lead="Find the tower's load-bearing point, place the charge in the right spot and bring it down in one move. Every building collapses piece by piece with real physics.",
   feats=[('Real physics', 'Every building falls block by block with real physics. No tower comes down the same way twice.'),
          ('Right tool, right spot', 'Sledgehammer, cutter, wrecking ball and C4. Find the way to bring each building down in the fewest moves.'),
          ('Combos and a shop', 'Chain demolitions to grow your combo multiplier, then spend gold on new machines and looks.')],
   follow='Follow', help='Help', langs='Playable in 20 languages.'),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = YK[lang]; me = P['yk'][0 if lang == 'tr' else 1]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    name = t['yk'] if lang == 'tr' else 'Demolition Master: Tower Blast'
    feats = ''.join(f'<div><b>{x}</b><span>{y}</span></div>' for x, y in h['feats'])
    body = f'''<section class="wrap ghero">
  <div>
    <div class="ghead"><img src="{img(me,'icon-yk.jpg')}" alt=""></div>
    <h1 style="margin-top:22px">{name}</h1>
    <span class="status live">{t['live']}</span>
    <p class="lead">{h['lead']}</p>
    <div class="actions">{badge(t)}<span class="muted" style="font-size:15px">{t['free']}</span></div>
  </div>
  <div class="phones">{phone(me,'yk-1.jpg')}{phone(me,'yk-2.jpg')}</div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{t['games'] if False else ('Öne çıkanlar' if lang=='tr' else 'Highlights')}</h2><span class="label">{h['langs']}</span></div>
  <div class="feats">{feats}</div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{h['follow']}</h2></div>
  <div class="links"><a href="{YT}" target="_blank" rel="noopener">{YT_I}YouTube</a><a href="{IG}" target="_blank" rel="noopener">{IG_I}Instagram</a></div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{h['help']}</h2></div>
  <div class="links"><a href="{a('sup')}">{t['support']}</a><a href="{a('pyk')}">{('Gizlilik Politikası' if lang=='tr' else 'Privacy Policy')}</a></div>
</section>
'''
    page('yk', lang, h['title'], h['lead'], body, 'games')

# ---------------- Sayı Yolu ----------------
SY = {
 'tr': dict(title='Sayı Yolu · Sancar Games', lead='Parmağınla tahtadaki her kareden bir kez geçen tek bir yol çiz. Kırmızı sayılara tam o adımda bas. Kolay başlar, zekice zorlaşır.',
   feats=[('Tek kural', 'Her kareden bir kez geç, yalnızca yatay ve dikey git, kırmızı sayılara tam o adımda bas.'),
          ('Her gün yeni bulmaca', 'Günün bulmacasını çöz, serini koru.'),
          ('Yeni kurallar', 'İlerledikçe taşlar, duvarlar, oklar ve ışınlanma kapıları gibi yeni mekanikler eklenir.')],
   imgs=('sy-intro-tr.jpg', 'sy-play-tr.jpg')),
 'en': dict(title='Number Path · Sancar Games', lead='Draw one path with your finger that visits every square exactly once. Step on each red number at exactly that step. Easy to start, cleverly hard later.',
   feats=[('One rule', 'Visit every square once, move only horizontally or vertically, and hit each red number on exactly that step.'),
          ('A new puzzle every day', "Solve the daily puzzle and keep your streak going."),
          ('New twists', 'As you progress, new mechanics such as rocks, walls, arrows and portals join the board.')],
   imgs=('sy-intro-en.jpg', 'sy-play-en.jpg')),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = SY[lang]; me = P['sy'][0 if lang == 'tr' else 1]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    feats = ''.join(f'<div><b>{x}</b><span>{y}</span></div>' for x, y in h['feats'])
    body = f'''<section class="wrap ghero">
  <div>
    <div class="ghead"><img src="{img(me,'icon-sy.jpg')}" alt=""></div>
    <h1 style="margin-top:22px">{t['sy']}</h1>
    <span class="status soon">{t['soon']}</span>
    <p class="lead">{h['lead']}</p>
    <p class="muted" style="margin-top:20px;font-weight:600">{t['soon_store']}</p>
  </div>
  <div class="phones">{phone(me,h['imgs'][0])}{phone(me,h['imgs'][1])}</div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{'Öne çıkanlar' if lang=='tr' else 'Highlights'}</h2></div>
  <div class="feats">{feats}</div>
</section>
<section class="wrap sec">
  <div class="sec-h"><h2>{'Yardım' if lang=='tr' else 'Help'}</h2></div>
  <div class="links"><a href="{a('sup')}">{t['support']}</a><a href="{a('psy')}">{('Gizlilik Politikası' if lang=='tr' else 'Privacy Policy')}</a></div>
</section>
'''
    page('sy', lang, h['title'], h['lead'], body, 'games')

# ---------------- Destek ----------------
SUP = {
 'tr': dict(title='Destek · Sancar Games', h1='Destek', intro='Bir sorun mu var, bir fikrin mi? Bize yaz, genellikle 2 iş günü içinde dönüyoruz. iPhone modelini ve iOS sürümünü yazarsan daha hızlı yardımcı olabiliriz.',
   faq='Sık sorulanlar',
   yk=[('Telefonumu değiştirdim, ilerlemem nerede?', "İlerlemen iCloud'una yedeklenir. Yeni iPhone'da aynı Apple kimliğiyle giriş yap ve iCloud'un açık olduğundan emin ol (Ayarlar → adın → iCloud). Oyunu açınca kaldığın yerden devam edersin."),
       ('Satın aldığım paket ya da “Reklamsız” kayboldu.', 'Mağaza → Paketler sekmesinin altındaki “Satın alımları geri yükle” düğmesine dokun. Satın almalar Apple kimliğine bağlıdır. Altın paketleri tüketilir, bu yüzden geri yüklenmez; sorun yaşarsan bize yaz.'),
       ('Oyunda ses yok.', "Oyun, kendi müziğini dinlemeye devam edebilmen için iPhone'un sessiz düğmesine uyar. Sessiz düğmesini kapat ve sesi aç; oyun içi ayarlardan sesin açık olduğunu da kontrol et."),
       ('Game Center girişini nasıl açarım?', "Ayarlar → Game Center'dan oturum aç, sonra oyunu yeniden başlat."),
       ('Verilerimi silmek istiyorum.', 'Seni tanımlayan bir veri tutmuyoruz. İlerlemen cihazında ve kendi iCloud hesabında durur. Anonim kullanım istatistikleri ve hata raporları yalnızca uygulamaya özel bir kurulum kimliğine bağlıdır; oyunu silmek bu kimliği ve cihazdaki kopyayı siler. Başka bir talebin varsa bize yaz.')],
   sy=[('İlerlemem nerede tutuluyor?', 'Bölümlerin, yıldızların ve ayarların yalnızca cihazında tutulur. Bizim tarafımızda hesap ya da kişisel veri yoktur.'),
       ('Hatırlatmaları nasıl kapatırım?', "Oyunun ayarlarından ya da iPhone Ayarlar → Bildirimler → Sayı Yolu bölümünden kapatabilirsin.")]),
 'en': dict(title='Support · Sancar Games', h1='Support', intro='Found a bug or have an idea? Write to us; we usually reply within 2 business days. Please mention your iPhone model and iOS version.',
   faq='Frequently asked questions',
   yk=[('I got a new phone. Where is my progress?', 'Your progress is backed up to your iCloud. Sign in with the same Apple ID on the new iPhone and make sure iCloud is on (Settings → your name → iCloud). Open the game and you continue where you left off.'),
       ('My purchase or “No Ads” is missing.', 'Tap “Restore purchases” at the bottom of Store → Packs. Purchases are tied to your Apple ID. Gold packs are consumed, so they cannot be restored; if something went wrong, write to us.'),
       ('There is no sound.', 'So you can keep your own music playing, the game respects the silent switch. Turn the silent switch off and raise the volume, and check that sound is on in the in-game settings.'),
       ('How do I sign in to Game Center?', 'Sign in under Settings → Game Center, then restart the game.'),
       ('I want my data deleted.', 'We keep no data that identifies you. Your progress lives on your device and in your own iCloud account. Anonymous usage statistics and crash reports are tied only to an installation ID for the App; deleting the game removes that ID and the copy on the device. For any other request, write to us.')],
   sy=[('Where is my progress stored?', 'Your levels, stars and settings are stored only on your device. We have no accounts and no personal data.'),
       ('How do I turn off reminders?', "In the game's settings, or in iPhone Settings → Notifications → Number Path.")]),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = SUP[lang]; me = P['sup'][0 if lang == 'tr' else 1]
    det = lambda items: ''.join(f'<details><summary>{q}</summary><p>{a_}</p></details>' for q, a_ in items)
    body = f'''<div class="wrap"><article class="doc">
  <h1>{h['h1']}</h1>
  <p style="margin-top:18px;font-size:18px">{h['intro']}</p>
  {mailbox(t)}
  <div class="faq-g"><h2><img src="{img(me,'icon-yk.jpg')}" alt="">{t['yk'] if lang=='tr' else 'Demolition Master'}</h2>{det(h['yk'])}</div>
  <div class="faq-g"><h2><img src="{img(me,'icon-sy.jpg')}" alt="">{t['sy']}</h2>{det(h['sy'])}</div>
</article></div>
'''
    page('sup', lang, h['title'], h['intro'], body, 'sup')

# ---------------- Gizlilik ----------------
def policy(key, lang, title, h1, meta, intro, secs):
    me = P[key][0 if lang == 'tr' else 1]
    s = ''.join(f'<h2>{a_}</h2>' + ''.join(f'<p>{p}</p>' for p in ps) for a_, ps in secs)
    body = f'<div class="wrap"><article class="doc"><h1>{h1}</h1><p class="meta">{meta}</p><p style="margin-top:22px">{intro}</p>{s}</article></div>\n'
    page(key, lang, title, intro, body)

GL = '<a href="https://policies.google.com/technologies/partner-sites" target="_blank" rel="noopener">policies.google.com/technologies/partner-sites</a>'
ML = f'<a href="mailto:{MAIL}">{MAIL}</a>'
policy('pyk', 'tr', 'Gizlilik Politikası · Yıkım Ustası', 'Gizlilik Politikası', 'Yıkım Ustası · Son güncelleme: 8 Kasım 2026 (1.0.1 sürümünden itibaren)',
  'Bu metin, Yıkım Ustası (“Uygulama”) oyununu oynarken hangi bilgilerin nerede tutulduğunu anlatır.', [
  ('Bizim topladığımız veriler', ['Uygulama hesap açmanı istemez; adın, e-postan, rehberin ya da konumun gibi kişisel bilgilerin toplanmaz ve bizim bir sunucumuz yoktur.']),
  ('Kullanım istatistikleri ve hata raporları', ["Oyunu iyileştirmek için Google'ın Firebase Analytics ve Firebase Crashlytics hizmetlerini kullanırız. Analytics, oyunun nasıl oynandığını gösteren olayları kaydeder: oyunun ilk açılışı, oturum süresi, bir bölümün başlaması, bitmesi ya da süre dolması, ödüllü reklam izlenmesi ve satın alma yapılması gibi. Crashlytics, oyun çöktüğünde ya da bir hata oluştuğunda cihaz modeli, iOS sürümü ve hatanın teknik ayrıntılarını içeren bir rapor gönderir.", "Bu veriler, Firebase'in uygulamaya özel rastgele oluşturduğu bir kurulum kimliğiyle gruplanır. Adınla, Apple kimliğinle ya da reklam kimliğinle (IDFA) ilişkilendirilmez, izleme veya reklam kişiselleştirme için kullanılmaz ve yalnızca toplu olarak, oyunu iyileştirmek için incelenir. Uygulamayı silmek bu kurulum kimliğini de siler. Google'ın bu verileri nasıl işlediği: <a href=\"https://firebase.google.com/support/privacy\" target=\"_blank\" rel=\"noopener\">firebase.google.com/support/privacy</a>."]),
  ("Cihazında ve iCloud'unda saklananlar", ["Oyun ilerlemen (bölüm, altın, makineler, kozmetikler, ses ve titreşim tercihleri) cihazında saklanır. Telefon değiştirdiğinde kaldığın yerden devam edebilmen için bir kopyası Apple'ın iCloud hizmetinde, kendi Apple kimliğine ait alanda tutulur. Bu kopyayı biz göremeyiz. iCloud'u iPhone Ayarlar'ından kapatabilirsin."]),
  ('Game Center', ["Uygulama Apple Game Center'da oturum açmanı isteyebilir. Oturum tamamen Apple tarafından yönetilir; Game Center hesap bilgilerin bize iletilmez."]),
  ('Reklamlar', [f"Uygulamada Google'ın AdMob hizmeti üzerinden reklam gösterilebilir. Ödüllü reklamlar (örneğin ek süre ya da ek altın karşılığında izlenenler) tamamen isteğe bağlıdır. Reklam göstermek, sahtekârlığı önlemek ve reklamların performansını ölçmek için Google cihazından şu bilgileri toplayabilir: IP adresi, yaklaşık konum, cihaz modeli ve işletim sistemi, reklam etkileşimleri ve yalnızca izin verirsen Apple reklam kimliği (IDFA). Uygulama bu izni Apple'ın “Uygulama İzleme Şeffaflığı” penceresiyle sorar. İzin vermezsen reklamlar yine gösterilir ama kişiselleştirilmez. Bu izni istediğin zaman Ayarlar → Gizlilik ve Güvenlik → İzleme bölümünden değiştirebilirsin. Google'ın bu verileri nasıl kullandığı: {GL}.", '“Reklamsız” ya da onu içeren bir paket satın alırsan geçiş reklamları gösterilmez.']),
  ('Uygulama içi satın almalar', ['Satın almalar tamamen Apple tarafından App Store üzerinden işlenir. Ödeme bilgilerini biz görmeyiz; Uygulama yalnızca neyi satın aldığını öğrenir ki içeriği açabilsin.']),
  ('Çocuklar', ['Biz çocuklar dahil kimseden kişisel veri toplamayız. Bir ebeveyn olarak çocuğunla ilgili bir sorun olduğunu düşünüyorsan bize yaz.']),
  ('Hakların', ['Seni tanımlayan bir kayıt tutmuyoruz. Kullanım istatistikleri ve hata raporları kimliğinle eşleşmez; uygulamayı silmek kurulum kimliğini sıfırlar. Avrupa Ekonomik Alanı ve Birleşik Krallık\'ta reklam onayını oyunun Ayarlar → Gizlilik seçenekleri bölümünden istediğin zaman değiştirebilirsin. KVKK veya GDPR kapsamındaki taleplerin ve soruların için bize yazabilirsin.']),
  ('Değişiklikler', ['Bu politikayı güncellersek tarihini bu sayfada değiştiririz.']),
  ('İletişim', [ML])])
policy('pyk', 'en', 'Privacy Policy · Demolition Master', 'Privacy Policy', 'Demolition Master: Tower Blast · Last updated: 8 November 2026 (from version 1.0.1)',
  'This policy explains what information is kept where while you play Demolition Master (the “App”).', [
  ('Data we collect', ['The App does not ask you to create an account. Personal information such as your name, email, contacts or location is never collected, and we run no servers.']),
  ('Usage statistics and crash reports', ["To improve the game we use Google's Firebase Analytics and Firebase Crashlytics. Analytics records events that show how the game is played, such as the first launch, session length, a level starting, being completed or running out of time, a rewarded ad being watched and a purchase being made. When the game crashes or an error occurs, Crashlytics sends a report with the device model, iOS version and technical details of the error.", "This data is grouped by a random installation ID that Firebase creates for the App. It is not linked to your name, your Apple ID or your advertising identifier (IDFA), it is not used for tracking or ad personalisation, and we only review it in aggregate to improve the game. Deleting the App also deletes this installation ID. How Google processes this data: <a href=\"https://firebase.google.com/support/privacy\" target=\"_blank\" rel=\"noopener\">firebase.google.com/support/privacy</a>."]),
  ('What is stored on your device and in your iCloud', ["Your game progress (levels, gold, machines, cosmetics, sound and vibration settings) is stored on your device. So you can continue on a new phone, a copy is kept in Apple's iCloud, in the space that belongs to your own Apple ID. We cannot see this copy. You can turn iCloud off in the iPhone Settings."]),
  ('Game Center', ['The App may ask you to sign in to Apple Game Center. Sign-in is handled entirely by Apple; your Game Center account details are not shared with us.']),
  ('Advertising', [f"The App may show ads served by Google AdMob. Rewarded ads (watched for extra time or extra gold, for example) are always optional. To serve ads, prevent fraud and measure ad performance, Google may collect from your device: IP address, approximate location, device model and operating system, ad interactions and, only if you allow it, Apple's advertising identifier (IDFA). The App asks for this permission through Apple's App Tracking Transparency prompt. If you decline, you still see ads, but they are not personalised. You can change this at any time in Settings → Privacy & Security → Tracking. How Google uses this data: {GL}.", 'If you buy “No Ads” or a pack that includes it, interstitial ads are no longer shown.']),
  ('In-app purchases', ['Purchases are processed entirely by Apple through the App Store. We never see your payment details; the App only learns what you bought so it can unlock it.']),
  ('Children', ['We do not collect personal data from anyone, including children. If you are a parent and believe there is a problem regarding your child, please contact us.']),
  ('Your rights', ['We keep no record that identifies you. Usage statistics and crash reports are not matched to your identity, and deleting the App resets the installation ID. In the European Economic Area and the United Kingdom you can change your ad consent at any time in the game under Settings → Privacy options. For GDPR or similar requests and any questions, write to us.']),
  ('Changes', ['If we update this policy, we will change the date on this page.']),
  ('Contact', [ML])])
policy('psy', 'tr', 'Gizlilik Politikası · Sayı Yolu', 'Gizlilik Politikası', 'Sayı Yolu · Son güncelleme: 8 Kasım 2026',
  "Bu metin, Sayı Yolu'nu (“Uygulama”) oynarken hangi bilginin nerede tutulduğunu anlatır.", [
  ('Hesap yok, kişisel veri yok', ['Uygulama hesap açmanızı istemez. Adınız, e-postanız, rehberiniz, konumunuz ya da başka bir kişisel bilginiz toplanmaz.']),
  ('Cihazınızda tutulanlar', ['İlerlemeniz (bölümler, yıldızlar, en iyi süreler, günlük bulmaca serisi, ipuçları ve ayarlar) yalnız cihazınızda tutulur.']),
  ('Anonim kullanım sayıları', ['Hangi bölümlerin fazla zor olduğunu ve oyuncuların geri dönüp dönmediğini öğrenmek için Uygulama anonim, toplu sayılar gönderir; örneğin “12. bölüm başladı”, “12. bölüm 48 saniyede bitti”, “günlük bulmaca çözüldü”, “ipucu kullanıldı”. Her pakette yalnız uygulama sürümü, uygulama dili ve kurulum günü bulunur. Hiçbir kimlik yoktur (reklam kimliği, cihaz kimliği, hesap yok); bu yüzden sayılar size ya da cihazınıza bağlanamaz, izleme ya da reklam için kullanılmaz. Yalnız bizim okuyabildiğimiz bir tabloda durur ve yalnız oyunu iyileştirmek için kullanılır.']),
  ('Game Center', ["Uygulama başarımlar ve sıralamalar için Apple Game Center'a giriş isteyebilir. Giriş, skorlar ve başarımlar tamamen Apple tarafından yönetilir; Game Center hesap bilgileriniz bizimle paylaşılmaz."]),
  ('Hatırlatmalar', ["Bildirimlere izin verirseniz Uygulama (örneğin günlük bulmaca için) hatırlatmaları cihazınızda planlar. Hatırlatmalar iPhone'un kendisinde oluşturulur, hiçbir sunucuya bir şey gönderilmez. Uygulamanın ayarlarından ya da iPhone Ayarlar'dan kapatabilirsiniz."]),
  ('Reklam', ['İpucunuz kalmadığında Uygulama isteğe bağlı olarak diğer oyunumuzun tanıtımını gösterebilir. Tanıtımı Uygulama kendisi çizer; reklam ağı kullanılmaz, veri toplanmaz.']),
  ('Çocuklar', ['Çocuklar dahil kimseden kişisel veri toplamıyoruz.']),
  ('Değişiklikler ve iletişim', [f'Bu metni güncellersek bu sayfadaki tarihi değiştiririz. Sorular: {ML}'])])
policy('psy', 'en', 'Privacy Policy · Number Path', 'Privacy Policy', 'Number Path · Last updated: 8 November 2026',
  'This policy explains what information is kept where while you play Number Path (the “App”).', [
  ('No account, no personal data', ['The App does not ask you to create an account. Your name, email, contacts, location or any other personal information are never collected.']),
  ('What is stored on your device', ['Your progress (levels, stars, best times, daily puzzle streak, hints and settings) is stored only on your device.']),
  ('Anonymous usage statistics', ['To learn which levels are too hard and whether players come back, the App sends anonymous, aggregated counts, for example “level 12 started”, “level 12 finished in 48 seconds”, “daily puzzle solved”, “a hint was used”. Each batch carries only the app version, the app language and the date the App was installed. There is no identifier of any kind (no advertising ID, no device ID, no account), so the counts cannot be linked to you or to your device, and they are not used for tracking or advertising. They are stored in a spreadsheet only we can read and are used only to improve the game.']),
  ('Game Center', ['The App may ask you to sign in to Apple Game Center for achievements and leaderboards. Sign-in, scores and achievements are handled entirely by Apple; your Game Center account details are not shared with us.']),
  ('Reminders', ["If you allow notifications, the App schedules reminders (for example for the daily puzzle) on your device. They are created on the iPhone itself; nothing is sent to a server. You can turn them off in the App's settings or in iPhone Settings."]),
  ('Ads', ['When you have no hints left, the App can show an optional promotion for our other game. It is drawn by the App itself; no ad network is used and no data is collected.']),
  ('Children', ['We do not collect personal data from anyone, including children.']),
  ('Changes and contact', [f'If we update this policy, we will change the date on this page. Questions: {ML}'])])
print('ok')
