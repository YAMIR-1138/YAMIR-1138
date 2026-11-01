/* TGGR Lab site: theme, top bar, menu, card light, the helix, publication filters, people panels. */
(function () {
  'use strict';
  var root = document.documentElement, body = document.body;
  var reduce = matchMedia('(prefers-reduced-motion: reduce)');
  var sysDark = matchMedia('(prefers-color-scheme: dark)');
  function isDark() { return root.dataset.theme ? root.dataset.theme === 'dark' : sysDark.matches; }
  var redraws = [];
  function redrawAll() { redraws.forEach(function (f) { f(); }); }

  // ---- theme: one button flips light and dark, remembered in this browser ----
  var btn = document.getElementById('theme');
  function label() { if (btn) btn.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme'); }
  function flip() {
    var next = isDark() ? 'light' : 'dark';
    root.dataset.theme = next;
    try { localStorage.setItem('tggr-theme', next); } catch (e) {}
    label(); redrawAll();
  }
  if (btn) btn.addEventListener('click', function () {
    if (!document.startViewTransition || reduce.matches) { flip(); return; }
    var r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    var R = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    document.startViewTransition(flip).ready.then(function () {
      root.animate({ clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + R + 'px at ' + x + 'px ' + y + 'px)'] },
        { duration: 700, easing: 'cubic-bezier(.2, .8, .2, 1)', pseudoElement: '::view-transition-new(root)' });
    });
  });
  label();
  new MutationObserver(function () { label(); redrawAll(); }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  sysDark.addEventListener('change', function () { label(); redrawAll(); });

  // ---- top bar: on the home page it turns solid once the hero has gone; elsewhere once you scroll ----
  var bar = document.getElementById('bar'), hero = document.getElementById('top');
  if (bar && !hero) {
    var onScroll = function () { bar.classList.toggle('solid', scrollY > 8); };
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }

  // ---- menu on narrow screens ----
  var menuBtn = document.getElementById('menu-btn'), menu = document.getElementById('menu');
  if (menuBtn && menu) {
    var setMenu = function (open) {
      menu.hidden = !open; menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      body.style.overflow = open ? 'hidden' : '';
      if (open) { bar.classList.add('solid'); var a = menu.querySelector('a'); if (a) a.focus(); }
    };
    menuBtn.addEventListener('click', function () { setMenu(menu.hidden); });
    menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) { setMenu(false); menuBtn.focus(); } });
  }

  // ---- cards: spotlight and edge glow follow the pointer, and the card leans ----
  document.querySelectorAll('.card').forEach(function (c) {
    c.addEventListener('pointermove', function (e) {
      var r = c.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      c.style.setProperty('--x', x + 'px'); c.style.setProperty('--y', y + 'px');
      if (reduce.matches || e.pointerType !== 'mouse') return;
      c.style.setProperty('--ry', ((x / r.width - .5) * 6) + 'deg'); c.style.setProperty('--rx', ((.5 - y / r.height) * 6) + 'deg');
    });
    c.addEventListener('pointerleave', function () { c.style.removeProperty('--rx'); c.style.removeProperty('--ry'); });
  });

  // ---- the helix: two strands of teal and orange beads. In the hero it parts around the logo;
  //      on inner pages it is a thin band behind the title. ----
  document.querySelectorAll('canvas.helix').forEach(function (cv) {
    var ctx = cv.getContext('2d'), host = cv.parentElement, mode = cv.dataset.mode || 'band';
    var hole = document.getElementById('tilt'), logo = hole && hole.firstElementChild;
    var W = 0, H = 0, cx = 0, cy = 0, r = 0, narrow = false, colors = {}, t = Math.random() * 6, last = 0, raf = 0, running = false, visible = true;
    var target = { x: 0, y: 0 }, p = { x: 0, y: 0 };
    function readColors() { var cs = getComputedStyle(root); colors.a = cs.getPropertyValue('--teal').trim(); colors.b = cs.getPropertyValue('--orange').trim(); }
    function size() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      narrow = W < 700; cy = H * .58; cx = W / 2; r = 0;
      if (mode === 'hero' && hole) {
        var hr = host.getBoundingClientRect(), lr = hole.getBoundingClientRect();
        cx = lr.left - hr.left + lr.width / 2; cy = lr.top - hr.top + lr.height / 2; r = lr.width * .5;
        if (narrow) { cy = Math.min(H - 70, lr.bottom - hr.top + 130); r = 0; }
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      var band = mode !== 'hero' || narrow;
      var A = (band ? (mode === 'hero' ? 34 : Math.min(46, H * .2)) : Math.min(H * .2, 120)) * (1 + p.y * .35);
      var k = 2 * Math.PI / Math.max(360, W * .45), step = W < 600 ? 12 : 15, dark = isDark();
      var fade = mode === 'hero' ? 1 : .7;
      for (var x = -step, i = 0; x < W + step; x += step, i++) {
        var th = x * k + t + p.x * 1.6, s = Math.sin(th), c = Math.cos(th);
        var d = r ? Math.abs(x - cx) / r : 9, f = Math.min(1, Math.max(0, (d - 1.05) / .7));
        f *= Math.max(0, Math.min(1, Math.min(x, W - x) / (narrow ? 40 : 120))) * fade;
        if (mode === 'band' && !narrow) f *= Math.max(.12, Math.min(1, (x / W - .32) / .3)); // keep clear of the title
        if (f <= 0) continue;
        var y1 = cy + A * s, y2 = cy - A * s, z1 = (c + 1) / 2, z2 = 1 - z1;
        if (i % 2 === 0) { ctx.globalAlpha = (dark ? .22 : .16) * f; ctx.strokeStyle = colors.a; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2); ctx.stroke(); }
        var beads = [[y2, z2, colors.b], [y1, z1, colors.a]]; if (z2 > z1) beads.reverse();
        for (var j = 0; j < 2; j++) { var b = beads[j]; ctx.globalAlpha = (.18 + .62 * b[1]) * f * (dark ? 1 : .85); ctx.fillStyle = b[2]; ctx.beginPath(); ctx.arc(x, b[0], 1.4 + 2.8 * b[1], 0, 6.2832); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
    }
    function tick(now) {
      var dt = Math.min(50, now - (last || now)); last = now;
      t += dt * .00042; p.x += (target.x - p.x) * .05; p.y += (target.y - p.y) * .05;
      draw(); raf = requestAnimationFrame(tick);
    }
    function start() { if (running || reduce.matches || document.hidden || !visible) return; running = true; last = 0; raf = requestAnimationFrame(tick); }
    function stop() { running = false; cancelAnimationFrame(raf); }
    host.addEventListener('pointermove', function (e) {
      if (reduce.matches || e.pointerType !== 'mouse') return;
      var b = host.getBoundingClientRect(), x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
      target.x = x; target.y = y;
      if (logo) { logo.style.setProperty('--ry', (x * 14) + 'deg'); logo.style.setProperty('--rx', (-y * 10) + 'deg'); }
    });
    host.addEventListener('pointerleave', function () { target.x = 0; target.y = 0; if (logo) { logo.style.removeProperty('--ry'); logo.style.removeProperty('--rx'); } });
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (mode === 'hero' && bar) {
        var past = !(es[0].isIntersecting && es[0].intersectionRatio > .25);
        bar.classList.toggle('solid', past);
        var mini = bar.querySelector('.mini'); if (mini) mini.tabIndex = past ? 0 : -1;
      }
      if (visible) start(); else stop();
    }, { threshold: [0, .25, .5] }).observe(host);
    readColors(); size(); draw(); start();
    redraws.push(function () { readColors(); if (!running) draw(); });
    addEventListener('resize', function () { size(); draw(); });
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
    reduce.addEventListener('change', function () { if (reduce.matches) { stop(); draw(); } else start(); });
    if (document.fonts) document.fonts.ready.then(function () { size(); draw(); });
  });

  // ---- publications: the search filters the list and marks what it matched ----
  var list = document.querySelector('.pubs[data-filter]');
  if (list) {
    var items = Array.prototype.slice.call(list.children);
    var q = document.getElementById('q'), clear = document.getElementById('clear'), none = document.getElementById('none');
    items.forEach(function (li) { li._t = li.querySelector('.t'); li._a = li.querySelector('.au'); li._t0 = li._t.innerHTML; li._a0 = li._a.innerHTML; });
    var esc = function (v) { return v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); };
    var mark = function (h, re) { return re ? h.replace(/(<[^>]+>)|([^<]+)/g, function (m, tag, text) { return tag || text.replace(re, '<mark>$&</mark>'); }) : h; };
    var apply = function () {
      var term = q.value.trim(), lc = term.toLowerCase(), re = term ? new RegExp(esc(term), 'gi') : null, any = false;
      items.forEach(function (li) {
        var ok = !term || li.dataset.search.indexOf(lc) !== -1;
        li.hidden = !ok; any = any || ok;
        li._t.innerHTML = mark(li._t0, re); li._a.innerHTML = mark(li._a0, re);
        if (re && ok && li._a.textContent.toLowerCase().indexOf(lc) !== -1) li.querySelector('details').open = true;
      });
      clear.hidden = !term; none.hidden = any;
    };
    q.addEventListener('input', apply);
    clear.addEventListener('click', function () { q.value = ''; apply(); q.focus(); });
  }

  // ---- nav: the dot follows the section being read ----
  var nav = document.querySelector('.nav'), dot = nav && nav.querySelector('.navdot');
  var navLinks = nav ? Array.prototype.slice.call(nav.querySelectorAll('a')) : [];
  function markNav(id) {
    navLinks.forEach(function (a) {
      var on = a.hash === '#' + id; a.setAttribute('aria-current', on ? 'true' : 'false');
      if (on && dot) { dot.style.setProperty('--dx', (a.offsetLeft + a.offsetWidth / 2 - 2.5) + 'px'); dot.classList.add('on'); }
    });
    if (!id && dot) dot.classList.remove('on');
  }
  var secs = document.querySelectorAll('main section[id]');
  if (secs.length && nav) {
    var sio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) markNav(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(function (sec) { sio.observe(sec); });
  }

  // ---- chromosome 1 as the reading bar ----
  var chromo = document.querySelector('.chromo');
  if (chromo) {
    var queued = false;
    var progress = function () {
      queued = false;
      var max = document.documentElement.scrollHeight - innerHeight;
      chromo.style.setProperty('--p', max > 0 ? Math.min(1, Math.max(0, scrollY / max)).toFixed(4) : 0);
      if (scrollY < innerHeight * .5) markNav('');
    };
    addEventListener('scroll', function () { if (!queued) { queued = true; requestAnimationFrame(progress); } }, { passive: true });
    addEventListener('resize', progress); progress();
  }

  // ---- section titles decode from A, C, G and T as they arrive ----
  var BASES = 'ACGT';
  function decode(el) {
    var text = el.dataset.text || (el.dataset.text = el.textContent), n = text.length, start = 0;
    if (reduce.matches) { el.textContent = text; return; }
    function frame(now) {
      if (!start) start = now;
      var done = Math.floor((now - start) / 900 * (n + 3)) - 3, out = '';
      for (var i = 0; i < n; i++) {
        var ch = text[i];
        if (i < done || ch === ' ') out += ch.replace(/[&<>]/g, '');
        else { var b = BASES[(Math.random() * 4) | 0]; out += '<span class="x' + (b === 'G' || b === 'A' ? ' o' : '') + '">' + b + '</span>'; }
      }
      el.innerHTML = out;
      if (done < n) requestAnimationFrame(frame); else el.textContent = text;
    }
    requestAnimationFrame(frame);
  }
  var heads = document.querySelectorAll('[data-decode]');
  if (heads.length && 'IntersectionObserver' in window) {
    var hio = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { hio.unobserve(e.target); decode(e.target); } }); }, { threshold: .6 });
    heads.forEach(function (h) { hio.observe(h); });
  }

})();
