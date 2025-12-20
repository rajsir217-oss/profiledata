import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import useToast from '../hooks/useToast';
import './PauseAnalyticsDashboard.css';

const PauseAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  
  // Analytics data
  const [overview, setOverview] = useState(null);
  const [reasons, setReasons] = useState([]);
  const [durationPatterns, setDurationPatterns] = useState(null);
  const [autoUnpauseStats, setAutoUnpauseStats] = useState(null);
  const [topPausers, setTopPausers] = useState([]);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');

    // Check admin access
    if (userRole !== 'admin') {
      toast.error('Admin access required');
      navigate('/dashboard');
      return;
    }

    loadAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };

      // Load all analytics data in parallel
      const [overviewRes, reasonsRes, patternsRes, autoUnpauseRes, topPausersRes] = await Promise.all([
        axios.get(`${getBackendUrl()}/api/pause-analytics/overview`, { headers }),
        axios.get(`${getBackendUrl()}/api/pause-analytics/reasons`, { headers }),
        axios.get(`${getBackendUrl()}/api/pause-analytics/duration-patterns`, { headers }),
        axios.get(`${getBackendUrl()}/api/pause-analytics/auto-unpause-stats`, { headers }),
        axios.get(`${getBackendUrl()}/api/pause-analytics/top-pausers?limit=10`, { headers })
      ]);

      setOverview(overviewRes.data);
      setReasons(reasonsRes.data);
      setDurationPatterns(patternsRes.data);
      setAutoUnpauseStats(autoUnpauseRes.data);
      setTopPausers(topPausersRes.data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadAnalytics();
    toast.success('Analytics refreshed');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="pause-analytics-dashboard">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pause-analytics-dashboard">

      {/* Refresh Button */}
      <div className="analytics-actions">
        <button className="btn-refresh" onClick={handleRefresh}>
          🔄 Refresh Data
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="analytics-tabs">
        <button
          className={`tab ${selectedTab === 'overview' ? 'active' : ''}`}
          onClick={() => setSelectedTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`tab ${selectedTab === 'patterns' ? 'active' : ''}`}
          onClick={() => setSelectedTab('patterns')}
        >
          📈 Patterns
        </button>
        <button
          className={`tab ${selectedTab === 'users' ? 'active' : ''}`}
          onClick={() => setSelectedTab('users')}
        >
          👥 Top Pausers
        </button>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && overview && (
        <div className="analytics-content">
          <h2>Overview Statistics</h2>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <div className="stat-value">{overview.totalUsersPaused}</div>
                <div className="stat-label">Total Users Paused</div>
              </div>
            </div>

            <div className="stat-card highlight">
              <div className="stat-icon">⏸️</div>
              <div className="stat-info">
                <div className="stat-value">{overview.activePausedAccounts}</div>
                <div className="stat-label">Currently Paused</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🔢</div>
              <div className="stat-info">
                <div className="stat-value">{overview.totalPauseEvents}</div>
                <div className="stat-label">Total Pause Events</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{overview.averagePauseCount}</div>
                <div className="stat-label">Avg Pauses/User</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-info">
                <div className="stat-value">{overview.averageDurationDays} days</div>
                <div className="stat-label">Avg Duration</div>
              </div>
            </div>
          </div>

          {/* Auto-Unpause Stats */}
          {autoUnpauseStats && (
            <div className="section">
              <h3>Auto-Unpause Status</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon">⏰</div>
                  <div className="stat-info">
                    <div className="stat-value">{autoUnpauseStats.scheduledAutoUnpause}</div>
                    <div className="stat-label">Scheduled</div>
                  </div>
                </div>

                <div className="stat-card warning">
                  <div className="stat-icon">⚠️</div>
                  <div className="stat-info">
                    <div className="stat-value">{autoUnpauseStats.overdueAutoUnpause}</div>
                    <div className="stat-label">Overdue</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-icon">🔧</div>
                  <div className="stat-info">
                    <div className="stat-value">{autoUnpauseStats.manualPauseOnly}</div>
                    <div className="stat-label">Manual Only</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Pause Reasons */}
          {reasons.length > 0 && (
            <div className="section">
              <h3>Pause Reasons Distribution</h3>
              <div className="reasons-list">
                {reasons.map((reason, index) => (
                  <div key={index} className="reason-item">
                    <div className="reason-info">
                      <span className="reason-name">{reason.reason}</span>
                      <span className="reason-count">{reason.count} users</span>
                    </div>
                    <div className="reason-bar-container">
                      <div 
                        className="reason-bar" 
                        style={{ width: `${reason.percentage}%` }}
                      ></div>
                      <span className="reason-percentage">{reason.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Patterns Tab */}
      {selectedTab === 'patterns' && durationPatterns && (
        <div className="analytics-content">
          <h2>Duration Patterns</h2>
          
          <div className="patterns-grid">
            <div className="pattern-card">
              <div className="pattern-icon">3️⃣</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns['3_days']}</div>
                <div className="pattern-label">3 Days</div>
                <div className="pattern-percentage">{durationPatterns.percentages['3_days']}%</div>
              </div>
            </div>

            <div className="pattern-card">
              <div className="pattern-icon">7️⃣</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns['7_days']}</div>
                <div className="pattern-label">7 Days</div>
                <div className="pattern-percentage">{durationPatterns.percentages['7_days']}%</div>
              </div>
            </div>

            <div className="pattern-card">
              <div className="pattern-icon">🗓️</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns['14_days']}</div>
                <div className="pattern-label">14 Days</div>
                <div className="pattern-percentage">{durationPatterns.percentages['14_days']}%</div>
              </div>
            </div>

            <div className="pattern-card">
              <div className="pattern-icon">📅</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns['30_days']}</div>
                <div className="pattern-label">30 Days</div>
                <div className="pattern-percentage">{durationPatterns.percentages['30_days']}%</div>
              </div>
            </div>

            <div className="pattern-card highlight">
              <div className="pattern-icon">🔧</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns.manual}</div>
                <div className="pattern-label">Manual</div>
                <div className="pattern-percentage">{durationPatterns.percentages.manual}%</div>
              </div>
            </div>

            <div className="pattern-card">
              <div className="pattern-icon">❓</div>
              <div className="pattern-info">
                <div className="pattern-value">{durationPatterns.patterns.unknown}</div>
                <div className="pattern-label">Other</div>
                <div className="pattern-percentage">{durationPatterns.percentages.unknown}%</div>
              </div>
            </div>
          </div>

          <div className="pattern-summary">
            <p><strong>Total Paused Users:</strong> {durationPatterns.total}</p>
            <p><strong>Most Popular:</strong> {
              Object.entries(durationPatterns.patterns)
                .sort((a, b) => b[1] - a[1])[0][0]
                .replace('_', ' ')
                .replace(/\b\w/g, l => l.toUpperCase())
            }</p>
          </div>
        </div>
      )}

      {/* Top Pausers Tab */}
      {selectedTab === 'users' && (
        <div className="analytics-content">
          <h2>Top Pausers</h2>
          
          {topPausers.length === 0 ? (
            <div className="empty-state">
              <p>No users have paused their accounts yet</p>
            </div>
          ) : (
            <div className="top-pausers-table">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Username</th>
                    <th>Pause Count</th>
                    <th>Status</th>
                    <th>Paused At</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {topPausers.map((user, index) => (
                    <tr key={user.username}>
                      <td className="rank">
                        {index === 0 && '🥇'}
                        {index === 1 && '🥈'}
                        {index === 2 && '🥉'}
                        {index > 2 && `#${index + 1}`}
                      </td>
                      <td className="username">{user.username}</td>
                      <td className="count">{user.pauseCount}</td>
                      <td>
                        <span className={`status-badge ${user.currentStatus}`}>
                          {user.currentStatus === 'paused' ? '⏸️' : '▶️'} {user.currentStatus}
                        </span>
                      </td>
                      <td className="date">{formatDate(user.pausedAt)}</td>
                      <td className="reason">{user.pauseReason || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PauseAnalyticsDashboard;
