import React, { useCallback, useEffect, useState } from 'react';
import useToast from '../hooks/useToast';
import { getBackendApiUrl } from '../utils/urlHelper';
import './MessengerRealtimeAdmin.css';

const EMPTY_SUMMARY = {
  emitFailuresLast5m: null,
  emitFailuresLast1h: null,
  emitLagP95Ms: null,
  emitLagP99Ms: null,
  activeAlertCount: null,
};

const MessengerRealtimeOps = () => {
  const toast = useToast();
  const [summary, setSummary] = useState(EMPTY_SUMMARY);
  const [recentFailures, setRecentFailures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  };

  const loadData = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const [summaryRes, failuresRes] = await Promise.all([
        fetch(getBackendApiUrl('/api/messenger/realtime/ops/summary'), {
          headers: getAuthHeaders(),
        }),
        fetch(getBackendApiUrl('/api/messenger/realtime/ops/recent-failures?limit=25'), {
          headers: getAuthHeaders(),
        }),
      ]);

      if (summaryRes.ok) {
        const summaryJson = await summaryRes.json();
        setSummary({ ...EMPTY_SUMMARY, ...(summaryJson || {}) });
      }

      if (failuresRes.ok) {
        const failuresJson = await failuresRes.json();
        setRecentFailures(Array.isArray(failuresJson?.items) ? failuresJson.items : []);
      }

      if (!summaryRes.ok && !failuresRes.ok) {
        setError('Realtime ops endpoints are not available yet.');
      }
    } catch (e) {
      setError('Failed to load realtime ops data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData(false);
  }, [loadData]);

  const triggerEmitRetrySweep = async () => {
    try {
      const response = await fetch(getBackendApiUrl('/api/messenger/realtime/ops/retry-failed-emits'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ scope: 'recent' }),
      });

      if (!response.ok) {
        toast.error('Retry sweep endpoint unavailable.');
        return;
      }

      toast.success('Retry sweep triggered.');
      loadData(true);
    } catch (e) {
      toast.error('Failed to trigger retry sweep.');
    }
  };

  if (loading) {
    return <p className="messenger-realtime-admin__empty">Loading realtime operations...</p>;
  }

  return (
    <section className="messenger-realtime-admin">
      <div className="messenger-realtime-admin__header">
        <div>
          <h3 className="messenger-realtime-admin__title">Messenger Realtime Operations</h3>
          <p className="messenger-realtime-admin__subtitle">
            Emit failures, lag indicators, and recovery actions.
          </p>
        </div>
        <div className="messenger-realtime-admin__actions">
          <button
            type="button"
            className="messenger-realtime-admin__button"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="messenger-realtime-admin__button"
            onClick={triggerEmitRetrySweep}
          >
            Retry Failed Emits
          </button>
        </div>
      </div>

      {error ? <p className="messenger-realtime-admin__error">{error}</p> : null}

      <div className="messenger-realtime-admin__grid">
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Emit Failures (5m)</p>
          <p className="messenger-realtime-admin__value">{summary.emitFailuresLast5m ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Emit Failures (1h)</p>
          <p className="messenger-realtime-admin__value">{summary.emitFailuresLast1h ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Lag p95 (ms)</p>
          <p className="messenger-realtime-admin__value">{summary.emitLagP95Ms ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Lag p99 (ms)</p>
          <p className="messenger-realtime-admin__value">{summary.emitLagP99Ms ?? '--'}</p>
        </div>
        <div className="messenger-realtime-admin__card">
          <p className="messenger-realtime-admin__label">Active Alerts</p>
          <p className="messenger-realtime-admin__value">{summary.activeAlertCount ?? '--'}</p>
        </div>
      </div>

      {recentFailures.length === 0 ? (
        <p className="messenger-realtime-admin__empty">No emit failures returned.</p>
      ) : (
        <div className="messenger-realtime-admin__table-wrap">
          <table className="messenger-realtime-admin__table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Conversation</th>
                <th>Error</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {recentFailures.map((item) => (
                <tr key={item.id || `${item.conversationId || 'na'}:${item.occurredAt || Math.random()}`}>
                  <td className="messenger-realtime-admin__mono">{item.occurredAt || '--'}</td>
                  <td className="messenger-realtime-admin__mono">{item.conversationId || '--'}</td>
                  <td>{item.error || '--'}</td>
                  <td>{item.attempts ?? '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default MessengerRealtimeOps;
