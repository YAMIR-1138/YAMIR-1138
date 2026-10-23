/* PazaakFX: CRT-phosphor canvas effects for the pazaak page.
   one fixed canvas, one rAF loop that sleeps when idle, no dependencies. */
(function () {
  'use strict';

  const MAX = 600;                      // hard particle cap (phones)
  const TAU = Math.PI * 2;
  const GLYPHS = '+-*/=#%01░▒▓█·';
  const RAIN = '0123456789+-*/=#%<>:;·░';
  const FONT = '"VT323", "IBM Plex Mono", monospace';

  let cv = null, ctx = null, W = 0, H = 0, dpr = 1;
  let raf = 0, last = 0, reduced = false, ready = false;
  const pal = { fg: '#ffb000', hi: '#ffe2a6', warn: '#ff6a3d', alt: '#3dff7a' };
  const parts = [];                     // particles (swap-remove, no pooling needed at this size)
  const fxs = [];                       // everything else: rings, beams, glitch, rain, stamps...
  const sched = [];                     // delayed callbacks, ticked by the loop so tab-pause freezes them
  const amb = { on: false, level: 0, motes: [] };
  let ovr = 0;                          // overwrite cursor when the particle cap is hit

  // ---------- helpers ----------
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const pick = s => s.charAt((Math.random() * s.length) | 0);
  const ease3 = t => 1 - Math.pow(1 - t, 3);
  const eio = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  const sstep = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const col = (c, d) => { c = c || d; return pal[c] || c; };

  // resolve any css colour to [r,g,b] once (gradients need rgba strings)
  const rgbCache = {};
  let scratch = null;
  function rgb(css) {
    let v = rgbCache[css];
    if (v) return v;
    if (!scratch) scratch = document.createElement('canvas').getContext('2d');
    scratch.fillStyle = '#000';
    scratch.fillStyle = css;
    const s = scratch.fillStyle;       // browser normalises to #rrggbb or rgba(...)
    if (s.charAt(0) === '#') v = [parseInt(s.substr(1, 2), 16), parseInt(s.substr(3, 2), 16), parseInt(s.substr(5, 2), 16)];
    else { const m = s.match(/[\d.]+/g) || [255, 176, 0]; v = [+m[0], +m[1], +m[2]]; }
    return (rgbCache[css] = v);
  }
  const rgba = (css, a) => { const c = rgb(css); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  // pull a colour toward white for hot cores
  const hot = (css, k) => { const c = rgb(css); return 'rgb(' + c.map(v => Math.round(v + (255 - v) * k)).join(',') + ')'; };

  function addP(p) {
    if (parts.length < MAX) parts.push(p);
    else parts[(ovr++) % MAX] = p;
  }

  // ---------- loop ----------
  function wake() {
    if (!ready || raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function alive() { return parts.length || fxs.length || sched.length || amb.on || amb.level > 0; }

  function frame(now) {
    raf = 0;
    const dtms = clamp(now - last, 0, 50);
    last = now;
    const dt = dtms / 1000;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1;

    for (let i = sched.length - 1; i >= 0; i--) {
      const s = sched[i];
      s.t -= dtms;
      if (s.t <= 0) { sched.splice(i, 1); s.fn(); }
    }
    stepAmbient(dt);
    for (let i = fxs.length - 1; i >= 0; i--) {
      const f = fxs[i];
      f.age += dtms;
      if (f.age >= f.life) { fxs.splice(i, 1); continue; }
      if (f.update) f.update(dtms, dt);
    }
    drawAmbient();
    for (let i = 0; i < fxs.length; i++) { ctx.save(); fxs[i].draw(); ctx.restore(); }
    stepDrawParts(dtms, dt);

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    if (alive()) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);   // leave nothing painted while asleep
  }

  function stepDrawParts(dtms, dt) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glow = parts.length < 300;
    let fill = null;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.age += dtms;
      if (p.age >= p.life) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k; p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const t = p.age / p.life;
      const a = Math.pow(1 - t, 1.3) * (0.72 + Math.random() * 0.28);   // flicker like phosphor
      if (p.col !== fill) { ctx.fillStyle = p.col; fill = p.col; }
      if (p.kind === 0) {
        const s = p.size * (1 - t * 0.5);
        ctx.globalAlpha = a * 0.24;                                      // fake glow: big dim square under the core
        ctx.fillRect(Math.round(p.x - s * 1.7), Math.round(p.y - s * 1.7), s * 3.4, s * 3.4);
        ctx.globalAlpha = a;
        ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
      } else if (p.kind === 1) {
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.col;
        ctx.lineWidth = Math.max(1, p.size * 0.9);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.045, p.y - p.vy * 0.045);
        ctx.stroke();
      } else if (p.kind === 2) {
        ctx.font = Math.round(p.size) + 'px ' + FONT;
        if (glow) { ctx.globalAlpha = a * 0.3; ctx.fillText(p.ch, p.x + 1, p.y); }
        ctx.globalAlpha = a;
        ctx.fillText(p.ch, p.x, p.y);
      } else {
        // crosshair flare at burst centres, very cheap
        const L = p.size * (1 - t);
        ctx.globalAlpha = a * 0.8;
        ctx.fillRect(Math.round(p.x - L), Math.round(p.y) - 1, L * 2, 2);
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y - L), 2, L * 2);
        ctx.globalAlpha = a * 0.15;
        ctx.fillRect(p.x - L * 0.5, p.y - L * 0.5, L, L);
      }
    }
  }

  // ---------- ambient dust ----------
  function stepAmbient(dt) {
    const want = amb.on && !reduced;
    amb.level = clamp(amb.level + (want ? 1 : -1) * dt * 1.5, 0, 1);
    if (!want && amb.level === 0) { amb.motes.length = 0; return; }
    if (!amb.motes.length) {
      for (let i = 0; i < 22; i++) {
        amb.motes.push({ x: Math.random() * W, y: Math.random() * H, vy: -rnd(2, 9), ph: Math.random() * TAU,
          sw: rnd(4, 12), a: rnd(0.18, 0.5), dot: Math.random() < 0.4, tw: rnd(0.4, 1.4) });
      }
    }
    for (const m of amb.motes) {
      m.y += m.vy * dt; m.ph += m.tw * dt;
      m.x += Math.sin(m.ph) * m.sw * dt;
      if (m.y < -10) { m.y = H + 10; m.x = Math.random() * W; }
      if (m.x < -10) m.x = W + 10; else if (m.x > W + 10) m.x = -10;
    }
  }
  function drawAmbient() {
    if (!amb.motes.length) return;
    ctx.fillStyle = pal.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '16px ' + FONT;
    for (const m of amb.motes) {
      const a = m.a * amb.level * (0.6 + 0.4 * Math.sin(m.ph * 2.3));
      ctx.globalAlpha = a;
      if (m.dot) ctx.fillText('·', m.x, m.y);
      else { ctx.fillRect(Math.round(m.x), Math.round(m.y), 2, 2); ctx.globalAlpha = a * 0.3; ctx.fillRect(Math.round(m.x) - 1, Math.round(m.y) - 1, 4, 4); }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- sizing ----------
  function resize() {
    if (!cv) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    if (alive()) wake();
  }
  let listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = 0; } }   // dt clamp + this = effects freeze, not skip
      else if (alive()) wake();
    });
  }

  // ---------- effects ----------
  function burst(x, y, o) {
    o = o || {};
    let n = o.count == null ? 28 : o.count;
    let speed = o.speed == null ? 1 : o.speed;
    let life = o.life || 900;
    const key = o.color || 'fg';
    const g = (o.gravity == null ? 0.4 : o.gravity) * 600;
    const size = o.size || 1;
    if (reduced) { n = Math.min(n, 6); speed *= 0.5; life *= 0.6; }
    const base = col(key);
    const mix = key !== 'hi' && pal[key] !== undefined;   // sprinkle hot sparks into named colours
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = (50 + Math.pow(Math.random(), 0.6) * 260) * speed;
      const c = mix && Math.random() < 0.22 ? pal.hi : base;
      const r = Math.random();
      const glyph = o.glyphs && !reduced;
      addP({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: life * rnd(0.55, 1),
        size: glyph ? (13 + Math.random() * 9) * size : (2.2 + Math.random() * 2.6) * size,
        col: c, g, drag: 1.45, ch: glyph ? pick(GLYPHS) : '',
        kind: glyph ? 2 : (r < 0.3 && !reduced ? 1 : 0)
      });
    }
    if (n >= 10 && !reduced) addP({ x, y, vx: 0, vy: 0, age: 0, life: 260, size: 26 * size, col: pal.hi, g: 0, drag: 0, kind: 3, ch: '' });
    wake();
  }

  function shockwave(x, y, o) {
    if (reduced) return;
    o = o || {};
    const c = col(o.color, 'hi'), R = o.radius || 180, w = o.width || 3, life = o.life || 650, rings = o.rings || 1;
    for (let i = 0; i < rings; i++) {
      const delay = i * life * 0.18;
      fxs.push({
        age: -delay, life, motion: true,
        draw() {
          if (this.age < 0) return;
          const t = clamp(this.age / life, 0, 1);
          const r = R * ease3(t) * (1 - i * 0.12), a = Math.pow(1 - t, 1.5), lw = Math.max(1, w * (1 - t * 0.6));
          ctx.strokeStyle = c;
          ctx.globalAlpha = a * 0.14; ctx.lineWidth = lw * 4;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = a * 0.9; ctx.lineWidth = lw;
          ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
          ctx.globalAlpha = a * 0.35; ctx.lineWidth = 1;     // thin trailing echo, reads like a scope ping
          ctx.beginPath(); ctx.arc(x, y, r * 0.78, 0, TAU); ctx.stroke();
        }
      });
    }
    wake();
  }

  function trail(x1, y1, x2, y2, o) {
    if (reduced) return;
    o = o || {};
    const c = col(o.color, 'fg'), life = o.life || 400;
    let emit = 0, landed = false;
    const at = e => ({ x: x1 + (x2 - x1) * e, y: y1 + (y2 - y1) * e });
    fxs.push({
      age: 0, life, motion: true,
      update(dtms, dt) {
        const hT = eio(clamp(this.age / (life * 0.65), 0, 1)), tT = eio(clamp((this.age - life * 0.2) / (life * 0.65), 0, 1));
        emit += dt * 110;
        while (emit >= 1) {
          emit--;
          const e = tT + (hT - tT) * Math.random();
          if (hT - tT < 0.001) break;
          const p = at(e);
          addP({ x: p.x, y: p.y, vx: rnd(-40, 40), vy: rnd(-40, 40), age: 0, life: rnd(220, 420), size: rnd(1, 2),
            col: Math.random() < 0.3 ? pal.hi : c, g: 60, drag: 2.5, kind: 0, ch: '' });
        }
        if (!landed && hT >= 1) {
          landed = true;
          for (let i = 0; i < 8; i++) {
            const a = Math.random() * TAU, sp = rnd(40, 160);
            addP({ x: x2, y: y2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, age: 0, life: rnd(250, 450), size: rnd(1, 2.2), col: c, g: 120, drag: 2.2, kind: 0, ch: '' });
          }
        }
      },
      draw() {
        const hT = eio(clamp(this.age / (life * 0.65), 0, 1)), tT = eio(clamp((this.age - life * 0.2) / (life * 0.65), 0, 1));
        const h = at(hT), t = at(tT);
        if (hT - tT < 0.001) return;
        ctx.lineCap = 'round';
        const g1 = ctx.createLinearGradient(t.x, t.y, h.x, h.y);
        g1.addColorStop(0, rgba(c, 0)); g1.addColorStop(1, rgba(c, 1));
        ctx.strokeStyle = g1;
        ctx.globalAlpha = 0.2; ctx.lineWidth = 7; ctx.beginPath(); ctx.moveTo(t.x, t.y); ctx.lineTo(h.x, h.y); ctx.stroke();
        ctx.globalAlpha = 0.6; ctx.lineWidth = 3; ctx.stroke();
        const g2 = ctx.createLinearGradient(t.x, t.y, h.x, h.y);
        g2.addColorStop(0, rgba(pal.hi, 0)); g2.addColorStop(1, rgba(pal.hi, 1));
        ctx.strokeStyle = g2; ctx.globalAlpha = 0.95; ctx.lineWidth = 1.5; ctx.stroke();
        if (hT < 1) {
          ctx.fillStyle = pal.hi;
          ctx.globalAlpha = 0.25; ctx.fillRect(h.x - 5, h.y - 5, 10, 10);
          ctx.globalAlpha = 1; ctx.fillRect(Math.round(h.x) - 1.5, Math.round(h.y) - 1.5, 3, 3);
        }
      }
    });
    wake();
  }

  function flash(o) {
    o = o || {};
    let a = o.alpha == null ? 0.35 : o.alpha, life = o.life || 260;
    if (reduced) { a = Math.min(a, 0.12); life = Math.max(life, 240); }   // gentle, no strobing
    const c = col(o.color, 'hi');
    fxs.push({
      age: 0, life,
      draw() {
        const t = this.age / life, env = t < 0.1 ? t / 0.1 : Math.pow(1 - (t - 0.1) / 0.9, 2);
        const r = Math.max(W, H) * 0.75;
        const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r);   // brighter centre, like a tube overdrive
        g.addColorStop(0, rgba(c, 1)); g.addColorStop(1, rgba(c, 0.25));
        ctx.fillStyle = g;
        ctx.globalAlpha = a * env;
        ctx.fillRect(0, 0, W, H);
      }
    });
    wake();
  }

  function glitch(o) {
    o = o || {};
    const life = o.life || 600, inten = o.intensity == null ? 1 : o.intensity;
    if (reduced) { flash({ color: o.color || 'warn', alpha: 0.12, life: 300 }); return; }
    const c = col(o.color, 'warn');
    let frm = null, hold = 0;
    const build = env => {
      const bands = [], n = Math.max(1, Math.round((2 + Math.random() * 4) * inten * (0.5 + env * 0.5)));
      for (let i = 0; i < n; i++) {
        bands.push({ y: Math.random() * H, h: 6 + Math.random() * H * 0.07 * inten, dx: (Math.random() - 0.5) * W * 0.14 * inten, x: Math.random() * W,
          w: 60 + Math.random() * W * 0.4, drop: Math.random() < 0.5 });
      }
      const sp = [], m = Math.round((30 + Math.random() * 60) * inten * env);
      for (let i = 0; i < m; i++) sp.push({ x: Math.random() * W, y: Math.random() * H, w: 2 + ((Math.random() * 3) | 0) * 2, c: [pal.fg, pal.warn, pal.alt, pal.hi][(Math.random() * 4) | 0] });
      return { bands, sp, blank: Math.random() < 0.2 };
    };
    fxs.push({
      age: 0, life, motion: true,
      update(dtms) {
        const t = this.age / life;
        hold -= dtms;
        if (!frm || hold <= 0) {
          frm = build(this.env()); hold = rnd(45, 95);
          if (t > 0.3 && frm.blank) frm.bands.length = frm.sp.length = 0;   // dead frames make it stutter
        }
      },
      env() { const t = this.age / life; return t < 0.7 ? 1 - t * 0.5 : ((1 - t) / 0.3) * 0.65; },
      draw() {
        if (!frm) return;
        const env = this.env();
        if (frm.bands.length) { ctx.globalAlpha = 0.05 * env * inten; ctx.fillStyle = c; ctx.fillRect(0, 0, W, H); }
        for (const b of frm.bands) {
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = c; ctx.globalAlpha = 0.14 * env; ctx.fillRect(0, b.y, W, b.h);
          ctx.fillStyle = pal.alt; ctx.globalAlpha = 0.3 * env; ctx.fillRect(b.x + b.dx, b.y + b.h * 0.15, b.w, b.h * 0.45);       // colour-offset blocks
          ctx.fillStyle = c;       ctx.globalAlpha = 0.45 * env; ctx.fillRect(b.x - b.dx * 0.7, b.y + b.h * 0.4, b.w * 0.8, b.h * 0.4);
          ctx.fillStyle = pal.hi;  ctx.globalAlpha = 0.55 * env; ctx.fillRect(b.x + b.dx * 0.3, b.y, b.w * 0.5, 1.5);
          ctx.fillRect(0, b.y + b.h, W, 1);
          if (b.drop) {                                                    // dark tear where the picture slipped away
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = 'rgba(6,4,2,0.55)'; ctx.globalAlpha = env;
            ctx.fillRect(b.x + b.dx, b.y + b.h * 0.2, b.w * 1.3, b.h * 0.5);
          }
        }
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.65 * env;
        for (const s of frm.sp) { ctx.fillStyle = s.c; ctx.fillRect(s.x, s.y, s.w, 2); }
      }
    });
    wake();
  }

  function rain(o) {
    if (reduced) return;
    o = o || {};
    const life = o.life || 3500, c = col(o.color, 'fg'), dens = o.density == null ? 1 : o.density;
    const cell = W < 500 ? 16 : 18, cols = [];
    const mk = x => ({ x, y: -Math.random() * H, v: rnd(110, 320), len: 6 + ((Math.random() * 10) | 0), ch: Array.from({ length: 48 }, () => pick(RAIN)) });
    const n = Math.floor(W / cell);
    for (let i = 0; i < n && cols.length < 80; i++) if (Math.random() < Math.min(1, 0.5 * dens)) cols.push(mk(i * cell + cell / 2));
    fxs.push({
      age: 0, life, motion: true,
      update(dtms, dt) {
        for (const c2 of cols) {
          c2.y += c2.v * dt;
          if (Math.random() < 0.08) c2.ch[(Math.random() * 48) | 0] = pick(RAIN);   // flicker
          if (c2.y - c2.len * cell > H) { c2.y = -Math.random() * 200; c2.v = rnd(110, 320); }
        }
      },
      draw() {
        const t = this.age / life, env = sstep(t / 0.2) * sstep((1 - t) / 0.25);
        ctx.font = (cell - 2) + 'px ' + FONT;
        ctx.textAlign = 'center'; ctx.textBaseline = 'top';
        for (const c2 of cols) {
          const hr = Math.floor(c2.y / cell);
          ctx.fillStyle = c;
          for (let i = 1; i < c2.len; i++) {
            const row = hr - i, py = row * cell;
            if (py < -cell || py > H) continue;
            ctx.globalAlpha = Math.pow(1 - i / c2.len, 1.4) * 0.8 * env;
            ctx.fillText(c2.ch[((row % 48) + 48) % 48], c2.x, py);
          }
          const hy = hr * cell;
          if (hy > -cell && hy < H) {
            ctx.fillStyle = pal.hi;
            ctx.globalAlpha = 0.14 * env; ctx.fillRect(c2.x - cell / 2, hy - 2, cell, cell + 2);   // head glow block
            ctx.globalAlpha = env; ctx.fillText(c2.ch[((hr % 48) + 48) % 48], c2.x, hy);
          }
        }
      }
    });
    wake();
  }

  function fireworks(o) {
    o = o || {};
    if (reduced) { burst(W / 2, H * 0.3, { count: 6, color: 'hi' }); flash({ alpha: 0.08, life: 300 }); return; }
    const life = o.life || 3000, n = o.count || 7, keys = ['fg', 'hi', 'alt', 'warn'];
    for (let i = 0; i < n; i++) {
      const t0 = (i / n) * life * 0.7 + Math.random() * 120;
      const x = rnd(W * 0.15, W * 0.85), y = rnd(H * 0.1, H * 0.45), c = keys[(Math.random() * 4) | 0], rise = 420;
      sched.push({ t: t0, fn: () => {
        trail(x + rnd(-40, 40), H + 10, x, y, { color: c, life: rise });
        sched.push({ t: rise * 0.65, fn: () => {
          burst(x, y, { count: 44, color: c, speed: 1.5, gravity: 0.5, life: 1400, glyphs: i % 3 === 0 });
          burst(x, y, { count: 12, color: 'hi', speed: 0.7, gravity: 0.3, life: 1100 });
          shockwave(x, y, { color: c, radius: 100, width: 2, life: 500 });
          flash({ color: c, alpha: 0.03, life: 200 });
        } });
      } });
    }
    wake();
  }

  function stamp(text, o) {
    o = o || {};
    const life = o.life || 1400, c = col(o.color, 'hi'), fam = o.font || 'VT323', sub = o.sub;
    const fontOf = px => px + 'px "' + fam + '", "IBM Plex Mono", monospace';
    let size = o.size || Math.min(W * 0.22, 160);
    ctx.font = fontOf(size);
    const mw = ctx.measureText(text).width;
    if (mw > W * 0.92) size *= (W * 0.92) / mw;            // long words must still fit a phone
    const cy = o.y == null ? H / 2 : o.y, cx = W / 2;
    const slam = Math.min(200, life * 0.18), diss = life * 0.64;
    let hit = false, dissolved = false;
    fxs.push({
      age: 0, life,
      update() {
        if (reduced) return;
        if (!hit && this.age >= slam) {
          hit = true;
          shockwave(cx, cy, { color: c, radius: size * 1.5, width: 3, life: 500 });
          burst(cx, cy, { count: 10, color: c, speed: 0.8, life: 500 });
        }
        if (!dissolved && this.age >= diss) { dissolved = true; dissolve(); }
      },
      draw() {
        const age = this.age;
        let s = 1, a = 1, off = 1.5, dx = 0;
        if (reduced) a = Math.min(age / 120, 1) * Math.min((life - age) / 250, 1);
        else if (age < slam) { const k = age / slam; s = 2.2 - 1.2 * ease3(k); a = Math.min(1, k * 2.5); off = size * 0.03 * s; }
        else if (age < diss) { off = 1.5 + Math.max(0, 1 - (age - slam) / 160) * size * 0.03; dx = age - slam < 130 ? (Math.random() - 0.5) * 6 * (1 - (age - slam) / 130) : 0; }
        else { const d = (age - diss) / (life - diss); a = Math.pow(1 - d, 1.5); s = 1 + 0.04 * d; off = 1.5 + d * size * 0.04; }
        ctx.translate(cx + dx, cy);
        ctx.scale(s, s);
        ctx.font = fontOf(size);
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (!reduced) {
          ctx.fillStyle = pal.alt;  ctx.globalAlpha = 0.5 * a; ctx.fillText(text, -off, 0);   // chromatic split
          ctx.fillStyle = pal.warn; ctx.globalAlpha = 0.5 * a; ctx.fillText(text, off, 0);
          ctx.globalCompositeOperation = 'source-over';       // main layer replaces, so additive fringes don't bleach it white
        }
        ctx.fillStyle = c; ctx.globalAlpha = a;
        ctx.shadowColor = c; ctx.shadowBlur = Math.min(24, size * 0.14);   // single shadowBlur, one object only
        ctx.fillText(text, 0, 0);
        ctx.shadowBlur = 0;
        if (sub) {
          const subA = Math.min(1, Math.max(0, (age - slam) / 200)) * (age < diss ? 1 : a);
          ctx.font = fontOf(Math.max(14, size * 0.28));
          ctx.fillStyle = c; ctx.globalAlpha = reduced ? a : subA * 0.9;
          ctx.fillText(sub, 0, size * 0.62);
        }
      }
    });
    // turn the glyph pixels into particles: rasterise once offscreen, sample, spawn
    function dissolve() {
      try {
        const pad = 20, ow = Math.ceil(Math.min(mw, W) + pad * 2 + size * 0.2), oh = Math.ceil(size * 1.3);
        const oc = document.createElement('canvas'); oc.width = ow; oc.height = oh;
        const x = oc.getContext('2d');
        x.font = fontOf(size); x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#fff';
        x.fillText(text, ow / 2, oh / 2);
        const d = x.getImageData(0, 0, ow, oh).data, st = Math.max(3, Math.round(size / 26)), pts = [];
        for (let py = 0; py < oh; py += st) for (let px = 0; px < ow; px += st) if (d[(py * ow + px) * 4 + 3] > 128) pts.push(px, py);
        const cap = W < 500 ? 90 : 160, cnt = Math.min(cap, pts.length / 2);
        for (let i = 0; i < cnt; i++) {
          const j = ((Math.random() * pts.length / 2) | 0) * 2, g = Math.random() < 0.25;
          addP({ x: cx + pts[j] - ow / 2, y: cy + pts[j + 1] - oh / 2, vx: rnd(-50, 50), vy: -rnd(20, 110), age: 0, life: rnd(600, 1100),
            size: g ? rnd(12, 18) : rnd(1.5, 3), col: Math.random() < 0.3 ? pal.hi : c, g: -30, drag: 1.2, kind: g ? 2 : 0, ch: g ? pick('01#%░▒') : '' });
        }
      } catch (e) { /* sampling is garnish, never fatal */ }
    }
    wake();
  }

  function scan(o) {
    if (reduced) return;
    o = o || {};
    const life = o.life || 700, c = col(o.color, 'fg'), band = 110;
    fxs.push({
      age: 0, life, motion: true,
      draw() {
        const t = this.age / life, y = -band + (H + band * 2) * t, env = sstep(t / 0.1) * sstep((1 - t) / 0.15);
        const g = ctx.createLinearGradient(0, y - band, 0, y);         // glow trails behind the head, above it
        g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.3));
        ctx.fillStyle = g; ctx.globalAlpha = env; ctx.fillRect(0, y - band, W, band);
        ctx.fillStyle = c; ctx.globalAlpha = 0.5 * env; ctx.fillRect(0, y - 2, W, 4);
        ctx.fillStyle = hot(c, 0.55); ctx.globalAlpha = env * (0.85 + Math.random() * 0.15); ctx.fillRect(0, y - 1, W, 2);
      }
    });
    wake();
  }

  // ---------- public ----------
  window.PazaakFX = {
    init(canvas) {
      cv = canvas;
      ctx = cv.getContext('2d');
      if (getComputedStyle(cv).position !== 'fixed') {     // safety net if the page forgot its css
        cv.style.cssText += ';position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none';
      }
      ready = true;
      listen();
      resize();
    },
    setColors(c) { if (c) for (const k of ['fg', 'hi', 'warn', 'alt']) if (c[k]) pal[k] = c[k]; },
    setReduced(b) {
      reduced = !!b;
      if (reduced) {                                       // drop anything with big motion already in flight
        for (let i = fxs.length - 1; i >= 0; i--) if (fxs[i].motion) fxs.splice(i, 1);
        amb.motes.length = 0; amb.level = 0;
      }
    },
    burst, shockwave, trail, flash, glitch, rain, fireworks, stamp, scan,
    ambient(on) { amb.on = !!on; if (on) wake(); },
    clear() {
      parts.length = 0; fxs.length = 0; sched.length = 0;
      if (ctx && ready) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); }
      if (!amb.on && raf) { cancelAnimationFrame(raf); raf = 0; }
    },
    busy() { return parts.length > 0 || fxs.length > 0 || sched.length > 0; }   // ambient dust does not count
  };
})();
