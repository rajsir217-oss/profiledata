import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import LoadMore from './LoadMore';
import './SMSDeliveryLog.css';

const SMSDeliveryLog = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchLineage, setSearchLineage] = useState('');
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sentAt', direction: 'desc' });
  const [displayCount, setDisplayCount] = useState(20);
  const [stats, setStats] = useState({ today: 0, week: 0, month: 0 });
  const PAGE_SIZE = 20;
  
  // SimpleTexting live stats state
  const [stStats, setStStats] = useState(null);
  const [stLoading, setStLoading] = useState(false);
  const [stError, setStError] = useState(null);

  // SMS Usage Chart state
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState([new Date().getFullYear()]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [chartTotals, setChartTotals] = useState({ sent: 0, delivered: 0, failed: 0 });
  const [chartLoading, setChartLoading] = useState(false);
  const MONTHLY_LIMIT = 500;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getBackendUrl()}/api/notifications/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 500 }
      });
      
      const allLogs = response.data.logs || response.data || [];
      // Filter for SMS channel only
      const smsLogs = allLogs.filter(log => 
        log.channel === 'sms' || 
        log.channels?.includes('sms')
      );
      setLogs(smsLogs);
      
      // Calculate stats
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - 7);
      
      let today = 0, week = 0;
      smsLogs.forEach(log => {
        const logDate = new Date(log.sentAt || log.sent_at || log.createdAt);
        if (logDate >= todayStart) today++;
        if (logDate >= weekStart) week++;
      });
      // Only update today and week - month comes from chart data (more accurate)
      setStats(prev => ({ ...prev, today, week }));
      
    } catch (err) {
      console.error('Failed to load SMS logs:', err);
      setError('Failed to load SMS logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load SMS by month chart data
  const loadChartData = useCallback(async (year) => {
    setChartLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getBackendUrl()}/api/notifications/analytics/sms-by-month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year }
      });
      
      if (response.data.success) {
        const monthlyDataResult = response.data.monthlyData || [];
        setMonthlyData(monthlyDataResult);
        setChartTotals(response.data.totals || { sent: 0, delivered: 0, failed: 0 });
        setAvailableYears(response.data.availableYears || [new Date().getFullYear()]);
        
        // Update "This Month" stat from chart data if viewing current year
        // This ensures consistency between the stat box and the chart bar
        const now = new Date();
        if (year === now.getFullYear()) {
          const currentMonthData = monthlyDataResult.find(m => m.month === now.getMonth() + 1);
          if (currentMonthData) {
            setStats(prev => ({ ...prev, month: currentMonthData.count }));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load SMS chart data:', err);
    } finally {
      setChartLoading(false);
    }
  }, []);

  const loadStStats = useCallback(async () => {
    // Check if user is admin (same pattern as Sidebar.js)
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      setStError('Admin access required');
      return;
    }

    setStLoading(true);
    setStError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getBackendUrl()}/api/notifications/simpletexting-stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setStStats(response.data);
      } else {
        setStError('Failed to load SimpleTexting stats');
      }
    } catch (err) {
      setStError(err.response?.data?.detail || 'Could not reach SimpleTexting API');
    } finally {
      setStLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    loadChartData(selectedYear);
    loadStStats();
  }, [loadLogs, loadChartData, loadStStats, selectedYear]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent':
      case 'delivered':
        return 'status-sent';
      case 'failed':
        return 'status-failed';
      case 'pending':
      case 'queued':
        return 'status-pending';
      default:
        return 'status-unknown';
    }
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const filteredLogs = logs.filter(log => {
    // Status filter
    if (filter !== 'all') {
      const status = log.status?.toLowerCase();
      if (filter === 'sent' && status !== 'sent' && status !== 'delivered') return false;
      if (filter === 'failed' && status !== 'failed') return false;
    }
    // Lineage search
    if (searchLineage) {
      const lineage = log.templateData?.lineage_token || log.metadata?.lineage_token || '';
      const username = log.username || '';
      const trigger = log.trigger || '';
      const searchLower = searchLineage.toLowerCase();
      if (!lineage.toLowerCase().includes(searchLower) &&
          !username.toLowerCase().includes(searchLower) &&
          !trigger.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    let aVal, bVal;
    
    if (sortConfig.key === 'sentAt') {
      aVal = new Date(a.sentAt || a.sent_at || a.createdAt || 0);
      bVal = new Date(b.sentAt || b.sent_at || b.createdAt || 0);
    } else {
      aVal = a[sortConfig.key] || '';
      bVal = b[sortConfig.key] || '';
    }
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="sms-delivery-log">
      <div className="log-header">
        <h3>📱 SMS Delivery Log</h3>
        <p>Track sent SMS messages with delivery status</p>
      </div>

      {/* SimpleTexting Live Stats Panel */}
      <div className="st-live-panel">
        <div className="st-live-header">
          <span className="st-live-title">📡 SimpleTexting Live</span>
          <span className="st-live-subtitle">All SMS including OTP/MFA — pulled directly from SimpleTexting API</span>
          <button className="st-refresh-btn" onClick={loadStStats} disabled={stLoading} title="Refresh live stats">
            {stLoading ? '⏳' : '🔄'}
          </button>
        </div>

        {stError ? (
          <div className="st-error">⚠️ {stError}</div>
        ) : stLoading ? (
          <div className="st-loading">Loading live stats...</div>
        ) : stStats ? (
          <>
            <div className="st-stats-row">
              <div className="st-stat">
                <span className="st-val">{stStats.realtime.today ?? '—'}</span>
                <span className="st-lbl">Today (actual)</span>
              </div>
              <div className="st-stat">
                <span className="st-val">{stStats.realtime.week ?? '—'}</span>
                <span className="st-lbl">This Week</span>
              </div>
              <div className="st-stat">
                <span className="st-val">{stStats.realtime.month ?? '—'}</span>
                <span className="st-lbl">This Month</span>
              </div>
              {stStats.plan?.creditsUsed != null && (
                <div className={`st-stat ${stStats.plan.creditsUsed > (stStats.plan.creditsLimit || 500) ? 'st-over' : ''}`}>
                  <span className="st-val">{stStats.plan.creditsUsed}<span className="st-limit">/{stStats.plan.creditsLimit || 500}</span></span>
                  <span className="st-lbl">Credits Used</span>
                </div>
              )}
            </div>
            {(stStats.gap?.today > 0 || stStats.gap?.month > 0) && (
              <div className="st-gap-note">
                ℹ️ <strong>{stStats.gap.today}</strong> today / <strong>{stStats.gap.month}</strong> this month are OTP/MFA codes not in the internal log below
              </div>
            )}
            <div className="st-as-of">As of {new Date(stStats.asOf).toLocaleTimeString()}</div>
          </>
        ) : (
          <div className="st-loading">No data</div>
        )}
      </div>

      {/* Internal Log Stats */}
      <div className="sms-stats">
        <div className="stat-item">
          <span className="stat-value">{stats.today}</span>
          <span className="stat-label">Today</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.week}</span>
          <span className="stat-label">This Week</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{stats.month}</span>
          <span className="stat-label">This Month</span>
        </div>
        <div className="stat-item stat-muted">
          <span className="stat-value" style={{fontSize: '0.85rem', color: 'var(--text-muted)'}}>Queue only</span>
          <span className="stat-label">Internal Log</span>
        </div>
      </div>

      {/* SMS Usage Chart */}
      <div className="sms-usage-chart">
        <div className="chart-header">
          <h4>📊 SMS Usage by Month</h4>
          <div className="chart-controls">
            <span className="plan-limit">Plan: {MONTHLY_LIMIT}/month</span>
            <select 
              value={selectedYear} 
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="year-select"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        
        {chartLoading ? (
          <div className="chart-loading">Loading chart...</div>
        ) : (
          <>
            <div className="chart-summary">
              <span>Year Total: <strong>{chartTotals.sent}</strong> SMS</span>
              <span className="delivered">Delivered: <strong>{chartTotals.delivered}</strong></span>
              <span className="failed">Failed: <strong>{chartTotals.failed}</strong></span>
            </div>
            
            <div className="bar-chart">
              {monthlyData.map((m, i) => {
                const maxCount = Math.max(...monthlyData.map(d => d.count), MONTHLY_LIMIT);
                const barHeight = maxCount > 0 ? (m.count / maxCount) * 100 : 0;
                const limitLine = (MONTHLY_LIMIT / maxCount) * 100;
                const isOverLimit = m.count > MONTHLY_LIMIT;
                const currentMonth = new Date().getMonth() + 1;
                const isCurrentMonth = selectedYear === new Date().getFullYear() && m.month === currentMonth;
                
                return (
                  <div key={i} className="bar-container">
                    <div className="bar-wrapper">
                      {/* Limit line indicator */}
                      <div 
                        className="limit-line" 
                        style={{ bottom: `${limitLine}%` }}
                        title={`Monthly limit: ${MONTHLY_LIMIT}`}
                      />
                      <div 
                        className={`bar ${isOverLimit ? 'over-limit' : ''} ${isCurrentMonth ? 'current' : ''}`}
                        style={{ height: `${barHeight}%` }}
                        title={`${m.monthName}: ${m.count} SMS (Delivered: ${m.delivered}, Failed: ${m.failed})`}
                      >
                        {m.count > 0 && <span className="bar-value">{m.count}</span>}
                      </div>
                    </div>
                    <span className="bar-label">{m.monthName}</span>
                  </div>
                );
              })}
            </div>
            
            <div className="chart-legend">
              <span className="legend-item">
                <span className="legend-color normal"></span> Under limit
              </span>
              <span className="legend-item">
                <span className="legend-color over"></span> Over limit
              </span>
              <span className="legend-item">
                <span className="legend-line"></span> {MONTHLY_LIMIT} limit
              </span>
            </div>
          </>
        )}
      </div>

      <div className="log-controls">
        <div className="control-group">
          <label>Status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="sent">Sent/Delivered</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="control-group search-group">
          <label>🔍 Search:</label>
          <input
            type="text"
            placeholder="Search by user, trigger, or lineage..."
            value={searchLineage}
            onChange={(e) => setSearchLineage(e.target.value)}
          />
        </div>

        <button 
          className="btn-refresh" 
          onClick={loadLogs} 
          disabled={loading}
        >
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading SMS logs...</p>
        </div>
      ) : filteredLogs.length > 0 ? (
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('sentAt')}>
                  Time {getSortIcon('sentAt')}
                </th>
                <th className="sortable" onClick={() => handleSort('username')}>
                  Recipient {getSortIcon('username')}
                </th>
                <th className="sortable" onClick={() => handleSort('trigger')}>
                  Trigger {getSortIcon('trigger')}
                </th>
                <th>Preview</th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Status {getSortIcon('status')}
                </th>
                <th>Lineage Token</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, displayCount).map((log, index) => {
                const lineageToken = log.templateData?.lineage_token || log.metadata?.lineage_token;
                const recipientUsername = log.username || log.recipient || 'N/A';
                // Get profile name from templateData
                const profileName = log.templateData?.recipient_firstName || 
                                   log.templateData?.firstname ||
                                   log.templateData?.full_name ||
                                   log.templateData?.match?.firstName ||
                                   '';
                // Get full message content
                const fullMessage = log.preview || log.subject || log.templateData?.message || 'N/A';
                // Get status with fallback
                const status = log.status || 'sent';
                
                return (
                  <tr key={log._id || index}>
                    <td className="time-cell">
                      {formatDate(log.sentAt || log.sent_at || log.createdAt)}
                    </td>
                    <td className="recipient-cell">
                      <div className="recipient-info">
                        <span 
                          className="recipient-username clickable"
                          onClick={() => navigate(`/profile/${recipientUsername}`)}
                          title={`View ${recipientUsername}'s profile`}
                        >
                          {recipientUsername}
                        </span>
                        {profileName && (
                          <span className="recipient-name">({profileName})</span>
                        )}
                      </div>
                    </td>
                    <td className="trigger-cell">
                      <span className="trigger-badge sms">
                        {log.trigger || log.type || 'N/A'}
                      </span>
                    </td>
                    <td className="preview-cell" title={fullMessage}>
                      <div className="message-preview">
                        {fullMessage}
                      </div>
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${getStatusClass(status)}`}>
                        {status}
                      </span>
                    </td>
                    <td className="lineage-cell">
                      {lineageToken ? (
                        <span 
                          className="lineage-token" 
                          title={lineageToken}
                          onClick={() => {
                            navigator.clipboard.writeText(lineageToken);
                          }}
                        >
                          🔗 {lineageToken.substring(0, 8)}...
                        </span>
                      ) : (
                        <span className="no-lineage">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          <LoadMore
            currentCount={Math.min(displayCount, filteredLogs.length)}
            totalCount={filteredLogs.length}
            onLoadMore={() => setDisplayCount(prev => prev + PAGE_SIZE)}
            itemsPerLoad={PAGE_SIZE}
            itemLabel="SMS logs"
            buttonText="View more"
          />
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📵</span>
          <p>No SMS delivery logs found</p>
          <small>Logs will appear here after SMS messages are sent</small>
        </div>
      )}

      <div className="logs-footer">
        Total SMS sent (today/week/month): {stats.today}/{stats.week}/{stats.month}
      </div>
    </div>
  );
};

export default SMSDeliveryLog;
