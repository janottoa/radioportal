import React, { useState } from 'react';
import { Station, Metadata } from '../../types';
import PlayerControls from './PlayerControls';

interface Props {
  station: Station | null;
  metadata: Metadata | null;
  isPlaying: boolean;
  isFavorite: boolean;
  currentLineIndex: number;
  syncedLines: { time: number; text: string }[];
  plainLines: string[];
  onPlayPause: () => void;
  onLyrics: () => void;
  onFavorite: () => void;
  onSonos: () => void;
}

export default function Footer({
  station,
  metadata,
  isPlaying,
  isFavorite,
  currentLineIndex,
  syncedLines,
  plainLines,
  onPlayPause,
  onLyrics,
  onFavorite,
  onSonos,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!station) return null;

  const title = metadata?.title || '';
  const artist = metadata?.artist || '';
  const album = metadata?.album || '';
  const program = metadata?.program || '';
  const coverUrl = metadata?.deezer?.albumCover || metadata?.imageUrl || '';
  const logoSrc = coverUrl || station.logo || '';
  const hasLyrics = !!(metadata?.lyrics?.hasLyrics);
  const hasSynced = syncedLines.length > 0;

  const songLabel = [artist, title].filter(Boolean).join(' - ') || station.songInfo || '';

  const lyricsPreviewLine1 = hasSynced && currentLineIndex >= 0
    ? syncedLines[currentLineIndex]?.text || ''
    : plainLines[0] || '';
  const lyricsPreviewLine2 = hasSynced && currentLineIndex >= 0
    ? syncedLines[currentLineIndex + 1]?.text || ''
    : plainLines[1] || '';

  const LogoEl = ({ cls, size }: { cls: string; size: number }) =>
    logoSrc ? (
      <img className={cls} src={logoSrc} alt={station.name} onError={e => { (e.target as HTMLImageElement).src = ''; }} style={{ width: size, height: size }} />
    ) : (
      <div className={cls} style={{ width: size, height: size, background: 'var(--accent-gradient)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: size * 0.3 }}>
        {station.name.slice(0, 2).toUpperCase()}
      </div>
    );

  if (expanded) {
    return (
      <div className="footer">
        <div className="footer-expanded">
          <div className="footer-expanded-top" onClick={() => setExpanded(false)}>
            <LogoEl cls="footer-expanded-logo" size={80} />
            <div className="footer-expanded-info">
              <div className="footer-expanded-channel">{station.name}</div>
              {program && <div className="footer-expanded-title" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{program}</div>}
              {title && <div className="footer-expanded-title">{title}</div>}
              {artist && <div className="footer-expanded-artist">{artist}</div>}
              {album && <div className="footer-expanded-album">{album}</div>}
              {(lyricsPreviewLine1 || lyricsPreviewLine2) && (
                <div className="footer-lyrics-preview">
                  {lyricsPreviewLine1 && <div>{lyricsPreviewLine1}</div>}
                  {lyricsPreviewLine2 && <div style={{ opacity: 0.6 }}>{lyricsPreviewLine2}</div>}
                </div>
              )}
            </div>
          </div>
          <PlayerControls
            isPlaying={isPlaying}
            isFavorite={isFavorite}
            hasLyrics={hasLyrics}
            onPlayPause={onPlayPause}
            onLyrics={onLyrics}
            onFavorite={onFavorite}
            onSonos={onSonos}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="footer">
      <div className="footer-compact" onClick={() => setExpanded(true)}>
        <LogoEl cls="footer-logo" size={42} />
        <div className="footer-info">
          <div className="footer-channel">{station.name}</div>
          {songLabel && <div className="footer-song">{songLabel}</div>}
        </div>
        <PlayerControls
          isPlaying={isPlaying}
          isFavorite={isFavorite}
          hasLyrics={hasLyrics}
          onPlayPause={onPlayPause}
          onLyrics={onLyrics}
          onFavorite={onFavorite}
          onSonos={onSonos}
        />
      </div>
    </div>
  );
}
