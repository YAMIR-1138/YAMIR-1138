import { test, eq, ok } from './assert.js';
import { TESTS, questions, recommend, complete } from '../js/chooser.js';

test('every catalog entry is complete', () => {
    for (const [k, t] of Object.entries(TESTS)) {
        for (const f of ['name', 'use', 'assumptions', 'effect', 'report', 'r', 'py']) ok(t[f], `${k}.${f}`);
        if (t.alt) ok(TESTS[t.alt], `${k}.alt → ${t.alt} exists`);
    }
});

test('questionnaire starts with the goal and grows', () => {
    eq(questions({}).length, 1);
    eq(questions({ goal: 'compare' }).length, 2);
    eq(questions({ goal: 'compare', outcome: 'continuous' }).length, 3);
    eq(questions({ goal: 'compare', outcome: 'continuous', groups: 'two' }).length, 4);
    eq(questions({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep' }).length, 5);
    ok(!complete({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep' }));
    ok(complete({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep', dist: 'normal' }));
});

test('classic picks', () => {
    const r = (a) => recommend(a).primary;
    eq(r({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep', dist: 'normal' }), 'welch_t');
    eq(r({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'indep', dist: 'skewed' }), 'mann_whitney');
    eq(r({ goal: 'compare', outcome: 'continuous', groups: 'two', design: 'paired', dist: 'normal' }), 'paired_t');
    eq(r({ goal: 'compare', outcome: 'continuous', groups: 'many', design: 'indep', dist: 'unsure' }), 'anova');
    eq(r({ goal: 'compare', outcome: 'binary', groups: 'two', design: 'indep' }), 'chisq_2x2');
    eq(r({ goal: 'compare', outcome: 'binary', groups: 'two', design: 'paired' }), 'mcnemar');
    eq(r({ goal: 'compare', outcome: 'time', groups: 'two' }), 'logrank');
    eq(r({ goal: 'compare', outcome: 'count', groups: 'two', design: 'indep' }), 'count_two');
    eq(r({ goal: 'assoc', outcome: 'continuous', predictor: 'continuous', dist: 'normal' }), 'pearson');
    eq(r({ goal: 'assoc', outcome: 'binary', predictor: 'continuous' }), 'logistic_reg');
    eq(r({ goal: 'model', outcome: 'continuous', design: 'paired' }), 'lmm');
    eq(r({ goal: 'model', outcome: 'time', design: 'indep' }), 'cox');
    eq(r({ goal: 'agree', outcome: 'continuous' }), 'icc');
    eq(r({ goal: 'agree', outcome: 'ordinal' }), 'kappa');
});

test('every complete path through the questionnaire resolves to a catalog entry', () => {
    let paths = 0;
    const walk = (a) => {
        const qs = questions(a);
        const next = qs.find(q => !a[q.key]);
        if (!next) {
            const r = recommend(a);
            ok(r && TESTS[r.primary], `path ${JSON.stringify(a)} resolves`);
            r.alternatives.forEach(k => ok(TESTS[k], `alt ${k} in ${JSON.stringify(a)}`));
            paths++;
            return;
        }
        for (const [v] of next.options) walk({ ...a, [next.key]: v });
    };
    walk({});
    ok(paths > 60, `walked ${paths} paths`);
});
