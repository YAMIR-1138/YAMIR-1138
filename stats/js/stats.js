/**
 * stats.js - the numeric core. Pure functions, no DOM.
 *
 * Distributions (normal, t, chi-square, F) are built on the regularized
 * incomplete gamma and beta functions (continued fractions, as in
 * Numerical Recipes), so tails are accurate down to very small p-values.
 * Everything else is closed-form textbook statistics; each function says
 * which one.
 */

// ---------- special functions ----------

const LANCZOS = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

/** ln Γ(x) for x > 0 (Lanczos, ~1e-10 relative accuracy). */
export function gammaln(x) {
    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);
    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) ser += LANCZOS[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
}

const EPS = 3e-16;
const FPMIN = 1e-300;

function gammaSeries(a, x) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n++) {
        ap += 1;
        del *= x / ap;
        sum += del;
        if (Math.abs(del) < Math.abs(sum) * EPS) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
}

function gammaContinuedFraction(a, x) {
    let b = x + 1 - a;
    let c = 1 / FPMIN;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 1000; i++) {
        const an = -i * (i - a);
        b += 2;
        d = an * d + b;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = b + an / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

/** Regularized lower incomplete gamma P(a, x). */
export function gammaP(a, x) {
    if (x <= 0) return 0;
    return x < a + 1 ? gammaSeries(a, x) : 1 - gammaContinuedFraction(a, x);
}

/** Regularized upper incomplete gamma Q(a, x) = 1 - P(a, x). */
export function gammaQ(a, x) {
    if (x <= 0) return 1;
    return x < a + 1 ? 1 - gammaSeries(a, x) : gammaContinuedFraction(a, x);
}

function betacf(a, b, x) {
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= 300; m++) {
        const m2 = 2 * m;
        let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        h *= d * c;
        aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
        d = 1 + aa * d;
        if (Math.abs(d) < FPMIN) d = FPMIN;
        c = 1 + aa / c;
        if (Math.abs(c) < FPMIN) c = FPMIN;
        d = 1 / d;
        const del = d * c;
        h *= del;
        if (Math.abs(del - 1) < EPS) break;
    }
    return h;
}

/** Regularized incomplete beta I_x(a, b). */
export function betai(a, b, x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
    if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
    return 1 - bt * betacf(b, a, 1 - x) / b;
}

/** Complementary error function, accurate in both tails. */
export function erfc(x) {
    if (x >= 0) return gammaQ(0.5, x * x);
    return 1 + gammaP(0.5, x * x);
}

export function erf(x) {
    return x >= 0 ? gammaP(0.5, x * x) : -gammaP(0.5, x * x);
}

// ---------- normal distribution ----------

const SQRT2 = Math.SQRT2;
const SQRT2PI = Math.sqrt(2 * Math.PI);

export function normPdf(z) {
    return Math.exp(-0.5 * z * z) / SQRT2PI;
}

/** Φ(z): P(Z ≤ z). */
export function normCdf(z) {
    return 0.5 * erfc(-z / SQRT2);
}

/** Upper tail P(Z > z), accurate for large z. */
export function normSf(z) {
    return 0.5 * erfc(z / SQRT2);
}

/**
 * Φ⁻¹(p). Acklam's rational approximation followed by one Halley step
 * against the accurate cdf, which brings it to full double precision.
 */
export function normQuantile(p) {
    if (!(p > 0 && p < 1)) {
        if (p === 0) return -Infinity;
        if (p === 1) return Infinity;
        return NaN;
    }
    const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    const plow = 0.02425;
    let x;
    if (p < plow) {
        const q = Math.sqrt(-2 * Math.log(p));
        x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= 1 - plow) {
        const q = p - 0.5;
        const r = q * q;
        x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
        const q = Math.sqrt(-2 * Math.log(1 - p));
        x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    // Halley refinement
    const e = (p < 0.5 ? normCdf(x) - p : -(normSf(x) - (1 - p)));
    const u = e * SQRT2PI * Math.exp(x * x / 2);
    x -= u / (1 + x * u / 2);
    return x;
}

// ---------- t, chi-square, F ----------

/** Two-sided p-value for a t statistic with df degrees of freedom. */
export function tTwoSidedP(t, df) {
    if (!(df > 0)) return NaN;
    return betai(df / 2, 0.5, df / (df + t * t));
}

/** P(T ≤ t). */
export function tCdf(t, df) {
    const p2 = tTwoSidedP(t, df);
    return t >= 0 ? 1 - p2 / 2 : p2 / 2;
}

/** Quantile of the t distribution (bisection: robust for any df ≥ 1). */
export function tQuantile(p, df) {
    if (!(p > 0 && p < 1) || !(df > 0)) return NaN;
    if (df > 1e6) return normQuantile(p);
    let lo = -1e6;
    let hi = 1e6;
    for (let i = 0; i < 200; i++) {
        const mid = (lo + hi) / 2;
        if (tCdf(mid, df) < p) lo = mid; else hi = mid;
        if (hi - lo < 1e-12 * Math.max(1, Math.abs(mid))) break;
    }
    return (lo + hi) / 2;
}

/** Upper-tail p for a chi-square statistic. */
export function chi2Sf(x, df) {
    if (!(df > 0)) return NaN;
    if (x <= 0) return 1;
    return gammaQ(df / 2, x / 2);
}

export function chi2Cdf(x, df) {
    return 1 - chi2Sf(x, df);
}

/** Upper-tail p for an F statistic. */
export function fSf(f, d1, d2) {
    if (!(d1 > 0 && d2 > 0)) return NaN;
    if (f <= 0) return 1;
    return betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f));
}

