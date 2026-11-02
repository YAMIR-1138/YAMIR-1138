#!/usr/bin/env python3
"""Build the TGGR Lab page, index.html, from the data below.

    python3 build.py

Edit the data here (publications, people) or the tool cards in src/tools.html, then rebuild.
Styles are in assets/site.css and behaviour in assets/site.js; the page only loads them.
src/chr1-bands.json is chromosome 1 at 400-band resolution (from Ideogram.js), for the reading bar.
Standard library only. The output is plain HTML, committed, served as is by GitHub Pages.
"""
import html, json, pathlib, re

HERE = pathlib.Path(__file__).resolve().parent
SITE = "https://tggr-lab.github.io/"
TASMC = "https://www.tasmc.org.il/rd/en/next-unit/research-laboratories/genetics/the-translational-genetics-and-genomics-research-laboratory-prof-hagit-baris-feldman/"

# ---------------------------------------------------------------- data
MISSION = "We are dedicated to decipher the role of genetic diseases in our patients."
FOCUS = ("Our projects focus on the identification, characterization and functional analyses of "
         "<em>novel human disease&#8209;causing genes</em> in order to elucidate the disease pathophysiology "
         "and potentially provide targets for personalized medicine.")
FAMILIES = "Families come from the Genetics Institute at Tel Aviv Sourasky Medical Center, or by outside colleagues."

