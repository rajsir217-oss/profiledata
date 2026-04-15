import React, { useState, useEffect, useCallback } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './PlatformActivityBar.css';

const PERIODS = [
  { key: 'weekly', label: 'This Week', mobileLabel: 'W' },
  { key: 'monthly', label: 'This Month', mobileLabel: 'M' },
  { key: 'yearly', label: 'This Year', mobileLabel: 'Y' },
  { key: 'all', label: 'All Time', mobileLabel: 'A' }
];

const STAT_CONFIG = [
  { key: 'searches', icon: '🔍', label: 'Searches', mobileLabel: 'S' },
  { key: 'profileViews', icon: '👀', label: 'Profile Views', mobileLabel: 'V' },
  { key: 'favorited', icon: '⭐', label: 'Favorited', mobileLabel: 'F' },
  { key: 'shortlisted', icon: '📋', label: 'Shortlisted', mobileLabel: 'L' },
  { key: 'messagesSent', icon: '💬', label: 'Messages', mobileLabel: 'M' },
  { key: 'activeMembers', icon: '👥', label: 'Active Members', mobileLabel: 'A' }
];

const PlatformActivityBar = () => {
  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(() => localStorage.getItem('platformStatsPeriod') || 'monthly');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('platformStatsCollapsed') === 'true');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const isLoggedIn = !!localStorage.getItem('token');

  const fetchStats = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const api = createApiInstance();
      const response = await api.get(`${getBackendUrl()}/api/platform-stats?period=${period}`);
      setStats(response.data);
      setLastUpdated(new Date());
    } catch (err) {
      logger.error('Failed to load platform stats:', err);
    } finally {
      setLoading(false);
    }
  }, [period, isLoggedIn]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 300000); // 5 min
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    localStorage.setItem('platformStatsPeriod', period);
  }, [period]);

  useEffect(() => {
    localStorage.setItem('platformStatsCollapsed', collapsed.toString());
  }, [collapsed]);

  if (!isLoggedIn) return null;

  const formatNumber = (num) => {
    if (num === undefined || num === null) return '—';
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString();
  };

  const getTimeSinceUpdate = () => {
    if (!lastUpdated) return '';
    const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 60000);
    if (diff < 1) return 'Just now';
    return `${diff}m ago`;
  };

  if (collapsed) {
    return (
      <div className="pab-bar pab-collapsed" onClick={() => setCollapsed(false)}>
        <span className="pab-collapsed-label">📊 Platform Pulse</span>
        <button className="pab-toggle" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} title="Expand">
          ▲
        </button>
      </div>
    );
  }

  return (
    <div className="pab-bar">
      <div className="pab-row">
        <div className="pab-period-tabs">
          {PERIODS.map(p => (
            <button
              key={p.key}
              className={`pab-period-btn ${period === p.key ? 'pab-period-active' : ''}`}
              onClick={() => setPeriod(p.key)}
            >
              <span className="pab-period-full-label">{p.label}</span>
              <span className="pab-period-mobile-label">{p.mobileLabel}</span>
            </button>
          ))}
        </div>
        <div className="pab-stats">
          {STAT_CONFIG.map(stat => (
            <div key={stat.key} className={`pab-stat ${loading ? 'pab-stat-loading' : ''}`}>
              <span className="pab-stat-icon">{stat.icon}</span>
              <span className="pab-stat-value">{stats ? formatNumber(stats[stat.key]) : '—'}</span>
              <span className="pab-stat-label">
                <span className="pab-stat-full-label">{stat.label}</span>
                <span className="pab-stat-mobile-label">{stat.mobileLabel}</span>
              </span>
            </div>
          ))}
        </div>
        <span className="pab-update-time">Updated {getTimeSinceUpdate()}</span>
        <button className="pab-toggle" onClick={() => setCollapsed(true)} title="Minimize">
          ▼
        </button>
      </div>
    </div>
  );
};

export default PlatformActivityBar;
