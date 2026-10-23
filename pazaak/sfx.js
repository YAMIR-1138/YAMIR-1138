// synthesized sound effects for pazaak. web audio only, no files.
(function () {
  'use strict';

  const KEY = 'sound';
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;

  let ctx = null, master = null, bus = null, noiseBuf = null;
  let vol = .7, on = readPref(), humWant = false, hum = null;

  function readPref() {
    try { return JSON.parse(localStorage.getItem(KEY)) === true; } catch (e) { return false; }
  }
  function savePref(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage blocked */ }
  }
  function has(name) { return Object.prototype.hasOwnProperty.call(S, name); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function noiseData(c) {
    const b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  function resume() {
    if (!ctx || ctx.state !== 'suspended') return;
    try { const p = ctx.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
  }

  // lazy setup. false when there is no web audio.
  function init() {
    if (ctx) return true;
    if (!AC) return false;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = vol;
      master.connect(ctx.destination);
      bus = master;
      noiseBuf = noiseData(ctx);
    } catch (e) { ctx = null; return false; }
    sync();
    return true;
  }

  // building blocks, routed to bus (master, or an offline bus while rendering)
  function noise(c, n, t, dur, type, freq, q, v, attack, freq1) {
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = n; src.loop = true; f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (freq1) f.frequency.exponentialRampToValueAtTime(freq1, t + dur);
    g.gain.setValueAtTime(attack ? .0001 : v, t);
    if (attack) g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(bus);
    src.start(t, Math.random() * .5); src.stop(t + dur + .03);
  }
  function tone(c, t, dur, shape, f0, f1, v, attack) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = shape; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(attack ? .0001 : v, t);
    if (attack) g.gain.exponentialRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dur + .03);
    return g;
  }

  // sounds: S[name](ctx, noiseBuffer, startTime)
  const S = {
    deal: (c, n, t) => noise(c, n, t, .12, 'highpass', 800, .7, .22, .008, 6000),
    place: (c, n, t) => { tone(c, t, .1, 'sine', 180, 90, .35, 0); noise(c, n, t, .012, 'bandpass', 2600, 1.5, .18, 0); },
    select: (c, n, t) => tone(c, t, .05, 'sine', 1400, 1800, .1, .002),
    play: (c, n, t) => { tone(c, t, .08, 'square', 1200, 1400, .06, 0); tone(c, t + .07, .1, 'square', 1800, 2100, .06, 0); },
    flip: (c, n, t) => { tone(c, t, .06, 'triangle', 1200, 300, .14, .003); tone(c, t + .06, .08, 'triangle', 300, 1400, .14, .003); },
    stand: (c, n, t) => { tone(c, t, .07, 'square', 220, 180, .07, 0); tone(c, t + .09, .09, 'square', 165, 140, .08, 0); noise(c, n, t, .02, 'lowpass', 900, 1, .12, 0); },
    end: (c, n, t) => tone(c, t, .12, 'sine', 620, 620, .18, .004),
    twenty: (c, n, t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(c, t + i * .05, .14, 'triangle', f, f, .13, .003));
      noise(c, n, t, .45, 'highpass', 6000, .5, .07, .001, 9000);
    },
    bust: (c, n, t) => {
      tone(c, t, .7, 'sawtooth', 320, 70, .11, .02);
      noise(c, n, t, .3, 'highpass', 1200, .5, .1, .005, 400);
    },
    setWin: (c, n, t) => {
      tone(c, t, .12, 'triangle', 392, 392, .18, .004);
      tone(c, t + .11, .12, 'triangle', 523.25, 523.25, .18, .004);
      tone(c, t + .22, .32, 'triangle', 784, 784, .2, .004);
    },
    setLose: (c, n, t) => [659.25, 523.25, 440].forEach((f, i) => tone(c, t + i * .14, .16, 'triangle', f, f * .98, .16, .004)),
    tie: (c, n, t) => { tone(c, t, .12, 'sine', 480, 480, .15, .003); tone(c, t + .15, .12, 'sine', 480, 480, .15, .003); },
    matchWin: (c, n, t) => {
      [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => tone(c, t + i * .09, .16, 'triangle', f, f, .14, .003));
      [523.25, 659.25, 783.99, 1046.5].forEach(f => tone(c, t + .54, .95, 'sine', f, f, .09, .02));
      noise(c, n, t + .54, .95, 'highpass', 5000, .6, .05, .3, 9000);
    },
    matchLose: (c, n, t) => {
      tone(c, t, .36, 'triangle', 392, 370, .16, .02);
      tone(c, t + .3, .36, 'triangle', 349, 330, .16, .02);
      tone(c, t + .6, .6, 'triangle', 311, 262, .16, .02);
    },
    coin: (c, n, t) => { tone(c, t, .07, 'sine', 1319, 1319, .16, .002); tone(c, t + .06, .3, 'sine', 1976, 1976, .2, .002); },
    tick: (c, n, t) => noise(c, n, t, .025, 'bandpass', 2400, 4, .4, 0),
    error: (c, n, t) => { tone(c, t, .2, 'sawtooth', 110, 95, .07, .005); tone(c, t, .2, 'sawtooth', 117, 101, .06, .005); },
    boot: (c, n, t) => {
      tone(c, t, .6, 'triangle', 110, 880, .12, .05);
      [.1, .3, .5].forEach(d => noise(c, n, t + d, .02, 'bandpass', 2000, 3, .2, 0));
      tone(c, t + .65, .15, 'sine', 880, 880, .12, .003);
    },
    shuffle: (c, n, t) => { for (let i = 0; i < 8; i++) noise(c, n, t + i * .035 + rnd(0, .008), .03, 'bandpass', rnd(1000, 2600), 1.5, .16, 0); },
    thinking: (c, n, t) => { for (let i = 0; i < 3; i++) { const f = rnd(500, 1200); tone(c, t + i * .14, .09, 'sine', f, f * 1.25, .1, .005); } },
    glitch: (c, n, t) => { for (let i = 0; i < 5; i++) { const f = 150 + Math.floor(Math.random() * 9) * 160; tone(c, t + i * .025, .02, 'square', f, f, .05, 0); } },
    whoosh: (c, n, t) => noise(c, n, t, .6, 'bandpass', 400, .8, .2, .15, 1800),
    purr: (c, n, t) => {
      // square lfo gates the saw at ~25hz, the envelope breathes three times
      const o = c.createOscillator(), amp = c.createGain(), lfo = c.createOscillator(), depth = c.createGain(), f = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = 50;
      amp.gain.value = .5;
      lfo.type = 'square'; lfo.frequency.value = 25; depth.gain.value = .5;
      lfo.connect(depth); depth.connect(amp.gain);
      f.type = 'lowpass'; f.frequency.value = 260;
      o.connect(amp); amp.connect(f); f.connect(g); g.connect(bus);
      g.gain.setValueAtTime(.0001, t);
      [[.3, .16], [.575, .03], [.85, .16], [1.125, .03], [1.4, .16], [1.7, .0001]].forEach(([at, v]) => g.gain.exponentialRampToValueAtTime(v, t + at));
      o.start(t); lfo.start(t); o.stop(t + 1.75); lfo.stop(t + 1.75);
    },
    mrrp: (c, n, t) => tone(c, t, .16, 'triangle', 480, 820, .2, .01),
    beep: (c, n, t) => {
      const k = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < k; i++) tone(c, t + i * .07, .06, 'sine', rnd(800, 2600), rnd(800, 2600), .12, .003);
    },
    meatbag: (c, n, t) => {
      // ring mod: square carrier times a sine on the gain
      const car = c.createOscillator(), mod = c.createOscillator(), ring = c.createGain(), g = c.createGain();
      car.type = 'square'; car.frequency.value = 110;
      mod.type = 'sine'; mod.frequency.value = 62;
      ring.gain.value = 0;
      mod.connect(ring.gain); car.connect(ring); ring.connect(g); g.connect(bus);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .03);
      g.gain.setValueAtTime(.16, t + .4); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
      car.start(t); mod.start(t); car.stop(t + .53); mod.stop(t + .53);
    },
  };

  // ambient hum: detuned saws through a lowpass with slow lfo drift
  function startHum() {
    if (hum || !ctx) return;
    const t = ctx.currentTime, g = ctx.createGain(), f = ctx.createBiquadFilter(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    const oscs = [ctx.createOscillator(), ctx.createOscillator()];
    oscs[0].frequency.value = 55; oscs[1].frequency.value = 55; oscs[1].detune.value = 9;
    oscs.forEach(o => { o.type = 'sawtooth'; o.connect(f); o.start(t); });
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 2;
    lfo.frequency.value = .12; lg.gain.value = 140;
    lfo.connect(lg); lg.connect(f.frequency); lfo.start(t);
    f.connect(g); g.connect(master);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.045, t + 1);
    hum = { g: g, nodes: oscs.concat([lfo]) };
  }
  function stopHum(secs) {
    if (!hum) return;
    const h = hum, t = ctx.currentTime;
    hum = null;
    h.g.gain.cancelScheduledValues(t);
    h.g.gain.setValueAtTime(Math.max(h.g.gain.value, .0001), t);
    h.g.gain.exponentialRampToValueAtTime(.0001, t + secs);
    h.nodes.forEach(n => n.stop(t + secs + .05));
  }
  // hum follows the on flag and the hum request
  function sync(fast) {
    if (on && humWant) startHum(); else stopHum(fast ? .2 : 1);
  }

  const api = {
    names: Object.keys(S),
    get on() { return on; },
    set(v) {
      on = !!v && init();
      if (on) resume();
      sync(!on);
      savePref(on);
      return on;
    },
    unlock() { if (on && init()) { resume(); sync(); } },
    play(name) {
      try {
        if (!on || !has(name) || !init()) return;
        resume();
        S[name](ctx, noiseBuf, ctx.currentTime + .02);
      } catch (e) { /* sound is never worth an error */ }
    },
    volume(v) {
      if (v !== undefined) {
        vol = Math.min(1, Math.max(0, +v || 0));
        if (master) master.gain.setTargetAtTime(vol, ctx.currentTime, .02);
      }
      return vol;
    },
    hum(v) { humWant = !!v; sync(); },
    // offline render to samples, for testing
    render(name, secs) {
      return new Promise((res, rej) => {
        if (!has(name) || !OAC) return rej(new Error('no sound ' + name));
        const sr = 44100, oc = new OAC(1, Math.ceil(sr * (secs || 2)), sr), prev = bus;
        try {
          bus = oc.createGain(); bus.gain.value = vol; bus.connect(oc.destination);
          S[name](oc, noiseData(oc), .01);
        } finally { bus = prev; }
        oc.startRendering().then(b => res(b.getChannelData(0)), rej);
      });
    },
  };

  window.PazaakSfx = api;
})();
