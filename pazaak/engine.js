// pazaak rules engine + ai. pure js, no dependencies, json-serializable state.
(function (root) {
  'use strict';

  // ---------- rng ----------

  // mulberry32 with the state kept on the object as a plain int, so a match survives json
  function nextf(o) {
    o.rng = (o.rng + 0x6D2B79F5) | 0;
    let t = o.rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // xmur3-style string hash
  function hashStr(s) {
    let h = 1779033703 ^ s.length;
    for (let i = 0; i < s.length; i++) {
      h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^ (h >>> 16)) | 0;
  }

  function seedState(seed) {
    if (seed === undefined || seed === null) return Math.floor(Math.random() * 4294967296) | 0;
    if (typeof seed === 'number' && isFinite(seed) && Math.floor(seed) === seed) return seed | 0;
    return hashStr(String(seed));
  }

  function shuffle(a, f) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(f() * (i + 1));
      const x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }

  // a copy of the rng that does not advance the match, for previews
  function peek(m) {
    const o = { rng: m.rng };
    return function () { return nextf(o); };
  }

  function drawHand(deck, r) {
    let f;
    if (typeof r === 'function') f = r;
    else if (r && typeof r === 'object' && typeof r.rng === 'number') f = function () { return nextf(r); };
    else if (r !== undefined && r !== null) { const o = { rng: seedState(r) }; f = function () { return nextf(o); }; }
    else f = Math.random;
    return shuffle(deck.slice(), f).slice(0, 4);
  }

  // ---------- cards ----------

  const INFO = {};
  const ALL_CARDS = [];
  function def(name, type, label, choices, desc) {
    INFO[name] = { name: name, type: type, label: label, choices: choices, desc: desc };
    ALL_CARDS.push(name);
  }
  for (let n = 1; n <= 6; n++) def('+' + n, 'plus', '+' + n, [n], 'adds ' + n + ' to your total.');
  for (let n = 1; n <= 6; n++) def('-' + n, 'minus', '-' + n, [-n], 'subtracts ' + n + ' from your total.');
  for (let n = 1; n <= 6; n++) def('\u00b1' + n, 'flip', '\u00b1' + n, [n, -n], 'add or subtract ' + n + '. your choice.');
  def('\u00b11/2', 'gold', '\u00b11/2', [1, -1, 2, -2], 'plays as +1, -1, +2 or -2.');
  def('2&4', 'gold', '2&4', [], 'flips the sign of every 2 and 4 on your board.');
  def('3&6', 'gold', '3&6', [], 'flips the sign of every 3 and 6 on your board.');
  def('2x', 'gold', 'x2', [], 'doubles the last card on your board.');
  def('\u00b11T', 'gold', '\u00b11T', [1, -1], 'plays as +1 or -1. wins a tied set.');

  function cardInfo(name) {
    const i = INFO[name];
    return i ? { name: i.name, type: i.type, label: i.label, choices: i.choices.slice(), desc: i.desc } : null;
  }

  function signed(n) { return (n > 0 ? '+' : '') + n; }

  // what a side card does to this board: the new card's value and any sign flips
  function effect(board, name, choice) {
    if (name === '2&4' || name === '3&6') {
      const a = name === '2&4' ? 2 : 3, b = a * 2;
      const flips = [];
      board.forEach(function (c) {
        const x = Math.abs(c.v);
        if (x === a || x === b) flips.push({ id: c.id, from: c.v, to: -c.v });
      });
      return { v: 0, flips: flips };
    }
    if (name === '2x') return { v: board.length ? board[board.length - 1].v : 0, flips: [] };
    return { v: choice, flips: [] };
  }

  // ---------- state helpers ----------

  function total(m, seat) {
    let s = 0;
    const b = m.boards[seat];
    for (let i = 0; i < b.length; i++) s += b[i].v;
    return s;
  }

  function hasTie(board) {
    return board.some(function (c) { return c.tie; });
  }

  function copy(c) { return { id: c.id, kind: c.kind, name: c.name, v: c.v, base: c.base, tie: c.tie }; }

  function freshDeck(m) {
    const d = [];
    for (let v = 1; v <= 10; v++) for (let k = 0; k < 4; k++) d.push(v);
    return shuffle(d, function () { return nextf(m); });
  }

  function deckCounts(m) {
    const c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < m.deck.length; i++) c[m.deck[i]]++;
    return c;
  }

  // counts the ai plans with: an empty deck is about to be rebuilt
  function planCounts(m) {
    return m.deck.length ? deckCounts(m) : [0, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  }

  function bustRisk(m, seat) {
    const c = planCounts(m), t = total(m, seat);
    let n = 0, bad = 0;
    for (let v = 1; v <= 10; v++) { n += c[v]; if (t + v > 20) bad += c[v]; }
    return n ? bad / n : 0;
  }

  // ---------- match ----------

  function createMatch(opts) {
    opts = opts || {};
    const hands = opts.hands;
    if (!hands || hands.length !== 2) throw new Error('createMatch: hands must be two arrays');
    hands.forEach(function (h) {
      h.forEach(function (n) { if (n && !INFO[n]) throw new Error('createMatch: unknown card ' + n); });
    });
    const m = {
      v: 1,
      seed: seedState(opts.seed),
      rng: 0,
      setsToWin: opts.setsToWin || 3,
      hands: [hands[0].slice(), hands[1].slice()],
      boards: [[], []],
      standing: [false, false],
      played: [false, false],
      deck: [],
      score: [0, 0],
      set: 0,
      phase: 'idle',
      turn: 0,
      starter: 0,
      nextStarter: 0,
      history: [],
      winner: null,
      nextId: 1
    };
    m.rng = m.seed;
    m.starter = opts.first === 0 || opts.first === 1 ? opts.first : (nextf(m) < 0.5 ? 0 : 1);
    m.nextStarter = m.starter;
    m.turn = m.starter;
    return m;
  }

  function startSet(m) {
    if (m.phase !== 'idle' && m.phase !== 'setOver') throw new Error('startSet: no set can start in phase ' + m.phase);
    const ev = [];
    m.set++;
    m.starter = m.nextStarter;
    m.boards = [[], []];
    m.standing = [false, false];
    m.played = [false, false];
    m.phase = 'turn';
    // the main deck is shared: forty cards, four of each 1 to 10
    m.deck = freshDeck(m);
    ev.push({ type: 'setStart', set: m.set, starter: m.starter });
    beginTurn(m, m.starter, ev);
    return ev;
  }

  function beginTurn(m, seat, ev) {
    m.turn = seat;
    m.played[seat] = false;
    ev.push({ type: 'turn', seat: seat });
    if (!m.deck.length) {
      m.deck = freshDeck(m);
      ev.push({ type: 'reshuffle' });
    }
    const v = m.deck.pop();
    const card = { id: m.nextId++, kind: 'main', name: String(v), v: v, base: v, tie: false };
    m.boards[seat].push(card);
    ev.push({ type: 'draw', seat: seat, card: copy(card) });
    settle(m, seat, ev);
  }

  // checks after a draw or a play: nine cards, bust, twenty. a bust over 20 after a
  // draw waits, since a side card may still save it; after a play it is final
  function settle(m, seat, ev) {
    const t = total(m, seat);
    if (m.boards[seat].length >= 9) {
      if (t <= 20) {
        ev.push({ type: 'nine', seat: seat, total: t });
        endSet(m, seat, 'nine', ev);
      } else bust(m, seat, ev);
      return;
    }
    if (t > 20) {
      if (m.played[seat]) bust(m, seat, ev);
      return;
    }
    if (t === 20) {
      ev.push({ type: 'twenty', seat: seat });
      m.standing[seat] = true;
      ev.push({ type: 'stand', seat: seat, total: t, auto: true });
      advance(m, seat, ev);
    }
  }

  function bust(m, seat, ev) {
    ev.push({ type: 'bust', seat: seat, total: total(m, seat) });
    endSet(m, 1 - seat, 'bust', ev);
  }

  function advance(m, from, ev) {
    if (m.standing[0] && m.standing[1]) return resolve(m, ev);
    // a standing opponent means you keep taking turns
    const o = 1 - from;
    beginTurn(m, m.standing[o] ? from : o, ev);
  }

  function resolve(m, ev) {
    const a = total(m, 0), b = total(m, 1);
    if (a !== b) return endSet(m, a > b ? 0 : 1, 'stand', ev);
    const ta = hasTie(m.boards[0]), tb = hasTie(m.boards[1]);
    if (ta !== tb) return endSet(m, ta ? 0 : 1, 'tiebreak', ev);
    endSet(m, null, 'tie', ev);
  }

  function endSet(m, winner, reason, ev) {
    const totals = [total(m, 0), total(m, 1)];
    if (winner !== null) m.score[winner]++;
    m.history.push({ set: m.set, winner: winner, reason: reason, totals: totals.slice() });
    m.phase = 'setOver';
    // the loser opens the next set; a tie replays with the same opener
    m.nextStarter = winner === null ? m.starter : 1 - winner;
    ev.push({ type: 'setEnd', winner: winner, reason: reason, totals: totals, score: m.score.slice() });
    if (winner !== null && m.score[winner] >= m.setsToWin) {
      m.phase = 'matchOver';
      m.winner = winner;
      ev.push({ type: 'matchEnd', winner: winner });
    }
  }

  // ---------- actions ----------

  function legalPlays(m, seat) {
    const out = [];
    if (m.phase !== 'turn' || m.turn !== seat || m.played[seat] || m.boards[seat].length >= 9) return out;
    const board = m.boards[seat], t = total(m, seat);
    m.hands[seat].forEach(function (name, hi) {
      if (!name) return;
      const info = INFO[name];
      const choices = info.choices.length ? info.choices : [null];
      choices.forEach(function (ch) {
        const e = effect(board, name, ch);
        let after = t + e.v;
        e.flips.forEach(function (f) { after += f.to - f.from; });
        const label = ch === null ? info.label : signed(ch) + (name === '\u00b11T' ? 'T' : '');
        out.push({ handIndex: hi, name: name, choice: ch, after: after, label: label });
      });
    });
    return out;
  }

  function fail(msg) { return { ok: false, error: msg, events: [] }; }

  function act(m, seat, a) {
    if (m.phase !== 'turn') return fail('no set is in progress');
    if (seat !== 0 && seat !== 1) return fail('bad seat');
    if (seat !== m.turn) return fail('it is not your turn');
    if (!a || typeof a !== 'object') return fail('bad action');
    const ev = [];
    if (a.type === 'play') {
      if (m.played[seat]) return fail('you already played a side card this turn');
      if (m.boards[seat].length >= 9) return fail('your board is full');
      const name = Number.isInteger(a.handIndex) ? m.hands[seat][a.handIndex] : null;
      if (!name) return fail('no card in that slot');
      const info = INFO[name];
      let choice = null;
      if (info.choices.length) {
        if (info.choices.indexOf(a.choice) < 0) return fail('pick one of: ' + info.choices.join(', '));
        choice = a.choice;
      }
      const board = m.boards[seat];
      const e = effect(board, name, choice);
      e.flips.forEach(function (f) {
        board.forEach(function (c) { if (c.id === f.id) c.v = f.to; });
      });
      const card = { id: m.nextId++, kind: 'side', name: name, v: e.v, base: e.v, tie: name === '\u00b11T' };
      board.push(card);
      m.hands[seat][a.handIndex] = null;
      m.played[seat] = true;
      ev.push({ type: 'play', seat: seat, handIndex: a.handIndex, name: name, choice: choice, card: copy(card), flips: e.flips });
      settle(m, seat, ev);
    } else if (a.type === 'end') {
      const t = total(m, seat);
      if (t > 20) bust(m, seat, ev);
      else {
        ev.push({ type: 'end', seat: seat, total: t });
        advance(m, seat, ev);
      }
    } else if (a.type === 'stand') {
      const t = total(m, seat);
      if (t > 20) bust(m, seat, ev);
      else {
        m.standing[seat] = true;
        ev.push({ type: 'stand', seat: seat, total: t, auto: false });
        advance(m, seat, ev);
      }
    } else return fail('unknown action');
    return { ok: true, events: ev };
  }

  // ---------- ai: shared pieces ----------

  const END = { type: 'end' }, STAND = { type: 'stand' };

  // how much a card is worth keeping for later sets (win-probability units)
  const WORTH = {};
  ALL_CARDS.forEach(function (n) {
    const i = INFO[n], k = i.choices.length ? Math.abs(i.choices[0]) : 0;
    WORTH[n] = i.type === 'plus' ? 0.012 + 0.004 * k
      : i.type === 'minus' ? 0.016 + 0.004 * k
      : i.type === 'flip' ? 0.03 + 0.006 * k
      : n === '\u00b11/2' ? 0.05 : n === '\u00b11T' ? 0.06 : n === '2x' ? 0.05 : 0.04;
  });

  function playAct(p) { return { type: 'play', handIndex: p.handIndex, choice: p.choice }; }

  // only public info plus the ai's own hand. the opponent's hand is never read, except
  // for how many cards are left in it, which anyone can count from the table
  function view(m, seat) {
    const o = 1 - seat, counts = planCounts(m);
    let n = 0;
    for (let i = 1; i <= 10; i++) n += counts[i];
    return {
      m: m, seat: seat, o: o,
      t: total(m, seat), u: total(m, o),
      oppStand: m.standing[o],
      plays: legalPlays(m, seat),
      counts: counts, n: n,
      myScore: m.score[seat], oppScore: m.score[o],
      oppCards: m.hands[o].filter(Boolean).length,
      myTie: hasTie(m.boards[seat]), oppTie: hasTie(m.boards[o]),
      len: m.boards[seat].length
    };
  }

  // chance the next draw lands in [lo, hi] when added to t
  function pDraw(v, t, lo, hi) {
    let s = 0;
    for (let c = 1; c <= 10; c++) if (t + c >= lo && t + c <= hi) s += v.counts[c];
    return v.n ? s / v.n : 0;
  }

  function byWorthThenAfter(a, b) { return WORTH[a.name] - WORTH[b.name] || b.after - a.after; }
  function byAfterThenWorth(a, b) { return b.after - a.after || WORTH[a.name] - WORTH[b.name]; }

  // over 20: the play that lands highest at or under 20, else give up
  function saveOrEnd(v) {
    const s = v.plays.filter(function (p) { return p.after <= 20; }).sort(byAfterThenWorth);
    return s.length ? playAct(s[0]) : END;
  }

  // standing now must not hand the set away
  function standOk(v) {
    if (!v.oppStand) return true;
    return v.t > v.u || (v.t === v.u && v.myTie && !v.oppTie);
  }

  function exact20(v) {
    const s = v.plays.filter(function (p) { return p.after === 20; }).sort(byWorthThenAfter);
    return s.length ? playAct(s[0]) : null;
  }

  // ---------- ai: personalities ----------

  const PROFILES = {
    camille: {
      name: 'Camille',
      deck: ['+1', '+2', '+3', '+4', '+5', '-1', '-2', '-3', '-4', '-5'],
      standMin: 14, standSpan: 5, randomPlay: 0.25, saveFail: 0.3
    },
    t3: {
      name: 'T3-M4',
      deck: ['+1', '+2', '+3', '+4', '-1', '-2', '-3', '-4', '\u00b11', '\u00b12'],
      stand: 16
    },
    mission: {
      name: 'Mission Vao',
      deck: ['+2', '+3', '+4', '-2', '-3', '\u00b11', '\u00b12', '\u00b13', '\u00b14', '2x'],
      stand: 18, spend: 19, gamble: 0.15, gambleNet: 0.15
    },
    atton: {
      name: 'Atton Rand',
      deck: ['+3', '+4', '-2', '-3', '\u00b11', '\u00b12', '\u00b13', '\u00b14', '\u00b11/2', '2&4'],
      risk: 0.6, behind: 0.15, flexCut: 0.9, hit20: 12, beatBust: 0.3, beatWin: 0.35
    },
    hk: {
      name: 'HK-47',
      deck: ['\u00b11', '\u00b12', '\u00b13', '\u00b14', '\u00b15', '\u00b11/2', '2&4', '3&6', '2x', '\u00b11T'],
      depth: 2, cardWeight: 6, decisiveMul: 0.3, oppSave: 0.3, oppStop: 16, oppNaive: 0.5, standBias: -0.001, margin: 0.003
    }
  };

  function brainCamille(v, P, rnd) {
    if (v.t > 20) return rnd() < P.saveFail ? END : saveOrEnd(v);
    // pure whim
    if (v.plays.length && rnd() < P.randomPlay) return playAct(v.plays[Math.floor(rnd() * v.plays.length)]);
    if (!standOk(v)) return END;
    return v.t >= P.standMin + Math.floor(rnd() * P.standSpan) ? STAND : END;
  }

  function brainT3(v, P) {
    if (v.t > 20) return saveOrEnd(v);
    const x = exact20(v);
    if (x) return x;
    if (!standOk(v)) return END;
    return v.t >= P.stand ? STAND : END;
  }

  function brainMission(v, P, rnd) {
    if (v.t > 20) return saveOrEnd(v);
    const x = exact20(v);
    if (x) return x;
    const best = v.plays.filter(function (p) { return p.after <= 20; }).sort(byAfterThenWorth)[0];
    if (v.oppStand) {
      if (standOk(v)) return STAND;
      return best && best.after > v.u ? playAct(best) : END;
    }
    if (v.t < P.stand) return best && best.after >= P.spend ? playAct(best) : END;
    if (v.t === P.stand && best && best.after === 19) return playAct(best);
    // sometimes it just keeps pushing, more so with a card that can pull it back
    const net = v.plays.some(function (p) { return p.after < v.t; });
    if (v.t === P.stand && rnd() < (net ? P.gambleNet : P.gamble)) return END;
    return STAND;
  }

  function brainAtton(v, P) {
    const t = v.t, X = v.u;
    if (t > 20) return saveOrEnd(v);
    const pb = pDraw(v, t, 21, 99);
    if (v.oppStand) {
      if (standOk(v)) return STAND;
      // spend the cheapest card that beats them if the draw is too dicey
      const beat = v.plays.filter(function (p) { return p.after > X && p.after <= 20; }).sort(byWorthThenAfter);
      const pWin = pDraw(v, t, X + 1, 20);
      if (beat.length && (pb >= P.beatBust || pWin < P.beatWin)) return playAct(beat[0]);
      return END;
    }
    const x = exact20(v);
    if (x && t >= P.hit20 && t <= 18) return x;
    // a card that can take me back under 20 makes the next draw safer
    const flex = v.plays.some(function (p) { return p.name !== '2&4' && p.name !== '3&6' && p.name !== '2x' && p.choice < 0; });
    const eff = flex ? pb * P.flexCut : pb;
    let thr = P.risk;
    if (X > t) thr += P.behind;
    if (t >= 19 || eff >= thr) {
      const up = v.plays.filter(function (p) { return p.after === 19 && t < 19; }).sort(byWorthThenAfter)[0];
      return up && X >= t && t >= 15 ? playAct(up) : STAND;
    }
    return END;
  }

  // hk-47: expected win probability of locking in a total versus drawing on, a short
  // lookahead over the known deck, and a price on every card spent
  function hkThink(v, P) {
    const p = v.counts.map(function (c) { return c / v.n; });
    const X = v.u;
    const oppSave = v.oppCards > 0 ? P.oppSave : 0;
    const decisive = v.myScore === v.m.setsToWin - 1 || v.oppScore === v.m.setsToWin - 1;
    const mul = P.cardWeight * (decisive ? P.decisiveMul : 1);
    function cost(name) { return WORTH[name] * mul; }

    // chance a not-yet-standing opponent draws on until it beats t (and does not bust)
    const wCache = [];
    function oppWins(t) {
      if (wCache[t] !== undefined) return wCache[t];
      const memo = [];
      function w(u) {
        if (u > 20) return oppSave * 0.5;
        if (u > t) return 1;
        if (u === 20) return 0.5;
        if (memo[u] !== undefined) return memo[u];
        let draw = 0;
        for (let c = 1; c <= 10; c++) if (p[c]) draw += p[c] * w(u + c);
        // a naive opponent stops at its own threshold even when that loses
        const r = u >= P.oppStop ? P.oppNaive * (u === t ? 0.5 : 0) + (1 - P.oppNaive) * draw : draw;
        return (memo[u] = r);
      }
      return (wCache[t] = w(X));
    }

    function S(t, tie) {
      if (t > 20) return 0;
      if (v.oppStand) {
        if (t > X) return 1;
        if (t < X) return 0;
        return tie && !v.oppTie ? 1 : v.oppTie && !tie ? 0 : 0.5;
      }
      return 1 - oppWins(t);
    }

    // hand cards as plain deltas for the future; flips are only modelled on the board now
    const rest = [];
    v.m.hands[v.seat].forEach(function (name, hi) {
      if (!name) return;
      const info = INFO[name];
      if (info.choices.length) info.choices.forEach(function (ch) { rest.push({ hi: hi, name: name, d: ch, dbl: false, tie: name === '\u00b11T' }); });
      else if (name === '2x') rest.push({ hi: hi, name: name, d: 0, dbl: true, tie: false });
    });

    // draw-only value beyond the lookahead: stand or take another card, no hand cards.
    // totals only grow, so this is a plain backwards pass from 20
    const nc = [];
    for (let t = 20; t >= 0; t--) {
      let draw = 0;
      if (t < 20) for (let c = 1; c <= 10; c++) if (p[c] && t + c <= 20) draw += p[c] * nc[t + c];
      nc[t] = Math.max(S(t, v.myTie), draw);
    }

    // value of drawing on, with a given set of cards still in hand. a card used on the
    // way is gone, so each root play gets its own table without that card
    function build(cards) {
      const vMemo = {}, cMemo = {};
      function V(t, d, last) {
        const key = (t * 12 + last) * 4 + d;
        if (vMemo[key] !== undefined) return vMemo[key];
        let best = t <= 20 ? nc[t] : 0;
        for (let i = 0; i < cards.length; i++) {
          const r = cards[i], after = t + (r.dbl ? last : r.d);
          if (after > 20 || after === t) continue;
          const val = S(after, v.myTie || r.tie) - cost(r.name);
          if (val > best) best = val;
        }
        if (t <= 20 && d > 0) best = Math.max(best, C(t, d));
        return (vMemo[key] = best);
      }
      function C(t, d) {
        const key = t * 4 + d;
        if (cMemo[key] !== undefined) return cMemo[key];
        let s = 0;
        for (let c = 1; c <= 10; c++) if (p[c]) s += p[c] * (t + c === 20 ? S(20, v.myTie) : V(t + c, d - 1, c));
        return (cMemo[key] = s);
      }
      return C;
    }
    const tables = {};
    function contAfter(hi) {
      if (!tables[hi]) tables[hi] = build(rest.filter(function (r) { return r.hi !== hi; }));
      return tables[hi];
    }

    const t = v.t, D = P.depth;
    let bestAct = null, bestVal = -1, bestPlay = null;
    let sv = 0, ev = 0;
    if (t <= 20) {
      sv = S(t, v.myTie);
      ev = contAfter(-1)(t, D);
      if (sv > 0 && sv >= ev + P.standBias) { bestAct = STAND; bestVal = sv; }
      else { bestAct = END; bestVal = ev; }
    }
    let playVal = -1;
    v.plays.forEach(function (pl) {
      if (pl.after > 20) return;
      const tie = v.myTie || pl.name === '\u00b11T';
      let val = v.len + 1 >= 9 ? 1 : S(pl.after, tie);
      if (pl.after < 20 && v.len + 1 < 9) val = Math.max(val, contAfter(pl.handIndex)(pl.after, D));
      val -= cost(pl.name);
      if (!bestPlay || val > playVal) { bestPlay = pl; playVal = val; }
    });
    // a card must clearly beat the best card-free line to be worth spending
    if (bestPlay && (!bestAct || playVal > bestVal + P.margin)) {
      bestAct = playAct(bestPlay); bestVal = playVal;
    } else bestPlay = null;
    return { action: bestAct || END, play: bestPlay, stand: sv, cont: ev, value: bestVal };
  }

  function brainHk(v, P) {
    return hkThink(v, P).action;
  }

  const BRAINS = { camille: brainCamille, t3: brainT3, mission: brainMission, atton: brainAtton, hk: brainHk };

  function aiChoose(m, seat, key) {
    const P = PROFILES[key];
    if (!P) throw new Error('unknown profile: ' + key);
    if (m.phase !== 'turn' || m.turn !== seat) return { type: 'end' };
    const a = BRAINS[key](view(m, seat), P, function () { return nextf(m); });
    return { type: a.type, handIndex: a.handIndex, choice: a.choice };
  }

  // tactical hud: always the strongest brain, and it never touches the match rng
  function advise(m, seat) {
    const t = total(m, seat), br = bustRisk(m, seat);
    if (m.phase !== 'turn' || m.turn !== seat) {
      return { total: t, bustRisk: br, bestPlay: null, suggestion: 'end', reason: 'wait for your turn.' };
    }
    const v = view(m, seat), r = hkThink(v, PROFILES.hk);
    const pct = Math.round(br * 100) + '%';
    const a = r.action;
    if (a.type === 'play') {
      const p = r.play;
      let why;
      if (p.after === 20) why = 'play ' + p.label + ' for twenty';
      else if (t > 20) why = 'play ' + p.label + ' to get back under 21';
      else if (v.oppStand && p.after > v.u) why = 'play ' + p.label + ' to beat their ' + v.u;
      else why = 'play ' + p.label + ' to reach ' + p.after;
      return { total: t, bustRisk: br, bestPlay: p, suggestion: 'play', reason: why };
    }
    let why;
    if (a.type === 'stand') {
      why = v.oppStand && t > v.u ? t + ' beats their ' + v.u + '. stand.'
        : br > 0 ? pct + ' to bust on the next card. stand.' : t + ' is a strong total. stand.';
    } else if (t > 20) why = 'over 20 and no card can save you. end turn.';
    else if (v.oppStand) why = 'they stand on ' + v.u + '. keep drawing.';
    else why = 'only ' + pct + ' to bust on the next card. end turn.';
    return { total: t, bustRisk: br, bestPlay: null, suggestion: a.type === 'stand' ? 'stand' : 'end', reason: why };
  }

  // ---------- export ----------

  const E = {
    ALL_CARDS: ALL_CARDS,
    PROFILES: PROFILES,
    cardInfo: cardInfo,
    createMatch: createMatch,
    startSet: startSet,
    legalPlays: legalPlays,
    act: act,
    total: total,
    deckCounts: deckCounts,
    bustRisk: bustRisk,
    aiChoose: aiChoose,
    advise: advise,
    rng: function (m) { return nextf(m); },
    drawHand: drawHand
  };

  if (typeof module === 'object' && module.exports) module.exports = E;
  else root.PazaakEngine = E;
})(this);
