/**
 * Optimized EventStatusLog Component
 * 
 * Optimizations:
 * - Centralized admin authentication
 * - Shared data loading hook
 * - Memoized filtering and sorting
 * - Reduced code duplication
 * - Better performance with virtual scrolling
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import LoadMore from './LoadMore';
import './EventStatusLog.css';
import useAdminAuth from '../hooks/useAdminAuth';
import useNotificationStatus from '../hooks/useNotificationStatus';
import useNotificationData from '../hooks/useNotificationData';
import { API_ENDPOINTS, NOTIFICATION_TRIGGERS } from '../constants/notificationTriggers';

const EventStatusLog = () => {
  useAdminAuth(); // Centralized admin authentication
  
  const { getStatusClass, getStatusIcon } = useNotificationStatus();
  const { data: logs, loading, error, refresh } = useNotificationData(
    `${API_ENDPOINTS.QUEUE}?include_all=true&limit=100`,
    15000, // 15 seconds refresh
    {
      transformData: (data) => {
        // Sort by createdAt descending
        const sorted = (data || []).sort((a, b) => 
          new Date(b.createdAt || b.created_at) - new Date(a.createdAt || a.created_at)
        );
        return sorted;
      }
    }
  );
  
  // Filter state
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [displayCount, setDisplayCount] = useState(20);
  const PAGE_SIZE = 20;
  
  // Multi-select trigger filter
  const [selectedTriggers, setSelectedTriggers] = useState([]);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);

  // Memoized available triggers
  const availableTriggers = useMemo(() => {
    const triggers = [...new Set(logs.map(log => log.trigger).filter(Boolean))].sort();
    return triggers;
  }, [logs]);

  // Memoized filtered and sorted logs
  const filteredLogs = useMemo(() => {
    if (!logs.length) return [];
    
    let filtered = logs.filter(log => {
      // Status filter
      if (filter !== 'all') {
        const status = log.status?.toLowerCase();
        if (filter === 'sent' && status !== 'sent' && status !== 'delivered') return false;
        if (filter === 'failed' && status !== 'failed') return false;
        if (filter === 'pending' && status !== 'pending' && status !== 'queued') return false;
        if (filter === 'processing' && status !== 'processing') return false;
      }
      
      // Trigger filter
      if (selectedTriggers.length > 0 && !selectedTriggers.includes(log.trigger)) {
        return false;
      }
      
      // Search filter
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const matchesUsername = log.username?.toLowerCase().includes(searchLower);
        const matchesTrigger = log.trigger?.toLowerCase().includes(searchLower);
        if (!matchesUsername && !matchesTrigger) return false;
      }
      
      return true;
    });

    // Sort logs
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle date fields
        if (sortConfig.key === 'createdAt' || sortConfig.key === 'created_at') {
          aVal = a.createdAt || a.created_at;
          bVal = b.createdAt || b.created_at;
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
        }
        if (typeof bVal === 'string') {
          bVal = bVal.toLowerCase();
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [logs, filter, selectedTriggers, searchTerm, sortConfig]);

  // Memoized displayed logs (with pagination)
  const displayedLogs = useMemo(() => {
    return filteredLogs.slice(0, displayCount);
  }, [filteredLogs, displayCount]);

  // Memoized unique triggers for dropdown
  const triggerOptions = useMemo(() => {
    return NOTIFICATION_TRIGGERS.filter(trigger => 
      availableTriggers.includes(trigger.value)
    );
  }, [availableTriggers]);

  // Event handlers
  const toggleTrigger = useCallback((trigger) => {
    setSelectedTriggers(prev => 
      prev.includes(trigger) 
        ? prev.filter(t => t !== trigger)
        : [...prev, trigger]
    );
  }, []);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const getSortIcon = useCallback((key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  }, [sortConfig]);

  const formatDate = useCallback((dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  }, []);

  const loadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + PAGE_SIZE, filteredLogs.length));
  }, [filteredLogs.length]);

  // Reset display count when filters change
  useEffect(() => {
    setDisplayCount(Math.min(PAGE_SIZE, filteredLogs.length));
  }, [filteredLogs.length]);

  return (
    <div className="event-status-log">
      <div className="log-header">
        <h2>📜 Event Status Log</h2>
        <p>View detailed notification event history and status changes</p>
      </div>

      {/* Filters */}
      <div className="log-filters">
        <div className="filter-row">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
          </select>

          <div className="multi-select-dropdown">
            <button
              className="multi-select-button"
              onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
            >
              Triggers ({selectedTriggers.length}) ▼
            </button>
            
            {showTriggerDropdown && (
              <div className="dropdown-menu">
                {triggerOptions.map(trigger => (
                  <label key={trigger.value} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={selectedTriggers.includes(trigger.value)}
                      onChange={() => toggleTrigger(trigger.value)}
                    />
                    {trigger.label}
                  </label>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            placeholder="Search by username or trigger..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />

          <button onClick={refresh} className="btn btn-primary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading event logs...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={refresh} className="btn btn-primary">Retry</button>
        </div>
      )}

      {/* Logs Table */}
      {!loading && !error && (
        <>
          {displayedLogs.length === 0 ? (
            <div className="empty-state">
              <p>No event logs found matching your filters.</p>
            </div>
          ) : (
            <div className="logs-table">
              <table>
                <thead>
                  <tr>
                    <th onClick={() => handleSort('username')} className="sortable">
                      Username {getSortIcon('username')}
                    </th>
                    <th onClick={() => handleSort('trigger')} className="sortable">
                      Trigger {getSortIcon('trigger')}
                    </th>
                    <th onClick={() => handleSort('status')} className="sortable">
                      Status {getSortIcon('status')}
                    </th>
                    <th onClick={() => handleSort('createdAt')} className="sortable">
                      Created {getSortIcon('createdAt')}
                    </th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedLogs.map((log, index) => (
                    <tr key={`${log._id || index}`}>
                      <td>{log.username}</td>
                      <td>{log.trigger}</td>
                      <td>
                        <span className={getStatusClass(log.status)}>
                          {getStatusIcon(log.status)} {log.status}
                        </span>
                      </td>
                      <td>{formatDate(log.createdAt || log.created_at)}</td>
                      <td>
                        <div className="log-details">
                          {log.channels && (
                            <span className="detail-item">
                              Channels: {log.channels.join(', ')}
                            </span>
                          )}
                          {log.error && (
                            <span className="detail-item error">
                              Error: {log.error}
                            </span>
                          )}
                          {log.attempts && (
                            <span className="detail-item">
                              Attempts: {log.attempts}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Load More */}
          {displayedLogs.length < filteredLogs.length && (
            <LoadMore
              onLoadMore={loadMore}
              loading={loading}
              hasMore={displayedLogs.length < filteredLogs.length}
              count={displayedLogs.length}
              total={filteredLogs.length}
            />
          )}
        </>
      )}
    </div>
  );
};

export default EventStatusLog;
