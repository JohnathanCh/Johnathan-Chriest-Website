import { projects } from './music-projects.mjs';
const header = document.querySelector('.site-header');

function selectProject(project) {
  const data = projects[project];
  if (header.dataset.project !== project) {
    // Unload hidden players when switching artists.
    document.querySelectorAll('.film-embed').forEach(frame => frame.replaceWith(frame._poster));
  }
  header.dataset.project = project;
  document.body.dataset.project = project;
  document.querySelector('#artist-name').textContent = data.name;
  document.querySelector('.bio-first').textContent = data.bio[0];
  document.querySelector('.bio-second').textContent = data.bio[1];
  document.querySelector('.spotify-link').href = data.spotify;
  document.querySelector('.footer-spotify').href = data.spotify;
  const player = document.querySelector('.spotify-embed-wrap iframe');
  if (player.getAttribute('src') !== data.embed) player.src = data.embed;
  player.title = data.name + ' on Spotify';
  document.querySelector('.footer-artist').textContent = data.name;
  document.querySelector('.contact-context').textContent = data.contact;
  const subject = encodeURIComponent(data.name + ' inquiry');
  document.querySelector('.gmail-compose').href = 'https://mail.google.com/mail/?view=cm&fs=1&to=oprismusic%40gmail.com&su=' + subject;
  document.querySelector('.email-app').href = 'mailto:oprismusic@gmail.com?subject=' + subject;
  document.querySelector('.project-toggle').setAttribute('aria-current', project === 'eilah' ? 'page' : 'false');
  document.querySelector('.project-opris').setAttribute('aria-current', project === 'opris' ? 'page' : 'false');
  document.querySelectorAll('[data-video-project]').forEach(card => { card.hidden = card.dataset.videoProject !== project; });
  // Preserve the same order for sighted visitors, keyboard navigation, and screen readers.
  const firstWork = document.querySelector(project === 'opris' ? '#film' : '#music');
  document.querySelector('main').insertBefore(firstWork, document.querySelector('#about').nextSibling);
  const main = document.querySelector('main');
  const live = document.querySelector('#live');
  if (project === 'opris') {
    main.insertBefore(live, document.querySelector('#contact'));
  } else {
    main.insertBefore(live, document.querySelector('#travel'));
  }
  document.title = data.name + ' — Johnathan Chriest';
  document.querySelector('meta[name="description"]').content = data.bio[0];
}
document.querySelectorAll('.film-thumb').forEach(poster => {
  const button = poster.querySelector('.film-play');
  button.addEventListener('click', () => {
    const card = poster.closest('[data-embed]');
    const frame = document.createElement('div');
    frame.className = 'film-embed';
    if (poster.classList.contains('portrait')) frame.classList.add('portrait');
    const iframe = document.createElement('iframe');
    iframe.src = card.dataset.embed;
    iframe.title = button.getAttribute('aria-label');
    iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
    iframe.allowFullscreen = true;
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.append(iframe);
    frame._poster = poster;
    poster.replaceWith(frame);
  });
});
document.querySelector('.copy-email').addEventListener('click', async () => {
  const status = document.querySelector('.copy-status');
  try {
    await navigator.clipboard.writeText('oprismusic@gmail.com');
    status.textContent = 'Email address copied.';
  } catch {
    status.textContent = 'Select and copy the address above: oprismusic@gmail.com';
  }
});
selectProject(document.body.dataset.project === 'eilah' ? 'eilah' : 'opris');
