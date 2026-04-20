import React from 'react';
import { Station } from '../../types';

interface Props {
  station: Station;
  isPlaying: boolean;
  onClick: (station: Station) => void;
}

export default function StationCard({ station, isPlaying, onClick }: Props) {
  const initials = station.name.slice(0, 2).toUpperCase();

  const safeLogo = (() => {
    if (!station.logo) return '';
    try {
      const u = new URL(station.logo, window.location.href);
      return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : '';
    } catch {
      return '';
    }
  })();

  return (
    <div
      className={`station-card${isPlaying ? ' playing' : ''}`}
      onClick={() => onClick(station)}
      title={station.name}
    >
      {safeLogo ? (
        <img
          className="station-logo"
          src={safeLogo}
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
        style={{ display: safeLogo ? 'none' : 'flex' }}
      >
        {initials}
      </div>
      <span className="station-name">{station.name}</span>
    </div>
  );
}
