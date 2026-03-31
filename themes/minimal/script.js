const titleEl = document.getElementById('title');
const artistEl = document.getElementById('artist');
const artEl = document.getElementById('art');

window.addEventListener('message', (event) => {
  if (event.data.type === 'track-update') {
    const track = event.data.payload;

    if (track === null) {
      titleEl.textContent = '—';
      artistEl.textContent = '—';
      artEl.src = '';
      return;
    }

    titleEl.textContent = track.title ?? '—';
    artistEl.textContent = track.artist ?? '—';
    artEl.src = track.albumArtUrl ?? '';
  }
});
