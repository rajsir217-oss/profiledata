import React, { useState, useEffect } from 'react';
import api from '../../api';
import './SavedSearchNotificationManager.css';

/**
 * Admin component to view and manage all saved search notifications
 * Phase 1: View all searches with notifications and basic filtering
 */
const SavedSearchNotificationManager = () => {
  const [searches, setSearches] = useState([]);
  const [filteredSearches, setFilteredSearches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Analytics
  const [analytics, setAnalytics] = useState(null);
  const [showAnalytics, setShowAnalytics] = useState(false);
  
  // Modals
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  
  // Override form state
  const [overrideTime, setOverrideTime] = useState('09:00');
  const [overrideFrequency, setOverrideFrequency] = useState('daily');
  const [overrideDay, setOverrideDay] = useState('monday');
  const [overrideReason, setOverrideReason] = useState('');
  const [enableTimeOverride, setEnableTimeOverride] = useState(false);
  const [enableFrequencyOverride, setEnableFrequencyOverride] = useState(false);
  
  // Disable form state
  const [disableReason, setDisableReason] = useState('');
  const [notifyUser, setNotifyUser] = useState(false);
  
  // Test form state
  const [testEmail, setTestEmail] = useState('admin');
  const [customEmail, setCustomEmail] = useState('');
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSavedSearches();
    fetchAnalytics();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searches, statusFilter, searchQuery]);

  const fetchSavedSearches = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/saved-searches/with-notifications', {
        params: { status_filter: statusFilter }
      });
      setSearches(response.data.searches || []);
      setError('');
    } catch (err) {
      console.error('Error fetching saved searches:', err);
      setError('Failed to load saved searches. Make sure you are logged in as admin.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const response = await api.get('/admin/saved-searches/analytics');
      setAnalytics(response.data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    }
  };

  const applyFilters = () => {
    let filtered = [...searches];
    
    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(s =>
        s.name.toLowerCase().includes(query) ||
        s.username.toLowerCase().includes(query)
      );
    }
    
    setFilteredSearches(filtered);
  };

  const formatTime = (time) => {
    if (!time) return 'N/A';
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    
    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else {
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} days ago`;
    }
  };

  if (loading) {
    return (
      <div className="notification-manager">
        <div className="loading">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p>Loading saved searches...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-manager">
      {/* Header */}
      <div className="manager-header">
        <h2>📧 Saved Search Notifications Manager</h2>
        <div className="header-actions">
          <button 
            onClick={() => setShowAnalytics(!showAnalytics)} 
            className="btn btn-info"
          >
            📊 {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
          <button onClick={fetchSavedSearches} className="btn btn-primary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Analytics Panel */}
      {showAnalytics && analytics && (
        <div className="analytics-panel">
          <h3>📊 Notification Analytics</h3>
          <div className="analytics-grid">
            <div className="analytics-card">
              <div className="analytics-value">{analytics.totalActive}</div>
              <div className="analytics-label">Active Searches</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-value">
                {analytics.byFrequency.daily}
              </div>
              <div className="analytics-label">Daily Notifications</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-value">
                {analytics.byFrequency.weekly}
              </div>
              <div className="analytics-label">Weekly Notifications</div>
            </div>
            <div className="analytics-card">
              <div className="analytics-value">{analytics.successRate}%</div>
              <div className="analytics-label">Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={statusFilter} 
            onChange={(e) => {
              setStatusFilter(e.target.value);
              fetchSavedSearches(); // Refetch with new filter
            }}
            className="form-select"
          >
            <option value="all">All</option>
            <option value="active">Active Only</option>
            <option value="disabled">Disabled</option>
            <option value="overridden">Overridden</option>
          </select>
        </div>
        
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by name or username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-control search-input"
          />
        </div>
      </div>

      {/* Searches List */}
      <div className="searches-list">
        {filteredSearches.length === 0 ? (
          <div className="no-results">
            <p>No saved searches found matching your filters.</p>
          </div>
        ) : (
          filteredSearches.map(search => {
            const isActive = search.isActive;
            const hasOverride = search.adminOverride && !search.adminOverride.disabled;
            const schedule = search.effectiveSchedule;
            
            return (
              <div key={search.id} className={`search-card ${!isActive ? 'disabled' : ''}`}>
                <div className="search-card-header">
                  <div className="search-info">
                    <span className="username">👤 {search.username}</span>
                    <span className="search-name">{search.name}</span>
                  </div>
                </div>
                
                <div className="search-card-body">
                  <div className="status-line">
                    <span className={`status-badge ${isActive ? 'active' : 'disabled'}`}>
                      {isActive ? '🟢 Active' : '🔴 Disabled'}
                    </span>
                    <span className="frequency">
                      {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} @ {formatTime(schedule.time)}
                      {schedule.frequency === 'weekly' && ` (${schedule.dayOfWeek})`}
                    </span>
                    {hasOverride && (
                      <span className="override-badge">✏️ Overridden</span>
                    )}
                  </div>
                  
                  <div className="schedule-info">
                    <span>📅 Last Sent: {formatDate(search.lastNotificationSent)}</span>
                  </div>
                  
                  {hasOverride && (
                    <div className="override-info">
                      <strong>✅ Admin Override Active</strong>
                      {search.adminOverride.reason && (
                        <span className="override-reason">
                          Reason: {search.adminOverride.reason}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {search.adminOverride?.disabled && (
                    <div className="disabled-info">
                      <strong>🔴 Disabled by Admin</strong>
                      <span className="disabled-reason">
                        Reason: {search.adminOverride.reason}
                      </span>
                    </div>
                  )}
                  
                  {/* Show search criteria */}
                  {search.criteria && (
                    <details className="criteria-details">
                      <summary>View Search Criteria</summary>
                      <div className="criteria-list">
                        {Object.entries(search.criteria)
                          .filter(([key, value]) => 
                            value && value !== '' && 
                            !['page', 'limit', 'status'].includes(key)
                          )
                          .map(([key, value]) => (
                            <span key={key} className="criteria-item">
                              <strong>{key}:</strong> {value.toString()}
                            </span>
                          ))}
                      </div>
                    </details>
                  )}
                </div>
                
                <div className="search-card-actions">
                  <button className="btn btn-sm btn-secondary" disabled>
                    ✏️ Edit (Phase 2)
                  </button>
                  <button className="btn btn-sm btn-info" disabled>
                    🧪 Test (Phase 2)
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="pagination-info">
        Showing {filteredSearches.length} of {searches.length} total searches
      </div>
    </div>
  );
};

export default SavedSearchNotificationManager;
