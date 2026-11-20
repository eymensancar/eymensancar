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
GP = '<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">policies.google.com/privacy</a>'
FB = '<a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener">firebase.google.com/support/privacy</a>'
ML = f'<a href="mailto:{MAIL}">{MAIL}</a>'

# ---------------- Gizlilik: dört oyun, tek kalıp ----------------
# Her metin aynı on başlıkla, aynı sırayla yazılır; yalnız oyuna özgü cümleler değişir.
# Buradaki her cümle oyunun kodundan doğrulandı (14 Kasım 2026). Oyunda reklam, ölçüm, izin ya da
# satın alma değişirse ÖNCE bu metin güncellenir. Sayı Yolu yayınlanacak hâline göre yazıldı (Eymen, 14 Kasım):
# AdMob oraya bu metne uyacak biçimde kurulur (kişiselleştirme yok, takip izni sorulmaz, AB'de onay formu).
POL_DATE = {'tr': '20 Kasım 2026', 'en': '20 November 2026'}
POL_H = {
 'tr': ['Bizim topladığımız bilgiler', 'Cihazında saklananlar', 'Reklamlar', 'İstatistikler ve hata raporları', 'İzinler ve Apple hizmetleri',
        'Satın almalar ve dış bağlantılar', 'Çocuklar', 'Hakların', 'Değişiklikler', 'İletişim'],
 'en': ['Information we collect', 'What is stored on your device', 'Ads', 'Statistics and crash reports', 'Permissions and Apple services',
        'Purchases and external links', 'Children', 'Your rights', 'Changes', 'Contact'],
}
G_TECH = {
 'tr': f"Reklamı gösterebilmek, kötüye kullanımı önlemek ve reklamları ölçmek için Google cihazdan bazı teknik bilgiler alabilir: IP adresi ve ondan çıkarılan yaklaşık konum (ülke/şehir), cihaz türü ve işletim sistemi, reklam etkileşimleri (gösterim, tıklama) ve hata/performans bilgileri{{idfa}}. Bu bilgileri Google kendi gizlilik politikasına göre işler: {GP} ve {GL}.",
 'en': f"To show ads, prevent abuse and measure ads, Google may receive some technical information from the device: IP address and the approximate location derived from it (country/city), device type and operating system, ad interactions (impressions, clicks) and error/performance information{{idfa}}. Google processes this information under its own privacy policy: {GP} and {GL}.",
}
UMP = {
 'tr': "Avrupa Ekonomik Alanı, Birleşik Krallık ve İsviçre'de reklamlardan önce Google'ın onay formu gösterilir; tercihini oyunun Ayarlar bölümündeki “Gizlilik seçenekleri” ile istediğin zaman değiştirebilirsin.",
 'en': "In the European Economic Area, the United Kingdom and Switzerland, Google's consent form is shown before ads; you can change your choice at any time under “Privacy options” in the game's Settings.",
}
NO_TRACK = {
 'tr': "Reklamlar kişiselleştirilmez. Oyun, Apple'ın uygulamalar arası takip iznini istemez ve seni uygulamalar ya da web siteleri arasında takip etmez.",
 'en': "Ads are not personalised. The game does not ask for Apple's app tracking permission and does not track you across apps or websites.",
}
KIDS = {
 'tr': 'Çocuklar dahil kimseden bilerek kişisel bilgi toplamayız. Bir ebeveyn olarak sorun ya da endişen varsa bize yaz.',
 'en': 'We do not knowingly collect personal information from anyone, including children. If you are a parent and have a question or concern, write to us.',
}
RIGHTS = {
 'tr': 'Seni tanımlayan bir kayıt tutmuyoruz; bu yüzden elimizde sana ait gösterebileceğimiz ya da silebileceğimiz bir kişisel veri yoktur. Cihazındaki oyun verisini uygulamayı silerek kaldırabilirsin. KVKK, GDPR ya da benzeri yasalar kapsamındaki soru ve taleplerin için bize yazabilirsin.',
 'en': 'We keep no record that identifies you, so we hold no personal data of yours that we could show or delete. You can remove the game data on your device by deleting the app. For questions and requests under GDPR, KVKK or similar laws, write to us.',
}
CHG = {'tr': 'Bu politikayı değiştirirsek güncel hâlini ve yeni tarihi bu sayfada yayımlarız.', 'en': 'If we change this policy, we publish the current version and the new date on this page.'}
INTRO = {
 'tr': '{n}, SAMFA Gayrimenkul Yatırım ve Yönetim A.Ş. (Sancar Games) tarafından yayımlanan bir iPhone oyunudur. Bu politika, oyunun hangi bilgileri nasıl kullandığını anlatır.',
 'en': '{n} is an iPhone game published by SAMFA Gayrimenkul Yatırım ve Yönetim A.Ş. (Sancar Games). This policy explains what information the game uses and how.',
}
def pol(key, names, d):
    for lang in ('tr', 'en'):
        n = names[lang]; x = d[lang]
        secs = [x['we'], x['dev'], x['ads'], x['stat'], x['perm'], x['buy'], [KIDS[lang]] + x.get('kids', []), [RIGHTS[lang]] + x.get('rights', []), [CHG[lang]], [ML]]
        tt = ('Gizlilik Politikası', 'Son güncelleme') if lang == 'tr' else ('Privacy Policy', 'Last updated')
        policy(key, lang, f'{tt[0]} · {n}', tt[0], f'{n} · {tt[1]}: {POL_DATE[lang]}', INTRO[lang].format(n=n), list(zip(POL_H[lang], secs)))

