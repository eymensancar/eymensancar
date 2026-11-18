# sancargames.com — 2. tasarım. python3 build.py → site/
# Destek SSS ve gizlilik metinleri ../sg/build.py'den (içerik aynı) alınır; tasarım ve sayfalar burada.
import json, os, html, re
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('SG_OUT') or os.path.join(HERE, 'site')
STORE = 'https://apps.apple.com/app/id6823286892'
# her oyunun App Store sayfası (Sayı Yolu yayına girince buraya eklenir ve G'de live=True yapılır)
STORES = {'yk': STORE, 'fd': 'https://apps.apple.com/app/id6827192752', 'ky': 'https://apps.apple.com/app/id6832325312'}
YT = 'https://www.youtube.com/@demolitionmastergame'
IG = 'https://www.instagram.com/demolitionmaster.game/'
MAIL = 'support@sancargames.com'
INFO = 'info@sancargames.com'
FONTS = ''  # Archivo yerel: assets/archivo-tr.woff2 (Latin + Türkçe tek dosya)
APPLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.7c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>'
AR = '<span class="ar" aria-hidden="true">→</span>'
ARU = '<span class="ar" aria-hidden="true">↗</span>'

P = {'home': ('index.html', 'en/index.html'), 'yk': ('yikim-ustasi.html', 'en/demolition-master.html'),
     'fd': ('fenerli-dedektif/index.html', 'en/fenerli-dedektif/index.html'), 'ky': ('kedi-yuvasi.html', 'en/cat-haven.html'),
     'sy': ('sayi-yolu.html', 'en/number-path.html'), 'sup': ('destek.html', 'en/support.html'),
     'pyk': ('gizlilik-yikim-ustasi.html', 'en/privacy-demolition-master.html'),
     'psy': ('gizlilik-sayi-yolu.html', 'en/privacy-number-path.html'),
     'pky': ('gizlilik-kedi-yuvasi.html', 'en/privacy-cat-haven.html'),
     'syk': ('destek-yikim-ustasi.html', 'en/support-demolition-master.html'),
     'ssy': ('destek-sayi-yolu.html', 'en/support-number-path.html'),
     'sky': ('destek-kedi-yuvasi.html', 'en/support-cat-haven.html'),
     'sfd': ('fenerli-dedektif/destek.html', 'en/fenerli-dedektif/support.html'),
     'pfd': ('fenerli-dedektif/gizlilik.html', 'en/fenerli-dedektif/privacy.html')}

def rel(frm, to):
    r = os.path.relpath(os.path.join(OUT, to), os.path.dirname(os.path.join(OUT, frm))).replace(os.sep, '/')
    if os.environ.get('SG_KEEPHTML'): return r
    return r[:-5] if r.endswith('.html') and not r.endswith('index.html') else (r[:-10] or './' if r.endswith('index.html') else r)
def url(k, lang): return 'https://sancargames.com/' + re.sub(r'(index)?\.html$', '', P[k][0 if lang == 'tr' else 1])

L = {
 'tr': dict(games='Oyunlar', studio='Stüdyo', support='Destek', privacy='Gizlilik', live='Yayında', soon='Yakında', other='EN', other_label='English',
   badge_s="App Store'dan", badge_b='İndirin', more='Oyunu incele', rights='Tüm hakları saklıdır.', menu='Menü', close='Kapat',
   copy='Kopyala', copied='Kopyalandı', yk='Yıkım Ustası', sy='Sayı Yolu', fd='Fenerli Dedektif', ky='Kedi Yuvası', contact='İletişim', skip='İçeriğe geç',
   about="iPhone ve iPad için bulmaca ve fizik oyunları yapan bağımsız bir oyun stüdyosu.", lang_h='Dil', follow='Takip et', help='Yardım', bygame='Oyunlara göre', bygame_p='Her oyunun yardım ve gizlilik sayfaları.', allpol='Bütün oyunların destek ve gizlilik sayfaları'),
 'en': dict(games='Games', studio='Studio', support='Support', privacy='Privacy', live='Out now', soon='Coming soon', other='TR', other_label='Türkçe',
   badge_s='Download on the', badge_b='App Store', more='See the game', rights='All rights reserved.', menu='Menu', close='Close',
   copy='Copy', copied='Copied', yk='Demolition Master', sy='Number Path', fd='Lantern Detective', ky='Cat Haven', contact='Contact', skip='Skip to content',
   about='An independent studio making puzzle and physics games for iPhone and iPad.', lang_h='Language', follow='Follow', help='Help', bygame='By game', bygame_p='Help and privacy pages for each game.', allpol='Support and privacy pages for all games'),
}

def badge(t, cls='', store=STORE): return f'<a class="badge {cls}" href="{store}" target="_blank" rel="noopener">{APPLE}<span><small>{t["badge_s"]}</small><b>{t["badge_b"]}</b></span></a>'


