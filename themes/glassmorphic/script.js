const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const albumEl = document.getElementById('album');
const artEl = document.getElementById('art');
const bgEl = document.getElementById('bg');

window.addEventListener('message', (event) => {
  if (event.data.type === 'track-update') {
    const track = event.data.payload;

    if (track === null) {
      titleEl.textContent = '—';
      artistEl.textContent = '—';
      albumEl.textContent = '—';
      artEl.src = '';
      bgEl.style.backgroundImage = '';
      return;
    }

    titleEl.textContent = track.title ?? '—';
    artistEl.textContent = track.artist ?? '—';
    albumEl.textContent = track.album ?? '—';

    if (track.albumArtUrl) {
      artEl.src = track.albumArtUrl;
      bgEl.style.backgroundImage = `url('${track.albumArtUrl}')`;
    } else {
      artEl.src = '';
      bgEl.style.backgroundImage = '';
    }
  }
});