# --- Yıkım Ustası: AdMob (takip izni + onay formu), Firebase Analytics/Crashlytics, iCloud, Game Center, bildirim, satın alma
pol('pyk', {'tr': 'Yıkım Ustası', 'en': 'Demolition Master'}, {
 'tr': dict(
  we=['Kişisel bilgi toplamayız. Oyunda hesap, giriş ya da sohbet yoktur; adın, e-postan, rehberin ya da konumun istenmez. Bize ulaşan tek veri, aşağıda anlatılan ve kimliğinle eşleşmeyen kullanım istatistikleri ile hata raporlarıdır.',
      "Kampanya kodu: oyuna bir kampanya kodu girersen, aynı kod ikinci kez kullanılamasın diye kodun kullanıldığı Google'ın Firebase hizmetindeki veritabanımıza kaydedilir. Kayıtta yalnızca kodun parmak izi ve kullanım zamanı bulunur; sana ya da cihazına ait bir bilgi bulunmaz."],
  dev=["Oyundaki ilerlemen (bölümler, altın, makineler, kozmetikler, ses ve titreşim tercihleri) cihazında saklanır. Telefon değiştirdiğinde kaldığın yerden devam edebilmen için bir kopyası Apple'ın iCloud hizmetinde, kendi Apple kimliğine ait alanda tutulur. Bu kopyayı biz göremeyiz. iCloud'u iPhone Ayarlar'ından kapatabilirsin."],
  ads=['Oyun, Google AdMob üzerinden reklam gösterir: isteğe bağlı ödüllü reklamlar (örneğin ek süre ya da ek altın karşılığında) ve arada bir tam ekran geçiş reklamı. “Reklamsız” ya da onu içeren bir paket satın alırsan geçiş reklamları gösterilmez.',
       "Oyun, Apple'ın “Uygulama İzleme Şeffaflığı” penceresiyle takip izni sorar. İzin verirsen reklamlar ilgi alanlarına göre kişiselleştirilebilir; vermezsen reklamlar yine gösterilir ama kişiselleştirilmez. Bu izni istediğin zaman iPhone Ayarlar → Gizlilik ve Güvenlik → İzleme bölümünden değiştirebilirsin.",
       G_TECH['tr'].format(idfa=' ve yalnızca takip iznini verirsen Apple reklam kimliği (IDFA)'), UMP['tr']],
  stat=["1.0.1 sürümünden itibaren oyunu iyileştirmek için Google'ın Firebase Analytics ve Firebase Crashlytics hizmetlerini kullanırız. Analytics, oyunun nasıl oynandığını gösteren olayları kaydeder: oyunun ilk açılışı, oturum süresi, bir bölümün başlaması, bitmesi ya da süre dolması, ödüllü reklam izlenmesi ve satın alma yapılması gibi. Crashlytics, oyun çöktüğünde ya da bir hata oluştuğunda cihaz modeli, iOS sürümü ve hatanın teknik ayrıntılarını içeren bir rapor gönderir.",
        f"Bu veriler, Firebase'in uygulamaya özel rastgele oluşturduğu bir kurulum kimliğiyle gruplanır. Adınla, Apple kimliğinle ya da reklam kimliğinle (IDFA) ilişkilendirilmez, takip ya da reklam kişiselleştirme için kullanılmaz ve yalnızca toplu olarak, oyunu iyileştirmek için incelenir. Uygulamayı silmek bu kurulum kimliğini de siler. Google'ın bu verileri nasıl işlediği: {FB}."],
  perm=["Takip izni: yukarıda “Reklamlar” bölümünde anlatıldı.", "Game Center: oyun Apple Game Center'da oturum açmanı isteyebilir. Oturum tamamen Apple tarafından yönetilir; Game Center hesap bilgilerin bize iletilmez.",
        "Bildirimler: izin verirsen oyun hatırlatmaları cihazında planlar. Hatırlatmalar iPhone'un kendisinde oluşturulur; bunun için hiçbir sunucuya bilgi gönderilmez. iPhone Ayarlar → Bildirimler bölümünden kapatabilirsin.",
        'Oyun kamera, mikrofon, fotoğraf, rehber ya da konum izni istemez.'],
  buy=["Oyunda uygulama içi satın alma vardır. Satın almalar tamamen Apple tarafından App Store üzerinden işlenir. Ödeme bilgilerini biz görmeyiz; oyun yalnızca neyi satın aldığını öğrenir ki içeriği açabilsin.", "Oyundaki bağlantılar App Store'u, bu sitedeki destek sayfasını, YouTube ve Instagram sayfalarımızı ya da iPhone'un paylaşım penceresini açabilir; bu hizmetler kendi gizlilik kurallarına tabidir."],
  rights=['Kullanım istatistikleri ve hata raporları kimliğinle eşleşmez; uygulamayı silmek kurulum kimliğini sıfırlar.']),
 'en': dict(
  we=['We do not collect personal information. The game has no account, sign-in or chat; it never asks for your name, email, contacts or location. The only data that reaches us is the usage statistics and crash reports described below, which are not matched to your identity.',
      "Promo codes: if you enter a promo code in the game, the fact that the code has been used is recorded in our database on Google's Firebase service so the same code cannot be used twice. The record contains only a fingerprint of the code and the time of use; it contains nothing about you or your device."],
  dev=["Your game progress (levels, gold, machines, cosmetics, sound and vibration settings) is stored on your device. So you can continue on a new phone, a copy is kept in Apple's iCloud, in the space that belongs to your own Apple ID. We cannot see this copy. You can turn iCloud off in the iPhone Settings."],
  ads=['The game shows ads through Google AdMob: optional rewarded ads (for extra time or extra gold, for example) and an occasional full-screen interstitial ad. If you buy “No Ads” or a pack that includes it, interstitial ads are no longer shown.',
       "The game asks for tracking permission through Apple's App Tracking Transparency prompt. If you allow it, ads may be personalised to your interests; if you decline, you still see ads, but they are not personalised. You can change this at any time in iPhone Settings → Privacy & Security → Tracking.",
       G_TECH['en'].format(idfa=" and, only if you allow tracking, Apple's advertising identifier (IDFA)"), UMP['en']],
  stat=["From version 1.0.1, to improve the game we use Google's Firebase Analytics and Firebase Crashlytics. Analytics records events that show how the game is played, such as the first launch, session length, a level starting, being completed or running out of time, a rewarded ad being watched and a purchase being made. When the game crashes or an error occurs, Crashlytics sends a report with the device model, iOS version and technical details of the error.",
        f"This data is grouped by a random installation ID that Firebase creates for the app. It is not linked to your name, your Apple ID or your advertising identifier (IDFA), it is not used for tracking or ad personalisation, and we only review it in aggregate to improve the game. Deleting the app also deletes this installation ID. How Google processes this data: {FB}."],
  perm=['Tracking permission: described under “Ads” above.', 'Game Center: the game may ask you to sign in to Apple Game Center. Sign-in is handled entirely by Apple; your Game Center account details are not shared with us.',
        'Notifications: if you allow them, the game schedules reminders on your device. Reminders are created on the iPhone itself; no information is sent to any server for this. You can turn them off in iPhone Settings → Notifications.',
        'The game does not ask for camera, microphone, photo, contacts or location permission.'],
  buy=['The game has in-app purchases. Purchases are processed entirely by Apple through the App Store. We never see your payment details; the game only learns what you bought so it can unlock it.', 'Links in the game may open the App Store, the support page on this website, our YouTube and Instagram pages or the iPhone share sheet; those services are subject to their own privacy rules.'],
  rights=['Usage statistics and crash reports are not matched to your identity, and deleting the app resets the installation ID.']),
})

