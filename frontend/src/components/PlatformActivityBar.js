import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import { useContribution } from '../contexts/ContributionContext';
import useAuth from '../hooks/useAuth';
import socketService from '../services/socketService';
import OnlineUsersDropdown from './OnlineUsersDropdown';
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
  // Contribution prompt — shared with profile banner & popup via context
  const { shouldShowContribution, openPopup, dismissBanner } = useContribution();

  const [stats, setStats] = useState(null);
  const [period, setPeriod] = useState(() => localStorage.getItem('platformStatsPeriod') || 'monthly');
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('platformStatsCollapsed') === 'true');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [, setTick] = useState(0); // Forces re-render so 'Updated Xm ago' stays live

  // Realtime online users (moved from TopBar)
  const [onlineCount, setOnlineCount] = useState(1);
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const onlineRef = useRef(null);
  const userRole = typeof window !== 'undefined' ? localStorage.getItem('userRole') : null;
  const isPrivilegedRole = userRole === 'admin' || userRole === 'moderator';

  const { isLoggedIn } = useAuth();

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
    let interval = setInterval(fetchStats, 300000); // 5 min

    // Pause/resume polling when tab is hidden/visible to reduce background load
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(interval);
      } else {
        fetchStats();
        interval = setInterval(fetchStats, 300000);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [fetchStats]);

  // Tick every 30s so 'Updated Xm ago' label stays accurate between fetches
  useEffect(() => {
    let tickInterval;
    const startTick = () => {
      tickInterval = setInterval(() => setTick((t) => t + 1), 30000);
    };
    startTick();

    // Pause/resume tick when tab is hidden/visible
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(tickInterval);
      } else {
        startTick();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearInterval(tickInterval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  // Subscribe to realtime online count updates
  useEffect(() => {
    if (!isLoggedIn) return;
    const handleOnlineCountUpdate = (data) => {
      setOnlineCount(data.count || 0);
    };
    socketService.on('online_count_update', handleOnlineCountUpdate);
    // Seed with current value
    try {
      const initial = socketService.getOnlineCount?.();
      if (typeof initial === 'number') setOnlineCount(initial);
    } catch (_e) { /* noop */ }
    return () => {
      socketService.off('online_count_update', handleOnlineCountUpdate);
    };
  }, [isLoggedIn]);

  // Close online dropdown on click outside
  useEffect(() => {
    if (!showOnlineDropdown) return;
    const handleClickOutside = (e) => {
      if (onlineRef.current && !onlineRef.current.contains(e.target)) {
        setShowOnlineDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOnlineDropdown]);

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

  // Reusable online indicator (used in both collapsed & expanded states)
  const renderOnlineIndicator = () => (
    <div className="pab-online-container" ref={onlineRef}>
      <button
        type="button"
        className={`pab-online-btn ${isPrivilegedRole ? 'pab-online-clickable' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          if (isPrivilegedRole) setShowOnlineDropdown(v => !v);
        }}
        title={`${onlineCount} member${onlineCount !== 1 ? 's' : ''} online`}
      >
        <span className="pab-online-dot" />
        <span className="pab-online-count">{onlineCount}</span>
        <span className="pab-online-label">Online</span>
      </button>
      {isPrivilegedRole && (
        <OnlineUsersDropdown
          isOpen={showOnlineDropdown}
          onClose={() => setShowOnlineDropdown(false)}
        />
      )}
    </div>
  );

  if (collapsed) {
    return (
      <div className="pab-bar pab-collapsed" onClick={() => setCollapsed(false)}>
        {renderOnlineIndicator()}
        <span className="pab-collapsed-label">📊 Platform Pulse</span>
        <button className="pab-toggle" onClick={(e) => { e.stopPropagation(); setCollapsed(false); }} title="Expand">
          ▲
        </button>
      </div>
    );
  }

  return (
    <div className="pab-bar">
      {/* Contribution banner row — shown above stats when user is eligible & not dismissed */}
      {shouldShowContribution && (
        <div className="pab-contribution-banner" role="complementary" aria-label="Contribution reminder">
          <span className="pab-contribution-text">
            🙏 Help keep this platform free — your support makes a difference!
          </span>
          <button
            type="button"
            className="pab-contribution-btn"
            onClick={openPopup}
          >
            Contribute Now
          </button>
          <button
            type="button"
            className="pab-contribution-close"
            onClick={dismissBanner}
            title="Dismiss"
            aria-label="Dismiss contribution reminder"
          >
            ✕
          </button>
        </div>
      )}
      <div className="pab-row">
        {renderOnlineIndicator()}
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
