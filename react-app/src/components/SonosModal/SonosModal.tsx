import React, { useState } from 'react';
import { SonosDevice } from '../../types';

interface Props {
  devices: SonosDevice[];
  selectedDeviceIp: string;
  pendingDevices: string[];
  isPlaying: boolean;
  volume: number;
  outputMode: 'local' | 'sonos';
  onAddDevice: (name: string, ip: string) => void;
  onDeleteDevice: (ip: string) => void;
  onSelectDevice: (ip: string, selected: boolean) => void;
  onPrepareSonos: () => void;
  onStopSonos: () => void;
  onSetVolume: (v: number) => void;
  onPlayLocal: () => void;
  onClose: () => void;
}

export default function SonosModal({
  devices,
  selectedDeviceIp,
  pendingDevices,
  isPlaying,
  volume,
  outputMode,
  onAddDevice,
  onDeleteDevice,
  onSelectDevice,
  onPrepareSonos,
  onStopSonos,
  onSetVolume,
  onPlayLocal,
  onClose,
}: Props) {
  const [newName, setNewName] = useState('');
  const [newIp, setNewIp] = useState('');

  const handleAdd = () => {
    if (newName.trim() && newIp.trim()) {
      onAddDevice(newName.trim(), newIp.trim());
      setNewName('');
      setNewIp('');
    }
  };

  const bannerClass = isPlaying ? 'playing' : (outputMode === 'sonos' ? 'ready' : 'default');
  const bannerText = isPlaying
    ? '🔊 Sonos spiller nå'
    : outputMode === 'sonos'
    ? '✅ Klar for Sonos — velg stasjon'
    : '📋 Velg enhet og trykk "Gjør klar"';

  const hasPending = pendingDevices.length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">🔊 Sonos</div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className={`sonos-banner ${bannerClass}`}>{bannerText}</div>

        <div className="sonos-volume">
          <label>
            🔈 Volum: <strong>{volume}</strong>
            <input
              type="range"
              className="volume-slider"
              min={0}
              max={100}
              value={volume}
              onChange={e => onSetVolume(Number(e.target.value))}
            />
          </label>
        </div>

        <ul className="sonos-device-list">
          {devices.map(device => (
            <li key={device.ip} className="sonos-device-item">
              <input
                type="checkbox"
                checked={pendingDevices.includes(device.ip)}
                onChange={e => onSelectDevice(device.ip, e.target.checked)}
              />
              <span className="sonos-device-name">{device.name}</span>
              <span className="sonos-device-ip">{device.ip}</span>
              <button
                className="sonos-device-delete"
                onClick={() => onDeleteDevice(device.ip)}
                title="Slett"
              >
                🗑
              </button>
            </li>
          ))}
        </ul>

        <div className="sonos-add-device">
          <input
            className="sonos-input"
            placeholder="Navn"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <input
            className="sonos-input"
            placeholder="IP / Device ID"
            value={newIp}
            onChange={e => setNewIp(e.target.value)}
          />
          <button className="sonos-btn secondary" onClick={handleAdd}>Legg til</button>
        </div>

        <div className="sonos-btn-row">
          <button
            className="sonos-btn primary"
            disabled={!hasPending}
            onClick={() => { onPrepareSonos(); onClose(); }}
          >
            ✅ Gjør klar
          </button>
          {isPlaying && (
            <button className="sonos-btn danger" onClick={onStopSonos}>
              ⏹ Stopp Sonos
            </button>
          )}
          {isPlaying && (
            <button className="sonos-btn secondary" onClick={onPlayLocal}>
              📱 Spill lokalt
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
