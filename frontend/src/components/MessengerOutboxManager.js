import React, { useCallback, useEffect, useState } from 'react';
import useToast from '../hooks/useToast';
import { getBackendApiUrl } from '../utils/urlHelper';
import './MessengerRealtimeAdmin.css';

const MessengerOutboxManager = () => {
  const toast = useToast();
  const [items, setItems] = useState([]);
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

  const loadOutbox = useCallback(async (background = false) => {
    if (background) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError('');

    try {
      const response = await fetch(
        getBackendApiUrl('/api/messenger/realtime/outbox?status=pending,failed&limit=50'),
        { headers: getAuthHeaders() },
      );

      if (!response.ok) {
        setError('Outbox endpoint is not available yet.');
        setItems([]);
        return;
      }

      const json = await response.json();
      setItems(Array.isArray(json?.items) ? json.items : []);
    } catch (e) {
      setError('Failed to load outbox items.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadOutbox(false);
  }, [loadOutbox]);

  const replayEvent = async (eventId) => {
    try {
      const response = await fetch(getBackendApiUrl('/api/messenger/realtime/outbox/replay'), {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ eventIds: [eventId] }),
      });

      if (!response.ok) {
        toast.error('Replay endpoint unavailable.');
        return;
      }

      toast.success('Replay requested.');
      loadOutbox(true);
    } catch (e) {
      toast.error('Failed to request replay.');
    }
  };

  const replayAllFailed = async () => {
    try {
      const response = await fetch(getBackendApiUrl('/api/messenger/realtime/outbox/replay-all-failed'), {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        toast.error('Bulk replay endpoint unavailable.');
        return;
      }

      toast.success('Bulk replay requested.');
      loadOutbox(true);
    } catch (e) {
      toast.error('Failed to request bulk replay.');
    }
  };

  if (loading) {
    return <p className="messenger-realtime-admin__empty">Loading outbox...</p>;
  }

  return (
    <section className="messenger-realtime-admin">
      <div className="messenger-realtime-admin__header">
        <div>
          <h3 className="messenger-realtime-admin__title">Messenger Event Outbox</h3>
          <p className="messenger-realtime-admin__subtitle">
            Pending and failed emit events for replay and operational triage.
          </p>
        </div>
        <div className="messenger-realtime-admin__actions">
          <button
            type="button"
            className="messenger-realtime-admin__button"
            onClick={() => loadOutbox(true)}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            type="button"
            className="messenger-realtime-admin__button"
            onClick={replayAllFailed}
          >
            Replay Failed
          </button>
        </div>
      </div>

      {error ? <p className="messenger-realtime-admin__error">{error}</p> : null}

      {items.length === 0 ? (
        <p className="messenger-realtime-admin__empty">No outbox items returned.</p>
      ) : (
        <div className="messenger-realtime-admin__table-wrap">
          <table className="messenger-realtime-admin__table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Topic</th>
                <th>Created</th>
                <th>Attempts</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id || item._id || `${item.topic || 'topic'}:${item.createdAt || Math.random()}`}>
                  <td className="messenger-realtime-admin__mono">{item.id || item._id || '--'}</td>
                  <td>
                    <span className="messenger-realtime-admin__status">{item.status || '--'}</span>
                  </td>
                  <td className="messenger-realtime-admin__mono">{item.topic || 'messenger:new_message'}</td>
                  <td className="messenger-realtime-admin__mono">{item.createdAt || '--'}</td>
                  <td>{item.attempts ?? '--'}</td>
                  <td>
                    <button
                      type="button"
                      className="messenger-realtime-admin__button"
                      onClick={() => replayEvent(item.id || item._id)}
                      disabled={!item.id && !item._id}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default MessengerOutboxManager;