IGS = 'https://www.instagram.com/sancargamesofficial/'
def jsonld(key, lang, title, desc):
    org = {'@type': 'Organization', '@id': 'https://sancargames.com/#org', 'name': 'Sancar Games',
           'url': 'https://sancargames.com/', 'logo': 'https://sancargames.com/assets/img/favicon-512.png', 'image': 'https://sancargames.com/assets/img/og-team.jpg',
           'email': 'support@sancargames.com', 'sameAs': [IGS, YT, IG] + list(STORES.values())}
    g = [org]
    if key == 'home':
        g.append({'@type': 'WebSite', 'name': 'Sancar Games', 'url': 'https://sancargames.com/', 'inLanguage': lang, 'publisher': {'@id': 'https://sancargames.com/#org'}})
    if key == 'yk':
        g.append({'@type': ['MobileApplication', 'VideoGame'], 'name': 'Yıkım Ustası' if lang == 'tr' else 'Demolition Master: Tower Blast',
                  'alternateName': 'Demolition Master: Tower Blast' if lang == 'tr' else 'Yıkım Ustası',
                  'description': desc, 'url': url(key, lang), 'operatingSystem': 'iOS', 'applicationCategory': 'GameApplication',
                  'gamePlatform': 'iPhone', 'installUrl': STORE, 'sameAs': [STORE, YT, IG],
                  'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
                  'publisher': {'@id': 'https://sancargames.com/#org'}, 'inLanguage': lang})
    if key in ('fd', 'ky'):
        nm = {('fd', 'tr'): 'Fenerli Dedektif', ('fd', 'en'): 'Lantern Detective', ('ky', 'tr'): 'Kedi Yuvası', ('ky', 'en'): 'Cat Haven: Hide and Seek'}
        g.append({'@type': ['MobileApplication', 'VideoGame'], 'name': nm[(key, lang)], 'alternateName': nm[(key, 'en' if lang == 'tr' else 'tr')],
                  'description': desc, 'url': url(key, lang), 'operatingSystem': 'iOS', 'applicationCategory': 'GameApplication',
                  'gamePlatform': ['iPhone', 'iPad'], 'installUrl': STORES[key], 'sameAs': [STORES[key]],
                  'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'},
                  'publisher': {'@id': 'https://sancargames.com/#org'}, 'inLanguage': lang})
    if key == 'sy':
        g.append({'@type': 'VideoGame', 'name': 'Sayı Yolu' if lang == 'tr' else 'Number Path', 'description': desc,
                  'url': url(key, lang), 'gamePlatform': 'iPhone', 'publisher': {'@id': 'https://sancargames.com/#org'}, 'inLanguage': lang})
    return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@graph': g}, ensure_ascii=False) + '</script>'

