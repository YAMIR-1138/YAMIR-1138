import { test, eq, close, rel, ok } from './assert.js';
import * as S from '../js/stats.js';

// Reference values from R (pnorm, qnorm, pt, qt, pchisq, pf, p.adjust, power.t.test, power.prop.test).

test('normCdf matches R pnorm', () => {
    rel(S.normCdf(0), 0.5, 1e-12, 'z=0');
    rel(S.normCdf(1.959964), 0.975, 1e-6, 'z=1.96');
    rel(S.normCdf(-1), 0.1586553, 1e-6, 'z=-1');
    rel(S.normSf(5), 2.866516e-07, 1e-5, 'z=5 upper tail');
    rel(S.normSf(10), 7.619853e-24, 1e-5, 'z=10 upper tail');
    rel(S.normCdf(-37), 5.725571e-300, 1e-4, 'z=-37 deep tail');
});

test('normQuantile matches R qnorm', () => {
    rel(S.normQuantile(0.975), 1.959964, 1e-6, 'p=0.975');
    rel(S.normQuantile(0.5), 0, 1e-12, 'p=0.5');
    rel(S.normQuantile(1e-10), -6.361341, 1e-6, 'p=1e-10');
    rel(S.normQuantile(0.8), 0.8416212, 1e-6, 'p=0.8');
    ok(Number.isNaN(S.normQuantile(2)), 'p out of range');
});

test('z ↔ p round trip', () => {
    for (const p of [0.05, 0.01, 1e-5, 1e-20, 0.5]) {
        rel(S.pFromZ(S.zFromP(p)), p, 1e-9, `p=${p}`);
    }
    rel(S.zFromP(0.05), 1.959964, 1e-6, 'two-sided 0.05');
    rel(S.zFromP(0.05, 1), 1.644854, 1e-6, 'one-sided 0.05');
});

test('t distribution matches R pt / qt', () => {
    rel(S.tTwoSidedP(2.228139, 10), 0.05, 1e-5, '2*pt(-2.228, 10)');
    rel(S.tTwoSidedP(12.706, 1), 0.05, 1e-3, 'df=1');
    rel(S.tCdf(1.5, 5), 0.9030482, 1e-6, 'pt(1.5, 5)');
    rel(S.tQuantile(0.975, 10), 2.228139, 1e-6, 'qt(0.975, 10)');
    rel(S.tQuantile(0.975, 1), 12.7062, 1e-5, 'qt(0.975, 1)');
    rel(S.tQuantile(0.025, 30), -2.042272, 1e-6, 'qt(0.025, 30)');
});

test('chi-square and F match R', () => {
    rel(S.chi2Sf(3.841459, 1), 0.05, 1e-5, 'pchisq(3.84, 1, lower=FALSE)');
    rel(S.chi2Sf(20, 5), 0.001249730, 1e-5, 'pchisq(20, 5, lower=FALSE)');
    rel(S.fSf(4.964603, 1, 10), 0.05, 1e-5, 'pf(4.96, 1, 10, lower=FALSE)');
    rel(S.fSf(3, 4, 20), 0.04320100, 1e-5, 'pf(3, 4, 20, lower=FALSE)');
});

test('OR and RR conversions', () => {
    rel(S.riskFromOR(2.5, 0.1), 0.2173913, 1e-6, 'OR 2.5 at 10% baseline');
    rel(S.orFromRR(2.173913, 0.1), 2.5, 1e-5, 'back to OR');
    rel(S.riskFromOR(1, 0.3), 0.3, 1e-12, 'OR 1 leaves risk alone');
    eq(S.orFromRR(5, 0.3), Infinity, 'RR 5 at 30% is impossible');
});

test('effect size conversions', () => {
    rel(S.dFromOR(Math.exp(1.81)), 0.998, 1e-2, 'Chinn: ln OR 1.81 ≈ d 1');
    rel(S.orFromD(S.dFromOR(3)), 3, 1e-12, 'OR→d→OR');
    rel(S.rFromD(0.5), 0.2425356, 1e-6, 'd 0.5 → r');
    rel(S.dFromR(S.rFromD(0.8)), 0.8, 1e-12, 'd→r→d');
    rel(S.clesFromD(0.8), 0.7141, 1e-3, 'CLES for d=0.8');
    rel(S.u3FromD(0.5), 0.6914625, 1e-6, 'U3 for d=0.5');
    rel(S.overlapFromD(0.8), 0.6892, 1e-3, 'overlap for d=0.8');
    rel(S.nntFromD(0.5), 3.619, 1e-3, 'NNT for d=0.5 (Kraemer & Kupfer)');
});

