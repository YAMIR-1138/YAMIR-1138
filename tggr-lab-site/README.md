# TGGR Lab landing page

The site behind **https://tggr-lab.github.io/**. One HTML file, no build step.

| File | What it is |
|---|---|
| `index.html` | The page. Everything editable is marked in the comment at the top. |
| `404.html` | Shown by GitHub Pages for a missing address. |
| `og.png` | The picture a shared link shows. Made from `og.html`. |
| `og.html` | The source of `og.png`, a 1200 × 630 page. |
| `profile/README.md` | The short profile shown on github.com/tggr-lab. Goes in a separate repo, see below. |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are. |

## Publish it

1. In the `tggr-lab` organization, create a public repository named exactly **`tggr-lab.github.io`**.
2. Copy `index.html`, `404.html`, `og.png`, `og.html` and `.nojekyll` into its root and push to `main`.
3. In that repository, open **Settings → Pages**, set the source to *Deploy from a branch*, branch `main`, folder `/ (root)`.
4. A minute later the page is live at https://tggr-lab.github.io/.

Because the repository is the organization's own `*.github.io`, the existing project sites keep their addresses (`tggr-lab.github.io/pellaeon/` and so on) and this page becomes the root.

## The organization profile

GitHub shows a README at the top of https://github.com/tggr-lab when the organization has a **public** repository named **`.github`** with the file `profile/README.md`. Create that repository and copy `profile/README.md` into it, keeping the folder name.

## Remake the share picture

`og.png` is a screenshot of `og.html`. With Playwright installed:

```bash
npx playwright screenshot --viewport-size=1200,630 og.html og.png
```

Any browser works: open `og.html`, size the window to 1200 × 630, and take a screenshot.
