import { useEffect, useRef, useState, useCallback } from "react";
import { BACKEND_URL, TOKENS } from "@/lib/api";

// Live WebSocket log/status stream from the Cloud-to-Studio bridge.
export function useLogStream() {
  const [events, setEvents] = useState([]);
  const [studioConnected, setStudioConnected] = useState(false);
  const [context, setContext] = useState({ selection: [], open_script: null });
  const [wsOpen, setWsOpen] = useState(false);
  const wsRef = useRef(null);

  const push = useCallback((e) => {
    setEvents((prev) => [...prev.slice(-200), { ...e, _ts: Date.now() }]);
  }, []);

  useEffect(() => {
    const token = TOKENS.access;
    if (!token) return;
    const wsUrl = BACKEND_URL.replace(/^http/, "ws") + `/api/ws/logs?token=${token}`;
    let alive = true;
    let ws;
    const connect = () => {
      ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setWsOpen(true);
      ws.onclose = () => { setWsOpen(false); if (alive) setTimeout(connect, 2500); };
      ws.onmessage = (msg) => {
        const data = JSON.parse(msg.data);
        if (data.type === "studio_status") setStudioConnected(data.connected);
        else if (data.type === "context") setContext({ selection: data.selection || [], open_script: data.open_script });
        else push(data);
      };
    };
    connect();
    const ping = setInterval(() => { try { ws?.readyState === 1 && ws.send("ping"); } catch (_) {} }, 15000);
    return () => {
      alive = false;
      clearInterval(ping);
      try { if (ws && ws.readyState === WebSocket.OPEN) ws.close(); } catch (_) {}
    };
  }, [push]);

  return { events, studioConnected, context, wsOpen, push, setEvents };
}