# --- Sayı Yolu (yayınlanacak hâli): AdMob (kişiselleştirme yok, takip izni yok, onay formu), kimliksiz ölçüm, Game Center, bildirim, fotoğraf/kamera/mikrofon
pol('psy', {'tr': 'Sayı Yolu', 'en': 'Number Path'}, {
 'tr': dict(
  we=['Kişisel bilgi toplamayız. Oyunda hesap, giriş ya da sohbet yoktur; adın, e-postan, rehberin ya da konumun istenmez. Bize ulaşan tek veri, aşağıda anlatılan kimliksiz kullanım sayılarıdır.'],
  dev=['Oyundaki ilerlemen (bölümler, yıldızlar, en iyi süreler, günlük bulmaca serisi, ipuçları, altın, dükkandan aldıkların ve ayarlar) yalnızca cihazında saklanır ve bize gönderilmez. Tahtanın arkasına koyduğun fotoğraf, kendi müziğin ve kaydettiğin sesler de yalnızca cihazında durur; hiçbir yere gönderilmez.'],
  ads=['Oyun, Google AdMob üzerinden reklam gösterir: isteğe bağlı ödüllü reklamlar (örneğin ipucu, altın ya da günlük serini kurtarmak için) ve ileri bölümlerde arada bir bölüm arası reklam. Oyun ayrıca diğer oyunumuz Yıkım Ustası\'nın tanıtımını gösterebilir; bu tanıtımı oyun kendisi çizer, reklam ağından gelmez.',
       NO_TRACK['tr'], G_TECH['tr'].format(idfa=''), UMP['tr']],
  stat=['Hangi bölümlerin fazla zor olduğunu ve oyuncuların geri dönüp dönmediğini öğrenmek için oyun kimliksiz, toplu sayılar gönderir; örneğin “12. bölüm başladı”, “12. bölüm 48 saniyede bitti”, “günlük bulmaca çözüldü”, “ipucu kullanıldı”, “reklam izlendi”. Her pakette yalnızca uygulama sürümü, uygulama dili ve kurulum günü bulunur.',
        'Bu sayılarda hiçbir kimlik yoktur: reklam kimliği, cihaz kimliği, hesap ya da rastgele kullanıcı numarası gönderilmez. Bu yüzden sayılar sana ya da cihazına bağlanamaz; takip ya da reklam için kullanılmaz. Google E-Tablolar hizmetinde, yalnızca bizim okuyabildiğimiz bir tabloda durur ve yalnızca oyunu iyileştirmek için kullanılır. Oyunda hata raporu gönderen bir araç yoktur.'],
  perm=["Game Center: oyun başarımlar ve sıralamalar için Apple Game Center'da oturum açmanı isteyebilir. Oturum, skorlar ve başarımlar tamamen Apple tarafından yönetilir; Game Center hesap bilgilerin bize iletilmez.",
        "Bildirimler: izin verirsen oyun (örneğin günlük bulmaca için) hatırlatmaları cihazında planlar. Hatırlatmalar iPhone'un kendisinde oluşturulur; bunun için hiçbir sunucuya bilgi gönderilmez. Oyunun ayarlarından ya da iPhone Ayarlar → Bildirimler bölümünden kapatabilirsin.",
        'Fotoğraf ve kamera: yalnızca tahtanın arkasına kendi fotoğrafını koymak istersen sorulur. Fotoğraf 24 saat boyunca tahtanın arkasında görünür ve yalnızca cihazında kalır.',
        'Mikrofon: yalnızca oyunun seslerini kendi sesinle değiştirmek için kısa bir kayıt yapmak istersen sorulur. Kayıt yalnızca cihazında kalır.',
        'Oyun rehber ya da konum izni istemez.'],
  buy=["Oyunda gerçek parayla satın alma yoktur; dükkanda yalnızca oyunda kazanılan altın harcanır.", "Oyun, kardeş oyunlarımızın (Yıkım Ustası, Fenerli Dedektif, Kedi Yuvası) tanıtımını gösterip göstermeyeceğine karar vermek için bu oyunların cihazında yüklü olup olmadığına bakar; başka hiçbir uygulamaya bakmaz ve bu bilgiyi hiçbir yere göndermez. Tanıtıma dokunursan App Store açılır; App Store kendi gizlilik kurallarına tabidir."]),
 'en': dict(
  we=['We do not collect personal information. The game has no account, sign-in or chat; it never asks for your name, email, contacts or location. The only data that reaches us is the anonymous usage counts described below.'],
  dev=['Your game progress (levels, stars, best times, daily puzzle streak, hints, gold, shop items and settings) is stored only on your device and is not sent to us. The photo you put behind the board, your own music and the sounds you record also stay only on your device; they are not sent anywhere.'],
  ads=['The game shows ads through Google AdMob: optional rewarded ads (for a hint, gold or to save your daily streak, for example) and, in later levels, an occasional ad between levels. The game may also show a promotion for our other game, Demolition Master; the game draws this promotion itself and it does not come from an ad network.',
       NO_TRACK['en'], G_TECH['en'].format(idfa=''), UMP['en']],
  stat=['To learn which levels are too hard and whether players come back, the game sends anonymous, aggregate counts; for example “level 12 started”, “level 12 finished in 48 seconds”, “daily puzzle solved”, “hint used”, “ad watched”. Each batch contains only the app version, the app language and the install day.',
        'These counts contain no identifier: no advertising identifier, device identifier, account or random user number is sent. They therefore cannot be linked to you or your device, and are not used for tracking or advertising. They are kept in Google Sheets, in a table only we can read and are used only to improve the game. The game has no tool that sends crash reports.'],
  perm=['Game Center: the game may ask you to sign in to Apple Game Center for achievements and leaderboards. Sign-in, scores and achievements are handled entirely by Apple; your Game Center account details are not shared with us.',
        "Notifications: if you allow them, the game schedules reminders on your device (for the daily puzzle, for example). Reminders are created on the iPhone itself; no information is sent to any server for this. You can turn them off in the game's settings or in iPhone Settings → Notifications.",
        'Photos and camera: asked only if you want to put your own photo behind the board. The photo is shown behind the board for 24 hours and stays only on your device.',
        "Microphone: asked only if you want to make a short recording to replace the game's sounds with your own. The recording stays only on your device.",
        'The game does not ask for contacts or location permission.'],
  buy=['The game has no real-money purchases; the shop only spends gold earned in the game.', 'To decide whether to show promotions for our other games (Demolition Master, Lantern Detective, Cat Haven), the game checks whether those games are installed on your device; it does not check for any other app and does not send this information anywhere. If you tap the promotion, the App Store opens; the App Store is subject to its own privacy rules.']),
})

