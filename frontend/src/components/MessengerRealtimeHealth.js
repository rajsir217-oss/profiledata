import React, { useCallback, useEffect, useState } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import './MessengerRealtimeAdmin.css';

const EMPTY_HEALTH = {
  emitSuccessRate1h: null,
  emitLagP50Ms: null,
  emitLagP95Ms: null,
  emitLagP99Ms: null,
  reconnectCatchupCount1h: null,
  fallbackPollingCount1h: null,
};

const MessengerRealtimeHealth = () => {
  const [health, setHealth] = useState(EMPTY_HEALTH);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const loadHealth = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [healthRes, alertsRes] = await Promise.all([
        fetch(getBackendApiUrl('/api/messenger/realtime/health'), {
          headers: getAuthHeaders(),
        }),
        fetch(getBackendApiUrl('/api/messenger/realtime/alerts/active'), {
          headers: getAuthHeaders(),
        }),
      ]);

      if (healthRes.ok) {
        const healthJson = await healthRes.json();
        setHealth({ ...EMPTY_HEALTH, ...(healthJson || {}) });
      }

      if (alertsRes.ok) {
        const alertsJson = await alertsRes.json();
        setAlerts(Array.isArray(alertsJson?.items) ? alertsJson.items : []);
      }

      if (!healthRes.ok && !alertsRes.ok) {
        setError('Realtime health endpoints are not available yet.');
      }
    } catch (e) {
      setError('Failed to load realtime health data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadHealth(false);
  }, [loadHealth]);

  if (loading) {
    return <p className="messenger-realtime-admin__empty">Loading realtime health...</p>;
  }

  return (
    <section className="messenger-realtime-admin">
      <div className="messenger-realtime-admin__header">
        <div>
          <h3 className="messenger-realtime-admin__title">Messenger Realtime Health</h3>
          <p className="messenger-realtime-admin__subtitle">
            Operational metrics and alert visibility for realtime delivery.
          </p>
        </div>
        <div className="messenger-realtime-admin__actions">
          <button
            type="button"
            className="messenger-realtime-admin__button"
            onClick={() => loadHealth(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {error ? <p className="messenger-realtime-admin__error">{error}</p> : null}

      <div className="messenger-realtime-admin__grid">
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Emit Success Rate (1h)</p>
          <p className="messenger-realtime-admin__value">{health.emitSuccessRate1h ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Lag p50 (ms)</p>
          <p className="messenger-realtime-admin__value">{health.emitLagP50Ms ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Lag p95 (ms)</p>
          <p className="messenger-realtime-admin__value">{health.emitLagP95Ms ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Lag p99 (ms)</p>
          <p className="messenger-realtime-admin__value">{health.emitLagP99Ms ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Reconnect Catch-up (1h)</p>
          <p className="messenger-realtime-admin__value">{health.reconnectCatchupCount1h ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Fallback Polling (1h)</p>
          <p className="messenger-realtime-admin__value">{health.fallbackPollingCount1h ?? '--'}</p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <p className="messenger-realtime-admin__empty">No active alerts returned.</p>
      ) : (
        <div className="messenger-realtime-admin__table-wrap">
          <table className="messenger-realtime-admin__table">
            <thead>
              <tr>
                <th>Alert</th>
                <th>Severity</th>
                <th>Started At</th>
                <th>Last Event</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((item) => (
                <tr key={item.id || `${item.key || 'alert'}:${item.startedAt || Math.random()}`}>
                  <td>{item.title || item.key || '--'}</td>
                  <td><span className="messenger-realtime-admin__status">{item.severity || '--'}</span></td>
                  <td className="messenger-realtime-admin__mono">{item.startedAt || '--'}</td>
                  <td className="messenger-realtime-admin__mono">{item.lastEventAt || '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default MessengerRealtimeHealth;
