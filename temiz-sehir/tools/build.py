#!/usr/bin/env python3
"""Single-file build: www/index.html + www/js/*.js -> www/tek.html (MIMARI.md §10).

The claude.ai artifact host wraps a BODY FRAGMENT in its own document, so tek.html starts with <title> and has no
<!doctype>/<html>/<head>/<body>. Order: <title>, the viewport <meta>, the style block between the BUILD:STYLE
markers, the body markup, the three.js r128 CDN <script> (the only external request), then ONE
<script type="module"> holding every module wrapped as  window.__TS_MODS.<name> = (function () { ... return {...}; })();
followed by main.js verbatim (its loadModule() reads window.__TS_MODS and never reaches the dynamic import()).

Rules enforced (MIMARI §3): exports only as `export function|async function|const|let|class name`; any other
import/export line, or import.meta outside main.js, is a build error. '</script' is escaped. Fails above 2 MB.

  python3 tools/build.py            -> www/tek.html, prints the size
"""
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WWW = os.path.join(ROOT, 'www')
ORDER = ['config', 'bus', 'world', 'trash', 'player', 'tools', 'economy', 'audio', 'ui', 'debug']
THREE_TAG = '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>'
EXPORT_RE = re.compile(r'^export (?:async )?function\*? ?(\w+)|^export (?:const|let|class) (\w+)')
BAD_RE = re.compile(r'^\s*(import|export)\b')
MAX_BYTES = 2 * 1024 * 1024


def fail(msg):
    sys.stderr.write('build error: ' + msg + '\n')
    sys.exit(1)


def wrap(name, src):
    names, out = [], []
    for n, line in enumerate(src.split('\n'), 1):
        m = EXPORT_RE.match(line)
        if m:
            names.append(m.group(1) or m.group(2))
            line = line[len('export '):]
        elif BAD_RE.match(line):
            fail('%s.js:%d: only "export function/const/let/class name" is allowed (MIMARI §3): %s' % (name, n, line.strip()[:80]))
        if 'import.meta' in line:
            fail('%s.js:%d: import.meta is not allowed in modules' % (name, n))
        out.append(line)
    if not names:
        fail(name + '.js exports nothing')
    body = '\n'.join(out)
    return ('window.__TS_MODS.%s = (function () {\n%s\nreturn { %s };\n})();\n' % (name, body, ', '.join(names)))


def squeeze(src):
    """Conservative size cut that keeps every line: drop indentation, blank lines and full-line // comments.
    Safe for this code base (no multi-line strings whose leading spaces or '//'-lines matter: CSS, GLSL, HTML)."""
    out = []
    for line in src.split('\n'):
        t = line.strip()
        if not t or t.startswith('//'):
            continue
        out.append(t)
    return '\n'.join(out)


def main():
    with open(os.path.join(WWW, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    title = re.search(r'<title>.*?</title>', html, re.S)
    viewport = re.search(r'<meta name="viewport"[^>]*>', html)
    style = re.search(r'<!-- BUILD:STYLE-START[^>]*-->\s*(.*?)\s*<!-- BUILD:STYLE-END -->', html, re.S)
    body = re.search(r'<body>\s*(.*?)\s*<script src="https://cdnjs', html, re.S)
    if not (title and viewport and style and body):
        fail('index.html markers not found (title, viewport meta, BUILD:STYLE-START/END, body before the three.js tag)')
    if THREE_TAG not in html:
        fail('index.html does not load three.js r128 from cdnjs with the expected tag')

    parts = ['window.__TS_MODS = {};\n']
    for name in ORDER:
        p = os.path.join(WWW, 'js', name + '.js')
        if not os.path.exists(p):
            continue
        with open(p, encoding='utf-8') as f:
            parts.append(wrap(name, f.read()))
    with open(os.path.join(WWW, 'js', 'main.js'), encoding='utf-8') as f:
        main_src = f.read()
    for n, line in enumerate(main_src.split('\n'), 1):
        if BAD_RE.match(line):
            fail('main.js:%d: static import/export in main.js' % n)
    parts.append(main_src)
    bundle = '\n'.join(parts)
    if '--no-min' not in sys.argv:
        bundle = squeeze(bundle)
    bundle = re.sub(r'</script', r'<\\/script', bundle, flags=re.I)

    out = '\n'.join([
        title.group(0),
        viewport.group(0),
        style.group(1),
        body.group(1),
        THREE_TAG,
        '<script type="module">',
        bundle,
        '</script>',
        '',
    ])
    data = out.encode('utf-8')
    if len(data) > MAX_BYTES:
        fail('tek.html is %d bytes (limit %d)' % (len(data), MAX_BYTES))
    dst = os.path.join(WWW, 'tek.html')
    with open(dst, 'wb') as f:
        f.write(data)
    print('www/tek.html: %d bytes (%.1f KB), modules: %s' % (len(data), len(data) / 1024, ', '.join(n for n in ORDER if os.path.exists(os.path.join(WWW, 'js', n + '.js')))))


if __name__ == '__main__':
    main()