# year, title (HTML), journal, volume/pages, authors, DOI
PUBS = [
 (2026, "<i>PIH1D2</i> loss-of-function directs ciliary and cell cycle defects resulting in left isomerism with or without biliary atresia", "Liver Int", "46(11):e70951",
  "Kurolap A, Chai Gadot C, Shalata A, Eshach Adiv O, Amir Y, Levy Lando B, Stehling F, Hershkovitz T, Osman K, Habib C, Mintz H, Steinberg R, Hochberg A, Hamiel U, Mory A, Marom D, von Hardenberg S, Singer A, Auber B, Baris Feldman H", "10.1111/liv.70951"),
 (2026, "Recurring and isolated intronic <i>FGFR1</i> variants as an underdiagnosed cause of congenital hypogonadotropic hypogonadism", "J Endocr Soc", "10(11):bvag234",
  "Yacobi-Bach M, Hagin R, Levy Lando B, Délot E, Vilain E, Kępczyński Ł, Botvinik A, Mory A, Amir Y, Kałużewski T, Gach A, Łupińska A, Zygmunt A, Johnson J, Rutter MM, Lebenthal Y, Shaklai S, Greenman Y, Baris Feldman H, Kurolap A", "10.1210/jendso/bvag234"),
 (2025, "Impaired Wnt/planar cell polarity signaling in yellow nail syndrome", "Ann Intern Med", "178(1):39–49",
  "Kurolap A, Chai Gadot C, Eshach Adiv O, Hershkovitz T, Avitan-Hersh E, Martin L, Humeau H, Schatz UA, Westphal DS, Lobmaier S, Sofrin-Drucker E, Stafler P, Bugis J, Chermesh I, Hardak E, Geva P, Zohar Y, Hershkovitz D, Mory A, Chatterji S, Greenberger S, Shteinberg M, Baris Feldman H", "10.7326/ANNALS-24-01101"),
 (2024, "National rapid genome sequencing in neonatal intensive care", "JAMA Netw Open", "7(2):e240146",
  "Marom D, Mory A, Reytan-Miron S, Amir Y, Kurolap A, Cohen JG, Morhi Y, Smolkin T, Cohen L, Zangen S, Shalata A, Riskin A, Peleg A, Lavie-Nevo K, Mandel D, Chervinsky E, Fisch CF, Fleisher Sheffer V, Falik-Zaccai TC, Rips J, Shlomai NO, Friedman SE, Shporen CH, Ben-Yehoshua SJ, Simmonds A, Yaacobi RG, Bauer-Rusek S, Omari H, Weiss K, Hochwald O, Koifman A, Globus O, Batzir NA, Yaron N, Segel R, Morag I, Reish O, Eliyahu A, Leibovitch L, Schwartz ME, Abramsky R, Hochberg A, Oron A, Banne E, Portnov I, Samra NN, Singer A, Baris Feldman H", "10.1001/jamanetworkopen.2024.0146"),
 (2023, "Corin and left atrial cardiomyopathy, hypertension, arrhythmia, and fibrosis", "N Engl J Med", "389(18):1685–1692",
  "Baris Feldman H, Chai Gadot C, Zahler D, Mory A, Aviram G, Elhanan E, Shefer G, Goldiner I, Amir Y, Kurolap A, Ablin JN", "10.1056/NEJMoa2301908"),
 (2021, "A recurring <i>NFS1</i> pathogenic variant causes a mitochondrial disorder with variable intra-familial patient outcomes", "Mol Genet Metab Rep", "26:100699",
  "Hershkovitz T, Kurolap A, Tal G, Paperna T, Mory A, Staples J, Brigatti KW; Regeneron Genetics Center, Gonzaga-Jauregui C, Dumin E, Saada A, Mandel H, Baris Feldman H", "10.1016/j.ymgmr.2020.100699"),
 (2020, "Homozygosity for <i>CHEK2</i> p.Gly167Arg leads to a unique cancer syndrome with multiple complex chromosomal translocations in peripheral blood karyotype", "J Med Genet", "57(7):500–504",
  "Paperna T, Sharon-Shwartzman N, Kurolap A, Goldberg Y, Moustafa N, Carasso Y, Feinstein-Linial M, Mory A, Reznick-Levi G, Gonzaga-Jauregui C, Shuldiner AR, Basel-Salmon L, Ofran Y, Half EE, Baris Feldman H", "10.1136/jmedgenet-2018-105824"),
 (2019, "A unique presentation of infantile-onset colitis and eosinophilic disease without recurrent infections resulting from a novel homozygous <i>CARMIL2</i> variant", "J Clin Immunol", "39(4):430–439",
  "Kurolap A, Eshach-Adiv O, Konnikova L, Werner L, Gonzaga-Jauregui C, Steinberg M, Mitsialis V, Mory A, Nunberg MY, Wall S, Shaoul R, Overton JD, Regeneron Genetics Center, Shuldiner AR, Zohar Y, Paperna T, Snapper SB, Shouval DS, Baris Feldman H", "10.1007/s10875-019-00631-6"),
 (2019, "A novel <i>TUFM</i> homozygous variant in a child with mitochondrial cardiomyopathy expands the phenotype of combined oxidative phosphorylation deficiency 4", "J Hum Genet", "64(6):589–595",
  "Hershkovitz T, Kurolap A, Gonzaga-Jauregui C, Paperna T, Mory A, Wolf SE, Regeneron Genetics Center, Overton JD, Shuldiner AR, Saada A, Mandel H, Baris Feldman H", "10.1038/s10038-019-0592-6"),
 (2019, "Eculizumab is safe and effective as a long-term treatment for protein-losing enteropathy due to CD55 deficiency", "J Pediatr Gastroenterol Nutr", "68(3):325–333",
  "Kurolap A, Eshach-Adiv O, Hershkovitz T, Tabib A, Karbian N, Paperna T, Mory A, Vachyan A, Slijper N, Steinberg R, Zohar Y, Mevorach D, Baris Feldman H", "10.1097/MPG.0000000000002198"),
 (2018, "Pathogenic variants in glutamyl-tRNA<sup>Gln</sup> amidotransferase subunits cause a lethal mitochondrial cardiomyopathy disorder", "Nat Commun", "9(1):4065",
  "Friederich MW, Timal S, Powell CA, Dallabona C, Kurolap A, Palacios-Zambrano S, Bratkovic S, Derks TGJ, Bick D, Bouman K, Chatfield KC, Damouny-Naoum N, Dishop MK, Falik-Zaccai TC, Fares F, Fedida A, Ferrero I, Gallagher RC, Garesse R, Gilberti M, González C, Gowan K, Habib C, Halligan RK, Kalfon L, Knight K, Lefeber D, Mamblona L, Mandel H, Mory A, Ottoson J, Paperna T, Pruijn GJM, Rebelo-Guiomar P, Saada A, Sainz B, Salvemini H, Schoots MH, Smeitink JA, Szukszto MJ, ter Horst HJ, van den Brandt F, van Spronsen FJ, Veltman JA, Wartchow E, Wintjes LT, Zohar Y, Fernández-Moreno MA, Baris HN, Donnini C, Minczuk M, Rodenburg RJ, Van Hove JLK", "10.1038/s41467-018-06250-w"),
 (2018, "Establishing the role of <i>PLVAP</i> in protein-losing enteropathy: a homozygous missense variant leads to an attenuated phenotype", "J Med Genet", "55(11):779–784",
  "Kurolap A, Eshach-Adiv O, Gonzaga-Jauregui C, Dolnikov K, Mory A, Paperna T, Hershkovitz T, Overton JD, Kaplan M, Glaser F, Zohar Y, Shuldiner AR, Berger G, Baris HN", "10.1136/jmedgenet-2018-105299"),
 (2017, "Loss of <i>CD55</i> in eculizumab-responsive protein-losing enteropathy", "N Engl J Med", "377(1):87–89",
  "Kurolap A, Eshach-Adiv O, Hershkovitz T, Paperna T, Mory A, Oz-Levi D, Zohar Y, Mandel H, Chezar J, Azoulay D, Peleg S, Half EE, Yahalom V, Finkel L, Weissbrod O, Geiger D, Tabib A, Shaoul R, Magen D, Bonstein L, Mevorach D, Baris HN", "10.1056/NEJMc1707173"),
 (2016, "Loss of glycine transporter 1 causes a subtype of glycine encephalopathy with arthrogryposis and mildly elevated cerebrospinal fluid glycine", "Am J Hum Genet", "99(5):1172–1180",
  "Kurolap A, Armbruster A, Hershkovitz T, Hauf K, Mory A, Paperna T, Hannappel E, Tal G, Nijem Y, Sella E, Mahajnah M, Ilivitzki A, Hershkovitz D, Ekhilevitch N, Mandel H, Eulenburg V, Baris HN", "10.1016/j.ajhg.2016.09.004"),
]

