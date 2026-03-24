# 🚗 Radioportal

Min private strømmeradio til bilen.

A simple, car-friendly streaming radio web app. Open it in any browser — no installation needed.

## Features

- Stream live internet radio stations
- Large, touch-friendly controls (ideal for car use)
- Keyboard shortcuts: `Space` play/pause, `←`/`→` prev/next station, `↑`/`↓` volume
- Dark theme to reduce glare while driving
- Works offline-ready in the browser — just open `index.html`

## Usage

1. Open `index.html` in a browser (or serve the folder with any static web server).
2. Tap a station to start streaming.
3. Use the ▶ / ⏸ button or keyboard to control playback.

## Adding your own stations

Edit the `STATIONS` array in `app.js`. Each entry needs:

```js
{
  name: 'Station Name',
  genre: 'Genre description',
  logo: '🎵',           // any emoji
  url: 'https://...',   // Icecast / SHOUTcast / HLS stream URL
}
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main page |
| `styles.css` | Dark, car-friendly theme |
| `app.js` | Playback logic and station list |
