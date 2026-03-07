import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './InactiveUsersReport.css';

const InactiveUsersReport = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [displayCount, setDisplayCount] = useState(20);
  const rowsPerPage = 20;
  const [filters, setFilters] = useState({
    username: '',
    gender: '',
    minDays: '',
    maxDays: '',
    dateFrom: '',
    dateTo: ''
  });
  
  const [sortConfig, setSortConfig] = useState({
    key: 'daysElapsed',
    direction: 'desc'
  });
  
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 500, // Backend max is 500
    total: 0
  });

  const loadInactiveUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      
      // Add filters
      if (filters.username) params.append('username', filters.username);
      if (filters.gender) params.append('gender', filters.gender);
      if (filters.minDays) params.append('min_days', filters.minDays);
      if (filters.maxDays) params.append('max_days', filters.maxDays);
      if (filters.dateFrom) params.append('date_from', filters.dateFrom);
      if (filters.dateTo) params.append('date_to', filters.dateTo);
      
      // Add sorting and pagination
      params.append('sort_by', sortConfig.key);
      params.append('sort_order', sortConfig.direction);
      params.append('page', pagination.page);
      params.append('limit', pagination.limit);

      const apiUrl = `${getBackendUrl()}/api/admin/inactive-users?${params}`;
      
      const response = await api.get(apiUrl);
      
      const loadedUsers = response.data.users || [];
      
      // Set all users at once
      setUsers(loadedUsers);
      
      setPagination(prev => ({
        ...prev,
        total: response.data.total || 0
      }));
    } catch (error) {
      logger.error('Error loading inactive users:', error);
      console.error('API Error Details:', error);
      
      // Log detailed error response
      if (error.response) {
        console.error('Error Status:', error.response.status);
        console.error('Error Data:', error.response.data);
        console.error('Error Headers:', error.response.headers);
      }
      
      // Log error instead of showing alerts in production
      if (error.response?.status === 401) {
        console.error('❌ Authentication required. Please log in again.');
      } else if (error.response?.status === 403) {
        console.error('❌ Admin access required for this report.');
      } else if (error.response?.status === 404) {
        console.error('❌ Inactive users endpoint not found. Please check server configuration.');
      } else if (error.response?.status === 422) {
        console.error('❌ Validation error - check request parameters');
      } else {
        console.error('❌ Error loading inactive users:', error.message || 'Unknown error');
      }
    } finally {
      setLoading(false);
    }
  }, [filters, sortConfig, pagination.page, pagination.limit]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadInactiveUsers();
  }, [loadInactiveUsers]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
    setPagination(prev => ({ ...prev, page: 1 }));
    setUsers([]);
    setDisplayCount(20); // Reset display count when filters change
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      username: '',
      gender: '',
      minDays: '',
      maxDays: '',
      dateFrom: '',
      dateTo: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setUsers([]);
    setDisplayCount(20); // Reset display count
  }, []);

  const exportToCSV = () => {
    const headers = ['Username', 'Name', 'Gender', 'Age', 'Last Login', 'Days Elapsed'];
    const csvData = users.map(user => [
      user.username,
      user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
      user.gender || 'Unknown',
      user.age != null ? user.age : 'N/A',
      user.lastLogin ? new Date(user.lastLogin).toLocaleString() : 'Never',
      user.daysElapsed != null ? user.daysElapsed : 'Never logged in'
    ]);
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inactive-users-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  };

  const getDaysElapsedColor = (days) => {
    if (days == null) return '#6c757d'; // Gray - Never logged in
    if (days >= 60) return '#dc3545'; // Red - Critical
    if (days >= 30) return '#fd7e14'; // Orange - Warning
    if (days >= 15) return '#ffc107'; // Yellow - Caution
    return '#28a745'; // Green - Normal
  };

  const sendTestReminder = async (username) => {
    try {
      const response = await api.post(`${getBackendUrl()}/api/admin/inactive-users/${username}/send-reminder`);
      if (response.data.success) {
        // Create a simple toast notification
        showToast(`✅ Test reminder sent to ${username}!`, 'success');
        loadInactiveUsers(); // Refresh the data
      }
    } catch (error) {
      logger.error('Error sending test reminder:', error);
      showToast(`❌ Failed to send test reminder to ${username}`, 'error');
    }
  };

  // Simple toast notification function
  const showToast = (message, type = 'info') => {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 10000;
      animation: slideIn 0.3s ease;
      max-width: 300px;
      word-wrap: break-word;
    `;
    
    // Set background color based on type
    if (type === 'success') {
      toast.style.backgroundColor = '#28a745';
    } else if (type === 'error') {
      toast.style.backgroundColor = '#dc3545';
    } else {
      toast.style.backgroundColor = '#007bff';
    }
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => {
        if (document.body.contains(toast)) {
          document.body.removeChild(toast);
        }
      }, 300);
    }, 3000);
  };
  
  // Add CSS animations for toast notifications only
  if (!document.querySelector('#toast-animations')) {
    const style = document.createElement('style');
    style.id = 'toast-animations';
    style.textContent = `
      @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return (
    <div className="inactive-users-report">
      <div className="report-header">
        <h2>📊 Inactive Users Report</h2>
        <div className="header-actions">
          <button onClick={exportToCSV} className="btn btn-primary">
            📥 Export CSV
          </button>
          <button onClick={loadInactiveUsers} className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filters-grid">
          <div className="filter-group">
            <label>Username:</label>
            <input
              type="text"
              value={filters.username}
              onChange={(e) => handleFilterChange('username', e.target.value)}
              placeholder="Search username..."
            />
          </div>
          <div className="filter-group">
            <label>Gender:</label>
            <select
              value={filters.gender}
              onChange={(e) => handleFilterChange('gender', e.target.value)}
            >
              <option value="">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="filter-group">
            <label>Min Days Inactive:</label>
            <input
              type="number"
              value={filters.minDays}
              onChange={(e) => handleFilterChange('minDays', e.target.value)}
              placeholder="15"
              min="0"
            />
          </div>
          <div className="filter-group">
            <label>Max Days Inactive:</label>
            <input
              type="number"
              value={filters.maxDays}
              onChange={(e) => handleFilterChange('maxDays', e.target.value)}
              placeholder="365"
              min="0"
            />
          </div>
          <div className="filter-group">
            <label>Date From:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className="filter-group">
            <label>Date To:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>
      </div>
      <div className="filter-footer-bottom">
        <span className="results-count">{pagination.total} users found</span>
        <button onClick={clearFilters} className="btn btn-outline">
          🗑️ Clear Filters
        </button>
      </div>
      {/* Results Table */}
      <div className="table-container">
        {loading ? (
          <div className="loading">Loading inactive users...</div>
        ) : (
          <>
            <table className="inactive-users-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('username')}>
                    Username {getSortIcon('username')}
                  </th>
                  <th onClick={() => handleSort('firstName')}>
                    Name {getSortIcon('firstName')}
                  </th>
                  <th onClick={() => handleSort('gender')}>
                    Gender {getSortIcon('gender')}
                  </th>
                  <th onClick={() => handleSort('age')}>
                    Age {getSortIcon('age')}
                  </th>
                  <th onClick={() => handleSort('lastLogin')}>
                    Last Login {getSortIcon('lastLogin')}
                  </th>
                  <th onClick={() => handleSort('daysElapsed')}>
                    Days Elapsed {getSortIcon('daysElapsed')}
                  </th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, displayCount).map((user, index) => (
                  <tr key={user.username || index}>
                    <td className="username-cell">
                      <strong 
                        style={{ 
                          color: 'var(--primary-color)', 
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                        onClick={() => window.open(`/profile/${user.username}`, '_blank')}
                        title="View profile"
                      >
                        {user.username}
                      </strong>
                    </td>
                    <td className="name-cell">
                      {user.fullName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="gender-cell">
                      <span className={`gender-badge gender-${user.gender?.toLowerCase()}`}>
                        {user.gender || 'Unknown'}
                      </span>
                    </td>
                    <td className="age-cell">
                      {user.age != null ? user.age : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="date-cell">
                      {formatDate(user.lastLogin)}
                    </td>
                    <td className="days-cell">
                      <span 
                        className="days-badge"
                        style={{ 
                          backgroundColor: getDaysElapsedColor(user.daysElapsed),
                          color: 'white'
                        }}
                      >
                        {user.daysElapsed != null ? `${user.daysElapsed} days` : 'Never'}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        className="btn btn-sm btn-primary"
                        onClick={() => sendTestReminder(user.username)}
                      >
                        📧 <span className="btn-text">Remind</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Load More Button */}
      {users.length > 0 && (
        <div className="load-more-container">
          <div className="load-more-content">
            {displayCount < users.length ? (
              <button 
                className="load-more-button"
                onClick={() => setDisplayCount(prev => Math.min(prev + rowsPerPage, users.length))}
              >
                Load {Math.min(rowsPerPage, users.length - displayCount)} more [{Math.min(displayCount, users.length)}/{users.length}]
              </button>
            ) : (
              <div className="load-more-complete">
                ✓ All {users.length} users loaded
              </div>
            )}
          </div>
        </div>
      )}


    </div>
  );
};

export default InactiveUsersReport;
