# Johnathan-Chriest-Website

Johnathan Chriest’s personal website, hosted on GitHub Pages at https://johnathanchriest.art.

## Routes

- `/music/`: music entry page, initially showing Opris.
- `/music/Opris/`: Opris’s page.
- `/music/eilah/`: Eilah’s page.

The artist names are ordinary links, so direct visits, refresh, new tabs, and browser history work without custom routing.
- `/`: redirects to `/music/` for now, preserving query parameters and section links when JavaScript is enabled.

Shared styles, scripts, and images remain at the repository root. GitHub Pages normalizes `/music` to `/music/`.

## Editing music pages

Edit the shared template in `music/index.html` and artist information in `music-projects.mjs`, then run `node scripts/build-music-pages.mjs`. Commit the generated `music/Opris/index.html` and `music/eilah/index.html` along with the source changes.

## Publishing

Work on `development`, then review and merge a pull request into `production` to publish. GitHub Pages serves the root of `production`; keep `CNAME` at the repository root.
