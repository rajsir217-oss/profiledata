import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../../config/apiConfig';
import { useToast } from '../../hooks/useToast';
import './SavedSearchNotificationManager.css';

// Create admin API client with proper baseURL
const adminApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * Admin component to view and manage all saved search notifications
 * Phase 1: View all searches with notifications and basic filtering
 */
const SavedSearchNotificationManager = () => {
  const toast = useToast();
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
  // eslint-disable-next-line no-unused-vars
  const [showDisableModal, setShowDisableModal] = useState(false); // Reserved for future disable confirmation modal
  const [showTestModal, setShowTestModal] = useState(false);
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedSearch, setSelectedSearch] = useState(null);
  
  // Log data
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
  // Override form state
  const [overrideTime, setOverrideTime] = useState('09:00');
  const [overrideFrequency, setOverrideFrequency] = useState('daily');
  const [overrideDay, setOverrideDay] = useState('monday');
  const [overrideReason, setOverrideReason] = useState('');
  const [enableTimeOverride, setEnableTimeOverride] = useState(false);
  const [enableFrequencyOverride, setEnableFrequencyOverride] = useState(false);
  
  // Disable form state (reserved for future disable confirmation modal)
  // eslint-disable-next-line no-unused-vars
  const [disableReason, setDisableReason] = useState('');
  // eslint-disable-next-line no-unused-vars
  const [notifyUser, setNotifyUser] = useState(false);
  
  // Test form state
  const [testEmail, setTestEmail] = useState('admin');
  const [customEmail, setCustomEmail] = useState('');
  
  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchSavedSearches();
    fetchAnalytics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searches, statusFilter, searchQuery]);

  const fetchSavedSearches = async (filterOverride = null) => {
    try {
      setLoading(true);
      const response = await adminApi.get('/api/admin/saved-searches/with-notifications', {
        params: { status_filter: filterOverride ?? statusFilter }
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
      const response = await adminApi.get('/api/admin/saved-searches/analytics');
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

  const handleOverride = async () => {
    if (!selectedSearch) return;
    
    if (!enableTimeOverride && !enableFrequencyOverride) {
      toast.warning('Please select at least one override option');
      return;
    }
    
    try {
      setActionLoading(true);
      const overrideData = {
        searchId: selectedSearch.id,
        username: selectedSearch.username,
        override: {
          reason: overrideReason
        }
      };
      
      if (enableTimeOverride) {
        overrideData.override.time = overrideTime;
      }
      
      if (enableFrequencyOverride) {
        overrideData.override.frequency = overrideFrequency;
        if (overrideFrequency === 'weekly') {
          overrideData.override.dayOfWeek = overrideDay;
        }
      }
      
      await adminApi.post('/api/admin/saved-searches/override', overrideData);
      
      setShowOverrideModal(false);
      resetOverrideForm();
      fetchSavedSearches();
      toast.success('Override applied successfully');
    } catch (err) {
      console.error('Error applying override:', err);
      toast.error(`Failed to apply override: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleNotifications = async (search) => {
    const isCurrentlyActive = search.isActive;
    
    try {
      setActionLoading(true);
      
      if (isCurrentlyActive) {
        // Disable
        await adminApi.post('/api/admin/saved-searches/disable', {
          searchId: search.id,
          username: search.username,
          reason: 'Admin disabled via toggle',
          notifyUser: false
        });
        toast.success('Notifications disabled');
      } else {
        // Enable
        await adminApi.post('/api/admin/saved-searches/enable', {
          searchId: search.id,
          username: search.username
        });
        toast.success('Notifications enabled');
      }
      
      fetchSavedSearches();
    } catch (err) {
      console.error('Error toggling notifications:', err);
      toast.error(`Failed to ${isCurrentlyActive ? 'disable' : 'enable'}: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleEnable = async (search) => {
    // Enable without confirmation - can add 2-click pattern later if needed
    try {
      setActionLoading(true);
      await adminApi.post('/api/admin/saved-searches/enable', {
        searchId: search.id,
        username: search.username
      });
      
      fetchSavedSearches();
      toast.success('Notifications enabled successfully');
    } catch (err) {
      console.error('Error enabling notifications:', err);
      toast.error(`Failed to enable: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTest = async () => {
    if (!selectedSearch) return;
    
    let emailToSend = '';
    if (testEmail === 'admin') {
      emailToSend = localStorage.getItem('email') || 'admin@email.com';
    } else if (testEmail === 'user') {
      // Send "user" to backend - it will fetch the actual email from user's profile
      emailToSend = 'user';
    } else {
      emailToSend = customEmail;
      if (!emailToSend || !emailToSend.includes('@')) {
        toast.warning('Please enter a valid email address');
        return;
      }
    }
    
    try {
      setActionLoading(true);
      const response = await adminApi.post('/api/admin/saved-searches/test', {
        searchId: selectedSearch.id,
        username: selectedSearch.username,
        testEmail: emailToSend
      });
      
      setShowTestModal(false);
      // Show the actual email that was used (returned from backend)
      const actualEmail = response.data.testEmail || emailToSend;
      toast.success(`Test email sent to ${actualEmail}`);
    } catch (err) {
      console.error('Error sending test email:', err);
      toast.error(`Failed to send test: ${err.response?.data?.detail || err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const resetOverrideForm = () => {
    setOverrideTime('09:00');
    setOverrideFrequency('daily');
    setOverrideDay('monday');
    setOverrideReason('');
    setEnableTimeOverride(false);
    setEnableFrequencyOverride(false);
    setSelectedSearch(null);
  };

  const openOverrideModal = (search) => {
    setSelectedSearch(search);
    // Pre-populate with current settings
    const schedule = search.effectiveSchedule;
    if (schedule.time) setOverrideTime(schedule.time);
    if (schedule.frequency) setOverrideFrequency(schedule.frequency);
    if (schedule.dayOfWeek) setOverrideDay(schedule.dayOfWeek);
    setShowOverrideModal(true);
  };

  const handleViewLog = async (search) => {
    setSelectedSearch(search);
    setShowLogModal(true);
    setLogsLoading(true);
    
    try {
      const response = await adminApi.get(`/api/admin/saved-searches/${search.id}/logs`);
      setLogs(response.data.logs || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      toast.error('Failed to load execution logs');
      setLogs([]);
    } finally {
      setLogsLoading(false);
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
              const newFilter = e.target.value;
              setStatusFilter(newFilter);
              fetchSavedSearches(newFilter); // Pass new filter directly to avoid state timing issue
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
                  {/* Toggle Switch for Enable/Disable */}
                  <label className="toggle-switch" title={isActive ? 'Click to disable' : 'Click to enable'}>
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggleNotifications(search)}
                      disabled={actionLoading}
                    />
                    <span className="toggle-slider"></span>
                    <span className="toggle-label">{isActive ? '🔔 On' : '🔕 Off'}</span>
                  </label>
                  
                  {isActive && (
                    <button 
                      className="btn btn-sm btn-primary"
                      onClick={() => openOverrideModal(search)}
                      disabled={actionLoading}
                    >
                      ✏️ Override
                    </button>
                  )}
                  <button 
                    className="btn btn-sm btn-info"
                    onClick={() => {
                      setSelectedSearch(search);
                      setShowTestModal(true);
                    }}
                    disabled={actionLoading}
                  >
                    🧪 Test
                  </button>
                  <button 
                    className="btn btn-sm btn-secondary"
                    onClick={() => handleViewLog(search)}
                    disabled={actionLoading}
                  >
                    📋 View Log
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

      {/* Override Modal */}
      {showOverrideModal && selectedSearch && (
        <div className="modal-overlay" onClick={() => setShowOverrideModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Override Notification Schedule</h3>
            
            <div className="modal-body">
              <div className="search-details">
                <p><strong>User:</strong> {selectedSearch.username}</p>
                <p><strong>Search:</strong> {selectedSearch.name}</p>
              </div>
              
              <div className="current-settings">
                <h4>User's Current Settings:</h4>
                <p>• Frequency: {selectedSearch.notifications.frequency}</p>
                <p>• Time: {formatTime(selectedSearch.notifications.time)}</p>
                {selectedSearch.notifications.frequency === 'weekly' && (
                  <p>• Day: {selectedSearch.notifications.dayOfWeek}</p>
                )}
              </div>
              
              <div className="override-form">
                <h4>Admin Override:</h4>
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enableTimeOverride}
                    onChange={(e) => setEnableTimeOverride(e.target.checked)}
                  />
                  Override time
                </label>
                
                {enableTimeOverride && (
                  <input
                    type="time"
                    value={overrideTime}
                    onChange={(e) => setOverrideTime(e.target.value)}
                    className="form-control"
                  />
                )}
                
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={enableFrequencyOverride}
                    onChange={(e) => setEnableFrequencyOverride(e.target.checked)}
                  />
                  Override frequency
                </label>
                
                {enableFrequencyOverride && (
                  <div className="frequency-controls">
                    <select
                      value={overrideFrequency}
                      onChange={(e) => setOverrideFrequency(e.target.value)}
                      className="form-select"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                    </select>
                    
                    {overrideFrequency === 'weekly' && (
                      <select
                        value={overrideDay}
                        onChange={(e) => setOverrideDay(e.target.value)}
                        className="form-select"
                      >
                        <option value="monday">Monday</option>
                        <option value="tuesday">Tuesday</option>
                        <option value="wednesday">Wednesday</option>
                        <option value="thursday">Thursday</option>
                        <option value="friday">Friday</option>
                        <option value="saturday">Saturday</option>
                        <option value="sunday">Sunday</option>
                      </select>
                    )}
                  </div>
                )}
                
                <label>Reason (optional):</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you're overriding (e.g., Server load management)..."
                  rows="3"
                  className="form-control"
                />
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowOverrideModal(false)} 
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleOverride} 
                className="btn btn-primary"
                disabled={actionLoading}
              >
                {actionLoading ? 'Saving...' : 'Save Override'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedSearch && (
        <div className="modal-overlay" onClick={() => setShowTestModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Test Notification</h3>
            
            <div className="modal-body">
              <div className="search-details">
                <p><strong>User:</strong> {selectedSearch.username}</p>
                <p><strong>Search:</strong> {selectedSearch.name}</p>
              </div>
              
              <p>This will run the search and send a test email immediately.</p>
              
              <label>Send test email to:</label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="testEmail"
                    value="admin"
                    checked={testEmail === 'admin'}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  Admin (You) - {localStorage.getItem('email') || 'your email'}
                </label>
                
                <label className="radio-label">
                  <input
                    type="radio"
                    name="testEmail"
                    value="user"
                    checked={testEmail === 'user'}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  User ({selectedSearch.username})
                </label>
                
                <label className="radio-label">
                  <input
                    type="radio"
                    name="testEmail"
                    value="custom"
                    checked={testEmail === 'custom'}
                    onChange={(e) => setTestEmail(e.target.value)}
                  />
                  Custom email:
                </label>
                
                {testEmail === 'custom' && (
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="custom@email.com"
                    className="form-control"
                  />
                )}
              </div>
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowTestModal(false)} 
                className="btn btn-secondary"
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button 
                onClick={handleTest} 
                className="btn btn-info"
                disabled={actionLoading}
              >
                {actionLoading ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Log Modal */}
      {showLogModal && selectedSearch && (
        <div className="modal-overlay" onClick={() => setShowLogModal(false)}>
          <div className="modal-content log-modal" onClick={(e) => e.stopPropagation()}>
            <h3>📋 Notification Execution Log</h3>
            
            <div className="modal-body">
              <div className="search-details">
                <p><strong>User:</strong> {selectedSearch.username}</p>
                <p><strong>Search:</strong> {selectedSearch.name}</p>
              </div>
              
              {logsLoading ? (
                <div className="loading-logs">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading logs...</span>
                  </div>
                  <p>Loading execution logs...</p>
                </div>
              ) : logs.length === 0 ? (
                <div className="no-logs">
                  <p>📭 No execution logs found</p>
                  <p className="text-secondary">This notification hasn't been sent yet.</p>
                </div>
              ) : (
                <div className="logs-list">
                  {logs.map((log, index) => (
                    <div key={log.id || index} className={`log-entry ${log.status}`}>
                      <div className="log-header">
                        <div className="log-badges">
                          <span className={`log-status-badge ${log.status}`}>
                            {log.status === 'sent' && '✅ Sent'}
                            {log.status === 'failed' && '❌ Failed'}
                            {log.status === 'pending' && '⏳ Pending'}
                          </span>
                          {log.metadata?.isTest && (
                            <span className="log-test-badge">
                              🧪 TEST
                            </span>
                          )}
                        </div>
                        <span className="log-timestamp">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      
                      <div className="log-details">
                        <span className="log-detail">
                          📧 To: {log.recipient || 'Unknown'}
                        </span>
                        <span className="log-detail">
                          👥 Matches: {log.matchCount || 0}
                        </span>
                        {log.attempts > 1 && (
                          <span className="log-detail">
                            🔁 Attempts: {log.attempts}
                          </span>
                        )}
                      </div>
                      
                      {log.error && (
                        <div className="log-error">
                          <strong>Error:</strong> {log.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                onClick={() => setShowLogModal(false)} 
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SavedSearchNotificationManager;
