// The hero backdrop, drawn in code: a night city, a crane swinging a wrecking ball into a block-built
// building. Cells the ball touches break off, the floors above drop into the gap, then the site resets.
(function () {
  var cv = document.getElementById('scene');
  if (!cv || !cv.getContext) return;
  var g = cv.getContext('2d'), far = document.createElement('canvas'), fg = far.getContext('2d');
  var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 0, H = 0, DPR = 1, S = 24, COLS = 7, ROWS = 12, bx = 0, ground = 0, jibY = 0, mastX = 0;
  var cols = [], bits = [], dust = [], px = 0, t = 0, phase = 'work', wait = 0, last = 0, running = false;
  var seed = 3; function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }

  // building plan: concrete columns every 3rd cell and at the ground floor, windows between, brick elsewhere
  function cellType(c, r) {
    if (r === 0 || c % 3 === 0) return 'c';
    return (r % 2 === 1) ? (rnd() < 0.42 ? 'L' : 'w') : 'b';
  }
  function build() {
    seed = 3; cols = [];
    for (var c = 0; c < COLS; c++) { var col = []; for (var r = 0; r < ROWS; r++) col.push({ k: cellType(c, r), off: 0, v: 0, a: phase === 'rise' ? 0 : 1 }); cols.push(col); }
  }
  function layout() {
    var r = cv.getBoundingClientRect(); DPR = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(320, r.width); H = Math.max(360, r.height);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    var wide = W > 860;
    ground = H - Math.round(H * 0.11);
    S = Math.round(Math.max(14, Math.min(30, H * 0.042)));
    if (!wide) { var cp = document.querySelector('.hero .copy'); if (cp) { var room = ground - (cp.getBoundingClientRect().bottom - r.top) - 18; S = Math.round(Math.max(12, Math.min(26, room / (ROWS + 3.6)))); } }
    var rtl = document.documentElement.dir === 'rtl';
    bx = Math.round(wide ? (rtl ? W * 0.34 - COLS * S * 0.2 : W * 0.66) : W * 0.5 - COLS * S * 0.2);
    jibY = ground - (ROWS + 3.2) * S; mastX = bx - 4 * S;
    px = bx - 1.2 * S;
    drawFar();
  }
  function drawFar() {
    far.width = cv.width; far.height = cv.height; fg.setTransform(DPR, 0, 0, DPR, 0, 0);
    var s2 = 7; for (var i = 0; i < 140; i++) { s2 = (s2 * 16807) % 2147483647; var x = (s2 / 2147483647) * W; s2 = (s2 * 16807) % 2147483647; var y = (s2 / 2147483647) * H * 0.55; fg.fillStyle = 'rgba(255,255,255,' + (0.25 + (i % 5) * 0.12) + ')'; fg.fillRect(x, y, i % 9 ? 1.5 : 2.5, i % 9 ? 1.5 : 2.5); }
    var glow = fg.createLinearGradient(0, H * 0.45, 0, ground); glow.addColorStop(0, 'rgba(224,122,44,0)'); glow.addColorStop(1, 'rgba(224,122,44,.22)'); fg.fillStyle = glow; fg.fillRect(0, H * 0.45, W, ground - H * 0.45);
    function sky(base, hmin, hmax, col, lit, p) {
      var x = -20; while (x < W + 20) { s2 = (s2 * 16807) % 2147483647; var w = 40 + (s2 / 2147483647) * 80; s2 = (s2 * 16807) % 2147483647; var h = hmin + (s2 / 2147483647) * (hmax - hmin);
        fg.fillStyle = col; fg.fillRect(x, base - h, w, h + 4);
        for (var yy = base - h + 10; yy < base - 10; yy += 16) for (var xx = x + 7; xx < x + w - 8; xx += 13) { s2 = (s2 * 16807) % 2147483647; if (s2 / 2147483647 < p) { fg.fillStyle = lit; fg.fillRect(xx, yy, 5, 7); } }
        x += w + 4; }
    }
    sky(ground, H * 0.18, H * 0.48, '#18203a', 'rgba(242,196,90,.32)', 0.16);
    sky(ground, H * 0.08, H * 0.26, '#111729', 'rgba(242,196,90,.5)', 0.1);
    fg.fillStyle = '#2b2118'; fg.fillRect(0, ground, W, H - ground);
    fg.fillStyle = '#3a2c1f'; fg.fillRect(0, ground, W, 4);
    var tape = 18; for (var tx = -tape; tx < W; tx += tape * 2) { fg.fillStyle = '#f5b700'; fg.beginPath(); fg.moveTo(tx, ground + 14); fg.lineTo(tx + tape, ground + 14); fg.lineTo(tx + tape * 1.6, ground + 22); fg.lineTo(tx + tape * 0.6, ground + 22); fg.fill(); }
    fg.fillStyle = 'rgba(0,0,0,.25)'; fg.fillRect(0, ground + 22, W, H);
  }

  function cellRect(c, r, cell) { return { x: bx + c * S, y: ground - (r + 1) * S + cell.off, w: S, h: S }; }
  function drawCell(x, y, k, a) {
    g.globalAlpha = a;
    if (k === 'c') { g.fillStyle = '#8d939f'; g.fillRect(x, y, S, S); g.fillStyle = '#a3a9b4'; g.fillRect(x + 2, y + 2, S - 4, S * 0.35); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x + S * 0.25, y + S * 0.55, 3, 3); g.fillRect(x + S * 0.65, y + S * 0.7, 3, 3); }
    else if (k === 'b') { g.fillStyle = '#a5452f'; g.fillRect(x, y, S, S); g.fillStyle = '#6e2a1c'; var h = S / 3; for (var i = 1; i < 3; i++) g.fillRect(x, y + i * h - 1, S, 2); g.fillRect(x + S / 2 - 1, y, 2, h); g.fillRect(x + S / 4, y + h, 2, h); g.fillRect(x + S * 0.75, y + h, 2, h); g.fillRect(x + S / 2 - 1, y + 2 * h, 2, h); }
    else { g.fillStyle = '#5b5f68'; g.fillRect(x, y, S, S); g.fillStyle = k === 'L' ? '#f2c45a' : '#2c4a6e'; g.fillRect(x + 3, y + 3, S - 6, S - 6); if (k === 'w') { g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 3, y + S - 3); g.lineTo(x + 3, y + S * 0.55); g.lineTo(x + S * 0.55, y + 3); g.lineTo(x + S * 0.75, y + 3); g.fill(); } g.fillStyle = '#5b5f68'; g.fillRect(x + S / 2 - 1, y + 3, 2, S - 6); }
    g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5; g.strokeRect(x + 0.75, y + 0.75, S - 1.5, S - 1.5);
    g.globalAlpha = 1;
  }
  function lattice(x1, y1, x2, y2, wdt, horizontal) {
    g.strokeStyle = '#f5b700'; g.lineWidth = Math.max(2, S * 0.12); g.beginPath();
    if (horizontal) { g.moveTo(x1, y1); g.lineTo(x2, y1); g.moveTo(x1, y1 + wdt); g.lineTo(x2, y1 + wdt); for (var x = x1; x < x2; x += wdt) { g.moveTo(x, y1); g.lineTo(Math.min(x2, x + wdt), y1 + wdt); } }
    else { g.moveTo(x1, y1); g.lineTo(x1, y2); g.moveTo(x1 + wdt, y1); g.lineTo(x1 + wdt, y2); for (var y = y1; y < y2; y += wdt) { g.moveTo(x1, y); g.lineTo(x1 + wdt, Math.min(y2, y + wdt)); } }
    g.stroke();
  }
  function ballPos() {
    var L = (ROWS - 4.2) * S, amp = 0.5, th = amp * Math.sin(t * 1.55);
    return { x: px + L * Math.sin(th), y: jibY + S * 0.5 + L * Math.cos(th), r: S * 0.72, vx: Math.cos(t * 1.55) };
  }
  function crane(b) {
    var w = S * 0.7, end = bx + (COLS + 1.5) * S;
    lattice(mastX, jibY - S * 1.4, 0, ground, w, false);
    lattice(mastX - 3 * S, jibY, end, 0, w * 0.9, true);
    g.fillStyle = '#f5b700'; g.fillRect(mastX - S * 0.3, jibY - S * 2.2, w + S * 0.6, S * 0.9);
    g.fillStyle = '#2a2d34'; g.fillRect(mastX - 3 * S, jibY + w * 0.9, S * 1.2, S * 0.9);
    g.fillStyle = '#f5b700'; g.fillRect(px - S * 0.35, jibY + w * 0.9, S * 0.7, S * 0.3);
    g.strokeStyle = '#1b1c20'; g.lineWidth = 2; g.beginPath(); g.moveTo(px, jibY + w * 0.9 + S * 0.3); g.lineTo(b.x, b.y); g.stroke();
    var grd = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.1, b.x, b.y, b.r); grd.addColorStop(0, '#5a5e68'); grd.addColorStop(1, '#141519');
    g.fillStyle = grd; g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill();
  }
  function hit(b) {
    var n = 0;
    for (var c = 0; c < COLS && n < 3; c++) {
      var col = cols[c];
      for (var r = col.length - 1; r >= 0; r--) {
        var cell = col[r]; if (cell.a < 1) continue;
        var R = cellRect(c, r, cell), nx = Math.max(R.x, Math.min(b.x, R.x + S)), ny = Math.max(R.y, Math.min(b.y, R.y + S));
        if ((b.x - nx) * (b.x - nx) + (b.y - ny) * (b.y - ny) < b.r * b.r) {
          col.splice(r, 1); n++;
          for (var q = r; q < col.length; q++) { col[q].off -= S; }
          for (var i = 0; i < 5; i++) bits.push({ x: R.x + S / 2, y: R.y + S / 2, vx: (b.vx > 0 ? 1 : -0.4) * (60 + Math.random() * 160), vy: -60 - Math.random() * 140, s: S * (0.22 + Math.random() * 0.25), rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, k: cell.k, life: 2.2 });
          for (var j = 0; j < 3; j++) dust.push({ x: R.x + S / 2 + (Math.random() - 0.5) * S, y: R.y + S / 2, r: S * 0.4, life: 1 });
        }
      }
    }
  }
  function left() { var n = 0; cols.forEach(function (c) { n += c.length; }); return n; }

  function step(dt) {
    t += dt;
    if (phase === 'work') {
      px += S * 0.55 * dt;
      var b = ballPos(); hit(b);
      if (px > bx + (COLS + 0.6) * S || left() < COLS * ROWS * 0.3) { phase = 'settle'; wait = 2.2; }
    } else if (phase === 'settle') { wait -= dt; px += (bx - 1.2 * S - px) * Math.min(1, dt * 1.2); if (wait <= 0) { phase = 'rise'; build(); } }
    else if (phase === 'rise') { var done = true; cols.forEach(function (col, c) { col.forEach(function (cell, r) { var d = (c * 0.05 + r * 0.06); cell.a = Math.min(1, cell.a + dt * 1.6 * (t % 100 > d ? 1 : 0)); if (cell.a < 1) done = false; }); }); if (done) phase = 'work'; }
    cols.forEach(function (col) { col.forEach(function (cell) { if (cell.off < 0) { cell.v += 1800 * dt; cell.off = Math.min(0, cell.off + cell.v * dt); if (cell.off === 0) cell.v = 0; } }); });
    for (var i = bits.length - 1; i >= 0; i--) { var p = bits[i]; p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; if (p.y > ground - p.s / 2) { p.y = ground - p.s / 2; p.vy *= -0.25; p.vx *= 0.6; p.vr *= 0.5; } p.life -= dt; if (p.life <= 0) bits.splice(i, 1); }
    for (var j = dust.length - 1; j >= 0; j--) { var d2 = dust[j]; d2.r += S * 1.2 * dt; d2.y -= S * 0.3 * dt; d2.life -= dt * 0.9; if (d2.life <= 0) dust.splice(j, 1); }
  }
  function draw() {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(far, 0, 0);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols.forEach(function (col, c) { col.forEach(function (cell, r) { var R = cellRect(c, r, cell); drawCell(R.x, R.y, cell.k, cell.a); }); });
    g.fillStyle = '#5b5f68'; g.fillRect(bx - 3, ground - 3, COLS * S + 6, 3);
    crane(ballPos());
    bits.forEach(function (p) { g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.globalAlpha = Math.min(1, p.life); g.fillStyle = p.k === 'b' ? '#a5452f' : p.k === 'c' ? '#8d939f' : p.k === 'L' ? '#f2c45a' : '#4a6d93'; g.fillRect(-p.s / 2, -p.s / 2, p.s, p.s); g.restore(); });
    dust.forEach(function (d) { g.globalAlpha = Math.max(0, d.life) * 0.35; g.fillStyle = '#c9b9a3'; g.beginPath(); g.arc(d.x, d.y, d.r, 0, Math.PI * 2); g.fill(); });
    g.globalAlpha = 1;
  }
  function loop(now) {
    if (!running) return;
    var dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
    step(dt); draw(); requestAnimationFrame(loop);
  }
  function start() { if (running || still) return; running = true; last = 0; requestAnimationFrame(loop); }
  function stop() { running = false; }

  layout(); build();
  if (still) { px = bx + 1.2 * S; t = 0.4; draw(); }
  else { draw(); start(); }
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { layout(); draw(); }, 120); });
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { e.isIntersecting ? start() : stop(); }); }).observe(cv);
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
})();
