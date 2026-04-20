export interface ParsedMetadata {
  title: string;
  artist: string;
}

function clean(s: string): string {
  return s.replace(/^["']+|["']+$/g, '').trim();
}

export function processURLMetadata(streamTitle: string): ParsedMetadata {
  if (!streamTitle) return { title: '', artist: '' };

  // 1. " by " (case-insensitive)
  const byMatch = streamTitle.match(/^(.+?)\s+by\s+(.+)$/i);
  if (byMatch) {
    return { title: clean(byMatch[1]), artist: clean(byMatch[2]) };
  }

  // 2. " -- "
  if (streamTitle.includes(' -- ')) {
    const parts = streamTitle.split(' -- ');
    return { title: clean(parts[1] || ''), artist: clean(parts[0] || '') };
  }

  // 3. "--"
  if (streamTitle.includes('--')) {
    const parts = streamTitle.split('--');
    return { title: clean(parts[1] || ''), artist: clean(parts[0] || '') };
  }

  // 4. " - "
  if (streamTitle.includes(' - ')) {
    const parts = streamTitle.split(' - ');
    return { title: clean(parts.slice(1).join(' - ')), artist: clean(parts[0]) };
  }

  // 5. ","
  if (streamTitle.includes(',')) {
    const parts = streamTitle.split(',');
    return { title: clean(parts[0]), artist: clean(parts.slice(1).join(',')) };
  }

  // 6. "-"
  if (streamTitle.includes('-')) {
    const parts = streamTitle.split('-');
    return { title: clean(parts.slice(1).join('-')), artist: clean(parts[0]) };
  }

  // 7. Title only
  return { title: clean(streamTitle), artist: '' };
}
