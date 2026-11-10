const header = document.querySelector('.site-header');
const nav = document.querySelector('.nav');
const projects = {
  opris: {
    name: 'Opris',
    bio: [
      'Opris is the ambient project of Los Angeles-based composer Johnathan Chriest. Raised in a working-class family in the woods north of Pittsburgh, Pennsylvania, he began creating stories as a way to imagine a world beyond his surroundings. That impulse continues through 20 years of writing, recording, and performing, including tours across the US and Europe, film scores, and improvisational live sets lasting up to four hours. His music brings atmosphere and emotional depth to films, television, commercials, and live events.',
      'Expansive synths, finger-picked acoustic guitar, and a soft voice shape his sound. Live, he connects songs through improvisation, shaping each set into a continuous story.'
    ],
    spotify: 'https://open.spotify.com/artist/3zgR5Pvb2DmjoveZ4itMPf?si=4pFPPWz6QU2yM-Jkae7xeA',
    embed: 'https://open.spotify.com/embed/artist/3zgR5Pvb2DmjoveZ4itMPf?utm_source=generator&si=a6e2afe819eb43ef',
    contact: 'For film scoring, bookings, and press.'
  },
  eilah: {
    name: 'Eilah',
    bio: [
      'Eilah is the indie-folk/dream-pop project of Los Angeles-based solo musician Johnathan Chriest. The project draws on nearly 20 years of writing, recording, and performing, including tours across the US and Europe.',
      'Finger-picked acoustic guitar, synth textures, and a soft voice anchor songs that connect into larger stories across his releases. His live performances carry that approach onto the stage, weaving songs into a continuous set with an emphasis on lyrics and emotional expression.'
    ],
    spotify: 'https://open.spotify.com/artist/7cXvqMni08RWGVtcB1aeoc?si=2InpPT2bSHmx1t6rpJYYug',
    embed: 'https://open.spotify.com/embed/artist/7cXvqMni08RWGVtcB1aeoc?utm_source=generator&si=a9ca465f16cb41cb',
    contact: 'For bookings and press.'
  }
};
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
  document.querySelector('.project-toggle').setAttribute('aria-pressed', String(project === 'eilah'));
  document.querySelector('.project-opris').setAttribute('aria-current', String(project === 'opris'));
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
document.querySelector('.project-toggle').addEventListener('click', () => {
  selectProject('eilah');
  location.hash = '#top';
  document.querySelector('#top').scrollIntoView();
});
document.querySelector('.project-opris').addEventListener('click', () => selectProject('opris'));
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  // Film stays in both menus and leads to the Opris scores.
  if (link.getAttribute('href') === '#film' && header.dataset.project === 'eilah') selectProject('opris');
}));
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
selectProject('opris');
