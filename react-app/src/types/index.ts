export interface Station {
  name: string;
  url: string;
  ffmpegUrl?: string;
  logo?: string;
  songInfo?: string;
  channelUrl?: string;
  app?: string;
}

export interface DeezerInfo {
  albumCover: string;
  trackDeezerId: number;
  albumName: string;
  albumId: number;
  artists: { name: string }[];
  artistPicture: string;
  artistId: number;
  releaseDate: string;
  duration: number;
  popularity: number;
  explicit: boolean;
  preview: string;
}

export interface LyricsInfo {
  hasLyrics: boolean;
  lyricsLines: string[];
  syncedLyrics: string | null;
}

export interface Metadata {
  StreamTitle: string;
  title: string;
  artist: string;
  album?: string;
  program?: string;
  imageUrl?: string;
  deezer?: DeezerInfo;
  lyrics?: LyricsInfo;
}

export interface LyricLine {
  time: number; // seconds
  text: string;
}

export interface SonosDevice {
  name: string;
  ip: string;
}
