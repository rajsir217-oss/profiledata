import React, { useState, useEffect, useCallback } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import LoadMore from './LoadMore';
import './EventStatusLog.css';

const EventStatusLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // Fetch all statuses with include_all=true
      const response = await fetch(getBackendApiUrl('/api/notifications/queue?include_all=true&limit=100'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        // Sort by createdAt descending
        const sorted = (data || []).sort((a, b) => 
          new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
        );
        setLogs(sorted);
      }
    } catch (err) {
      console.error('Failed to load event logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
    const interval = setInterval(loadLogs, 15000); // Refresh every 15 seconds
    return () => clearInterval(interval);
  }, [loadLogs]);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const getStatusClass = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent': return 'status-sent';
      case 'pending': return 'status-pending';
      case 'processing': return 'status-processing';
      case 'failed':
      case 'error': return 'status-failed';
      case 'skipped': return 'status-skipped';
      default: return 'status-unknown';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'sent': return '✅';
      case 'pending': return '⏳';
      case 'processing': return '⚙️';
      case 'failed':
      case 'error': return '❌';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  };

  // Handle column sort
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

  // Extract target user from templateData
  const getTargetUser = (log) => {
    const td = log.templateData || log.template_data || {};
    // Try different possible locations for target user
    return td.match?.username || td.match_username || td.target_username || td.targetUsername || '—';
  };

  const filteredLogs = logs.filter(log => {
    // Status filter
    if (filter !== 'all' && log.status?.toLowerCase() !== filter) return false;
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const targetUser = getTargetUser(log);
      return (
        log.username?.toLowerCase().includes(search) ||
        log.trigger?.toLowerCase().includes(search) ||
        (targetUser !== '—' && targetUser.toLowerCase().includes(search))
      );
    }
    return true;
  }).sort((a, b) => {
    // Apply sorting
    let aVal = a[sortConfig.key];
    let bVal = b[sortConfig.key];
    
    // Handle date fields
    if (sortConfig.key === 'createdAt') {
      aVal = new Date(a.createdAt || a.created_at || 0);
      bVal = new Date(b.createdAt || b.created_at || 0);
    }
    
    // Handle string comparison
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  const statusCounts = {
    all: logs.length,
    pending: logs.filter(l => l.status === 'pending').length,
    sent: logs.filter(l => l.status === 'sent').length,
    failed: logs.filter(l => l.status === 'failed' || l.status === 'error').length,
    skipped: logs.filter(l => l.status === 'skipped').length,
  };

  return (
    <div className="event-status-log">
      <div className="log-header">
        <h3>📜 Event Status Log</h3>
        <p>Track notification event processing status</p>
      </div>

      {/* Status Summary */}
      <div className="status-summary">
        <div className={`status-pill ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          All ({statusCounts.all})
        </div>
        <div className={`status-pill pending ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>
          ⏳ Pending ({statusCounts.pending})
        </div>
        <div className={`status-pill sent ${filter === 'sent' ? 'active' : ''}`} onClick={() => setFilter('sent')}>
          ✅ Sent ({statusCounts.sent})
        </div>
        <div className={`status-pill failed ${filter === 'failed' ? 'active' : ''}`} onClick={() => setFilter('failed')}>
          ❌ Failed ({statusCounts.failed})
        </div>
        <div className={`status-pill skipped ${filter === 'skipped' ? 'active' : ''}`} onClick={() => setFilter('skipped')}>
          ⏭️ Skipped ({statusCounts.skipped})
        </div>
      </div>

      {/* Controls */}
      <div className="log-controls">
        <div className="search-group">
          <label>🔍 Search:</label>
          <input
            type="text"
            placeholder="Search by user or trigger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="btn-refresh" onClick={loadLogs} disabled={loading}>
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Table */}
      {loading && logs.length === 0 ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading event logs...</p>
        </div>
      ) : filteredLogs.length > 0 ? (
        <div className="logs-table-wrapper">
          <table className="logs-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('createdAt')}>
                  Time {getSortIcon('createdAt')}
                </th>
                <th className="sortable" onClick={() => handleSort('username')}>
                  User {getSortIcon('username')}
                </th>
                <th>Target</th>
                <th className="sortable" onClick={() => handleSort('trigger')}>
                  Event/Trigger {getSortIcon('trigger')}
                </th>
                <th>Channels</th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Status {getSortIcon('status')}
                </th>
                <th className="sortable" onClick={() => handleSort('attempts')}>
                  Attempts {getSortIcon('attempts')}
                </th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, displayCount).map((log, index) => (
                <tr key={log._id || index} className={getStatusClass(log.status)}>
                  <td className="time-cell">
                    {formatDate(log.createdAt || log.created_at)}
                  </td>
                  <td className="user-cell">
                    {log.username || 'N/A'}
                  </td>
                  <td className="target-cell">
                    {getTargetUser(log)}
                  </td>
                  <td className="trigger-cell">
                    <span className="trigger-badge">{log.trigger || 'N/A'}</span>
                  </td>
                  <td className="channels-cell">
                    {(log.channels || []).map(ch => (
                      <span key={ch} className="channel-badge">{ch}</span>
                    ))}
                  </td>
                  <td className="status-cell">
                    <span className={`status-badge ${getStatusClass(log.status)}`}>
                      {getStatusIcon(log.status)} {log.status || 'unknown'}
                    </span>
                  </td>
                  <td className="attempts-cell">
                    {log.attempts || 0}
                  </td>
                  <td className="error-cell">
                    {log.error ? (
                      <span className="error-text" title={log.error}>
                        {log.error.substring(0, 30)}...
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Load More */}
          <LoadMore
            currentCount={Math.min(displayCount, filteredLogs.length)}
            totalCount={filteredLogs.length}
            onLoadMore={() => setDisplayCount(prev => prev + PAGE_SIZE)}
            itemsPerLoad={PAGE_SIZE}
            itemLabel="events"
            buttonText="View more"
          />
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No event logs found</p>
          <small>Events will appear here as they are processed</small>
        </div>
      )}

      <div className="logs-footer">
        Showing {Math.min(displayCount, filteredLogs.length)} of {filteredLogs.length} events (Total: {logs.length})
      </div>
    </div>
  );
};

export default EventStatusLog;
