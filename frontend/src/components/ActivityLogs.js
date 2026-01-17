// frontend/src/components/ActivityLogs.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendApiUrl } from '../utils/urlHelper';
import './ActivityLogs.css';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';

const ActivityLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const toast = useToast();
  
  // Filters
  const [filters, setFilters] = useState({
    username: '',
    action_types: [],  // Changed to array for multi-select
    target_username: '',
    start_date: '',
    end_date: ''
  });
  
  // Multi-select dropdown state
  const [showActionDropdown, setShowActionDropdown] = useState(false);
  
  // Pagination state
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const logsPerPage = 20;  // Show 20 rows per page
  
  const [total, setTotal] = useState(0);
  const [actionTypes, setActionTypes] = useState([]);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [exportValue, setExportValue] = useState('');
  
  // Admin-only protection
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Activity Logs');
      navigate('/dashboard');
    }
  }, [navigate]);
  
  // Load action types for filter dropdown
  const loadActionTypes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl('/api/activity-logs/action-types'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (response.ok) {
        const data = await response.json();
        setActionTypes(data.action_types || []);
      }
    } catch (error) {
      console.error('Error loading action types:', error);
    }
  };
  
  // Load logs (initial load or filter change)
  const loadLogs = async (pageNum = 1, append = false, currentFilters = filters) => {
    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      // Add pagination params
      queryParams.append('page', pageNum.toString());
      queryParams.append('limit', logsPerPage.toString());
      
      // Add filter params - use passed filters to avoid stale closure
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (key === '_timestamp') return;  // Skip internal timestamp field
        if (key === 'action_types' && Array.isArray(value) && value.length > 0) {
          // Send multiple action types as comma-separated
          queryParams.append('action_types', value.join(','));
        } else if (value && value !== 'all' && !Array.isArray(value)) {
          queryParams.append(key, value);
        }
      });
      
      console.log('🔍 Loading logs with params:', queryParams.toString());
      
      const response = await fetch(getBackendApiUrl(`/api/activity-logs/?${queryParams}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load logs');
      
      const data = await response.json();
      const newLogs = data.logs || [];
      const totalCount = data.total || 0;
      
      if (append) {
        // Prevent duplicates by filtering out logs that already exist
        setLogs(prev => {
          const existingIds = new Set(prev.map(log => log._id));
          const uniqueNewLogs = newLogs.filter(log => !existingIds.has(log._id));
          return [...prev, ...uniqueNewLogs];
        });
      } else {
        setLogs(newLogs);
        setSelectedLogs([]);
        setSelectAll(false);
      }
      
      setTotal(totalCount);
      setPage(pageNum);
      // Check if we've loaded all logs (current loaded + new should not exceed total)
      setHasMore(newLogs.length === logsPerPage && pageNum * logsPerPage < totalCount);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };
  
  // Load more logs (next page)
  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      loadLogs(page + 1, true);
    }
  };
  
  // Load stats
  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl('/api/activity-logs/stats'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };
  
  useEffect(() => {
    loadActionTypes();
  }, []);
  
  useEffect(() => {
    loadLogs(1, false, filters);
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);
  
  // Export logs
  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      
      // Build query params, excluding empty values and 'all'
      const queryParams = new URLSearchParams();
      queryParams.append('format', format);
      
      // Only add non-empty filter values
      if (filters.username) queryParams.append('username', filters.username);
      if (filters.action_type && filters.action_type !== 'all') {
        queryParams.append('action_type', filters.action_type);
      }
      if (filters.target_username) queryParams.append('target_username', filters.target_username);
      if (filters.start_date) queryParams.append('start_date', filters.start_date);
      if (filters.end_date) queryParams.append('end_date', filters.end_date);
      
      const response = await fetch(getBackendApiUrl(`/api/activity-logs/export?${queryParams}`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Export failed:', response.status, errorText);
        throw new Error(`Export failed: ${response.status} - ${errorText}`);
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Exported ${total} logs as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed');
    }
  };
  
  // Cleanup old logs (no confirmation needed - DeleteButton handles it)
  const handleCleanup = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl('/api/activity-logs/cleanup?days=30'), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to cleanup');
      
      const data = await response.json();
      toast.success(`Deleted ${data.deleted_count} old logs`);
      loadLogs();
    } catch (error) {
      console.error('Error cleaning up logs:', error);
      toast.error('Failed to cleanup logs');
    }
  };
  
  // Delete single log
  const handleDeleteLog = async (logId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/activity-logs/${logId}`), {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to delete log');
      
      toast.success('Activity log deleted');
      loadLogs();
    } catch (error) {
      console.error('Error deleting log:', error);
      toast.error('Failed to delete log');
    }
  };
  
  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedLogs.length === 0) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl('/api/activity-logs/delete-bulk'), {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedLogs)
      });
      
      if (!response.ok) throw new Error('Failed to delete logs');
      
      const data = await response.json();
      toast.success(`Deleted ${data.deleted_count} logs`);
      loadLogs();
    } catch (error) {
      console.error('Error deleting logs:', error);
      toast.error('Failed to delete logs');
    }
  };
  
  // Toggle select all
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLogs([]);
      setSelectAll(false);
    } else {
      setSelectedLogs(logs.map(log => log._id));
      setSelectAll(true);
    }
  };
  
  // Toggle individual checkbox
  const handleToggleLog = (logId) => {
    if (selectedLogs.includes(logId)) {
      setSelectedLogs(selectedLogs.filter(id => id !== logId));
    } else {
      setSelectedLogs([...selectedLogs, logId]);
    }
  };
  
  // Apply search filters - updates filters which triggers useEffect to reload
  const handleSearch = () => {
    setShowActionDropdown(false);  // Close dropdown
    // Create new filter object to trigger useEffect
    const newFilters = { 
      ...filters, 
      username: searchTerm, 
      target_username: targetSearch,
      _timestamp: Date.now()  // Force state change to trigger reload
    };
    setFilters(newFilters);
  };
  
  // Handle Enter key press
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };
  
  // Get action badge styling
  const getActionBadge = (actionType) => {
    const badges = {
      user_login: { color: 'success', icon: '🔓', label: 'Login' },
      user_logout: { color: 'info', icon: '🔒', label: 'Logout' },
      profile_viewed: { color: 'primary', icon: '👀', label: 'Profile Viewed' },
      profile_edited: { color: 'warning', icon: '✏️', label: 'Profile Edited' },
      favorite_added: { color: 'danger', icon: '❤️', label: 'Favorite Added' },
      favorite_removed: { color: 'secondary', icon: '💔', label: 'Favorite Removed' },
      shortlist_added: { color: 'primary', icon: '⭐', label: 'Shortlist Added' },
      message_sent: { color: 'info', icon: '💬', label: 'Message Sent' },
      search_performed: { color: 'secondary', icon: '🔍', label: 'Search' },
      pii_request_sent: { color: 'warning', icon: '🔐', label: 'PII Request' },
      pii_request_approved: { color: 'success', icon: '✅', label: 'PII Approved' },
      user_status_changed: { color: 'danger', icon: '⚠️', label: 'Status Changed' },
      user_suspended: { color: 'danger', icon: '🚫', label: 'User Suspended' },
      user_banned: { color: 'danger', icon: '⛔', label: 'User Banned' }
    };
    
    const badge = badges[actionType] || { color: 'secondary', icon: '📝', label: actionType.replace(/_/g, ' ') };
    return badge;
  };
  
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };
  
  return (
    <div className="activity-logs">
      {/* Toast notifications handled by ToastContainer in App.js */}
      
      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-content">
              <div className="stat-value">{stats.total_activities.toLocaleString()}</div>
              <div className="stat-label">Total</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-content">
              <div className="stat-value">{stats.unique_users}</div>
              <div className="stat-label">Users</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-content">
              <div className="stat-value">{Object.keys(stats.top_actions).length}</div>
              <div className="stat-label">Types</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          className="filter-input"
          placeholder="Username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <input
          type="text"
          className="filter-input"
          placeholder="Target user..."
          value={targetSearch}
          onChange={(e) => setTargetSearch(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <div className="multi-select-container">
          <button 
            className="multi-select-trigger"
            onClick={() => setShowActionDropdown(!showActionDropdown)}
          >
            {filters.action_types.length === 0 
              ? 'All Actions' 
              : `${filters.action_types.length} selected`}
            <span className="dropdown-arrow">{showActionDropdown ? '▲' : '▼'}</span>
          </button>
          
          {showActionDropdown && (
            <div className="multi-select-dropdown">
              <div className="multi-select-header">
                <button 
                  className="select-all-btn"
                  onClick={() => {
                    if (filters.action_types.length === actionTypes.length) {
                      setFilters({ ...filters, action_types: [] });
                    } else {
                      setFilters({ ...filters, action_types: actionTypes.map(t => t.value) });
                    }
                  }}
                >
                  {filters.action_types.length === actionTypes.length ? 'Clear All' : 'Select All'}
                </button>
              </div>
              <div className="multi-select-options">
                {actionTypes.map(type => (
                  <label key={type.value} className="multi-select-option">
                    <input
                      type="checkbox"
                      checked={filters.action_types.includes(type.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilters({ ...filters, action_types: [...filters.action_types, type.value] });
                        } else {
                          setFilters({ ...filters, action_types: filters.action_types.filter(t => t !== type.value) });
                        }
                      }}
                    />
                    <span>{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <input
          type="date"
          className="filter-date"
          value={filters.start_date}
          onChange={(e) => setFilters({ ...filters, start_date: e.target.value, page: 1 })}
        />
        
        <input
          type="date"
          className="filter-date"
          value={filters.end_date}
          onChange={(e) => setFilters({ ...filters, end_date: e.target.value, page: 1 })}
        />
        
        {/* Action buttons row */}
        <div className="action-buttons-row">
          <button 
            className="btn-primary"
            onClick={handleSearch}
          >
            <span className="search-icon">🔍</span>
            <span className="search-text"> Search</span>
          </button>
          
          <button 
            className="btn-secondary"
            onClick={() => {
              setSearchTerm('');
              setTargetSearch('');
              setFilters({ username: '', action_types: [], target_username: '', start_date: '', end_date: '' });
              setShowActionDropdown(false);
            }}
            title="Clear filters"
          >
            <span className="clear-icon">✕</span>
            <span className="clear-text">Clear</span>
          </button>
          
          <select 
            className="export-dropdown"
            value={exportValue}
            onChange={(e) => {
              const format = e.target.value;
              if (format) {
                handleExport(format);
                setExportValue(''); // Reset to default
              }
            }}
          >
            <option value="">📥</option>
            <option value="json">JSON</option>
            <option value="csv">CSV</option>
          </select>
          
          <DeleteButton
            onDelete={handleCleanup}
            itemName="logs >30 days"
            size="medium"
            icon="🧹"
            confirmIcon="✓"
            confirmText="Cleanup?"
          />
          
          {selectedLogs.length > 0 && (
            <DeleteButton
              onDelete={handleBulkDelete}
              itemName={`${selectedLogs.length} log${selectedLogs.length > 1 ? 's' : ''}`}
              size="medium"
              confirmText={`Delete ${selectedLogs.length}?`}
            />
          )}
        </div>
      </div>
      
      {/* Logs Table */}
      <div className="logs-table-container">
        {loading ? (
          <div className="loading">Loading activity logs...</div>
        ) : (
          <table className="logs-table">
            <thead>
              <tr>
                <th className="checkbox-col">
                  <input
                    type="checkbox"
                    checked={selectAll}
                    onChange={handleSelectAll}
                    title="Select all"
                  />
                </th>
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP Address</th>
                <th>Duration</th>
                <th>Details</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const badge = getActionBadge(log.action_type);
                const isExpanded = expandedRow === log._id;
                
                return (
                  <React.Fragment key={log._id}>
                    <tr className={selectedLogs.includes(log._id) ? 'selected-row' : ''}>
                      <td className="checkbox-col">
                        <input
                          type="checkbox"
                          checked={selectedLogs.includes(log._id)}
                          onChange={() => handleToggleLog(log._id)}
                        />
                      </td>
                      <td className="timestamp">{formatDate(log.timestamp)}</td>
                      <td className="username">{log.username}</td>
                      <td>
                        <span className={`action-badge badge-${badge.color}`}>
                          {badge.icon} {badge.label}
                        </span>
                      </td>
                      <td>{log.target_username || '-'}</td>
                      <td className="ip-address">{log.ip_address || '-'}</td>
                      <td className="duration">{log.duration_ms ? `${log.duration_ms}ms` : '-'}</td>
                      <td>
                        <button 
                          className="btn-sm btn-expand"
                          onClick={() => setExpandedRow(isExpanded ? null : log._id)}
                          title={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? '−' : '+'}
                        </button>
                      </td>
                      <td className="delete-col">
                        <DeleteButton
                          onDelete={() => handleDeleteLog(log._id)}
                          itemName="log"
                          size="small"
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="expanded-row">
                        <td colSpan="9">
                          <div className="metadata-box">
                            <h4>📋 Metadata:</h4>
                            <pre>{JSON.stringify(log.metadata || {}, null, 2)}</pre>
                            {log.page_url && <p><strong>Page:</strong> {log.page_url}</p>}
                            {log.referrer_url && <p><strong>Referrer:</strong> {log.referrer_url}</p>}
                            {log.session_id && <p><strong>Session:</strong> {log.session_id}</p>}
                            {log.user_agent && <p><strong>User Agent:</strong> {log.user_agent}</p>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan="9" className="no-data">
                    No activity logs found for the selected filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Load More Pagination - Single button with all info */}
      <div className="pagination-row">
        {hasMore ? (
          <button
            className="load-more-btn"
            onClick={handleLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading...' : `Load more (${Math.min(logsPerPage, total - logs.length)}) ${logs.length}/${total}`}
          </button>
        ) : (
          <span className="pagination-info">{Math.min(logs.length, total)} of {total} logs</span>
        )}
      </div>
    </div>
  );
};

export default ActivityLogs;
