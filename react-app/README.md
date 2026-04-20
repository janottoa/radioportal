# Radioportalen React App

A modern React 18 + TypeScript + Vite radio portal application.

## Features

- 📻 Browse and play radio stations by category
- 🎵 Real-time metadata via WebSocket (song/artist info)
- 📝 Synchronized lyrics display (LRC format)
- 🔊 Sonos speaker integration
- 🌙 Dark/light theme toggle
- ⛶ Fullscreen support
- 📱 Mobile-friendly responsive layout

## Tech Stack

- **React 18** with hooks
- **TypeScript** strict mode
- **Vite** for fast dev/build
- **hls.js** for HLS stream support

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Preview production build

```bash
npm run preview
```

## Architecture

- `src/hooks/` — Custom React hooks (audio, WebSocket, Sonos, lyrics)
- `src/components/` — UI components (Header, StationsGrid, Footer, modals)
- `src/utils/` — Pure utility functions (metadata parsers, LRC parser)
- `src/types/` — TypeScript interfaces
- `public/stations.json` — Station definitions grouped by category
