# sancargames.com — 2. tasarım. python3 build.py → site/
# Destek SSS ve gizlilik metinleri ../sg/build.py'den (içerik aynı) alınır; tasarım ve sayfalar burada.
import os, html, re
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get('SG_OUT') or os.path.join(HERE, 'site')
STORE = 'https://apps.apple.com/app/id6823286892'
YT = 'https://www.youtube.com/@demolitionmastergame'
IG = 'https://www.instagram.com/demolitionmaster.game/'
MAIL = 'support@sancargames.com'
FONTS = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
         '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap">')
APPLE = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.4 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7c1.3 0 2.1-1.1 2.8-2.3.9-1.3 1.3-2.6 1.3-2.6s-2.5-1-2.5-3.8zM14.1 5.7c.6-.8 1.1-1.9 1-3-.9 0-2.1.6-2.7 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.7-1.3z"/></svg>'
AR = '<span class="ar" aria-hidden="true">→</span>'
ARU = '<span class="ar" aria-hidden="true">↗</span>'

P = {'home': ('index.html', 'en/index.html'), 'yk': ('yikim-ustasi.html', 'en/demolition-master.html'),
     'sy': ('sayi-yolu.html', 'en/number-path.html'), 'sup': ('destek.html', 'en/support.html'),
     'pyk': ('gizlilik-yikim-ustasi.html', 'en/privacy-demolition-master.html'),
     'psy': ('gizlilik-sayi-yolu.html', 'en/privacy-number-path.html')}

def rel(frm, to):
    r = os.path.relpath(os.path.join(OUT, to), os.path.dirname(os.path.join(OUT, frm))).replace(os.sep, '/')
    if os.environ.get('SG_KEEPHTML'): return r
    return r[:-5] if r.endswith('.html') and not r.endswith('index.html') else (r[:-10] or './' if r.endswith('index.html') else r)
def url(k, lang): return 'https://sancargames.com/' + re.sub(r'(index)?\.html$', '', P[k][0 if lang == 'tr' else 1])

L = {
 'tr': dict(games='Oyunlar', studio='Stüdyo', support='Destek', privacy='Gizlilik', live='Yayında', soon='Yakında', other='EN', other_label='English',
   badge_s="App Store'dan", badge_b='İndirin', more='Oyunu incele', rights='Tüm hakları saklıdır.', menu='Menü', close='Kapat',
   copy='Kopyala', copied='Kopyalandı', yk='Yıkım Ustası', sy='Sayı Yolu', fd='Fenerli Dedektif', contact='İletişim', skip='İçeriğe geç',
   about="iPhone ve iPad için bulmaca ve fizik oyunları yapan bağımsız bir oyun stüdyosu.", lang_h='Dil', follow='Takip et'),
 'en': dict(games='Games', studio='Studio', support='Support', privacy='Privacy', live='Out now', soon='Coming soon', other='TR', other_label='Türkçe',
   badge_s='Download on the', badge_b='App Store', more='See the game', rights='All rights reserved.', menu='Menu', close='Close',
   copy='Copy', copied='Copied', yk='Demolition Master', sy='Number Path', fd='Lantern Detective', contact='Contact', skip='Skip to content',
   about='An independent studio making puzzle and physics games for iPhone and iPad.', lang_h='Language', follow='Follow'),
}

def badge(t, cls=''): return f'<a class="badge {cls}" href="{STORE}" target="_blank" rel="noopener">{APPLE}<span><small>{t["badge_s"]}</small><b>{t["badge_b"]}</b></span></a>'

