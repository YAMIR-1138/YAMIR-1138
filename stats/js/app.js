/**
 * app.js - wires the data modules to the page: renders the chooser, the
 * converters and the reference tables, and handles search, theme and
 * shareable links (#c=or&x=2.5 opens a converter with those numbers,
 * #t=welch_t opens a catalog entry, #q=compare.continuous.two... fills the
 * questionnaire).
 */

import { CONVERTERS, getConverter } from './convert.js';
import { TESTS, questions, recommend } from './chooser.js';
import * as REF from './reference.js';

// ---------------------------------------------------------------- helpers

const $ = (sel, root = document) => root.querySelector(sel);

/** h('div.card', {attr: value, onclick: fn}, child, child...) */
function h(tag, attrs = {}, ...children) {
    const [name, ...classes] = tag.split('.');
    const el = document.createElement(name || 'div');
    if (classes.length) el.className = classes.join(' ');
    for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'dataset') Object.assign(el.dataset, v);
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
    }
    for (const c of children.flat()) {
        if (c === null || c === undefined || c === false) continue;
        el.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return el;
}

function copyText(text, btn) {
    const done = () => {
        if (!btn) return;
        const old = btn.textContent;
        btn.textContent = 'copied';
        setTimeout(() => { btn.textContent = old; }, 1200);
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, done);
    else {
        const ta = h('textarea', { style: 'position:fixed;opacity:0' }, text);
        document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        ta.remove(); done();
    }
}

function table(spec, { rowAttrs } = {}) {
    return h('table', {},
        h('thead', {}, h('tr', {}, spec.head.map(c => h('th', {}, c)))),
        h('tbody', {}, spec.rows.map(r => h('tr', { dataset: { searchable: '' }, ...(rowAttrs ? rowAttrs(r) : {}) }, r.map((c, i) => h('td', { class: spec.cellClass ? spec.cellClass(i) : undefined }, spec.code && spec.code.includes(i) && c ? h('code', {}, c) : c))))));
}

function codeBlock(label, code) {
    const btn = h('button.btn.btn--small', { type: 'button', onclick: () => copyText(code, btn) }, 'copy');
    return h('div.code', {}, h('div.code__bar', {}, h('span', {}, label), btn), h('pre', {}, code));
}

// -------------------------------------------------------------- the state
const hashState = parseHash();

