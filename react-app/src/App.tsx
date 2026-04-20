import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Station, Metadata } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { useAudio } from './hooks/useAudio';
import { useSonos } from './hooks/useSonos';
import { useLyrics } from './hooks/useLyrics';
import Header from './components/Header/Header';
import StationsGrid from './components/StationsGrid/StationsGrid';
import Footer from './components/Footer/Footer';
import LyricsModal from './components/LyricsModal/LyricsModal';
import SonosModal from './components/SonosModal/SonosModal';
import './styles/global.css';

type StationsData = Record<string, Station[]>;

const FAVORITES_KEY = 'radioFavorites';

function getStations(data: StationsData, category: string): Station[] {
  if (category === 'all') {
    const all: Station[] = [];
    const keys = Object.keys(data);
    for (const key of keys) {
      const cats = data[key] || [];
      all.push(...cats.slice(0, 4));
      if (all.length >= 24) break;
    }
    return all.slice(0, 24);
  }
  return data[category] || [];
}

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('mobilTheme') as 'light' | 'dark') || 'light';
  });
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stationsData, setStationsData] = useState<StationsData>({});
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [songStartTime, setSongStartTime] = useState(0);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showSonos, setShowSonos] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
  });

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('mobilTheme', theme);
  }, [theme]);

  // Load stations
  useEffect(() => {
    fetch('/stations.json')
      .then(r => r.json())
      .then((data: StationsData) => setStationsData(data))
      .catch(console.error);
  }, []);

  const audio = useAudio();

  const sonos = useSonos(
    useCallback((v: number) => audio.setVolume(v), [audio]),
    useCallback(() => audio.stop(), [audio])
  );

  const { metadata, isConnected: _isConnected } = useWebSocket(
    currentStation?.url || null,
    currentStation?.app
  );

  // Track song start time on metadata change
  useEffect(() => {
    if (metadata?.title) {
      setSongStartTime(Date.now());
    }
  }, [metadata?.title, metadata?.artist]);

  const { currentLineIndex, syncedLines, plainLines } = useLyrics(
    metadata?.lyrics,
    songStartTime
  );

  const displayedStations = useMemo(
    () => getStations(stationsData, selectedCategory),
    [stationsData, selectedCategory]
  );

  const playStation = useCallback((station: Station) => {
    setCurrentStation(station);
    setSongStartTime(0);

    if (sonos.shouldUseSonos()) {
      sonos.sendToSonos(station.url).catch(console.error);
    } else {
      audio.play(station.url);
    }
  }, [sonos, audio]);

  const handlePlayPause = useCallback(() => {
    if (audio.isPlaying) {
      audio.pause();
    } else {
      if (currentStation) {
        audio.resume();
      }
    }
  }, [audio, currentStation]);

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark');
  }, []);

  const toggleFavorite = useCallback(() => {
    if (!currentStation) return;
    setFavorites(prev => {
      const next = prev.includes(currentStation.url)
        ? prev.filter(u => u !== currentStation.url)
        : [...prev, currentStation.url];
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
      return next;
    });
  }, [currentStation]);

  const handlePlayLocal = useCallback(async () => {
    await sonos.stopSonos();
    if (currentStation) {
      audio.play(currentStation.url);
    }
  }, [sonos, audio, currentStation]);

  const isFavorite = currentStation ? favorites.includes(currentStation.url) : false;

  return (
    <div className="app">
      <Header
        theme={theme}
        onToggleTheme={toggleTheme}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
      />
      <StationsGrid
        stations={displayedStations}
        currentStation={currentStation}
        onStationClick={playStation}
      />
      {currentStation && (
        <Footer
          station={currentStation}
          metadata={metadata}
          isPlaying={audio.isPlaying}
          isFavorite={isFavorite}
          currentLineIndex={currentLineIndex}
          syncedLines={syncedLines}
          plainLines={plainLines}
          onPlayPause={handlePlayPause}
          onLyrics={() => setShowLyrics(true)}
          onFavorite={toggleFavorite}
          onSonos={() => setShowSonos(true)}
        />
      )}
      {showLyrics && currentStation && (
        <LyricsModal
          station={currentStation.name}
          metadata={metadata}
          currentLineIndex={currentLineIndex}
          syncedLines={syncedLines}
          plainLines={plainLines}
          onClose={() => setShowLyrics(false)}
        />
      )}
      {showSonos && (
        <SonosModal
          devices={sonos.devices}
          selectedDeviceIp={sonos.selectedDeviceIp}
          pendingDevices={sonos.pendingDevices}
          isPlaying={sonos.isPlaying}
          volume={sonos.volume}
          outputMode={sonos.outputMode}
          onAddDevice={sonos.addDevice}
          onDeleteDevice={sonos.deleteDevice}
          onSelectDevice={sonos.selectDevice}
          onPrepareSonos={sonos.prepareSonos}
          onStopSonos={sonos.stopSonos}
          onSetVolume={sonos.setVolume}
          onPlayLocal={handlePlayLocal}
          onClose={() => setShowSonos(false)}
        />
      )}
    </div>
  );
}
