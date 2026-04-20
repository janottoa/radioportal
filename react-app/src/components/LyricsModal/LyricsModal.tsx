import React, { useEffect, useRef } from 'react';
import { LyricLine, Metadata } from '../../types';

interface Props {
  station: string;
  metadata: Metadata | null;
  currentLineIndex: number;
  syncedLines: LyricLine[];
  plainLines: string[];
  onClose: () => void;
}

export default function LyricsModal({
  station,
  metadata,
  currentLineIndex,
  syncedLines,
  plainLines,
  onClose,
}: Props) {
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (activeRef.current) {
      activeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentLineIndex]);

  const hasSynced = syncedLines.length > 0;
  const lines = hasSynced ? syncedLines.map(l => l.text) : plainLines;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="modal-title">📝 Sangtekst</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {metadata?.artist} — {metadata?.title}
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {lines.length > 0 ? (
          <ul className="lyrics-list">
            {lines.map((line, idx) => (
              <li
                key={idx}
                ref={idx === currentLineIndex ? activeRef : undefined}
                className={`lyric-line${idx === currentLineIndex ? ' active' : ''}`}
              >
                {line || <span style={{ opacity: 0.3 }}>♪</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0' }}>
            Ingen sangtekst tilgjengelig
          </div>
        )}
      </div>
    </div>
  );
}
