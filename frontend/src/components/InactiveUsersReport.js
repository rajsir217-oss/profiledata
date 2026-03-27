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
  const [loginStats, setLoginStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('inactive-users'); // 'inactive-users' or 'login-activity'
  const [selectedInterval, setSelectedInterval] = useState('30'); // 7, 30, 90, or 365 days
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

  // Load login statistics
  const loadLoginStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const apiUrl = `${getBackendUrl()}/api/admin/inactive-users/login-stats?interval=${selectedInterval}`;
      const response = await api.get(apiUrl);
      setLoginStats(response.data);
    } catch (error) {
      logger.error('Error loading login statistics:', error);
      console.error('Login stats error:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [selectedInterval]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadInactiveUsers();
  }, [loadInactiveUsers]);

  // Load login stats when interval changes
  useEffect(() => {
    if (activeTab === 'login-activity') {
      loadLoginStats();
    }
  }, [loadLoginStats, activeTab]);

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
          <button onClick={() => { loadInactiveUsers(); loadLoginStats(); }} className="btn btn-secondary">
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="main-tabs" style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: '2px solid var(--border-color)'
      }}>
        <button 
          className={`main-tab ${activeTab === 'inactive-users' ? 'active' : ''}`}
          onClick={() => setActiveTab('inactive-users')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'inactive-users' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'inactive-users' ? 'white' : 'var(--text-color)',
            border: 'none',
            borderBottom: activeTab === 'inactive-users' ? '3px solid var(--primary-color)' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s ease'
          }}
        >
          📊 Inactive Users Report
        </button>
        <button 
          className={`main-tab ${activeTab === 'login-activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('login-activity')}
          style={{
            padding: '12px 24px',
            background: activeTab === 'login-activity' ? 'var(--primary-color)' : 'transparent',
            color: activeTab === 'login-activity' ? 'white' : 'var(--text-color)',
            border: 'none',
            borderBottom: activeTab === 'login-activity' ? '3px solid var(--primary-color)' : '3px solid transparent',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '14px',
            borderRadius: '8px 8px 0 0',
            transition: 'all 0.2s ease'
          }}
        >
          📈 Login Activity
        </button>
      </div>

      {/* Login Activity Tab Content */}
      {activeTab === 'login-activity' && (
        <div className="login-stats-section" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, color: 'var(--text-color)' }}>📈 Login Activity</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <label style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-color)' }}>Time Period:</label>
              <select
                value={selectedInterval}
                onChange={(e) => setSelectedInterval(e.target.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '2px solid var(--border-color)',
                  background: 'var(--card-background)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                <option value="7">Last 7 Days</option>
                <option value="30">Last 30 Days</option>
                <option value="90">Last 90 Days</option>
                <option value="365">Last Year</option>
              </select>
            </div>
          </div>
          {!statsLoading && loginStats && (
            <>
              <div className="stats-grid" style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                gap: '16px',
                marginBottom: '24px'
              }}>
                <div className="stat-card" style={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📅 Last 24 Hours</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{loginStats.stats.last24Hours}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>logins</div>
                </div>
                <div className="stat-card" style={{
                  background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📊 Last 7 Days</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{loginStats.stats.last7Days}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>logins</div>
                </div>
                <div className="stat-card" style={{
                  background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📆 Last 30 Days</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{loginStats.stats.last30Days}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>logins</div>
                </div>
                <div className="stat-card" style={{
                  background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                  padding: '20px',
                  borderRadius: '12px',
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ fontSize: '14px', opacity: 0.9, marginBottom: '8px' }}>📈 Last Year</div>
                  <div style={{ fontSize: '32px', fontWeight: 700 }}>{loginStats.stats.last365Days}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>logins</div>
                </div>
              </div>

              {/* Line Chart */}
              <div className="chart-container" style={{
            background: 'var(--card-background)',
            padding: '24px',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            marginBottom: '24px'
          }}>
            <h4 style={{ marginBottom: '16px', color: 'var(--text-color)' }}>
              📊 Daily Login Trend ({selectedInterval === '7' ? 'Last 7 Days' : selectedInterval === '30' ? 'Last 30 Days' : selectedInterval === '90' ? 'Last 90 Days' : 'Last Year'})
            </h4>
            <svg width="100%" height="350" style={{ overflow: 'visible' }}>
              {(() => {
                const data = loginStats.chartData;
                const maxCount = Math.max(...data.map(d => d.count), 1);
                const width = 900;
                const height = 300;
                const padding = { top: 20, right: 40, bottom: 60, left: 60 };
                const chartWidth = width - padding.left - padding.right;
                const chartHeight = height - padding.top - padding.bottom;
                
                // Calculate points for line
                const points = data.map((d, i) => {
                  const x = padding.left + (i / (data.length - 1)) * chartWidth;
                  const y = padding.top + chartHeight - (d.count / maxCount) * chartHeight;
                  return { x, y, date: d.date, count: d.count };
                });
                
                // Create line path
                const linePath = points.map((p, i) => 
                  `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
                ).join(' ');
                
                // Create area path (for gradient fill)
                const areaPath = `M ${padding.left} ${padding.top + chartHeight} ` +
                  points.map(p => `L ${p.x} ${p.y}`).join(' ') +
                  ` L ${padding.left + chartWidth} ${padding.top + chartHeight} Z`;
                
                return (
                  <g>
                    {/* Grid lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
                      <g key={i}>
                        <line
                          x1={padding.left}
                          y1={padding.top + chartHeight * (1 - ratio)}
                          x2={padding.left + chartWidth}
                          y2={padding.top + chartHeight * (1 - ratio)}
                          stroke="var(--border-color)"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                        <text
                          x={padding.left - 10}
                          y={padding.top + chartHeight * (1 - ratio) + 4}
                          textAnchor="end"
                          fontSize="12"
                          fill="var(--text-muted)"
                        >
                          {Math.round(maxCount * ratio)}
                        </text>
                      </g>
                    ))}
                    
                    {/* Area fill with gradient */}
                    <defs>
                      <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="var(--primary-color)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="var(--primary-color)" stopOpacity="0.05" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#lineGradient)" />
                    
                    {/* Line */}
                    <path
                      d={linePath}
                      fill="none"
                      stroke="var(--primary-color)"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Data points */}
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="5"
                          fill="white"
                          stroke="var(--primary-color)"
                          strokeWidth="3"
                          style={{ cursor: 'pointer' }}
                        >
                          <title>{`${new Date(p.date).toLocaleDateString()}: ${p.count} unique logins`}</title>
                        </circle>
                        {/* Show count labels only for 7-day view to avoid clutter */}
                        {selectedInterval === '7' && (
                          <text
                            x={p.x}
                            y={p.y - 12}
                            textAnchor="middle"
                            fontSize="12"
                            fontWeight="600"
                            fill="var(--primary-color)"
                          >
                            {p.count}
                          </text>
                        )}
                      </g>
                    ))}
                    
                    {/* X-axis labels */}
                    {points.filter((_, i) => {
                      const step = Math.ceil(data.length / 8);
                      return i % step === 0 || i === data.length - 1;
                    }).map((p, i) => (
                      <text
                        key={i}
                        x={p.x}
                        y={padding.top + chartHeight + 20}
                        textAnchor="middle"
                        fontSize="11"
                        fill="var(--text-muted)"
                        transform={`rotate(-45 ${p.x} ${padding.top + chartHeight + 20})`}
                      >
                        {new Date(p.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </text>
                    ))}
                    
                    {/* Axis labels */}
                    <text
                      x={padding.left + chartWidth / 2}
                      y={height - 5}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="600"
                      fill="var(--text-color)"
                    >
                      Date
                    </text>
                    <text
                      x={15}
                      y={padding.top + chartHeight / 2}
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="600"
                      fill="var(--text-color)"
                      transform={`rotate(-90 15 ${padding.top + chartHeight / 2})`}
                    >
                      Unique Logins
                    </text>
                  </g>
                );
              })()}
            </svg>
            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
              Hover over points to see exact counts • Showing unique users who logged in each day
            </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Inactive Users Tab Content */}
      {activeTab === 'inactive-users' && (
        <>
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
        </>
      )}

    </div>
  );
};

export default InactiveUsersReport;