# name, role, monogram, how the name appears in author lists
PEOPLE = [
 ("Prof. Hagit Baris Feldman", "Head of the lab", "HB", ["Baris Feldman H", "Baris HN"]),
 ("Dr. Chofit Chai Gadot", "Lab manager", "CG", ["Chai Gadot C"]),
 ("Alina Kurolap, RN, PhD", "Researcher", "AK", ["Kurolap A"]),
 ("Doha Khair", "PhD student", "DK", []),
 ("Bar Levy Lando", "PhD student", "BL", ["Levy Lando B"]),
 ("Yam Amir", "PhD student", "YA", ["Amir Y"]),
 ("Lotem Nethanel", "PhD student", "LN", []),
 ("Ahava Dukan", "MSc student", "AD", []),
]
LAB = {k for p in PEOPLE for k in p[3]}


# ---------------------------------------------------------------- pieces
ARROW = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 12 12 4M5 4h7v7"/></svg>'
GITHUB = '<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>'
THEME = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor"/></svg>'
MENU = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg>'
SEARCH = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>'
SECTIONS = [("research", "Research"), ("publications", "Publications"), ("tools", "Tools"), ("people", "People"), ("contact", "Contact")]
# The same Formspree form as the GPCompaRe contact page; the subject line tells the two apart.
FORMSPREE = "https://formspree.io/f/mljrqazl"
ENQUIRY = ["Research collaboration", "Joining the lab", "Tools: Pellaeon, GPCompaRe, CO₂ monitor, GeNest", "Publications or data", "Other"]
plain = lambda t: re.sub(r"<[^>]+>", "", t)


def authors(a):
    return ", ".join(f"<b>{html.escape(x)}</b>" if x in LAB else html.escape(x) for x in a.replace("; ", ", ").split(", "))


def chromosome():
    """Chromosome 1 at 400-band resolution, as a reading bar. Two copies: pale bands, and stained
    bands revealed up to the reading position."""
    bands = json.loads((HERE / "src" / "chr1-bands.json").read_text())
    end = bands[-1][2]
    def cells(stained):
        out = []
        for name, a, b, stain in bands:
            g = {"gneg": 0, "gpos25": .25, "gpos50": .5, "gpos75": .75, "gpos100": 1, "gvar": .6, "acen": -1}[stain]
            out.append(f'<i style="flex:{(b - a + 1) / end * 1000:.2f}"{" class=\"acen\"" if g < 0 else f" data-g=\"{g}\""}></i>')
        return "".join(out)
    return f'<div class="chromo" aria-hidden="true"><div class="bands">{cells(False)}</div><div class="bands stain">{cells(True)}</div><span class="here"></span></div>'


