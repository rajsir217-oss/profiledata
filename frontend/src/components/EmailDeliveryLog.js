import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import LoadMore from './LoadMore';
import './EmailDeliveryLog.css';

const EmailDeliveryLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('all');
  const [searchLineage, setSearchLineage] = useState('');
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'sentAt', direction: 'desc' });
  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${getBackendUrl()}/api/notifications/logs`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { limit: 100 }
      });
      setLogs(response.data.logs || response.data || []);
    } catch (err) {
      console.error('Failed to load notification logs:', err);
      setError('Failed to load logs');
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

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
      if (!lineage.toLowerCase().includes(searchLineage.toLowerCase())) return false;
    }
    return true;
  }).sort((a, b) => {
    // Apply sorting
    let aVal, bVal;
    
    if (sortConfig.key === 'sentAt') {
      aVal = new Date(a.sentAt || a.sent_at || a.createdAt || 0);
      bVal = new Date(b.sentAt || b.sent_at || b.createdAt || 0);
    } else {
      aVal = a[sortConfig.key] || '';
      bVal = b[sortConfig.key] || '';
    }
    
    // Handle string comparison
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="email-delivery-log">
      <div className="log-header">
        <h3>📬 Email Delivery Log</h3>
        <p>Track sent emails with lineage tokens for end-to-end workflow visibility</p>
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
          <label>🔗 Lineage Token:</label>
          <input
            type="text"
            placeholder="Search by lineage token..."
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
          <p>Loading delivery logs...</p>
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
                <th className="sortable" onClick={() => handleSort('subject')}>
                  Subject {getSortIcon('subject')}
                </th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Status {getSortIcon('status')}
                </th>
                <th>Lineage Token</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.slice(0, displayCount).map((log, index) => {
                const lineageToken = log.templateData?.lineage_token || log.metadata?.lineage_token;
                return (
                  <tr key={log._id || index}>
                    <td className="time-cell">
                      {formatDate(log.sentAt || log.sent_at || log.createdAt)}
                    </td>
                    <td className="recipient-cell">
                      {log.username || log.recipient || 'N/A'}
                    </td>
                    <td className="trigger-cell">
                      <span className="trigger-badge">
                        {log.trigger || log.type || 'N/A'}
                      </span>
                    </td>
                    <td className="subject-cell">
                      {log.subject || 'N/A'}
                    </td>
                    <td className="status-cell">
                      <span className={`status-badge ${getStatusClass(log.status)}`}>
                        {log.status || 'unknown'}
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
          
          {/* Load More */}
          <LoadMore
            currentCount={Math.min(displayCount, filteredLogs.length)}
            totalCount={filteredLogs.length}
            onLoadMore={() => setDisplayCount(prev => prev + PAGE_SIZE)}
            itemsPerLoad={PAGE_SIZE}
            itemLabel="logs"
            buttonText="View more"
          />
        </div>
      ) : (
        <div className="empty-state">
          <span className="empty-icon">📭</span>
          <p>No email delivery logs found</p>
          <small>Logs will appear here after emails are sent</small>
        </div>
      )}

      <div className="logs-footer">
        Showing {Math.min(displayCount, filteredLogs.length)} of {filteredLogs.length} logs
      </div>
    </div>
  );
};

export default EmailDeliveryLog;