# --- Fenerli Dedektif: AdMob (çocuğa yönelik, kişiselleştirme yok, takip izni yok), ölçüm yok, satın alma yok, ebeveyn kapısı
pol('pfd', {'tr': 'Fenerli Dedektif', 'en': 'Lantern Detective'}, {
 'tr': dict(
  we=['Kişisel bilgi toplamayız. Oyunda hesap, giriş ya da sohbet yoktur; adın, e-postan, rehberin ya da konumun istenmez. Oyun bize hiçbir veri göndermez.'],
  dev=['Oyundaki ilerlemen (açılan odalar, yıldızlar ve ayarlar) yalnızca cihazında saklanır ve bize gönderilmez.'],
  ads=['Oyun ücretsizdir ve Google AdMob üzerinden reklam gösterir: ipucu için isteğe bağlı ödüllü reklam ve arada bir tam ekran geçiş reklamı.',
       'Oyun çocuklar için tasarlandığından reklam isteklerini çocuklara yönelik olarak işaretleriz (“çocuğa yönelik içerik” ve “rıza yaşının altındaki kullanıcı” ayarları açıktır) ve yalnızca genel izleyiciye uygun reklamlara izin veririz. ' + NO_TRACK['tr'],
       G_TECH['tr'].format(idfa='')],
  stat=['Oyunda istatistik, analiz ya da hata raporu gönderen bir araç yoktur.'],
  perm=['Oyun hiçbir izin istemez: takip, bildirim, kamera, mikrofon, fotoğraf, rehber ya da konum izni sorulmaz.',
        'Sesli anlatım: Türkçe ve İngilizce anlatım sesleri uygulamanın içindedir; diğer dillerde cihazın kendi konuşma özelliği kullanılır. Ses kaydı yapılmaz.'],
  buy=['Oyunda satın alma yoktur.', 'Oyun dışına çıkan bağlantılar (bu sitedeki yardım ve gizlilik sayfaları) bir ebeveyn kapısının (yetişkinlerin cevaplayabileceği bir soru) arkasındadır.'],
  kids=['Oyun 7–11 yaş çocuklar ve aileleri için tasarlandı; gizlilik ve reklam ayarları buna göre yapıldı.']),
 'en': dict(
  we=['We do not collect personal information. The game has no account, sign-in or chat; it never asks for your name, email, contacts or location. The game sends us no data at all.'],
  dev=['Your game progress (unlocked rooms, stars and settings) is stored only on your device and is not sent to us.'],
  ads=['The game is free and shows ads through Google AdMob: an optional rewarded ad for a hint and an occasional full-screen interstitial ad.',
       'Because the game is designed for children, we mark ad requests as child-directed (“tag for child-directed treatment” and “tag for under age of consent” are on) and allow only ads suitable for a general audience. ' + NO_TRACK['en'],
       G_TECH['en'].format(idfa='')],
  stat=['The game has no tool that sends statistics, analytics or crash reports.'],
  perm=['The game asks for no permissions: it never asks for tracking, notification, camera, microphone, photo, contacts or location permission.',
        "Narration: Turkish and English narration voices are included in the app; other languages use the device's own speech feature. No audio is recorded."],
  buy=['The game has no purchases.', 'Links that leave the game (the help and privacy pages on this website) are behind a parental gate (a question adults can answer).'],
  kids=['The game is designed for children aged 7–11 and their families; privacy and ad settings were chosen accordingly.']),
})

