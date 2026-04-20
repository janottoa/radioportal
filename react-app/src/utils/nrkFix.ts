import { processURLMetadata } from './urlFix';

export interface NRKMetadata {
  program: string;
  title: string;
  artist: string;
}

export function processNRKMetadata(streamTitle: string): NRKMetadata {
  if (!streamTitle) return { program: '', title: '', artist: '' };

  // Split on first ":" to get program and remaining
  const colonIdx = streamTitle.indexOf(':');
  if (colonIdx === -1) {
    const parsed = processURLMetadata(streamTitle);
    return { program: '', title: parsed.title, artist: parsed.artist };
  }

  const program = streamTitle.substring(0, colonIdx).trim();
  let remaining = streamTitle.substring(colonIdx + 1).trim();

  // Handle "med X: " prefix
  const medMatch = remaining.match(/^med\s+\S+:\s*/i);
  if (medMatch) {
    remaining = remaining.substring(medMatch[0].length).trim();
  }

  const parsed = processURLMetadata(remaining);
  return { program, title: parsed.title, artist: parsed.artist };
}
