import React from 'react';
import { Station } from '../../types';
import StationCard from './StationCard';

interface Props {
  stations: Station[];
  currentStation: Station | null;
  onStationClick: (station: Station) => void;
}

export default function StationsGrid({ stations, currentStation, onStationClick }: Props) {
  return (
    <div className="stations-grid-container">
      <div className="stations-grid">
        {stations.map((station, idx) => (
          <StationCard
            key={`${station.url}-${idx}`}
            station={station}
            isPlaying={currentStation?.url === station.url}
            onClick={onStationClick}
          />
        ))}
      </div>
    </div>
  );
}
