import { useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    destroyHls();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
      audioRef.current = null;
    }
    setIsPlaying(false);
  }, [destroyHls]);

  const play = useCallback((url: string) => {
    stop();

    const audio = new Audio();
    audioRef.current = audio;

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onended = () => setIsPlaying(false);

    if (url.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls();
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        audio.play().catch(() => {});
      });
    } else {
      audio.src = url;
      audio.play().catch(() => {});
    }
  }, [stop]);

  const pause = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
  }, []);

  const setVolume = useCallback((v: number) => {
    if (audioRef.current) {
      audioRef.current.volume = v / 100;
    }
  }, []);

  return { play, pause, resume, stop, setVolume, isPlaying };
}
