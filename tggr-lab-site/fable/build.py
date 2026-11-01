#!/usr/bin/env python3
"""Builds index.html for this folder.

    python3 build.py

Publications and people are read from the PUBS and PEOPLE lists in ../build.py (the data only; that
script is not run). Everything else on the page is in this file, site.css and site.js.
Standard library only."""
import ast, html, pathlib, re

SITE = pathlib.Path(__file__).resolve().parent.parent
OUT = pathlib.Path(__file__).resolve().parent / "index.html"
src = (SITE / "build.py").read_text()

def literal(name):
    m = re.search(rf"^{name} = (\[.*?^\])", src, re.S | re.M)
    return ast.literal_eval(m.group(1))

PUBS = literal("PUBS")
PEOPLE = literal("PEOPLE")
LAB = {k for p in PEOPLE for k in p[3]}
TASMC = "https://www.tasmc.org.il/rd/en/next-unit/research-laboratories/genetics/the-translational-genetics-and-genomics-research-laboratory-prof-hagit-baris-feldman/"

MISSION = ("We are dedicated to decipher the role of genetic diseases in our patients. Our projects focus on the "
           "identification, characterization and functional analyses of novel human disease-causing genes in order "
           "to elucidate the disease pathophysiology and potentially provide targets for personalized medicine.")
FAMILIES = "Families come from the Genetics Institute at Tel Aviv Sourasky Medical Center, or by outside colleagues."

TOOLS = [
    ("Pellaeon", "Talk to UCSF ChimeraX in plain English", "https://tggr-lab.github.io/pellaeon/"),
    ("GPCompaRe", "Inactive and active residue contacts across 283 human Class A GPCRs", "https://tggr-lab.github.io/GPCompaRe/"),
    ("Incubator CO₂ monitor", "An incubator CO₂ and temperature monitor you build on an ESP32", "https://tggr-lab.github.io/incubator-co2-monitor/"),
    ("GeNest", "Finds genes that sit inside other genes, across a genome", "https://yamir-1138.github.io/genest-website/"),
]

ARROW = '<svg class="arrow" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 16 16 4M6 4h10v10"/></svg>'

def authors(a):
    parts = a.replace("; ", ", ").split(", ")
    return ", ".join(f"<b>{html.escape(x)}</b>" if x in LAB else html.escape(x) for x in parts)

pubs = []
for i, (y, t, j, v, a, doi) in enumerate(sorted(PUBS, key=lambda r: -r[0])):
    pubs.append(f'''        <li class="pub reveal">
          <h3><a href="https://doi.org/{html.escape(doi)}">{t}{ARROW}</a></h3>
          <p class="cite"><span class="jr">{html.escape(j)}</span> <span class="vol">{html.escape(v)}</span> <span class="yr">{y}</span></p>
          <details class="au">
            <summary><span>Authors</span></summary>
            <p>{authors(a)}</p>
          </details>
        </li>''')

people = []
for k, (name, role, ini, _) in enumerate(PEOPLE):
    people.append(f'        <li class="person reveal{" head" if k == 0 else ""}"><span class="nm">{html.escape(name)}</span><span class="rl">{html.escape(role)}</span></li>')

tools = []
for name, desc, url in TOOLS:
    tools.append(f'''        <li class="reveal"><a class="tool" href="{url}">
          <span class="nm">{name}</span>
          <span class="ds">{desc}</span>
          {ARROW}
        </a></li>''')

GITHUB = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
THEME = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>'

DESC = ("Translational Genetics and Genomics Research Laboratory, Genetics Institute, Tel Aviv Sourasky Medical Center "
        "and the Faculty of Medicine, Tel Aviv University. " + MISSION.split(". ")[0] + ".")

page = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TGGR Lab</title>
<meta name="description" content="{html.escape(DESC)}">
<meta property="og:type" content="website">
<meta property="og:title" content="TGGR Lab">
<meta property="og:description" content="{html.escape(DESC)}">
<meta property="og:image" content="https://tggr-lab.github.io/logo-kit/png/tggr-logo-light-1024.png">
<meta name="theme-color" content="#f3eee2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0d1b1a" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" href="../logo-kit/png/lockup-light.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<script>try {{ var t = localStorage.getItem('tggr-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
<link rel="stylesheet" href="site.css">
</head>
<body>
<a class="skip" href="#research">Skip to content</a>

<header class="bar">
  <a class="home" href="#top" aria-label="TGGR Lab, top of page"><tggr-logo ring="none" motion="still" label="TGGR Lab"></tggr-logo><span>TGGR Lab</span></a>
  <nav class="sections" aria-label="Sections">
    <a href="#research">Research</a>
    <a href="#publications">Publications</a>
    <a href="#tools">Tools</a>
    <a href="#people">People</a>
  </nav>
  <div class="actions">
    <a class="ib" href="https://github.com/tggr-lab" aria-label="TGGR Lab on GitHub">{GITHUB}</a>
    <button class="ib" id="theme" type="button" aria-label="Switch to dark theme">{THEME}</button>
  </div>
</header>

<div class="layout" id="top">
  <div class="stage" id="stage" role="img" aria-label="A continuous zoom that follows the page: from a human karyotype into chromosome 1, into band 1q32, into a gene with its exons and introns, into the double helix, and down to a single codon.">
    <canvas id="scene"></canvas>
    <ol class="rail" id="rail" aria-hidden="true">
      <li data-go="#top"><span>chromosomes</span></li>
      <li data-go="#research"><span>chromosome 1</span></li>
      <li data-go="#publications"><span>1q32</span></li>
      <li data-go="#tools"><span>gene</span></li>
      <li data-go="#people"><span>helix</span></li>
      <li data-go="#contact"><span>codon</span></li>
      <i class="mark"></i>
    </ol>
    <p class="readout" id="readout" aria-hidden="true"><span id="ro-main"></span><span id="ro-sub"></span></p>
  </div>

  <main class="content">
    <section class="hero" aria-labelledby="h-name">
      <tggr-logo class="logo" label="TGGR Lab logo: a tiger whose body becomes a DNA helix, above the wordmark TggR LAB, inside a ring reading Translational Genetics and Genomics Research Laboratory"></tggr-logo>
      <h1 id="h-name">Translational Genetics and Genomics Research Laboratory</h1>
      <p class="aff">Genetics Institute, Tel Aviv Sourasky Medical Center<br>Faculty of Medicine, Tel Aviv University</p>
    </section>

    <section id="research" aria-labelledby="h-research">
      <h2 id="h-research" class="eyebrow reveal">Research</h2>
      <p class="mission reveal">{MISSION}</p>
      <p class="families reveal">{FAMILIES}</p>
    </section>

    <section id="publications" aria-labelledby="h-publications">
      <h2 id="h-publications" class="eyebrow reveal">Publications</h2>
      <ul class="pubs">
{chr(10).join(pubs)}
      </ul>
    </section>

    <section id="tools" aria-labelledby="h-tools">
      <h2 id="h-tools" class="eyebrow reveal">Tools</h2>
      <p class="note reveal">Open source.</p>
      <ul class="tools">
{chr(10).join(tools)}
      </ul>
    </section>

    <section id="people" aria-labelledby="h-people">
      <h2 id="h-people" class="eyebrow reveal">People</h2>
      <ul class="people">
{chr(10).join(people)}
      </ul>
    </section>

    <footer id="contact" aria-label="Links">
      <ul class="links">
        <li class="reveal"><a href="https://github.com/tggr-lab">GitHub{ARROW}</a></li>
        <li class="reveal"><a href="{TASMC}">Lab page at TASMC{ARROW}</a></li>
      </ul>
      <p class="aff reveal">Genetics Institute, Tel Aviv Sourasky Medical Center<br>Faculty of Medicine, Tel Aviv University</p>
    </footer>
  </main>
</div>

<script src="../logo-kit/tggr-logo.js"></script>
<script src="bands.js"></script>
<script src="site.js"></script>
</body>
</html>
'''
OUT.write_text(page)
print(f"wrote {OUT} ({len(page) / 1024:.1f} KB), {len(PUBS)} pubs, {len(PEOPLE)} people")
