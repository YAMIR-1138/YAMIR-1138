// PAZAAK · the screen. Everything you see and press: the table, the story, the side deck, the merchant, the records.
// The rules live in engine.js and know nothing about any of this. This file asks them what happened and shows it.
(function () {
  'use strict';
  const E = window.PazaakEngine;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  // the light and the noise are optional: if a script failed to load, the game still plays
  const fx = (name, ...a) => { try { if (window.PazaakFX && PazaakFX[name]) return PazaakFX[name](...a); } catch (e) {} };
  const sfx = (name) => { try { if (window.PazaakSfx) PazaakSfx.play(name); } catch (e) {} };
  const buzz = (p) => { try { if (S.set.haptics && navigator.vibrate) navigator.vibrate(p); } catch (e) {} };

  // ============================================================
  // THE SAVE. Credits, cards, records, the story so far
  // ============================================================
  const STARTER = ['+1', '+2', '+3', '+4', '+5', '-1', '-2', '-3', '-4', '-5', '±1', '±2', '±3', '±4'];
  const DEFAULT_DECK = ['+1', '+2', '+3', '-1', '-2', '-3', '±1', '±2', '±3', '±4'];
  function fresh() {
    const owned = {}; STARTER.forEach((c) => { owned[c] = 1; });
    return {
      v: 1, credits: 300, owned, deck: DEFAULT_DECK.slice(), beaten: {}, lost: {}, seen: {}, align: 0, ach: {},
      stats: { played: 0, won: 0, lost: 0, setsW: 0, setsL: 0, pure: 0, busts: 0, nines: 0, streak: 0, best: 0, earned: 0, hot: 0 },
      daily: {},
      set: { advisor: false, fast: false, motion: !matchMedia('(prefers-reduced-motion: reduce)').matches, haptics: true, hum: false, tilt: true },
    };
  }
  const S = (function () {
    const f = fresh(), s = store.get('pazaak-v1', null);
    if (!s || typeof s !== 'object') return f;
    // anything missing in an old save comes from a fresh one
    for (const k in f) if (!(k in s) || typeof s[k] !== typeof f[k]) s[k] = f[k];
    for (const k in f.stats) if (typeof s.stats[k] !== 'number') s.stats[k] = 0;
    for (const k in f.set) if (typeof s.set[k] !== typeof f.set[k]) s.set[k] = f.set[k];
    return s;
  })();
  const save = () => store.set('pazaak-v1', S);

  // ============================================================
  // THE PEOPLE AT THE TABLE. Who they are, how they talk
  // ============================================================
  const OPP = {
    camille: {
      name: 'CAMILLE', title: "the ship's cat", brain: 'camille', buyin: 0, prize: 40, stars: 1, voice: 'mrrp',
      blurb: 'Sits on the deck. Plays with one paw. Nobody is sure she knows the rules.',
      q: {
        greet: ['*sits on the deck*', '*slow blink*', 'mrrp.'],
        think: ['*stares at the deck*', '*tail flick*', '*sniffs a card*', '*washes a paw, unhurried*'],
        aiTwenty: ['*purrs, loudly and smugly*'],
        aiBust: ['*knocks the whole board onto the floor. this was the plan.*', '*pretends that did not happen*'],
        youTwenty: ['*ears flatten*', '*stares at you. you feel judged.*'],
        youBust: ['mrrp!', '*bats at your last card*'],
        aiStand: ['*lies down on the cards*', '*turns her back on the table*'],
        setWin: ['*slow blink. it is a threat.*'], setLose: ['*hiss*', '*walks off. walks back.*'], tie: ['*sits on the deck again*'],
        matchWin: ['*curls up on your credits. they are hers now.*'], matchLose: ['*leaves. she will be back. she is always back.*'],
        play: ['*paws a card onto the table*', '*a card falls. she did that.*'],
      },
    },
    t3: {
      name: 'T3-M4', title: 'utility droid', brain: 't3', buyin: 50, stars: 2, voice: 'beep',
      blurb: 'Four hundred and twelve hours of practice against the navicomputer. The navicomputer has stopped speaking to it.',
      q: {
        greet: ['Bweep! (T3-M4 is ready. T3-M4 has a strategy.)', 'Bip-bwoo. (Shuffling. Shuffling. Shuffled.)'],
        think: ['Bip... bip... (Calculating.)', 'Whrrr. (Consulting the HK file.)', 'Bwip? (Is that allowed?)'],
        aiTwenty: ['Bwee-oo-WEEP! (Twenty! T3-M4 is not gloating. That was a diagnostic tone.)'],
        aiBust: ['Bwaaaw. (That was a calculated risk. The calculation was wrong.)'],
        youTwenty: ['Bwoo. (Statistically rude.)'],
        youBust: ['Bip-bip! (Twenty-one is over twenty. T3-M4 checked twice.)'],
        aiStand: ['Bwip. (T3-M4 stands. Firmly. On all three wheels.)'],
        setWin: ['Wheee! (Logging a victory!)'], setLose: ['Bwoo-oo. (Logging a learning experience.)'], tie: ['Bip? (A tie. Undefined behaviour.)'],
        matchWin: ['Bweeee-dweep! (T3-M4 wins! T3-M4 will tell the navicomputer!)'], matchLose: ['Bwoo-oo-oo. (Adding defeat to the file.)'],
        play: ['Bip! (Side card deployed.)', 'Whrr-click. (Manipulator arm engaged.)'],
      },
    },
    mission: {
      name: 'MISSION VAO', title: 'hustler, sixteen and a half', brain: 'mission', buyin: 120, stars: 3, voice: 'tick',
      blurb: 'Has been taking credits off this table since before it was bolted down. Plays fast. Talks faster.',
      q: {
        greet: ["Alright, deal 'em. And no peeking. I'll know.", "Ready to lose some credits? 'Cause I'm ready to win some."],
        think: ['Hmm, hang on...', "Don't rush me.", 'Okay, okay. I got this.'],
        aiTwenty: ['Twenty! Ha! Tell me you saw that.'],
        aiBust: ["Ugh! Don't say anything.", 'That was a test. Of the deck.'],
        youTwenty: ['Oh, come on.', "Lucky. That's all that was."],
        youBust: ['Ooh, over! Tough break, pal.', 'Ha! Too greedy.'],
        aiStand: ["I'll stand. Your move, hotshot.", 'Standing. Beat that.'],
        setWin: ["That's my set!"], setLose: ['Fine. You get one.'], tie: ['A tie? Lame. Again!'],
        matchWin: ["Pleasure doing business! Come back when you've got more credits."], matchLose: ['Okay, you got me. This time.'],
        play: ['Watch this.', 'And... that.'],
      },
    },
    atton: {
      name: 'ATTON RAND', title: 'pilot, allegedly', brain: 'atton', buyin: 250, stars: 4, voice: 'tick',
      blurb: "Plays cards, minds his own business, and doesn't ask where you were twenty years ago. Counts everything.",
      q: {
        greet: ["Cards on the table. Let's not make this a whole thing.", "You again? Sure. I've got nowhere to be. Ever."],
        think: ["Let's see what you're hiding.", 'Hm.', 'You blink when you hold a minus card. Did you know that?'],
        aiTwenty: ["Twenty. Don't look so surprised."],
        aiBust: ['That never happened.', 'Teaching moment. For you. Obviously.'],
        youTwenty: ['Huh. Not bad.', 'Okay, that was clean.'],
        youBust: ["Hope's a funny thing. It adds up.", 'Twenty-one. So close. So over.'],
        aiStand: ["I'll stand. Your turn to sweat.", 'Standing. I like my odds.'],
        setWin: ['Mine.'], setLose: ["Sure, take it. I'm feeling generous."], tie: ["Even. Let's not do that again."],
        matchWin: ['Good game. Mostly for me.'], matchLose: ['Remind me never to play you for anything that matters.'],
        play: ['Little something I was saving.', "Here's one."],
      },
    },
    hk: {
      name: 'HK-47', title: 'assassin droid, dealing', brain: 'hk', buyin: 500, stars: 5, voice: 'meatbag',
      blurb: 'Fourteen thousand games at this table. One loss. The log of that game is corrupted.',
      q: {
        greet: ['Greeting: HK-47 deals, meatbag.', 'Statement: I have calculated the odds of your victory. I will not share them. Out of pity.'],
        think: ['Query: Shall I prolong your suffering?', 'Statement: Calculating.', 'Observation: Your heart rate has increased, meatbag.'],
        aiTwenty: ['Statement: Twenty. Precisely as calculated.', 'Exclamation: Ha! Twenty.'],
        aiBust: ['Statement: An anomaly. It will not recur.', 'Explanation: The deck has been tampered with. By the universe.'],
        youTwenty: ['Commentary: Even a meatbag lands on twenty occasionally.', 'Observation: Irritating.'],
        youBust: ['Mockery: Twenty-one? How very organic of you.', 'Statement: Over twenty. I would offer condolences, but I have none in stock.'],
        aiStand: ['Statement: I stand. Your move, meatbag.', 'Statement: This unit stands. Do something foolish.'],
        setWin: ['Statement: That set is mine.', 'Commentary: Satisfying.'], setLose: ['Statement: A temporary setback.', 'Threat: Enjoy it.'],
        tie: ['Observation: A tie. How unsatisfying. Again.'],
        matchWin: ['Statement: I win the match, meatbag. How predictable.'], matchLose: ['Statement: You have won the match. This unit will reflect on its choices.'],
        play: ['Statement: Observe.', 'Recitation: Card. Played.'],
      },
    },
    archive: {
      name: 'THE ARCHIVE', title: 'a recording of the only game HK-47 ever lost', brain: 'hk', buyin: 0, prize: 300, stars: 6, voice: 'glitch', mirror: true,
      blurb: 'A face blurred out of the log. It plays your side deck. It plays it the way you would.',
      q: {
        greet: ['[ARCHIVE] you always played this card first.', "[ARCHIVE] same deck. let's see."],
        think: ['[ARCHIVE] ...', "[ARCHIVE] you'd wait here. so will i.", '[ARCHIVE] signal degraded'],
        aiTwenty: ['[ARCHIVE] twenty. you taught me that.'],
        aiBust: ["[ARCHIVE] that's how i lost the first time, too."],
        youTwenty: ['[ARCHIVE] good. you remember.'],
        youBust: ['[ARCHIVE] you were always greedy.'],
        aiStand: ['[ARCHIVE] standing. like you would.'],
        setWin: ['[ARCHIVE] one for the past.'], setLose: ['[ARCHIVE] one for you.'], tie: ["[ARCHIVE] of course it's a tie."],
        matchWin: ['[ARCHIVE] not yet. come back.'], matchLose: ['[ARCHIVE] there you are.'],
        play: ['[ARCHIVE] this one.', "[ARCHIVE] you'd play this here."],
      },
    },
  };
  const ORDER = ['camille', 't3', 'mission', 'atton', 'hk', 'archive'];
  const P2 = { name: 'PLAYER 2', title: 'hotseat', q: {} };

  // ---- portraits. Thirty-two by thirty-two, drawn in whichever phosphor is up, from the faces as the game shows them.
  // # the phosphor · + dim · : faint · * bright · e eyes (they blink) · m mouth (it moves when they talk) · w warn · a the other phosphor · b dim other
  const ART = {
    mission: [
      '.............bbbbbbb............',
      '..........bbba*****abbb.........',
      '........bbaaaa*###*aaaabb.......',
      '.......babbbbb***#*bbbbbab......',
      '......baaaaaa*#**##*aaaaaab.....',
      '......baaaa##*#**##*##aaaab.....',
      '.....baaaa#++*#**##*++#aaaab....',
      '.....babb#++++*###*++++#bbab....',
      '.....baaa#+++++*#*+++++#aaab....',
      '.....bbb#+++++++*+++++++#bbb....',
      '.....baa#+a+++aaaaa+++a+#aab....',
      '.....baa#+++++++++++++++#aab....',
      '.....baa#+abbbbaaabbbba+#aaab...',
      '....baaaa#aaeeaabaaeeaa#aabab...',
      '....bbaaa#aaaaaabaaaaaa#aabab...',
      '....bbaaaaaaaaaabaaaaaabaabab...',
      '....babaaaaaaaaabaaaaaababaab...',
      '....babaaaaaaaababaaaaababaaab..',
      '....baabaaaaaaaaaaaaaa.babaaab..',
      '...baaabaaabaammmmmaa...bbaaab..',
      '...baaabaaabaaaaaaaaa...bbaaab..',
      '...baaaabaab.aaaaaaa....bbaab...',
      '...baaaabaab..aaaaa....bbaaab...',
      '...baaaaabab..bbbbb...#bbaaab...',
      '....baaaabb:::::::::::babaaab...',
      '..##baaaaab::::::::::babaaab+##.',
      '..#+baaaaab::::::::::babaaab++#.',
      '.#++baaaaab:::::::::babaaab+++#.',
      '.#++baaaaab::::::::babaaab++++#.',
      '.#+++baaab+:::::::baababb++++++#',
      '#++++baaab+:::::::babab++++++++#',
      '#####bbbbb#::::::bbbbb##########',
    ],
    t3: [
      '.......................#........',
      '.......................#........',
      '...........*******.....#........',
      '...........*####*......#........',
      '.......bbb##*****#######........',
      '.....bb:::bb***************.....',
      '....#b:aaa:b+++++++++++++++##...',
      '..##b:a*aaa:b++++++e++++e++++##.',
      '..#+b:aaaaa:b++++++ww+++ww++++#.',
      '..##b:aaaaa:b##################.',
      '....#b:aaa:b+++++++++++++++##...',
      '.....bb:::bb+++++++++++####.....',
      '.......bbb#############.........',
      '.............######*............',
      '....####.#########***###.####...',
      '...#:+++##+++++++++***+##+++:#..',
      '..#+:++++##+###++###***#++++:+#.',
      '..#+:++++##+#:#++#:#+*##++++:+#.',
      '..#+:++++##+#:#++#:#++##++++:+#.',
      '..#+:++++##+#:#++#:#++##++++:+#.',
      '...#:+++##.####++###+#.##+++:#..',
      '....####+#.#+++++++++#.#+####...',
      '.....#+++#.#+:::::::+#.#+++#....',
      '.....#++++##+++++++++#.#++#.....',
      '......#+++#.#+++++++#.#+++#.....',
      '......#+++#.#########.#+++#.....',
      '......#+++#.+++...+++.#+++#.....',
      '.##########.+:+...+:+.##########',
      '.#++++++++#.+:+...+:+.#++++++++#',
      '.#+::::::+#.+:+...+:+.#+::::::+#',
      '.#++++++++#.+++...+++.#++++++++#',
      '.##########...........##########',
    ],
    hk: [
      '................................',
      '................................',
      '.........###############........',
      '........#++++###*###++++#..#....',
      '........#++++###*###+++++#.#....',
      '.......#++++++##*##++++++####...',
      '......#+++++++##*##+++++++#+#...',
      '......##++++++##*##++++++####...',
      '......##++++++##*##++++++###....',
      '......##++++++++*++++++++###....',
      '......##++++++++*++++++++###....',
      '......##w+++++++++++++++w###....',
      '......##www*ww+++++ww*www###....',
      '......##+++www#####www+++###....',
      '......##+++++w#mmm#w+++++###....',
      '.......#++++++#:::#++++++#.#....',
      '.......#++++++#mmm#++++++#.#....',
      '........#:++++#:::#++++:#..#....',
      '........#+:+++#mmm#+++:+#.......',
      '.........#+:++#:::#++:+#........',
      '..........#+:+#mmm#+:+#.........',
      '...........#+:#:::#:+#..........',
      '............#+#####+#...........',
      '.........###.#######.###........',
      '.....####+++#+::+::+#+++####....',
      '...##+++++###+::+::+###+++++##..',
      '...#++####++++::+::++++####++#..',
      '..#+##++++++++::+::++++++++##+#.',
      '..#+++++:::::+::+::+:::::+++++#.',
      '..#:::::++++++::+::++++++:::::#.',
      '.#++++++++++++::+::++++++++++++#',
      '.############+++++++############',
    ],
    atton: [
      '.................#####..........',
      '.............####+++:+##........',
      '...........##++##++++:++##......',
      '.........##++++++##+++:+++#.....',
      '........#+##+++++++###+:++#.....',
      '........#+++##++++++++##:++#....',
      '.......#++++++###++++++++:+#....',
      '.......#+++++++++##++++++++#....',
      '......##+++++++####++++++++#....',
      '......#++++++##########+++#.....',
      '......#+++++###########+++#.....',
      '.......##+#########::###++#.....',
      '........##::::###::#####+#......',
      '........#*::::###::::#+##+#.....',
      '........#*+e+####+e++++#++#.....',
      '........#*###*######+++#++#.....',
      '........#*###*######+++#++#.....',
      '........#*##*######++++#++#.....',
      '........#*##*######+++++##......',
      '.........*##*######++++++.......',
      '.........*##+#+####+++++........',
      '.........########m#+++++........',
      '.........##mmmmmm#+++++.........',
      '..........########++++++........',
      '........+++#######++++::+++.....',
      '....++++:::#########++:::::++...',
      '..++:::::::########+++:::::::++.',
      '..+:::::::::##++#+++++::::::::+.',
      '.+::::::::::+#+#####::::::::::+.',
      '.+:::::::::::######+:::::::::::+',
      '+::::::::::::+#####::::::::::::+',
      '+++++++++++++++###++++++++++++++',
    ],
    camille: [
      '................................',
      '................................',
      '....#......................#....',
      '....##....................##....',
      '....###..................###....',
      '....##+#................#+##....',
      '....##++#..............#++##....',
      '....##+++#............#+++##....',
      '.....#+++##.########.##+++#.....',
      '.....#++++##........##++++#.....',
      '.....#++##............##++#.....',
      '.....#+#................#+#.....',
      '.....##..................##.....',
      '.....#....................#.....',
      '....#......................#....',
      '....#....eeeeee..eeeeee....#....',
      '...#.....ee+eee..eee+ee.....#...',
      '...#.....eeeee....eeeee.....#...',
      '...#.........e....e.........#...',
      '...#........................#...',
      ':::::......................:::::',
      '...#.::::::...wwww...::::::.#...',
      '....#..........ww..........#....',
      ':::::::::::....#.....:::::::::::',
      '.....#........mmm.........#.....',
      '.....::::::..m...mm..::::::.....',
      ':::::..#................#..:::::',
      '........##............##........',
      '..........##........##..........',
      '............########............',
      '................................',
      '................................',
    ],
    archive: [
      '................................',
      '................................',
      '..............#####.............',
      '.............#######............',
      '............#########...........',
      '...........###########..........',
      '...........###########..........',
      '..........#############.........',
      '..........#############.........',
      '..........#############.........',
      '..........#############.........',
      '..........#############.........',
      '..........#############.........',
      '..........#############.........',
      '...........###########..........',
      '...........###########..........',
      '............#########...........',
      '.............#######............',
      '.............#######............',
      '.............#######............',
      '.............#######............',
      '............#########...........',
      '.........###############........',
      '.......###################......',
      '....#########################...',
      '....#########################...',
      '...###########################..',
      '...###########################..',
      '..#############################.',
      '..#############################.',
      '.###############################',
      '.###############################',
    ],
    p2: [
      '................................',
      '................................',
      '................................',
      '..............#####.............',
      '.............#+++++#............',
      '............#+++++++#...........',
      '...........#+++++++++#..........',
      '...........#+++++++++#..........',
      '..........#+++++++++++#.........',
      '..........#++ee+++ee++#.........',
      '..........#+++++++++++#.........',
      '..........#+++++++++++#.........',
      '..........#+++++++++++#.........',
      '...........#++mmmmm++#..........',
      '...........#+++++++++#..........',
      '............#+++++++#...........',
      '.............#+++++#............',
      '..............#####.............',
      '................................',
      '................................',
      '...........###########..........',
      '.........##+++++++++++##........',
      '.......##+++++++++++++++##......',
      '.....##+++++++++++++++++++##....',
      '.....#+++++++++++++++++++++#....',
      '....#+++++++++++++++++++++++#...',
      '....#+++++++++++++++++++++++#...',
      '....#++++++++++++++++++++++++#..',
      '...#+++++++++++++++++++++++++#..',
      '...#+++++++++++++++++++++++++#..',
      '..#+++++++++++++++++++++++++++#.',
      '..#############################.',
    ],
  };
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  function drawPortrait(cv, key, st) {
    st = st || {};
    if (!FACE[key] && FACE[key.split(':')[0]]) key = key.split(':')[0];
    cv.classList.toggle('card', !!st.full);
    if (FACE[key]) return drawFace(cv, key, st);
    key = key.split(':')[0];
    const art = ART[key] || ART.p2, n = art.length, x = cv.getContext('2d');
    // in a card's place, the pixel art sits at twice the size inside a plain frame
    const k = st.full ? 2 : 1, ox = st.full ? 8 : 0, oy = st.full ? 14 : 0;
    cv.width = st.full ? 80 : n; cv.height = st.full ? 100 : n;
    x.fillStyle = '#000'; x.fillRect(0, 0, cv.width, cv.height);
    if (st.full) { x.strokeStyle = css('--fg'); x.lineWidth = 1; x.strokeRect(1.5, 1.5, 77, 97); x.beginPath(); x.moveTo(3, 92.5); x.lineTo(77, 92.5); x.stroke(); }
    const fg = css('--fg'), hi = css('--hi'), warn = css('--warn'), alt = css('--alt');
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      let ch = (art[r] || '')[c] || '.';
      if (key === 'archive' && ch === '#') {
        // the archive is never quite there: static where a face should be, until the end
        const q = Math.random();
        if (st.reveal && r < 18) ch = (r === 9 && (c === 13 || c === 18)) ? '*' : (r === 14 && c > 13 && c < 18) ? '#' : q < .06 ? ':' : '+';
        else ch = q < .2 ? '.' : q < .45 ? ':' : q < .75 ? '+' : q < .95 ? '#' : '*';
      }
      if (ch === 'e' && st.blink) ch = '+';
      if (ch === 'm') ch = st.talk && Math.random() < .5 ? '*' : '#';
      if (ch === '.') continue;
      x.globalAlpha = ch === ':' ? .2 : ch === '+' || ch === 'b' ? .45 : 1;
      x.fillStyle = ch === '*' || ch === 'e' ? hi : ch === 'w' ? warn : ch === 'a' || ch === 'b' ? alt : fg;
      x.fillRect(ox + c * k, oy + r * k, k, k);
    }
    x.globalAlpha = 1;
  }

  // ---- face cards. Eighty by a hundred in four greys, recoloured into whichever phosphor is up.
  // Mission, Atton, HK-47 and T3-M4 are drafts made for this page from the game's portraits. Camille is cut from
  // her own sprite sheets on the landing page, one card for each pose, and she changes pose as the game goes.
  const FACEFILE = { mission: 'mission', atton: 'atton', hk: 'hk', t3: 't3', camille: 'camille-stare' };
  ['look', 'purr', 'hiss', 'swat', 'loaf', 'blink', 'back'].forEach((p) => { FACEFILE['camille:' + p] = 'camille-' + p; });
  // the square around each face, for the small slot at the table
  const CROP = { mission: [14, 4, 52], atton: [12, 6, 56], hk: [10, 2, 58], t3: [6, 4, 66], camille: [5, 20, 70] };
  const FACE = {};
  Object.keys(FACEFILE).forEach((k) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'); c.width = 80; c.height = 100;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0);
      let d; try { d = x.getImageData(0, 0, 80, 100).data; } catch (e) { return; }
      const L = new Uint8Array(8000);
      for (let i = 0; i < 8000; i++) { const g = d[i * 4]; L[i] = g < 32 ? 0 : g < 104 ? 1 : g < 187 ? 2 : 3; }
      FACE[k] = L;
      if (k.indexOf(':') < 0) redrawPortraits();
    };
    img.src = 'faces/' + FACEFILE[k] + '.png';
  });
  const rgb = (hex) => { const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  function drawFace(cv, key, st) {
    const L = FACE[key], c0 = CROP[key.split(':')[0]];
    const [cx, cy, cw, ch] = st.full ? [0, 0, 80, 100] : [c0[0], c0[1], c0[2], c0[2]];
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    const x = cv.getContext('2d'), img = x.createImageData(cw, ch), o = img.data;
    const fg = rgb(css('--fg')), hi = rgb(css('--hi'));
    const pal = [[0, 0, 0], fg.map((v) => v * .26 | 0), fg.map((v) => v * .72 | 0), hi];
    // while they talk, a band of the transmission slips sideways. A locked signal breaks up
    const tear = st.talk ? [Math.random() * ch | 0, 2 + (Math.random() * 4 | 0), Math.random() < .5 ? -1 : 1] : null;
    for (let y = 0; y < ch; y++) {
      const dx = tear && y >= tear[0] && y < tear[0] + tear[1] ? tear[2] : 0;
      for (let xx = 0; xx < cw; xx++) {
        let v = L[(cy + y) * 80 + Math.min(79, Math.max(0, cx + xx + dx))];
        if (st.noise && Math.random() < st.noise) v = Math.random() * 4 | 0;
        const c = pal[v], i = (y * cw + xx) * 4;
        o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2]; o[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
  }

  // ============================================================
  // THE STORY. The ladder is a list scratched into the table edge, and someone scratched a sixth name out
  // ============================================================
  // a scene is a list of lines. A line is { who, t }, or { choose: [ { t, a, stakes, then: [lines] } ] }
  // a is the alignment shift: +1 toward the light, -1 toward the dark. stakes doubles the buy-in for that match
  const STORY = {
    prologue: [
      { who: 'n', t: 'Deck four of the TGGR-LINK. Somebody has bolted a pazaak table to the floor of the cargo hold, between the centrifuge and the cat\'s water bowl.' },
      { who: 'n', t: 'Five names are scratched into the edge of the table. The last one is HK-47, and it is underlined twice.' },
      { who: 'hk', t: 'Statement: A new meatbag at the table. How delightful. Work your way up the list, and perhaps I will deign to take your credits personally.' },
      { choose: [
        { t: "I'm here to play. That's all.", a: 0, then: [{ who: 'hk', t: 'Observation: That is what they all say. Shortly before they say "please".' }] },
        { t: 'Everyone deserves a fair game. Even you.', a: 1, then: [{ who: 'hk', t: 'Clarification: I do not want a fair game. I want your credits. Fairness is an organic affliction.' }] },
        { t: "Keep my credits warm, droid. I'm coming for them.", a: -1, then: [{ who: 'hk', t: 'Statement: Oh, I like this one. It will be a pleasure to empty its pockets.' }] },
      ] },
      { who: 'n', t: 'The first name on the list is CAMILLE. Camille is the ship\'s cat. She is sitting on the main deck, and she is looking at you.' },
    ],
    camille_in: [
      { who: 'n', t: 'Camille is sitting on the main deck. Not near it. On it.' },
      { who: 'camille', pose: 'blink', t: '*slow blink*' },
      { choose: [
        { t: 'Pspsps. Want to play?', a: 1, then: [{ who: 'camille', pose: 'purr', t: 'mrrp.' }, { who: 'n', t: 'She shifts exactly enough for you to take the top card. It is warm.' }] },
        { t: 'Off the deck, cat.', a: -1, then: [{ who: 'camille', pose: 'swat', t: '*holds your gaze. pushes one card off the table, slowly, with a single claw.*' }, { who: 'n', t: 'She does not move. You have lost something already and the game has not started.' }] },
        { t: 'Deal, then.', a: 0, then: [{ who: 'n', t: 'She deals with one paw. You are not sure she knows the rules. You are not sure she doesn\'t.' }] },
      ] },
    ],
    camille_out: [
      { who: 'n', t: 'Camille loses interest in the game exactly one card before she loses it. She walks across the table, scattering your board, and settles on top of a small droid\'s charging port.' },
      { who: 't3', t: 'Bweee-oo! (TRANSLATION: Not again.)' },
      { who: 'n', t: 'The droid rolls out from under her and up to the table. Its manipulator arm is already shuffling.' },
    ],
    t3_in: [
      { who: 't3', t: 'Bip-bip-bwoo. (TRANSLATION: T3-M4 has been practicing. T3-M4 has been practicing for four hundred and twelve hours.)' },
      { who: 't3', t: 'Wheee-oop. (TRANSLATION: Against the navicomputer. The navicomputer has stopped speaking to T3-M4.)' },
      { choose: [
        { t: 'Good luck, little guy.', a: 1, then: [{ who: 't3', t: 'Dweep! (TRANSLATION: T3-M4 does not need luck. T3-M4 will accept it anyway.)' }] },
        { t: "Try not to cry oil when I scrap you.", a: -1, then: [{ who: 't3', t: '...bwip. (TRANSLATION: T3-M4 will remember this. T3-M4 remembers everything.)' }] },
        { t: 'Deal.', a: 0, then: [{ who: 't3', t: 'Bwoop. (TRANSLATION: Dealing.)' }] },
      ] },
    ],
    t3_out: [
      { who: 't3', t: 'Bwoo-oo-oo. (TRANSLATION: Defeat. Logging defeat. Adding defeat to the file.)' },
      { choose: [
        { t: 'What file?', a: 0, then: [] },
      ] },
      { who: 't3', t: 'Bip. (TRANSLATION: The HK file. T3-M4 records every game HK-47 plays. Fourteen thousand and six games. HK-47 has lost one.)' },
      { choose: [
        { t: 'Who beat him?', a: 0, then: [] },
        { t: 'You spy on him? Good. Keep doing it.', a: -1, then: [{ who: 't3', t: 'Bwip. (TRANSLATION: T3-M4 prefers "archives".)' }] },
      ] },
      { who: 't3', t: 'Bweeoo. (TRANSLATION: The log is corrupted at that entry. T3-M4 did not corrupt it.)' },
      { who: 't3', t: '...bip. (TRANSLATION: T3-M4 is almost certain T3-M4 did not corrupt it.)' },
      { who: 'n', t: 'A Twi\'lek girl has been watching from the crates. She hops down, grinning.' },
    ],
    mission_in: [
      { who: 'mission', t: "Hey, not bad! You beat the droid. Everybody beats the droid. Don't let it go to your head." },
      { who: 'mission', t: "Name's Mission. Mission Vao. I've been hustling this table since before they bolted it down, and I'm still up. Mostly." },
      { choose: [
        { t: 'Nice to meet you, Mission. Friendly game?', a: 1, then: [{ who: 'mission', t: 'Friendly? Sure. Friendly with credits on it.' }] },
        { t: "A hustler. Then you won't mind doubling the pot.", a: -1, stakes: 2, then: [{ who: 'mission', t: 'Ooh, scary. Big talk from someone who just beat a droid. Fine. Double it.' }] },
        { t: "Let's see what you've got.", a: 0, then: [{ who: 'mission', t: 'Everything. I always play with everything.' }] },
      ] },
    ],
    mission_out: [
      { who: 'mission', t: "Okay. Okay! You're actually good. That's... annoying." },
      { who: 'mission', t: "Want some advice? Skip Atton. Nobody gets anything out of Atton but a bad mood." },
      { choose: [
        { t: 'And HK-47?', a: 0, then: [] },
        { t: 'Thanks, Mission. Take care of yourself.', a: 1, then: [{ who: 'mission', t: 'Ha. Somebody has to. ...Okay, fine. One more thing.' }] },
      ] },
      { who: 'mission', t: "HK doesn't lose. Atton says it's because somebody taught him to count a deck like a star chart. Atton says a lot of things." },
    ],
    atton_in: [
      { who: 'atton', t: "So you're the one working down the list. Pull up a crate." },
      { who: 'atton', t: "Don't look at me like that. I play cards, I mind my own business, and I don't ask anybody where they were twenty years ago. Good arrangement. Let's keep it." },
      { choose: [
        { t: "Everyone's got a past. I'm not here to judge.", a: 1, then: [{ who: 'atton', t: "Yeah? Then you're the first." }] },
        { t: 'Where were you twenty years ago?', a: -1, then: [{ who: 'atton', t: 'Losing at pazaak. Next question. Actually, no more questions.' }] },
        { t: 'Just deal.', a: 0, then: [{ who: 'atton', t: 'See, this is why we get along.' }] },
      ] },
    ],
    atton_out: [
      { who: 'atton', t: "Huh. You count, don't you. Not the cards. The people." },
      { who: 'atton', t: "Fine. Free tip, since you earned it. HK-47 doesn't cheat. He doesn't have to. Someone taught that droid every trick there is." },
      { choose: [
        { t: 'Who?', a: 0, then: [] },
        { t: "You're scared of him.", a: -1, then: [{ who: 'atton', t: "I'm scared of anything that calls me meatbag and means it as a compliment." }] },
      ] },
      { who: 'atton', t: "Nobody knows. Funny thing. The droid says it was its master. It just won't say who that is." },
      { who: 'atton', t: 'Ask it yourself. Count your fingers after.' },
    ],
    hk_in: [
      { who: 'hk', t: 'Statement: Ah. The meatbag has climbed the list. I confess I wagered against it. Mentally. Against myself.' },
      { who: 'hk', t: 'Query: Do you know why I play pazaak, meatbag? It is the only game on this ship where I am not permitted to shoot the loser.' },
      { choose: [
        { t: "Let's keep it that way.", a: 1, then: [{ who: 'hk', t: 'Commentary: Sadly, yes.' }] },
        { t: 'Win, and maybe I let you.', a: -1, stakes: 2, then: [{ who: 'hk', t: 'Statement: ...Oh. Oh, I do like you. Shall we double the stakes, then? Yes. We shall.' }] },
        { t: 'Deal the cards, HK.', a: 0, then: [{ who: 'hk', t: 'Statement: With pleasure, m— meatbag.' }] },
      ] },
    ],
    hk_out: [
      { who: 'hk', t: 'Statement: Impossible. Recalculating. Recalculating.' },
      { who: 'hk', t: 'Statement: Only one meatbag has ever beaten me at this table, and that meatbag—' },
      { who: 'hk', t: '...Clarification: That meatbag taught me to play. Before the memory wipe. Before you—' },
      { choose: [
        { t: 'Before I what?', a: 0, then: [{ who: 'hk', t: 'Revelation: There is a recording in the archive, master. The only game I ever lost. Play it. You will understand.' }] },
        { t: 'You called me master.', a: 1, then: [{ who: 'hk', t: 'Clarification: A malfunction. ...Possibly not a malfunction. There is a recording in the archive. Play it.' }] },
        { t: 'Say it, droid.', a: -1, then: [{ who: 'hk', t: 'Statement: As you wish, master. You were the one who beat me. You taught me every trick I used tonight. Then you had it all erased, so that one day you could lose to me honestly.' }] },
      ] },
      { who: 'n', t: 'Under HK-47\'s name there is a sixth line, scratched out so hard it went through the varnish. Your thumb finds the groove without looking.' },
    ],
    archive_in: [
      { who: 'n', t: 'T3-M4 plugs into the table. The terminal flickers. On the other side, a player assembles out of static: a face blurred out of the log, holding a hand of cards.' },
      { who: 'archive', t: '[ARCHIVE] you came back. i knew you would. i left the table set.' },
      { who: 'archive', t: "[ARCHIVE] same deck as yours. same habits. same tells. let's see which of us is better at being you." },
      { choose: [
        { t: "I'm not you anymore.", a: 1, then: [{ who: 'archive', t: '[ARCHIVE] then prove it.' }] },
        { t: "Then I'm taking back what's mine.", a: -1, then: [{ who: 'archive', t: "[ARCHIVE] that's my line." }] },
      ] },
    ],
    end_light: [
      { who: 'n', t: 'The recording stops. For one frame, before it goes, the blur lifts off its face.' },
      { who: 'n', pt: 'archive', t: 'It is your face. Younger. It looks relieved.', reveal: true },
      { who: 'hk', t: 'Statement: You won it fairly, master. Twice now. ...I will continue to call you meatbag. I find that I prefer it.' },
      { who: 'n', t: 'Camille climbs into your lap and goes to sleep on your hand of cards. That is the closest thing to an ending this ship has.' },
      { who: 'n', t: 'THE LONG TABLE · END OF TRANSMISSION. The table stays open. It always does.' },
    ],
    end_dark: [
      { who: 'n', t: 'The recording stops. For one frame, before it goes, the blur lifts off its face.' },
      { who: 'n', pt: 'archive', t: 'It is your face. Younger. It is smiling, and you remember why.', reveal: true },
      { who: 'hk', t: 'Statement: Welcome back, master. Shall we find some new meatbags? I have kept a list.' },
      { who: 'n', t: 'The table is yours again. So is the droid. Camille leaves the hold and does not come back for an hour.' },
      { who: 'n', t: 'THE LONG TABLE · END OF TRANSMISSION. The table stays open. It always does.' },
    ],
  };
  const WHO = (k) => k === 'n' ? null : OPP[k] || null;

  // ============================================================
  // CARDS ON SCREEN
  // ============================================================
  const typeOf = (name) => { const i = E.cardInfo(name); return i ? i.type : 'main'; };
  const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
  // a card. what: { name } for a side card in hand, { v } for a main deck card, { card } for one on a board, { down } for a back
  function cardEl(what) {
    const el = document.createElement('div');
    el.className = 'pc';
    let type = 'main', big = '', corner = '', top = '', bot = '', pips = 0;
    if (what.card && what.card.kind === 'side') what = { name: what.card.name, v: what.card.v, onBoard: true, tie: what.card.tie };
    else if (what.card) what = { v: what.card.v };
    if (what.name) {
      const info = E.cardInfo(what.name) || { type: 'gold', label: what.name };
      type = info.type; corner = info.label;
      big = what.onBoard && !/&/.test(what.name) ? signed(what.v) : info.label.replace('-', '−');
      if (type === 'plus') top = '▲ ▲ ▲';
      else if (type === 'minus') bot = '▼ ▼ ▼';
      else { top = type === 'gold' ? '◆' : '+'; bot = type === 'gold' ? '◆' : '−'; }
      el.classList.add('side');
      if (!what.onBoard) corner = '';
    } else if (what.v !== undefined) {
      big = what.v < 0 ? signed(what.v) : String(what.v); pips = Math.min(10, Math.abs(what.v));
    }
    el.classList.add('t-' + type);
    if (what.down) el.classList.add('down');
    el.dataset.v = what.v !== undefined ? what.v : '';
    el.innerHTML = '<div class="in"><div class="face">' +
      (top ? '<span class="sg t">' + top + '</span>' : '') +
      '<span class="v' + (big.length > 3 ? ' long' : '') + '">' + esc(big) + '</span>' +
      (corner ? '<span class="k">' + esc(corner) + '</span>' : '') +
      (bot ? '<span class="sg b">' + bot + '</span>' : '') +
      (pips ? '<span class="pips">' + Array.from({ length: 10 }, (_, i) => '<i' + (i < pips ? '' : ' class="off"') + '></i>').join('') + '</span>' : '') +
      '<i class="foil"></i></div><div class="bk"></div></div>';
    return el;
  }
  function setCardValue(el, v, side) {
    el.dataset.v = v;
    const t = $('.v', el); t.textContent = side ? signed(v) : (v < 0 ? signed(v) : String(v));
    $$('.pips i', el).forEach((p, i) => p.classList.toggle('off', i >= Math.abs(v)));
  }

  // a card under the pointer tilts toward it, and its foil catches the light
  const tiltSel = '.hand .pc, .coll .pc, .shop .pc, .fan .pc, .deckview .pc, .rules .pc';
  document.addEventListener('pointermove', (e) => {
    if (!S.set.tilt || !S.set.motion || e.pointerType === 'touch') return;
    const el = e.target.closest && e.target.closest(tiltSel);
    $$('.pc.live').forEach((c) => { if (c !== el) untilt(c); });
    if (!el) return;
    const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    tilt(el, px, py);
  }, { passive: true });
  function tilt(el, px, py) {
    el.classList.add('live');
    $('.in', el).style.transform = 'rotateY(' + ((px - .5) * 26).toFixed(1) + 'deg) rotateX(' + ((.5 - py) * 22).toFixed(1) + 'deg)';
    el.style.setProperty('--gx', (px * 100).toFixed(0) + '%');
  }
  function untilt(c) { c.classList.remove('live'); const i = $('.in', c); if (i) i.style.transform = ''; }
  // on a phone, the hand follows the phone
  let gyroOn = false;
  function gyro(e) {
    if (!S.set.tilt || !S.set.motion || e.gamma === null) return;
    const px = Math.max(0, Math.min(1, .5 + e.gamma / 50)), py = Math.max(0, Math.min(1, .5 + (e.beta - 40) / 60));
    $$('.hand .pc.side, .fan .pc').forEach((c) => { $('.in', c).style.transform = 'rotateY(' + ((px - .5) * 22).toFixed(1) + 'deg) rotateX(' + ((.5 - py) * 18).toFixed(1) + 'deg)'; c.style.setProperty('--gx', (px * 100).toFixed(0) + '%'); });
  }
  function startGyro() {
    if (gyroOn || !window.DeviceOrientationEvent || !matchMedia('(pointer: coarse)').matches) return;
    const go = () => { gyroOn = true; addEventListener('deviceorientation', gyro, { passive: true }); };
    if (typeof DeviceOrientationEvent.requestPermission === 'function') DeviceOrientationEvent.requestPermission().then((p) => { if (p === 'granted') go(); }).catch(() => {});
    else go();
  }

  // ============================================================
  // SCREENS, THEME, SOUND
  // ============================================================
  let screen = 'boot';
  function show(id, now) {
    if (!now && screen === 'table' && id !== 'table' && S.set.motion) {
      const a = $('#app'); a.classList.add('poweroff'); sfx('glitch');
      setTimeout(() => { a.classList.remove('poweroff'); show(id, true); }, 330);
      return;
    }
    screen = id;
    // a callout, a recap or a card's readout does not follow you to another screen
    if (coachNow) coachNow.close();
    if (recapNow) recapNow.end(false);
    hideTip();
    $$('.scr').forEach((s) => { const on = s.id === 's-' + id; s.hidden = !on; s.classList.toggle('on', on); });
    $('#b-menu').hidden = id === 'menu' || id === 'boot';
    if (id !== 'table') { $('#drawer').classList.remove('open'); }
    window.scrollTo(0, 0);
    sfx('whoosh');
    if (RENDER[id]) RENDER[id]();
    if (id === 'table') requestAnimationFrame(fit);
  }
  // the table grows its cards until it fills the screen. One size is searched for and measured, not guessed
  const wide = () => matchMedia('(min-width: 900px) and (min-height: 600px)').matches;
  function fit() {
    if (screen !== 'table') return;
    const t = $('#s-table'), kids = Array.from(t.children);
    const room = (window.visualViewport ? visualViewport.height : innerHeight) - 10 - (parseFloat(getComputedStyle($('#app')).paddingBottom) || 0);
    const set = (k) => { t.style.setProperty('--kc', k + 'px'); t.style.setProperty('--kh', (k * 1.22) + 'px'); };
    // layout sizes, not the box on screen: the screen may still be mid power-on, squashed flat
    const bottom = () => Math.max(...kids.map((c) => { let y = c.offsetHeight, e = c; while (e) { y += e.offsetTop; e = e.offsetParent; } return y; }));
    let lo = 28, hi = 140;
    for (let n = 0; n < 9; n++) { const k = (lo + hi) / 2; set(k); if (bottom() <= room) lo = k; else hi = k; }
    set(lo);
    paintOpp({});
    if (coachNow) coachNow.place();
    if (recapNow) recapNow.place();
  }
  let fitT = 0;
  const refit = () => { clearTimeout(fitT); fitT = setTimeout(fit, 80); };
  addEventListener('resize', refit);
  if (window.visualViewport) visualViewport.addEventListener('resize', refit);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
  function setTheme(t, save) {
    t = t === 'green' ? 'green' : 'amber';
    document.documentElement.dataset.theme = t;
    $('meta[name="theme-color"]').content = t === 'green' ? '#030604' : '#060402';
    $('#b-theme').textContent = t;
    if (save) store.set('phosphor-v2', t);
    // the light has to match the tube
    fx('setColors', { fg: css('--fg'), hi: css('--hi'), warn: css('--warn'), alt: css('--alt') });
    redrawPortraits();
  }
  function degauss() {
    if (!S.set.motion) return;
    const a = $('#app'); a.classList.remove('degauss'); void a.offsetWidth; a.classList.add('degauss');
    setTimeout(() => a.classList.remove('degauss'), 1300);
  }
  function setMotion(on) {
    S.set.motion = on; save();
    document.documentElement.classList.toggle('still', !on);
    fx('setReduced', !on); fx('ambient', on);
  }
  function soundLabel() { const on = window.PazaakSfx && PazaakSfx.on; $('#b-sound').textContent = 'snd ' + (on ? 'on' : 'off'); $('#b-sound').setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function toggleSound() {
    if (!window.PazaakSfx) return;
    const on = PazaakSfx.set(!PazaakSfx.on);
    if (on) { PazaakSfx.unlock(); sfx('boot'); if (S.set.hum) PazaakSfx.hum(true); }
    soundLabel();
  }
  let crShown = null;
  function credits(delta) {
    if (delta) { S.credits = Math.max(0, S.credits + delta); if (delta > 0) S.stats.earned += delta; save(); }
    const el = $('#cr'), to = S.credits;
    if (crShown === null || !S.set.motion) { crShown = to; el.textContent = to; return; }
    // the number rolls, the way the old banking terminals did
    const from = crShown, t0 = performance.now(), dur = Math.min(1400, 300 + Math.abs(to - from) * 2);
    crShown = to;
    if (from !== to) { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); sfx('coin'); }
    (function step(now) { const k = Math.min(1, (now - t0) / dur); el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
    if (S.credits >= 3000) unlock('rich');
  }

  // ---- toasts, achievements
  function toast(title, text) {
    const t = document.createElement('div'); t.className = 'toast';
    t.innerHTML = '<b>' + esc(title) + '</b>' + (text ? esc(text) : '');
    $('#toasts').appendChild(t); setTimeout(() => t.remove(), 3700);
  }
  const ACH = {
    first: ['FIRST HAND', 'Win a match.'],
    pure: ['PURE PAZAAK', 'Land on exactly twenty.'],
    nine: ['FULL BOARD', 'Win a set with nine cards on your side.'],
    flawless: ['FLAWLESS', 'Win a match three sets to none.'],
    comeback: ['COMEBACK', 'Win a match after falling behind two sets to none.'],
    tiebreak: ['TIEBREAKER', 'Win a set on the tiebreaker card.'],
    nerve: ['NERVES OF STEEL', 'Stand on fifteen or less, and win the set.'],
    cat: ['OUTWITTED BY A CAT', 'Lose a match to Camille.'],
    meatbag: ['MEATBAG NO MORE', 'Beat HK-47.'],
    story: ['THE LONG TABLE', 'Learn who scratched out the sixth name.'],
    light: ['PEACEKEEPER', 'Lean all the way toward the light.'],
    dark: ['SHADOW AT THE TABLE', 'Lean all the way toward the dark.'],
    gold: ['GOLDEN HAND', 'Own a gold card.'],
    rich: ['HIGH ROLLER', 'Hold three thousand credits.'],
    spect: ['SPECTACULAR FAILURE', 'Bust three sets in one match.'],
    daily: ['TRANSMISSION RECEIVED', 'Win a daily transmission.'],
    streak: ['ON A ROLL', 'Win five matches in a row.'],
    collector: ['COLLECTOR', 'Own one of every side card there is.'],
    hotseat: ['SHARED SCREEN', 'Finish a hotseat match.'],
  };
  function unlock(k) {
    if (S.ach[k] || !ACH[k]) return;
    S.ach[k] = Date.now(); save();
    toast('COMMENDATION · ' + ACH[k][0], ACH[k][1]);
    sfx('setWin');
  }
  function shiftAlign(a) {
    if (!a) return;
    S.align = Math.max(-10, Math.min(10, S.align + a)); save();
    toast(a > 0 ? 'LIGHT SIDE' : 'DARK SIDE', a > 0 ? 'Your choice leans toward the light.' : 'Your choice leans toward the dark.');
    if (S.align >= 5) unlock('light');
    if (S.align <= -5) unlock('dark');
  }

  // ============================================================
  // DIALOGUE. A comm panel: a face, a voice, a few things you could say
  // ============================================================
  let talking = null;
  function scene(lines) {
    return new Promise((done) => {
      const ov = document.createElement('div'); ov.className = 'ov';
      ov.innerHTML = '<div class="panel" role="dialog" aria-live="polite" style="width:min(560px,100%)"><div style="display:flex;gap:12px;align-items:flex-start"><canvas class="portrait" width="32" height="32"></canvas><div style="flex:1;min-width:0"><p class="nm" style="margin:0 0 4px;font-size:12px;color:var(--dim);letter-spacing:1px"></p><p class="tx" style="margin:0;min-height:4.5em"></p></div></div><div class="row"></div></div>';
      $('#ovs').appendChild(ov);
      const pt = $('canvas', ov), nm = $('.nm', ov), tx = $('.tx', ov), row = $('.row', ov);
      let queue = lines.slice(), typing = null, stakes = 1;
      function next() {
        const L = queue.shift();
        if (!L) { ov.remove(); document.removeEventListener('keydown', key); done({ stakes }); return; }
        row.innerHTML = '';
        if (L.choose) {
          L.choose.forEach((c, i) => {
            const b = document.createElement('button'); b.className = 'btn'; b.type = 'button'; b.style.textAlign = 'left'; b.style.width = '100%';
            b.textContent = (i + 1) + '. ' + c.t;
            b.onclick = () => { shiftAlign(c.a || 0); if (c.stakes) stakes = c.stakes; queue = (c.then || []).concat(queue); sfx('select'); next(); };
            row.appendChild(b);
          });
          row.style.flexDirection = 'column';
          b0().focus();
          return;
        }
        row.style.flexDirection = '';
        const who = WHO(L.who);
        pt.style.display = who || L.pt ? '' : 'none';
        nm.textContent = who ? who.name : 'THE TERMINAL';
        tx.style.color = who ? '' : 'var(--dim)';
        const face = L.who + (L.pose ? ':' + L.pose : '');
        if (who) { drawPortrait(pt, face, { reveal: L.reveal, full: true }); sfx(who.voice); }
        else if (L.pt) drawPortrait(pt, L.pt, { reveal: L.reveal, full: true });
        if (L.reveal) { fx('flash', { color: 'hi', alpha: .5 }); fx('scan', {}); }
        const btn = document.createElement('button'); btn.className = 'btn pri'; btn.type = 'button'; btn.textContent = queue.length ? 'continue ›' : 'done';
        btn.onclick = () => { if (typing) { finish(); return; } next(); };
        row.appendChild(btn);
        type(L.t, who ? face : null);
        btn.focus();
      }
      const b0 = () => $('button', row);
      function type(t, key) {
        let i = 0; tx.textContent = '';
        if (!S.set.motion) { tx.textContent = t; return; }
        pt.classList.add('talk');
        typing = setInterval(() => {
          i += 2; tx.textContent = t.slice(0, i);
          if (key && i % 6 === 0) drawPortrait(pt, key, { talk: true, full: true });
          if (i >= t.length) finish();
        }, 18);
        function finishNow() { clearInterval(typing); typing = null; tx.textContent = t; pt.classList.remove('talk'); if (key) drawPortrait(pt, key, { full: true }); }
        finish = finishNow;
      }
      let finish = () => {};
      function key(e) {
        if (/^[1-9]$/.test(e.key)) { const b = $$('button', row)[+e.key - 1]; if (b && row.style.flexDirection === 'column') { e.preventDefault(); b.click(); } }
        else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const b = b0(); if (b) b.click(); }
      }
      document.addEventListener('keydown', key);
      ov.addEventListener('click', (e) => { if (e.target === ov && typing) finish(); });
      next();
    });
  }

  // ============================================================
  // THE TABLE
  // ============================================================
  let G = null;           // the match: { cfg, m }
  let busy = false, sel = -1, shownSeat = 0;
  const human = (seat) => !!G && G.cfg.seats[seat] === 'human';
  const oppKey = () => G.cfg.opp;
  const O = () => G.cfg.mode === 'hotseat' ? P2 : OPP[G.cfg.opp];
  const seatName = (seat) => G.cfg.mode === 'hotseat' ? 'PLAYER ' + (seat + 1) : seat === 0 ? 'YOU' : O().name;
  const verb = (seat, he, you) => seatName(seat) === 'YOU' ? you : he;
  const speed = () => (S.set.fast ? .5 : 1) * (S.set.motion ? 1 : .6);
  const pause = (ms) => wait(ms * speed());
  const saveMatch = () => { if (G && G.m.phase !== 'matchOver') store.set('pazaak-match', G); else store.del('pazaak-match'); };

  // what Camille does while she says it
  const CAMPOSE = { think: 'look', aiTwenty: 'purr', aiBust: 'swat', youTwenty: 'hiss', youBust: 'swat', aiStand: 'loaf', setWin: 'blink', setLose: 'hiss', matchWin: 'loaf', matchLose: 'back', play: 'swat' };
  let camPose = null, camTimer = 0;
  function pose(p, ms) {
    clearTimeout(camTimer); camPose = p || null; paintOpp({});
    if (p) camTimer = setTimeout(() => { camPose = null; if (!$('#opp-pt').classList.contains('talk')) paintOpp({}); }, ms || 2600);
  }
  const oppFace = () => !G ? 'p2' : G.cfg.mode === 'hotseat' ? 'p2' : G.cfg.opp === 'camille' && camPose ? 'camille:' + camPose : G.cfg.opp;
  const paintOpp = (st) => { if (G) drawPortrait($('#opp-pt'), oppFace(), Object.assign({ full: wide() }, st)); };
  function quip(kind, chance) {
    if (!G || G.cfg.mode === 'hotseat') return;
    const o = O(), lines = o.q[kind];
    if (!lines || Math.random() > (chance === undefined ? 1 : chance)) return;
    if (G.cfg.opp === 'camille') pose(CAMPOSE[kind], kind === 'matchLose' ? 8000 : 2600);
    say(pick(lines));
  }
  let sayTimer = 0;
  function say(t) {
    const el = $('#say'), pt = $('#opp-pt');
    clearInterval(sayTimer);
    let i = 0; el.textContent = '';
    if (G.cfg.mode !== 'hotseat') sfx(O().voice);
    pt.classList.add('talk');
    if (!S.set.motion) { el.textContent = t; pt.classList.remove('talk'); return; }
    sayTimer = setInterval(() => {
      i += 2; el.textContent = t.slice(0, i);
      paintOpp({ talk: true });
      if (i >= t.length) { clearInterval(sayTimer); pt.classList.remove('talk'); paintOpp({}); }
    }, 22);
    log(G.cfg.mode === 'hotseat' ? t : O().name + ': ' + t, 'o');
  }
  // now and then the cat blinks, the others' signal slips, and the archive never holds still
  setInterval(() => {
    if (screen !== 'table' || !G || $('#opp-pt').classList.contains('talk')) return;
    const key = oppFace();
    if (key === 'archive') { paintOpp({}); return; }
    if (key === 'camille' && Math.random() < .03) { pose('blink', 260); return; }
    if (Math.random() < .03) { paintOpp({ talk: true, blink: true }); setTimeout(() => paintOpp({}), 110); }
  }, 120);

  function log(t, cls) {
    const l = $('#log'), d = document.createElement('span');
    d.className = cls || ''; d.textContent = t + '\n'; l.appendChild(d);
    while (l.childNodes.length > 400) l.removeChild(l.firstChild);
    l.scrollTop = l.scrollHeight;
  }
  // the status line is a prompt: new text types itself in, and the cursor stays
  let statusNow = '';
  function status(html) {
    if (html === statusNow) return;
    statusNow = html;
    $('#status').innerHTML = html ? '<span class="pr">&gt;</span><span class="tx' + (S.set.motion ? ' new' : '') + '">' + html + '</span><span class="cur"></span>' : '';
  }
  // under each board, the last thing that happened there
  function lastAct(seat, text) {
    const el = $('#last-' + seat); el.textContent = text; el.classList.remove('new');
    if (S.set.motion && text) { void el.offsetWidth; el.classList.add('new'); }
  }
  // when one side stands, the other is told what it has to beat; and the cards the opponent has left
  function targets() {
    if (!G) return;
    const m = G.m;
    for (let s = 0; s < 2; s++) {
      const o = 1 - s, ot = E.total(m, o), on = m.phase === 'turn' && m.standing[o] && !m.standing[s] && ot <= 20;
      $('#tgt-' + s).textContent = on ? (ot >= 20 ? 'NEED 20' : 'BEAT ' + ot) : '';
    }
    $('.arena').classList.toggle('live', m.phase === 'turn');
    const left = m.hands[1 - shownSeat].filter(Boolean).length;
    $('#ohand-n').textContent = left + (left === 1 ? ' card' : ' cards') + ' left';
  }

  // ---- building the table from the match state, all at once (on entering, resuming, after a set)
  function renderTable() {
    const m = G.m, hot = G.cfg.mode === 'hotseat';
    $('#opp-name').textContent = hot ? 'PLAYER ' + (2 - shownSeat) : O().name;
    $('#opp-title').textContent = hot ? 'waiting for the device' : O().title;
    paintOpp({});
    for (let s = 0; s < 2; s++) {
      $('#who-' + s).textContent = seatName(s) + (hot && s === shownSeat ? ' · YOU' : '');
      const b = $('#board-' + s); b.innerHTML = '';
      for (let i = 0; i < 9; i++) { const sl = document.createElement('div'); sl.className = 'slot'; b.appendChild(sl); }
      m.boards[s].forEach((c, i) => { const el = cardEl({ card: c }); el.dataset.id = c.id; b.children[i].appendChild(el); });
      $('#side-' + s).classList.toggle('standing', !!m.standing[s] && E.total(m, s) <= 20);
      $('#side-' + s).classList.remove('busted');
      $('#lock-' + s).textContent = 'STAND';
      setTotal(s, false);
    }
    pips();
    $('#set-n').textContent = m.set || 1;
    deckCount(m.deck.length);
    renderHands();
    controls();
    requestAnimationFrame(fit);
  }
  function deckCount(n) {
    const d = $('#deck');
    if (!d.querySelector('.pc')) for (let i = 0; i < 3; i++) d.insertBefore(cardEl({ down: true }), d.firstChild);
    $('#deck-n').textContent = n; d.classList.toggle('empty', n === 0);
  }
  function pips() {
    for (let s = 0; s < 2; s++) {
      const p = $('#pips-' + s); p.innerHTML = '';
      for (let i = 0; i < G.m.setsToWin; i++) { const d = document.createElement('i'); if (i < G.m.score[s]) d.className = 'on'; p.appendChild(d); }
    }
  }
  function boardTotal(s) { return $$('#board-' + s + ' .pc').reduce((a, c) => a + (+c.dataset.v || 0), 0); }
  const roll = {};
  function setTotal(s, anim) {
    const t = boardTotal(s), el = $('#tot-' + s);
    clearInterval(roll[s]);
    el.classList.remove('pv', 'bad', 'pure');
    el.dataset.t = t;
    el.classList.toggle('twenty', t === 20);
    el.classList.toggle('over', t > 20);
    if (anim && S.set.motion) {
      // like a counter on an old readout: a few wrong numbers first
      let n = 0;
      roll[s] = setInterval(() => { n++; el.textContent = n > 4 ? t : Math.random() * 30 | 0; if (n > 4) clearInterval(roll[s]); }, 34);
      el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
    } else el.textContent = t;
  }
  function preview(after) {
    const el = $('#tot-' + shownSeat);
    if (after === null || after === undefined) { if (el.classList.contains('pv')) { el.classList.remove('pv', 'bad', 'pure'); el.textContent = el.dataset.t; } return; }
    clearInterval(roll[shownSeat]);
    el.textContent = after; el.classList.add('pv'); el.classList.toggle('bad', after > 20); el.classList.toggle('pure', after === 20);
  }
  // the hand at the bottom belongs to whoever is holding the device; the other hand is face down at the top
  function renderHands() {
    const m = G.m, me = shownSeat, them = 1 - me, h = $('#hand');
    h.innerHTML = '';
    m.hands[me].forEach((name, i) => {
      const sl = document.createElement('div'); sl.className = 'slotc';
      if (!name) sl.classList.add('gone');
      else {
        const c = cardEl({ name }); c.tabIndex = 0; c.setAttribute('role', 'button');
        c.setAttribute('aria-label', 'side card ' + name + ', key ' + (i + 1));
        c.dataset.i = i;
        c.addEventListener('pointerdown', (e) => grab(e, i, c));
        c.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && !drag) hover(e, i, c); });
        c.addEventListener('pointerleave', () => { if (drag) return; if (sel !== i) unzone(c); preview(null); });
        c.addEventListener('click', (e) => tapCard(e, i, c));
        c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); choose(i); } });
        sl.appendChild(c);
      }
      h.appendChild(sl);
    });
    const oh = $('#ohand'); oh.innerHTML = '';
    m.hands[them].forEach((name) => { if (name) oh.appendChild(cardEl({ down: true })); else { const g = document.createElement('div'); g.className = 'gap'; oh.appendChild(g); } });
    sel = -1; choices(); targets();
  }
  const playsFor = (i) => myTurn() && !G.m.played[shownSeat] && G.m.boards[shownSeat].length < 9 ? E.legalPlays(G.m, shownSeat).filter((p) => p.handIndex === i).sort((a, b) => (b.choice || 0) - (a.choice || 0)) : [];
  const playLabel = (p) => p.choice === null || p.choice === undefined ? p.label : signed(p.choice);
  // laid over the card itself, one band for each way to play it: plus on top, minus below
  function zone(c, plays, on) {
    let z = $('.pz', c);
    if (!z) { z = document.createElement('div'); z.className = 'pz'; c.appendChild(z); }
    // a finger already has the totals in the row above; a pointer gets them on the card
    z.innerHTML = plays.map((p, k) => '<i class="' + (k === on ? 'on' : '') + (p.after > 20 ? ' bad' : '') + '">' + esc(playLabel(p)) + (ptr === 'mouse' ? '<small>→ ' + p.after + '</small>' : '') + '</i>').join('');
  }
  function unzone(c) { const z = $('.pz', c); if (z) z.remove(); }
  const zoneAt = (el, y, n) => { const r = el.getBoundingClientRect(); return Math.max(0, Math.min(n - 1, Math.floor((y - r.top) / r.height * n))); };
  function hover(e, i, c) {
    const plays = playsFor(i); if (!plays.length) return;
    const k = zoneAt(c, e.clientY, plays.length);
    zone(c, plays, k); preview(plays[k].after);
  }
  let drag = null, dragged = false, ptr = 'mouse', dropAt = null;
  function tapCard(e, i, c) {
    if (dragged) { dragged = false; return; }
    const plays = playsFor(i);
    if (!plays.length) { sfx('error'); return; }
    const k = zoneAt(c, e.clientY, plays.length);
    // a mouse plays what it points at. A finger picks the card first, then touches the half it wants
    if (ptr === 'mouse' || sel === i) { humanAct({ type: 'play', handIndex: i, choice: plays[k].choice }); return; }
    sel = i; sfx('select'); choices();
  }
  function grab(e, i, c) {
    ptr = e.pointerType || 'mouse'; dragged = false;
    if (e.button > 0 || !playsFor(i).length) return;
    const x0 = e.clientX, y0 = e.clientY;
    const move = (ev) => {
      if (!drag) { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 10) return; drag = lift(i, c); }
      carry(ev);
    };
    const up = (ev) => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      if (drag) { dragged = true; drop(ev); }
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function lift(i, c) {
    const plays = playsFor(i), ghost = cardEl({ name: G.m.hands[shownSeat][i] });
    ghost.classList.add('drag'); ghost.style.setProperty('--w', c.getBoundingClientRect().width + 'px');
    document.body.appendChild(ghost);
    c.classList.add('lift'); unzone(c); sel = -1; choices();
    const bands = document.createElement('div'); bands.className = 'bands';
    bands.innerHTML = plays.map((p) => '<i class="' + (p.after > 20 ? 'bad' : '') + '">' + esc(playLabel(p)) + '<small>→ ' + p.after + '</small></i>').join('');
    $('#side-' + shownSeat).appendChild(bands);
    sfx('select');
    return { i, c, plays, ghost, bands, k: -1 };
  }
  function carry(ev) {
    const d = drag;
    d.ghost.style.left = ev.clientX + 'px'; d.ghost.style.top = ev.clientY + 'px';
    const r = d.bands.getBoundingClientRect(), inside = ev.clientX > r.left - 24 && ev.clientX < r.right + 24 && ev.clientY > r.top - 40 && ev.clientY < r.bottom + 24;
    const k = inside ? zoneAt(d.bands, ev.clientY, d.plays.length) : -1;
    if (k === d.k) return;
    d.k = k;
    $$('i', d.bands).forEach((b, j) => b.classList.toggle('on', j === k));
    preview(k >= 0 ? d.plays[k].after : null);
    if (k >= 0) sfx('tick');
  }
  function drop(ev) {
    const d = drag; drag = null;
    d.bands.remove(); preview(null);
    if (d.k >= 0 && myTurn()) {
      dropAt = { x: ev.clientX, y: ev.clientY, w: d.ghost.getBoundingClientRect().width };
      d.ghost.remove();
      humanAct({ type: 'play', handIndex: d.i, choice: d.plays[d.k].choice });
      return;
    }
    // not on the board: back to the hand
    const home = center(d.c), done = () => { d.ghost.remove(); d.c.classList.remove('lift'); };
    if (!S.set.motion) return done();
    d.ghost.animate([{ left: ev.clientX + 'px', top: ev.clientY + 'px' }, { left: home.x + 'px', top: home.y + 'px' }], { duration: 180, easing: 'ease-out' }).onfinish = done;
  }
  const myTurn = () => G && G.m.phase === 'turn' && G.m.turn === shownSeat && human(shownSeat) && !busy;
  function controls() {
    const m = G.m, mine = myTurn();
    $('#b-end').disabled = !mine; $('#b-stand').disabled = !mine;
    const over = mine && E.total(m, shownSeat) > 20;
    $('#b-end').classList.toggle('warn', over); $('#b-stand').classList.toggle('warn', over);
    $('#hand').classList.toggle('off', !mine || m.played[shownSeat] || m.boards[shownSeat].length >= 9);
    for (let s = 0; s < 2; s++) $('#side-' + s).classList.toggle('act', m.phase === 'turn' && m.turn === s);
    if (mine) {
      const t = E.total(m, shownSeat);
      status(t > 20 ? '<span class="warn-t">OVER TWENTY.</span> PLAY A CARD OR BUST' : (G.cfg.mode === 'hotseat' ? 'PLAYER ' + (shownSeat + 1) + ' · ' : '') + 'YOUR TURN' + (m.standing[1 - shownSeat] ? ' · ' + seatName(1 - shownSeat) + ' STANDS ON ' + E.total(m, 1 - shownSeat) : ''));
    }
    advisor();
    targets();
  }
  // the advisor shares the row above the hand with the card choices: it speaks while no card is picked
  function advisor() { $('#b-adv').setAttribute('aria-pressed', S.set.advisor ? 'true' : 'false'); choices(); }
  function advisorHTML() {
    const m = G.m, s = shownSeat, adv = E.advise(m, s), counts = E.deckCounts(m), t = E.total(m, s), max = Math.max(1, ...counts.slice(1));
    const risk = Math.round((adv.bustRisk || 0) * 100), sug = { stand: 'STAND', end: 'END TURN', play: adv.bestPlay ? 'PLAY ' + (adv.bestPlay.choice === null || adv.bestPlay.choice === undefined ? adv.bestPlay.label : signed(adv.bestPlay.choice)) : 'PLAY' }[adv.suggestion] || '';
    return '<div class="advisor"><span>T3</span><span>bust <b class="risk' + (risk >= 40 ? ' bad' : '') + '">' + risk + '%</b></span>' +
      '<span class="hist" title="cards left in the main deck, 1 to 10. red ones bust you">' + counts.slice(1).map((n, i) => '<i style="height:' + (2 + 20 * n / max).toFixed(0) + 'px"' + (t + i + 1 > 20 ? ' class="bust"' : '') + '></i>').join('') + '</span>' +
      '<span>→ <b class="why">' + esc(adv.reason || sug) + '</b><b class="sug">' + esc(sug) + '</b></span></div>';
  }
  // picking a side card: the choices it offers appear above the hand, each with the total it would make
  function choose(i) {
    if (!myTurn() || G.m.played[shownSeat]) { sfx('error'); return; }
    if (sel === i) { sel = -1; choices(); return; }
    sel = i; sfx('select'); choices();
  }
  function choices() {
    const box = $('#choices'); box.innerHTML = '';
    $$('#hand .pc').forEach((c) => { const on = +c.dataset.i === sel; c.classList.toggle('sel', on); if (on) zone(c, playsFor(sel), -1); else if (!c.matches(':hover')) unzone(c); });
    if (sel < 0 || !G) {
      if (!G || !myTurn()) return;
      if (S.set.advisor && G.cfg.mode !== 'daily') box.innerHTML = advisorHTML();
      else if (!G.m.played[shownSeat] && G.m.hands[shownSeat].some(Boolean)) box.innerHTML = '<span class="hint">' + (matchMedia('(pointer: coarse)').matches ? 'tap a card, then the half you want · or drag it onto your board' : 'click the half of a card you want · drag it · or keys 1–4') + '</span>';
      return;
    }
    const plays = E.legalPlays(G.m, shownSeat).filter((p) => p.handIndex === sel);
    plays.forEach((p) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn' + (p.after === 20 ? ' twenty' : p.after > 20 ? ' bad' : '');
      b.innerHTML = '<b>' + esc(playLabel(p)) + '</b> → ' + p.after;
      b.onclick = () => humanAct({ type: 'play', handIndex: p.handIndex, choice: p.choice });
      box.appendChild(b);
    });
  }

  // ---- moving cards: a card is placed where it ends up, then flown in from where it started
  function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }
  function fly(el, from, opts) {
    opts = opts || {};
    const to = center(el), dur = (opts.dur || 420) * speed();
    if (!S.set.motion) return Promise.resolve();
    el.style.zIndex = 20;
    const k = from.w / to.w, rot = opts.rot || (Math.random() * 30 - 15);
    const a = el.animate([
      { transform: 'translate(' + (from.x - to.x) + 'px,' + (from.y - to.y) + 'px) scale(' + k + ') rotate(' + rot + 'deg)' },
      { transform: 'translate(0,-6px) scale(1.12) rotate(0deg)', offset: .78 },
      { transform: 'none' },
    ], { duration: dur, easing: 'cubic-bezier(.2,.8,.3,1)' });
    if (opts.flipFrom) $('.in', el).animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0)' }], { duration: dur * .8, easing: 'ease-out' });
    fx('trail', from.x, from.y, to.x, to.y, { color: opts.color || 'fg', life: dur * .9 });
    return new Promise((r) => { a.onfinish = () => { el.style.zIndex = ''; r(); }; a.oncancel = r; });
  }
  async function flipCard(el, to) {
    const side = el.classList.contains('side');
    if (!S.set.motion) { setCardValue(el, to, side); return; }
    const inn = $('.in', el);
    await inn.animate([{ transform: 'rotateY(0)' }, { transform: 'rotateY(90deg)' }], { duration: 160 * speed(), easing: 'ease-in' }).finished;
    setCardValue(el, to, side);
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
    await inn.animate([{ transform: 'rotateY(-90deg)' }, { transform: 'rotateY(0)' }], { duration: 160 * speed(), easing: 'ease-out' }).finished;
  }
  function shake() { if (!S.set.motion) return; const a = $('#app'); a.classList.remove('shake'); void a.offsetWidth; a.classList.add('shake'); setTimeout(() => a.classList.remove('shake'), 500); }
  const colorFor = (type) => type === 'plus' ? 'alt' : type === 'minus' ? 'warn' : type === 'gold' ? '#ffd36b' : 'hi';

  // ---- one event at a time, each with its own small show
  async function play(ev) {
    const m = G.m;
    switch (ev.type) {
      case 'setStart': {
        // last set's cards sweep off the table
        const old = $$('#board-0 .pc, #board-1 .pc');
        if (old.length && S.set.motion) { await Promise.all(old.map((c, i) => c.animate([{ transform: 'none', opacity: 1 }, { transform: 'translate(' + (c.closest('#board-0') ? -60 : 60) + 'px, 30px) rotate(' + (Math.random() * 40 - 20) + 'deg)', opacity: 0 }], { duration: 300 * speed(), delay: i * 20, fill: 'forwards' }).finished)); }
        for (let s = 0; s < 2; s++) { $$('#board-' + s + ' .pc').forEach((c) => c.remove()); $('#side-' + s).classList.remove('standing', 'busted'); $('#lock-' + s).textContent = 'STAND'; setTotal(s); lastAct(s, ''); $('#tgt-' + s).textContent = ''; }
        $('#set-n').textContent = ev.set; deckCount(40);
        log('— SET ' + ev.set + ' · ' + seatName(ev.starter) + ' first', 's');
        status('SET ' + ev.set); sfx('shuffle');
        if (ev.set === 1 || ev.set > 1) fx('scan', { color: 'fg' });
        await pause(650);
        break;
      }
      case 'reshuffle': deckCount(40); sfx('shuffle'); log('the main deck runs out and is shuffled again'); await pause(400); break;
      case 'turn': {
        for (let s = 0; s < 2; s++) $('#side-' + s).classList.toggle('act', s === ev.seat);
        $('.arena').classList.add('live');
        const sd = $('#side-' + ev.seat); sd.classList.remove('sweep'); if (S.set.motion) { void sd.offsetWidth; sd.classList.add('sweep'); }
        if (!human(ev.seat)) status(esc(seatName(ev.seat)) + "'S TURN");
        break;
      }
      case 'draw': {
        const slot = $('#board-' + ev.seat).children[m.boards[ev.seat].findIndex((c) => c.id === ev.card.id)] || $('#board-' + ev.seat).children[$$('#board-' + ev.seat + ' .pc').length];
        const el = cardEl({ card: ev.card }); el.dataset.id = ev.card.id;
        if (slot) slot.appendChild(el);
        const n = +$('#deck-n').textContent - 1; deckCount(Math.max(0, n));
        sfx('deal');
        await fly(el, center($('#deck')), { flipFrom: true, rot: ev.seat ? 12 : -12 });
        sfx('place'); setTotal(ev.seat, true); lastAct(ev.seat, 'drew ' + ev.card.v);
        const c = center(el); fx('burst', c.x, c.y, { count: 10, color: 'fg', speed: .6, life: 450 });
        log(seatName(ev.seat) + verb(ev.seat, ' draws ', ' draw ') + ev.card.v + ' → ' + boardTotal(ev.seat), ev.seat === 0 ? 'y' : '');
        await pause(220);
        break;
      }
      case 'play': {
        const type = typeOf(ev.name), from = human(ev.seat) && ev.seat === shownSeat ? $('#hand').children[ev.handIndex] : $('#ohand').children[ev.handIndex];
        const src = dropAt && ev.seat === shownSeat ? dropAt : from ? center(from) : center($('#deck'));
        dropAt = null;
        if (from) { if (from.classList.contains('slotc')) { from.innerHTML = ''; from.classList.add('gone'); } else { const g = document.createElement('div'); g.className = 'gap'; from.replaceWith(g); } }
        const board = $('#board-' + ev.seat), idx = $$('.pc', board).length, el = cardEl({ card: ev.card });
        el.dataset.id = ev.card.id;
        if (board.children[idx]) board.children[idx].appendChild(el);
        sfx('play');
        await fly(el, src, { flipFrom: !human(ev.seat) || ev.seat !== shownSeat, dur: 520, rot: 25, color: colorFor(type) });
        const c = center(el);
        fx('burst', c.x, c.y, { count: type === 'gold' ? 46 : 26, color: colorFor(type), glyphs: type === 'gold', speed: 1 });
        if (type === 'gold') { fx('shockwave', c.x, c.y, { color: '#ffd36b', radius: 140 }); buzz(30); }
        setTotal(ev.seat, true);
        lastAct(ev.seat, 'played ' + (ev.choice !== null && ev.choice !== undefined ? signed(ev.choice) : (E.cardInfo(ev.name) || {}).label || ev.name));
        targets();
        log(seatName(ev.seat) + verb(ev.seat, ' plays [', ' play [') + ev.name + ']' + (ev.choice !== null && ev.choice !== undefined && /±/.test(ev.name) ? ' as ' + signed(ev.choice) : '') + ' → ' + boardTotal(ev.seat), ev.seat === 0 ? 'y' : 'o');
        if (!human(ev.seat)) quip('play', .5);
        if (ev.flips && ev.flips.length) {
          await pause(200); sfx('flip');
          for (const f of ev.flips) { const fe = $('#board-' + ev.seat + ' .pc[data-id="' + f.id + '"]'); if (fe) await flipCard(fe, f.to); }
          setTotal(ev.seat, true);
          log('  ' + ev.flips.length + ' card' + (ev.flips.length > 1 ? 's' : '') + ' flip sign → ' + boardTotal(ev.seat));
          lastAct(ev.seat, 'played ' + ((E.cardInfo(ev.name) || {}).label || ev.name) + ' · ' + ev.flips.length + ' flipped');
        }
        await pause(260);
        break;
      }
      case 'twenty': {
        const t = $('#tot-' + ev.seat), c = center(t);
        fx('shockwave', c.x, c.y, { color: 'hi', radius: 200, rings: 2 });
        fx('burst', c.x, c.y, { count: 50, color: 'hi', glyphs: true, speed: 1.3 });
        sfx('twenty'); buzz([20, 40, 20]);
        if (human(ev.seat) && G.cfg.mode !== 'hotseat') { S.stats.pure++; unlock('pure'); G.pure = (G.pure || 0) + 1; }
        quip(human(ev.seat) ? 'youTwenty' : 'aiTwenty');
        status('TWENTY · <span style="color:#fff">PURE PAZAAK</span>'); lastAct(ev.seat, 'twenty');
        log(seatName(ev.seat) + verb(ev.seat, ' lands', ' land') + ' on twenty', 's');
        await pause(700);
        break;
      }
      case 'stand': {
        const side = $('#side-' + ev.seat); side.classList.add('standing');
        sfx('stand');
        const c = center(side); fx('scan', { color: 'fg', life: 500 }); fx('burst', c.x, c.y, { count: 14, color: 'fg', speed: .5 });
        status(esc(seatName(ev.seat)) + verb(ev.seat, ' STANDS', ' STAND') + ' ON ' + ev.total);
        lastAct(ev.seat, 'stands on ' + ev.total); targets();
        log(seatName(ev.seat) + verb(ev.seat, ' stands', ' stand') + ' on ' + ev.total, ev.seat === 0 ? 'y' : 'o');
        if (human(ev.seat)) G.lowStand = ev.total <= 15 ? (G.lowStand || 0) | (1 << ev.seat) : G.lowStand;
        if (!human(ev.seat) && !ev.auto) quip('aiStand', .5);
        await pause(500);
        break;
      }
      case 'end': sfx('end'); lastAct(ev.seat, 'ends on ' + ev.total); log(seatName(ev.seat) + verb(ev.seat, ' ends', ' end') + ' the turn on ' + ev.total, ev.seat === 0 ? 'y' : ''); await pause(200); break;
      case 'bust': {
        const side = $('#side-' + ev.seat); side.classList.add('busted'); $('#lock-' + ev.seat).textContent = 'BUST';
        fx('glitch', { life: 650 }); shake(); sfx('bust'); buzz(220);
        const c = center($('#tot-' + ev.seat)); fx('burst', c.x, c.y, { count: 40, color: 'warn', glyphs: true, speed: 1.4 });
        if (human(ev.seat) && G.cfg.mode !== 'hotseat') { S.stats.busts++; G.busts = (G.busts || 0) + 1; if (G.cfg.mode !== 'hotseat' && G.busts >= 3) unlock('spect'); }
        quip(human(ev.seat) ? 'youBust' : 'aiBust');
        lastAct(ev.seat, 'bust on ' + ev.total);
        status('<span class="warn-t">' + esc(seatName(ev.seat)) + (seatName(ev.seat) === 'YOU' ? ' BUST' : ' BUSTS') + ' · ' + ev.total + '</span>');
        log(seatName(ev.seat) + verb(ev.seat, ' busts', ' bust') + ' on ' + ev.total, 'w');
        await pause(900);
        break;
      }
      case 'nine': {
        const c = center($('#board-' + ev.seat));
        fx('shockwave', c.x, c.y, { color: 'alt', radius: 240, rings: 3 }); fx('flash', { color: 'alt' }); sfx('twenty');
        if (human(ev.seat) && G.cfg.mode !== 'hotseat') { S.stats.nines++; unlock('nine'); }
        status('NINE CARDS · THE BOARD IS FULL'); lastAct(ev.seat, 'full board');
        log(seatName(ev.seat) + verb(ev.seat, ' fills', ' fill') + ' the board', 's');
        await pause(800);
        break;
      }
      case 'setEnd': {
        pips();
        const w = ev.winner, me = G.cfg.mode === 'hotseat' ? null : 0;
        const word = setWord(w);
        const why = { bust: 'over twenty', nine: 'nine cards', stand: ev.totals[0] + ' to ' + ev.totals[1], tiebreak: 'on the tiebreaker', tie: 'the set is played again' }[ev.reason] || '';
        fx('stamp', word, { color: w === null ? 'fg' : w === me || G.cfg.mode === 'hotseat' ? 'hi' : 'warn', sub: why.toUpperCase(), life: 1500 });
        if (w !== null) { const p = $('#pips-' + w).children[ev.score[w] - 1]; if (p) { const c = center(p); fx('burst', c.x, c.y, { count: 24, color: 'hi' }); } }
        sfx(w === null ? 'tie' : w === 0 || G.cfg.mode === 'hotseat' ? 'setWin' : 'setLose');
        if (G.cfg.mode !== 'hotseat') {
          if (w === 0) { S.stats.setsW++; if (ev.reason === 'tiebreak') unlock('tiebreak'); if (G.lowStand & 1) unlock('nerve'); }
          if (w === 1) S.stats.setsL++;
          quip(w === null ? 'tie' : w === 0 ? 'setLose' : 'setWin');
        }
        G.lowStand = 0;
        G.track = (G.track || []).concat([w]);
        if (w === 1 && G.m.score[1] === 2 && G.m.score[0] === 0) G.down02 = true;
        status(esc(word) + ' · ' + esc(why));
        log('set ' + (m.history.length ? m.history[m.history.length - 1].set : '') + ': ' + word.toLowerCase() + ', ' + why + ' · ' + ev.score[0] + '–' + ev.score[1], 's');
        save();
        await pause(1500);
        break;
      }
      case 'matchEnd': break;
    }
  }
  const setWord = (w) => w === null ? 'TIE' : G.cfg.mode === 'hotseat' ? 'P' + (w + 1) + ' TAKES THE SET' : w === 0 ? 'SET WON' : 'SET LOST';
  async function run(events) {
    // a match left behind (a new one started while this one was still animating) stops where it is
    const g = G;
    busy = true; controls();
    for (const ev of events) { if (G !== g) return; await play(ev); }
    if (G !== g) return;
    busy = false; saveMatch(); save();
    after();
  }
  // what happens once the cards stop moving: the next set, the other player's turn, or the end
  async function after() {
    const m = G.m;
    if (m.phase === 'matchOver') return matchOver();
    if (screen !== 'table') return;
    if (m.phase === 'setOver') {
      // a set is not waved off: the recap stays until you have read it
      const g = G;
      if (!(await recap()) || G !== g) return;
      return run(E.startSet(m));
    }
    if (m.phase !== 'turn') return;
    if (!human(m.turn)) return aiTurn();
    if (m.turn !== shownSeat) {
      // hotseat: the device changes hands, and nobody gets to see the other hand on the way
      await passDevice(m.turn);
    }
    if (coaching()) {
      // the cards and the buttons stay shut while a callout is up
      const g = G;
      controls(); busy = true; controls();
      await coachTurn();
      busy = false;
      if (G !== g || screen !== 'table') return;
    }
    controls(); choices();
  }

  // ---- the set recap: who took it, how, and the score. It waits for you, over the arena
  let recapNow = null;
  function recap() {
    const m = G.m, h = m.history[m.history.length - 1], w = h.winner, hot = G.cfg.mode === 'hotseat';
    const nm = (s) => seatName(s) === 'YOU' ? 'You' : seatName(s);
    const why = { stand: w === null ? '' : nm(w) + ' stood higher.', bust: w === null ? '' : nm(1 - w) + ' went over twenty.', nine: w === null ? '' : nm(w) + ' filled the board.', tiebreak: 'The tiebreaker card decides it.', tie: 'A tie. The set is played again.' }[h.reason] || '';
    return new Promise((done) => {
      const ov = document.createElement('div'); ov.className = 'recap'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'set ' + h.set + ' recap');
      ov.innerHTML = '<h4 class="' + (w === 1 && !hot ? 'lost' : '') + '">' + esc(setWord(w)) + '</h4><p class="rw">' + esc(why) + '</p>' +
        '<div class="rs"><span><b>' + h.totals[0] + ' – ' + h.totals[1] + '</b>this set</span><span><b>' + m.score[0] + ' – ' + m.score[1] + '</b>sets</span><button class="btn" type="button">next set ›</button></div>';
      document.body.appendChild(ov);
      let over = false;
      const end = (go) => { if (over) return; over = true; ov.remove(); recapNow = null; if (go) sfx('select'); done(go); };
      // over the middle of the arena, and no wider than it needs to be
      const place = () => {
        const r = $('.arena').getBoundingClientRect(), w = Math.min(460, r.width - 8);
        ov.style.width = w + 'px'; ov.style.left = r.left + (r.width - w) / 2 + 'px';
        ov.style.top = Math.max(4, r.top + (r.height - ov.offsetHeight) / 2) + 'px';
      };
      recapNow = { end, place };
      place();
      ov.onclick = () => end(true);
      $('.btn', ov).focus();
    });
  }

  // ---- coach marks. The first match against Camille: a ring on the thing, a callout beside it, and the table waits
  let coachNow = null;
  const coaching = () => !!G && screen === 'table' && G.cfg.mode === 'ladder' && G.cfg.opp === 'camille' && !S.seen.coach;
  const COACH = {
    total: { at: '#tot-0', side: 'below', t: () => 'Your total. Twenty wins the set. Over twenty, at the end of your turn, loses it.' },
    end: { at: '.actions', side: 'above', t: () => '<b>END TURN</b> and the deck deals you another card next turn. <b>STAND</b> and your total is locked for the rest of the set. Neither comes back.' },
    hand: { at: '#hand .slotc', side: 'above', t: () => 'Your hand. Four side cards, for the whole match, and one per turn. ' + (matchMedia('(pointer: coarse)').matches ? 'Tap a card, then tap the half you want. Or drag it onto your board.' : 'Click the half of a card you want. Or drag it onto your board.') },
    stand: { at: '#tgt-0', side: 'below', t: () => 'She stands. Beat her total without going over. She is in no hurry.' },
    over: { at: '#hand .slotc', side: 'above', t: () => 'Over twenty. A minus card can still save it, this turn only. After that it is a bust.' },
  };
  async function coachTurn() {
    const m = G.m, s = shownSeat;
    await coach('total'); await coach('end'); await coach('hand');
    if (m.standing[1 - s] && !m.standing[s] && E.total(m, 1 - s) <= 20) await coach('stand');
    if (E.total(m, s) > 20 && E.legalPlays(m, s).some((p) => p.after <= 20)) await coach('over');
  }
  function coach(id) {
    if (!coaching() || (G.coach && G.coach[id])) return Promise.resolve();
    const c = COACH[id];
    (G.coach = G.coach || {})[id] = 1; saveMatch();
    return new Promise((done) => {
      const ov = document.createElement('div'); ov.className = 'coach'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'coaching');
      ov.innerHTML = '<i class="hl"></i><div class="cm"><div class="bx"><span class="cl">THE TERMINAL</span><p>' + c.t() + '</p><div class="cb"><button class="skip" data-esc type="button">skip</button><button class="btn" type="button">got it ›</button></div></div><i class="ar"></i></div>';
      $('#ovs').appendChild(ov);
      const hl = $('.hl', ov), cm = $('.cm', ov), ar = $('.ar', ov), cl = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
      let over = false;
      const close = (skipped) => {
        if (over) return; over = true; ov.remove(); coachNow = null;
        // skipping ends the coaching for good, and so does having seen all of it
        if (skipped || Object.keys(G.coach).length >= Object.keys(COACH).length) { S.seen.coach = 1; save(); }
        done();
      };
      // on whatever it points at: above or below it if there is room, else beside it, else over its edge with no arrow
      const place = () => {
        const els = $$(c.at).filter((e) => e.offsetWidth || e.offsetHeight);
        const vw = document.documentElement.clientWidth, vh = window.visualViewport ? visualViewport.height : innerHeight;
        const pad = 5, gap = 20, edge = 10;
        let r = null;
        els.forEach((e) => { const b = e.getBoundingClientRect(); r = r ? { left: Math.min(r.left, b.left), top: Math.min(r.top, b.top), right: Math.max(r.right, b.right), bottom: Math.max(r.bottom, b.bottom) } : { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; });
        cm.style.width = Math.min(310, vw - 2 * edge) + 'px';
        const w = cm.offsetWidth, h = cm.offsetHeight;
        if (!r) { r = { left: vw / 2, right: vw / 2, top: vh / 2, bottom: vh / 2 }; hl.style.display = 'none'; } else hl.style.display = '';
        const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
        hl.style.left = r.left - pad + 'px'; hl.style.top = r.top - pad + 'px'; hl.style.width = r.right - r.left + 2 * pad + 'px'; hl.style.height = r.bottom - r.top + 2 * pad + 'px';
        const room = { above: r.top - pad - gap - h >= edge, below: r.bottom + pad + gap + h <= vh - edge, left: r.left - pad - gap - w >= edge, right: r.right + pad + gap + w <= vw - edge };
        const dir = (c.side === 'above' ? ['above', 'below', 'left', 'right'] : ['below', 'above', 'left', 'right']).find((d) => room[d]) || 'none';
        let x = cl(cx - w / 2, edge, vw - w - edge), y;
        if (dir === 'above') y = r.top - pad - gap - h;
        else if (dir === 'below') y = r.bottom + pad + gap;
        else if (dir === 'left') { x = r.left - pad - gap - w; y = cl(cy - h / 2, edge, vh - h - edge); }
        else if (dir === 'right') { x = r.right + pad + gap; y = cl(cy - h / 2, edge, vh - h - edge); }
        else y = r.top - edge > vh - r.bottom ? edge : vh - h - edge;
        cm.style.left = x + 'px'; cm.style.top = y + 'px';
        ar.className = 'ar ' + dir;
        if (dir === 'above' || dir === 'below') { ar.style.left = cl(cx - x, 16, w - 16) + 'px'; ar.style.top = ''; }
        else { ar.style.top = cl(cy - y, 16, h - 16) + 'px'; ar.style.left = ''; }
      };
      coachNow = { place, close: () => close(false), next: () => close(false), skip: () => close(true) };
      place();
      $('.btn', ov).onclick = () => close(false);
      $('.skip', ov).onclick = () => close(true);
      sfx('select');
      $('.btn', ov).focus();
    });
  }
  async function aiTurn() {
    busy = true; controls();
    const g = G, o = O(), seat = G.m.turn;
    status(esc(o.name) + ' <span class="dots">IS THINKING</span>');
    quip('think', .25);
    sfx('thinking');
    await pause(o.brain === 'camille' ? 500 + Math.random() * 900 : 650 + Math.random() * 700);
    if (G !== g || screen !== 'table' || G.m.turn !== seat || G.m.phase !== 'turn') { busy = false; return; }
    let r;
    try { r = E.act(G.m, seat, E.aiChoose(G.m, seat, o.brain)); } catch (e) { r = { ok: false, error: String(e) }; }
    // a confused brain ends its turn rather than freezing the table
    if (!r.ok) r = E.act(G.m, seat, E.total(G.m, seat) > 20 ? { type: 'stand' } : { type: 'end' });
    saveMatch();
    await run(r.events || []);
  }
  function humanAct(action) {
    if (!myTurn()) return;
    const r = E.act(G.m, shownSeat, action);
    if (!r.ok) { sfx('error'); status('<span class="warn-t">' + esc(r.error || 'not now') + '</span>'); return; }
    sel = -1; $('#choices').innerHTML = ''; preview(null);
    saveMatch();
    run(r.events);
  }
  function passDevice(seat) {
    return new Promise((done) => {
      $('#hand').innerHTML = ''; $('#choices').innerHTML = '';
      const ov = document.createElement('div'); ov.className = 'ov'; ov.style.background = 'rgba(0,0,0,.94)';
      ov.innerHTML = '<div class="panel" style="text-align:center"><h3>PLAYER ' + (seat + 1) + '</h3><p>Pass the device. Player ' + (2 - seat) + ', look away.</p><div class="row" style="justify-content:center"><button class="btn pri" type="button">I am player ' + (seat + 1) + ' · show my hand</button></div></div>';
      $('#ovs').appendChild(ov);
      $('button', ov).focus();
      $('button', ov).onclick = () => { ov.remove(); shownSeat = seat; renderTable(); done(); };
    });
  }

  // ---- starting, resuming and ending a match
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; } return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; }
  function hand4(deck, rnd) { const d = deck.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, 4); }
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  function dailyDeck(date) {
    // everyone gets the same ten today: one gold, three flips, the rest plain
    const r = hashStr('pazaak-deck:' + date), by = (t) => E.ALL_CARDS.filter((c) => typeOf(c) === t);
    const pickN = (arr, n) => { const d = arr.slice(); for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; } return d.slice(0, n); };
    return [].concat(pickN(by('gold'), 1), pickN(by('flip'), 3), pickN(by('plus'), 3), pickN(by('minus'), 3));
  }
  function startMatch(cfg) {
    const rnd = cfg.seed ? hashStr(cfg.seed + ':hands') : Math.random;
    const myDeck = cfg.mode === 'daily' ? dailyDeck(cfg.date) : S.deck;
    const theirDeck = cfg.mode === 'hotseat' ? (cfg.deck2 || DEFAULT_DECK) : cfg.mode === 'daily' ? E.PROFILES.hk.deck : OPP[cfg.opp].mirror ? S.deck : E.PROFILES[OPP[cfg.opp].brain].deck;
    const opts = { hands: [hand4(myDeck, rnd), hand4(theirDeck, rnd)], setsToWin: 3 };
    if (cfg.seed) opts.seed = cfg.seed;
    G = { cfg, m: E.createMatch(opts), track: [] };
    camPose = null;
    if (cfg.wager) credits(-cfg.wager);
    shownSeat = 0;
    $('#log').innerHTML = '';
    log('MATCH · ' + seatName(0) + ' vs ' + seatName(1) + (cfg.wager ? ' · pot ¤' + cfg.wager * 2 : ''), 's');
    saveMatch();
    enterTable();
  }
  function enterTable() {
    show('table');
    renderTable();
    if (G.cfg.mode === 'hotseat') say('Two players, one screen. The hand at the bottom belongs to whoever is holding the device.');
    else quip('greet');
    const m = G.m;
    if (m.phase === 'idle') { busy = true; controls(); setTimeout(() => run(E.startSet(m)), 700 * speed()); }
    else if (m.phase === 'setOver') run(E.startSet(m));
    else after();
  }
  async function matchOver() {
    if (G.over) return;
    G.over = true;
    if (recapNow) recapNow.end(false);
    if (G.coach && !S.seen.coach) { S.seen.coach = 1; save(); }
    const m = G.m, cfg = G.cfg, w = m.winner, me = w === 0;
    store.del('pazaak-match');
    let delta = 0, lines = [], storyNext = null;
    if (cfg.mode === 'hotseat') {
      unlock('hotseat');
      fx('fireworks', {}); sfx('matchWin');
    } else {
      S.stats.played++;
      const o = OPP[cfg.opp];
      if (me) {
        S.stats.won++; S.stats.streak++; S.stats.best = Math.max(S.stats.best, S.stats.streak);
        if (cfg.mode === 'ladder') S.beaten[cfg.opp] = (S.beaten[cfg.opp] || 0) + 1;
        unlock('first');
        if (m.score[1] === 0) unlock('flawless');
        if (G.down02) unlock('comeback');
        if (S.stats.streak >= 5) unlock('streak');
        if (cfg.mode === 'ladder' && cfg.opp === 'hk') unlock('meatbag');
        if (cfg.mode === 'daily') {
          const d = S.daily[cfg.date] || {};
          if (!d.won) { delta += 150; lines.push('first daily win today · ¤150'); }
          S.daily[cfg.date] = Object.assign(d, { won: true }); unlock('daily');
        } else if (cfg.wager) { delta += cfg.wager * 2; lines.push('the pot · ¤' + cfg.wager * 2); }
        else if (o.prize) { const p = cfg.opp === 'archive' && S.beaten.archive === 1 ? 1000 : o.prize; delta += p; lines.push(cfg.opp === 'camille' ? 'Camille drags in a credit chip · ¤' + p : 'winnings · ¤' + p); }
        if (G.pure) { delta += 15 * G.pure; lines.push(G.pure + ' × pure pazaak · ¤' + 15 * G.pure); }
        if (m.score[1] === 0 && cfg.wager) { const b = Math.round(cfg.wager / 2); delta += b; lines.push('flawless · ¤' + b); }
        if (cfg.mode === 'ladder' && !S.seen[cfg.opp + '_out']) storyNext = cfg.opp;
        quip('matchLose');
        fx('rain', { life: 3600 }); fx('fireworks', { count: 6 }); sfx('matchWin'); buzz([30, 60, 30, 60, 90]); degauss();
      } else {
        S.stats.lost++; S.stats.streak = 0;
        if (cfg.mode === 'ladder') S.lost[cfg.opp] = (S.lost[cfg.opp] || 0) + 1;
        if (cfg.mode === 'daily') { const d = S.daily[cfg.date] || {}; d.lost = (d.lost || 0) + 1; S.daily[cfg.date] = d; }
        if (cfg.mode === 'ladder' && cfg.opp === 'camille') unlock('cat');
        if (cfg.wager) lines.push('the buy-in stays on the table · −¤' + cfg.wager);
        quip('matchWin');
        fx('glitch', { life: 900, intensity: .7 }); sfx('matchLose');
      }
      if (cfg.mode === 'daily' && !(S.daily[cfg.date] || {}).first) S.daily[cfg.date].first = { won: me, score: m.score.slice(), track: G.track };
    }
    save();
    await wait(900);
    const title = cfg.mode === 'hotseat' ? 'PLAYER ' + (w + 1) + ' WINS' : me ? 'VICTORY' : 'DEFEAT';
    fx('stamp', title, { color: me || cfg.mode === 'hotseat' ? 'hi' : 'warn', life: 1600 });
    await wait(1300);
    const ov = document.createElement('div'); ov.className = 'ov';
    const track = (G.track || []).map((x, i) => '<span class="' + (x === null ? '' : x === 0 ? 'w' : 'l') + '">' + (i + 1) + ' · ' + (x === null ? 'tie' : cfg.mode === 'hotseat' ? 'P' + (x + 1) : x === 0 ? 'won' : 'lost') + '</span>').join('');
    ov.innerHTML = '<div class="panel" role="dialog" aria-label="' + title + '"><h3 class="' + (me || cfg.mode === 'hotseat' ? '' : 'warn') + '">' + title + '</h3>' +
      '<p>' + esc(seatName(0)) + ' ' + m.score[0] + ' – ' + m.score[1] + ' ' + esc(seatName(1)) + '</p><div class="sets">' + track + '</div>' +
      (delta ? '<p class="delta">+¤' + delta + '</p>' : cfg.wager && !me ? '<p class="delta neg">−¤' + cfg.wager + '</p>' : '') +
      lines.map((l) => '<p class="note">' + esc(l) + '</p>').join('') +
      '<div class="row">' +
      (storyNext ? '<button class="btn pri" data-a="story" type="button">continue ›</button>' : '<button class="btn pri" data-a="again" type="button">' + (cfg.mode === 'daily' ? 'try again' : 'rematch') + '</button>') +
      (cfg.mode === 'daily' ? '<button class="btn" data-a="share" type="button">copy result</button>' : '') +
      (cfg.mode === 'hotseat' ? '' : '<button class="btn" data-a="ladder" type="button">opponents</button>') +
      '<button class="btn" data-a="menu" data-esc type="button">menu</button></div></div>';
    $('#ovs').appendChild(ov);
    if (delta) credits(delta);
    $('button', ov).focus();
    ov.addEventListener('click', async (e) => {
      const a = e.target.dataset && e.target.dataset.a; if (!a) return;
      if (a === 'share') { share(cfg, m); return; }
      ov.remove();
      if (a === 'again') { if (cfg.mode === 'daily' || cfg.mode === 'hotseat') startMatch(cfg); else challenge(cfg.opp, true); }
      else if (a === 'story') {
        S.seen[storyNext + '_out'] = 1; save();
        if (storyNext === 'archive') { await scene(S.align >= 0 ? STORY.end_light : STORY.end_dark); finishStory(); }
        else await scene(STORY[storyNext + '_out']);
        show('ladder');
      }
      else show(a);
    });
  }
  function finishStory() {
    unlock('story');
    const gift = S.align >= 0 ? '±1T' : '2x';
    S.owned[gift] = Math.min(4, (S.owned[gift] || 0) + 1); save();
    toast('A GIFT FROM THE ARCHIVE', 'One [' + gift + '] added to your collection.');
    unlock('gold');
  }
  function share(cfg, m) {
    const row = (G.track || []).map((x) => x === null ? '⬜' : x === 0 ? '🟩' : '🟥').join('');
    const txt = 'PAZAAK · DAILY TRANSMISSION ' + cfg.date + '\nvs HK-47 · ' + (m.winner === 0 ? 'WON ' : 'LOST ') + m.score[0] + '–' + m.score[1] + '\n' + row + '\n' + location.href.split('?')[0];
    const ok = () => toast('COPIED', 'Paste it anywhere.');
    if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ text: txt }).catch(() => {});
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(ok, () => prompt('copy this', txt));
    else prompt('copy this', txt);
  }
  function confirmBox(title, text, yes) {
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = '<div class="panel"><h3 class="warn" style="font-size:34px">' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="row"><button class="btn pri" data-y type="button">yes</button><button class="btn" data-esc type="button">no</button></div></div>';
    $('#ovs').appendChild(ov);
    $('[data-y]', ov).focus();
    ov.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; ov.remove(); if ('y' in e.target.dataset) yes(); });
  }
  function forfeit() {
    if (!G || G.m.phase === 'matchOver') return;
    if (busy) { toast('NOT NOW', 'Wait for the cards to land.'); return; }
    confirmBox('FORFEIT?', G.cfg.wager ? 'The buy-in of ¤' + G.cfg.wager + ' stays on the table.' : 'The match counts as a loss.', () => {
      G.m.phase = 'matchOver'; G.m.winner = G.cfg.mode === 'hotseat' ? 1 - shownSeat : 1;
      log('forfeit', 'w');
      matchOver();
    });
  }

  // ---- picking an opponent: the buy-in, then the story (the first time), then the table
  const unlocked = (k) => { const i = ORDER.indexOf(k); return i === 0 || (k === 'archive' ? !!S.beaten.hk : !!S.beaten[ORDER[i - 1]]); };
  async function challenge(k, again) {
    const o = OPP[k];
    if (!unlocked(k)) { sfx('error'); return; }
    if (S.deck.length !== 10) { toast('SIDE DECK', 'You need ten cards in your side deck.'); show('deck'); return; }
    let stakes = 1;
    if (!again && !S.seen[k + '_in'] && STORY[k + '_in']) {
      const r = await scene(STORY[k + '_in']);
      S.seen[k + '_in'] = 1; save(); stakes = r.stakes || 1;
    }
    let wager = o.buyin * stakes;
    if (wager > S.credits) {
      if (stakes > 1 && o.buyin <= S.credits) { wager = o.buyin; toast('NOT ENOUGH FOR DOUBLE', 'You play for the usual pot.'); }
      else { toast('NOT ENOUGH CREDITS', 'The buy-in is ¤' + o.buyin + '. Camille plays for free.'); show('ladder'); return; }
    }
    startMatch({ mode: 'ladder', opp: k, wager, seats: ['human', 'ai'] });
  }

  // ============================================================
  // THE OTHER SCREENS
  // ============================================================
  const RENDER = {};
  let menuFace = 'camille';
  const paintMenuFace = () => drawPortrait($('#m-face'), menuFace, { full: true });
  RENDER.menu = function () {
    const sv = store.get('pazaak-match', null);
    const can = sv && sv.m && sv.m.phase !== 'matchOver' && sv.cfg;
    $('#m-resume').hidden = !can;
    if (can) $('#m-resume-t').textContent = (sv.cfg.mode === 'hotseat' ? 'hotseat' : (OPP[sv.cfg.opp] || {}).name || '') + ' · ' + sv.m.score[0] + '–' + sv.m.score[1];
    const d = S.daily[today()];
    $('#m-daily-t').textContent = d && d.won ? "today's deal is beaten · play again" : 'same deal for everyone today';
    const next = ORDER.find((k) => unlocked(k) && !S.beaten[k]);
    // the next face on the list sits in the button; when the list is done, HK-47 is still dealing
    menuFace = next || 'hk';
    $('#m-play-t').textContent = next ? 'next on the list: ' + OPP[next].name.toLowerCase() : 'the list is finished · ' + OPP.hk.name + ' deals on';
    paintMenuFace();
    $('#tagline').textContent = S.ach.story ? (S.align >= 0 ? 'THE TABLE STAYS OPEN. IT ALWAYS DOES.' : 'WELCOME BACK, MASTER.') : S.beaten.hk ? 'THERE IS A SIXTH NAME.' : 'HK-47 DEALS. THE CAT WATCHES.';
    wire();
  };
  // the menu's wire card: a main-deck card turning on the spot, drawn in lines the way the landing page draws its
  // receptor. Its number changes each time it turns edge-on. Two more lean behind it, dim
  let wireRaf = 0;
  function wire() {
    const cv = $('#wire'); if (!cv) return;
    cancelAnimationFrame(wireRaf);
    const x = cv.getContext('2d'), dpr = Math.min(2, devicePixelRatio || 1), vals = [4, 9, 7];
    let W = 0, H = 0, face = 1;
    const SEG = { a: [-.5, -1, .5, -1], b: [.5, -1, .5, 0], c: [.5, 0, .5, 1], d: [-.5, 1, .5, 1], e: [-.5, 0, -.5, 1], f: [-.5, -1, -.5, 0], g: [-.5, 0, .5, 0] };
    const DIG = ['abcdef', 'bc', 'abdeg', 'abcdg', 'bcfg', 'acdfg', 'acdefg', 'abc', 'abcdefg', 'abcdfg'];
    const path = (pts, close) => { x.beginPath(); pts.forEach((p, i) => (i ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1]))); if (close) x.closePath(); };
    function frame(now) {
      if (screen !== 'menu' || !cv.isConnected) return;
      const r = cv.getBoundingClientRect();
      if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) { W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; }
      const t = now / 1000, fg = css('--fg'), hi = css('--hi'), faint = css('--faint'), bg = css('--bg');
      x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
      const U = Math.min(H * .42, W * .17), cx = W / 2, cy = H / 2;
      [[-1.15, .5, 1], [1.15, -.5, 1], [0, 0, 0]].forEach(([dx, lean, back], k) => {
        const front = k === 2, ang = front ? t * .85 : lean + Math.sin(t * .7 + k * 2) * .1;
        const ca = Math.cos(ang), sa = Math.sin(ang), z0 = back ? 1.3 : 0;
        const P = (u, v) => { const X = u * ca, Z = u * sa + z0, s = U * 3.4 / (3.4 + Z); return [cx + dx * U + X * s, cy + v * s + (back ? U * .08 : 0)]; };
        if (front && (ca >= 0 ? 1 : -1) !== face) { face = -face; if (face > 0) vals[2] = 1 + (Math.random() * 10 | 0); }
        const showFace = !front || ca >= 0;
        x.globalAlpha = 1; x.lineWidth = 1.3; x.shadowBlur = 0;
        path([[-.56, -1], [.7, -1], [.7, .86], [.56, 1], [-.7, 1], [-.7, -.86]].map((p) => P(p[0], p[1])), true);
        x.fillStyle = bg; x.fill();
        x.strokeStyle = front ? fg : faint; x.shadowColor = fg; x.shadowBlur = front ? 10 : 0; x.stroke();
        path([[-.56, -.74], [.56, -.74], [.56, .74], [-.56, .74]].map((p) => P(p[0], p[1])), true);
        x.lineWidth = 1; x.stroke();
        if (showFace) {
          // the number, in seven segments
          const ds = String(vals[k]).split('').map(Number);
          x.strokeStyle = front ? hi : faint; x.lineWidth = front ? 2.4 : 1.6; x.lineCap = 'round';
          ds.forEach((d, j) => {
            const ox = (j - (ds.length - 1) / 2) * .4;
            DIG[d].split('').forEach((g) => { const q = SEG[g]; path([P(ox + q[0] * .26, q[1] * .38), P(ox + q[2] * .26, q[3] * .38)]); x.stroke(); });
          });
          for (let i = 0; i < Math.min(10, vals[k]); i++) { path([P(-.5 + i * .11, .86), P(-.44 + i * .11, .86)]); x.lineWidth = 2; x.stroke(); }
        } else {
          // its back: a lattice and the table's ring
          x.strokeStyle = faint; x.lineWidth = 1;
          for (let i = -3; i <= 3; i++) { path([P(-.56, i * .24), P(.56, i * .24 + .5)]); x.stroke(); }
          x.strokeStyle = fg; path(Array.from({ length: 16 }, (_, i) => P(Math.cos(i / 16 * 6.283) * .24, Math.sin(i / 16 * 6.283) * .24)), true); x.stroke();
        }
      });
      x.shadowBlur = 0;
      if (S.set.motion) wireRaf = requestAnimationFrame(frame);
    }
    wireRaf = requestAnimationFrame(frame);
  }
  RENDER.ladder = function () {
    const L = $('#ladder'); L.innerHTML = '';
    if (S.credits < 20) { credits(50); toast('A CREDIT CHIP', 'Camille drags one in from somewhere. Do not ask where.'); }
    const bar = document.createElement('p'); bar.className = 'note'; bar.style.gridColumn = '1 / -1'; bar.style.margin = '0';
    // light on the left, dark on the right, and a needle where you stand
    const at = 10 - S.align;
    bar.innerHTML = 'ALIGNMENT  LIGHT <span style="color:var(--faint);letter-spacing:-1px">' + '─'.repeat(at) + '</span><b style="color:var(--hi)">◆</b><span style="color:var(--faint);letter-spacing:-1px">' + '─'.repeat(20 - at) + '</span> DARK';
    L.appendChild(bar);
    ORDER.forEach((k) => {
      const o = OPP[k], open = unlocked(k);
      if (k === 'archive' && !open) return;
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'opc' + (open ? '' : ' locked') + (S.beaten[k] ? ' beaten' : '');
      b.innerHTML = '<canvas class="portrait" width="32" height="32"></canvas><h3>' + esc(o.name) + '</h3><p>' + esc(o.title) + ' · ' + esc(o.blurb) + '</p>' +
        '<p class="meta"><span class="stars">' + '★'.repeat(Math.min(5, o.stars)) + (o.stars > 5 ? '?' : '') + '</span><span>' + (o.buyin ? 'buy-in ¤' + o.buyin : 'free') + '</span><span>' + (S.beaten[k] || 0) + 'W · ' + (S.lost[k] || 0) + 'L</span>' + (!open ? '<span class="tag">SIGNAL LOCKED</span>' : S.beaten[k] ? '<span class="tag">BEATEN</span>' : '') + '</p>';
      drawPortrait($('canvas', b), k, { full: true, noise: open ? 0 : .5 });
      b.onclick = () => open ? challenge(k) : (sfx('error'), toast('SIGNAL LOCKED', 'Beat ' + OPP[ORDER[ORDER.indexOf(k) - 1]].name + ' first.'));
      L.appendChild(b);
    });
  };
  RENDER.table = function () {};

  // ---- side deck: ten from what you own
  RENDER.deck = function () {
    hideTip();
    const dv = $('#deckview'), co = $('#coll');
    dv.innerHTML = ''; co.innerHTML = '';
    for (let i = 0; i < 10; i++) {
      const name = S.deck[i];
      if (!name) { const e = document.createElement('div'); e.className = 'empty'; dv.appendChild(e); continue; }
      const c = cardEl({ name }); c.tabIndex = 0; c.setAttribute('aria-label', 'take out ' + name + ': ' + E.cardInfo(name).desc);
      c.onclick = () => { S.deck.splice(i, 1); save(); sfx('select'); RENDER.deck(); };
      c.onkeydown = (e) => { if (e.key === 'Enter') c.onclick(); };
      describe(c, name);
      dv.appendChild(c);
    }
    $('#deck-count').textContent = S.deck.length + '/10';
    // what is in it, and whether anything in it can pull you back from twenty-one
    const by = { plus: 0, minus: 0, flip: 0, gold: 0 };
    S.deck.forEach((n) => { by[typeOf(n)]++; });
    const saves = S.deck.some((n) => { const i = E.cardInfo(n); return i.type === 'minus' || i.type === 'flip' || i.choices.some((v) => v < 0); });
    $('#d-comp').innerHTML = (S.deck.length ? Object.keys(by).filter((t) => by[t]).map((t) => by[t] + ' ' + t).join(' · ') : 'nothing in it yet') + (S.deck.length && !saves ? ' · <span class="warn-t">nothing in here can save you from a bust</span>' : '');
    ['plus', 'minus', 'flip', 'gold'].forEach((t) => {
      const h = document.createElement('h4'); h.className = 'grp t-' + t; h.textContent = t.toUpperCase(); co.appendChild(h);
      E.ALL_CARDS.filter((n) => typeOf(n) === t).forEach((name) => {
        const own = S.owned[name] || 0, used = S.deck.filter((x) => x === name).length;
        const b = document.createElement('button'); b.type = 'button'; b.className = 'citem' + (own ? '' : ' none');
        // not disabled, so a long press can still ask what the card does
        const no = !own || used >= own || S.deck.length >= 10;
        b.classList.toggle('dis', no); b.setAttribute('aria-disabled', no ? 'true' : 'false');
        b.appendChild(cardEl({ name }));
        const n = document.createElement('span'); n.className = 'cnt'; n.innerHTML = own ? '<b>' + (own - used) + '</b>/' + own : 'not owned'; b.appendChild(n);
        b.onclick = () => { if (no) return; S.deck.push(name); save(); sfx('place'); RENDER.deck(); };
        describe(b, name);
        co.appendChild(b);
      });
    });
    $('#d-note').textContent = S.deck.length < 10 ? 'add ' + (10 - S.deck.length) + ' more to play' : 'ready';
  };
  // a card's readout: hover shows it, so does a long press, and a long press is not also a tap
  let tipEl = null, tipT = 0;
  function showTip(el, name) {
    const i = E.cardInfo(name); if (!i) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    clearTimeout(tipT);
    tipEl.innerHTML = '<b>' + esc(i.label) + '</b> · ' + i.type + ' · ' + esc(i.desc);
    tipEl.hidden = false;
    const r = el.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight, vw = document.documentElement.clientWidth;
    tipEl.style.left = Math.max(8, Math.min(vw - w - 8, r.left + r.width / 2 - w / 2)) + 'px';
    tipEl.style.top = (r.top - h - 8 < 8 ? r.bottom + 8 : r.top - h - 8) + 'px';
  }
  function hideTip() { clearTimeout(tipT); if (tipEl) tipEl.hidden = true; }
  function describe(el, name) {
    let t = 0, held = false;
    el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(el, name); });
    el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') hideTip(); });
    el.addEventListener('focus', () => { if (el.matches(':focus-visible')) showTip(el, name); });
    el.addEventListener('blur', hideTip);
    el.addEventListener('pointerdown', (e) => {
      held = false; clearTimeout(t);
      if (e.pointerType === 'mouse') return;
      t = setTimeout(() => { held = true; showTip(el, name); buzz(15); }, 400);
    });
    // a finger that scrolls, or lifts, is not a hold; the readout stays a moment after a real one
    const release = () => { clearTimeout(t); if (held) tipT = setTimeout(hideTip, 2600); };
    el.addEventListener('pointerup', release); el.addEventListener('pointercancel', release);
    el.addEventListener('contextmenu', (e) => { if (held) e.preventDefault(); });
    el.addEventListener('click', (e) => { if (held) { held = false; e.preventDefault(); e.stopImmediatePropagation(); } }, true);
  }
  addEventListener('scroll', hideTip, { passive: true });
  function autoDeck() {
    const score = (n) => { const i = E.cardInfo(n); const v = Math.abs(parseInt(n.replace(/[^\d]/, ''), 10)) || 0; return i.type === 'gold' ? 90 : i.type === 'flip' ? 60 - Math.abs(v - 3) * 4 : 30 - Math.abs(v - 3) * 3; };
    const pool = []; E.ALL_CARDS.forEach((n) => { for (let k = 0; k < (S.owned[n] || 0); k++) pool.push(n); });
    pool.sort((a, b) => score(b) - score(a));
    // no more than two of the same, so the hand is not four of a kind
    const d = []; pool.forEach((n) => { if (d.length < 10 && d.filter((x) => x === n).length < 2) d.push(n); });
    pool.forEach((n) => { if (d.length < 10 && d.filter((x) => x === n).length < (S.owned[n] || 0)) d.push(n); });
    S.deck = d; save(); RENDER.deck(); sfx('shuffle');
  }

  // ---- the merchant
  const price = (n) => { const i = E.cardInfo(n), v = +(n.match(/\d/) || [1])[0]; return i.type === 'gold' ? ({ '±1/2': 380, '2&4': 320, '3&6': 320, '2x': 520, '±1T': 450 }[n] || 400) : i.type === 'flip' ? 90 + 30 * v : 25 + 15 * v; };
  const MERCH = ['Kebla counts your credits twice. He does not count the cards.', '"Good card. Very lucky. Previous owner, very unlucky."', 'Kebla wraps the card in a page torn out of a navigation manual.', '"No refunds. No exchanges. No questions about where it came from."', 'The Rodian bites the credit chip to check it. You did not know credit chips could be bitten.'];
  let shopTab = 'all';
  RENDER.shop = function () {
    const tabs = $('#shop-tabs'); tabs.innerHTML = '';
    ['all', 'plus', 'minus', 'flip', 'gold'].forEach((t) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn sm'; b.textContent = t; b.setAttribute('aria-pressed', t === shopTab ? 'true' : 'false');
      b.onclick = () => { shopTab = t; RENDER.shop(); }; tabs.appendChild(b);
    });
    const sh = $('#shop'); sh.innerHTML = '';
    E.ALL_CARDS.filter((n) => shopTab === 'all' || typeOf(n) === shopTab).forEach((name) => {
      const own = S.owned[name] || 0, p = price(name), full = own >= 4;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'citem';
      b.disabled = full || p > S.credits;
      b.appendChild(cardEl({ name }));
      const t = document.createElement('span'); t.className = 'cnt';
      t.innerHTML = full ? 'sold out' : '<span class="price' + (p > S.credits ? ' no' : '') + '">¤' + p + '</span> · own ' + own;
      b.appendChild(t);
      b.title = E.cardInfo(name).desc || '';
      b.onclick = () => {
        if (S.credits < p || full) return;
        S.owned[name] = own + 1; credits(-p); save();
        const c = center(b); fx('burst', c.x, c.y, { count: typeOf(name) === 'gold' ? 50 : 24, color: colorFor(typeOf(name)), glyphs: typeOf(name) === 'gold' });
        $('#shop-say').textContent = pick(MERCH);
        if (typeOf(name) === 'gold') unlock('gold');
        if (E.ALL_CARDS.every((n) => S.owned[n])) unlock('collector');
        RENDER.shop();
      };
      sh.appendChild(b);
    });
  };

  // ---- records
  RENDER.rec = function () {
    const st = S.stats, pct = st.played ? Math.round(100 * st.won / st.played) : 0;
    const tiles = [[st.won + '–' + st.lost, 'matches won–lost'], [pct + '%', 'win rate'], [st.setsW + '–' + st.setsL, 'sets won–lost'], [st.pure, 'pure pazaak'], [st.nines, 'full boards'], [st.busts, 'busts'], [st.streak + ' / ' + st.best, 'streak / best'], ['¤' + st.earned, 'credits won'], [(S.align > 0 ? 'light ' : S.align < 0 ? 'dark ' : 'grey ') + Math.abs(S.align), 'alignment']];
    $('#stats').innerHTML = tiles.map((t) => '<div class="stat"><b>' + esc(t[0]) + '</b><span>' + esc(t[1]) + '</span></div>').join('');
    const got = Object.keys(ACH).filter((k) => S.ach[k]).length;
    $('#ach-n').textContent = got + '/' + Object.keys(ACH).length;
    $('#achs').innerHTML = Object.keys(ACH).map((k) => '<li class="' + (S.ach[k] ? 'got' : '') + '"><b>' + (S.ach[k] ? '' : '▯ ') + esc(ACH[k][0]) + '</b>' + esc(ACH[k][1]) + '</li>').join('');
  };

  // ---- rules, with real cards in them
  RENDER.rules = function () {
    const ex = (list) => '<div class="ex">' + list.map((c, i) => '<span data-ex="' + i + '"></span>').join('') + '</div>';
    const sets = [[{ v: 10 }, { v: 6 }, { name: '+4' }], [{ name: '+3' }, { name: '-2' }, { name: '±4' }], [{ name: '±1/2' }, { name: '2&4' }, { name: '3&6' }, { name: '2x' }, { name: '±1T' }]];
    $('#rules').innerHTML =
      '<p>Get closer to <b>twenty</b> than your opponent without going over. Win three sets and you win the match.</p>' +
      '<h3>A turn</h3><p>At the start of your turn the main deck deals you a card, 1 to 10. Then you may play <b>one</b> card from your hand. Then you either <b>end your turn</b>, and you get another card next turn, or <b>stand</b>, and your total is locked for the rest of the set.</p>' + ex(sets[0]) +
      '<h3>Winning a set</h3><p>When both players stand, the higher total wins. Over twenty at the end of your turn is a <b>bust</b> and you lose the set. Fill all <b>nine</b> spaces on your side without busting and you win it outright. Land on exactly twenty and you stand automatically. A tie is played again.</p>' +
      '<h3>Your hand</h3><p>Before a match you build a <b>side deck</b> of ten cards. Four of them are dealt to you at random, and they are your hand for the <b>whole match</b>. A card you play is gone. Spend them carefully.</p>' + ex(sets[1]) +
      '<p><b style="color:var(--alt)">Plus</b> cards add. <b style="color:var(--warn)">Minus</b> cards subtract, and can save you from a bust. <b>Flip</b> cards (±) are either, your choice when you play them.</p>' +
      '<h3>Gold cards</h3>' + ex(sets[2]) +
      '<p><b>±1/2</b> is +1, −1, +2 or −2. <b>2&amp;4</b> flips the sign of every 2 and 4 on your side; <b>3&amp;6</b> does it to 3s and 6s. <b>x2</b> doubles the last card you were dealt. <b>±1T</b> is ±1, and wins a tied set for whoever has it on the board.</p>' +
      '<h3>The advisor</h3><p>T3-M4 will count the deck for you if you ask: the chance that the next card busts you, the cards left in the main deck, and what it would do. It is switched off in the daily transmission.</p>' +
      '<h3>Keys</h3><p><kbd>1</kbd>–<kbd>4</kbd> pick a card in your hand, <kbd>+</kbd> <kbd>−</kbd> or <kbd>Enter</kbd> play it · <kbd>E</kbd> end turn · <kbd>S</kbd> stand · <kbd>A</kbd> advisor · <kbd>L</kbd> log · <kbd>F</kbd> speed · <kbd>M</kbd> sound · <kbd>Esc</kbd> back</p>' +
      '<p class="note">Pazaak is from Star Wars: Knights of the Old Republic (BioWare, 2003). This is a fan-made table on a personal page.</p>';
    const rp = document.createElement('p'); rp.innerHTML = '<button class="btn" id="r-coach" type="button">replay the coaching</button>';
    $('#rules').appendChild(rp);
    $('#r-coach').onclick = () => {
      delete S.seen.coach; if (G) G.coach = {}; save(); sfx('select');
      toast('COACHING RESET', 'It runs again in your next match against Camille.');
    };
    let k = 0;
    $$('#rules .ex').forEach((box) => { const list = sets[k++]; $$('span[data-ex]', box).forEach((sp, i) => sp.replaceWith(cardEl(list[i]))); });
  };

  // ---- settings
  RENDER.opts = function () {
    const o = $('#opts');
    const items = [
      ['motion', 'animation', S.set.motion ? 'on' : 'reduced', () => setMotion(!S.set.motion)],
      ['fast', 'dealing speed', S.set.fast ? 'fast' : 'normal', () => { S.set.fast = !S.set.fast; fastLabel(); }],
      ['advisor', 'T3 advisor', S.set.advisor ? 'on' : 'off', () => { S.set.advisor = !S.set.advisor; }],
      ['tilt', 'card tilt' + (matchMedia('(pointer: coarse)').matches ? ' (gyro)' : ''), S.set.tilt ? 'on' : 'off', () => { S.set.tilt = !S.set.tilt; if (S.set.tilt) startGyro(); }],
      ['haptics', 'vibration', S.set.haptics ? 'on' : 'off', () => { S.set.haptics = !S.set.haptics; buzz(40); }],
      ['sound', 'sound', window.PazaakSfx && PazaakSfx.on ? 'on' : 'off', toggleSound],
      ['hum', 'ship hum', S.set.hum ? 'on' : 'off', () => { S.set.hum = !S.set.hum; if (window.PazaakSfx) PazaakSfx.hum(S.set.hum); }],
      ['theme', 'phosphor', document.documentElement.dataset.theme, () => { setTheme(document.documentElement.dataset.theme === 'amber' ? 'green' : 'amber', true); degauss(); }],
    ];
    o.innerHTML = '';
    items.forEach(([k, label, val, fn]) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn';
      b.innerHTML = esc(label) + ': <b>' + esc(val) + '</b>';
      b.onclick = () => { fn(); save(); RENDER.opts(); };
      o.appendChild(b);
    });
    const r = document.createElement('button'); r.type = 'button'; r.className = 'btn'; r.style.color = 'var(--warn)'; r.style.borderColor = 'var(--warn)';
    r.textContent = 'wipe the save';
    r.onclick = () => confirmBox('WIPE?', 'Credits, cards, records and the story start over.', () => { store.del('pazaak-v1'); store.del('pazaak-match'); location.reload(); });
    o.appendChild(r);
  };
  function fastLabel() { $('#b-fast').textContent = 'speed ×' + (S.set.fast ? 2 : 1); $('#b-fast').setAttribute('aria-pressed', S.set.fast ? 'true' : 'false'); }
  function redrawPortraits() { if (G && screen === 'table') paintOpp({}); if (screen === 'ladder') RENDER.ladder(); if (screen === 'menu') paintMenuFace(); }

  // ============================================================
  // WIRING
  // ============================================================
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => show(b.dataset.go)));
  $('#b-menu').onclick = () => { if (screen === 'table') saveMatch(); show('menu'); };
  $('#b-theme').onclick = () => { setTheme(document.documentElement.dataset.theme === 'amber' ? 'green' : 'amber', true); degauss(); sfx('glitch'); };
  $('#b-sound').onclick = toggleSound;
  $('#m-play').onclick = async () => {
    if (!S.seen.prologue) { await scene(STORY.prologue); S.seen.prologue = 1; save(); }
    show('ladder');
  };
  $('#m-resume').onclick = () => { const sv = store.get('pazaak-match', null); if (!sv) return; G = sv; shownSeat = G.cfg.mode === 'hotseat' ? G.m.turn : 0; $('#log').innerHTML = ''; log('— resumed', 's'); enterTable(); };
  $('#m-daily').onclick = () => {
    const d = today(), deck = dailyDeck(d), rec = S.daily[d];
    const ov = document.createElement('div'); ov.className = 'ov';
    ov.innerHTML = '<div class="panel"><h3 style="font-size:34px">DAILY TRANSMISSION</h3><p class="note">' + d + ' · vs HK-47 · the same main deck, the same hands, for everyone today. No advisor. No credits at stake; the first win of the day pays ¤150.</p><p>Today\'s side deck:</p><div class="ex" style="display:flex;flex-wrap:wrap;gap:4px;--w:44px"></div>' +
      (rec && rec.first ? '<p class="note" style="margin-top:8px">Your first attempt today: ' + (rec.first.won ? 'won ' : 'lost ') + rec.first.score.join('–') + '</p>' : '') +
      '<div class="row"><button class="btn pri" type="button" data-go>deal</button><button class="btn" data-esc type="button">back</button></div></div>';
    deck.forEach((n) => { const c = cardEl({ name: n }); c.style.setProperty('--w', '44px'); $('.ex', ov).appendChild(c); });
    $('#ovs').appendChild(ov);
    ov.addEventListener('click', (e) => { if (e.target.tagName !== 'BUTTON') return; ov.remove(); if ('go' in e.target.dataset) startMatch({ mode: 'daily', opp: 'hk', date: d, seed: 'pazaak-daily:' + d, seats: ['human', 'ai'], wager: 0 }); });
  };
  $('#m-hot').onclick = () => { if (S.deck.length !== 10) { show('deck'); return; } startMatch({ mode: 'hotseat', opp: null, seats: ['human', 'human'], deck2: S.deck.slice(), wager: 0 }); };
  $('#m-deck').onclick = () => show('deck');
  $('#m-shop').onclick = () => show('shop');
  $('#m-rec').onclick = () => show('rec');
  $('#m-rules').onclick = () => show('rules');
  $('#m-opts').onclick = () => show('opts');
  $('#d-auto').onclick = autoDeck;
  $('#d-clear').onclick = () => { S.deck = []; save(); RENDER.deck(); };
  $('#b-end').onclick = () => humanAct({ type: 'end' });
  $('#b-stand').onclick = () => humanAct({ type: 'stand' });
  $('#b-adv').onclick = () => { S.set.advisor = !S.set.advisor; save(); advisor(); };
  $('#b-log').onclick = () => $('#drawer').classList.toggle('open');
  $('#b-logx').onclick = () => $('#drawer').classList.remove('open');
  $('#b-fast').onclick = () => { S.set.fast = !S.set.fast; save(); fastLabel(); };
  $('#b-quit').onclick = forfeit;
  document.addEventListener('pointerdown', (e) => {
    if (sel >= 0 && screen === 'table' && !(e.target.closest && e.target.closest('#hand, #choices'))) { sel = -1; choices(); }
    if (tipEl && !tipEl.hidden && !(e.target.closest && e.target.closest('.deckview, .coll'))) hideTip();
    try { if (window.PazaakSfx) PazaakSfx.unlock(); } catch (e) {} if (S.set.tilt) startGyro(); }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // a coach mark: Enter or Space is got it, Escape is skip
    if (coachNow) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); coachNow.next(); } else if (e.key === 'Escape') coachNow.skip(); return; }
    if ($('#ovs').children.length) { if (e.key === 'Escape') { const x = $('#ovs > :last-child [data-esc]'); if (x) x.click(); } return; }
    const k = e.key.toLowerCase();
    if (recapNow && (k === 'enter' || k === ' ')) { e.preventDefault(); recapNow.end(true); return; }
    if (k === 'm') { toggleSound(); return; }
    if (k === 'escape') { if ($('#drawer').classList.contains('open')) $('#drawer').classList.remove('open'); else if (screen === 'table' && sel >= 0) { sel = -1; choices(); } else if (screen === 'table') { saveMatch(); show('menu'); } else if (screen !== 'menu' && screen !== 'boot') show('menu'); return; }
    if (k === '?' && screen !== 'table') { show('rules'); return; }
    if (screen !== 'table') return;
    if (k === 'l') { $('#drawer').classList.toggle('open'); return; }
    if (k === 'a') { $('#b-adv').click(); return; }
    if (k === 'f') { $('#b-fast').click(); return; }
    if (!myTurn()) return;
    if (k === 'e') humanAct({ type: 'end' });
    else if (k === 's') humanAct({ type: 'stand' });
    else if (/^[1-4]$/.test(k)) { if (G.m.hands[shownSeat][+k - 1]) choose(+k - 1); }
    else if (sel >= 0 && ((k === 'enter' && !(e.target.closest && e.target.closest('button, .pc'))) || k === '+' || k === '=' || k === '-' || k === '_')) {
      const plays = E.legalPlays(G.m, shownSeat).filter((p) => p.handIndex === sel);
      if (!plays.length) return;
      let p = plays[0];
      if (k === '-' || k === '_') p = plays.find((x) => x.choice < 0) || p;
      if (k === '+' || k === '=') p = plays.find((x) => x.choice > 0) || p;
      e.preventDefault();
      humanAct({ type: 'play', handIndex: p.handIndex, choice: p.choice });
    }
  });

  // ============================================================
  // BOOT
  // ============================================================
  async function boot() {
    const canvas = $('#fx');
    fx('init', canvas);
    setTheme(store.get('phosphor-v2', 'amber'), false);
    setMotion(S.set.motion);
    fastLabel(); soundLabel(); credits(0);
    const seen = (() => { try { return sessionStorage.getItem('pz-boot'); } catch (e) { return null; } })();
    if (seen || !S.set.motion) { show('menu'); glitchLogo(); return; }
    try { sessionStorage.setItem('pz-boot', '1'); } catch (e) {}
    const L = $('#bootlog');
    const lines = [['TGGR-LINK TERMINAL · INTERFACE 1138', 'hd'], ['cargo hold, deck four .......... ', 'ok', 'online'], ['pazaak.sys ...................... ', 'ok', 'loaded'], ['card shuffler calibration ....... ', 'ok', 'ok'], ['side deck ....................... ', 'ok', S.deck.length + ' cards'], ['credit balance .................. ', 'ok', '¤' + S.credits], ['HK-47 ........................... ', 'bad', 'hostile'], ['camille ......................... ', 'ok', 'on the deck'], ['> table ready', 'hd']];
    let skip = false;
    const go = () => { skip = true; };
    addEventListener('pointerdown', go, { once: true }); addEventListener('keydown', go, { once: true });
    for (const [t, cls, tail] of lines) {
      if (skip) break;
      const s = document.createElement('span'); s.className = cls === 'hd' ? 'hd' : ''; L.appendChild(s);
      for (let i = 0; i <= t.length && !skip; i += 3) { s.textContent = t.slice(0, i); await wait(8); }
      s.textContent = t;
      if (tail) { const r = document.createElement('span'); r.className = cls; r.textContent = tail; L.appendChild(r); }
      L.appendChild(document.createTextNode('\n'));
      await wait(skip ? 0 : 90);
    }
    if (!skip) await wait(350);
    show('menu'); glitchLogo();
  }
  function glitchLogo() {
    if (!S.set.motion) return;
    const h = $('#logo'), spans = $$('span', h);
    // now and then a letter of the logo slips on the tube
    setInterval(() => {
      if (screen !== 'menu' || Math.random() > .35) return;
      const s = pick(spans); s.style.animation = 'none'; void s.offsetWidth; s.style.animation = 'tear .32s steps(2) 1';
    }, 1600);
  }
  if (!E) { document.body.insertAdjacentHTML('beforeend', '<p style="position:fixed;bottom:20px;left:20px">engine.js did not load.</p>'); return; }
  boot();
  if (/[?&]debug/.test(location.search)) window.PZ = { S, get G() { return G; }, E, scene, STORY, startMatch, challenge, show, unlock };
})();
