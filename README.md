# Johnathan-Chriest-Website

Johnathan Chriest’s personal website, hosted on GitHub Pages at https://johnathanchriest.art.

## Routes

- `/music/`: the Opris and Eilah music page, including the project switcher.
- `/`: redirects to `/music/` for now, preserving query parameters and section links when JavaScript is enabled.

Shared styles, scripts, and images remain at the repository root. GitHub Pages normalizes `/music` to `/music/`.

## Publishing

Work on `development`, then review and merge a pull request into `production` to publish. GitHub Pages serves the root of `production`; keep `CNAME` at the repository root.
