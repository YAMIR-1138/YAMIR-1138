#!/usr/bin/env python3
"""Build the logo kit from src/ and assets/. Standard library only.

    python3 build.py

writes
    tggr-logo.js             the web component; loads the PNG layers from ./assets/
    tggr-logo.standalone.js  the same with every layer inlined, one file to copy anywhere
    tggr-logo.svg            the turning ring as an animated SVG, light or dark by the
                             viewer's setting; needs no script, works in <img> and READMEs
    tggr-logo-light.svg      the same, fixed for light backgrounds
    tggr-logo-dark.svg       the same, fixed for dark backgrounds
"""
import base64, json, pathlib

HERE = pathlib.Path(__file__).resolve().parent
A = HERE / 'assets'
RING = json.loads((HERE / 'src' / 'ring-paths.json').read_text())
SRC = (HERE / 'src' / 'tggr-logo.src.js').read_text()


def uri(name):
    return 'data:image/png;base64,' + base64.b64encode((A / name).read_bytes()).decode()


def js(embed):
    out = SRC.replace('__RING__', json.dumps(RING)).replace('__EMBED__', json.dumps(embed) if embed else 'null')
    assert '__RING__' not in out and '__EMBED__' not in out
    return out


(HERE / 'tggr-logo.js').write_text(js(None))
(HERE / 'tggr-logo.standalone.js').write_text(js({
    'ink': uri('lock-ink.png'), 'inkDark': uri('lock-ink-dark.png'), 'teal': uri('lock-teal.png'),
    'orange': uri('lock-orange.png'), 'band': uri('band.png'),
}))

# The SVG uses the same 400 x 400 geometry as the component: ring radius 180, lockup 44.4% of
# the diameter, its centre 1.5% of its own height above the ring's centre.
W = 400 * .444; H = W * 962 / 600; X = 200 - W / 2; Y = 200 - .515 * H
LIGHT, DARK = '#15302e', '#ece6d6'


def svg(mode):
    img = lambda cls, name: f'<image class="{cls}" href="{uri(name)}" x="{X:.2f}" y="{Y:.2f}" width="{W:.2f}" height="{H:.2f}"/>'
    if mode == 'auto':
        ink = img('lt', 'lock-ink.png') + img('dk', 'lock-ink-dark.png')
        theme = (f'.ring{{fill:{LIGHT}}}.dk{{display:none}}'
                 f'@media (prefers-color-scheme:dark){{.ring{{fill:{DARK}}}.lt{{display:none}}.dk{{display:inline}}}}')
    else:
        ink = img('', 'lock-ink.png' if mode == 'light' else 'lock-ink-dark.png')
        theme = f'.ring{{fill:{LIGHT if mode == "light" else DARK}}}'
    style = ('.ring{transform-origin:200px 200px;animation:turn 80s linear infinite}'
             '@keyframes turn{to{transform:rotate(360deg)}}'
             '@media (prefers-reduced-motion:reduce){.ring{animation:none}}' + theme)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" role="img" aria-label="TGGR Lab">'
            '<title>TGGR Lab · Translational Genetics and Genomics Research Laboratory</title>'
            f'<style>{style}</style>'
            f'<g class="ring"><path d="{RING["single"]}"/><circle cx="20" cy="200" r="2.4"/></g>'
            + ink + img('', 'lock-orange.png') + img('', 'lock-teal.png') + '</svg>\n')


for mode, name in (('auto', 'tggr-logo.svg'), ('light', 'tggr-logo-light.svg'), ('dark', 'tggr-logo-dark.svg')):
    (HERE / name).write_text(svg(mode))

for f in ('tggr-logo.js', 'tggr-logo.standalone.js', 'tggr-logo.svg', 'tggr-logo-light.svg', 'tggr-logo-dark.svg'):
    print(f'{f:28} {(HERE / f).stat().st_size / 1024:7.1f} KB')