def page(key, lang, title, desc, body, cur=None, ogimg='assets/img/yk-key-bg.jpg'):
    me = P[key][0 if lang == 'tr' else 1]; t = L[lang]; other = P[key][1 if lang == 'tr' else 0]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    A = lambda p: rel(me, p)
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
<link rel="icon" href="{A('assets/img/favicon.png')}">
<link rel="apple-touch-icon" href="{A('assets/img/favicon.png')}">
{FONTS}
<link rel="stylesheet" href="{A('assets/site.css')}">
<script>document.documentElement.classList.add('js')</script>
</head>
<body>
<a class="skip" href="#main">{t['skip']}</a>
<header class="bar"><div class="wrap">
  <a class="logo" href="{a('home')}" aria-label="Sancar Games"><img class="mk" src="{A('assets/img/logo-s.png')}" alt="" width="26" height="29"><b>Sancar Games</b></a>
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
    <div class="about"><a class="logo" href="{a('home')}"><img class="mk" src="{A('assets/img/logo-s-w.png')}" alt="" width="26" height="29"><b>Sancar Games</b></a><p>{t['about']}</p></div>
    <div class="col"><h4>{t['games']}</h4><ul><li><a href="{a('yk')}">{t['yk']}</a></li><li><a href="{a('sy')}">{t['sy']}</a></li><li><a href="{gl}">{t['fd']}</a></li></ul></div>
    <div class="col"><h4>{t['support']}</h4><ul><li><a href="{a('sup')}">{t['support']}</a></li><li><a href="{a('pyk')}">{t['privacy']}: {t['yk']}</a></li><li><a href="{a('psy')}">{t['privacy']}: {t['sy']}</a></li></ul></div>
    <div class="col"><h4>{t['contact']}</h4><ul><li><a href="mailto:{MAIL}">{MAIL}</a></li><li><a href="{rel(me, other)}" hreflang="{'en' if lang == 'tr' else 'tr'}">{t['other_label']}</a></li></ul></div>
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

def I(me, n): return rel(me, 'assets/img/' + n)
def phone(me, n, alt='', cls='', lazy=True):
    if n.startswith(('sy-','fd-')): cls += ' s'
    return f'<div class="phone {cls}"><img src="{I(me, n)}" alt="{html.escape(alt)}" width="720" height="1280"{" loading=lazy decoding=async" if lazy else ""}></div>'
