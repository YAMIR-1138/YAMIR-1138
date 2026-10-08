/**
 * run.js - test runner for Node (`node tests/run.js`) and the browser
 * (tests.html). Imports every test file, runs, reports.
 */
import { run } from './assert.js';
import './stats.test.js';
import './convert.test.js';
import './chooser.test.js';

const summary = run();

if (typeof document !== 'undefined') {
    const el = document.getElementById('results');
    const rows = summary.results.map(r =>
        `<tr class="${r.ok ? 'pass' : 'fail'}"><td>${r.ok ? 'PASS' : 'FAIL'}</td><td>${r.name}</td><td>${r.error || ''}</td></tr>`
    ).join('');
    el.innerHTML = `
        <p class="${summary.failed ? 'fail' : 'pass'}"><strong>${summary.passed} passed, ${summary.failed} failed</strong></p>
        <table><thead><tr><th></th><th>Test</th><th>Error</th></tr></thead><tbody>${rows}</tbody></table>`;
} else {
    for (const r of summary.results) {
        console.log(`${r.ok ? '  ok ' : 'FAIL '} ${r.name}${r.error ? ` - ${r.error}` : ''}`);
    }
    console.log(`\n${summary.passed} passed, ${summary.failed} failed`);
    if (summary.failed > 0) process.exitCode = 1;
}