def page(key, lang, title, desc, body, cur=None, ogimg='assets/img/og-team.jpg'):
    me = P[key][0 if lang == 'tr' else 1]; t = L[lang]; other = P[key][1 if lang == 'tr' else 0]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    A = lambda p: rel(me, p) + ver(p)
    c = lambda k: ' aria-current="page"' if cur == k else ''
    gl = a('home') + '#oyunlar'
    head = f'''<!doctype html>
<html lang="{lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<meta name="theme-color" content="#FFFFFF">
<link rel="canonical" href="{url(key, lang)}">
<link rel="alternate" hreflang="tr" href="{url(key, 'tr')}">
<link rel="alternate" hreflang="en" href="{url(key, 'en')}">
<link rel="alternate" hreflang="x-default" href="{url(key, 'en')}">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:image" content="https://sancargames.com/{ogimg}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="{A('assets/img/favicon.svg')}" type="image/svg+xml">
<link rel="icon" href="{A('assets/img/favicon-192.png')}" type="image/png" sizes="192x192">
<link rel="icon" href="{A('assets/img/favicon.png')}" type="image/png" sizes="32x32">
<link rel="apple-touch-icon" href="{A('assets/img/apple-touch-icon.png')}">
<link rel="preload" href="{A('assets/archivo-tr.woff2')}" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="{A('assets/site.css')}">
<script>document.documentElement.classList.add('js')</script>
{jsonld(key, lang, title, desc)}
</head>
<body>
<a class="skip" href="#main">{t['skip']}</a>
<header class="bar"><div class="wrap">
  <a class="logo" href="{a('home')}" aria-label="Sancar Games"><img class="wm" src="{A('assets/img/logo.svg')}" alt="Sancar Games" width="96" height="55"></a>
  <nav class="menu" aria-label="{t['menu']}">
    <a href="{gl}"{c('games')}>{t['games']}</a>
    <a href="{a('home')}#studyo">{t['studio']}</a>
    <a href="{a('sup')}"{c('sup')}>{t['support']}</a>
    <a class="lang" href="{rel(me, other)}" hreflang="{'en' if lang == 'tr' else 'tr'}" lang="{'en' if lang == 'tr' else 'tr'}" aria-label="{t['other_label']}">{t['other']}</a>
  </nav>
  <button class="burger" type="button" aria-label="{t['menu']}" aria-expanded="false" aria-controls="sheet"><span></span><span></span><span></span></button>
</div></header>
<div class="sheet" id="sheet" aria-label="{t['menu']}">
  <nav>
    <a href="{gl}">{t['games']}<span aria-hidden="true">›</span></a>
    <a href="{a('home')}#studyo">{t['studio']}<span aria-hidden="true">›</span></a>
    <a href="{a('sup')}">{t['support']}<span aria-hidden="true">›</span></a>
  </nav>
  <div class="sub"><a href="{rel(me, other)}" hreflang="{'en' if lang == 'tr' else 'tr'}">{t['other_label']}</a><span>{MAIL}</span></div>
</div>
<main id="main">
'''
    foot = f'''</main>
<footer class="foot">
  <div class="wrap cols">
    <div class="about"><a class="logo" href="{a('home')}" aria-label="Sancar Games"><img class="wm" src="{A('assets/img/logo-w.svg')}" alt="Sancar Games" width="140" height="80"></a><p>{t['about']}</p></div>
    <div class="col"><h4>{t['games']}</h4><ul><li><a href="{a('yk')}">{t['yk']}</a></li><li><a href="{a('fd')}">{t['fd']}</a></li><li><a href="{a('ky')}">{t['ky']}</a></li><li><a href="{a('sy')}">{t['sy']}</a></li></ul></div>
    <div class="col"><h4>{t['support']}</h4><ul><li><a href="{a('sup')}">{t['support']}</a></li><li><a href="{a('pyk')}">{t['privacy']}: {t['yk']}</a></li><li><a href="{a('psy')}">{t['privacy']}: {t['sy']}</a></li><li><a href="{a('pfd')}">{t['privacy']}: {t['fd']}</a></li><li><a href="{a('pky')}">{t['privacy']}: {t['ky']}</a></li></ul></div>
    <div class="col"><h4>{t['contact']}</h4><ul><li><a href="mailto:{MAIL}">{MAIL}</a></li><li><a href="mailto:{INFO}">{INFO}</a></li><li><a href="{rel(me, other)}" hreflang="{'en' if lang == 'tr' else 'tr'}">{t['other_label']}</a></li></ul></div>
  </div>
  <div class="wrap"><div class="giant" aria-hidden="true">Sancar Games<span>.</span></div></div>
  <div class="legal"><div class="wrap" style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;width:100%"><span>© 2026 Sancar Games. {t['rights']}</span><span>sancargames.com</span></div></div>
</footer>
<script src="{A('assets/site.js')}" defer></script>
</body>
</html>
'''
    path = os.path.join(OUT, me); os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(head + body + foot)

def ver(p):
    # css/js değişince adres de değişsin; tarayıcı eski kopyayı kullanmasın
    if not p.endswith(('.css', '.js')): return ''
    import hashlib
    return '?v=' + hashlib.md5(open(os.path.join(OUT, p), 'rb').read()).hexdigest()[:8]
def I(me, n): return rel(me, 'assets/img/' + n)
def phone(me, n, alt='', cls='', lazy=True):
    if n.startswith(('sy-','fd-')): cls += ' s'
    return f'<div class="phone {cls}"><img src="{I(me, n)}" alt="{html.escape(alt)}" width="720" height="1280"{" loading=lazy decoding=async" if lazy else ""}></div>'
def keyart(me, alt, eager=False):
    # Yıkım Ustası tanıtım görseli: arka plan (kule çöküyor) + usta soldan kayarak gelir
    lz = '' if eager else ' loading="lazy" decoding="async"'
    return (f'<figure class="keyart" role="img" aria-label="{html.escape(alt)}">'
            f'<img class="kb" src="{I(me,"yk-key-bg.jpg")}" alt="" width="941" height="1672"{lz}>'
            f'<img class="km" src="{I(me,"yk-key-man.webp")}" alt="" width="855" height="823"{lz}><span class="sen" aria-hidden="true"></span></figure>')
def keyart_sy(me, alt, eager=False):
    # Sayı Yolu tanıtım görseli: tahta + filiz karakter tahtanın arkasından yükselir
    lz = '' if eager else ' loading="lazy" decoding="async"'
    return (f'<figure class="keyart sy" role="img" aria-label="{html.escape(alt)}">'
            f'<img class="kb" src="{I(me,"sy-key-bg.jpg")}" alt="" width="1087" height="1447"{lz}>'
            f'<span class="rw"><img class="kc" src="{I(me,"sy-key-char.webp")}" alt="" width="785" height="826"{lz}></span>'
            f'<span class="sen" aria-hidden="true"></span></figure>')
def keyart_fd(me, alt):
    # Fenerli Dedektif: karanlık oda; fener yanınca ışık fenerden yayılır ve dedektif ile ışık huzmesi belirir
    lz = ' loading="lazy" decoding="async"'
    return (f'<figure class="keyart fd" role="img" aria-label="{html.escape(alt)}">'
            f'<img class="kb" src="{I(me,"fd-key-dark.jpg")}" alt="" width="1672" height="941"{lz}>'
            f'<img class="kl" src="{I(me,"fd-key-lit.jpg")}" alt="" width="1672" height="941"{lz}>'
            f'<span class="sen" aria-hidden="true"></span></figure>')
