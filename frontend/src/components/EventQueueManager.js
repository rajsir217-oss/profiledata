import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendApiUrl } from '../utils/urlHelper';
import './EventQueueManager.css';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';

const EventQueueManager = () => {
  const navigate = useNavigate();
  const [queueItems, setQueueItems] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [logs, setLogs] = useState([]); // Logs tab moved to top-level in NotificationManagement
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  const [filters, setFilters] = useState({
    status: 'all',
    triggers: [],  // Changed to array for multi-select
    channel: 'all',
    search: ''
  });
  const [showTriggerDropdown, setShowTriggerDropdown] = useState(false);
  
  // All available triggers for multi-select
  const availableTriggers = [
    { value: 'new_match', label: '💕 New Match', group: 'Match Events' },
    { value: 'mutual_favorite', label: '💖 Mutual Favorite', group: 'Match Events' },
    { value: 'shortlist_added', label: '⭐ Shortlist Added', group: 'Match Events' },
    { value: 'profile_view', label: '👁️ Profile View', group: 'Activity' },
    { value: 'favorited', label: '❤️ Favorited', group: 'Activity' },
    { value: 'new_message', label: '💬 New Message', group: 'Messages' },
    { value: 'unread_messages', label: '📬 Unread Messages', group: 'Messages' },
    { value: 'pii_request', label: '🔒 PII Request', group: 'Privacy' },
    { value: 'pii_granted', label: '✅ PII Granted', group: 'Privacy' },
    { value: 'pii_denied', label: '❌ PII Denied', group: 'Privacy' },
    { value: 'weekly_digest', label: '📊 Weekly Digest', group: 'Engagement' },
    { value: 'poll_reminder', label: '📋 Poll Reminder', group: 'Engagement' }
  ];
  const [stats, setStats] = useState({
    queued: 0,
    processing: 0,
    success: 0,
    failed: 0
  });
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Event Queue Manager by:', username);
      navigate('/dashboard');
    }
  }, [navigate]);

  const loadQueue = async (token) => {
    const response = await fetch(getBackendApiUrl('/api/notifications/queue'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      // Token expired or invalid - redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) throw new Error('Failed to load queue');
    const data = await response.json();
    setQueueItems(data);
  };

  // eslint-disable-next-line no-unused-vars
  const loadLogs = async (token) => {
    const response = await fetch(getBackendApiUrl('/api/notifications/logs'), {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('userRole');
      window.location.href = '/login';
      throw new Error('Session expired. Please log in again.');
    }
    
    if (!response.ok) throw new Error('Failed to load logs');
    const data = await response.json();
    setLogs(data);
  };

  const loadStats = async (token) => {
    try {
      const response = await fetch(getBackendApiUrl('/api/notifications/analytics'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setStats({
          queued: data.queued || 0,
          processing: data.processing || 0,
          success: data.success_24h || 0,
          failed: data.failed_24h || 0
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        toast.error('Not authenticated. Please log in.');
        setTimeout(() => window.location.href = '/login', 2000);
        return;
      }
      
      // Only load queue - logs are in separate Logs tab
      await loadQueue(token);
      
      await loadStats(token);
    } catch (err) {
      console.error('Error loading data:', err);
      const message = err.message || 'Failed to load data';
      toast.error(message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, [loadData]);

  // Clear selections on data reload
  useEffect(() => {
    setSelectedItems(new Set());
  }, [queueItems]);

  const handleDeleteQueueItem = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      
      // Queue endpoint only - logs are in DeliveryLog tab
      const endpoint = getBackendApiUrl(`/api/notifications/queue/${itemId}?hard_delete=true`);
      
      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to delete item');
      }

      loadData();
      toast.success('Queue item deleted');
    } catch (err) {
      console.error('Error deleting item:', err);
      toast.error(err.message || 'Failed to delete item');
    }
  };

  const handleRetry = async (itemId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/notifications/queue/${itemId}/retry`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to retry');

      loadData();
      toast.success('Notification queued for retry');
    } catch (err) {
      console.error('Error retrying:', err);
      toast.error('Failed to retry notification');
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allIds = filteredItems.map(item => item._id);
      setSelectedItems(new Set(allIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleBulkDelete = () => {
    if (selectedItems.size === 0) {
      toast.error('No items selected');
      return;
    }
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    setShowBulkDeleteModal(false);
    
    try {
      const token = localStorage.getItem('token');
      const count = selectedItems.size;
      
      // Queue endpoint only - logs are in DeliveryLog tab
      const endpoint = (itemId) => getBackendApiUrl(`/api/notifications/queue/${itemId}?hard_delete=true`)
      
      const deletePromises = Array.from(selectedItems).map(async itemId => {
        const response = await fetch(endpoint(itemId), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (!response.ok) {
          console.error(`Failed to delete ${itemId}: ${response.status}`);
        }
        return response;
      });

      const results = await Promise.allSettled(deletePromises);
      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.ok).length;
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
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const getStatusBadge = (status) => {
    // Map backend status to frontend display
    const statusMap = {
      'pending': 'queued',
      'scheduled': 'queued',
      'sent': 'sent',
      'delivered': 'sent',
      'failed': 'failed',
      'cancelled': 'failed',
      'processing': 'processing'
    };
    
    const mappedStatus = statusMap[status] || status;
    
    const badges = {
      queued: { color: 'blue', icon: '⏳', text: 'Queued' },
      processing: { color: 'yellow', icon: '⚙️', text: 'Processing' },
      sent: { color: 'green', icon: '✅', text: 'Sent' },
      success: { color: 'green', icon: '✅', text: 'Success' },
      failed: { color: 'red', icon: '❌', text: 'Failed' },
      error: { color: 'red', icon: '❌', text: 'Error' }
    };

    const badge = badges[mappedStatus] || badges.queued;
    return (
      <span className={`status-${badge.color}`}>
        {badge.icon} {badge.text}
      </span>
    );
  };

  const getTriggerIcon = (trigger) => {
    const icons = {
      new_match: '💕',
      mutual_favorite: '💖',
      shortlist_added: '⭐',
      profile_view: '👁️',
      favorited: '❤️',
      new_message: '💬',
      message_read: '✓✓',
      pii_request: '🔐',
      pii_granted: '🔓',
      unread_messages: '📬'
    };
    return icons[trigger] || '📧';
  };

  const formatDateTime = (dateString) => {
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
  };

  const getFilteredItems = () => {
    const items = queueItems; // Only show queue items - logs are in separate Logs tab
    
    // Filter items
    let filtered = items.filter(item => {
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
        if (sortConfig.key === 'datetime') {
          aVal = a.created_at || a.sent_at || a.queued_at;
          bVal = b.created_at || b.sent_at || b.queued_at;
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
  };

  const filteredItems = getFilteredItems();

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
            <div className="stat-label">Sent (24h)</div>
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

      {/* Queue Only - Logs moved to DeliveryLog tab */}
      <div className="queue-header-bar">
        <span className="queue-label">📥 Queue ({queueItems.length})</span>
      </div>

      {/* Filters - Order: Channel | Triggers | Status | Search */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Channel:</label>
          <select
            value={filters.channel}
            onChange={(e) => setFilters(prev => ({ ...prev, channel: e.target.value }))}
          >
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
          </select>
        </div>

        <div className="filter-group trigger-filter">
          <label>Trigger:</label>
          <div className="multi-select-container">
            <button 
              className="multi-select-trigger"
              onClick={() => setShowTriggerDropdown(!showTriggerDropdown)}
            >
              {filters.triggers.length === 0 
                ? 'All Triggers' 
                : `${filters.triggers.length} selected`}
              <span className="dropdown-arrow">{showTriggerDropdown ? '▲' : '▼'}</span>
            </button>
            
            {showTriggerDropdown && (
              <div className="multi-select-dropdown">
                <div className="multi-select-header">
                  <button 
                    className="select-all-btn"
                    onClick={() => {
                      if (filters.triggers.length === availableTriggers.length) {
                        setFilters(prev => ({ ...prev, triggers: [] }));
                      } else {
                        setFilters(prev => ({ ...prev, triggers: availableTriggers.map(t => t.value) }));
                      }
                    }}
                  >
                    {filters.triggers.length === availableTriggers.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                <div className="multi-select-options">
                  {availableTriggers.map(trigger => (
                    <label key={trigger.value} className="multi-select-option" style={{ color: '#e0e0e0' }}>
                      <input
                        type="checkbox"
                        checked={filters.triggers.includes(trigger.value)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFilters(prev => ({ ...prev, triggers: [...prev.triggers, trigger.value] }));
                          } else {
                            setFilters(prev => ({ ...prev, triggers: prev.triggers.filter(t => t !== trigger.value) }));
                          }
                        }}
                      />
                      <span style={{ color: '#e0e0e0' }}>{trigger.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">All Status</option>
            <option value="queued">Queued</option>
            <option value="processing">Processing</option>
            <option value="sent">Sent</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>🔍 Search:</label>
          <input
            type="text"
            placeholder="Search by user or trigger..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>

        <button className="btn btn-primary btn-refresh" onClick={loadData} disabled={loading}>
          🔄 {loading ? 'Loading...' : 'Refresh'}
        </button>

        <div className="filter-results">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </div>

        {selectedItems.size > 0 && (
          <button 
            className="btn btn-danger"
            onClick={handleBulkDelete}
            title="Delete selected items"
          >
            🗑️ Delete {selectedItems.size} Selected
          </button>
        )}
      </div>

      {/* Events Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading events...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No events found</h3>
          <p>No notification events match your filters</p>
        </div>
      ) : (
        <div className="events-table-container">
          <table className="events-table">
            <thead>
              <tr>
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={selectedItems.size > 0 && selectedItems.size === filteredItems.length}
                    onChange={handleSelectAll}
                    title="Select all"
                  />
                </th>
                <th className="sortable" onClick={() => handleSort('username')}>
                  Recipient {sortConfig.key === 'username' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="sortable" onClick={() => handleSort('trigger')}>
                  Event {sortConfig.key === 'trigger' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th>Triggered By</th>
                <th>Channels</th>
                <th className="sortable" onClick={() => handleSort('datetime')}>
                  Date/Time {sortConfig.key === 'datetime' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th className="sortable" onClick={() => handleSort('status')}>
                  Status {sortConfig.key === 'status' && (sortConfig.direction === 'asc' ? '▲' : '▼')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, index) => (
                <tr key={item._id || index}>
                  <td className="checkbox-cell">
                    <input
                      type="checkbox"
                      checked={selectedItems.has(item._id)}
                      onChange={() => handleSelectItem(item._id)}
                    />
                  </td>
                  <td>
                    <div className="user-cell">
                      <strong>{item.username}</strong>
                      {item.recipient_email && (
                        <small>{item.recipient_email}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="event-cell">
                      <span className="event-icon">{getTriggerIcon(item.trigger)}</span>
                      <span>{item.trigger?.replace(/_/g, ' ')}</span>
                    </div>
                  </td>
                  <td>
                    {item.templateData?.match?.firstName || 
                     item.triggered_by || 
                     'System'}
                  </td>
                  <td>
                    <div className="channels">
                      {item.channels?.map(ch => (
                        <span key={ch} className="channel-badge">
                          {ch === 'email' && '📧'}
                          {ch === 'sms' && '📱'}
                          {ch === 'push' && '🔔'}
                          {ch}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <div className="datetime-cell">
                      {formatDateTime(item.created_at || item.sent_at || item.queued_at)}
                    </div>
                  </td>
                  <td>
                    {getStatusBadge(item.status)}
                    {item.error_message && (
                      <div className="error-message" title={item.error_message}>
                        ⚠️ {item.error_message.substring(0, 30)}...
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons">
                      {/* Show delete for all items except those currently processing */}
                      {item.status !== 'processing' && (
                        <DeleteButton
                          onDelete={() => handleDeleteQueueItem(item._id)}
                          itemName={`${item.trigger} notification for ${item.username}`}
                          confirmMessage="Are you sure you want to delete this notification from the queue?"
                        />
                      )}
                      {/* Show retry for failed/error items */}
                      {(item.status === 'failed' || item.status === 'error') && (
                        <button
                          className="btn-icon success"
                          title="Retry"
                          onClick={() => handleRetry(item._id)}
                        >
                          🔄
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowBulkDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🗑️ Bulk Delete Confirmation</h3>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to delete <strong>{selectedItems.size} selected item(s)</strong>?</p>
              <p className="warning-text">⚠️ This action cannot be undone.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowBulkDeleteModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={confirmBulkDelete}
              >
                ✓ Delete {selectedItems.size} Items
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {/* Toast notifications handled by ToastContainer in App.js */}
    </div>
  );
};

export default EventQueueManager;
