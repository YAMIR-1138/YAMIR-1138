/**
 * format.js - turning numbers into readable text, and text into numbers.
 */

const SUP = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const SUP_REV = Object.fromEntries(Object.entries(SUP).map(([k, v]) => [v, k]));

export function sup(n) {
    return String(n).split('').map(c => SUP[c] ?? c).join('');
}

/** Group thousands without relying on locale: 1234567.5 → "1,234,567.5". */
export function group(str) {
    const [int, frac] = str.split('.');
    const sign = int.startsWith('-') ? '-' : '';
    const digits = sign ? int.slice(1) : int;
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return sign + grouped + (frac !== undefined ? '.' + frac : '');
}

/** Strip trailing zeros from a decimal string. */
function trim(s) {
    return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

/** Scientific notation with a real multiplication sign: 3.2 × 10⁻⁵. */
export function fmtSci(x, sig = 3) {
    if (!Number.isFinite(x)) return String(x);
    if (x === 0) return '0';
    const exp = Math.floor(Math.log10(Math.abs(x)));
    let mant = x / Math.pow(10, exp);
    let m = trim(mant.toPrecision(sig));
    if (Math.abs(parseFloat(m)) >= 10) { // rounding pushed it over, e.g. 9.999 → 10
        return fmtSci(x, sig + 1);
    }
    return `${m} × 10${sup(exp)}`;
}

/** Plain e-notation for code and copy-paste: 3.2e-5. */
export function fmtE(x, sig = 3) {
    if (!Number.isFinite(x)) return String(x);
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e9 || ax < 1e-4) return x.toExponential(sig - 1).replace(/\.?0+e/, 'e');
    return trim(x.toFixed(Math.max(0, sig - 1 - Math.floor(Math.log10(ax)))));
}

/**
 * The default number formatter: `sig` significant digits, thousands
 * grouped, scientific notation only when the number is extreme.
 */
export function fmt(x, sig = 3) {
    if (x === null || x === undefined || Number.isNaN(x)) return '–';
    if (x === Infinity) return '∞';
    if (x === -Infinity) return '−∞';
    if (x === 0) return '0';
    const ax = Math.abs(x);
    if (ax >= 1e9 || ax < 1e-4) return fmtSci(x, sig);
    const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(ax)));
    const s = trim(x.toFixed(decimals));
    return group(s).replace('-', '−');
}

/** Write a number out in full, no exponent: 3.2e-5 → 0.000032. */
export function fmtPlain(x, sig = 3) {
    if (!Number.isFinite(x)) return String(x);
    if (x === 0) return '0';
    const ax = Math.abs(x);
    const exp = Math.floor(Math.log10(ax));
    if (exp >= 21) {
        // beyond what toFixed writes out: build it from the mantissa
        const mant = trim(Math.abs(x / Math.pow(10, exp)).toPrecision(sig)).replace('.', '');
        const zeros = exp - (mant.length - 1);
        return (x < 0 ? '−' : '') + group(mant + '0'.repeat(Math.max(0, zeros)));
    }
    const decimals = Math.min(100, Math.max(0, sig - 1 - exp));
    return group(trim(x.toFixed(decimals))).replace('-', '−');
}

/** A probability as a percentage: 0.2174 → "21.7%". */
export function pct(p, sig = 3) {
    if (!Number.isFinite(p)) return fmt(p);
    const v = p * 100;
    if (v !== 0 && Math.abs(v) < 0.01) return fmtSci(v, sig) + '%';
    return fmt(v, sig) + '%';
}

/** "1 in 4,600" for a small probability. */
export function oneIn(p, sig = 2) {
    if (!(p > 0)) return '–';
    if (p >= 1) return '1 in 1';
    const n = 1 / p;
    if (n < 10) return `1 in ${fmt(n, 2)}`;
    return `1 in ${fmt(Number(Math.round(n).toPrecision(sig)), 12)}`;
}

/** "22 in 100" style natural frequency. */
export function perN(p, N = 100) {
    const k = p * N;
    const kStr = k >= 10 ? fmt(Math.round(k), 3) : fmt(k, 2);
    return `${kStr} in ${group(String(N))}`;
}

/** Percentage points, signed. */
export function pp(x, sig = 3) {
    const v = x * 100;
    return `${v > 0 ? '+' : v < 0 ? '−' : ''}${fmt(Math.abs(v), sig)} pp`;
}

export function signed(x, sig = 3) {
    return `${x > 0 ? '+' : ''}${fmt(x, sig)}`;
}

/** Significance stars, the way journals print them. */
export function stars(p) {
    if (p < 0.001) return '***';
    if (p < 0.01) return '**';
    if (p < 0.05) return '*';
    return 'ns';
}

/** A p-value the way you would report it. */
export function fmtP(p) {
    if (!Number.isFinite(p)) return '–';
    if (p < 0.001) return `p = ${fmtSci(p, 2)}`;
    if (p < 0.01) return `p = ${p.toFixed(4)}`;
    return `p = ${p.toFixed(3)}`;
}

/**
 * Parse a number written any of the ways people write them:
 *   3.2e-5   3.2E-5   3.2×10^-5   3.2x10^-5   3.2 * 10^-5   10^-5
 *   3.2·10⁻⁵   0.000032   1/31250   1 in 31,250   0.003%   32 per 100,000
 * Returns NaN when nothing sensible is found.
 */
export function parseNumber(input) {
    if (typeof input === 'number') return input;
    if (input === null || input === undefined) return NaN;
    let s = String(input).trim().toLowerCase();
    if (!s) return NaN;
    s = s.replace(/,/g, '').replace(/−/g, '-').replace(/[   ]+/g, ' ');
    // unicode superscripts after 10: 10⁻⁵
    s = s.replace(/10([⁻⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, e) => '10^' + e.split('').map(c => SUP_REV[c] ?? c).join(''));
    // percent
    let scale = 1;
    const pctMatch = s.match(/^(.*?)\s*%$/);
    if (pctMatch) { s = pctMatch[1]; scale = 0.01; }
    // "1 in N", "1/N", "a per N"
    const ratio = s.match(/^([\d.e+-]+)\s*(?:in|\/|per|out of)\s*([\d.e+-]+)$/);
    if (ratio) {
        const a = parseFloat(ratio[1]);
        const b = parseFloat(ratio[2]);
        return b ? (a / b) * scale : NaN;
    }
    // mantissa × 10^exp, or bare 10^exp
    const sci = s.match(/^(?:([+-]?[\d.]+)\s*[x×*·]\s*)?10\s*\^?\s*([+-]?\d+)$/);
    if (sci) {
        const mant = sci[1] === undefined ? 1 : parseFloat(sci[1]);
        return mant * Math.pow(10, parseInt(sci[2], 10)) * scale;
    }
    const plain = s.match(/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/);
    if (plain) return parseFloat(s) * scale;
    return NaN;
}

/** Odds as a tidy "a : b". */
export function oddsRatioText(odds) {
    if (!(odds > 0) || !Number.isFinite(odds)) return '–';
    if (odds >= 1) return `${fmt(odds, 3)} : 1`;
    return `1 : ${fmt(1 / odds, 3)}`;
}

/** Cohen's benchmark words for d, r and similar. */
export function benchmark(value, thresholds, labels = ['negligible', 'small', 'medium', 'large']) {
    const v = Math.abs(value);
    let i = 0;
    while (i < thresholds.length && v >= thresholds[i]) i++;
    return labels[i];
}
