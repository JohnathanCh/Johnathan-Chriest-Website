import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { projects } from '../music-projects.mjs';

// Edit music/index.html and music-projects.mjs, then regenerate both artist pages.
const root = new URL('../', import.meta.url);
const template = await readFile(new URL('music/index.html', root), 'utf8');
const escapeHtml = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

for (const [project, route] of [['opris', 'Opris'], ['eilah', 'eilah']]) {
  const data = projects[project];
  let html = template
    .replace(/<title>.*?<\/title>/, `<title>${data.name} — Johnathan Chriest</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${escapeHtml(data.bio[0])}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1https://johnathanchriest.art/music/${route}/`)
    .replaceAll('data-project="opris"', `data-project="${project}"`)
    .replace(/(<h1 id="artist-name">).*?(<\/h1>)/, `$1${data.name}$2`)
    .replace(/(<p class="bio-first">).*?(<\/p>)/, `$1${escapeHtml(data.bio[0])}$2`)
    .replace(/(<p class="bio-second">).*?(<\/p>)/, `$1${escapeHtml(data.bio[1])}$2`)
    .replace(/(<p class="contact-context">).*?(<\/p>)/, `$1${data.contact}$2`)
    .replace(/(<a class="footer-artist"[^>]*>).*?(<\/a>)/, `$1${data.name}$2`)
    .replaceAll(projects.opris.spotify, data.spotify)
    .replaceAll(projects.opris.embed, data.embed)
    .replace('title="Opris on Spotify"', `title="${data.name} on Spotify"`)
    .replaceAll('Opris%20inquiry', `${data.name}%20inquiry`)
    .replace(/(<a class="wordmark project-opris"[^>]*aria-current=")[^"]*/, `$1${project === 'opris' ? 'page' : 'false'}`)
    .replace(/(<a class="project-toggle"[^>]*aria-current=")[^"]*/, `$1${project === 'eilah' ? 'page' : 'false'}`)
    .replace(/<article[^>]*data-video-project="(opris|eilah)"[^>]*>/g, (tag, owner) => {
      tag = tag.replace(/ hidden(?=>)/, '');
      return owner === project ? tag : tag.replace(/>$/, ' hidden>');
    });
  if (project === 'eilah') html = html.replace('href="#film"', 'href="/music/Opris/#film"');

  // Render the same section order that the shared page script uses.
  const sections = [...html.matchAll(/    <section id="([^"]+)"[\s\S]*?<\/section>/g)];
  const order = project === 'eilah'
    ? ['about', 'music', 'film', 'studies', 'live', 'travel', 'contact']
    : ['about', 'film', 'studies', 'music', 'travel', 'live', 'contact'];
  const byId = new Map(sections.map(match => [match[1], match[0]]));
  if (sections.length !== order.length || order.some(id => !byId.has(id))) {
    throw new Error('Review the artist page section order before generating pages.');
  }
  html = html.replace(/(<main id="top">)[\s\S]*?(  <\/main>)/, `$1\n${order.map(id => byId.get(id)).join('\n')}\n$2`);
  const directory = new URL(`music/${route}/`, root);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('index.html', directory), html);
  console.log(`Generated /music/${route}/`);
}