def keyart_ky(me, alt, eager=False):
    # Kedi Yuvası: mahalle parkı (oyunun kendi görüntüsü), geniş boya maskesiyle
    lz = '' if eager else ' loading="lazy" decoding="async"'
    return (f'<figure class="keyart ky" role="img" aria-label="{html.escape(alt)}">'
            f'<img class="kb" src="{I(me,"ky-key.jpg")}" alt="" width="2000" height="921"{lz}>'
            f'<span class="sen" aria-hidden="true"></span></figure>')
def shot(me, n, alt=''):
    # yatay oyun görüntüsü (Kedi Yuvası)
    return f'<div class="shot"><img src="{I(me, n)}" alt="{html.escape(alt)}" width="1600" height="737" loading="lazy" decoding="async"></div>'
def vphone(me, alt, cls=''):
    v = rel(me, 'assets/media/yk-loop.mp4'); po = I(me, 'yk-screen.jpg')
    return f'<div class="phone {cls}"><video data-auto src="{v}" poster="{po}" autoplay muted loop playsinline preload="metadata" aria-label="{html.escape(alt)}"></video></div>'

# ---------------- ana sayfa ----------------
H = {
 'tr': dict(title='Sancar Games', desc='Sancar Games, iPhone ve iPad için bulmaca ve fizik oyunları geliştiren bağımsız bir oyun stüdyosu.',
   lead='iPhone ve iPad için kısa, zekice ve el yapımı oyunlar geliştiren bağımsız bir oyun stüdyosu.', scroll='Oyunlarımız',
   feat_lead='Kulenin taşıyıcı noktasını bul, patlayıcıyı doğru yere koy ve tek hamlede indir. Her bina gerçek fizikle, parça parça çöker.',
   games_h='Oyunlar', games_p='Her biri birkaç dakikada oynanır. Bırakması zor olan kısım.',
   sy_p='Her kareden bir kez geçen tek bir yol çiz; kırmızı sayılara tam o adımda bas. Her gün yeni bir bulmaca.', sy_k='Yol çizme bulmacası',
   fd_p='Karanlık odalarda fenerini gezdir, saklı ipuçlarını birleştir ve gizemi çöz. Çocuklar ve aileler için 20 dava, 30 oda.', fd_k='Işıkla çözülen gizemler',
   ky_p='Parkta, pazarda, limanda saklanan sokak kedilerinin kuyruğunu bul, sessizce yaklaş ve hepsini yuvasına kavuştur.',
   m_k='Stüdyo', m_alt='Yıkım Ustası, Sayı Yolu filizi ve Fenerli Dedektif tilkisi birlikte poz veriyor', m_q='Her bölümü <mark>elle</mark> tasarlıyor, her oyunu oynayarak dengeliyoruz.',
   m_p='Sancar Games küçük bir ekip. Fikirden yayına kadar tasarımı, kodu, sesi ve çeviriyi kendimiz yapıyoruz. Hedefimiz basit: açtığın anda anlaşılan, kapattıktan sonra aklında kalan oyunlar.',
   c_h='Bize yazın', c_p='Genellikle iki iş günü içinde dönüyoruz.', c_sup='Oyunlarla ilgili destek', c_info='İş birliği ve basın',
   yk_alt='Yıkım Ustası oynanışı: kule çöküyor', tag_s="App Store'da"),
 'en': dict(title='Sancar Games', desc='Sancar Games is an independent studio making puzzle and physics games for iPhone and iPad.',
   lead='An independent studio making short, clever, handcrafted games for iPhone and iPad.', scroll='Our games',
   feat_lead="Find the tower's load-bearing point, place the charge in the right spot and bring it down in one move. Every building collapses piece by piece with real physics.",
   games_h='Games', games_p='Each one plays in a few minutes. Putting it down is the hard part.',
   sy_p='Draw one path that visits every square once and hit each red number on exactly that step. A new puzzle every day.', sy_k='Path-drawing puzzle',
   fd_p='Sweep your lantern through dark rooms, put the hidden clues together and solve the mystery. 20 cases and 30 rooms for kids and families.', fd_k='Mysteries solved with light',
   ky_p='Spot the tails of street cats hiding in the park, at the market and by the harbor, sneak up and bring every one of them home.',
   m_k='Studio', m_alt='The Demolition Master, the Number Path sprout and the Lantern Detective fox posing together', m_q='We design every level <mark>by hand</mark> and balance every game by playing it.',
   m_p='Sancar Games is a small team. From idea to release we do the design, code, sound and translation ourselves. Our goal is simple: games you understand the moment you open them and remember after you close them.',
   c_h='Write to us', c_p='We usually reply within two business days.', c_sup='Help with our games', c_info='Partnerships and press',
   yk_alt='Demolition Master gameplay: a tower collapsing', tag_s='On the App Store'),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = H[lang]; me = P['home'][0 if lang == 'tr' else 1]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    ykname = t['yk'] if lang == 'tr' else 'Demolition Master: Tower Blast'
    # yayındaki her oyun Yıkım Ustası'yla aynı kalıpta: simge, ad, kısa yazı, App Store düğmesi ve "Oyunu incele"
    FE = [('yk', ykname, h['feat_lead'], keyart(me, h['yk_alt'])),
          ('fd', t['fd'], h['fd_p'], keyart_fd(me, t['fd'])),
          ('ky', t['ky'] if lang == 'tr' else 'Cat Haven: Hide and Seek', h['ky_p'], keyart_ky(me, t['ky']))]
    feats = ''.join(f'''<section class="feature f-{k}" aria-labelledby="f-{k}">
  <div class="wrap body">
    <div class="txt">
      <img class="icon rv" src="{I(me, 'icon-' + k + '.jpg')}" alt="" width="88" height="88" loading="lazy">
      <h2 class="d d-l rv" id="f-{k}" style="--i:2;margin-top:18px">{nm}</h2>
      <p class="lead rv" style="--i:3">{ld}</p>
      <div class="acts rv" style="--i:4">{badge(t, store=STORES[k])}<a class="tl" href="{a(k)}">{t['more']} {AR}</a></div>
    </div>
    <div class="shots">{art}</div>
  </div>
</section>
''' for k, nm, ld, art in FE)
    body = f'''<section class="hero" aria-label="Sancar Games">
  <div class="wrap grid">
    <figure class="hero-team intro" style="--i:1"><img src="{I(me,'team-w.webp')}" alt="{h['m_alt']}" width="902" height="892" fetchpriority="high" decoding="async"></figure>
    <h1 class="hero-logo intro" style="--i:0"><img src="{I(me,'logo.svg')}" alt="Sancar Games" width="1000" height="572"></h1>
    <div class="copy intro" style="--i:3"><p class="lead">{h['lead']}</p><a class="scroll" href="#oyunlar"><span aria-hidden="true"></span>{h['scroll']}</a></div>
  </div>
</section>

<section class="sec games-h" id="oyunlar" aria-labelledby="g-h">
  <div class="wrap">
    <div class="sec-head"><h2 class="d d-l rv" id="g-h">{h['games_h']}</h2><p class="rv" style="--i:1">{h['games_p']}</p></div>
  </div>
</section>

{feats}
<section class="sec games-rest" aria-label="{h['games_h']}">
  <div class="wrap">
    <div class="mag">
      <a class="tile t-sy rv" href="{a('sy')}">
        {keyart_sy(me, t['sy'])}
        <div class="cap"><h3 class="d d-s">{t['sy']}</h3><span class="pill soon">{t['soon']}</span><p>{h['sy_p']}</p><span class="tl">{t['more']} {AR}</span></div>
      </a>
    </div>
  </div>
</section>

<section class="sec manifesto" id="studyo" aria-labelledby="m-h">
  <div class="wrap">
    <div class="k rv"><span class="eyebrow">{h['m_k']}</span></div>
    <div class="q"><p class="d rv" id="m-h" style="--i:1">{h['m_q']}</p><p class="rv" style="--i:2">{h['m_p']}</p></div>
  </div>
</section>

<section class="sec contact" aria-labelledby="c-h">
  <div class="wrap">
    <h2 class="d d-l rv" id="c-h">{h['c_h']}</h2>
    <div class="m rv" style="--i:1"><p>{h['c_p']}</p><small class="ml">{h['c_sup']}</small><div class="mail"><a href="mailto:{MAIL}">{MAIL}</a><button type="button" data-copy="{MAIL}" data-done="{t['copied']}">{t['copy']}</button></div><small class="ml">{h['c_info']}</small><div class="mail"><a href="mailto:{INFO}">{INFO}</a><button type="button" data-copy="{INFO}" data-done="{t['copied']}">{t['copy']}</button></div></div>
  </div>
</section>
'''
    page('home', lang, h['title'], h['desc'], body, cur='games')

# ---------------- oyun sayfaları ----------------
G = {
 ('yk','tr'): dict(title='Yıkım Ustası · Sancar Games', name='Yıkım Ustası', icon='icon-yk.jpg', live=True,
   lead='Kulenin taşıyıcı noktasını bul, patlayıcıyı doğru yere koy ve tek hamlede indir. Her bina gerçek fizikle, parça parça çöker.',
   meta='Ücretsiz · iPhone ve iPad · 20 dil', band=None, gal=[],
   rows=[('Gerçek fizik','Her bina blok blok, gerçek fizikle çöker. Aynı kule iki kez aynı şekilde yıkılmaz.'),
         ('Doğru alet, doğru yer','Balyoz, kesici, yıkım topu ve C4. Her binayı en az hamleyle indirmenin yolunu ara.'),
         ('Kombo ve dükkân','Art arda yıkımlarla kombo çarpanını büyüt, altınla yeni makineler ve görünümler aç.')],
   rows_h='Neden oynamalısın', social=True),
 ('yk','en'): dict(title='Demolition Master: Tower Blast · Sancar Games', name='Demolition Master', icon='icon-yk.jpg', live=True,
   lead="Find the tower's load-bearing point, place the charge in the right spot and bring it down in one move. Every building collapses piece by piece with real physics.",
   meta='Free · iPhone and iPad · 20 languages', band=None, gal=[],
   rows=[('Real physics','Every building falls block by block with real physics. No tower comes down the same way twice.'),
         ('Right tool, right spot','Sledgehammer, cutter, wrecking ball and C4. Find the way to bring each building down in the fewest moves.'),
         ('Combos and a shop','Chain demolitions to grow your combo multiplier, then spend gold on new machines and looks.')],
   rows_h='Why play', social=True),
 ('sy','tr'): dict(title='Sayı Yolu · Sancar Games', name='Sayı Yolu', icon='icon-sy.jpg', live=False,
   lead='Parmağınla tahtadaki her kareden bir kez geçen tek bir yol çiz. Kırmızı sayılara tam o adımda bas. Kolay başlar, zekice zorlaşır.',
   meta="App Store'da yakında", band=None, gal=[],
   rows=[('Tek kural','Her kareden bir kez geç, yalnızca yatay ve dikey git, kırmızı sayılara tam o adımda bas.'),
         ('Her gün yeni bulmaca','Günün bulmacasını çöz, serini koru.'),
         ('Yeni kurallar','İlerledikçe taşlar, duvarlar, oklar ve ışınlanma kapıları gibi yeni mekanikler tahtaya eklenir.')],
   rows_h='Nasıl oynanır', social=False),
 ('sy','en'): dict(title='Number Path · Sancar Games', name='Number Path', icon='icon-sy.jpg', live=False,
   lead='Draw one path with your finger that visits every square exactly once. Step on each red number at exactly that step. Easy to start, cleverly hard later.',
   meta='Coming soon to the App Store', band=None, gal=[],
   rows=[('One rule','Visit every square once, move only horizontally or vertically, and hit each red number on exactly that step.'),
         ('A new puzzle every day','Solve the daily puzzle and keep your streak going.'),
         ('New twists','As you progress, new mechanics such as rocks, walls, arrows and portals join the board.')],
   rows_h='How to play', social=False),
 ('fd','tr'): dict(title='Fenerli Dedektif · Sancar Games', name='Fenerli Dedektif', icon='icon-fd.jpg', live=True,
   lead='Karanlık odalarda parmağınla feneri gezdir, saklı eşyaları bul, ipuçlarını defterine yaz ve gizemi çöz. 7–11 yaş çocuklar ve aileler için mantık yürütmeyi öğreten bir bulmaca oyunu.',
   meta='Ücretsiz · iPhone ve iPad · 20 dil', band=None, gal=['lantern-1.jpg', 'lantern-2.jpg', 'lantern-3.jpg', 'lantern-4.jpg', 'lantern-5.jpg'],
   rows=[('20 gizem dosyası','Kayıp kedi Pamuk nerede? Pastayı kim yedi? Pati izlerini mor ışıkla takip et, parmak izlerini eşleştir, limon mürekkebiyle yazılmış mektubu oku, mors alfabesini çöz.'),
         ('30 macera odası','Anahtarlar, aynalar, renkli kristaller, şifreli sandıklar ve gizli geçitler. Harita seni yerin altındaki gizemli bir sığınağa indirir.'),
         ('Okumayan da oynar','Hikâyeler, ipuçları ve sorular doğal bir sesle okunur. Hesap gerekmez, internetsiz oynanır; dış bağlantılar ebeveyn kapısının arkasındadır.')],
   rows_h='Neler var', social=False),
 ('fd','en'): dict(title='Lantern Detective · Sancar Games', name='Lantern Detective', icon='icon-fd.jpg', live=True,
   lead='Move your lantern through dark rooms, find hidden objects, write the clues in your notebook and solve the mystery. A puzzle game for children aged 7 to 11 and their families that teaches logical thinking.',
   meta='Free · iPhone and iPad · 20 languages', band=None, gal=['lantern-1.jpg', 'lantern-2.jpg', 'lantern-3.jpg', 'lantern-4.jpg', 'lantern-5.jpg'],
   rows=[('20 mystery files','Where is Pamuk the missing cat? Who ate the cake? Follow paw prints with a purple light, match fingerprints, read a letter written in lemon ink and decode Morse code.'),
         ('30 adventure rooms','Keys, mirrors, colored crystals, code chests and secret passages. The map leads you down into a mysterious underground shelter.'),
         ('Pre-readers can play','Stories, clues and questions are read aloud in a natural voice. No account, plays offline, and outside links sit behind a parental gate.')],
   rows_h="What's inside", social=False),
 ('ky','tr'): dict(title='Kedi Yuvası · Sancar Games', name='Kedi Yuvası', icon='icon-ky.jpg', live=True,
   lead='Sokak kedileri parkta, pazarda, limanda ve çatılarda saklanıyor. Kuyruklarını bul, sessizce yaklaş, yakala ve hepsini sıcacık yuvalarına kavuştur.',
   meta='Ücretsiz · iPhone ve iPad · 20 dil', band=None, gal=[], shots=['ky-1.jpg', 'ky-2.jpg', 'ky-3.jpg', 'ky-4.jpg'],
   rows=[('Kuyruğu gördün mü?','Kediler çalıların, tezgâhların, kayıkların ve bacaların arkasına saklanır; çoğu zaman yalnızca kuyruk ucu görünür. Dikkatli bak, sessizce yaklaş.'),
         ('30 bölüm, 3 zorluk','Mahalle parkından karlı kışa, tren istasyonundan lunaparka, gece treninden sisli limana: kolay, zor ve usta parkurlar.'),
         ('20 kedi, 20 huy','Uykucu Sarman, sinsice yaklaşan Bal, koşarken görünmez olan Duman, zikzak kaçan Zencefil. Yıldız topla, yeni kedileri aç.')],
   rows_h='Nasıl oynanır', social=False),
 ('ky','en'): dict(title='Cat Haven: Hide and Seek · Sancar Games', name='Cat Haven', icon='icon-ky.jpg', live=True,
   lead='Street cats are hiding in the park, at the market, by the harbor and on the rooftops. Spot their tails, sneak up, catch them and bring every one of them home.',
   meta='Free · iPhone and iPad · 20 languages', band=None, gal=[], shots=['ky-1.jpg', 'ky-2.jpg', 'ky-3.jpg', 'ky-4.jpg'],
   rows=[('See that tail?','Cats hide behind bushes, market stalls, boats and chimneys, and often only the tip of a tail peeks out. Look closely and move quietly.'),
         ('30 levels, 3 difficulties','From the neighborhood park to a snowy winter, from the train station to the fair, from a night train to a foggy harbor: easy, hard and master courses.'),
         ('20 cats, 20 personalities','Sleepy Marmalade, Honey who creeps closer, Smokey who turns almost invisible, zigzagging Ginger. Collect stars to unlock new cats.')],
   rows_h='How to play', social=False),
}
for (k, lang), g in G.items():
    t = L[lang]; me = P[k][0 if lang == 'tr' else 1]
    a = lambda kk: rel(me, P[kk][0 if lang == 'tr' else 1])
    pol = 'p' + k
    vis = {'yk': keyart, 'sy': keyart_sy, 'ky': keyart_ky}[k](me, g['name'], eager=True) if k != 'fd' else keyart_fd(me, g['name'])
    acts = (badge(t, store=STORES[k]) + f'<span class="meta">{g["meta"]}</span>') if g['live'] else f'<span class="meta">{g["meta"]}</span>'
    h1 = {('yk', 'en'): 'Demolition Master: Tower Blast', ('ky', 'en'): 'Cat Haven: Hide and Seek'}.get((k, lang), g['name'])
    rows = ''.join(f'<div class="row rv" style="--i:{i}"><h3 class="d d-s">{x}</h3><p>{y}</p></div>' for i, (x, y) in enumerate(g['rows']))
    band = f'<div class="band mask"><img data-par src="{I(me, g["band"])}" alt="" width="1080" height="608" loading="lazy"></div>' if g['band'] else ''
    gal = ''.join(phone(me, n, cls='settle') for n in g['gal']) + ''.join(shot(me, n, g['name']) for n in g.get('shots', []))
    social = ''
    if g['social']:
        social = f'''<section class="sec" style="padding-top:0" aria-label="{t['follow']}"><div class="wrap"><div class="biglinks rv">
  <a href="{YT}" target="_blank" rel="noopener">YouTube {ARU}</a><a href="{IG}" target="_blank" rel="noopener">Instagram {ARU}</a>
</div></div></section>'''
    help_ = f'''<section class="sec" style="padding-top:0" aria-label="{t['support']}"><div class="wrap"><div class="biglinks rv">
  <a href="{a('s' + k)}">{t['help']} {AR}</a><a href="{a(pol)}">{t['privacy']} {AR}</a>
</div></div></section>'''
    body = f'''<section class="ghero"><div class="wrap">
  <div class="txt">
    <img class="icon intro" style="--i:0" src="{I(me, g['icon'])}" alt="" width="104" height="104">
    {'' if g['live'] else '<div class="intro" style="--i:1"><span class="pill soon">'+t['soon']+'</span></div>'}
    <h1 class="d d-l intro" style="--i:2;margin-top:16px">{h1}</h1>
    <p class="lead intro" style="--i:3">{g['lead']}</p>
    <div class="acts intro" style="--i:4">{acts}</div>
  </div>
  <div class="vis intro from-r" style="--i:5">{vis}</div>
</div></section>
{band}
<section class="sec paper"><div class="wrap">
  <div class="sec-head"><h2 class="d d-m rv">{g['rows_h']}</h2></div>
  <div class="rows">{rows}</div>
</div></section>
{'' if (g['band'] or not gal) else '<section class="sec" style="padding-top:0"><div class="wrap"><div class="gallery">'+gal+'</div></div></section>'}
{social}
{help_}
'''
    page(k, lang, g['title'], g['lead'], body, cur='games', ogimg='assets/img/' + ({'fd': 'og-fd.jpg', 'ky': 'og-ky.jpg'}.get(k) or g['band'] or (g['gal'][0] if g['gal'] else 'yk-key-bg.jpg')))

# ---------------- destek ve gizlilik: içerik eski build.py'den ----------------
src = open(os.path.join(HERE, 'content.py'), encoding='utf-8').read()
sup_src = src[src.index('SUP = {'):src.index("for lang in ('tr', 'en'):", src.index('SUP = {'))]
pol_src = src[src.index('GL = '):]
ns = {'MAIL': MAIL}
exec(sup_src, ns)
SUP = ns['SUP']
for lang in ('tr', 'en'):
    t = L[lang]; h = SUP[lang]; me = P['sup'][0 if lang == 'tr' else 1]
    det = lambda items: ''.join(f'<details><summary>{q}<span class="pm" aria-hidden="true"></span></summary><div class="ans"><p>{x}</p></div></details>' for q, x in items)
    ykn = t['yk']
    lk = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    row = lambda ic, n, links: f'<li><img src="{I(me, ic)}" alt="" width="44" height="44"><b>{n}</b><span>' + ''.join(f'<a href="{lk(k)}">{x}</a>' for k, x in links) + '</span></li>'
    hub = (f'<div class="gamehub rv" id="{"oyunlar" if lang == "tr" else "games"}"><h2>{t["bygame"]}</h2><p>{t["bygame_p"]}</p><ul>'
           + ''.join(row(f'icon-{g}.jpg', t[g], [('s' + g, t['help']), ('p' + g, t['privacy'])]) for g in ('yk', 'sy', 'fd', 'ky')) + '</ul></div>')
    body = f'''<section class="doc"><div class="wrap">
  <div class="side"><h1 class="d d-l intro">{h['h1']}</h1></div>
  <div class="main">
    <p class="intro" style="--i:1">{h['intro']}</p>
    <div class="mail intro" style="--i:2;margin-top:26px"><a href="mailto:{MAIL}">{MAIL}</a><button type="button" data-copy="{MAIL}" data-done="{t['copied']}">{t['copy']}</button></div>
    {hub}
  </div>
</div></section>
'''
    page('sup', lang, h['title'], h['intro'], body, cur='sup')

def backlink(me, lang):
    return f'<p class="allpol"><a href="{rel(me, P["sup"][0 if lang == "tr" else 1])}#{"oyunlar" if lang == "tr" else "games"}">{L[lang]["allpol"]} {AR}</a></p>'
def policy(key, lang, title, h1, meta, intro, secs):
    me = P[key][0 if lang == 'tr' else 1]
    s = ''.join(f'<h2>{x}</h2>' + ''.join(f'<p>{p}</p>' for p in ps) for x, ps in secs)
    body = f'''<section class="doc"><div class="wrap">
  <div class="side"><h1 class="d d-m intro">{h1}</h1><p class="meta intro" style="--i:1">{meta}</p></div>
  <div class="main intro" style="--i:2"><p>{intro}</p>{s}{backlink(me, lang)}</div>
</div></section>
'''
    page(key, lang, title, intro, body)
def support_one(key, lang, title, h1, intro, icon, name, faq):
    # tek oyunun destek sayfası (ortak Destek sayfasıyla aynı düzen): giriş, posta, sık sorulanlar
    t = L[lang]; me = P[key][0 if lang == 'tr' else 1]
    det = ''.join(f'<details><summary>{q}<span class="pm" aria-hidden="true"></span></summary><div class="ans"><p>{x}</p></div></details>' for q, x in faq)
    body = f'''<section class="doc"><div class="wrap">
  <div class="side"><h1 class="d d-l intro">{h1}</h1></div>
  <div class="main">
    <p class="intro" style="--i:1">{intro}</p>
    <div class="mail intro" style="--i:2;margin-top:26px"><a href="mailto:{MAIL}">{MAIL}</a><button type="button" data-copy="{MAIL}" data-done="{t['copied']}">{t['copy']}</button></div>
    <div class="faqgrp rv" style="margin-top:72px"><h2><img src="{I(me, icon)}" alt="" width="40" height="40">{name}</h2>{det}</div>
    {backlink(me, lang)}
  </div>
</div></section>
'''
    page(key, lang, title, intro, body, cur='sup')
ns2 = {'MAIL': MAIL, 'policy': policy, 'support_one': support_one, 'SUP': SUP}
exec(pol_src, ns2)
print('ok')
