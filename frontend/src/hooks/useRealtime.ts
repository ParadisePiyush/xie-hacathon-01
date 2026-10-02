import { useEffect, useRef, useState } from 'react';

export interface RealtimeEvent {
  event: string;
  data: any;
}

export interface CriticalAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  request_id: string;
  coords: { lat: number; lng: number };
  created_at: string;
}

export const useRealtime = (onEventReceived?: (event: RealtimeEvent) => void) => {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const [criticalAlert, setCriticalAlert] = useState<CriticalAlert | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<any>(null);

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
    const wsUrl = apiBase.replace(/^http/, 'ws') + '/ws/updates';

    let isMounted = true;
    let reconnectTimeout: any = null;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isMounted) return;
          setIsConnected(true);
          // Heartbeat ping
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send('ping');
            }
          }, 25000);
        };

        ws.onmessage = (messageEvent) => {
          if (!isMounted) return;
          try {
            if (messageEvent.data === 'pong') return;
            const parsed: RealtimeEvent = JSON.parse(messageEvent.data);
            setLastEvent(parsed);

            if (parsed.event === 'CRITICAL_ALERT') {
              setCriticalAlert(parsed.data);
            }

            if (onEventReceived) {
              onEventReceived(parsed);
            }
          } catch {
            // Non-JSON message
          }
        };

        ws.onclose = () => {
          if (!isMounted) return;
          setIsConnected(false);
          if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
          // Auto reconnect after 3 seconds
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };

        wsRef.current = ws;
      } catch (err) {
        console.warn('WebSocket connection error:', err);
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const dismissAlert = () => setCriticalAlert(null);

  return {
    isConnected,
    lastEvent,
    criticalAlert,
    dismissAlert,
  };
};
