import { LyricLine } from '../types';

const MS_PER_SECOND = 1000;
const CS_PER_SECOND = 100;

export function parseLRC(syncedLyrics: string): LyricLine[] {
  const lines: LyricLine[] = [];
  const regex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/g;
  let match;
  while ((match = regex.exec(syncedLyrics)) !== null) {
    const minutes = parseInt(match[1], 10);
    const seconds = parseInt(match[2], 10);
    const centiseconds = parseInt(match[3], 10);
    const time = minutes * 60 + seconds + centiseconds / (match[3].length === 3 ? MS_PER_SECOND : CS_PER_SECOND);
    lines.push({ time, text: match[4].trim() });
  }
  return lines.sort((a, b) => a.time - b.time);
}
