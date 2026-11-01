/* TGGR Lab. The page is one continuous zoom: a karyotype, chromosome 1, band 1q32, a gene, the
   double helix, a codon. On wide screens a stage canvas follows the scroll beside the content; on
   narrow screens the same six levels are drawn as small still figures between the sections.
   Also: theme (a circle opening from its button), scroll reveals, the section nav. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var sysDark = matchMedia('(prefers-color-scheme: dark)');
  var mobileMQ = matchMedia('(max-width: 900px)');
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

  /* ================= the drawings ================= */
  var stage = document.getElementById('stage'), cv = document.getElementById('scene');
  var BANDS = window.TGGR_BANDS;
  if (!cv || !BANDS || !cv.getContext) return;
  var ROWS = [['1', '2', '3', '4', '5'], ['6', '7', '8', '9', '10', '11', '12', 'X'], ['13', '14', '15', '16', '17', '18'], ['19', '20', '21', '22', 'Y']];
  var ORDER = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', 'X', 'Y'];
  var SEX = Math.random() < .5 ? 'XX' : 'XY';
  var TARGET_BAND = 'q32';
  function LEN(c) { var b = BANDS[c]; return b[b.length - 1][2]; }
  var MONO = '"JetBrains Mono", ui-monospace, Menlo, monospace';
  var SERIF = '"Cormorant Garamond", Georgia, serif';

  // the sequence at the deepest level: a reading frame, with one base that differs
  var SEQ = 'GATGGCTCGACTGAAG', FRAME = 1, VAR_I = 7, VAR_ALT = 'T';
  var COMP = { A: 'T', T: 'A', G: 'C', C: 'G' };
  var CODE = {
    TTT: 'Phe', TTC: 'Phe', TTA: 'Leu', TTG: 'Leu', CTT: 'Leu', CTC: 'Leu', CTA: 'Leu', CTG: 'Leu',
    ATT: 'Ile', ATC: 'Ile', ATA: 'Ile', ATG: 'Met', GTT: 'Val', GTC: 'Val', GTA: 'Val', GTG: 'Val',
    TCT: 'Ser', TCC: 'Ser', TCA: 'Ser', TCG: 'Ser', CCT: 'Pro', CCC: 'Pro', CCA: 'Pro', CCG: 'Pro',
    ACT: 'Thr', ACC: 'Thr', ACA: 'Thr', ACG: 'Thr', GCT: 'Ala', GCC: 'Ala', GCA: 'Ala', GCG: 'Ala',
    TAT: 'Tyr', TAC: 'Tyr', TAA: 'Ter', TAG: 'Ter', CAT: 'His', CAC: 'His', CAA: 'Gln', CAG: 'Gln',
    AAT: 'Asn', AAC: 'Asn', AAA: 'Lys', AAG: 'Lys', GAT: 'Asp', GAC: 'Asp', GAA: 'Glu', GAG: 'Glu',
    TGT: 'Cys', TGC: 'Cys', TGA: 'Ter', TGG: 'Trp', CGT: 'Arg', CGC: 'Arg', CGA: 'Arg', CGG: 'Arg',
    AGT: 'Ser', AGC: 'Ser', AGA: 'Arg', AGG: 'Arg', GGT: 'Gly', GGC: 'Gly', GGA: 'Gly', GGG: 'Gly'
  };

  // the bound view: whichever canvas is being drawn. H is the length of the object's axis.
  var ctx, W = 0, H = 0, OH = 0, HH = 0, dpr = 1, fx = 0, fy = 0, cx = 0, ROT = false, ROW = false, LY = [];
  var C = {};
  var ptr = { x: 0, y: 0, on: false };
  var depth = 0, want = 0, bend = 0, intro = 0;

  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mix(a, b, t) {
    function p(hex) { var h = hex.replace('#', ''); if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]; var n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    var A = p(a), B = p(b), o = A.map(function (v, i) { return Math.round(lerp(v, B[i], t)); });
    return '#' + o.map(function (v) { return ('0' + v.toString(16)).slice(-2); }).join('');
  }
  function readColors() {
    var cs = getComputedStyle(root);
    ['bg', 'ink', 'muted', 'rule', 'rule-2', 'teal', 'orange', 'rod'].forEach(function (k) { C[k] = cs.getPropertyValue('--' + k).trim(); });
    C.band = mix(C.ink, C.teal, .45);      // G-bands: ink leaning teal, at low alpha
    C.dark = isDark();
  }

  function bind(v) {
    ctx = v.ctx; W = v.W; H = v.H; OH = v.OH; HH = OH / 2; dpr = v.dpr; fx = v.fx; fy = v.fy; cx = v.cx; ROT = !!v.ROT; ROW = !!v.ROW; LY = v.LY;
  }
  function fsz(k, lo, hi) { return ROT ? clamp(k * H * 1.9, 9, 11.5) : clamp(k * H, lo, hi); }

  /* ---------- layout, in stage pixels, origin at the focus point ---------- */
  function layout() {
    var L0 = { rods: [], labels: [] };
    var rows = ROWS.map(function (r) { return r.filter(function (c) { return c !== 'Y' || SEX === 'XY'; }); });
    var rowMax = rows.map(function (r) { return Math.max.apply(null, r.map(LEN)); });
    var sumMax = rowMax.reduce(function (a, b) { return a + b; }, 0);
    var gap = 0.08 * OH;
    var k = (0.95 * OH - gap * (rows.length - 1)) / sumMax;
    var w = 0.019 * H, pg = 0.32 * w, gg = 1.3 * w;
    function copies(c) { return (c === 'Y' || (c === 'X' && SEX === 'XY')) ? 1 : 2; }
    function rowW(r) { return r.reduce(function (acc, c) { var n = copies(c); return acc + n * w + (n - 1) * pg; }, 0) + (r.length - 1) * gg; }
    var avail = Math.max(W - 190, 0.5 * W);
    var f = Math.min(1, avail / Math.max.apply(null, rows.map(rowW)));
    k *= f; w *= f; pg *= f; gg *= f;
    if (ROW) {
      // narrow screens: one copy of each chromosome in a row
      var list = ORDER.filter(function (c) { return c !== 'Y' || SEX === 'XY'; }), pad = 0.03 * W;
      var pitch = (W - 2 * pad) / list.length, kk = 0.74 * H / LEN('1'), ww = Math.min(pitch * .5, 0.06 * H), base = 0.33 * H;
      list.forEach(function (c, i) {
        var h = LEN(c) * kk, x = -W / 2 + pad + pitch * (i + .5);
        L0.rods.push({ c: c, x: x, y: base - h, h: h, w: ww, first: true });
        if (c === '1' || c === 'X' || c === 'Y') L0.labels.push({ c: c, x: x, y: base + 0.1 * H });
      });
      L0.w = ww;
    } else {
      var total = sumMax * k + gap * (rows.length - 1), y = -total / 2;
      rows.forEach(function (r, i) {
        var rh = rowMax[i] * k, x = -rowW(r) / 2;
        r.forEach(function (c) {
          var n = copies(c), h = LEN(c) * k, x0 = x;
          for (var j = 0; j < n; j++) { L0.rods.push({ c: c, x: x + w / 2, y: y + rh - h, h: h, w: w, first: j === 0 }); x += w + (j < n - 1 ? pg : 0); }
          L0.labels.push({ c: c, x: (x0 + x - (n > 1 ? pg : 0)) / 2, y: y + rh + 0.03 * H });
          x += gg;
        });
        y += rh + gap;
      });
      L0.w = w;
    }
    var r1 = L0.rods[0];
    L0.P = [r1.x, r1.y + r1.h / 2];
    L0.Z = OH / r1.h;

    var L1 = { w: ROW || ROT ? 0.066 * H : w * L0.Z, h: OH, top: -HH };
    var sc = L1.h / LEN('1');
    L1.bands = BANDS['1'].map(function (b) { return { n: b[0], s: b[1], e: b[2], st: b[3], y0: L1.top + b[1] * sc, y1: L1.top + b[2] * sc }; });
    var tb = L1.bands.filter(function (b) { return b.n === TARGET_BAND; })[0];
    L1.target = tb;
    L1.P = [0, (tb.y0 + tb.y1) / 2];
    L1.Z = OH / (tb.y1 - tb.y0);
    L1.above = L1.bands[L1.bands.indexOf(tb) - 1];
    L1.below = L1.bands[L1.bands.indexOf(tb) + 1];

    // genes along the axis: plus strand to the right, minus strand to the left
    var L2 = { bw: ROT ? 0.6 * W : L1.w * L1.Z, gw: Math.max(2, 0.0045 * H), gx: ROT ? 0.03 * W : 0.012 * H };
    L2.genes = [[-0.44, 0.07, 1], [-0.4, 0.04, -1], [-0.3, 0.025, 1], [-0.27, 0.09, -1], [-0.17, 0.05, 1], [-0.1, 0.11, -1], [-0.02, 0.03, 1],
      [0.04, 0.11, 1, true], [0.06, 0.045, -1], [0.17, 0.02, -1], [0.2, 0.06, 1], [0.27, 0.085, -1], [0.33, 0.04, 1], [0.42, 0.075, 1], [0.44, 0.03, -1]]
      .map(function (g) { return { x: g[2] * L2.gx, y: g[0] * OH, l: g[1] * OH, s: g[2], t: !!g[3] }; });
    var tg = L2.genes.filter(function (g) { return g.t; })[0];
    L2.P = [tg.x, tg.y];
    L2.Z = OH / tg.l;

    var L3 = { ew: ROT ? 0.16 * W : L2.gw * L2.Z };
    L3.exons = [[-0.44, 0.06, 'utr5'], [-0.32, 0.038], [-0.195, 0.07], [-0.04, 0.088, 'target'], [0.125, 0.048], [0.255, 0.038], [0.41, 0.075, 'utr3']]
      .map(function (e) { return { y: e[0] * OH, h: e[1] * OH, k: e[2] || '' }; });
    var te = L3.exons[3];
    L3.P = [0, te.y];
    L3.Z = OH / te.h;

    var L4 = { A: ROT ? 0.2 * W : Math.min(0.1 * OH, 0.1 * W), rs: 0.035 * OH, pitch: 0.375 * OH };
    L4.P = [0, 0];
    L4.Z = OH / (12 * L4.rs);

    var L5 = { X: ROT ? 0.26 * W : L4.A * L4.Z, pitch: L4.rs * L4.Z };
    L5.P = [0, (VAR_I - 8) * L5.pitch];
    L5.Z = 1;

    return [L0, L1, L2, L3, L4, L5];
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
  var STAIN = { gpos25: .16, gpos50: .28, gpos75: .42, gpos100: .58, gvar: .2, stalk: .2 };
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
      if (st === 'acen') { ctx.fillStyle = rgba(C.teal, .5); ctx.fillRect(x - w / 2, y0, w, bh + .3); continue; }
      ctx.fillStyle = rgba(C.band, STAIN[st] || .3); ctx.fillRect(x - w / 2, y0, w, bh + .3);
      if (st === 'gvar' && bh > 6 && w > 5) {
        ctx.save(); ctx.beginPath(); ctx.rect(x - w / 2, y0, w, bh); ctx.clip();
        ctx.strokeStyle = rgba(C.band, .25); ctx.lineWidth = Math.max(.5, w * .035); ctx.beginPath();
        var step = Math.max(2.5, w * .28);
        for (var q = -w; q < bh + w; q += step) { ctx.moveTo(x - w / 2, y0 + q); ctx.lineTo(x + w / 2, y0 + q - w); }
        ctx.stroke(); ctx.restore();
      }
    }
    if (o.hoverBand) { ctx.fillStyle = rgba(C.teal, .18); ctx.fillRect(x - w / 2, o.hoverBand.y0, w, o.hoverBand.y1 - o.hoverBand.y0); }
    ctx.restore();
    ctx.lineWidth = Math.max(.5, w * .035); ctx.strokeStyle = o.hl ? rgba(C.teal, .8) : C['rule-2']; ctx.stroke(p);
  }
  // text that stays upright in a rotated (horizontal) figure; there, labels at x<0 sit below the axis
  function text(s, x, y, font, color, align, base) {
    ctx.font = font; ctx.fillStyle = color;
    if (ROT) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 2);
      ctx.textAlign = 'center'; ctx.textBaseline = base || (x < 0 ? 'top' : x > 0 ? 'bottom' : 'middle');
      ctx.fillText(s, 0, 0); ctx.restore(); return;
    }
    ctx.textAlign = align || 'center'; ctx.textBaseline = base || 'middle'; ctx.fillText(s, x, y);
  }

  /* ---------- level 0: the karyotype ---------- */
  function draw0(x, a) {
    var L = LY[0], lp = ptr.on && localPtr(x), hov = null;
    if (lp) for (var i = 0; i < L.rods.length; i++) { var r = L.rods[i]; if (Math.abs(lp.x - r.x) < r.w * 1.1 && lp.y > r.y - r.w && lp.y < r.y + r.h + r.w) { hov = r.c; break; } }
    L.rods.forEach(function (r, i) {
      var f = reduce.matches ? 1 : sstep(i / L.rods.length * .7, i / L.rods.length * .7 + .3, intro);
      if (f <= 0) return;
      ctx.globalAlpha = a * f;
      if (f < 1) { ctx.save(); ctx.translate(0, (1 - f) * 0.02 * H); }
      drawChrom(r.c, r.x, r.y, r.h, r.w, { hl: r.c === hov });
      if (f < 1) ctx.restore();
      ctx.globalAlpha = a;
      if (r.c === '1' && r.first) {
        var sc = r.h / LEN('1'), b = LY[1].target;
        ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(.8, r.w * .06);
        ctx.strokeRect(r.x - r.w / 2 - r.w * .2, r.y + b.s * sc, r.w * 1.4, (b.e - b.s) * sc);
      }
    });
    var fs = ROW ? 9.5 : clamp(L.w * .68, 7.5, 11.5);
    ctx.globalAlpha = a * (reduce.matches ? 1 : sstep(.6, 1, intro));
    L.labels.forEach(function (l) {
      text(l.c, l.x, l.y, '400 ' + fs + 'px ' + MONO, l.c === hov ? C.teal : l.c === '1' ? C.ink : C.muted);
    });
    ctx.globalAlpha = a;
  }

  /* ---------- level 1: chromosome 1 ---------- */
  function draw1(x, a) {
    var L = LY[1], lp = ptr.on && localPtr(x), hb = null;
    if (lp && Math.abs(lp.x) < L.w * 1.4) for (var i = 0; i < L.bands.length; i++) { var b = L.bands[i]; if (lp.y >= b.y0 && lp.y < b.y1) { hb = b; break; } }
    drawChrom('1', 0, L.top, L.h, L.w, { hoverBand: hb });
    var fs = fsz(0.014, 8, 12), tx = -L.w / 2 - (ROT ? 0.012 : 0.026) * H, font = '400 ' + fs + 'px ' + MONO;
    ctx.lineWidth = Math.max(.5, 0.001 * H); ctx.font = font;
    var prevEnd = -1e9;
    L.bands.forEach(function (b) {
      var bh = b.y1 - b.y0, tgt = b === L.target, on = tgt || b === hb, ym = (b.y0 + b.y1) / 2;
      if (!on) {
        if (!ROT && bh < fs * 1.05) return;
        if (ROT) { var tw = ctx.measureText(b.n).width; if (ym - tw / 2 < prevEnd + 4 || bh < tw * .6) return; }
      }
      if (ROT) prevEnd = ym + ctx.measureText(b.n).width / 2;
      ctx.strokeStyle = tgt ? C.orange : on ? C.teal : C['rule-2']; ctx.beginPath(); ctx.moveTo(tx + 0.005 * H, ym); ctx.lineTo(-L.w / 2 - 0.005 * H, ym); ctx.stroke();
      text(b.n, tx, ym, (on ? '500 ' : '400 ') + fs + 'px ' + MONO, tgt ? C.orange : on ? C.teal : C.muted, 'right');
    });
    var tb = L.target;
    ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(.8, 0.0016 * H);
    ctx.strokeRect(-L.w / 2 - L.w * .2, tb.y0, L.w * 1.4, tb.y1 - tb.y0);
  }

  /* ---------- level 2: inside the band, genes along the axis ---------- */
  function draw2(x, a) {
    var L = LY[2], t = x.t;
    var ra = (1 - sstep(-0.35, 0.2, t)) * .7;
    if (ra > 0) { ctx.fillStyle = C.rod; ctx.globalAlpha = a * ra; ctx.fillRect(-L.bw / 2, -HH, L.bw, OH); ctx.globalAlpha = a; }
    // the band's edges, with its real neighbours
    var fs = fsz(0.014, 8, 12), nb = LY[1], lx = ROT ? 0.3 * W : Math.min(0.3 * H, 0.42 * W);
    ctx.strokeStyle = rgba(C.ink, .22); ctx.lineWidth = Math.max(.6, 0.001 * H);
    [[-HH, nb.above.n, -1], [HH, nb.below.n, 1]].forEach(function (e) {
      ctx.beginPath(); ctx.moveTo(-lx, e[0]); ctx.lineTo(lx, e[0]); ctx.stroke();
      text('1' + e[1], lx, e[0] + e[2] * fs * 1.1, '400 ' + fs + 'px ' + MONO, C.muted, 'right');
    });
    if (!ROT) text('1q32', lx, -HH + fs * 1.1, '500 ' + fs + 'px ' + MONO, C.orange, 'right');
    // the axis
    ctx.strokeStyle = rgba(C.ink, .3); ctx.lineWidth = Math.max(.8, 0.0018 * H);
    ctx.beginPath(); ctx.moveTo(0, -1.55 * HH); ctx.lineTo(0, 1.55 * HH); ctx.stroke();
    L.genes.forEach(function (g) {
      var gw = L.gw;
      ctx.fillStyle = g.t ? C.teal : rgba(C.ink, .38);
      ctx.beginPath(); ctx.roundRect(g.x - gw / 2, g.y - g.l / 2, gw, g.l, gw / 2); ctx.fill();
      // the strand, as a chevron at the gene's 3' end
      var ch = Math.max(2, 0.004 * H), ex = g.x + g.s * (gw / 2 + ch * 1.4), ey = g.s > 0 ? g.y + g.l / 2 - ch : g.y - g.l / 2 + ch;
      ctx.strokeStyle = g.t ? C.orange : rgba(C.ink, .35); ctx.lineWidth = Math.max(.7, 0.0014 * H); ctx.lineCap = 'round'; ctx.beginPath();
      ctx.moveTo(ex - ch, ey - g.s * ch); ctx.lineTo(ex, ey); ctx.lineTo(ex + ch, ey - g.s * ch);
      ctx.stroke(); ctx.lineCap = 'butt';
    });
  }

  /* ---------- level 3: the gene, exons and introns, splice arcs ---------- */
  function draw3(x, a) {
    var L = LY[3], ew = L.ew, ex = L.exons;
    var first = ex[0], last = ex[ex.length - 1];
    ctx.strokeStyle = rgba(C.ink, .4); ctx.lineWidth = Math.max(.8, 0.0022 * H);
    ctx.beginPath(); ctx.moveTo(0, first.y - 0.05 * H); ctx.lineTo(0, last.y + 0.05 * H); ctx.stroke();
    // splice arcs join each exon to the next
    var n = ex.length - 1;
    ctx.lineCap = 'round';
    for (var j = 0; j < n; j++) {
      var e0 = ex[j], e1 = ex[j + 1], y0 = e0.y + e0.h / 2, y1 = e1.y - e1.h / 2, gap = y1 - y0;
      var bulge = clamp(gap * 1.1, 0.05 * H, ROT ? 0.3 * W : 0.15 * H), ax = ew / 2, qx = ax + bulge, qy = (y0 + y1) / 2;
      ctx.beginPath(); ctx.moveTo(ax, y0); ctx.quadraticCurveTo(qx, qy, ax, y1);
      ctx.strokeStyle = rgba(C.orange, .6); ctx.lineWidth = Math.max(.8, .002 * H); ctx.stroke();
      ctx.fillStyle = rgba(C.orange, .8); ctx.beginPath(); ctx.arc(ax, y1, Math.max(1.2, .0035 * H), 0, TAU); ctx.fill();
    }
    ctx.lineCap = 'butt';
    ex.forEach(function (e) {
      var utr = e.k === 'utr5' || e.k === 'utr3';
      ctx.fillStyle = rgba(C.teal, .8); ctx.beginPath();
      if (utr) {
        var cut = e.h * .5, yA = e.y - e.h / 2, w2 = ew * .6;
        ctx.fillStyle = rgba(C.teal, .4);
        if (e.k === 'utr5') { ctx.roundRect(-w2 / 2, yA, w2, cut, [w2 / 3, w2 / 3, 0, 0]); ctx.fill(); ctx.fillStyle = rgba(C.teal, .8); ctx.beginPath(); ctx.rect(-ew / 2, yA + cut, ew, e.h - cut); ctx.fill(); }
        else { ctx.roundRect(-w2 / 2, yA + e.h - cut, w2, cut, [0, 0, w2 / 3, w2 / 3]); ctx.fill(); ctx.fillStyle = rgba(C.teal, .8); ctx.beginPath(); ctx.rect(-ew / 2, yA, ew, e.h - cut); ctx.fill(); }
      } else { ctx.rect(-ew / 2, e.y - e.h / 2, ew, e.h); ctx.fill(); }
      if (e.k === 'target' && !ROT) { ctx.strokeStyle = C.orange; ctx.lineWidth = Math.max(.8, .0014 * H); ctx.strokeRect(-ew / 2 - .004 * H, e.y - e.h / 2 - .004 * H, ew + .008 * H, e.h + .008 * H); }
    });
  }

  /* ---------- level 4: the double helix ---------- */
  function draw4(x, a, now) {
    var L = LY[4], t = x.t, lp = ptr.on && localPtr(x);
    // arriving from the exon, the helix is as wide and as tall as the exon it comes from
    var tw = 1 - sstep(0, 0.6, t), A = ROT ? L.A : lerp(0.2 * OH, L.A, sstep(-0.7, 0, t)), ext = ROT ? 1.55 : lerp(1, 1.55, sstep(-0.5, 0, t));
    var rot = (reduce.matches || ROT) ? 0.9 : now * 0.0001;   // one turn a minute
    var by = lp ? lp.y : 0, bx = lp ? clamp(lp.x, -0.3 * H, 0.3 * H) * 0.12 : 0, bw = 0.25 * H;
    function bendAt(y) { return bend * bx * Math.exp(-((y - by) / bw) * ((y - by) / bw)); }
    function th(y) { return (y / L.pitch * TAU + rot) * tw; }
    var y0 = -ext * HH, y1 = ext * HH, N = 110;
    var k0 = Math.ceil(y0 / L.rs), k1 = Math.floor(y1 / L.rs);
    var rungW = Math.max(1, 0.0032 * H), strandW = Math.max(1.2, 0.0045 * H);
    ctx.lineCap = 'round';
    for (var k = k0; k <= k1; k++) {
      var y = k * L.rs, c = Math.cos(th(y)), b = bendAt(y);
      var xa = A * c + b, xb = -A * c + b, vis = Math.abs(c), isVar = k === VAR_I - 8;
      ctx.strokeStyle = isVar ? C.orange : rgba(C.ink, .18 + .32 * vis);
      ctx.lineWidth = rungW;
      ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
    }
    [0, 1].forEach(function (pass) {
      [[1, C.orange], [-1, C.teal]].forEach(function (sd) {
        ctx.strokeStyle = sd[1]; ctx.lineWidth = strandW * (pass ? 1 : .85);
        ctx.globalAlpha = a * (pass ? .85 : .35);
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
  }

  /* ---------- level 5: the ladder, read as codons ---------- */
  function draw5(x, a) {
    var L = LY[5], X = L.X, p = L.pitch, n = SEQ.length;
    ctx.lineCap = 'round';
    var fadeY = function (y) { return 1 - sstep(0.75 * HH, 1.15 * HH, Math.abs(y)); };
    [[-X, C.teal], [X, C.orange]].forEach(function (s) {
      var g = ctx.createLinearGradient(0, -1.3 * HH, 0, 1.3 * HH);
      g.addColorStop(0, rgba(s[1], 0)); g.addColorStop(.25, rgba(s[1], .85)); g.addColorStop(.75, rgba(s[1], .85)); g.addColorStop(1, rgba(s[1], 0));
      ctx.strokeStyle = g; ctx.lineWidth = Math.max(1.2, 0.0045 * H);
      ctx.beginPath(); ctx.moveTo(s[0], -1.3 * HH); ctx.lineTo(s[0], 1.3 * HH); ctx.stroke();
    });
    var R = p * 0.3, fs = p * 0.42, lab = ROT ? 11.5 : clamp(0.026 * H, 11, 21);
    for (var i = 0; i < n; i++) {
      var y = (i - 8) * p, f = fadeY(y); if (f <= 0) continue;
      var isV = i === VAR_I, base = SEQ[i], comp = COMP[base];
      ctx.globalAlpha = a * f;
      ctx.strokeStyle = isV ? C.orange : rgba(C.ink, .3); ctx.lineWidth = Math.max(1, 0.0025 * H);
      ctx.beginPath(); ctx.moveTo(-X, y); ctx.lineTo(X, y); ctx.stroke();
      [[-X, isV ? VAR_ALT : base, C.teal], [X, isV ? COMP[VAR_ALT] : comp, C.orange]].forEach(function (s) {
        ctx.fillStyle = C.bg; ctx.beginPath(); ctx.arc(s[0], y, R, 0, TAU); ctx.fill();
        ctx.strokeStyle = isV ? C.orange : rgba(s[2], .7); ctx.lineWidth = Math.max(.8, (isV ? .002 : .0012) * H);
        ctx.stroke();
        text(s[1], s[0], y + fs * .04, '500 ' + fs + 'px ' + MONO, isV ? C.orange : C.ink, 'center', 'middle');
      });
    }
    // codon brackets and amino acids, beyond the orange strand
    var bx = X + R + 0.025 * H;
    for (var c = 0; (FRAME + c * 3 + 2) < n; c++) {
      var ci = FRAME + c * 3, ya = (ci - 8) * p, yb = (ci + 2 - 8) * p, ym = (ya + yb) / 2, f2 = fadeY(ym);
      if (f2 <= 0) continue;
      var cod = SEQ.substr(ci, 3), isV2 = ci <= VAR_I && VAR_I < ci + 3;
      if (isV2) cod = cod.substr(0, VAR_I - ci) + VAR_ALT + cod.substr(VAR_I - ci + 1);
      ctx.globalAlpha = a * f2;
      ctx.strokeStyle = isV2 ? rgba(C.orange, .8) : rgba(C.ink, .3); ctx.lineWidth = Math.max(.8, 0.0012 * H);
      ctx.beginPath(); ctx.moveTo(bx - 0.007 * H, ya - p * .3); ctx.lineTo(bx, ya - p * .3); ctx.lineTo(bx, yb + p * .3); ctx.lineTo(bx - 0.007 * H, yb + p * .3); ctx.stroke();
      text(CODE[cod], ROT ? bx + 0.004 * H : bx + 0.012 * H, ym, (isV2 ? '600 ' : '500 ') + lab + 'px ' + SERIF, isV2 ? C.orange : C.ink, 'left');
    }
    ctx.globalAlpha = a; ctx.lineCap = 'butt';
  }

  var DRAW = [draw0, draw1, draw2, draw3, draw4, draw5];

  /* ================= the stage (wide screens) ================= */
  var stageView = null, lastT = 0, dirty = true, t0 = 0, animated = false;
  var rail = document.getElementById('rail'), railItems = rail ? rail.querySelectorAll('li') : [], railMark = rail && rail.querySelector('.mark');
  var shownLevel = -1;
  function updateRail() {
    var lv = Math.round(depth);
    if (lv !== shownLevel) { shownLevel = lv; railItems.forEach(function (li, i) { li.classList.toggle('on', i === lv); }); }
    if (railMark && railItems.length) {
      var i = Math.min(railItems.length - 2, Math.floor(depth)), f = depth - i;
      var a = railItems[i].offsetTop + railItems[i].offsetHeight / 2, b = railItems[i + 1].offsetTop + railItems[i + 1].offsetHeight / 2;
      railMark.style.top = (lerp(a, b, f) - 2.5) + 'px';
    }
  }
  railItems.forEach(function (li) {
    li.addEventListener('click', function () { var el = document.querySelector(li.dataset.go); if (el) el.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth' }); });
  });

  function drawStage(now) {
    bind(stageView);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // the karyotype sits a little right of centre to clear the rail; deeper levels are centred
    cx = fx + Math.min(70, W * .09) * (1 - sstep(0.5, 1.3, depth));
    var lo = Math.max(0, Math.floor(depth) - 1), hi = Math.min(5, Math.floor(depth) + 1), list = [];
    for (var L = lo; L <= hi; L++) { var x = xform(L, depth), a = alphaOf(L, x.t); if (a > 0.003) list.push({ L: L, x: x, a: a }); }
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
    updateRail();
    return list.some(function (it) { return it.L === 4; });
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (mobileMQ.matches || !stageView) return;
    var dt = Math.min(.05, (now - lastT) / 1000) || .016; lastT = now;
    if (!t0) t0 = now;
    if (intro < 1) { intro = Math.min(1, (now - t0) / 1600); dirty = true; }
    if (reduce.matches) { var rw = Math.round(want); if (depth !== rw) { depth = rw; dirty = true; } }
    else if (depth !== want) { var nd = depth + (want - depth) * (1 - Math.exp(-dt * 6)); if (Math.abs(nd - want) < 2e-4) nd = want; depth = nd; dirty = true; }
    var tb = ptr.on ? 1 : 0; if (!reduce.matches && Math.abs(bend - tb) > .002) { bend += (tb - bend) * (1 - Math.exp(-dt * 5)); dirty = true; } else bend = reduce.matches ? 0 : tb;
    if (document.hidden) return;
    if (!dirty && !(animated && !reduce.matches)) return;
    animated = drawStage(now);
    dirty = false;
  }

  var anchors = [0, 0, 0, 0, 0, 0];
  var secs = ['research', 'publications', 'tools', 'people'].map(function (id) { return document.getElementById(id); });
  function measure() {
    if (!stageView) return;
    var vh = innerHeight, line = vh * .4;
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
  function sizeStage() {
    if (!stage || mobileMQ.matches) { stageView = null; return; }
    var r = stage.getBoundingClientRect(), sw = Math.round(r.width), sh = Math.round(r.height);
    var d = Math.min(devicePixelRatio || 1, 2);
    cv.width = Math.round(sw * d); cv.height = Math.round(sh * d);
    stageView = { ctx: cv.getContext('2d'), W: sw, H: sh, OH: 0.72 * sh, dpr: d, fx: sw / 2, fy: sh / 2, cx: sw / 2, ROT: false, ROW: false, LY: null };
    bind(stageView); stageView.LY = layout(); LY = stageView.LY;
    measure(); dirty = true;
  }
  if (stage) {
    stage.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var r = stage.getBoundingClientRect(); ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top; ptr.on = true; dirty = true;
    });
    stage.addEventListener('pointerleave', function () { ptr.on = false; dirty = true; });
  }

  /* ================= the figures (narrow screens) ================= */
  var figs = [];
  document.querySelectorAll('.fig').forEach(function (f) {
    var c = f.querySelector('canvas'); if (!c) return;
    figs.push({ el: f, cv: c, level: +f.dataset.level, view: null, intro: reduce.matches ? 1 : 0, seen: false, raf: 0 });
  });
  function sizeFig(fg) {
    var r = fg.cv.getBoundingClientRect(), cw = Math.round(r.width), ch = Math.round(r.height);
    if (!cw || !ch) { fg.view = null; return; }
    var d = Math.min(devicePixelRatio || 1, 2), pad = 18;
    fg.cv.width = Math.round(cw * d); fg.cv.height = Math.round(ch * d);
    var row = fg.level === 0;
    // a rotated figure's axis runs along the canvas width: H is that length, W the canvas height
    fg.view = row
      ? { ctx: fg.cv.getContext('2d'), W: cw - 2 * pad, H: ch, OH: 0.9 * ch, dpr: d, fx: cw / 2, fy: ch / 2, cx: cw / 2, ROT: false, ROW: true, LY: null }
      : { ctx: fg.cv.getContext('2d'), W: ch, H: cw - 2 * pad, OH: 0.86 * (cw - 2 * pad), dpr: d, fx: cw / 2, fy: ch / 2, cx: cw / 2, ROT: true, ROW: false, LY: null };
    bind(fg.view); fg.view.LY = layout(); LY = fg.view.LY;
  }
  function drawFig(fg) {
    if (!fg.view) return;
    bind(fg.view);
    var cw = fg.cv.width / dpr, ch = fg.cv.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    ctx.save();
    ctx.translate(fx, fy);
    if (ROT) ctx.rotate(-Math.PI / 2);
    intro = fg.intro;
    var e = smooth(fg.intro);
    ctx.globalAlpha = fg.level === 0 ? 1 : e;
    if (fg.level !== 0 && e < 1) ctx.translate(ROT ? (1 - e) * 10 : 0, ROT ? 0 : (1 - e) * 10);
    ptr.on = false;
    DRAW[fg.level]({ s: 1, ox: 0, oy: 0, t: 0 }, ctx.globalAlpha, 0);
    ctx.restore();
  }
  function playFig(fg) {
    if (fg.raf) return;
    var start = 0;
    function step(now) {
      if (!start) start = now;
      fg.intro = reduce.matches ? 1 : Math.min(1, (now - start) / 1100);
      drawFig(fg);
      if (fg.intro < 1) fg.raf = requestAnimationFrame(step); else fg.raf = 0;
    }
    fg.raf = requestAnimationFrame(step);
  }
  var figIO = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (!e.isIntersecting) return; var fg = figs.filter(function (f) { return f.el === e.target; })[0]; if (fg && !fg.seen) { fg.seen = true; playFig(fg); } figIO.unobserve(e.target); });
  }, { threshold: .25 });
  function sizeFigs() {
    if (!mobileMQ.matches) return;
    figs.forEach(function (fg) { sizeFig(fg); if (fg.seen) drawFig(fg); else figIO.observe(fg.el); });
  }

  /* ---------- wiring ---------- */
  function resize() { sizeStage(); sizeFigs(); }
  addEventListener('scroll', updateWant, { passive: true });
  addEventListener('resize', resize);
  mobileMQ.addEventListener('change', resize);
  if (window.ResizeObserver) new ResizeObserver(function () { measure(); }).observe(document.querySelector('.content'));
  function recolor() { readColors(); dirty = true; figs.forEach(function (fg) { if (fg.seen) drawFig(fg); }); }
  new MutationObserver(recolor).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  sysDark.addEventListener('change', recolor);
  reduce.addEventListener('change', function () { dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { dirty = true; figs.forEach(function (fg) { if (fg.seen) drawFig(fg); }); });
  addEventListener('load', measure);

  readColors(); resize();
  depth = want;
  requestAnimationFrame(frame);
})();