def divider(seed):
    """A section divider: a Sanger chromatogram, four overlapping peak traces running slowly
    sideways (drawn by site.js from the seed). Decorative: random peaks, no base calls."""
    return f'<div class="sep" aria-hidden="true"><canvas class="sanger" data-seed="{seed}"></canvas></div>\n'

def page():
    nav = "".join(f'<a href="#{i}">{n}</a>' for i, n in SECTIONS)
    menu = "".join(f'<a href="#{i}"><span>0{k + 1}</span>{n}</a>' for k, (i, n) in enumerate(SECTIONS))
    pubs = []
    for y, t, j, v, a, doi in sorted(PUBS, key=lambda r: -r[0]):
        search = html.escape(" ".join((plain(t), j, str(y), a)).lower(), quote=True)
        pubs.append(f'''      <li class="rise" data-search="{search}"><details class="pub"><summary><span class="t">{t}</span><span class="j"><i>{j}</i> · {y} · {v}</span><span class="plus" aria-hidden="true"></span></summary>
        <div class="more"><p class="au">{authors(a)}</p><a class="pm" href="https://doi.org/{doi}">doi.org/{html.escape(doi)} {ARROW}</a></div></details></li>''')
    people = []
    for k, (name, role, ini, _) in enumerate(PEOPLE):
        people.append(f'      <li class="rise"><div class="person{" lead" if k == 0 else ""}"><svg class="mono" viewBox="0 0 76 76" aria-hidden="true"><circle class="base" cx="38" cy="38" r="35"/><circle class="draw" cx="38" cy="38" r="35"/><text x="38" y="47" text-anchor="middle">{ini}</text></svg><div><h3>{name}</h3><p>{role}</p></div></div></li>')
    tools = (HERE / "src" / "tools.html").read_text()
    ld = json.dumps({
        "@context": "https://schema.org", "@type": "ResearchOrganization", "name": "TGGR Lab",
        "alternateName": "Translational Genetics and Genomics Research Laboratory", "url": SITE,
        "logo": SITE + "logo-kit/png/tggr-logo-light-512.png", "sameAs": ["https://github.com/tggr-lab", TASMC],
        "parentOrganization": [{"@type": "Organization", "name": "Tel Aviv Sourasky Medical Center"}, {"@type": "Organization", "name": "Tel Aviv University"}],
        "founder": {"@type": "Person", "name": "Hagit Baris Feldman"},
        "member": [{"@type": "Person", "name": re.sub(r"^(Prof\.|Dr\.) |, .*$", "", p[0])} for p in PEOPLE[1:]],
        "address": {"@type": "PostalAddress", "streetAddress": "6 Weizmann Street", "addressLocality": "Tel Aviv", "addressCountry": "IL"},
    }, ensure_ascii=False, indent=1)
    desc = "Translational Genetics and Genomics Research Laboratory, Genetics Institute, Tel Aviv Sourasky Medical Center. " + MISSION
    big = lambda i, n: f'<h2 class="big" id="{i}-h" data-decode aria-label="{n}">{n}</h2>'
    return f'''<!doctype html>
<!-- Generated by build.py. Edit the data there, then run: python3 build.py -->
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>TGGR Lab</title>
<meta name="description" content="{html.escape(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="TGGR Lab">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{SITE}">
<meta property="og:image" content="{SITE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="The TGGR Lab logo, a tiger and a DNA helix inside a ring of text, beside the lab's full name.">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="{SITE}">
<link rel="icon" type="image/png" href="logo-kit/png/lockup-light.png">
<script type="application/ld+json">
{ld}
</script>
<meta name="theme-color" content="#f5f7f4" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0b1615" media="(prefers-color-scheme: dark)">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Atkinson+Hyperlegible+Next:wght@400;600;800&family=Atkinson+Hyperlegible+Mono:wght@500&display=swap" rel="stylesheet">
<script>try {{ var t = localStorage.getItem('tggr-theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; }} catch (e) {{}}</script>
<link rel="stylesheet" href="assets/site.css">
</head>
<body>
<header class="bar" id="bar">
  <a class="mini" href="#top" aria-label="TGGR Lab, back to top" tabindex="-1"><tggr-logo ring="none" motion="still" label="TGGR Lab"></tggr-logo><span>TGGR Lab</span></a>
  <nav class="nav" aria-label="Sections">{nav}<span class="navdot" aria-hidden="true"></span></nav>
  <div class="icons">
    <a class="icon" href="https://github.com/tggr-lab" aria-label="TGGR Lab on GitHub">{GITHUB}</a>
    <button class="icon" id="theme" type="button" aria-label="Switch to dark theme">{THEME}</button>
    <button class="icon menu-btn" id="menu-btn" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="menu">{MENU}</button>
  </div>
  {chromosome()}
</header>
<nav class="menu" id="menu" aria-label="Sections" hidden>{menu}</nav>

<canvas class="side-helix" aria-hidden="true"></canvas>
<div class="hero" id="top">
  <div class="hero-in">
    <h1 class="sr">TGGR Lab, Translational Genetics and Genomics Research Laboratory</h1>
    <div class="tilt" id="tilt"><tggr-logo motion="drawn" label="TGGR Lab logo"></tggr-logo></div>
    <p class="where">Genetics Institute <b>·</b> Tel Aviv Sourasky Medical Center</p>
  </div>
</div>

<main>
  <section id="research" aria-labelledby="research-h">
    {big("research", "Research")}
    <div class="sec-body">
      <p class="mission rise">{MISSION}</p>
      <p class="focus rise">{FOCUS}</p>
      <p class="from rise">{FAMILIES}</p>
    </div>
  </section>
{divider(3)}
  <section id="publications" aria-labelledby="publications-h">
    {big("publications", "Publications")}
    <div class="sec-body">
    <div class="search rise">
      <label>{SEARCH}<span class="sr">Search titles, journals and authors</span><input id="q" type="search" placeholder="Gene, journal or author" autocomplete="off"></label>
      <button class="clear" id="clear" type="button" hidden>Clear</button>
    </div>
    <ul class="pubs" data-filter>
{chr(10).join(pubs)}
    </ul>
    <p class="none" id="none" hidden aria-live="polite">No papers match.</p>
    </div>
  </section>
{divider(10)}
  <section id="tools" aria-labelledby="tools-h">
    {big("tools", "Tools")}
    <div class="sec-body">
{tools}    </div>
  </section>
{divider(17)}
  <section id="people" aria-labelledby="people-h">
    {big("people", "People")}
    <div class="sec-body">
    <ul class="people">
{chr(10).join(people)}
    </ul>
    </div>
  </section>
{divider(31)}
  <section id="contact" aria-labelledby="contact-h">
    {big("contact", "Contact")}
    <div class="sec-body">
    <form class="contact rise" id="contact-form" action="{FORMSPREE}" method="POST">
      <input type="hidden" name="_subject" value="TGGR Lab website enquiry">
      <div class="honey" aria-hidden="true"><label for="c-gotcha">Leave this field empty</label><input type="text" id="c-gotcha" name="_gotcha" tabindex="-1" autocomplete="off"></div>
      <div class="row">
        <label class="f"><span>Name <i aria-hidden="true">*</i></span><input type="text" id="c-name" name="name" autocomplete="name" required></label>
        <label class="f"><span>Email <i aria-hidden="true">*</i></span><input type="email" id="c-email" name="email" autocomplete="email" required></label>
      </div>
      <div class="row">
        <label class="f"><span>Institution</span><input type="text" id="c-inst" name="institution" autocomplete="organization"></label>
        <label class="f"><span>Type of enquiry</span><select id="c-type" name="enquiry_type"><option value="" selected>Select one</option>{"".join(f'<option>{html.escape(o)}</option>' for o in ENQUIRY)}</select></label>
      </div>
      <label class="f"><span>Message <i aria-hidden="true">*</i></span><textarea id="c-msg" name="message" rows="6" required></textarea></label>
      <p class="note">Do not submit patient-identifiable or other sensitive information through this form.</p>
      <div class="send"><button type="submit">Send {ARROW}</button><p class="status" id="c-status" role="status" aria-live="polite"></p></div>
    </form>
    </div>
  </section>

  <footer>
    <div class="go">
      <a href="https://github.com/tggr-lab">GitHub {ARROW}</a>
      <a href="{TASMC}">Lab page at TASMC {ARROW}</a>
    </div>
    <small>Tel Aviv Sourasky Medical Center · Faculty of Medicine, Tel Aviv University</small>
  </footer>
</main>
<script src="logo-kit/tggr-logo.js"></script>
<script src="assets/site.js"></script>
</body>
</html>
'''


(HERE / "index.html").write_text(page())
print(f"index.html {len(page()) / 1024:.1f} KB")
