# STATSHEET

A live cheat sheet for biostatistics. One static page, no build step.

**Live:** https://yamir-1138.github.io/YAMIR-1138/stats/

- **Which test** – a short questionnaire (goal → outcome type → groups →
  design → distribution) that lands on a test or model, with assumptions,
  the effect size to report, a sentence to adapt, and R + Python code.
  The whole catalog is browsable too.
- **Converters** – odds ratio / risk ratio / hazard ratio in plain language,
  odds ↔ probability, incidence rate → cumulative risk, log fold change ↔
  fold change ↔ percent, scientific notation ↔ plain numbers, Phred ↔
  error probability, p ↔ z/t/χ²/F, CI ↔ p (Altman & Bland), SD ↔ SE ↔
  CI, multiple-testing adjustment (Bonferroni, Holm, BH), effect-size
  translator (d ↔ r ↔ OR ↔ overlap), correlation CI and p, regression
  coefficient → what it means, diagnostic test → PPV/NPV with natural
  frequencies, sample size and power, Hardy–Weinberg.
- **Models** – which regression for which outcome, how to read the
  coefficient, the R and Python call, what to watch for.
- **Reference** – what statements do and do not mean, effect-size rules of
  thumb, assumption checks, pitfalls, reporting templates, distributions,
  glossary.

Search (`/`) filters everything. Every converter has a *copy link* button
that encodes its inputs in the URL. Dark mode follows the system and can be
toggled.

## Editing

| Want to change | Edit |
| --- | --- |
| A converter, or add one | `js/convert.js` – one object per card: `inputs` and `compute()` |
| The questionnaire or a test | `js/chooser.js` – `TESTS`, `questions()`, `recommend()` |
| Reference tables and glossary | `js/reference.js` |
| A formula | `js/stats.js` (numeric core) or `js/format.js` (number ↔ text) |
| Looks | `css/style.css` |

## Tests

```
node tests/run.js      # or open tests.html in a browser
```

The numeric core is checked against R / SciPy reference values (normal, t,
χ², F tails and quantiles; p.adjust; power.t.test; power.prop.test), every
converter runs on its defaults, and every path through the questionnaire
resolves to a catalog entry.

## Moving it to its own repository

The folder is self-contained (all paths are relative). Copy it to a new
repo, enable GitHub Pages on the main branch, and it works unchanged.