function parseHash() {
    const raw = location.hash.replace(/^#/, '');
    if (!raw.includes('=')) return {};
    return Object.fromEntries(new URLSearchParams(raw));
}

function setHash(params) {
    const qs = new URLSearchParams(params).toString();
    history.replaceState(null, '', `${location.pathname}${location.search}#${qs}`);
    return `${location.origin}${location.pathname}${location.search}#${qs}`;
}

// --------------------------------------------------------------- chooser
const answers = {};
let shownTest = null; // a catalog key the user clicked, overriding the pick

function testCard(key, { kicker, alternatives = [], notes = [], onPick } = {}) {
    const t = TESTS[key];
    const alt = t.alt ? TESTS[t.alt] : null;
    return h('article.card.test', { dataset: { searchable: '', test: key } },
        kicker ? h('div.test__kicker', {}, kicker) : null,
        h('h3', {}, t.name),
        h('p.test__use', {}, t.use),
        h('dl', {},
            h('div', {}, h('dt', {}, 'Assumptions'), h('dd', {}, h('ul', {}, t.assumptions.map(a => h('li', {}, a))))),
            h('div', {}, h('dt', {}, 'Report this effect size'), h('dd', {}, t.effect)),
            h('div', {}, h('dt', {}, 'Write it like'), h('dd', {}, h('blockquote', {}, t.report))),
            alt ? h('div', {}, h('dt', {}, 'If the assumptions fail'), h('dd', {}, h('button.chip', { type: 'button', onclick: () => onPick && onPick(t.alt) }, alt.name))) : null,
            t.notes ? h('div', {}, h('dt', {}, 'Note'), h('dd', {}, t.notes)) : null,
            notes.length ? h('div', {}, h('dt', {}, 'For your design'), h('dd', {}, h('ul', {}, notes.map(n => h('li', {}, n))))) : null,
        ),
        h('div.codes', {}, codeBlock('R', t.r), codeBlock('Python', t.py)),
        alternatives.length ? h('div.chips', {}, h('span', { style: 'font-size:12.5px;color:var(--fg-3)' }, 'Also consider:'), alternatives.map(k => h('button.chip', { type: 'button', onclick: () => onPick && onPick(k) }, TESTS[k].name))) : null,
    );
}

function renderChooser() {
    const form = $('#chooser-form');
    const result = $('#chooser-result');
    form.replaceChildren();
    const qs = questions(answers);
    qs.forEach((q, i) => {
        const done = Boolean(answers[q.key]);
        form.append(h('fieldset.q', { class: done ? 'q q--done' : 'q' },
            h('legend', {}, `${i + 1}. ${q.label}`),
            q.options.map(([value, label, hint]) => h('label', {},
                h('input', { type: 'radio', name: q.key, value, checked: answers[q.key] === value, onchange: () => answer(q.key, value) }),
                h('span', {}, label, hint ? h('small', {}, hint) : null),
            )),
        ));
    });
    if (Object.keys(answers).length) {
        form.append(h('div.chooser__actions', {},
            h('button.btn', { type: 'button', onclick: () => { for (const k in answers) delete answers[k]; shownTest = null; setHash({}); renderChooser(); } }, 'Start over'),
            h('button.btn', { type: 'button', onclick: (e) => { const q = qs.map(q => answers[q.key]).filter(Boolean).join('.'); copyText(setHash({ q }), e.currentTarget); } }, 'Copy link'),
        ));
    }

    result.replaceChildren();
    const rec = recommend(answers);
    if (shownTest && TESTS[shownTest]) {
        result.append(testCard(shownTest, {
            kicker: rec && rec.primary === shownTest ? 'Recommended' : 'From the catalog',
            alternatives: rec ? [rec.primary, ...rec.alternatives].filter(k => k !== shownTest) : [],
            notes: rec && rec.primary === shownTest ? rec.notes : [],
            onPick: showTest,
        }));
    } else if (rec) {
        result.append(testCard(rec.primary, { kicker: 'Recommended', alternatives: rec.alternatives, notes: rec.notes, onPick: showTest }));
    } else {
        const next = qs.find(q => !answers[q.key]);
        result.append(h('p.placeholder', {}, next ? `Answer “${next.label}” to continue.` : 'Pick an option to begin.'));
    }
}

function answer(key, value) {
    answers[key] = value;
    shownTest = null;
    // drop answers to questions that no longer apply
    const keep = new Set(questions(answers).map(q => q.key));
    for (const k of Object.keys(answers)) if (!keep.has(k)) delete answers[k];
    renderChooser();
}

function showTest(key) {
    shownTest = key;
    renderChooser();
    $('#chooser-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderCatalog() {
    const list = $('#catalog-list');
    list.className = 'catalog__list';
    const keys = Object.keys(TESTS).sort((a, b) => TESTS[a].name.localeCompare(TESTS[b].name));
    for (const key of keys) {
        const t = TESTS[key];
        list.append(h('details.catalog__item', { id: `t-${key}`, dataset: { searchable: '' } },
            h('summary', {}, t.name, h('small', {}, t.use.length > 90 ? t.use.slice(0, 88) + '…' : t.use)),
            testCard(key, { onPick: showTest }),
        ));
    }
}

// ------------------------------------------------------------- converters
function converterCard(conv) {
    const values = {};
    const fieldEls = {};
    const body = h('div.card__body');
    const fields = h('div.fields');

    for (const inp of conv.inputs) {
        const id = `${conv.id}-${inp.key}`;
        values[inp.key] = hashState.c === conv.id && hashState[inp.key] !== undefined ? hashState[inp.key] : inp.default;
        let control;
        if (inp.type === 'select') {
            control = h('select', { id }, inp.options.map(([v, l]) => h('option', { value: v, selected: String(values[inp.key]) === String(v) }, l)));
        } else if (inp.type === 'textarea') {
            control = h('textarea', { id, rows: 3 }, values[inp.key]);
        } else if (inp.type === 'text') {
            control = h('input', { id, type: 'text', value: values[inp.key] });
        } else {
            control = h('input', { id, type: 'number', value: values[inp.key], step: inp.step ?? 'any', min: inp.min, max: inp.max, inputmode: 'decimal' });
        }
        control.addEventListener('input', () => { values[inp.key] = control.type === 'number' ? parseFloat(control.value) : control.value; update(); });
        if (control.tagName === 'SELECT') control.addEventListener('change', () => { values[inp.key] = control.value; update(); });
        const wrap = h('div.field', { class: inp.type === 'textarea' ? 'field field--wide' : 'field' }, h('label', { for: id }, inp.label), control);
        fieldEls[inp.key] = wrap;
        fields.append(wrap);
    }

    const linkBtn = h('button.btn.btn--small', { type: 'button', onclick: () => {
        const params = { c: conv.id };
        for (const inp of conv.inputs) if (String(values[inp.key]) !== String(inp.default) && !(inp.show && !inp.show(values))) params[inp.key] = values[inp.key];
        copyText(setHash(params), linkBtn);
    } }, 'copy link');

    const card = h('article.card', { id: `c-${conv.id}`, dataset: { searchable: '' } },
        h('div.card__head', {}, h('h3', {}, conv.title)),
        h('p.card__blurb', {}, conv.blurb),
        fields,
        body,
        h('div.card__foot', {}, h('details', {}, h('summary', {}, 'How it is computed'), h('p', {}, conv.notes)), linkBtn),
    );

    function update() {
        for (const inp of conv.inputs) fieldEls[inp.key].hidden = Boolean(inp.show && !inp.show(values));
        let r;
        try { r = conv.compute({ ...values }); } catch (e) { r = { error: 'Something went wrong with these inputs.' }; console.error(conv.id, e); }
        body.replaceChildren();
        if (r.error) { body.append(h('p.err', {}, r.error)); return; }
        body.append(h('dl.out', {}, r.outputs.map(o => h('div', {}, h('dt', {}, o.label), h('dd', {}, o.value, o.note ? h('small', {}, o.note) : null)))));
        if (r.table) body.append(h('div.table-wrap', { style: 'margin-top:10px' }, table(r.table)));
        if (r.text) body.append(h('p.plain', {}, r.text));
        if (r.warn) body.append(h('p.warn', {}, r.warn));
    }
    update();
    return card;
}

function renderConverters() {
    const root = $('#converters');
    const groups = [...new Set(CONVERTERS.map(c => c.group))];
    for (const g of groups) {
        root.append(h('div.group', { dataset: { group: g } },
            h('h3.group__title', {}, g),
            h('div.cards', {}, CONVERTERS.filter(c => c.group === g).map(converterCard)),
        ));
    }
}

// -------------------------------------------------------------- reference
function renderReference() {
    $('#models-table').append(table({ ...REF.MODELS, code: [4, 5] }));
    $('#phrases-table').append(h('table.phrases', {},
        h('thead', {}, h('tr', {}, h('th', {}, 'You see'), h('th', {}, 'It means'), h('th', {}, 'It does not mean'))),
        h('tbody', {}, REF.PHRASES.map(p => h('tr', { dataset: { searchable: '' } }, h('td', {}, p.term), h('td.yes', {}, p.yes), h('td.no', {}, p.no))))));
    $('#benchmarks-table').append(table(REF.BENCHMARKS));
    $('#benchmarks-note').textContent = REF.BENCHMARKS.note;
    $('#assumptions-table').append(table({ head: ['Assumption', 'How to check', 'If it fails'], rows: REF.ASSUMPTIONS }));
    $('#pitfalls').append(...REF.PITFALLS.map(([t, d]) => h('article.card.card--text', { dataset: { searchable: '' } }, h('h4', {}, t), h('p', {}, d))));
    $('#reporting').append(...REF.REPORTING.map(([t, what, ex]) => h('article.card.card--text', { dataset: { searchable: '' } }, h('h4', {}, t), h('p', {}, what), h('blockquote', { class: 'plain', style: 'margin:8px 0 0' }, ex))));
    $('#distributions-table').append(table(REF.DISTRIBUTIONS));
    $('#glossary').append(...REF.GLOSSARY.map(([t, d]) => h('div', { dataset: { searchable: '' } }, h('dt', {}, t), h('dd', {}, d))));
}

// ------------------------------------------------------------------ search
function setupSearch() {
    const input = $('#search');
    const count = $('#search-count');
    const none = $('#no-results');
    let timer;
    const items = () => document.querySelectorAll('[data-searchable]');

    function apply() {
        const q = input.value.trim().toLowerCase();
        let shown = 0;
        for (const el of items()) {
            const hit = !q || el.textContent.toLowerCase().includes(q);
            el.hidden = !hit;
            if (hit) shown++;
            if (q && hit && el.tagName === 'DETAILS' && !el.closest('[data-searchable] [data-searchable]')) el.open = true;
        }
        // hide empty groups, sections and headings while searching
        for (const g of document.querySelectorAll('.group')) g.hidden = Boolean(q) && !g.querySelector('[data-searchable]:not([hidden])');
        for (const wrap of document.querySelectorAll('.table-wrap, .cards--text, .glossary')) {
            const empty = Boolean(q) && wrap.querySelector('[data-searchable]') && !wrap.querySelector('[data-searchable]:not([hidden])');
            wrap.hidden = empty;
            const heading = wrap.previousElementSibling && wrap.previousElementSibling.tagName === 'H3' ? wrap.previousElementSibling : null;
            if (heading) heading.hidden = empty;
            if (wrap.id === 'benchmarks-table') $('#benchmarks-note').hidden = empty;
        }
        $('#catalog').open = Boolean(q) && Boolean($('#catalog-list [data-searchable]:not([hidden])'));
        $('.hero').hidden = Boolean(q);
        $('.chooser').hidden = Boolean(q);
        for (const s of document.querySelectorAll('.section')) s.hidden = Boolean(q) && !s.querySelector('[data-searchable]:not([hidden])');
        count.textContent = q ? `${shown}` : '';
        none.hidden = !q || shown > 0;
    }
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(apply, 120); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.value = ''; apply(); input.blur(); } });
    document.addEventListener('keydown', (e) => {
        if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) { e.preventDefault(); input.focus(); input.select(); }
    });
}

