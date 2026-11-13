# Johnathan-Chriest-Website

Johnathan Chriest’s personal website, hosted on GitHub Pages at https://johnathanchriest.art.

## Routes

- `/music/`: music entry page, initially showing Opris.
- `/music/Opris/`: Opris’s page.
- `/music/eilah/`: Eilah’s page.

The artist names are ordinary links, so direct visits, refresh, new tabs, and browser history work without custom routing.
- `/`: redirects to `/music/` for now, preserving query parameters and section links when JavaScript is enabled.

Shared styles, scripts, and images remain at the repository root. GitHub Pages normalizes `/music` to `/music/`.

## The Visitor — Chapter One

`/writing/the-visitor/chapter-one/` hosts the approved interactive waking-room experience. GitHub Pages redirects the address without the trailing slash to this directory. It is a standalone page, so its styles and controls are isolated from the music portfolio.

The native Blender panorama uses a 16,384 × 8,192 master with responsive 4K, 8K, and 16K tiles. The viewer keeps the fixed bed viewpoint, phone motion permission and swipe/arrow controls, guitar playback, music panel, and notebook chapter reader. All runtime assets and vendor licenses are included locally. The large master render and archived generated studies are not published.

Edit this page in `writing/the-visitor/chapter-one/`. Preserve its relative asset paths and the initial camera/interaction coordinates. HTTPS on the existing custom domain supports the phone motion permission prompt without a local test certificate.

## Editing music pages

Edit the shared template in `music/index.html` and artist information in `music-projects.mjs`, then run `node scripts/build-music-pages.mjs`. Commit the generated `music/Opris/index.html` and `music/eilah/index.html` along with the source changes.

## Publishing

Work on `development`, then review and merge a pull request into `production` to publish. GitHub Pages serves the root of `production`; keep `CNAME` at the repository root.
