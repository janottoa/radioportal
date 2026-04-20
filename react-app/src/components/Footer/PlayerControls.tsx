import React from 'react';

interface Props {
  isPlaying: boolean;
  isFavorite: boolean;
  hasLyrics: boolean;
  onPlayPause: () => void;
  onLyrics: () => void;
  onFavorite: () => void;
  onSonos: () => void;
}

export default function PlayerControls({
  isPlaying,
  isFavorite,
  hasLyrics,
  onPlayPause,
  onLyrics,
  onFavorite,
  onSonos,
}: Props) {
  const stopPropagation = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div className="player-controls">
      <button
        className="play-btn"
        onClick={stopPropagation(onPlayPause)}
        title={isPlaying ? 'Pause' : 'Spill'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      {hasLyrics && (
        <button
          className={`ctrl-btn${hasLyrics ? ' active' : ''}`}
          onClick={stopPropagation(onLyrics)}
          title="Sangtekst"
        >
          📝
        </button>
      )}
      <button
        className={`ctrl-btn${isFavorite ? ' active' : ''}`}
        onClick={stopPropagation(onFavorite)}
        title="Favoritt"
      >
        {isFavorite ? '★' : '☆'}
      </button>
      <button
        className="ctrl-btn"
        onClick={stopPropagation(onSonos)}
        title="Sonos"
      >
        🔊
      </button>
    </div>
  );
}