# --- Kedi Yuvası: AdMob (çocuğa yönelik, kişiselleştirme yok, takip izni yok, onay formu), ölçüm yok, satın alma yok
pol('pky', {'tr': 'Kedi Yuvası', 'en': 'Cat Haven'}, {
 'tr': dict(
  we=['Kişisel bilgi toplamayız. Oyunda hesap, giriş ya da sohbet yoktur; adın, e-postan, rehberin ya da konumun istenmez. Oyun bize hiçbir veri göndermez.'],
  dev=['Oyundaki ilerlemen (yıldızlar, açılan kediler ve ayarlar) yalnızca cihazında saklanır ve bize gönderilmez.'],
  ads=['Oyun ücretsizdir ve Google AdMob üzerinden reklam gösterir: kaybedince isteğe bağlı “reklam izle ve devam et” ve bölüm aralarında arada bir tam ekran geçiş reklamı. Oyun internetsiz oynanabilir; internet yalnızca reklamlar için kullanılır.',
       'Reklam isteklerini çocuklara yönelik olarak işaretleriz (“çocuğa yönelik içerik” ve “rıza yaşının altındaki kullanıcı” ayarları açıktır) ve yalnızca genel izleyiciye uygun reklamlara izin veririz. ' + NO_TRACK['tr'],
       G_TECH['tr'].format(idfa=''), UMP['tr']],
  stat=['Oyunda istatistik, analiz ya da hata raporu gönderen bir araç yoktur.'],
  perm=['Bildirim izni isteğe bağlıdır: yalnızca günlük bölüm hatırlatmasını açarsan iOS izin sorar. Hatırlatma cihazında kurulan yerel bir bildirimdir; sunucudan gönderilmez ve bize hiçbir bilgi gitmez. İzni istediğin zaman iPhone Ayarlar’ından kapatabilirsin.',
        'Oyun arada bir Apple’ın kendi değerlendirme penceresiyle oyunu puanlamanı isteyebilir; bu pencereyi Apple yönetir, oyun puanını ya da yorumunu görmez.',
        'Bunun dışında izin istenmez: takip, kamera, mikrofon, fotoğraf, rehber ya da konum izni sorulmaz.'],
  buy=['Oyunda satın alma yoktur.', 'Oyun, kardeş oyunlarımızın (Yıkım Ustası, Fenerli Dedektif, Sayı Yolu) tanıtımını gösterip göstermeyeceğine karar vermek için bu oyunların cihazında yüklü olup olmadığına bakar; başka hiçbir uygulamaya bakmaz ve bu bilgiyi hiçbir yere göndermez. Tanıtıma dokunursan App Store açılır.', 'Bunun dışında oyun dışına çıkan bir bağlantı yoktur; yalnızca reklama dokunursan reklamverenin sayfası açılır.'],
  kids=['Oyun her yaştan oyuncu içindir; reklam ayarları çocuklara uygun olacak şekilde yapıldı.']),
 'en': dict(
  we=['We do not collect personal information. The game has no account, sign-in or chat; it never asks for your name, email, contacts or location. The game sends us no data at all.'],
  dev=['Your game progress (stars, unlocked cats and settings) is stored only on your device and is not sent to us.'],
  ads=['The game is free and shows ads through Google AdMob: an optional “watch an ad and continue” when you lose, and an occasional full-screen interstitial ad between levels. The game can be played offline; the internet is used only for ads.',
       'We mark ad requests as child-directed (“tag for child-directed treatment” and “tag for under age of consent” are on) and allow only ads suitable for a general audience. ' + NO_TRACK['en'],
       G_TECH['en'].format(idfa=''), UMP['en']],
  stat=['The game has no tool that sends statistics, analytics or crash reports.'],
  perm=['Notification permission is optional: iOS asks for it only if you turn on the daily level reminder. The reminder is a local notification scheduled on your device; it is not sent from a server and no information reaches us. You can turn it off at any time in your iPhone Settings.',
        "The game may occasionally ask you to rate it using Apple's own rating window; Apple manages this window and the game does not see your rating or review.",
        'Apart from this, no permissions are requested: the game never asks for tracking, camera, microphone, photo, contacts or location permission.'],
  buy=['The game has no purchases.', 'To decide whether to show promotions for our other games (Demolition Master, Lantern Detective, Number Path), the game checks whether those games are installed on your device; it does not check for any other app and does not send this information anywhere. If you tap a promotion, the App Store opens.', "Apart from this, the game has no links that leave the game; only if you tap an ad does the advertiser's page open."],
  kids=['The game is for players of all ages; ad settings were chosen to be suitable for children.']),
})

