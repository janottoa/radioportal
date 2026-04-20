import { useCallback, useRef, useState } from 'react';
import { SonosDevice } from '../types';

const SONOS_API = 'https://anthonsen.net:3738';

interface SonosState {
  devices: SonosDevice[];
  selectedDeviceIp: string;
  isPlaying: boolean;
  activeDevices: string[];
  pendingDevices: string[];
  volume: number;
  outputMode: 'local' | 'sonos';
}

export function useSonos(onSetLocalVolume: (v: number) => void, onStopLocal: () => void) {
  const [state, setState] = useState<SonosState>(() => {
    const devices: SonosDevice[] = JSON.parse(localStorage.getItem('sonosDevices') || '[]');
    const selectedDeviceIp = localStorage.getItem('selectedSonosDevice') || '';
    const volume = parseInt(localStorage.getItem('sonosVolume') || '30', 10);
    return {
      devices,
      selectedDeviceIp,
      isPlaying: false,
      activeDevices: [],
      pendingDevices: [],
      volume,
      outputMode: 'local',
    };
  });

  const inProgressRef = useRef(false);
  const lastCallRef = useRef(0);
  const lastUrlRef = useRef('');
  const stoppingRef = useRef(false);

  const addDevice = useCallback((name: string, ip: string) => {
    setState(prev => {
      const devices = [...prev.devices, { name, ip }];
      localStorage.setItem('sonosDevices', JSON.stringify(devices));
      return { ...prev, devices };
    });
  }, []);

  const deleteDevice = useCallback((ip: string) => {
    setState(prev => {
      const devices = prev.devices.filter(d => d.ip !== ip);
      localStorage.setItem('sonosDevices', JSON.stringify(devices));
      const selectedDeviceIp = prev.selectedDeviceIp === ip ? '' : prev.selectedDeviceIp;
      if (prev.selectedDeviceIp === ip) {
        localStorage.removeItem('selectedSonosDevice');
      }
      return { ...prev, devices, selectedDeviceIp };
    });
  }, []);

  const selectDevice = useCallback((ip: string, selected: boolean) => {
    setState(prev => {
      const pendingDevices = selected
        ? [...prev.pendingDevices.filter(d => d !== ip), ip]
        : prev.pendingDevices.filter(d => d !== ip);
      const selectedDeviceIp = selected ? ip : prev.selectedDeviceIp;
      if (selected) {
        localStorage.setItem('selectedSonosDevice', ip);
      }
      return { ...prev, pendingDevices, selectedDeviceIp };
    });
  }, []);

  const prepareSonos = useCallback(() => {
    setState(prev => ({ ...prev, outputMode: 'sonos' }));
  }, []);

  const sendToSonos = useCallback(async (url: string) => {
    const now = Date.now();
    if (now - lastCallRef.current < 1000) return;
    if (inProgressRef.current) return;

    // Check if same URL already playing on Sonos
    if (lastUrlRef.current === url && state.isPlaying) return;

    lastCallRef.current = now;
    inProgressRef.current = true;
    lastUrlRef.current = url;

    // Stop local audio
    onStopLocal();

    const targets = state.pendingDevices.length > 0 ? state.pendingDevices : state.activeDevices;

    try {
      await Promise.all(targets.map(deviceId =>
        fetch(`${SONOS_API}/takeover`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, uri: url, volume: state.volume }),
        })
      ));
      setState(prev => ({
        ...prev,
        isPlaying: true,
        activeDevices: targets,
        pendingDevices: [],
        outputMode: 'sonos',
      }));
    } catch (err) {
      console.error('Sonos sendToSonos error:', err);
    } finally {
      inProgressRef.current = false;
    }
  }, [state.isPlaying, state.pendingDevices, state.activeDevices, state.volume, onStopLocal]);

  const stopSonos = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    try {
      await Promise.all(state.activeDevices.map(deviceId =>
        fetch(`${SONOS_API}/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId }),
        })
      ));
    } catch (err) {
      console.error('Sonos stop error:', err);
    } finally {
      stoppingRef.current = false;
      lastUrlRef.current = '';
      setState(prev => ({
        ...prev,
        isPlaying: false,
        activeDevices: [],
        outputMode: 'local',
      }));
    }
  }, [state.activeDevices]);

  const setVolume = useCallback((v: number) => {
    setState(prev => {
      localStorage.setItem('sonosVolume', String(v));
      return { ...prev, volume: v };
    });
    onSetLocalVolume(v);

    if (state.isPlaying) {
      state.activeDevices.forEach(deviceId => {
        fetch(`${SONOS_API}/volume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, volume: v }),
        }).catch(() => {});
      });
    }
  }, [state.isPlaying, state.activeDevices, onSetLocalVolume]);

  const shouldUseSonos = useCallback(() => {
    return state.pendingDevices.length > 0 || state.isPlaying;
  }, [state.pendingDevices.length, state.isPlaying]);

  return {
    ...state,
    addDevice,
    deleteDevice,
    selectDevice,
    prepareSonos,
    sendToSonos,
    stopSonos,
    setVolume,
    shouldUseSonos,
  };
}
