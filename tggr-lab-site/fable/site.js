/* TGGR Lab. The page is one continuous zoom: a karyotype, chromosome 1, band 1q32, a gene, the
   double helix, a codon. The stage canvas follows the scroll; the content sits beside it.
   Also: theme (a circle opening from its button), scroll reveals, the section nav. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var sysDark = matchMedia('(prefers-color-scheme: dark)');
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function sstep(a, b, t) { return smooth((t - a) / (b - a)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  var TAU = Math.PI * 2;

  /* ---------------- theme ---------------- */
  var btn = document.getElementById('theme');
  function label() { if (btn) btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
  function flip() {
    var next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('tggr-theme', next); } catch (e) { /* private mode */ }
    label();
  }
  if (btn) btn.addEventListener('click', function () {
    if (!document.startViewTransition || reduce.matches) { flip(); return; }
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(flip).ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 750, easing: 'cubic-bezier(.2, .8, .2, 1)', pseudoElement: '::view-transition-new(root)' });
    });
  });
  label();
  sysDark.addEventListener('change', label);

  /* ---------------- reveals: items that enter together are staggered ---------------- */
  var revealIO = new IntersectionObserver(function (es) {
    var k = 0;
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.style.transitionDelay = (k++ * 70) + 'ms';
      e.target.classList.add('in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -6% 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });

  /* ---------------- section nav ---------------- */
  var navLinks = document.querySelectorAll('.sections a');
  var navIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      navLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); });
    });
  }, { rootMargin: '-40% 0px -55% 0px' });
  ['research', 'publications', 'tools', 'people'].forEach(function (id) { var s = document.getElementById(id); if (s) navIO.observe(s); });
  var heroIO = new IntersectionObserver(function (es) { if (es[0].isIntersecting) navLinks.forEach(function (a) { a.classList.remove('on'); }); }, { rootMargin: '-40% 0px -55% 0px' });
  var heroEl = document.querySelector('.hero'); if (heroEl) heroIO.observe(heroEl);

  /* ================= the stage ================= */
  var stage = document.getElementById('stage'), cv = document.getElementById('scene');
  var BANDS = window.TGGR_BANDS;
  if (!stage || !cv || !BANDS || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var ROWS = [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '10', '11', '12', 'X'], ['13', '14', '15', '16', '17', '18'], ['19', '20', '21', '22', 'Y']];
  var SEX = Math.random() < .5 ? 'XX' : 'XY';
  var TARGET_BAND = 'q32';
  var LABELS = ['46,' + SEX, 'chromosome 1', '1q32', 'gene', 'double helix', 'codons'];
  function LEN(c) { var b = BANDS[c]; return b[b.length - 1][2]; }
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  var SERIF = '"Cormorant Garamond", Georgia, serif';

  // the sequence at the deepest level: a reading frame, with one base that differs
  var SEQ = 'GATGGCTCGACTGAAG', FRAME = 1, VAR_I = 7, VAR_ALT = 'T';
  var COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
  var CODE = {
    TTT: ['Phe', 'Phenylalanine'], TTC: ['Phe', 'Phenylalanine'], TTA: ['Leu', 'Leucine'], TTG: ['Leu', 'Leucine'],
    CTT: ['Leu', 'Leucine'], CTC: ['Leu', 'Leucine'], CTA: ['Leu', 'Leucine'], CTG: ['Leu', 'Leucine'],
    ATT: ['Ile', 'Isoleucine'], ATC: ['Ile', 'Isoleucine'], ATA: ['Ile', 'Isoleucine'], ATG: ['Met', 'Methionine'],
    GTT: ['Val', 'Valine'], GTC: ['Val', 'Valine'], GTA: ['Val', 'Valine'], GTG: ['Val', 'Valine'],
    TCT: ['Ser', 'Serine'], TCC: ['Ser', 'Serine'], TCA: ['Ser', 'Serine'], TCG: ['Ser', 'Serine'],
    CCT: ['Pro', 'Proline'], CCC: ['Pro', 'Proline'], CCA: ['Pro', 'Proline'], CCG: ['Pro', 'Proline'],
    ACT: ['Thr', 'Threonine'], ACC: ['Thr', 'Threonine'], ACA: ['Thr', 'Threonine'], ACG: ['Thr', 'Threonine'],
    GCT: ['Ala', 'Alanine'], GCC: ['Ala', 'Alanine'], GCA: ['Ala', 'Alanine'], GCG: ['Ala', 'Alanine'],
    TAT: ['Tyr', 'Tyrosine'], TAC: ['Tyr', 'Tyrosine'], TAA: ['Ter', 'Stop'], TAG: ['Ter', 'Stop'],
    CAT: ['His', 'Histidine'], CAC: ['His', 'Histidine'], CAA: ['Gln', 'Glutamine'], CAG: ['Gln', 'Glutamine'],
    AAT: ['Asn', 'Asparagine'], AAC: ['Asn', 'Asparagine'], AAA: ['Lys', 'Lysine'], AAG: ['Lys', 'Lysine'],
    GAT: ['Asp', 'Aspartate'], GAC: ['Asp', 'Aspartate'], GAA: ['Glu', 'Glutamate'], GAG: ['Glu', 'Glutamate'],
    TGT: ['Cys', 'Cysteine'], TGC: ['Cys', 'Cysteine'], TGA: ['Ter', 'Stop'], TGG: ['Trp', 'Tryptophan'],
    CGT: ['Arg', 'Arginine'], CGC: ['Arg', 'Arginine'], CGA: ['Arg', 'Arginine'], CGG: ['Arg', 'Arginine'],
    AGT: ['Ser', 'Serine'], AGC: ['Ser', 'Serine'], AGA: ['Arg', 'Arginine'], AGG: ['Arg', 'Arginine'],
    GGT: ['Gly', 'Glycine'], GGC: ['Gly', 'Glycine'], GGA: ['Gly', 'Glycine'], GGG: ['Gly', 'Glycine']
  };

  var W = 0, H = 0, OH = 0, HH = 0, dpr = 1, fx = 0, fy = 0, cx = 0, narrow = false;
  var C = {};
  var depth = 0, want = 0, lastT = 0, dirty = true, bend = 0, intro = 0, t0 = 0;
  var ptr = { x: 0, y: 0, on: false };
  var hoverText = '', hoverKey = '';
  var LY = {};   // layout of every level, in stage pixels, origin at the focus point

  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function readColors() {
    var cs = getComputedStyle(root);
    ['bg', 'ink', 'muted', 'rule', 'rule-2', 'teal', 'orange', 'rod'].forEach(function (k) { C[k] = cs.getPropertyValue('--' + k).trim(); });
    C.dark = isDark();
    dirty = true;
  }

  /* ---------- layout ---------- */
  function layout() {
    var L0 = { rods: [], labels: [] };
    var rows = ROWS.map(function (r) { return r.filter(function (c) { return c !== 'Y' || SEX === 'XY'; }); });
    var rowMax = rows.map(function (r) { return Math.max.apply(null, r.map(LEN)); });
    var sumMax = rowMax.reduce(function (a, b) { return a + b; }, 0);
    var gap = 0.075 * OH;
    var k = (0.95 * OH - gap * (rows.length - 1)) / sumMax;
    var w = 0.021 * H, pg = 0.32 * w, gg = 1.25 * w;
    function copies(c) { return (c === 'Y' || (c === 'X' && SEX === 'XY')) ? 1 : 2; }
    function rowW(r) { return r.reduce(function (acc, c) { var n = copies(c); return acc + n * w + (n - 1) * pg; }, 0) + (r.length - 1) * gg; }
    var avail = narrow ? 0.92 * W : W - 190;
    var f = Math.min(1, avail / Math.max.apply(null, rows.map(rowW)));
    k *= f; w *= f; pg *= f; gg *= f;
    var total = sumMax * k + gap * (rows.length - 1);
    var y = -total / 2;
    rows.forEach(function (r, i) {
      var rh = rowMax[i] * k, x = -rowW(r) / 2;
      r.forEach(function (c) {
        var n = copies(c), h = LEN(c) * k, x0 = x;
        for (var j = 0; j < n; j++) { L0.rods.push({ c: c, x: x + w / 2, y: y + rh - h, h: h, w: w, first: j === 0 }); x += w + (j < n - 1 ? pg : 0); }
        L0.labels.push({ c: c, x: (x0 + x - (n > 1 ? pg : 0)) / 2, y: y + rh + 0.028 * H });
        x += gg;
      });
      y += rh + gap;
    });
    var r1 = L0.rods[0];
    L0.P = [r1.x, r1.y + r1.h / 2];
    L0.Z = OH / r1.h;
    L0.w = w;

    var L1 = { w: w * L0.Z, h: OH, top: -HH };
    var sc = L1.h / LEN('1');
    L1.bands = BANDS['1'].map(function (b) { return { n: b[0], s: b[1], e: b[2], st: b[3], y0: L1.top + b[1] * sc, y1: L1.top + b[2] * sc }; });
    var tb = L1.bands.filter(function (b) { return b.n === TARGET_BAND; })[0];
    L1.target = tb;
    L1.P = [0, (tb.y0 + tb.y1) / 2];
    L1.Z = OH / (tb.y1 - tb.y0);
    L1.above = L1.bands[L1.bands.indexOf(tb) - 1];
    L1.below = L1.bands[L1.bands.indexOf(tb) + 1];

    // genes along the axis: plus strand to the right, minus strand to the left
    var L2 = { bw: L1.w * L1.Z, gw: Math.max(2, 0.0045 * H), gx: 0.012 * H };
    L2.genes = [[-0.44, 0.07, 1], [-0.4, 0.04, -1], [-0.3, 0.025, 1], [-0.27, 0.09, -1], [-0.17, 0.05, 1], [-0.1, 0.11, -1], [-0.02, 0.03, 1],
      [0.04, 0.11, 1, true], [0.06, 0.045, -1], [0.17, 0.02, -1], [0.2, 0.06, 1], [0.27, 0.085, -1], [0.33, 0.04, 1], [0.42, 0.075, 1], [0.44, 0.03, -1]]
      .map(function (g) { return { x: g[2] * L2.gx, y: g[0] * OH, l: g[1] * OH, s: g[2], t: !!g[3] }; });
    var tg = L2.genes.filter(function (g) { return g.t; })[0];
    L2.P = [tg.x, tg.y];
    L2.Z = OH / tg.l;

    var L3 = { ew: L2.gw * L2.Z };
    L3.exons = [[-0.44, 0.06, 'utr5'], [-0.32, 0.038], [-0.195, 0.07], [-0.04, 0.088, 'target'], [0.125, 0.048], [0.255, 0.038], [0.41, 0.075, 'utr3']]
      .map(function (e) { return { y: e[0] * OH, h: e[1] * OH, k: e[2] || '' }; });
    var te = L3.exons[3];
    L3.P = [0, te.y];
    L3.Z = OH / te.h;

    var L4 = { A: Math.min(0.11 * OH, 0.1 * W), rs: 0.035 * OH, pitch: 0.375 * OH };
    L4.P = [0, 0];
    L4.Z = OH / (12 * L4.rs);

    var L5 = { X: L4.A * L4.Z, pitch: L4.rs * L4.Z };
    L5.P = [0, (VAR_I - 8) * L5.pitch];
    L5.Z = 1;

    LY = [L0, L1, L2, L3, L4, L5];
  }

  // screen = F + s * (local - o). Level L at depth d: its own zoom for d >= L, nested in L-1 below that.
  function xform(L, d) {
    var t = d - L, lv = LY[L];
    if (t >= 0 || L === 0) { var e = smooth(t), s = Math.pow(lv.Z, Math.max(0, t)); return { s: s, ox: lv.P[0] * e, oy: lv.P[1] * e, t: t }; }
    var p = xform(L - 1, d), lp = LY[L - 1];
    return { s: p.s / lp.Z, ox: lp.Z * (p.ox - lp.P[0]), oy: lp.Z * (p.oy - lp.P[1]), t: t };
  }
  function alphaOf(L, t) {
    var a = L === 5 ? sstep(-0.4, -0.1, t) : sstep(-0.6, -0.2, t);
    return a * (L === 5 ? 1 : L === 4 ? 1 - sstep(0.6, 0.9, t) : 1 - sstep(0.45, 0.85, t));
  }
  function localPtr(x) { return { x: (ptr.x - cx) / x.s + x.ox, y: (ptr.y - fy) / x.s + x.oy }; }

  /* ---------- drawing helpers ---------- */
  var STAIN = { gpos25: .22, gpos50: .42, gpos75: .62, gpos100: .86, gvar: .3, stalk: .3 };
  function chromPath(c, x, top, h, w) {
    var bands = BANDS[c], sc = h / LEN(c);
    var ac = bands.filter(function (b) { return b[3] === 'acen'; });
    var ct = top + ac[0][1] * sc, cb = top + ac[ac.length - 1][2] * sc, cm = (ct + cb) / 2;
    var r = Math.min(w / 2, (ct - top) / 2, (top + h - cb) / 2), p = new Path2D();
    p.roundRect(x - w / 2, top, w, ct - top, [r, r, 0, 0]);
    p.moveTo(x - w / 2, ct); p.lineTo(x - w * .22, cm); p.lineTo(x - w / 2, cb); p.lineTo(x + w / 2, cb); p.lineTo(x + w * .22, cm); p.lineTo(x + w / 2, ct); p.closePath();
    p.roundRect(x - w / 2, cb, w, top + h - cb, [0, 0, r, r]);
    return p;
  }
  function drawChrom(c, x, top, h, w, o) {
    o = o || {};
    var bands = BANDS[c], sc = h / LEN(c), p = chromPath(c, x, top, h, w);
    ctx.save();
    ctx.clip(p);
    ctx.fillStyle = C.rod; ctx.fillRect(x - w / 2, top, w, h);
    for (var i = 0; i < bands.length; i++) {
      var b = bands[i], y0 = top + b[1] * sc, bh = (b[2] - b[1]) * sc, st = b[3];
      if (st === 'gneg') continue;
      if (st === 'acen') { ctx.fillStyle = rgba(C.teal, .85); ctx.fillRect(x - w / 2, y0, w, bh + .3); continue; }
      ctx.fillStyle = rgba(C.ink, STAIN[st] || .4); ctx.fillRect(x - w / 2, y0, w, bh + .3);
      if (st === 'gvar' && bh > 6 && w > 5) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y0, w, bh); ctx.clip();
        ctx.strokeStyle = rgba(C.ink, .35); ctx.lineWidth = Math.max(.6, w * .04); ctx.beginPath();
        var step = Math.max(2.5, w * .28);
        for (var q = -w; q < bh + w; q += step) { ctx.moveTo(x - w / 2, y0 + q); ctx.lineTo(x + w / 2, y0 + q - w); }
        ctx.stroke(); ctx.restore();
      }
    }
    if (o.hoverBand) { ctx.fillStyle = rgba(C.teal, .28); ctx.fillRect(x - w / 2, o.hoverBand.y0, w, o.hoverBand.y1 - o.hoverBand.y0); }
    ctx.restore();
    ctx.lineWidth = Math.max(.5, w * .045); ctx.strokeStyle = o.hl ? C.teal : C['rule-2']; ctx.stroke(p);
    if (o.hl) { ctx.save(); ctx.globalAlpha *= .35; ctx.lineWidth = w * .5; ctx.strokeStyle = C.teal; ctx.stroke(p); ctx.restore(); }
  }
  function text(s, x, y, font, color, align, base) {
    ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = base || 'middle'; ctx.fillText(s, x, y);
  }
  function qpoint(ax, ay, cx, cy, bx, by, u) { var v = 1 - u; return [v * v * ax + 2 * v * u * cx + u * u * bx, v * v * ay + 2 * v * u * cy + u * u * by]; }

  /* ---------- level 0: the karyotype ---------- */
  function draw0(x, a) {
    var L = LY[0], lp = ptr.on && localPtr(x), hov = null;
    if (lp) for (var i = 0; i < L.rods.length; i++) { var r = L.rods[i]; if (Math.abs(lp.x - r.x) < r.w * 1.1 && lp.y > r.y - r.w && lp.y < r.y + r.h + r.w) { hov = r.c; break; } }
    if (hov) setHover('k' + hov, 'chromosome ' + hov);
    L.rods.forEach(function (r, i) {
      var f = reduce.matches ? 1 : sstep(i / L.rods.length * .7, i / L.rods.length * .7 + .3, intro);
      if (f <= 0) return;
      ctx.globalAlpha = a * f;
      if (f < 1) { ctx.save(); ctx.translate(0, (1 - f) * 0.03 * H); }
      drawChrom(r.c, r.x, r.y, r.h, r.w, { hl: r.c === hov });
      if (f < 1) ctx.restore();
      ctx.globalAlpha = a;
      if (r.c === '1' && r.first) {
        var sc = r.h / LEN('1'), b = LY[1].target;
        ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(1, r.w * .07);
        ctx.strokeRect(r.x - r.w / 2 - r.w * .18, r.y + b.s * sc, r.w * 1.36, (b.e - b.s) * sc);
      }
    });
    var fs = clamp(L.w * .68, 7.5, 12.5);
    ctx.globalAlpha = a * (reduce.matches ? 1 : sstep(.6, 1, intro));
    L.labels.forEach(function (l) {
      text(l.c, l.x, l.y, (l.c === hov ? '600 ' : '500 ') + fs + 'px ' + MONO, l.c === hov ? C.teal : l.c === '1' ? C.ink : C.muted);
    });
    ctx.globalAlpha = a;
  }

  /* ---------- level 1: chromosome 1 ---------- */
  function draw1(x, a) {
    var L = LY[1], lp = ptr.on && localPtr(x), hb = null;
    if (lp && Math.abs(lp.x) < L.w * 1.4) for (var i = 0; i < L.bands.length; i++) { var b = L.bands[i]; if (lp.y >= b.y0 && lp.y < b.y1) { hb = b; break; } }
    if (hb) setHover('b' + hb.n, '1' + hb.n + ' · ' + (hb.s / 1e6).toFixed(1) + '–' + (hb.e / 1e6).toFixed(1) + ' Mb');
    drawChrom('1', 0, L.top, L.h, L.w, { hoverBand: hb });
    var fs = clamp(0.015 * H, 8, 12.5), tx = -L.w / 2 - 0.028 * H;
    ctx.lineWidth = Math.max(.6, 0.0012 * H);
    L.bands.forEach(function (b) {
      var bh = b.y1 - b.y0; if (bh < fs * 1.05 && b !== L.target && b !== hb) return;
      var tgt = b === L.target, on = tgt || b === hb, ym = (b.y0 + b.y1) / 2;
      ctx.strokeStyle = tgt ? C.orange : on ? C.teal : C['rule-2']; ctx.beginPath(); ctx.moveTo(tx + 0.006 * H, ym); ctx.lineTo(-L.w / 2 - 0.006 * H, ym); ctx.stroke();
      text(b.n, tx, ym, (on ? '600 ' : '400 ') + fs + 'px ' + MONO, tgt ? C.orange : on ? C.teal : C.muted, 'right');
    });
    var tb = L.target;
    ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(1, 0.0022 * H);
    ctx.strokeRect(-L.w / 2 - L.w * .18, tb.y0, L.w * 1.36, tb.y1 - tb.y0);
  }

  /* ---------- level 2: inside the band, genes along the axis ---------- */
  function draw2(x, a) {
    var L = LY[2], t = x.t, lp = ptr.on && localPtr(x), hg = null;
    var ra = 1 - sstep(-0.35, 0.2, t);
    if (ra > 0) { ctx.fillStyle = C.rod; ctx.globalAlpha = a * ra; ctx.fillRect(-L.bw / 2, -HH, L.bw, OH); ctx.globalAlpha = a; }
    if (lp && Math.abs(lp.x) < 0.04 * H) for (var i = 0; i < L.genes.length; i++) { var g = L.genes[i]; if (Math.abs(lp.x - g.x) < L.gx && Math.abs(lp.y - g.y) < g.l / 2 + 0.004 * H) { hg = g; break; } }
    if (hg) setHover('g' + hg.y, 'gene · ' + (hg.s > 0 ? 'plus' : 'minus') + ' strand');
    // the band's edges, with its real neighbours
    var fs = clamp(0.014 * H, 8, 12), nb = LY[1];
    ctx.strokeStyle = rgba(C.ink, .3); ctx.lineWidth = Math.max(.8, 0.0014 * H);
    var lx = Math.min(0.3 * H, 0.42 * W);
    [[-HH, nb.above.n, -1], [HH, nb.below.n, 1]].forEach(function (e) {
      ctx.beginPath(); ctx.moveTo(-lx, e[0]); ctx.lineTo(lx, e[0]); ctx.stroke();
      text('1' + e[1], lx, e[0] + e[2] * fs * 1.1, '400 ' + fs + 'px ' + MONO, C.muted, 'right');
    });
    text('1q32', lx, -HH + fs * 1.1, '600 ' + fs + 'px ' + MONO, C.orange, 'right');
    // the axis
    ctx.strokeStyle = rgba(C.ink, .4); ctx.lineWidth = Math.max(1, 0.0025 * H);
    ctx.beginPath(); ctx.moveTo(0, -1.55 * HH); ctx.lineTo(0, 1.55 * HH); ctx.stroke();
    L.genes.forEach(function (g) {
      var on = g === hg, gw = L.gw * (on ? 1.5 : 1);
      ctx.fillStyle = g.t ? C.teal : on ? C.teal : rgba(C.ink, .5);
      if (g.t) { ctx.save(); ctx.shadowColor = rgba(C.teal, .7); ctx.shadowBlur = 0.025 * H; }
      ctx.beginPath(); ctx.roundRect(g.x - gw / 2, g.y - g.l / 2, gw, g.l, gw / 2); ctx.fill();
      if (g.t) ctx.restore();
      // the strand, as a chevron at the gene's 3' end
      var ch = Math.max(2, 0.005 * H), ex = g.x + g.s * (gw / 2 + ch * 1.4), ey = g.s > 0 ? g.y + g.l / 2 - ch : g.y - g.l / 2 + ch;
      ctx.strokeStyle = g.t ? C.orange : on ? C.teal : rgba(C.ink, .45); ctx.lineWidth = Math.max(.8, 0.0018 * H); ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(ex - ch, ey - g.s * ch); ctx.lineTo(ex, ey); ctx.lineTo(ex + ch, ey - g.s * ch);
      ctx.stroke(); ctx.lineCap = 'butt';
    });
  }

  /* ---------- level 3: the gene, exons and introns, splice arcs ---------- */
  function draw3(x, a, now) {
    var L = LY[3], ew = L.ew, ex = L.exons, lp = ptr.on && localPtr(x), he = null, inIntron = false;
    var first = ex[0], last = ex[ex.length - 1];
    if (lp && Math.abs(lp.x) < ew * 1.2 && lp.y > first.y - first.h / 2 - 0.03 * H && lp.y < last.y + last.h / 2 + 0.03 * H) {
      inIntron = true;
      for (var i = 0; i < ex.length; i++) if (Math.abs(lp.y - ex[i].y) < ex[i].h / 2 + 0.004 * H) { he = ex[i]; inIntron = false; break; }
    }
    if (he) setHover('e' + he.y, he.k === 'utr5' ? "exon · 5′ UTR" : he.k === 'utr3' ? "exon · 3′ UTR" : 'exon');
    else if (inIntron) setHover('intron', 'intron');
    ctx.strokeStyle = rgba(C.ink, .55); ctx.lineWidth = Math.max(1, 0.0032 * H);
    ctx.beginPath(); ctx.moveTo(0, first.y - 0.05 * H); ctx.lineTo(0, last.y + 0.05 * H); ctx.stroke();
    // splice arcs join each exon to the next; a dash runs along them 5' to 3'
    var n = ex.length - 1;
    ctx.lineCap = 'round';
    for (var j = 0; j < n; j++) {
      var e0 = ex[j], e1 = ex[j + 1], y0 = e0.y + e0.h / 2, y1 = e1.y - e1.h / 2, gap = y1 - y0;
      var bulge = clamp(gap * 1.1, 0.05 * H, 0.17 * H), ax = ew / 2, qx = ax + bulge, qy = (y0 + y1) / 2;
      var on = he && (he === e0 || he === e1);
      ctx.beginPath(); ctx.moveTo(ax, y0); ctx.quadraticCurveTo(qx, qy, ax, y1);
      ctx.strokeStyle = rgba(C.orange, on ? .95 : .55); ctx.lineWidth = Math.max(1, (on ? .0042 : .003) * H); ctx.stroke();
      if (!reduce.matches) {
        ctx.setLineDash([0.018 * H, 0.05 * H]); ctx.lineDashOffset = -(now / 1000) * 0.09 * H;
        ctx.strokeStyle = C.orange; ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.fillStyle = C.orange; ctx.beginPath(); ctx.arc(ax, y1, Math.max(1.5, .0045 * H), 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'butt';
    ex.forEach(function (e) {
      var on = e === he, utr = e.k === 'utr5' || e.k === 'utr3';
      ctx.fillStyle = C.teal; ctx.beginPath();
      if (utr) {
        var cut = e.h * .5, yA = e.y - e.h / 2, w2 = ew * .6;
        ctx.fillStyle = rgba(C.teal, .5);
        if (e.k === 'utr5') { ctx.roundRect(-w2 / 2, yA, w2, cut, [w2 / 3, w2 / 3, 0, 0]); ctx.fill(); ctx.fillStyle = C.teal; ctx.beginPath(); ctx.rect(-ew / 2, yA + cut, ew, e.h - cut); ctx.fill(); }
        else { ctx.roundRect(-w2 / 2, yA + e.h - cut, w2, cut, [0, 0, w2 / 3, w2 / 3]); ctx.fill(); ctx.fillStyle = C.teal; ctx.beginPath(); ctx.rect(-ew / 2, yA, ew, e.h - cut); ctx.fill(); }
      } else { ctx.rect(-ew / 2, e.y - e.h / 2, ew, e.h); ctx.fill(); }
      if (on || e.k === 'target') { ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(1, (on ? .0035 : .002) * H); ctx.strokeRect(-ew / 2 - .004 * H, e.y - e.h / 2 - .004 * H, ew + .008 * H, e.h + .008 * H); }
    });
    var fs = clamp(0.014 * H, 8, 12);
    text("5′", 0, first.y - first.h / 2 - 0.075 * H, '500 ' + fs + 'px ' + MONO, C.muted);
    text("3′", 0, last.y + last.h / 2 + 0.075 * H, '500 ' + fs + 'px ' + MONO, C.muted);
  }

  /* ---------- level 4: the double helix ---------- */
  function draw4(x, a, now) {
    var L = LY[4], t = x.t, lp = ptr.on && localPtr(x);
    // arriving from the exon, the helix is as wide and as tall as the exon it comes from
    var tw = 1 - sstep(0, 0.6, t), A = lerp(0.2 * OH, L.A, sstep(-0.7, 0, t)), ext = lerp(1, 1.55, sstep(-0.5, 0, t));
    var rot = reduce.matches ? 0.9 : now * 0.0007;
    var by = lp ? lp.y : 0, bx = lp ? clamp(lp.x, -0.3 * H, 0.3 * H) * 0.4 : 0, bw = 0.22 * H;
    function bendAt(y) { return bend * bx * Math.exp(-((y - by) / bw) * ((y - by) / bw)); }
    function th(y) { return (y / L.pitch * TAU + rot) * tw; }
    var y0 = -ext * HH, y1 = ext * HH, N = 110;
    var k0 = Math.ceil(y0 / L.rs), k1 = Math.floor(y1 / L.rs);
    var rungW = Math.max(1.2, 0.0055 * H), strandW = Math.max(1.5, 0.0075 * H);
    ctx.lineCap = 'round';
    // rungs
    for (var k = k0; k <= k1; k++) {
      var y = k * L.rs, c = Math.cos(th(y)), b = bendAt(y);
      var xa = A * c + b, xb = -A * c + b, vis = Math.abs(c);
      var near = lp ? Math.exp(-Math.pow((y - lp.y) / (0.09 * H), 2)) * bend : 0;
      var isVar = k === VAR_I - 8;
      ctx.strokeStyle = isVar ? C.orange : near > .05 ? rgba(C.orange, near) : rgba(C.ink, 0);
      if (!isVar) { ctx.strokeStyle = rgba(C.ink, .22 + .5 * vis); }
      ctx.lineWidth = rungW * (1 + near * .8);
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
      if (near > .05 && !isVar) { ctx.strokeStyle = rgba(C.orange, near * .9); ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); }
      if (isVar) { ctx.save(); ctx.shadowColor = rgba(C.orange, .8); ctx.shadowBlur = 0.015 * H; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke(); ctx.restore(); }
    }
    // strands: back pass then front pass
    [0, 1].forEach(function (pass) {
      [[1, C.orange], [-1, C.teal]].forEach(function (sd) {
        ctx.strokeStyle = sd[1]; ctx.lineWidth = strandW * (pass ? 1 : .8);
        ctx.globalAlpha = a * (pass ? 1 : .4);
        var drawing = false; ctx.beginPath();
        for (var i = 0; i <= N; i++) {
          var yy = y0 + (y1 - y0) * i / N, tt = th(yy), front = (sd[0] * Math.sin(tt)) >= -0.02 || tw < .08;
          var xx = sd[0] * A * Math.cos(tt) + bendAt(yy);
          if ((pass === 1) === front) { if (!drawing) { ctx.moveTo(xx, yy); drawing = true; } else ctx.lineTo(xx, yy); }
          else drawing = false;
        }
        ctx.stroke();
      });
    });
    ctx.globalAlpha = a; ctx.lineCap = 'butt';
    if (lp && Math.abs(lp.x) < A + 0.03 * H) setHover('helix', 'base pairs');
  }

  /* ---------- level 5: the ladder, read as codons ---------- */
  function draw5(x, a) {
    var L = LY[5], X = L.X, p = L.pitch, lp = ptr.on && localPtr(x), hi = -1;
    var n = SEQ.length;
    if (lp && Math.abs(lp.x) < X + 0.18 * H) { var ii = Math.round(lp.y / p) + 8; if (ii >= 0 && ii < n) hi = ii; }
    var hc = hi >= 0 ? Math.floor((hi - FRAME) / 3) : -1;
    if (hc >= 0) {
      var ci = FRAME + hc * 3, cod = SEQ.substr(ci, 3), isV = ci <= VAR_I && VAR_I < ci + 3;
      if (cod.length === 3 && CODE[cod]) {
        if (isV) { var alt = cod.substr(0, VAR_I - ci) + VAR_ALT + cod.substr(VAR_I - ci + 1); setHover('c' + hc, CODE[cod][1] + ' → ' + CODE[alt][1] + ' · ' + cod + ' → ' + alt); }
        else setHover('c' + hc, CODE[cod][1] + ' · ' + cod);
      }
    } else if (lp && hi >= 0) setHover('c-none', '');
    ctx.lineCap = 'round';
    var fadeY = function (y) { return 1 - sstep(0.75 * HH, 1.15 * HH, Math.abs(y)); };
    // strands
    [[-X, C.teal], [X, C.orange]].forEach(function (s) {
      var g = ctx.createLinearGradient(0, -1.3 * HH, 0, 1.3 * HH);
      g.addColorStop(0, rgba(s[1], 0)); g.addColorStop(.25, s[1]); g.addColorStop(.75, s[1]); g.addColorStop(1, rgba(s[1], 0));
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.5, 0.0075 * H);
      ctx.beginPath(); ctx.moveTo(s[0], -1.3 * HH); ctx.lineTo(s[0], 1.3 * HH); ctx.stroke();
    });
    var R = p * 0.3, fs = p * 0.42, lab = clamp(0.03 * H, 11, 24);
    for (var i = 0; i < n; i++) {
      var y = (i - 8) * p, f = fadeY(y); if (f <= 0) continue;
      var cI = Math.floor((i - FRAME) / 3), on = cI === hc && hc >= 0, isV = i === VAR_I;
      var base = SEQ[i], comp = COMP[base];
      ctx.globalAlpha = a * f;
      ctx.strokeStyle = isV ? C.orange : rgba(C.ink, on ? .8 : .4); ctx.lineWidth = Math.max(1.2, 0.0055 * H * L.Z * .7);
      ctx.beginPath(); ctx.moveTo(-X, y); ctx.lineTo(X, y); ctx.stroke();
      [[-X, isV ? VAR_ALT : base, C.teal], [X, isV ? COMP[VAR_ALT] : comp, C.orange]].forEach(function (s) {
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(s[0], y, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = isV ? C.orange : on ? C.teal : s[2]; ctx.lineWidth = Math.max(1, (isV || on ? .003 : .0018) * H);
        ctx.stroke();
        text(s[1], s[0], y + fs * .04, '500 ' + fs + 'px ' + MONO, isV ? C.orange : C.ink);
      });
      if (isV) {
        var vf = lab * .6, vs = base + '›' + VAR_ALT, vx = -X + R + 0.012 * H;
        ctx.font = '500 ' + vf + 'px ' + MONO; var vw = ctx.measureText(vs).width;
        ctx.fillStyle = C.bg; ctx.fillRect(vx - vf * .3, y - vf * .75, vw + vf * .6, vf * 1.5);
        text(vs, vx, y, '500 ' + vf + 'px ' + MONO, C.orange, 'left');
      }
    }
    // codon brackets and amino acids, on the right of the orange strand
    var bx = X + R + 0.03 * H;
    for (var c = 0; (FRAME + c * 3 + 2) < n; c++) {
      var ci2 = FRAME + c * 3, ya = (ci2 - 8) * p, yb = (ci2 + 2 - 8) * p, ym = (ya + yb) / 2, f2 = fadeY(ym);
      if (f2 <= 0) continue;
      var cod2 = SEQ.substr(ci2, 3), isV2 = ci2 <= VAR_I && VAR_I < ci2 + 3, on2 = c === hc;
      ctx.globalAlpha = a * f2;
      ctx.strokeStyle = on2 ? C.orange : rgba(C.ink, .45); ctx.lineWidth = Math.max(1, 0.0016 * H);
      ctx.beginPath(); ctx.moveTo(bx - 0.008 * H, ya - p * .3); ctx.lineTo(bx, ya - p * .3); ctx.lineTo(bx, yb + p * .3); ctx.lineTo(bx - 0.008 * H, yb + p * .3); ctx.stroke();
      var aa = CODE[cod2][0], font = '500 ' + lab + 'px ' + SERIF;
      if (isV2) {
        var alt2 = cod2.substr(0, VAR_I - ci2) + VAR_ALT + cod2.substr(VAR_I - ci2 + 1);
        text(aa, bx + 0.014 * H, ym - lab * .55, font, C.muted, 'left');
        ctx.strokeStyle = C.muted; ctx.lineWidth = Math.max(1, lab * .06); ctx.beginPath(); ctx.moveTo(bx + 0.012 * H, ym - lab * .5); ctx.lineTo(bx + 0.014 * H + lab * 1.5, ym - lab * .6); ctx.stroke();
        text(CODE[alt2][0], bx + 0.014 * H, ym + lab * .55, '600 ' + lab + 'px ' + SERIF, C.orange, 'left');
      } else text(aa, bx + 0.014 * H, ym, font, on2 ? C.orange : C.ink, 'left');
    }
    ctx.globalAlpha = a; ctx.lineCap = 'butt';
  }

  var DRAW = [draw0, draw1, draw2, draw3, draw4, draw5];

  /* ---------- readout, rail, hover ---------- */
  var roMain = document.getElementById('ro-main'), roSub = document.getElementById('ro-sub');
  var rail = document.getElementById('rail'), railItems = rail ? rail.querySelectorAll('li') : [], railMark = rail && rail.querySelector('.mark');
  var shownLevel = -1, shownSub = '';
  function setHover(key, s) { hoverKey = key; hoverText = s; }
  function updateChrome() {
    var lv = Math.round(depth);
    if (lv !== shownLevel) {
      shownLevel = lv; if (roMain) roMain.textContent = LABELS[lv];
      railItems.forEach(function (li, i) { li.classList.toggle('on', i === lv); });
    }
    if (hoverText !== shownSub) { shownSub = hoverText; if (roSub) roSub.textContent = hoverText; }
    if (railMark && railItems.length) {
      var i = Math.min(railItems.length - 2, Math.floor(depth)), f = depth - i;
      var a = railItems[i].offsetTop + railItems[i].offsetHeight / 2, b = railItems[i + 1].offsetTop + railItems[i + 1].offsetHeight / 2;
      railMark.style.top = (lerp(a, b, f) - 3.5) + 'px';
    }
  }
  railItems.forEach(function (li) {
    li.addEventListener('click', function () { var el = document.querySelector(li.dataset.go); if (el) el.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' }); });
  });

  /* ---------- the frame ---------- */
  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    hoverText = ''; hoverKey = '';
    // the karyotype sits a little right of centre to clear the rail; deeper levels are centred
    cx = fx + (narrow ? 0 : Math.min(70, W * .09) * (1 - sstep(0.5, 1.3, depth)));
    var lo = Math.max(0, Math.floor(depth) - 1), hi = Math.min(5, Math.floor(depth) + 1), list = [];
    for (var L = lo; L <= hi; L++) { var x = xform(L, depth), a = alphaOf(L, x.t); if (a > 0.003) list.push({ L: L, x: x, a: a }); }
    // the level nearest the viewer takes the pointer
    var top = list.reduce(function (m, it) { return (!m || it.a > m.a) ? it : m; }, null);
    list.forEach(function (it) {
      ctx.save();
      ctx.translate(cx, fy); ctx.scale(it.x.s, it.x.s); ctx.translate(-it.x.ox, -it.x.oy);
      ctx.globalAlpha = it.a;
      var keep = ptr.on; if (it !== top) ptr.on = false;
      DRAW[it.L](it.x, it.a, now);
      ptr.on = keep;
      ctx.restore();
    });
    updateChrome();
    return list.some(function (it) { return it.L === 3 || it.L === 4; });
  }
  var animated = false;
  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(.05, (now - lastT) / 1000) || .016; lastT = now;
    if (!t0) t0 = now;
    if (intro < 1) { intro = Math.min(1, (now - t0) / 1600); dirty = true; }
    if (reduce.matches) { var rw = Math.round(want); if (depth !== rw) { depth = rw; dirty = true; } }
    else if (depth !== want) { var nd = depth + (want - depth) * (1 - Math.exp(-dt * 7.5)); if (Math.abs(nd - want) < 2e-4) nd = want; depth = nd; dirty = true; }
    var tb = ptr.on ? 1 : 0; if (!reduce.matches && Math.abs(bend - tb) > .002) { bend += (tb - bend) * (1 - Math.exp(-dt * 6)); dirty = true; } else bend = reduce.matches ? 0 : tb;
    if (document.hidden) return;
    if (!dirty && !(animated && !reduce.matches)) return;
    animated = draw(now);
    dirty = false;
  }

  /* ---------- scroll to depth ---------- */
  var anchors = [0, 0, 0, 0, 0, 0];
  var secs = ['research', 'publications', 'tools', 'people'].map(function (id) { return document.getElementById(id); });
  function measure() {
    var vh = innerHeight, sh = stage.offsetHeight, line = sh < vh ? sh + vh * .1 : vh * .4;
    var max = Math.max(1, document.documentElement.scrollHeight - vh);
    anchors[0] = 0;
    secs.forEach(function (s, i) { var top = s.getBoundingClientRect().top + scrollY; anchors[i + 1] = Math.max(anchors[i] + 1, Math.min(max - (4 - i), top - line)); });
    anchors[5] = max;
    updateWant();
  }
  function updateWant() {
    var sy = scrollY, d;
    if (sy <= anchors[0]) d = 0; else if (sy >= anchors[5]) d = 5;
    else { var i = 0; while (i < 4 && sy >= anchors[i + 1]) i++; d = i + (sy - anchors[i]) / (anchors[i + 1] - anchors[i]); }
    want = clamp(d, 0, 5);
  }
  function resize() {
    var r = stage.getBoundingClientRect();
    W = Math.round(r.width); H = Math.round(r.height); narrow = matchMedia('(max-width: 900px)').matches;
    dpr = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    fx = W / 2; fy = narrow ? (H - 32) / 2 + 6 : H / 2;
    OH = narrow ? 0.7 * H : 0.8 * H; HH = OH / 2;
    layout(); measure(); dirty = true;
  }

  stage.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; dirty = true;
  });
  stage.addEventListener('pointerleave', function () { ptr.on = false; dirty = true; });
  addEventListener('scroll', updateWant, { passive: true });
  addEventListener('resize', resize);
  if (window.ResizeObserver) new ResizeObserver(function () { measure(); }).observe(document.querySelector('.content'));
  new MutationObserver(readColors).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  sysDark.addEventListener('change', readColors);
  reduce.addEventListener('change', function () { dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirty = true; });
  addEventListener('load', measure);

  readColors(); resize();
  depth = want;
  requestAnimationFrame(frame);
})();