# ---------------- Yardım: her oyunun kendi sayfası (aynı düzen) ----------------
support_one('syk', 'tr', 'Yardım · Yıkım Ustası', 'Yardım', 'Yıkım Ustası, binaları patlayıcı ve makinelerle yıktığın bir iPhone fizik oyunudur.', 'icon-yk.jpg', 'Yıkım Ustası', SUP['tr']['yk'])
support_one('syk', 'en', 'Help · Demolition Master', 'Help', 'Demolition Master is an iPhone physics game where you bring buildings down with explosives and machines.', 'icon-yk.jpg', 'Demolition Master', SUP['en']['yk'])
support_one('ssy', 'tr', 'Yardım · Sayı Yolu', 'Yardım', 'Sayı Yolu, tahtadaki her kareden bir kez geçen tek bir yol çizdiğin bir sayı bulmacasıdır.', 'icon-sy.jpg', 'Sayı Yolu', SUP['tr']['sy'])
support_one('ssy', 'en', 'Help · Number Path', 'Help', 'Number Path is a number puzzle where you draw one path that passes through every square of the board once.', 'icon-sy.jpg', 'Number Path', SUP['en']['sy'])
# Fenerli Dedektif: sorular SunStroke5634/fenerli-dedektif deposundaki docs/SITE_METINLERI.md ile aynı (14 Kasım 2026)
support_one('sfd', 'tr', 'Yardım · Fenerli Dedektif', 'Yardım', 'Fenerli Dedektif, 7–11 yaş çocuklar ve aileler için karanlık odalarda ipucu toplanan bir dedektif bulmaca oyunudur.', 'icon-fd.jpg', 'Fenerli Dedektif', [
  ('Takıldım, ne yapmalıyım?', "Odadaki 💡 düğmesine dokun; o odanın ipucu çıkar. Davalarda soruları cevaplarken 📓 Dedektif Defteri'ne bakmayı unutma: cevap her zaman ipuçlarını birleştirince bulunur."),
  ('Ses gelmiyor.', "Telefonun sessiz modda olmadığından ve ses düzeyinin açık olduğundan emin ol. Ayarlar'da “Sesli anlatım” açık olmalı."),
  ('İlerlemem kayboldu mu?', 'İlerleme telefonda saklanır. Uygulamayı silmek ilerlemeyi de siler.')])
