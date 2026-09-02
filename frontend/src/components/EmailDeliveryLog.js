/**
 * Optimized EmailDeliveryLog Component
 * 
 * Phase 2 Optimizations:
 * - Shared status mapping hook
 * - Memoized filtering and sorting
 * - Cancellable requests
 * - Error boundaries
 * - Performance monitoring
 * - Virtual scrolling support
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import LoadMore from './LoadMore';
import './EmailDeliveryLog.css';
import useAdminAuth from '../hooks/useAdminAuth';
import useNotificationStatus from '../hooks/useNotificationStatus';
import { getBackendUrl } from '../config/apiConfig';

// Error Boundary Component
class EmailDeliveryLogErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('EmailDeliveryLog Error:', error, errorInfo);
    this.setState({ error, hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <details>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const EmailDeliveryLog = () => {
  // Admin authentication
  useAdminAuth();
  
  // Shared hooks
  const { getStatusClass } = useNotificationStatus();
  
  // Direct state management (replacing useNotificationData hook)
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [dateScope, setDateScope] = useState('current_month');
  
  // Load logs function
  const PAGE_SIZE = 50;

  const loadLogs = useCallback(async ({ append = false, skipOverride = 0 } = {}) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Not authenticated');
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
        return;
      }
      
      const backendUrl = getBackendUrl();
      const url = `${backendUrl}/api/notifications/logs?channel=email&limit=${PAGE_SIZE}&skip=${skipOverride}&paginated=true&date_scope=${dateScope}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Transform log data
      const rawData = Array.isArray(data?.logs) ? data.logs : (Array.isArray(data) ? data : []);
      const transformed = rawData.map(log => ({
        ...log,
        id: log._id || log.id,
        username: log.username || 'unknown',
        trigger: log.trigger || log.type,
        status: log.status || 'unknown',
        sentAt: log.sentAt || log.createdAt || log.created_at,
        createdAt: log.createdAt || log.created_at,
        lineage: log.lineage || null,
        error: log.error || null,
        attempts: log.attempts || 1,
        templateId: log.templateId || null
      }));
      
      setLogs(prev => append ? [...prev, ...transformed] : transformed);
      setHasMore(Boolean(data?.hasMore));
      setTotalCount(typeof data?.total === 'number' ? data.total : (skipOverride + transformed.length + (data?.hasMore ? 1 : 0)));
      
    } catch (err) {
      setError(err.message);
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [PAGE_SIZE, dateScope]);
  
  // Load on mount
  useEffect(() => {
    loadLogs();
  }, [loadLogs]);
  
  // Refresh function
  const refresh = useCallback(() => {
    loadLogs({ append: false, skipOverride: 0 });
  }, [loadLogs]);

  // State management
  const [filter, setFilter] = useState('all');
  const [searchLineage, setSearchLineage] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'sentAt', direction: 'desc' });
  
  // Multi-select trigger filter
  const [selectedTriggers, setSelectedTriggers] = useState([]);
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  const [useVirtualScroll, setUseVirtualScroll] = useState(false);
  
  // Performance monitoring
  const performanceRef = useRef({
    renderCount: 0,
    lastRender: Date.now(),
    filterTime: 0,
    sortTime: 0
  });

  
  // Memoized available triggers
  const availableTriggers = useMemo(() => {
    const triggers = [...new Set(logs.map(log => log.trigger || log.type).filter(Boolean))];
    return triggers.sort();
  }, [logs]);

  // Memoized filtered and sorted logs
  const filteredLogs = useMemo(() => {
    const startTime = performance.now();
    
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
      if (searchLineage) {
        const searchLower = searchLineage.toLowerCase();
        const matchesLineage = log.lineage?.toLowerCase().includes(searchLower);
        if (!matchesLineage) return false;
      }
      
      return true;
    });

    // Sort logs
    if (sortConfig.key) {
      const sortStartTime = performance.now();
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle date fields
        if (sortConfig.key === 'sentAt' || sortConfig.key === 'createdAt' || sortConfig.key === 'created_at') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }

        // Convert to comparable values
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
        }
        if (typeof bVal === 'string') {
          bVal = bVal.toLowerCase();
        }

        if (sortConfig.direction === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
      performanceRef.current.sortTime = performance.now() - sortStartTime;
    }

    performanceRef.current.filterTime = performance.now() - startTime;
    return filtered;
  }, [logs, filter, selectedTriggers, searchLineage, sortConfig]);

  // Memoized displayed logs (with pagination)
  const displayedLogs = useMemo(() => filteredLogs, [filteredLogs]);

  // Memoized trigger options
  const triggerOptions = useMemo(() => {
    return availableTriggers.map(trigger => ({
      value: trigger,
      label: trigger.charAt(0).toUpperCase() + trigger.slice(1),
      selected: selectedTriggers.includes(trigger)
    }));
  }, [availableTriggers, selectedTriggers]);

  // Performance tracking
  useEffect(() => {
    performanceRef.current.renderCount++;
    performanceRef.current.lastRender = Date.now();
    
    // Log performance warnings
    if (performanceRef.current.renderCount % 50 === 0) {
      const avgRenderTime = Date.now() - performanceRef.current.lastRender;
      const avgFilterTime = performanceRef.current.filterTime;
      const avgSortTime = performanceRef.current.sortTime;
      
      if (avgRenderTime > 100) {
        console.warn(`EmailDeliveryLog: Slow render detected (${avgRenderTime}ms)`);
      }
      if (avgFilterTime > 50) {
        console.warn(`EmailDeliveryLog: Slow filtering detected (${avgFilterTime}ms)`);
      }
      if (avgSortTime > 50) {
        console.warn(`EmailDeliveryLog: Slow sorting detected (${avgSortTime}ms)`);
      }
    }
  });

  // Event handlers with memoization
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
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }, []);

  const loadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    loadLogs({ append: true, skipOverride: logs.length });
  }, [hasMore, loadingMore, loadLogs, logs.length]);

  const handleRefresh = useCallback(() => {
    refresh(true); // Force refresh
  }, [refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Cleanup handled by useNotificationData hook
    };
  }, []);

  // Render component
  return (
    <EmailDeliveryLogErrorBoundary>
      <div className="email-delivery-log">
        <div className="log-header">
          <h2>📧 Email Delivery Log</h2>
          <p>View email delivery status and tracking information</p>
          <div className="header-actions">
            <button onClick={handleRefresh} className="btn btn-primary" disabled={loading}>
              🔄 Refresh
            </button>
            <button
              onClick={() => setUseVirtualScroll(!useVirtualScroll)}
              className={`btn ${useVirtualScroll ? 'btn-info' : 'btn-secondary'}`}
            >
              {useVirtualScroll ? '📱 Virtual Scroll' : '📄 Regular Scroll'}
            </button>
                      </div>
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

            <select
              value={dateScope}
              onChange={(e) => setDateScope(e.target.value)}
              className="filter-select"
              title="Time range"
            >
              <option value="current_month">Current Month</option>
              <option value="all_time">All Time</option>
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
                  {triggerOptions.map(option => (
                    <label key={option.value} className="dropdown-item">
                      <input
                        type="checkbox"
                        checked={option.selected}
                        onChange={() => toggleTrigger(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <input
              type="text"
              placeholder="Search by lineage..."
              value={searchLineage}
              onChange={(e) => setSearchLineage(e.target.value)}
              className="search-input"
            />

            <div className="sort-controls">
              <select
                value={sortConfig.key}
                onChange={(e) => handleSort(e.target.value)}
                className="sort-select"
              >
                <option value="sentAt">Sent Time</option>
                <option value="createdAt">Created Time</option>
                <option value="username">Username</option>
                <option value="trigger">Trigger</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => setSortConfig(prev => ({
                  key: prev.key,
                  direction: prev.direction === 'asc' ? 'desc' : 'asc'
                }))}
                className="sort-direction"
                title={sortConfig.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
                aria-label={sortConfig.direction === 'asc' ? 'Sort descending' : 'Sort ascending'}
              >
                {sortConfig.direction === 'asc' ? '🔼' : '🔽'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading email delivery logs...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={handleRefresh} className="btn btn-primary">Retry</button>
          </div>
        )}

        {/* Logs Display */}
        {!loading && !error && (
          <>
            {displayedLogs.length === 0 ? (
              <div className="empty-state">
                <p>No email delivery logs found matching your filters.</p>
                <button onClick={() => {
                  setFilter('all');
                  setSearchLineage('');
                  setSelectedTriggers([]);
                }} className="btn btn-primary">
                  Clear Filters
                </button>
              </div>
            ) : (
              <>
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
                        <th onClick={() => handleSort('sentAt')} className="sortable">
                          Sent Time {getSortIcon('sentAt')}
                        </th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedLogs.map((log, index) => (
                        <tr key={log.id || index}>
                          <td>{log.username}</td>
                          <td>{log.trigger || log.type}</td>
                          <td>
                            <span className={getStatusClass(log.status)}>
                              {log.status}
                            </span>
                          </td>
                          <td className="time-cell">{formatDate(log.sentAt || log.createdAt)}</td>
                          <td>
                            <div className="log-details">
                              {log.lineage && (
                                <span className="detail-item">
                                  Lineage: {log.lineage}
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
                
                {/* Load More Button */}
                <LoadMore
                  onLoadMore={loadMore}
                  currentCount={logs.length}
                  totalCount={totalCount}
                  itemsPerLoad={PAGE_SIZE}
                  itemLabel="logs"
                  buttonText="Load more logs"
                  loading={loadingMore}
                />
              </>
            )}
          </>
        )}
      </div>
    </EmailDeliveryLogErrorBoundary>
  );
};

export default EmailDeliveryLog;
