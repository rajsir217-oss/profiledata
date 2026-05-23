import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationsCard.css';

const getFrequency = (savedSearch) => {
  const n = savedSearch?.notifications;
  const raw = n?.frequency || n?.schedule || n?.cadence || n?.type || null;
  return raw ? String(raw) : null;
};

const isEnabled = (savedSearch) => {
  const n = savedSearch?.notifications;
  if (!n) return false;
  if (typeof n.enabled === 'boolean') return n.enabled;
  if (typeof n.isEnabled === 'boolean') return n.isEnabled;

  const freq = getFrequency(savedSearch);
  if (!freq) return false;

  const f = freq.toLowerCase();
  return !['none', 'off', 'disabled', 'false'].includes(f);
};

const NotificationsCard = ({ savedSearches }) => {
  const navigate = useNavigate();

  const summary = useMemo(() => {
    const list = Array.isArray(savedSearches) ? savedSearches : [];
    const enabledList = list.filter(isEnabled);

    const freqCounts = enabledList.reduce((acc, s) => {
      const f = getFrequency(s);
      if (!f) return acc;
      acc[f] = (acc[f] || 0) + 1;
      return acc;
    }, {});

    const topFrequency = Object.entries(freqCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return {
      total: list.length,
      enabled: enabledList.length,
      topFrequency,
    };
  }, [savedSearches]);

  return (
    <div className="dv2-rail-card">
      <div className="dv2-rail-title">
        <span className="dv2-rail-title-left">🔔 Notifications</span>
        <span className="dv2-rail-pill">{summary.enabled}</span>
      </div>

      <div className="dv2-nc-body">
        {summary.total === 0 ? (
          <span>
            Create a saved search to get match alerts.
          </span>
        ) : summary.enabled === 0 ? (
          <span>
            Alerts are currently <span className="dv2-nc-strong">off</span> for your saved searches.
          </span>
        ) : (
          <span>
            Alerts enabled for <span className="dv2-nc-strong">{summary.enabled}</span> saved search{summary.enabled === 1 ? '' : 'es'}
            {summary.topFrequency ? (
              <> ({summary.topFrequency})</>
            ) : null}
            .
          </span>
        )}
      </div>

      <div className="dv2-nc-actions">
        <button className="dv2-nc-cta" type="button" onClick={() => navigate('/preferences')}
        >
          Notification preferences
        </button>
      </div>
    </div>
  );
};

export default NotificationsCard;
