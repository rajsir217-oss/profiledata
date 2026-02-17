/**
 * Optimized EventQueueManager Component
 * 
 * Optimizations:
 * - Centralized admin authentication
 * - Memoized filtering and sorting
 * - Cancellable API requests
 * - Fixed memory leaks
 * - Reduced code duplication
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import './EventQueueManager.css';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';
import useAdminAuth from '../hooks/useAdminAuth';
import useNotificationStatus from '../hooks/useNotificationStatus';
import useCancellableRequest from '../hooks/useCancellableRequest';
import { 
  NOTIFICATION_TRIGGERS, 
  TRIGGER_ICONS, 
  API_ENDPOINTS, 
  REFRESH_INTERVALS,
  FILTER_OPTIONS 
} from '../constants/notificationTriggers';

const EventQueueManager = () => {
  useAdminAuth(); // Centralized admin authentication
  
  const [queueItems, setQueueItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const toast = useToast();
  const { makeRequest, cleanup } = useCancellableRequest();
  const { getStatusBadge } = useNotificationStatus();
  
  // Filter state
  const [filters, setFilters] = useState({
    status: 'all',
    triggers: [],
    channel: 'all',
    search: ''
  });
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  
  // UI state
  const [stats, setStats] = useState({
    queued: 0,
    processing: 0,
    success: 0,
    failed: 0
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: 'createdAt', direction: 'desc' });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  
  // Refs for cleanup
  const intervalRef = useRef(null);
  const mountedRef = useRef(true);

  // Memoized filtered and sorted items
  const filteredItems = useMemo(() => {
    if (!queueItems.length) return [];
    
    // Filter items
    let filtered = queueItems.filter(item => {
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      const matchesTrigger = filters.triggers.length === 0 || filters.triggers.includes(item.trigger);
      const matchesChannel = filters.channel === 'all' || item.channels?.includes(filters.channel);
      const matchesSearch = !filters.search || 
        item.username?.toLowerCase().includes(filters.search.toLowerCase()) ||
        item.trigger?.toLowerCase().includes(filters.search.toLowerCase());
      
      return matchesStatus && matchesTrigger && matchesChannel && matchesSearch;
    });

    // Sort items
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        let aVal = a[sortConfig.key];
        let bVal = b[sortConfig.key];

        // Handle nested properties
        if (sortConfig.key === 'createdAt') {
          aVal = a.createdAt || a.created_at || a.queued_at;
          bVal = b.createdAt || b.created_at || b.queued_at;
        }

        // Convert to comparable values
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
  }, [queueItems, filters, sortConfig]);

  // Memoized all item IDs for select all
  const allItemIds = useMemo(() => {
    return filteredItems.map(item => item._id);
  }, [filteredItems]);

  // Load queue data with cancellation
  const loadQueue = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await makeRequest(getBackendApiUrl(API_ENDPOINTS.QUEUE), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response || response.status === 401) {
        // Token expired - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) {
        throw new Error('Failed to load queue');
      }

      const data = await response.json();
      if (mountedRef.current) {
        setQueueItems(data || []);
        setError(null);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && mountedRef.current) {
        console.error('Error loading queue:', err);
        setError(err.message);
        toast.error('Failed to load queue');
      }
    }
  }, [makeRequest, toast]);

  // Load stats with cancellation
  const loadStats = useCallback(async () => {
    if (!mountedRef.current) return;
    
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await makeRequest(getBackendApiUrl(API_ENDPOINTS.ANALYTICS), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response && response.ok && mountedRef.current) {
        const data = await response.json();
        setStats({
          queued: data.queued || 0,
          processing: data.processing || 0,
          success: data.success_24h || 0,
          failed: data.failed_24h || 0
        });
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error loading stats:', err);
      }
    }
  }, [makeRequest]);

  // Combined data loading function
  const loadData = useCallback(async () => {
    if (!mountedRef.current) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Load in parallel for better performance
      await Promise.all([loadQueue(), loadStats()]);
    } catch (err) {
      // Errors handled in individual functions
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [loadQueue, loadStats]);

  // Setup data loading with proper cleanup
  useEffect(() => {
    loadData();
    
    // Set up interval with proper cleanup
    intervalRef.current = setInterval(loadData, REFRESH_INTERVALS.QUEUE);
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      cleanup(); // Cancel any pending requests
    };
  }, [loadData, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      cleanup();
    };
  }, [cleanup]);

  // Clear selections on data reload (but preserve if user is actively selecting)
  useEffect(() => {
    if (selectedItems.size === 0) return; // Don't clear if user has selections
    
    // Only clear if the data has actually changed significantly
    const currentIds = new Set(queueItems.map(item => item._id));
    const selectedIds = new Set(selectedItems);
    
    // Remove selections for items that no longer exist
    const validSelections = new Set([...selectedIds].filter(id => currentIds.has(id)));
    if (validSelections.size !== selectedIds.size) {
      setSelectedItems(validSelections);
    }
  }, [queueItems, selectedItems]);

  // Event handlers with memoization
  const handleDeleteQueueItem = useCallback(async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await makeRequest(
        getBackendApiUrl(`${API_ENDPOINTS.QUEUE}/${itemId}?hard_delete=true`),
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response || !response.ok) {
        const errorData = response ? await response.json().catch(() => ({})) : {};
        throw new Error(errorData.detail || 'Failed to delete item');
      }

      loadData();
      toast.success('Queue item deleted');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error deleting item:', err);
        toast.error(err.message || 'Failed to delete item');
      }
    }
  }, [makeRequest, loadData, toast]);

  const handleRetry = useCallback(async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await makeRequest(
        getBackendApiUrl(`${API_ENDPOINTS.QUEUE}/${itemId}/retry`),
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (!response || !response.ok) {
        throw new Error('Failed to retry');
      }

      loadData();
      toast.success('Notification queued for retry');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error retrying:', err);
        toast.error('Failed to retry notification');
      }
    }
  }, [makeRequest, loadData, toast]);

  const handleSelectAll = useCallback((e) => {
    if (e.target.checked) {
      setSelectedItems(new Set(allItemIds));
    } else {
      setSelectedItems(new Set());
    }
  }, [allItemIds]);

  const handleSelectItem = useCallback((itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  }, []);

  const handleBulkDelete = useCallback(() => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    setShowBulkDeleteModal(true);
  }, [selectedItems, toast]);

  const confirmBulkDelete = useCallback(async () => {
    setShowBulkDeleteModal(false);
    
    try {
      const token = localStorage.getItem('token');
      const count = selectedItems.size;
      
      const deletePromises = Array.from(selectedItems).map(async itemId => {
        const response = await makeRequest(
          getBackendApiUrl(`${API_ENDPOINTS.QUEUE}/${itemId}?hard_delete=true`),
          {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );
        
        if (!response || !response.ok) {
          console.error(`Failed to delete ${itemId}: ${response?.status || 'unknown'}`);
        }
        return response;
      });

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value && r.value.ok).length;
      const failCount = count - successCount;
      
      setSelectedItems(new Set());
      loadData();
      
      if (failCount > 0) {
        toast.warning(`⚠️ Deleted ${successCount} of ${count} item(s). ${failCount} failed.`);
      } else {
        toast.success(`✅ Deleted ${count} item(s)`);
      }
    } catch (err) {
      console.error('Error bulk deleting:', err);
      toast.error('Failed to delete items');
    }
  }, [selectedItems, makeRequest, loadData, toast]);

  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const formatDateTime = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  }, []);

  // Render component
  return (
    <div className="event-queue-manager">
      <div className="manager-header">
        <div className="header-left">
          <h1>📊 Event Queue Manager</h1>
          <p>Monitor notification events and delivery status</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card blue">
          <div className="stat-icon">⏳</div>
          <div className="stat-content">
            <div className="stat-value">{stats.queued}</div>
            <div className="stat-label">Queued</div>
          </div>
        </div>

        <div className="stat-card yellow">
          <div className="stat-icon">⚙️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.processing}</div>
            <div className="stat-label">Processing</div>
          </div>
        </div>

        <div className="stat-card green">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-value">{stats.success}</div>
            <div className="stat-label">Success (24h)</div>
          </div>
        </div>

        <div className="stat-card red">
          <div className="stat-icon">❌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.failed}</div>
            <div className="stat-label">Failed (24h)</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-controls">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            className="filter-select"
          >
            {FILTER_OPTIONS.STATUS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <select
            value={filters.channel}
            onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
            className="filter-select"
          >
            {FILTER_OPTIONS.CHANNEL.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <div className="multi-select-dropdown">
            <button
              className="multi-select-button"
              onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
            >
              Triggers ({filters.triggers.length}) ▼
            </button>
            
            {showTriggerDropdown && (
              <div className="dropdown-menu">
                {NOTIFICATION_TRIGGERS.map(trigger => (
                  <label key={trigger.value} className="dropdown-item">
                    <input
                      type="checkbox"
                      checked={filters.triggers.includes(trigger.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters(prev => ({
                            ...prev,
                            triggers: [...prev.triggers, trigger.value]
                          }));
                        } else {
                          setFilters(prev => ({
                            ...prev,
                            triggers: prev.triggers.filter(t => t !== trigger.value)
                          }));
                        }
                      }}
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
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            className="search-input"
          />
        </div>

        <div className="bulk-actions">
          <label className="select-all">
            <input
              type="checkbox"
              checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
              onChange={handleSelectAll}
            />
            Select All ({selectedItems.size})
          </label>
          
          <button
            className="btn btn-danger"
            onClick={handleBulkDelete}
            disabled={selectedItems.size === 0}
          >
            Delete Selected ({selectedItems.size})
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading queue data...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={loadData} className="btn btn-primary">Retry</button>
        </div>
      )}

      {/* Queue Items */}
      {!loading && !error && (
        <div className="queue-items">
          {filteredItems.length === 0 ? (
            <div className="empty-state">
              <p>No queue items found matching your filters.</p>
            </div>
          ) : (
            <div className="items-table">
              <table>
                <thead>
                  <tr>
                    <th>
                      <input
                        type="checkbox"
                        checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th onClick={() => handleSort('username')} className="sortable">
                      Username {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('trigger')} className="sortable">
                      Trigger {sortConfig.key === 'trigger' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('status')} className="sortable">
                      Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th onClick={() => handleSort('createdAt')} className="sortable">
                      Created {sortConfig.key === 'createdAt' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
                    </th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => {
                    const badge = getStatusBadge(item.status);
                    return (
                      <tr key={item._id}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item._id)}
                            onChange={() => handleSelectItem(item._id)}
                          />
                        </td>
                        <td>{item.username}</td>
                        <td>
                          {TRIGGER_ICONS[item.trigger] || '📧'} {item.trigger}
                        </td>
                        <td>
                          <span className={badge.className}>
                            {badge.icon} {badge.text}
                          </span>
                        </td>
                        <td>{formatDateTime(item.createdAt)}</td>
                        <td>
                          <div className="action-buttons">
                            {item.status === 'failed' && (
                              <button
                                onClick={() => handleRetry(item._id)}
                                className="btn btn-sm btn-primary"
                              >
                                Retry
                              </button>
                            )}
                            <DeleteButton
                              onDelete={() => handleDeleteQueueItem(item._id)}
                              itemName={`${item.trigger} notification for ${item.username}`}
                              confirmMessage="Are you sure you want to delete this notification from the queue?"
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Bulk Delete Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Confirm Bulk Delete</h3>
              <button onClick={() => setShowBulkDeleteModal(false)} className="modal-close">✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete {selectedItems.size} notification(s)?</p>
              <p>This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowBulkDeleteModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={confirmBulkDelete} className="btn btn-danger">
                Delete {selectedItems.size} Item(s)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventQueueManager;
