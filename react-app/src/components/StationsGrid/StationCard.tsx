import React from 'react';
import { Station } from '../../types';

interface Props {
  station: Station;
  isPlaying: boolean;
  onClick: (station: Station) => void;
}

export default function StationCard({ station, isPlaying, onClick }: Props) {
  const initials = station.name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`station-card${isPlaying ? ' playing' : ''}`}
      onClick={() => onClick(station)}
      title={station.name}
    >
      {station.logo ? (
        <img
          className="station-logo"
          src={station.logo}
          alt={station.name}
          loading="lazy"
          onError={e => {
            const img = e.target as HTMLImageElement;
            img.style.display = 'none';
            const next = img.nextElementSibling as HTMLElement;
            if (next) next.style.display = 'flex';
          }}
        />
      ) : null}
      <div
        className="station-logo-placeholder"
        style={{ display: station.logo ? 'none' : 'flex' }}
      >
        {initials}
      </div>
      <span className="station-name">{station.name}</span>
    </div>
  );
}