def keyart(me, alt, eager=False):
    # Yıkım Ustası tanıtım görseli: arka plan (kule çöküyor) + usta soldan kayarak gelir
    lz = '' if eager else ' loading="lazy" decoding="async"'
    return (f'<figure class="keyart" role="img" aria-label="{html.escape(alt)}">'
            f'<img class="kb" src="{I(me,"yk-key-bg.jpg")}" alt="" width="941" height="1672"{lz}>'
            f'<img class="km" src="{I(me,"yk-key-man.webp")}" alt="" width="855" height="823"{lz}></figure>')
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
   fd_p='Karanlık odalarda fenerini gezdir, gizli ipuçlarını bul, şifreli sandığı aç ve kapıdan çık.', fd_k='Işıkla çözülen kaçış odaları',
   m_k='Stüdyo', m_q='Her bölümü <mark>elle</mark> tasarlıyor, her oyunu oynayarak dengeliyoruz.',
   m_p='Sancar Games küçük bir ekip. Fikirden yayına kadar tasarımı, kodu, sesi ve çeviriyi kendimiz yapıyoruz. Hedefimiz basit: açtığın anda anlaşılan, kapattıktan sonra aklında kalan oyunlar.',
   c_h='Bize yazın', c_p='Bir oyunla ilgili sorun, iş birliği ya da basın için. Genellikle iki iş günü içinde dönüyoruz.',
   yk_alt='Yıkım Ustası oynanışı: kule çöküyor', tag_s="App Store'da"),
 'en': dict(title='Sancar Games', desc='Sancar Games is an independent studio making puzzle and physics games for iPhone and iPad.',
   lead='An independent studio making short, clever, handcrafted games for iPhone and iPad.', scroll='Our games',
   feat_lead="Find the tower's load-bearing point, place the charge in the right spot and bring it down in one move. Every building collapses piece by piece with real physics.",
   games_h='Games', games_p='Each one plays in a few minutes. Putting it down is the hard part.',
   sy_p='Draw one path that visits every square once and hit each red number on exactly that step. A new puzzle every day.', sy_k='Path-drawing puzzle',
   fd_p='Sweep your lantern through dark rooms, find hidden clues, crack the coded chest and escape.', fd_k='Escape rooms solved with light',
   m_k='Studio', m_q='We design every level <mark>by hand</mark> and balance every game by playing it.',
   m_p='Sancar Games is a small team. From idea to release we do the design, code, sound and translation ourselves. Our goal is simple: games you understand the moment you open them and remember after you close them.',
   c_h='Write to us', c_p='About a game, a partnership or press. We usually reply within two business days.',
   yk_alt='Demolition Master gameplay: a tower collapsing', tag_s='On the App Store'),
}
for lang in ('tr', 'en'):
    t = L[lang]; h = H[lang]; me = P['home'][0 if lang == 'tr' else 1]
    a = lambda k: rel(me, P[k][0 if lang == 'tr' else 1])
    ykname = t['yk'] if lang == 'tr' else 'Demolition Master: Tower Blast'
    body = f'''<section class="hero" aria-label="Sancar Games">
  <div class="wrap grid">
    <h1 class="d d-xl"><span class="intro" style="--i:0;display:block">Sancar</span><span class="l2 intro" style="--i:1">Games<span class="dot" aria-hidden="true"></span></span></h1>
    <div class="copy intro" style="--i:3"><p class="lead">{h['lead']}</p><a class="scroll" href="#oyunlar"><span aria-hidden="true"></span>{h['scroll']}</a></div>
  </div>
</section>

<section class="feature" id="oyunlar" aria-labelledby="f-yk">
  <div class="wrap body">
    <div class="txt">
      <img class="icon rv" src="{I(me,'icon-yk.jpg')}" alt="" width="88" height="88" loading="lazy">
      <h2 class="d d-l rv" id="f-yk" style="--i:2;margin-top:18px">{ykname}</h2>
      <p class="lead rv" style="--i:3">{h['feat_lead']}</p>
      <div class="acts rv" style="--i:4">{badge(t)}<a class="tl" href="{a('yk')}">{t['more']} {AR}</a></div>
    </div>
    <div class="shots">{keyart(me, h['yk_alt'])}</div>
    </div>
  </div>
</section>

<section class="sec" aria-labelledby="g-h">
  <div class="wrap">
    <div class="sec-head"><h2 class="d d-l rv" id="g-h">{h['games_h']}</h2><p class="rv" style="--i:1">{h['games_p']}</p></div>
    <div class="mag">
      <a class="tile rv" href="{a('sy')}">
        <div class="art sy"><img class="icon" src="{I(me,'icon-sy.jpg')}" alt="" width="64" height="64" loading="lazy">{phone(me,'sy-intro-'+lang+'.jpg')}</div>
        <div class="cap"><h3 class="d d-s">{t['sy']}</h3><span class="pill soon">{t['soon']}</span><p>{h['sy_p']}</p><span class="tl">{t['more']} {AR}</span></div>
      </a>
      <div class="tile off rv" style="--i:1">
        <div class="art fd"><img class="icon" src="{I(me,'icon-fd.jpg')}" alt="" width="64" height="64" loading="lazy">{phone(me,'fd-menu-'+lang+'.jpg')}</div>
        <div class="cap"><h3 class="d d-s">{t['fd']}</h3><span class="pill soon">{t['soon']}</span><p>{h['fd_p']}</p></div>
      </div>
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
    <div class="m rv" style="--i:1"><p>{h['c_p']}</p><div class="mail"><a href="mailto:{MAIL}">{MAIL}</a><button type="button" data-copy="{MAIL}" data-done="{t['copied']}">{t['copy']}</button></div></div>
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
   meta="App Store'da yakında", band=None, gal=['sy-intro-tr.jpg','sy-play-tr.jpg'],
   rows=[('Tek kural','Her kareden bir kez geç, yalnızca yatay ve dikey git, kırmızı sayılara tam o adımda bas.'),
         ('Her gün yeni bulmaca','Günün bulmacasını çöz, serini koru.'),
         ('Yeni kurallar','İlerledikçe taşlar, duvarlar, oklar ve ışınlanma kapıları gibi yeni mekanikler tahtaya eklenir.')],
   rows_h='Nasıl oynanır', social=False),
 ('sy','en'): dict(title='Number Path · Sancar Games', name='Number Path', icon='icon-sy.jpg', live=False,
   lead='Draw one path with your finger that visits every square exactly once. Step on each red number at exactly that step. Easy to start, cleverly hard later.',
   meta='Coming soon to the App Store', band=None, gal=['sy-intro-en.jpg','sy-play-en.jpg'],
   rows=[('One rule','Visit every square once, move only horizontally or vertically, and hit each red number on exactly that step.'),
         ('A new puzzle every day','Solve the daily puzzle and keep your streak going.'),
         ('New twists','As you progress, new mechanics such as rocks, walls, arrows and portals join the board.')],
   rows_h='How to play', social=False),
}
for (k, lang), g in G.items():
    t = L[lang]; me = P[k][0 if lang == 'tr' else 1]
    a = lambda kk: rel(me, P[kk][0 if lang == 'tr' else 1])
    pol = 'pyk' if k == 'yk' else 'psy'
    vis = keyart(me, g['name'], eager=True) if k == 'yk' else phone(me, g['gal'][1], lazy=False)
    acts = (badge(t) + f'<span class="meta">{g["meta"]}</span>') if g['live'] else f'<span class="meta">{g["meta"]}</span>'
    h1 = 'Demolition Master: Tower Blast' if (k, lang) == ('yk', 'en') else g['name']
    rows = ''.join(f'<div class="row rv" style="--i:{i}"><h3 class="d d-s">{x}</h3><p>{y}</p></div>' for i, (x, y) in enumerate(g['rows']))
    band = f'<div class="band mask"><img data-par src="{I(me, g["band"])}" alt="" width="1080" height="608" loading="lazy"></div>' if g['band'] else ''
    gal = ''.join(phone(me, n, cls='settle') for n in g['gal'])
    social = ''
    if g['social']:
        social = f'''<section class="sec" style="padding-top:0" aria-label="{t['follow']}"><div class="wrap"><div class="biglinks rv">
  <a href="{YT}" target="_blank" rel="noopener">YouTube {ARU}</a><a href="{IG}" target="_blank" rel="noopener">Instagram {ARU}</a>
