'use strict';

/**
 * Radioportal – private streaming radio for the car.
 *
 * Stations list: each entry has a name, genre, emoji logo and a public
 * Icecast / SHOUTcast / HLS stream URL.  Replace or extend the list with
 * your own private/favourite stations as needed.
 */
const STATIONS = [
  {
    name: 'NRK P1',
    genre: 'Norsk rikskringkasting',
    logo: '🇳🇴',
    url: 'https://lyd.nrk.no/nrk_radio_p1_ostlandssendingen_aac_h',
  },
  {
    name: 'NRK P2',
    genre: 'Kultur & klassisk',
    logo: '🎻',
    url: 'https://lyd.nrk.no/nrk_radio_p2_aac_h',
  },
  {
    name: 'NRK P3',
    genre: 'Pop & musikk',
    logo: '🎵',
    url: 'https://lyd.nrk.no/nrk_radio_p3_aac_h',
  },
  {
    name: 'NRK mP3',
    genre: 'Hits',
    logo: '🎤',
    url: 'https://lyd.nrk.no/nrk_radio_mp3_aac_h',
  },
  {
    name: 'Radio Norge',
    genre: 'Pop & norsk musikk',
    logo: '📻',
    url: 'https://stream.radionorge.no/radionorge',
  },
  {
    name: 'P4',
    genre: 'Pop',
    logo: '🎶',
    url: 'https://p4stream5.p4.no/stream',
  },
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const audio = document.getElementById('audio-player');
const btnPlay = document.getElementById('btn-play');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const volumeSlider = document.getElementById('volume-slider');
const volumeDisplay = document.getElementById('volume-display');
const stationNameEl = document.getElementById('station-name');
const stationGenreEl = document.getElementById('station-genre');
const stationLogoEl = document.getElementById('station-logo');
const statusEl = document.getElementById('status');
const stationList = document.getElementById('station-list');

// ── State ─────────────────────────────────────────────────────────────────────
let currentIndex = -1;
let isPlaying = false;

// ── Build station list ────────────────────────────────────────────────────────
function buildStationList() {
  STATIONS.forEach((station, index) => {
    const li = document.createElement('li');
    li.className = 'station-item';
    li.setAttribute('role', 'button');
    li.setAttribute('tabindex', '0');
    li.setAttribute('aria-label', `${station.name} – ${station.genre}`);
    li.dataset.index = index;

    li.innerHTML = `
      <span class="item-logo" aria-hidden="true">${station.logo}</span>
      <span class="item-info">
        <span class="item-name">${station.name}</span>
        <span class="item-genre">${station.genre}</span>
      </span>
      <span class="item-playing" aria-hidden="true"></span>
    `;

    li.addEventListener('click', () => selectStation(index));
    li.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectStation(index);
      }
    });

    stationList.appendChild(li);
  });
}

// ── Select & play a station ───────────────────────────────────────────────────
function selectStation(index) {
  if (index === currentIndex && isPlaying) {
    // Clicking the active, playing station toggles pause
    togglePlay();
    return;
  }

  currentIndex = index;
  const station = STATIONS[index];

  // Update now-playing display
  stationNameEl.textContent = station.name;
  stationGenreEl.textContent = station.genre;
  stationLogoEl.textContent = station.logo;

  // Load and play
  audio.src = station.url;
  audio.load();
  startPlay();

  highlightActiveStation();
}

// ── Play / pause ──────────────────────────────────────────────────────────────
function togglePlay() {
  if (currentIndex === -1) {
    selectStation(0);
    return;
  }

  if (isPlaying) {
    audio.pause();
  } else {
    // If src was cleared or not set, reload
    if (!audio.src || audio.src === window.location.href) {
      audio.src = STATIONS[currentIndex].url;
      audio.load();
    }
    startPlay();
  }
}

function startPlay() {
  const playPromise = audio.play();
  if (playPromise !== undefined) {
    playPromise.catch(() => {
      // Autoplay blocked – user must interact; UI already shows "Buffrer…"
    });
  }
}

// ── Prev / Next ───────────────────────────────────────────────────────────────
function prevStation() {
  const next = currentIndex <= 0 ? STATIONS.length - 1 : currentIndex - 1;
  selectStation(next);
}

function nextStation() {
  const next = currentIndex >= STATIONS.length - 1 ? 0 : currentIndex + 1;
  selectStation(next);
}

// ── Volume ────────────────────────────────────────────────────────────────────
function onVolumeChange() {
  const val = parseFloat(volumeSlider.value);
  audio.volume = val;
  volumeDisplay.textContent = `${Math.round(val * 100)}%`;
}

// ── Update UI to reflect playback state ───────────────────────────────────────
function setPlayingState(playing) {
  isPlaying = playing;
  btnPlay.textContent = playing ? '⏸' : '▶';
  btnPlay.classList.toggle('playing', playing);
  statusEl.textContent = playing ? 'Spiller' : 'Stoppet';
  highlightActiveStation();
}

function highlightActiveStation() {
  document.querySelectorAll('.station-item').forEach((item) => {
    const idx = parseInt(item.dataset.index, 10);
    const active = idx === currentIndex;
    item.classList.toggle('active', active);
    item.querySelector('.item-playing').textContent =
      active && isPlaying ? '▶ Spiller' : '';
  });
}

// ── Audio event listeners ─────────────────────────────────────────────────────
audio.addEventListener('playing', () => setPlayingState(true));
audio.addEventListener('pause', () => setPlayingState(false));
audio.addEventListener('ended', () => setPlayingState(false));
audio.addEventListener('waiting', () => {
  statusEl.textContent = 'Buffrer…';
});
audio.addEventListener('error', () => {
  statusEl.textContent = 'Feil – prøv igjen';
  setPlayingState(false);
});

// ── Button listeners ──────────────────────────────────────────────────────────
btnPlay.addEventListener('click', togglePlay);
btnPrev.addEventListener('click', prevStation);
btnNext.addEventListener('click', nextStation);
volumeSlider.addEventListener('input', onVolumeChange);

// ── Keyboard shortcuts (car-friendly) ────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  switch (e.key) {
    case ' ':
      // Avoid scrolling the page
      if (e.target === document.body) {
        e.preventDefault();
        togglePlay();
      }
      break;
    case 'ArrowRight':
      nextStation();
      break;
    case 'ArrowLeft':
      prevStation();
      break;
    case 'ArrowUp':
      volumeSlider.value = Math.min(1, parseFloat(volumeSlider.value) + 0.05);
      onVolumeChange();
      break;
    case 'ArrowDown':
      volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 0.05);
      onVolumeChange();
      break;
  }
});

// ── Init ──────────────────────────────────────────────────────────────────────
audio.volume = parseFloat(volumeSlider.value);
buildStationList();
