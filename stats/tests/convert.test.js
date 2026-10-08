import { test, eq, close, ok } from './assert.js';
import { CONVERTERS, getConverter, defaults } from '../js/convert.js';
import { fmt, fmtSci, fmtPlain, parseNumber, oneIn, perN, pct, fmtE } from '../js/format.js';

test('every converter runs on its defaults without error', () => {
    for (const c of CONVERTERS) {
        const r = c.compute(defaults(c));
        ok(!r.error, `${c.id}: ${r.error}`);
        ok(r.outputs && r.outputs.length > 0, `${c.id} has outputs`);
        ok(r.outputs.every(o => typeof o.value === 'string' && !o.value.includes('NaN') && !o.value.includes('undefined')), `${c.id} outputs are clean`);
        ok(!(r.text || '').includes('NaN'), `${c.id} text is clean`);
    }
});

test('converter ids are unique and URL-safe', () => {
    const ids = CONVERTERS.map(c => c.id);
    eq(new Set(ids).size, ids.length, 'unique');
    ok(ids.every(id => /^[a-z0-9]+$/.test(id)), 'lowercase alphanumerics');
});

test('odds ratio converter: OR 2.5 at 10% baseline', () => {
    const r = getConverter('or').compute({ mode: 'or', x: 2.5, p0: 10 });
    eq(r.outputs[0].value, '21.7%', 'risk in exposed');
    eq(r.outputs[1].value, '2.17', 'RR');
    ok(r.text.includes('22 in 100'), 'natural frequency in text');
    ok(!r.warn, 'no warning at 10%');
    const w = getConverter('or').compute({ mode: 'or', x: 3, p0: 40 });
    ok(w.warn, 'warns when outcome is common');
    const bad = getConverter('or').compute({ mode: 'rr', x: 5, p0: 30 });
    ok(bad.error, 'impossible RR errors');
});

test('log fold change converter', () => {
    const r = getConverter('lfc').compute({ mode: 'log2', x: -1 });
    eq(r.outputs[0].value, '0.5', 'FC');
    eq(r.outputs[1].value, '−50%', 'percent');
    const r2 = getConverter('lfc').compute({ mode: 'pct', x: 150 });
    eq(r2.outputs[0].value, '2.5', 'FC from +150%');
    ok(Math.abs(parseFloat(r2.outputs[2].value) - Math.log2(2.5)) < 1e-2, 'log2 of 2.5');
});

test('scientific notation parsing', () => {
    close(parseNumber('3.2e-5'), 3.2e-5, 1e-12);
    close(parseNumber('3.2×10^-5'), 3.2e-5, 1e-12);
    close(parseNumber('3.2 x 10^-5'), 3.2e-5, 1e-12);
    close(parseNumber('10^-5'), 1e-5, 1e-12);
    close(parseNumber('3.2·10⁻⁵'), 3.2e-5, 1e-12);
    close(parseNumber('0.000032'), 3.2e-5, 1e-12);
    close(parseNumber('1 in 31,250'), 3.2e-5, 1e-12);
    close(parseNumber('1/2500'), 4e-4, 1e-12);
    close(parseNumber('0.0032%'), 3.2e-5, 1e-12);
    close(parseNumber('50 per 100000'), 5e-4, 1e-12);
    ok(Number.isNaN(parseNumber('hello')), 'garbage is NaN');
    ok(Number.isNaN(parseNumber('')), 'empty is NaN');
});

test('number formatting', () => {
    eq(fmt(1234.5678), '1,235');
    eq(fmt(0.00123), '0.00123');
    eq(fmt(3.2e-5), '3.2 × 10⁻⁵');
    eq(fmtSci(0.05, 2), '5 × 10⁻²');
    eq(fmtPlain(3.2e-5), '0.000032');
    eq(fmtPlain(1.5e24, 3), '1,500,000,000,000,000,000,000,000');
    eq(fmtE(3.2e-5), '3.2e-5');
    eq(oneIn(3.2e-5), '1 in 31,000');
    eq(oneIn(0.25), '1 in 4');
    eq(perN(0.2174), '22 in 100');
    eq(pct(0.2174), '21.7%');
    eq(fmt(Infinity), '∞');
    eq(fmt(NaN), '–');
});

test('sci converter reads a p-value', () => {
    const r = getConverter('sci').compute({ x: '5e-8' });
    ok(r.text.includes('genome-wide'), 'mentions GWAS threshold');
    eq(r.outputs[0].value, '0.00000005', 'written out');
});

test('CI ↔ p round trip in the converter', () => {
    const r = getConverter('cip').compute({ mode: 'ci', scale: 'ratio', est: 0.81, lo: 0.70, hi: 0.94, level: 95 });
    ok(r.outputs[2].value.startsWith('0.005'), `p ≈ 0.005, got ${r.outputs[2].value}`);
    const back = getConverter('cip').compute({ mode: 'p', scale: 'ratio', est: 0.81, p: r.outputs[2].value, level: 95 });
    const [lo, hi] = back.outputs[2].value.split(' to ').map(parseFloat);
    close(lo, 0.70, 0.005, 'CI back lower');
    close(hi, 0.94, 0.005, 'CI back upper');
});

test('multiple testing converter', () => {
    const r = getConverter('mt').compute({ ps: '0.001, 0.01; 0.02\n0.5', m: '', alpha: 0.05 });
    eq(r.outputs[0].value, '4', 'm');
    eq(r.outputs[1].value, '3', 'raw');
    eq(r.outputs[2].value, '2', 'bonferroni: 0.004, 0.04 pass');
    eq(r.outputs[4].value, '3', 'BH: 0.004, 0.02, 0.0267 pass');
    const t = getConverter('mt').compute({ ps: '', m: '20', alpha: 0.05 });
    eq(t.outputs[0].value, '2.5 × 10⁻³', 'threshold');
});

test('diagnostic converter natural frequencies', () => {
    const r = getConverter('dx').compute({ sens: 90, spec: 95, prev: '1%', pop: 1000 });
    ok(r.text.includes('Of 1,000 people, 10 have the disease'), r.text);
    eq(r.table.rows[0][1], '9', 'true positives');
    eq(r.table.rows[0][2], '50', 'false positives (49.5 rounded)');
});

test('HWE from 1 in 2500 prevalence', () => {
    const r = getConverter('hwe').compute({ mode: 'prev', x: '1 in 2500' });
    eq(r.outputs[0].value, '0.02', 'q');
    eq(r.outputs[1].note, '1 in 26', 'carriers (1/0.0392)');
});

test('inputs with show() hide cleanly and unused values do not break compute', () => {
    const pz = getConverter('pz');
    const r = pz.compute({ mode: 'chi2', x: '3.84', df1: 1, fdf1: 2, fdf2: 30, tails: '2' });
    ok(r.outputs[0].value.startsWith('0.05'), 'chi2 3.84 on 1 df ≈ 0.05');
    const f = pz.compute({ mode: 'f', x: '4.96', df1: 20, fdf1: 1, fdf2: 10, tails: '1' });
    ok(f.outputs[0].value.startsWith('0.05'), 'F 4.96 on 1,10 ≈ 0.05');
    const n = pz.compute({ mode: 'nlp', x: '7.3', tails: '2' });
    eq(n.outputs[0].note.split(' ')[0] + ' ' + n.outputs[0].note.split(' ')[1] + ' ' + n.outputs[0].note.split(' ')[2], '5 × 10⁻⁸', '−log10 7.3 → 5e-8');
});
