/**
 * useOnlinePresence
 * -----------------
 * Tracks the set of currently-online usernames for the messenger-web UI.
 *
 * Backed by the existing main-app endpoint:
 *   GET /api/users/online-status/users   →  { users: [...], onlineCount, totalUsers }
 *
 * The endpoint already returns enriched user objects (with `username`), so we
 * just collect the usernames into a Set for O(1) lookups.
 *
 * Strategy:
 *   - Initial fetch on mount.
 *   - Re-fetch every `POLL_MS` (default 30s) to keep dots fresh without
 *     requiring a WebSocket. Live socket updates can be layered in later.
 *
 * Usage:
 *   const { isOnline } = useOnlinePresence();
 *   <View>{isOnline('alice') && <OnlineDot />}</View>
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import useAuthStore from '@messenger/stores/authStore';

const POLL_MS = 30 * 1000;

export default function useOnlinePresence({ pollMs = POLL_MS, enabled = true } = {}) {
  const [onlineSet, setOnlineSet] = useState(() => new Set());
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const intervalRef = useRef(null);
  const aliveRef = useRef(true);

  const fetchOnce = useCallback(async () => {
    try {
      const api = useAuthStore.getState().getApi();
      const res = await api.get('/api/users/online-status/users');
      const list = Array.isArray(res.data?.users)
        ? res.data.users
        : (Array.isArray(res.data?.onlineUsers) ? res.data.onlineUsers : []);
      const next = new Set(list.map((u) => u?.username).filter(Boolean));
      if (aliveRef.current) {
        setOnlineSet(next);
        setLastFetchedAt(Date.now());
      }
    } catch (e) {
      // Don't surface — just keep last known state.
      // eslint-disable-next-line no-console
      console.warn('⚠️ useOnlinePresence: fetch failed', e?.message);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    if (!enabled) return undefined;

    fetchOnce();
    intervalRef.current = setInterval(fetchOnce, pollMs);

    return () => {
      aliveRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollMs, fetchOnce]);

  const isOnline = useCallback(
    (username) => !!username && onlineSet.has(username),
    [onlineSet]
  );

  return {
    onlineSet,
    isOnline,
    lastFetchedAt,
    refresh: fetchOnce,
  };
}