// ------------------------------------------------------------------- theme
function setupTheme() {
    const btn = $('#theme');
    btn.addEventListener('click', () => {
        const dark = matchMedia('(prefers-color-scheme: dark)').matches;
        const current = document.documentElement.getAttribute('data-theme') || (dark ? 'dark' : 'light');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try { localStorage.setItem('statsheet-theme', next); } catch (e) { /* private mode */ }
    });
}

// ------------------------------------------------------------------- start
renderChooser();
renderCatalog();
renderConverters();
renderReference();
setupSearch();
setupTheme();

// deep links
if (hashState.c && getConverter(hashState.c)) {
    const card = $(`#c-${hashState.c}`);
    if (card) {
        card.classList.add('card--flash');
        requestAnimationFrame(() => card.scrollIntoView({ block: 'start' }));
        setTimeout(() => card.classList.remove('card--flash'), 3000);
    }
} else if (hashState.t && TESTS[hashState.t]) {
    showTest(hashState.t);
} else if (hashState.q) {
    // replay the answers in order: each answer may reveal the next question
    const vals = hashState.q.split('.');
    for (const v of vals) {
        const next = questions(answers).find(q => !answers[q.key]);
        if (!next || !next.options.some(o => o[0] === v)) break;
        answers[next.key] = v;
    }
    renderChooser();
    $('#chooser').scrollIntoView({ block: 'start' });
}
