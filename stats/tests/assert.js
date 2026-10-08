/**
 * assert.js - tiny test helpers, no framework. Same shape as the one in
 * dough_formulator: test(name, fn) registers, run() executes and reports.
 */

const tests = [];

export function test(name, fn) {
    tests.push({ name, fn });
}

export function eq(actual, expected, msg = '') {
    if (actual !== expected) {
        throw new Error(`${msg} - expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function close(actual, expected, eps = 0.01, msg = '') {
    if (!(Math.abs(actual - expected) <= eps)) {
        throw new Error(`${msg} - expected ≈${expected} (±${eps}), got ${actual}`);
    }
}

/** Relative closeness, for very small or very large numbers. */
export function rel(actual, expected, tol = 1e-6, msg = '') {
    const denom = Math.max(Math.abs(expected), 1e-300);
    if (!(Math.abs(actual - expected) / denom <= tol)) {
        throw new Error(`${msg} - expected ≈${expected} (rel ±${tol}), got ${actual}`);
    }
}

export function deepEq(actual, expected, msg = '') {
    const a = JSON.stringify(actual);
    const b = JSON.stringify(expected);
    if (a !== b) throw new Error(`${msg} - expected ${b}, got ${a}`);
}

export function ok(value, msg = '') {
    if (!value) throw new Error(`${msg} - expected truthy, got ${JSON.stringify(value)}`);
}

export function run() {
    const results = [];
    let passed = 0;
    let failed = 0;
    for (const t of tests) {
        try {
            t.fn();
            results.push({ name: t.name, ok: true });
            passed++;
        } catch (err) {
            results.push({ name: t.name, ok: false, error: err.message });
            failed++;
        }
    }
    return { passed, failed, results };
}