test('Fisher z and Pearson test', () => {
    const f = S.fisherR(0.5, 30);
    rel(f.lower, 0.1704, 1e-3, 'lower CI r=0.5 n=30');
    rel(f.upper, 0.7288, 1e-3, 'upper CI r=0.5 n=30');
    const t = S.pearsonTest(0.5, 30);
    rel(t.t, 3.05505, 1e-5, 't for r=0.5 n=30');
    rel(t.p, 0.004900, 1e-3, 'p for r=0.5 n=30');
});

test('Altman & Bland CI → p (BMJ 2011 worked example)', () => {
    // Difference 0.63, CI 0.26 to 1.00 → SE 0.189, z 3.33, p ≈ 0.0009
    const r = S.pFromCI(0.63, 0.26, 1.0);
    rel(r.se, 0.18878, 1e-3, 'SE');
    rel(r.z, 3.337, 1e-3, 'z');
    rel(r.p, 0.000846, 1e-2, 'p');
    // Ratio 0.81, CI 0.70 to 0.94 → z ≈ 2.85, p ≈ 0.004
    const q = S.pFromCI(0.81, 0.70, 0.94, { ratio: true });
    rel(Math.abs(q.z), 2.80, 1e-2, 'z ratio');
    rel(q.p, 0.0051, 5e-2, 'p ratio');
    // round trip
    const back = S.ciFromP(0.63, r.p);
    rel(back.lower, 0.26, 1e-3, 'CI back lower');
    rel(back.upper, 1.0, 1e-3, 'CI back upper');
});

test('multiple testing adjustments match R p.adjust', () => {
    const ps = [0.01, 0.04, 0.03, 0.005, 0.2];
    const bonf = S.bonferroni(ps);
    const holm = S.holm(ps);
    const bh = S.benjaminiHochberg(ps);
    [0.05, 0.2, 0.15, 0.025, 1].forEach((v, i) => rel(bonf[i], v, 1e-12, `bonferroni[${i}]`));
    [0.04, 0.09, 0.09, 0.025, 0.2].forEach((v, i) => rel(holm[i], v, 1e-12, `holm[${i}]`));
    [0.025, 0.05, 0.05, 0.025, 0.2].forEach((v, i) => rel(bh[i], v, 1e-12, `BH[${i}]`));
});

test('sample size and power match R power.t.test / power.prop.test (normal approx)', () => {
    // power.t.test(delta=0.5, power=0.8) gives n=63.8; the z approximation gives 62.8
    close(S.nPerGroupMeans(0.5), 62.79, 0.05, 'n per group d=0.5');
    close(S.powerMeans(0.5, 64), 0.807, 0.01, 'power at n=64');
    // power.prop.test(p1=0.5, p2=0.65, power=0.8) → n = 169.3
    close(S.nPerGroupProportions(0.5, 0.65), 169.3, 0.5, 'n per group proportions');
    close(S.powerProportions(0.5, 0.65, 170), 0.80, 0.01, 'power proportions');
});

test('diagnostic test maths', () => {
    const d = S.diagnostic(0.9, 0.9, 0.01);
    rel(d.ppv, 0.08333, 1e-3, 'PPV at 1% prevalence');
    rel(d.npv, 0.99888, 1e-4, 'NPV');
    rel(d.lrPos, 9, 1e-12, 'LR+');
    rel(d.lrNeg, 0.1111, 1e-3, 'LR-');
    rel(d.truePos, 9, 1e-12, 'true positives per 1000');
    rel(d.falsePos, 99, 1e-12, 'false positives per 1000');
});

test('genetics and rates', () => {
    const hw = S.hardyWeinberg(0.01);
    rel(hw.Aa, 0.0198, 1e-12, 'carriers at q=0.01');
    rel(hw.aa, 1e-4, 1e-12, 'affected at q=0.01');
    rel(S.phredToP(30), 0.001, 1e-12, 'Q30');
    rel(S.pToPhred(0.01), 20, 1e-12, 'p=0.01 → Q20');
    rel(S.riskFromRate(0.01, 10), 0.09516, 1e-3, '1% per year over 10 years');
});