// ---------- p-values and z ----------

/** p-value from a z statistic; tails = 2 (default) or 1. */
export function pFromZ(z, tails = 2) {
    return tails === 2 ? 2 * normSf(Math.abs(z)) : normSf(z);
}

/** |z| from a p-value; tails = 2 (default) or 1. */
export function zFromP(p, tails = 2) {
    return tails === 2 ? -normQuantile(p / 2) : -normQuantile(p);
}

// ---------- effect sizes and conversions ----------

/** OR → risk among exposed, given baseline (unexposed) risk p0. */
export function riskFromOR(or, p0) {
    return (or * p0) / (1 - p0 + or * p0);
}

/** RR → OR, given baseline risk p0. */
export function orFromRR(rr, p0) {
    const p1 = rr * p0;
    if (p1 >= 1) return Infinity;
    return (p1 / (1 - p1)) / (p0 / (1 - p0));
}

/** Cohen's d from an odds ratio (Chinn 2000: ln OR ≈ d·π/√3). */
export function dFromOR(or) {
    return Math.log(or) * Math.sqrt(3) / Math.PI;
}

export function orFromD(d) {
    return Math.exp(d * Math.PI / Math.sqrt(3));
}

/** Point-biserial r from d, assuming equal group sizes. */
export function rFromD(d) {
    return d / Math.sqrt(d * d + 4);
}

export function dFromR(r) {
    return 2 * r / Math.sqrt(1 - r * r);
}

/** Probability of superiority (common-language effect size). */
export function clesFromD(d) {
    return normCdf(d / Math.SQRT2);
}

/** Cohen's U3: fraction of the control group below the treated mean. */
export function u3FromD(d) {
    return normCdf(d);
}

/** Overlapping coefficient of two unit-variance normals d apart. */
export function overlapFromD(d) {
    return 2 * normCdf(-Math.abs(d) / 2);
}

/** NNT from d (Kraemer & Kupfer 2006). */
export function nntFromD(d) {
    const aucDiff = 2 * clesFromD(Math.abs(d)) - 1;
    return aucDiff === 0 ? Infinity : 1 / aucDiff;
}

/** Fisher z-transform of r, with CI and p for a sample of size n. */
export function fisherR(r, n, level = 0.95) {
    const z = Math.atanh(r);
    const se = 1 / Math.sqrt(n - 3);
    const zc = zFromP(1 - level);
    return {
        z,
        se,
        lower: Math.tanh(z - zc * se),
        upper: Math.tanh(z + zc * se),
        p: pFromZ(z / se),
    };
}

/** t statistic and two-sided p for Pearson's r with n pairs. */
export function pearsonTest(r, n) {
    const t = r * Math.sqrt((n - 2) / (1 - r * r));
    return { t, df: n - 2, p: tTwoSidedP(t, n - 2) };
}

/**
 * Altman & Bland (BMJ 2011): SE and p from a confidence interval.
 * For ratios (OR, RR, HR) work on the log scale.
 */
export function pFromCI(estimate, lower, upper, { level = 0.95, ratio = false } = {}) {
    const zc = zFromP(1 - level);
    const est = ratio ? Math.log(estimate) : estimate;
    const lo = ratio ? Math.log(lower) : lower;
    const hi = ratio ? Math.log(upper) : upper;
    const se = (hi - lo) / (2 * zc);
    const z = est / se;
    return { se, z, p: pFromZ(z) };
}

