import { useEffect, useState } from 'react';
import { LyricLine, Metadata } from '../types';
import { parseLRC } from '../utils/lrcParser';

const DYNAMIC_OFFSET = -1.5;

export function useLyrics(lyrics: Metadata['lyrics'] | undefined, songStartTime: number) {
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [syncedLines, setSyncedLines] = useState<LyricLine[]>([]);
  const [plainLines, setPlainLines] = useState<string[]>([]);

  useEffect(() => {
    if (!lyrics) {
      setSyncedLines([]);
      setPlainLines([]);
      setCurrentLineIndex(-1);
      return;
    }

    if (lyrics.syncedLyrics) {
      setSyncedLines(parseLRC(lyrics.syncedLyrics));
    } else {
      setSyncedLines([]);
    }

    setPlainLines(lyrics.lyricsLines || []);
  }, [lyrics]);

  useEffect(() => {
    if (syncedLines.length === 0 || songStartTime === 0) {
      setCurrentLineIndex(-1);
      return;
    }

    const interval = setInterval(() => {
      const elapsedTime = (Date.now() - songStartTime) / 1000 + DYNAMIC_OFFSET;
      let idx = -1;
      for (let i = 0; i < syncedLines.length; i++) {
        if (syncedLines[i].time <= elapsedTime) {
          idx = i;
        } else {
          break;
        }
      }
      setCurrentLineIndex(idx);
    }, 250);

    return () => clearInterval(interval);
  }, [syncedLines, songStartTime]);

  return { currentLineIndex, syncedLines, plainLines };
}