support_one('sfd', 'en', 'Help · Lantern Detective', 'Help', 'Lantern Detective is a detective puzzle game for children aged 7–11 and their families: collect clues in dark rooms with your lantern and solve the mystery.', 'icon-fd.jpg', 'Lantern Detective', [
  ("I'm stuck. What should I do?", "Tap the 💡 button in the room to see that room's hint. When answering a case's questions, check your 📓 Detective Notebook: every answer comes from putting the clues together."),
  ("There's no sound.", "Make sure the phone isn't in silent mode and the volume is up. “Narration” must be on in Settings."),
  ('Did I lose my progress?', 'Progress is stored on the phone. Deleting the app also deletes the progress.')])
support_one('sky', 'tr', 'Yardım · Kedi Yuvası', 'Yardım', 'Kedi Yuvası, parkurda saklanan sokak kedilerini bulup yuvaya kavuşturduğun bir iPhone oyunudur.', 'icon-ky.jpg', 'Kedi Yuvası', [
  ('Kedileri nasıl yakalarım?', 'Joystick ile parkurda yürü ve saklanan kedilerin kuyruklarını ara. Kedi halkanın içindeyken YAKALA düğmesine bas.'),
  ('Yeni kediler nasıl açılır?', 'Bölümleri bitirdikçe yıldız kazanırsın; kediler topladığın toplam yıldızla açılır.'),
  ('İlerlemem nerede tutuluyor?', 'İlerleme yalnızca telefonda saklanır. Uygulamayı silmek ilerlemeyi de siler.')])
support_one('sky', 'en', 'Help · Cat Haven', 'Help', 'Cat Haven is an iPhone game where you find the stray cats hiding in the park and bring them home.', 'icon-ky.jpg', 'Cat Haven', [
  ('How do I catch the cats?', 'Walk around with the joystick and look for the tails of hiding cats. Press CATCH while the cat is inside your ring.'),
  ('How do I unlock new cats?', 'You earn stars as you finish levels; cats unlock with the total stars you have collected.'),
  ('Where is my progress stored?', 'Progress is stored only on the phone. Deleting the app also deletes the progress.')])