/** CI from an estimate and a (two-sided) p-value, the reverse of pFromCI. */
export function ciFromP(estimate, p, { level = 0.95, ratio = false } = {}) {
    const z = zFromP(p);
    const est = ratio ? Math.log(estimate) : estimate;
    const se = Math.abs(est) / z;
    const zc = zFromP(1 - level);
    const lo = est - zc * se;
    const hi = est + zc * se;
    return { se, z, lower: ratio ? Math.exp(lo) : lo, upper: ratio ? Math.exp(hi) : hi };
}

// ---------- multiple testing ----------

/** Bonferroni-adjusted p-values. */
export function bonferroni(ps) {
    const m = ps.length;
    return ps.map(p => Math.min(1, p * m));
}

/** Holm step-down adjusted p-values. */
export function holm(ps) {
    const m = ps.length;
    const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
    const adj = new Array(m);
    let running = 0;
    order.forEach(([p, i], rank) => {
        running = Math.max(running, Math.min(1, (m - rank) * p));
        adj[i] = running;
    });
    return adj;
}

/** Benjamini–Hochberg q-values (FDR-adjusted p-values). */
export function benjaminiHochberg(ps) {
    const m = ps.length;
    const order = ps.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0]);
    const adj = new Array(m);
    let running = 1;
    for (let k = m - 1; k >= 0; k--) {
        const [p, i] = order[k];
        running = Math.min(running, Math.min(1, (m / (k + 1)) * p));
        adj[i] = running;
    }
    return adj;
}

// ---------- sample size and power ----------

/** n per group for a two-sample comparison of means (standardized difference d). */
export function nPerGroupMeans(d, { alpha = 0.05, power = 0.8 } = {}) {
    const za = zFromP(alpha);
    const zb = -normQuantile(1 - power);
    return 2 * Math.pow((za + zb) / Math.abs(d), 2);
}

/** Power of a two-sample t test (normal approximation) with n per group. */
export function powerMeans(d, n, { alpha = 0.05 } = {}) {
    const za = zFromP(alpha);
    return normCdf(Math.abs(d) * Math.sqrt(n / 2) - za);
}

/** n per group for comparing two proportions p1 and p2. */
export function nPerGroupProportions(p1, p2, { alpha = 0.05, power = 0.8 } = {}) {
    const za = zFromP(alpha);
    const zb = -normQuantile(1 - power);
    const pbar = (p1 + p2) / 2;
    const num = za * Math.sqrt(2 * pbar * (1 - pbar)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    return Math.pow(num / (p1 - p2), 2);
}

export function powerProportions(p1, p2, n, { alpha = 0.05 } = {}) {
    const za = zFromP(alpha);
    const pbar = (p1 + p2) / 2;
    const zb = (Math.abs(p1 - p2) * Math.sqrt(n) - za * Math.sqrt(2 * pbar * (1 - pbar))) /
        Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
    return normCdf(zb);
}

// ---------- diagnostics ----------

/** PPV, NPV, likelihood ratios and natural frequencies for a test. */
export function diagnostic(sens, spec, prev, population = 1000) {
    const ppv = (sens * prev) / (sens * prev + (1 - spec) * (1 - prev));
    const npv = (spec * (1 - prev)) / (spec * (1 - prev) + (1 - sens) * prev);
    const lrPos = sens / (1 - spec);
    const lrNeg = (1 - sens) / spec;
    const sick = population * prev;
    const well = population - sick;
    return {
        ppv, npv, lrPos, lrNeg,
        truePos: sick * sens,
        falseNeg: sick * (1 - sens),
        trueNeg: well * spec,
        falsePos: well * (1 - spec),
        sick, well,
        accuracy: (sick * sens + well * spec) / population,
    };
}

// ---------- genetics ----------

/** Hardy–Weinberg genotype frequencies for allele frequency q of the minor allele. */
export function hardyWeinberg(q) {
    const p = 1 - q;
    return { p, q, AA: p * p, Aa: 2 * p * q, aa: q * q };
}

/** Phred quality score → error probability. */
export function phredToP(q) {
    return Math.pow(10, -q / 10);
}

export function pToPhred(p) {
    return -10 * Math.log10(p);
}

// ---------- rates ----------

/** Cumulative risk over time t from a constant hazard rate λ (same time unit). */
export function riskFromRate(rate, t) {
    return 1 - Math.exp(-rate * t);
}