</div></div></section>'''
    help_ = f'''<section class="sec" style="padding-top:0" aria-label="{t['support']}"><div class="wrap"><div class="biglinks rv">
  <a href="{a('sup')}">{t['support']} {AR}</a><a href="{a(pol)}">{t['privacy']} {AR}</a>
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
{'' if (g['band'] or not g['gal']) else '<section class="sec" style="padding-top:0"><div class="wrap"><div class="gallery">'+gal+'</div></div></section>'}
{social}
{help_}
'''
    page(k, lang, g['title'], g['lead'], body, cur='games', ogimg='assets/img/' + (g['band'] or (g['gal'][0] if g['gal'] else 'yk-key-bg.jpg')))

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
    body = f'''<section class="doc"><div class="wrap">
  <div class="side"><h1 class="d d-l intro">{h['h1']}</h1></div>
  <div class="main">
    <p class="intro" style="--i:1">{h['intro']}</p>
    <div class="mail intro" style="--i:2;margin-top:26px"><a href="mailto:{MAIL}">{MAIL}</a><button type="button" data-copy="{MAIL}" data-done="{t['copied']}">{t['copy']}</button></div>
    <div class="faqgrp rv" style="margin-top:72px"><h2><img src="{I(me,'icon-yk.jpg')}" alt="" width="40" height="40">{ykn}</h2>{det(h['yk'])}</div>
    <div class="faqgrp rv"><h2><img src="{I(me,'icon-sy.jpg')}" alt="" width="40" height="40">{t['sy']}</h2>{det(h['sy'])}</div>
  </div>
</div></section>
'''
    page('sup', lang, h['title'], h['intro'], body, cur='sup')

def policy(key, lang, title, h1, meta, intro, secs):
    me = P[key][0 if lang == 'tr' else 1]
    s = ''.join(f'<h2>{x}</h2>' + ''.join(f'<p>{p}</p>' for p in ps) for x, ps in secs)
    body = f'''<section class="doc"><div class="wrap">
  <div class="side"><h1 class="d d-m intro">{h1}</h1><p class="meta intro" style="--i:1">{meta}</p></div>
  <div class="main intro" style="--i:2"><p>{intro}</p>{s}</div>
</div></section>
'''
    page(key, lang, title, intro, body)
ns2 = {'MAIL': MAIL, 'policy': policy}
exec(pol_src, ns2)
print('ok')
