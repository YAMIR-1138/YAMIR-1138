/**
 * convert.js - the converters. Each one is data plus a compute function;
 * app.js renders them all from this list, so adding a converter means
 * adding an object here.
 *
 *   id       short, unique; used in the URL (#c=or&x=2.5)
 *   group    heading the card is filed under
 *   inputs   { key, label, type?: 'number'|'select'|'text'|'textarea',
 *              default, min?, max?, step?, options?: [[value, label]],
 *              show?: (values) => boolean }
 *   compute  (values) => { outputs: [{label, value, note?}], text?, warn?,
 *                          table?: {head, rows}, error? }
 *   notes    the formula and where it comes from
 */

import * as S from './stats.js';
import {
    fmt, fmtSci, fmtE, fmtPlain, pct, oneIn, perN, pp, signed, stars, fmtP,
    parseNumber, oddsRatioText, benchmark, group,
} from './format.js';

const num = (v) => (typeof v === 'number' ? v : parseNumber(v));
const need = (...vals) => vals.every(v => Number.isFinite(v));

export const CONVERTERS = [

    // ---------------------------------------------------------------- risk
    {
        id: 'or',
        group: 'Risk and odds',
        title: 'Odds ratio or risk ratio → plain language',
        blurb: 'What an OR actually means for people, given how common the outcome is to begin with.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'or', options: [['or', 'an odds ratio (OR)'], ['rr', 'a risk ratio (RR)']] },
            { key: 'x', label: 'Value', default: 2.5, min: 0, step: 0.1 },
            { key: 'p0', label: 'Baseline risk in the unexposed / control group (%)', default: 10, min: 0, max: 100, step: 0.5 },
        ],
        compute({ mode, x, p0 }) {
            x = num(x); p0 = num(p0) / 100;
            if (!need(x, p0) || x <= 0 || p0 <= 0 || p0 >= 1) return { error: 'Need a positive ratio and a baseline risk between 0 and 100%.' };
            let or, rr, p1;
            if (mode === 'or') {
                or = x; p1 = S.riskFromOR(or, p0); rr = p1 / p0;
            } else {
                rr = x; p1 = rr * p0;
                if (p1 >= 1) return { error: `A risk ratio of ${fmt(rr)} is impossible at a ${pct(p0)} baseline: it would push the exposed risk past 100%.` };
                or = S.orFromRR(rr, p0);
            }
            const ard = p1 - p0;
            const nnt = Math.abs(ard) > 0 ? 1 / Math.abs(ard) : Infinity;
            const harm = ard > 0;
            const d = S.dFromOR(or);
            const outputs = [
                { label: 'Risk in the exposed group', value: pct(p1), note: perN(p1) },
                { label: 'Risk ratio (RR)', value: fmt(rr), note: `${fmt(Math.abs(rr - 1) * 100, 3)}% ${rr >= 1 ? 'higher' : 'lower'} risk` },
                { label: 'Odds ratio (OR)', value: fmt(or), note: `${fmt(Math.abs(or - 1) * 100, 3)}% ${or >= 1 ? 'higher' : 'lower'} odds` },
                { label: 'Absolute risk difference', value: pp(ard), note: `${pct(p0)} → ${pct(p1)}` },
                { label: harm ? 'Number needed to harm (NNH)' : 'Number needed to treat (NNT)', value: fmt(nnt, 3), note: Number.isFinite(nnt) ? `one ${harm ? 'extra' : 'fewer'} case per ${fmt(Math.ceil(nnt), 3)} people` : 'no difference' },
                { label: 'Equivalent Cohen’s d', value: signed(d, 2), note: benchmark(d, [0.2, 0.5, 0.8]) },
            ];
            const text = `If ${perN(p0)} unexposed people have the outcome, ${mode === 'or' ? 'an OR' : 'an RR'} of ${fmt(x)} means about ${perN(p1)} exposed people do. ` +
                `That is ${fmt(rr)} times the risk (${fmt(Math.abs(rr - 1) * 100, 3)}% ${rr >= 1 ? 'more' : 'less'}), ` +
                `${fmt(Math.abs(ard) * 100, 3)} percentage points ${harm ? 'more' : 'fewer'}` +
                (Number.isFinite(nnt) ? `, or one ${harm ? 'extra' : 'fewer'} case for every ${fmt(Math.ceil(nnt), 3)} exposed people.` : '.');
            let warn;
            if (mode === 'or' && p0 > 0.1 && Math.abs(Math.log(or)) > 0.2) {
                warn = `The outcome is not rare (baseline ${pct(p0)}), so the OR of ${fmt(or)} is further from 1 than the RR of ${fmt(rr)}. Reading the OR as “${fmt(or)} times the risk” overstates the effect. Quote the RR or the absolute difference.`;
            }
            return { outputs, text, warn };
        },
        notes: 'p₁ = OR·p₀ / (1 − p₀ + OR·p₀). RR = p₁/p₀. NNT = 1/|p₁ − p₀|. d ≈ ln(OR)·√3/π (Chinn 2000). The OR approximates the RR only when the outcome is rare (p₀ ≲ 10%).',
    },

    {
        id: 'hr',
        group: 'Risk and odds',
        title: 'Hazard ratio → plain language',
        blurb: 'A hazard ratio compares instantaneous event rates. Here is what it means for survival times.',
        inputs: [
            { key: 'hr', label: 'Hazard ratio (HR)', default: 0.7, min: 0, step: 0.05 },
            { key: 'median0', label: 'Median survival in the control group (any time unit)', default: 12, min: 0, step: 1 },
            { key: 's0', label: 'Control-group survival at some time point (%)', default: 60, min: 0, max: 100, step: 1 },
        ],
        compute({ hr, median0, s0 }) {
            hr = num(hr); median0 = num(median0); s0 = num(s0) / 100;
            if (!need(hr) || hr <= 0) return { error: 'Need a positive hazard ratio.' };
            const pFirst = hr / (1 + hr);
            const change = (hr - 1) * 100;
            const outputs = [
                { label: 'Event rate in the treated group', value: `${fmt(Math.abs(change), 3)}% ${change >= 0 ? 'higher' : 'lower'}`, note: 'at any given moment, relative to control' },
                { label: 'P(treated patient has the event before a control patient)', value: pct(pFirst), note: 'holds under proportional hazards' },
            ];
            if (need(median0) && median0 > 0) {
                outputs.push({ label: 'Median survival, treated', value: fmt(median0 / hr), note: `vs ${fmt(median0)} in control; assumes a constant hazard` });
            }
            if (need(s0) && s0 > 0 && s0 < 1) {
                outputs.push({ label: 'Survival at that time, treated', value: pct(Math.pow(s0, hr)), note: `vs ${pct(s0)} in control; S₁(t) = S₀(t)^HR` });
            }
            const text = `An HR of ${fmt(hr)} means that at any moment, treated patients are having the event at ${fmt(hr)} times the control rate (${fmt(Math.abs(change), 3)}% ${change >= 0 ? 'faster' : 'slower'}). ` +
                `Pick one treated and one control patient at random: the treated one has the event first ${pct(pFirst)} of the time.` +
                (need(median0) && median0 > 0 ? ` If controls have a median survival of ${fmt(median0)}, treated patients have roughly ${fmt(median0 / hr)}.` : '');
            const warn = 'An HR is relative. Whether it matters depends on the absolute survival numbers, and it assumes the ratio is constant over time (proportional hazards). The median conversion also assumes an exponential survival curve.';
            return { outputs, text, warn };
        },
        notes: 'P(T₁ < T₀) = HR/(1 + HR) under proportional hazards. For exponential survival, median₁ = median₀/HR and S₁(t) = S₀(t)^HR.',
    },

    {
        id: 'odds',
        group: 'Risk and odds',
        title: 'Odds ↔ probability',
        blurb: 'Odds and probabilities get confused constantly. Convert either way.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'prob', options: [['prob', 'a probability (%)'], ['odds', 'odds (a number, or a:b)']] },
            { key: 'x', label: 'Value', type: 'text', default: '25' },
        ],
        compute({ mode, x }) {
            let p, odds;
            if (mode === 'prob') {
                p = num(x);
                if (Number.isFinite(p) && p > 1) p = p / 100;
                if (!need(p) || p < 0 || p > 1) return { error: 'Probability must be between 0 and 100%.' };
                odds = p / (1 - p);
            } else {
                const m = String(x).match(/^\s*([\d.]+)\s*[:/]\s*([\d.]+)\s*$/);
                odds = m ? parseFloat(m[1]) / parseFloat(m[2]) : num(x);
                if (!need(odds) || odds < 0) return { error: 'Odds must be a non-negative number or a ratio like 3:1.' };
                p = odds / (1 + odds);
            }
            return {
                outputs: [
                    { label: 'Probability', value: pct(p), note: p > 0 ? oneIn(p) : '' },
                    { label: 'Odds', value: fmt(odds), note: oddsRatioText(odds) },
                    { label: 'Log-odds (logit)', value: odds > 0 && Number.isFinite(odds) ? fmt(Math.log(odds)) : '–', note: 'what logistic regression works in' },
                ],
                text: `A probability of ${pct(p)} means ${perN(p)}: for every ${fmt(p * 100, 3)} who do, ${fmt((1 - p) * 100, 3)} do not. That is odds of ${oddsRatioText(odds)}.`,
            };
        },
        notes: 'odds = p/(1 − p); p = odds/(1 + odds); logit = ln(odds).',
    },

    {
        id: 'rate',
        group: 'Risk and odds',
        title: 'Incidence rate → cumulative risk',
        blurb: 'Turn “cases per 100,000 person-years” into the chance of it happening to one person over a span of years.',
        inputs: [
            { key: 'cases', label: 'Cases', default: 50, min: 0, step: 1 },
            { key: 'per', label: 'per how many person-years', default: 100000, min: 1, step: 1000 },
            { key: 'years', label: 'over how many years', default: 10, min: 0, step: 1 },
        ],
        compute({ cases, per, years }) {
            cases = num(cases); per = num(per); years = num(years);
            if (!need(cases, per, years) || per <= 0 || cases < 0) return { error: 'Need a non-negative case count and a positive denominator.' };
            const rate = cases / per;
            const annual = S.riskFromRate(rate, 1);
            const cum = S.riskFromRate(rate, years);
            return {
                outputs: [
                    { label: 'Rate', value: fmt(rate, 3) + ' per person-year', note: `${fmtSci(rate, 2)}` },
                    { label: 'Risk in one year', value: pct(annual), note: oneIn(annual) },
                    { label: `Risk over ${fmt(years)} years`, value: pct(cum), note: oneIn(cum) },
                    { label: 'Mean time to event if the rate never changed', value: rate > 0 ? fmt(1 / rate, 3) + ' years' : '∞', note: '1/λ, not a prediction for anyone in particular' },
                ],
                text: `${fmt(cases)} cases per ${group(String(per))} person-years means ${oneIn(annual)} people get it in a given year, and about ${perN(cum, 1000)} over ${fmt(years)} years (if the rate stays constant and nothing else gets them first).`,
            };
        },
        notes: 'Risk over time t = 1 − e^(−λt) for a constant rate λ. For small λt this is ≈ λt, which is why rate ratios ≈ risk ratios for rare events.',
    },

    // --------------------------------------------------------------- scales
    {
        id: 'lfc',
        group: 'Scales and notation',
        title: 'Log fold change ↔ fold change ↔ percent',
        blurb: 'log₂FC, ln, log₁₀, ratio, percent change: all the same thing in different clothes.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'log2', options: [['log2', 'a log₂ fold change'], ['ln', 'a natural-log fold change'], ['log10', 'a log₁₀ fold change'], ['fc', 'a fold change (ratio)'], ['pct', 'a percent change']] },
            { key: 'x', label: 'Value', default: 1.5, step: 0.1 },
        ],
        compute({ mode, x }) {
            x = num(x);
            if (!need(x)) return { error: 'Need a number.' };
            let fc;
            if (mode === 'log2') fc = Math.pow(2, x);
            else if (mode === 'ln') fc = Math.exp(x);
            else if (mode === 'log10') fc = Math.pow(10, x);
            else if (mode === 'fc') fc = x;
            else fc = 1 + x / 100;
            if (!(fc > 0)) return { error: 'A fold change must be positive (a percent change cannot go below −100%).' };
            const down = fc < 1;
            const times = down ? 1 / fc : fc;
            const change = (fc - 1) * 100;
            const text = fc === 1
                ? 'No change at all.'
                : down
                    ? `A fold change of ${fmt(fc)} is a ${fmt(times)}-fold decrease: ${fmt(Math.abs(change), 3)}% less, or ${fmt(fc * 100, 3)}% of the original.`
                    : `A fold change of ${fmt(fc)} is a ${fmt(times)}-fold increase: ${fmt(change, 3)}% more than the original.`;
            return {
                outputs: [
                    { label: 'Fold change', value: fmt(fc), note: down ? `${fmt(times)}× down` : `${fmt(times)}× up` },
                    { label: 'Percent change', value: `${signed(change, 3)}%`, note: `${fmt(fc * 100, 3)}% of the original` },
                    { label: 'log₂ fold change', value: signed(Math.log2(fc)), note: 'doubling = 1, 10× = 3.32' },
                    { label: 'ln fold change', value: signed(Math.log(fc)), note: '' },
                    { label: 'log₁₀ fold change', value: signed(Math.log10(fc)), note: '' },
                ],
                text,
            };
        },
        notes: 'FC = 2^(log₂FC) = e^(lnFC) = 10^(log₁₀FC). Percent change = (FC − 1)·100. A negative log fold change below −1 (log₂) is a decrease by more than half, not a negative amount.',
    },

    {
        id: 'sci',
        group: 'Scales and notation',
        title: 'Scientific notation ↔ plain number',
        blurb: 'Read 3.2e-5 as a number a human can picture. Also understands 3.2×10⁻⁵, 1 in 31250, and 0.003%.',
        inputs: [
            { key: 'x', label: 'Number, any notation', type: 'text', default: '3.2e-5' },
        ],
        compute({ x }) {
            const v = parseNumber(x);
            if (!need(v)) return { error: 'Could not read that as a number. Try 3.2e-5, 3.2×10^-5, 0.000032, 1 in 31250 or 0.0032%.' };
            const outputs = [
                { label: 'Written out', value: fmtPlain(v, 4), note: '' },
                { label: 'Scientific', value: fmtSci(v, 3), note: fmtE(v, 3) },
            ];
            if (v !== 0) outputs.push({ label: 'Order of magnitude', value: `10${(Math.floor(Math.log10(Math.abs(v))) < 0 ? '⁻' : '') + String(Math.abs(Math.floor(Math.log10(Math.abs(v))))).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c]).join('')}`, note: `${Math.floor(Math.log10(Math.abs(v)))} decimal places` });
            let text = '';
            if (v > 0 && v < 1) {
                outputs.push({ label: 'As a percentage', value: pct(v), note: '' });
                outputs.push({ label: 'As a frequency', value: oneIn(v), note: perN(v, v < 1e-3 ? 1000000 : 1000) });
                outputs.push({ label: '−log₁₀', value: fmt(-Math.log10(v)), note: 'the axis in Manhattan and volcano plots' });
                text = `Read as a p-value: if there were truly nothing going on, a result at least this extreme would turn up in about ${oneIn(v)} such experiments (${stars(v)}). ` +
                    (v <= 5e-8 ? 'This clears the genome-wide significance line (5 × 10⁻⁸).' : v < 0.05 ? 'That is below the usual 0.05 line, which says nothing about how big the effect is.' : 'Not below 0.05: the data are compatible with no effect, and also with a real one that this study could not pin down.');
            } else if (Math.abs(v) >= 1000) {
                text = `${fmtSci(v)} is ${fmtPlain(v, 4)}.`;
            }
            return { outputs, text };
        },
        notes: 'aeb means a × 10ᵇ. The exponent counts how many places the decimal point moves: negative to the left (small numbers), positive to the right.',
    },

    {
        id: 'phred',
        group: 'Scales and notation',
        title: 'Phred quality ↔ error probability',
        blurb: 'Base-call quality (Q), mapping quality (MAPQ) and variant QUAL all use the same log scale.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'q', options: [['q', 'a Phred score (Q)'], ['p', 'an error probability']] },
            { key: 'x', label: 'Value', type: 'text', default: '30' },
        ],
        compute({ mode, x }) {
            let q, p;
            if (mode === 'q') { q = num(x); if (!need(q) || q < 0) return { error: 'Need a non-negative Q.' }; p = S.phredToP(q); }
            else { p = num(x); if (!need(p) || p <= 0 || p > 1) return { error: 'Need an error probability between 0 and 1.' }; q = S.pToPhred(p); }
            return {
                outputs: [
                    { label: 'Phred score', value: fmt(q, 3), note: '' },
                    { label: 'Error probability', value: fmtSci(p, 2), note: oneIn(p) },
                    { label: 'Accuracy', value: pct(1 - p, 5), note: '' },
                ],
                text: `Q${fmt(q, 3)} means the call is wrong about ${oneIn(p)} times (${pct(1 - p, 5)} accurate). Every +10 is another factor of ten.`,
            };
        },
        notes: 'P(error) = 10^(−Q/10); Q = −10·log₁₀(P). Q10 = 1 in 10, Q20 = 1 in 100, Q30 = 1 in 1,000, Q40 = 1 in 10,000.',
    },

    // --------------------------------------------------------------- p and CI
    {
        id: 'pz',
        group: 'p-values and intervals',
        title: 'p-value ↔ test statistic',
        blurb: 'p from z, t, χ² or F, or z from p. Also −log₁₀(p) in either direction.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'z', options: [['z', 'a z statistic'], ['t', 'a t statistic'], ['chi2', 'a χ² statistic'], ['f', 'an F statistic'], ['p', 'a p-value'], ['nlp', 'a −log₁₀(p)']] },
            { key: 'x', label: 'Value', type: 'text', default: '2.5' },
            { key: 'df1', label: 'Degrees of freedom', default: 20, min: 1, step: 1, show: v => v.mode === 't' || v.mode === 'chi2' },
            { key: 'fdf1', label: 'Numerator df', default: 2, min: 1, step: 1, show: v => v.mode === 'f' },
            { key: 'fdf2', label: 'Denominator df', default: 30, min: 1, step: 1, show: v => v.mode === 'f' },
            { key: 'tails', label: 'Tails', type: 'select', default: '2', options: [['2', 'two-sided'], ['1', 'one-sided']], show: v => ['z', 't', 'p'].includes(v.mode) },
        ],
        compute({ mode, x, df1, fdf1, fdf2, tails }) {
            x = num(x); const two = tails !== '1';
            if (!need(x)) return { error: 'Need a number.' };
            let p;
            const outputs = [];
            if (mode === 'z') {
                p = S.pFromZ(x, two ? 2 : 1);
            } else if (mode === 't') {
                df1 = num(df1); if (!need(df1) || df1 <= 0) return { error: 'Need positive df.' };
                p = S.tTwoSidedP(x, df1); if (!two) p = x >= 0 ? p / 2 : 1 - p / 2;
            } else if (mode === 'chi2') {
                df1 = num(df1); if (!need(df1) || df1 <= 0) return { error: 'Need positive df.' };
                if (x < 0) return { error: 'χ² cannot be negative.' };
                p = S.chi2Sf(x, df1);
            } else if (mode === 'f') {
                fdf1 = num(fdf1); fdf2 = num(fdf2); if (!need(fdf1, fdf2) || fdf1 <= 0 || fdf2 <= 0) return { error: 'Need positive df.' };
                if (x < 0) return { error: 'F cannot be negative.' };
                p = S.fSf(x, fdf1, fdf2);
            } else if (mode === 'p') {
                p = x; if (!(p > 0 && p <= 1)) return { error: 'A p-value must be between 0 and 1.' };
            } else {
                p = Math.pow(10, -x); if (!(p > 0 && p <= 1)) return { error: '−log₁₀(p) must be ≥ 0.' };
            }
            const z = S.zFromP(p, two ? 2 : 1);
            if (mode !== 'p') outputs.push({ label: `p-value (${two || mode === 'chi2' || mode === 'f' ? 'two-sided' : 'one-sided'})`, value: fmt(p, 3), note: `${fmtSci(p, 2)} ${stars(p)}` });
            else outputs.push({ label: 'p-value', value: fmt(p, 3), note: `${fmtSci(p, 2)} ${stars(p)}` });
            outputs.push({ label: `Equivalent |z| (${two ? 'two' : 'one'}-sided)`, value: fmt(z, 4), note: 'the normal quantile that gives this p' });
            outputs.push({ label: '−log₁₀(p)', value: fmt(-Math.log10(p), 4), note: '' });
            outputs.push({ label: 'Frequency', value: oneIn(p), note: 'such a result under the null' });
            const text = `${fmtP(p).replace('p = ', 'p = ')}: if the null hypothesis were true, you would see a statistic at least this extreme in about ${oneIn(p)} repeats of the study. ` +
                (p < 0.05 ? 'Report the effect size and its interval alongside it: p says nothing about how big the effect is.' : 'The study does not distinguish “no effect” from “an effect too small for this sample to see”.');
            return { outputs, text };
        },
        notes: 'z: p = 2·Φ(−|z|). t: regularized incomplete beta. χ² and F: upper tails via incomplete gamma and beta. χ² and F p-values are inherently one-tailed (upper).',
    },

    {
        id: 'cip',
        group: 'p-values and intervals',
        title: 'Confidence interval ↔ p-value',
        blurb: 'Papers give a CI but not a p, or a p but not a CI. Recover one from the other (Altman & Bland, BMJ 2011).',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'ci', options: [['ci', 'an estimate with a CI → p'], ['p', 'an estimate with a p-value → CI']] },
            { key: 'scale', label: 'The estimate is', type: 'select', default: 'ratio', options: [['ratio', 'a ratio (OR, RR, HR)'], ['diff', 'a difference (means, risk difference, β)']] },
            { key: 'est', label: 'Estimate', default: 0.81, step: 0.01 },
            { key: 'lo', label: 'CI lower limit', default: 0.70, step: 0.01, show: v => v.mode === 'ci' },
            { key: 'hi', label: 'CI upper limit', default: 0.94, step: 0.01, show: v => v.mode === 'ci' },
            { key: 'p', label: 'p-value (two-sided)', type: 'text', default: '0.005', show: v => v.mode === 'p' },
            { key: 'level', label: 'Confidence level (%)', default: 95, min: 50, max: 99.9, step: 0.5 },
        ],
        compute({ mode, scale, est, lo, hi, p, level }) {
            est = num(est); level = num(level) / 100;
            const ratio = scale === 'ratio';
            if (!need(est, level) || level <= 0 || level >= 1) return { error: 'Need an estimate and a confidence level between 50 and 99.9%.' };
            if (ratio && est <= 0) return { error: 'A ratio must be positive.' };
            if (mode === 'ci') {
                lo = num(lo); hi = num(hi);
                if (!need(lo, hi) || lo >= hi) return { error: 'Need lower < upper.' };
                if (ratio && lo <= 0) return { error: 'Ratio limits must be positive.' };
                if (est < lo || est > hi) return { error: 'The estimate should sit inside its interval.' };
                const r = S.pFromCI(est, lo, hi, { level, ratio });
                const outputs = [
                    { label: ratio ? 'SE of the log estimate' : 'Standard error', value: fmt(r.se, 4), note: '' },
                    { label: 'z', value: fmt(r.z, 3), note: '' },
                    { label: 'p-value (two-sided)', value: fmt(r.p, 3), note: `${fmtSci(r.p, 2)} ${stars(r.p)}` },
                ];
                let warn;
                if (ratio) {
                    const a = Math.log(est) - Math.log(lo); const b = Math.log(hi) - Math.log(est);
                    if (Math.abs(a - b) / Math.max(a, b) > 0.1) warn = 'This interval is not symmetric on the log scale, so it was probably not computed from a standard error (profile likelihood, bootstrap, exact method). The p-value here is approximate.';
                } else {
                    const a = est - lo; const b = hi - est;
                    if (Math.abs(a - b) / Math.max(a, b) > 0.1) warn = 'This interval is not symmetric around the estimate, so it was probably not computed from a standard error. The p-value here is approximate.';
                }
                return { outputs, text: `${ratio ? 'Ratio' : 'Difference'} ${fmt(est)} (${fmt(level * 100)}% CI ${fmt(lo)} to ${fmt(hi)}) corresponds to ${fmtP(r.p)}.`, warn };
            }
            const pv = num(p);
            if (!(pv > 0 && pv < 1)) return { error: 'Need a p-value strictly between 0 and 1.' };
            if (!ratio && est === 0) return { error: 'A difference of exactly 0 cannot have p < 1.' };
            if (ratio && est === 1) return { error: 'A ratio of exactly 1 cannot have p < 1.' };
            const r = S.ciFromP(est, pv, { level, ratio });
            return {
                outputs: [
                    { label: ratio ? 'SE of the log estimate' : 'Standard error', value: fmt(r.se, 4), note: '' },
                    { label: 'z', value: fmt(r.z, 3), note: '' },
                    { label: `${fmt(level * 100)}% CI`, value: `${fmt(r.lower)} to ${fmt(r.upper)}`, note: '' },
                ],
                text: `${ratio ? 'Ratio' : 'Difference'} ${fmt(est)} with ${fmtP(pv)} implies a ${fmt(level * 100)}% CI of ${fmt(r.lower)} to ${fmt(r.upper)}. Exact only if the p came from a Wald (normal) test.`,
            };
        },
        notes: 'Ratios are handled on the log scale. SE = (upper − lower)/(2·z_level), z = estimate/SE, p = 2·Φ(−|z|). Reverse: SE = |estimate|/z_p, CI = estimate ± z_level·SE. Altman DG, Bland JM. BMJ 2011;343:d2090 and d2304.',
    },

    {
        id: 'sd',
        group: 'p-values and intervals',
        title: 'SD ↔ SE ↔ CI ↔ variance',
        blurb: 'Given any one of these and n, get the rest. The SD describes people; the SE describes the mean.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'sd', options: [['sd', 'a standard deviation'], ['se', 'a standard error of the mean'], ['ci', 'a CI half-width (upper − mean)'], ['var', 'a variance']] },
            { key: 'x', label: 'Value', default: 15, min: 0, step: 0.1 },
            { key: 'n', label: 'Sample size n', default: 25, min: 2, step: 1 },
            { key: 'level', label: 'Confidence level (%)', default: 95, min: 50, max: 99.9, step: 0.5 },
        ],
        compute({ mode, x, n, level }) {
            x = num(x); n = num(n); level = num(level) / 100;
            if (!need(x, n, level) || x < 0 || n < 2) return { error: 'Need a non-negative value and n ≥ 2.' };
            const tc = S.tQuantile(1 - (1 - level) / 2, n - 1);
            const zc = S.zFromP(1 - level);
            let sd;
            if (mode === 'sd') sd = x;
            else if (mode === 'se') sd = x * Math.sqrt(n);
            else if (mode === 'ci') sd = (x / tc) * Math.sqrt(n);
            else sd = Math.sqrt(x);
            const se = sd / Math.sqrt(n);
            return {
                outputs: [
                    { label: 'Standard deviation', value: fmt(sd, 4), note: 'spread of individuals' },
                    { label: 'Variance', value: fmt(sd * sd, 4), note: 'SD²' },
                    { label: 'Standard error of the mean', value: fmt(se, 4), note: 'SD/√n' },
                    { label: `${fmt(level * 100)}% CI half-width (t, df = ${n - 1})`, value: `± ${fmt(tc * se, 4)}`, note: `t = ${fmt(tc, 4)}` },
                    { label: `${fmt(level * 100)}% CI half-width (z)`, value: `± ${fmt(zc * se, 4)}`, note: `z = ${fmt(zc, 4)}; what large-n software reports` },
                ],
                text: `With n = ${n}, the mean is pinned down to about ± ${fmt(tc * se, 3)}, while individuals spread over roughly ± ${fmt(2 * sd, 3)} (two SDs). Error bars showing SE look ${fmt(Math.sqrt(n), 2)}× tighter than SD bars on the same data: always say which one you plotted. To halve the SE you need four times the n.`,
            };
        },
        notes: 'SE = SD/√n. CI half-width = t_(n−1, 1−α/2) · SE (use z for large n). Variance = SD².',
    },

    {
        id: 'mt',
        group: 'p-values and intervals',
        title: 'Multiple testing: Bonferroni, Holm, Benjamini–Hochberg',
        blurb: 'Paste p-values and get adjusted ones. Or just the number of tests for a Bonferroni threshold.',
        inputs: [
            { key: 'ps', label: 'p-values (any separator)', type: 'textarea', default: '0.0001 0.003 0.01 0.02 0.04 0.045 0.2 0.5' },
            { key: 'm', label: 'Or only the number of tests m', type: 'text', default: '' },
            { key: 'alpha', label: 'α (or FDR level)', default: 0.05, min: 0.0001, max: 0.5, step: 0.01 },
        ],
        compute({ ps, m, alpha }) {
            alpha = num(alpha);
            if (!need(alpha) || alpha <= 0 || alpha >= 1) return { error: 'Need 0 < α < 1.' };
            const list = String(ps || '').split(/[\s,;]+/).filter(Boolean).map(parseNumber).filter(v => Number.isFinite(v));
            const mOnly = num(m);
            if (list.length === 0) {
                if (!need(mOnly) || mOnly < 1) return { error: 'Paste some p-values, or give the number of tests.' };
                return {
                    outputs: [
                        { label: 'Bonferroni threshold', value: fmtSci(alpha / mOnly, 2), note: `α/m = ${fmt(alpha)}/${fmt(mOnly)}` },
                        { label: 'Šidák threshold', value: fmtSci(1 - Math.pow(1 - alpha, 1 / mOnly), 2), note: '1 − (1 − α)^(1/m); slightly less strict' },
                    ],
                    text: `With ${fmt(mOnly)} tests, call a result significant at the family-wise level only if p < ${fmtSci(alpha / mOnly, 2)}. For discovery screens, control the FDR instead: paste the p-values.`,
                };
            }
            if (list.some(p => p < 0 || p > 1)) return { error: 'All p-values must be between 0 and 1.' };
            const mm = list.length;
            const bonf = S.bonferroni(list);
            const holm = S.holm(list);
            const bh = S.benjaminiHochberg(list);
            const count = arr => arr.filter(v => v < alpha).length;
            const rows = list.map((p, i) => [fmtE(p, 3), fmtE(bonf[i], 3), fmtE(holm[i], 3), fmtE(bh[i], 3), bh[i] < alpha ? (holm[i] < alpha ? 'FWER + FDR' : 'FDR') : (p < alpha ? 'raw only' : '')]);
            return {
                outputs: [
                    { label: 'Tests', value: String(mm), note: `Bonferroni threshold ${fmtSci(alpha / mm, 2)}` },
                    { label: `Significant at raw α = ${fmt(alpha)}`, value: String(count(list)), note: `expect ≈ ${fmt(mm * alpha, 2)} by chance if all nulls were true` },
                    { label: 'Significant after Bonferroni', value: String(count(bonf)), note: 'family-wise error rate (FWER)' },
                    { label: 'Significant after Holm', value: String(count(holm)), note: 'FWER, always at least as powerful as Bonferroni' },
                    { label: `Significant at FDR ${fmt(alpha)} (BH)`, value: String(count(bh)), note: 'of these, about ' + fmt(alpha * 100) + '% are expected to be false' },
                ],
                table: { head: ['p', 'Bonferroni', 'Holm', 'BH q-value', 'significant'], rows },
                text: `Bonferroni and Holm control the chance of even one false positive. Benjamini–Hochberg controls the share of false positives among the ones you call: at FDR ${fmt(alpha)}, roughly ${fmt(alpha * 100)}% of your ${count(bh)} hits are expected to be noise. Use FWER for confirmatory tests, FDR for screens.`,
            };
        },
        notes: 'Bonferroni: p·m. Holm: sorted p₍ᵢ₎·(m − i + 1), made monotone. BH: sorted p₍ᵢ₎·m/i, made monotone from the top. All capped at 1. Matches R’s p.adjust.',
    },

    // --------------------------------------------------------------- effects
    {
        id: 'es',
        group: 'Effect sizes',
        title: 'Effect size translator: d ↔ r ↔ OR ↔ overlap',
        blurb: 'The same difference between two groups, expressed every way people express it.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'd', options: [['d', 'Cohen’s d (or Hedges’ g)'], ['r', 'a correlation r (point-biserial)'], ['or', 'an odds ratio']] },
            { key: 'x', label: 'Value', default: 0.5, step: 0.05 },
        ],
        compute({ mode, x }) {
            x = num(x);
            if (!need(x)) return { error: 'Need a number.' };
            let d;
            if (mode === 'd') d = x;
            else if (mode === 'r') { if (Math.abs(x) >= 1) return { error: 'r must be between −1 and 1.' }; d = S.dFromR(x); }
            else { if (x <= 0) return { error: 'An OR must be positive.' }; d = S.dFromOR(x); }
            const r = S.rFromD(d);
            const or = S.orFromD(d);
            const cles = S.clesFromD(d);
            const u3 = S.u3FromD(d);
            const ov = S.overlapFromD(d);
            const nnt = S.nntFromD(d);
            const sign = d >= 0;
            return {
                outputs: [
                    { label: 'Cohen’s d', value: signed(d, 3), note: benchmark(d, [0.2, 0.5, 0.8]) + ' (Cohen’s rules of thumb)' },
                    { label: 'Correlation r', value: signed(r, 3), note: `r² = ${fmt(r * r, 2)}; assumes equal group sizes` },
                    { label: 'Odds ratio', value: fmt(or, 3), note: 'Chinn’s logistic conversion' },
                    { label: 'Probability of superiority (CLES)', value: pct(cles), note: 'a random treated unit beats a random control' },
                    { label: 'Cohen’s U₃', value: pct(u3), note: 'controls below the treated mean' },
                    { label: 'Distribution overlap', value: pct(ov), note: '' },
                    { label: 'NNT', value: fmt(nnt, 3), note: 'Kraemer & Kupfer 2006' },
                ],
                text: `A d of ${fmt(d, 2)} means the average ${sign ? 'treated' : 'control'} unit scores higher than ${pct(sign ? u3 : 1 - u3)} of the ${sign ? 'control' : 'treated'} group, a randomly chosen treated unit beats a randomly chosen control ${pct(cles)} of the time, and the two distributions overlap by ${pct(ov)}. ` +
                    'Cohen’s labels are conventions, not facts: in a field where effects are usually 0.1, a 0.3 is big.',
            };
        },
        notes: 'r = d/√(d² + 4); d = 2r/√(1 − r²); ln OR = d·π/√3; CLES = Φ(d/√2); U₃ = Φ(d); overlap = 2·Φ(−|d|/2); NNT = 1/(2·Φ(d/√2) − 1).',
    },

    {
        id: 'corr',
        group: 'Effect sizes',
        title: 'Correlation: r² , CI and p',
        blurb: 'A correlation coefficient with its uncertainty, from r and n alone.',
        inputs: [
            { key: 'r', label: 'r', default: 0.4, min: -1, max: 1, step: 0.01 },
            { key: 'n', label: 'Number of pairs n', default: 40, min: 4, step: 1 },
        ],
        compute({ r, n }) {
            r = num(r); n = num(n);
            if (!need(r, n) || Math.abs(r) >= 1 || n < 4) return { error: 'Need |r| < 1 and n ≥ 4.' };
            const f = S.fisherR(r, n);
            const t = S.pearsonTest(r, n);
            return {
                outputs: [
                    { label: 'r²', value: fmt(r * r, 3), note: `${pct(r * r)} of the variance shared` },
                    { label: '95% CI for r', value: `${fmt(f.lower, 2)} to ${fmt(f.upper, 2)}`, note: 'Fisher z transform' },
                    { label: 'p-value', value: fmt(t.p, 3), note: `t = ${fmt(t.t, 3)}, df = ${t.df}; ${stars(t.p)}` },
                    { label: 'Equivalent d', value: signed(S.dFromR(r), 2), note: 'if the predictor were two equal groups' },
                    { label: 'Size', value: benchmark(r, [0.1, 0.3, 0.5]), note: 'Cohen’s rules of thumb' },
                ],
                text: `r = ${fmt(r, 2)} with n = ${n}: the plausible range is ${fmt(f.lower, 2)} to ${fmt(f.upper, 2)}, and ${pct(r * r)} of the variance in one variable is linearly accounted for by the other. ${n < 30 ? 'With this few pairs, one outlier can make or break the correlation: look at the scatter plot.' : ''}`,
            };
        },
        notes: 'Fisher z = atanh(r), SE = 1/√(n − 3). t = r·√((n − 2)/(1 − r²)) on n − 2 df.',
    },

    {
        id: 'coef',
        group: 'Effect sizes',
        title: 'Regression coefficient → what it means',
        blurb: 'Logistic, Poisson, Cox and log-transformed models all report a β that is not on the scale you care about.',
        inputs: [
            { key: 'model', label: 'Model', type: 'select', default: 'logistic', options: [['logistic', 'logistic (β is a log-odds ratio)'], ['poisson', 'Poisson / negative binomial (β is a log rate ratio)'], ['cox', 'Cox (β is a log hazard ratio)'], ['loglin', 'linear with log(outcome)'], ['linlog', 'linear with log(predictor)'], ['loglog', 'linear with both logged'], ['linear', 'plain linear']] },
            { key: 'beta', label: 'β', default: 0.4, step: 0.01 },
            { key: 'se', label: 'SE of β (0 if unknown)', default: 0.15, min: 0, step: 0.01 },
            { key: 'k', label: 'Per how many units of the predictor', default: 1, step: 1, show: v => v.model !== 'linlog' && v.model !== 'loglog' },
        ],
        compute({ model, beta, se, k }) {
            beta = num(beta); se = num(se); k = num(k);
            if (!need(beta)) return { error: 'Need β.' };
            if (!need(k) || k === 0) k = 1;
            const hasSe = need(se) && se > 0;
            const zc = 1.959964;
            const b = beta * k, s = hasSe ? se * Math.abs(k) : NaN;
            const p = hasSe ? S.pFromZ(beta / se) : NaN;
            const outputs = [];
            let text;
            const ciText = (f) => hasSe ? `95% CI ${fmt(f(b - zc * s))} to ${fmt(f(b + zc * s))}` : '';
            if (model === 'logistic' || model === 'poisson' || model === 'cox') {
                const name = model === 'logistic' ? 'Odds ratio' : model === 'poisson' ? 'Rate ratio' : 'Hazard ratio';
                const e = Math.exp(b);
                outputs.push({ label: `${name} per ${fmt(k)} unit${k === 1 ? '' : 's'}`, value: fmt(e), note: ciText(Math.exp) });
                outputs.push({ label: 'Percent change', value: `${signed((e - 1) * 100, 3)}%`, note: `in the ${model === 'logistic' ? 'odds' : model === 'poisson' ? 'rate' : 'hazard'}` });
                text = `Each ${fmt(k)}-unit increase in the predictor multiplies the ${model === 'logistic' ? 'odds' : model === 'poisson' ? 'rate' : 'hazard'} by ${fmt(e)} (${fmt(Math.abs(e - 1) * 100, 3)}% ${e >= 1 ? 'higher' : 'lower'}), holding the other predictors fixed.` +
                    (model === 'logistic' ? ' Odds, not probability: use the odds-ratio converter above with a baseline risk to get there.' : '');
            } else if (model === 'loglin') {
                const e = Math.exp(b);
                outputs.push({ label: `Multiplier on the outcome per ${fmt(k)} unit${k === 1 ? '' : 's'}`, value: fmt(e), note: ciText(Math.exp) });
                outputs.push({ label: 'Percent change in the outcome', value: `${signed((e - 1) * 100, 3)}%`, note: `for small β, ≈ ${signed(b * 100, 3)}%` });
                text = `Each ${fmt(k)}-unit increase in the predictor changes the outcome by ${signed((e - 1) * 100, 3)}% (multiplies it by ${fmt(e)}).`;
            } else if (model === 'linlog') {
                const per1 = beta * Math.log(1.01);
                const per10 = beta * Math.log(1.1);
                const perDouble = beta * Math.log(2);
                outputs.push({ label: 'Change in outcome per 1% increase in the predictor', value: signed(per1, 3), note: hasSe ? `95% CI ${fmt((beta - zc * se) * Math.log(1.01))} to ${fmt((beta + zc * se) * Math.log(1.01))}` : '' });
                outputs.push({ label: 'per 10% increase', value: signed(per10, 3), note: '' });
                outputs.push({ label: 'per doubling', value: signed(perDouble, 3), note: 'β · ln 2' });
                text = `A 1% increase in the predictor is associated with a ${signed(per1, 3)} change in the outcome; doubling the predictor with ${signed(perDouble, 3)}.`;
            } else if (model === 'loglog') {
                const pct1 = (Math.pow(1.01, beta) - 1) * 100;
                const pctDouble = (Math.pow(2, beta) - 1) * 100;
                outputs.push({ label: 'Percent change in outcome per 1% increase in predictor', value: `${signed(pct1, 3)}%`, note: `elasticity ≈ β = ${fmt(beta)}` });
                outputs.push({ label: 'per doubling of the predictor', value: `${signed(pctDouble, 3)}%`, note: '2^β' });
                text = `The outcome changes by about ${signed(pct1, 3)}% for every 1% change in the predictor (an elasticity of ${fmt(beta)}); doubling the predictor changes it by ${signed(pctDouble, 3)}%.`;
            } else {
                outputs.push({ label: `Change in outcome per ${fmt(k)} unit${k === 1 ? '' : 's'}`, value: signed(b, 3), note: ciText(v => v) });
                text = `Each ${fmt(k)}-unit increase in the predictor is associated with a ${signed(b, 3)} change in the outcome, other predictors held fixed.`;
            }
            if (hasSe) outputs.push({ label: 'p-value (Wald)', value: fmt(p, 3), note: `z = ${fmt(beta / se, 3)}; ${stars(p)}` });
            return { outputs, text };
        },
        notes: 'exp(β·k) for log-link models. log(y) ~ x: 100·(e^β − 1)% per unit. y ~ log(x): β·ln(1.01) per 1%. log(y) ~ log(x): 100·(1.01^β − 1)% per 1%. Wald CI: β ± 1.96·SE, then transformed.',
    },

    // ------------------------------------------------------------ diagnosis
    {
        id: 'dx',
        group: 'Diagnostics and screening',
        title: 'Sensitivity, specificity, prevalence → what a result means',
        blurb: 'The question a patient asks: “I tested positive, do I have it?” depends on prevalence more than on the test.',
        inputs: [
            { key: 'sens', label: 'Sensitivity (%)', default: 90, min: 0, max: 100, step: 0.5 },
            { key: 'spec', label: 'Specificity (%)', default: 95, min: 0, max: 100, step: 0.5 },
            { key: 'prev', label: 'Prevalence / pre-test probability', type: 'text', default: '1%' },
            { key: 'pop', label: 'Imagine a population of', default: 1000, min: 10, step: 100 },
        ],
        compute({ sens, spec, prev, pop }) {
            sens = num(sens) / 100; spec = num(spec) / 100; prev = parseNumber(prev); pop = num(pop);
            if (Number.isFinite(prev) && prev > 1) prev /= 100;
            if (!need(sens, spec, prev, pop) || prev <= 0 || prev >= 1 || sens <= 0 || spec <= 0) return { error: 'Need sensitivity, specificity and a prevalence between 0 and 100%.' };
            const d = S.diagnostic(sens, spec, prev, pop);
            const r0 = x => fmt(Math.round(x), 4);
            const preOdds = prev / (1 - prev);
            return {
                outputs: [
                    { label: 'Positive predictive value', value: pct(d.ppv), note: 'P(disease | positive)' },
                    { label: 'Negative predictive value', value: pct(d.npv), note: 'P(no disease | negative)' },
                    { label: 'Likelihood ratio, positive', value: fmt(d.lrPos), note: 'sens / (1 − spec); > 10 is strong' },
                    { label: 'Likelihood ratio, negative', value: fmt(d.lrNeg), note: '(1 − sens) / spec; < 0.1 is strong' },
                    { label: 'Post-test odds after a positive', value: oddsRatioText(preOdds * d.lrPos), note: `pre-test odds ${oddsRatioText(preOdds)} × LR+` },
                    { label: 'Overall accuracy', value: pct(d.accuracy), note: 'misleading when prevalence is low' },
                ],
                table: {
                    head: ['', 'Disease', 'No disease', 'Total'],
                    rows: [
                        ['Test positive', r0(d.truePos), r0(d.falsePos), r0(d.truePos + d.falsePos)],
                        ['Test negative', r0(d.falseNeg), r0(d.trueNeg), r0(d.falseNeg + d.trueNeg)],
                        ['Total', r0(d.sick), r0(d.well), r0(pop)],
                    ],
                },
                text: `Of ${group(String(pop))} people, ${r0(d.sick)} have the disease and ${r0(d.well)} do not. Of the ${r0(d.sick)} with it, ${r0(d.truePos)} test positive. Of the ${r0(d.well)} without it, ${r0(d.falsePos)} test positive anyway. ` +
                    `So among the ${r0(d.truePos + d.falsePos)} positives, ${r0(d.truePos)} really have it: a positive result is right ${pct(d.ppv)} of the time. A negative result is right ${pct(d.npv)} of the time.`,
            };
        },
        notes: 'PPV = sens·prev / (sens·prev + (1 − spec)(1 − prev)). Post-test odds = pre-test odds × LR. Natural frequencies (Gigerenzer) are the clearest way to say it.',
    },

    // ------------------------------------------------------------- planning
    {
        id: 'n',
        group: 'Planning',
        title: 'Sample size and power, two groups',
        blurb: 'How many per group for a difference in means or proportions, or how much power a given n buys.',
        inputs: [
            { key: 'mode', label: 'I want', type: 'select', default: 'means-n', options: [['means-n', 'n for a difference in means'], ['means-power', 'power for a difference in means'], ['prop-n', 'n for a difference in proportions'], ['prop-power', 'power for a difference in proportions']] },
            { key: 'd', label: 'Standardized difference d (difference / SD)', default: 0.5, min: 0.01, step: 0.05, show: v => v.mode.startsWith('means') },
            { key: 'p1', label: 'Proportion in group 1 (%)', default: 30, min: 0, max: 100, step: 1, show: v => v.mode.startsWith('prop') },
            { key: 'p2', label: 'Proportion in group 2 (%)', default: 45, min: 0, max: 100, step: 1, show: v => v.mode.startsWith('prop') },
            { key: 'n', label: 'n per group', default: 60, min: 2, step: 1, show: v => v.mode.endsWith('power') },
            { key: 'power', label: 'Power (%)', default: 80, min: 50, max: 99.9, step: 5, show: v => v.mode.endsWith('-n') },
            { key: 'alpha', label: 'α (two-sided)', default: 0.05, min: 0.001, max: 0.2, step: 0.01 },
        ],
        compute({ mode, d, p1, p2, n, power, alpha }) {
            alpha = num(alpha);
            if (!need(alpha) || alpha <= 0 || alpha >= 1) return { error: 'Need 0 < α < 1.' };
            const means = mode.startsWith('means');
            if (means) { d = num(d); if (!need(d) || d === 0) return { error: 'Need a non-zero d.' }; }
            else {
                p1 = num(p1) / 100; p2 = num(p2) / 100;
                if (!need(p1, p2) || p1 <= 0 || p1 >= 1 || p2 <= 0 || p2 >= 1 || p1 === p2) return { error: 'Need two different proportions between 0 and 100%.' };
            }
            if (mode.endsWith('-n')) {
                power = num(power) / 100;
                if (!need(power) || power <= 0 || power >= 1) return { error: 'Need power between 50 and 99.9%.' };
                const nn = means ? S.nPerGroupMeans(d, { alpha, power }) : S.nPerGroupProportions(p1, p2, { alpha, power });
                const nc = Math.ceil(nn + (means ? 1 : 0));
                return {
                    outputs: [
                        { label: 'n per group', value: String(nc), note: means ? `normal approximation ${fmt(nn, 3)} + 1 for the t test` : `normal approximation ${fmt(nn, 3)}` },
                        { label: 'Total', value: String(2 * nc), note: 'before dropout; divide by (1 − dropout rate)' },
                    ],
                    text: means
                        ? `To detect a difference of ${fmt(d)} SDs with ${pct(power)} power at α = ${fmt(alpha)}, you need about ${nc} per group. Halving d quadruples n.`
                        : `To detect ${pct(p1)} vs ${pct(p2)} with ${pct(power)} power at α = ${fmt(alpha)}, you need about ${nc} per group (${2 * nc} total).`,
                };
            }
            n = num(n);
            if (!need(n) || n < 2) return { error: 'Need n ≥ 2 per group.' };
            const pw = means ? S.powerMeans(d, n, { alpha }) : S.powerProportions(p1, p2, n, { alpha });
            return {
                outputs: [
                    { label: 'Power', value: pct(pw), note: `chance of p < ${fmt(alpha)} if the effect is real and this size` },
                    { label: 'Chance of missing a real effect', value: pct(1 - pw), note: 'type II error, β' },
                ],
                text: `With ${n} per group, a true ${means ? `d of ${fmt(d)}` : `difference of ${pct(p1)} vs ${pct(p2)}`} would reach significance ${pct(pw)} of the time. ` +
                    (pw < 0.8 ? 'Below the usual 80%: a null result here would be weak evidence of no effect.' : ''),
            };
        },
        notes: 'Means: n = 2·(z_(1−α/2) + z_(1−β))²/d² (+1 for the t test). Proportions: n = (z_(1−α/2)·√(2p̄q̄) + z_(1−β)·√(p₁q₁ + p₂q₂))²/(p₁ − p₂)². These are the formulas behind R’s power.t.test and power.prop.test, to within rounding. Plan with a d you would still care about, never with the one you observed.',
    },

    // ------------------------------------------------------------- genetics
    {
        id: 'hwe',
        group: 'Genetics',
        title: 'Hardy–Weinberg: allele, carrier and disease frequencies',
        blurb: 'From any one of allele frequency, carrier frequency or recessive-disease prevalence, get the others.',
        inputs: [
            { key: 'mode', label: 'I have', type: 'select', default: 'q', options: [['q', 'the minor allele frequency q'], ['carrier', 'the carrier (heterozygote) frequency'], ['prev', 'the prevalence of a recessive disease']] },
            { key: 'x', label: 'Value (0.02, 2%, or 1 in 50)', type: 'text', default: '1 in 2500' },
        ],
        compute({ mode, x }) {
            let v = parseNumber(x);
            if (!need(v) || v <= 0 || v >= 1) return { error: 'Need a frequency between 0 and 1 (or “1 in N”, or a percentage).' };
            let q;
            if (mode === 'q') q = v;
            else if (mode === 'prev') q = Math.sqrt(v);
            else { if (v > 0.5) return { error: 'Carrier frequency cannot exceed 50% under HWE.' }; q = (1 - Math.sqrt(1 - 2 * v)) / 2; }
            const h = S.hardyWeinberg(q);
            return {
                outputs: [
                    { label: 'Minor allele frequency q', value: fmt(q, 3), note: pct(q) },
                    { label: 'Carriers (Aa)', value: pct(h.Aa), note: oneIn(h.Aa) },
                    { label: 'Affected / homozygous (aa)', value: fmtSci(h.aa, 2), note: oneIn(h.aa) },
                    { label: 'Non-carriers (AA)', value: pct(h.AA), note: '' },
                    { label: 'Chance two random people are both carriers', value: fmtSci(h.Aa * h.Aa, 2), note: `${oneIn(h.Aa * h.Aa)}; their child is affected with probability 1/4` },
                ],
                text: `With q = ${fmt(q, 3)}, about ${oneIn(h.Aa)} people are carriers and ${oneIn(h.aa)} are homozygous. For a rare recessive disease, carriers outnumber patients roughly ${fmt(h.Aa / h.aa, 3)} to 1.`,
                warn: 'Assumes random mating, no selection and a single population. Consanguinity and founder effects break this.',
            };
        },
        notes: 'p + q = 1; AA = p², Aa = 2pq, aa = q². From a recessive prevalence: q = √prev. From a carrier frequency c: q = (1 − √(1 − 2c))/2.',
    },
];

export function getConverter(id) {
    return CONVERTERS.find(c => c.id === id);
}

/** Default input values for a converter, as the UI would show them. */
export function defaults(conv) {
    return Object.fromEntries(conv.inputs.map(i => [i.key, i.default]));
}
