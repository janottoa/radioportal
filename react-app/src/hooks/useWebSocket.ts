import { useEffect, useRef, useState } from 'react';
import { Metadata } from '../types';

const WS_URL = 'wss://anthonsen.net/wss';

export function useWebSocket(stationUrl: string | null, stationApp: string | undefined): {
  metadata: Metadata | null;
  isConnected: boolean;
} {
  const [metadata, setMetadata] = useState<Metadata | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setIsConnected(false);

    if (!stationUrl) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ url: stationUrl, app: stationApp || '' }));
    };

    ws.onmessage = (event) => {
      try {
        const data: Metadata = JSON.parse(event.data);
        // Filter out unwanted metadata
        if (data.StreamTitle && (
          data.StreamTitle.includes('https @') ||
          data.StreamTitle.includes('Metadata update')
        )) {
          return;
        }
        setMetadata(data);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [stationUrl, stationApp]);

  return { metadata, isConnected };
}
