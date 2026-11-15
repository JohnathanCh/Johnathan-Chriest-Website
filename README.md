# Johnathan-Chriest-Website

Johnathan Chriest’s personal website, hosted on GitHub Pages at https://johnathanchriest.art.

## Routes

- `/`: split landing page introducing Music and Writing.
- `/music/`: music entry page, initially showing Opris.
- `/music/Opris/`: Opris’s page.
- `/music/eilah/`: Eilah’s page.
- `/writing/`: writing entry page with The Visitor and a link to Chapter One.

The artist names are ordinary links, so direct visits, refresh, new tabs, and browser history work without custom routing.

Shared styles, scripts, and images remain at the repository root. GitHub Pages normalizes `/music` to `/music/`.

## Editing the landing and writing pages

Edit `index.html` for the homepage wording and its Music/Writing links. Edit `writing/index.html` for the writing introduction and chapter link. Both use `portfolio.css`; music and the immersive chapter keep their separate styles. The homepage is two equal columns on desktop and two stacked panels on phones, with ordinary links and no JavaScript dependency.

The writing page uses the three supplied Chapter One images in `assets/writing/`, encoded as lossless WebP with their original pixels and proportions. It also includes a Chapter Two “Coming soon” section. These preview images are separate from the interactive room's panorama.

## The Visitor — Chapter One

`/writing/the-visitor/chapter-one/` hosts the approved interactive waking-room experience. GitHub Pages redirects the address without the trailing slash to this directory. It is a standalone page, so its styles and controls are isolated from the music portfolio.

The native Blender panorama uses a 16,384 × 8,192 master with responsive 4K, 8K, and 16K tiles. The viewer keeps the fixed bed viewpoint, phone motion permission and swipe/arrow controls, guitar playback, music panel, and notebook chapter reader. All runtime assets and vendor licenses are included locally. The large master render and archived generated studies are not published.

Edit this page in `writing/the-visitor/chapter-one/`. Preserve its relative asset paths and the initial camera/interaction coordinates. HTTPS on the existing custom domain supports the phone motion permission prompt without a local test certificate.

## Editing music pages

Edit the shared template in `music/index.html` and artist information in `music-projects.mjs`, then run `node scripts/build-music-pages.mjs`. Commit the generated `music/Opris/index.html` and `music/eilah/index.html` along with the source changes.

The shared music header includes a Home button linking to `/`, including a centred position between the artist names on small screens.

## Publishing

Work on `development`, then review and merge a pull request into `production` to publish. GitHub Pages serves the root of `production`; keep `CNAME` at the repository root.

## Canonical local folder and updates

The working repository is `/Volumes/T7 Shield/*** The Visitor/Website/Johnathan_Chriest_Website/`.
The older Desktop checkout is now `/Users/John/Desktop/The Rome Prize/Website/OLD johnathan-chriest-website/`; it is preserved as an archive and should not be used for publishing.
`4_Blink_2026-11-12` and other numbered Website folders are earlier prototypes, not the publishing repository.

Edit The Visitor in `writing/the-visitor/chapter-one/`. Its `assets/` folder is the correct place for `chapter-one.pdf`. The reader also needs `chapter.json`; after replacing the PDF, run `python3 -B scripts/update-chapter.py` from this repository. This extracts its prose and source separators without rewriting them and updates the PDF cache tag in `index.html`. It requires Poppler's `pdftotext`, already installed on John's Mac. The current PDF and reader heading is “Chapter One - Waking Up”. The heading was corrected without changing the prose. The regeneration command extracts the supplied PDF without editing it.

For changes to HTML, CSS or JavaScript, save those files in this repository. Preview and check them first. Do not copy changes from an older prototype over the current chapter directory.

To publish a chapter PDF update:

1. Make sure the T7 is connected. In Terminal, `cd '/Volumes/T7 Shield/*** The Visitor/Website/Johnathan_Chriest_Website'`.
2. Work on `development`. Before editing, run `git switch development` and `git pull --ff-only origin development` when your working files are clean.
3. Replace `writing/the-visitor/chapter-one/assets/chapter-one.pdf`, then run `python3 -B scripts/update-chapter.py`.
4. Inspect `git diff` and preview the result. Stage the files you intend to publish: `git add writing/the-visitor/chapter-one/assets/chapter-one.pdf writing/the-visitor/chapter-one/assets/chapter.json writing/the-visitor/chapter-one/index.html`.
5. Run `git commit -m "Update Chapter One"`, then `git push origin development`.
6. On GitHub, create a pull request with base **production** and compare **development**. Review and merge it. `development` alone is not published.
7. In the repository's Actions tab, wait for the Pages build/deployment to succeed. Open https://johnathanchriest.art/writing/the-visitor/chapter-one/ and refresh. GitHub Pages automatically publishes the root of `production` to the custom domain.

For other updates, stage the specific changed source files instead. Music template changes additionally require `node scripts/build-music-pages.mjs`; commit its generated music pages. Avoid `git add .` so unrelated personal files are not accidentally included. Local `.task-work/` profiles, reports, cache and temporary files are ignored and must not be uploaded. Keep `CNAME` unchanged.

For a local preview from the correct repository, run `python3 -B scripts/preview.py --port 8080`, then open http://127.0.0.1:8080/writing/the-visitor/chapter-one/. The server supports seeking audio and refuses requests for private dot-folders. Production HTTPS is the easiest way to test real phone motion; local HTTP supports the arrow/swipe interface. Use a different free port if 8080 is already running the preview.

The current chapter track is `writing/the-visitor/chapter-one/assets/chapter-one-mix-1.wav` (Chapter 1 - Mix 1). It is copied exactly from the supplied WAV: no encoding, normalization, EQ or mastering. Browser playback defaults to 100% volume, with an optional listener volume control. `assets/audio-info.json` records its byte hash and duration. For a future track replacement, copy the intended file into assets, update the audio URLs and track title in the chapter index, and update audio-info.json; never run audio processing unless explicitly requested.
