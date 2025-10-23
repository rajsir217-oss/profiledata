// frontend/src/components/ActivityLogs.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ActivityLogs.css';
import Toast from './Toast';

const ActivityLogs = () => {
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  
  // Filters
  const [filters, setFilters] = useState({
    username: '',
    action_type: 'all',
    target_username: '',
    start_date: '',
    end_date: '',
    page: 1,
    limit: 50
  });
  
  const [total, setTotal] = useState(0);
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  
  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      navigate('/dashboard');
    }
  }, [navigate]);
  
  // Load logs
  const loadLogs = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams();
      
      Object.entries(filters).forEach(([key, value]) => {
        if (value && value !== 'all') {
          queryParams.append(key, value);
        }
      });
      
      const response = await fetch(`http://localhost:8000/api/activity-logs?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.status === 401) {
        localStorage.clear();
        window.location.href = '/login';
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load logs');
      
      const data = await response.json();
      setLogs(data.logs);
      setTotal(data.total);
    } catch (error) {
      console.error('Error loading logs:', error);
      setToast({ type: 'error', message: 'Failed to load activity logs' });
    } finally {
      setLoading(false);
    }
  };
  
  // Load stats
  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/activity-logs/stats', {
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
    loadLogs();
    loadStats();
  }, [filters]);
  
  // Export logs
  const handleExport = async (format) => {
    try {
      const token = localStorage.getItem('token');
      const queryParams = new URLSearchParams({ ...filters, format });
      
      const response = await fetch(`http://localhost:8000/api/activity-logs/export?${queryParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) throw new Error('Failed to export');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `activity_logs_${new Date().toISOString()}.${format}`;
      a.click();
      
      setToast({ type: 'success', message: `Exported ${logs.length} logs as ${format.toUpperCase()}` });
    } catch (error) {
      setToast({ type: 'error', message: 'Export failed' });
    }
  };
  
  // Get action badge color
  const getActionBadge = (actionType) => {
    const badges = {
      user_login: { color: 'success', icon: '🔓' },
      user_logout: { color: 'info', icon: '🔒' },
      profile_viewed: { color: 'primary', icon: '👀' },
      profile_edited: { color: 'warning', icon: '✏️' },
      favorite_added: { color: 'danger', icon: '❤️' },
      message_sent: { color: 'info', icon: '💬' },
      search_performed: { color: 'secondary', icon: '🔍' },
      pii_request_sent: { color: 'warning', icon: '🔐' },
      user_status_changed: { color: 'danger', icon: '⚠️' }
    };
    
    const badge = badges[actionType] || { color: 'secondary', icon: '📝' };
    return { ...badge, text: actionType.replace(/_/g, ' ').toUpperCase() };
  };
  
  const totalPages = Math.ceil(total / filters.limit);
  
  return (
    <div className="activity-logs">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="logs-header">
        <h1>📊 Activity Logs</h1>
        <p className="subtitle">Monitor user activities and system events</p>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon">📈</div>
            <div className="stat-value">{stats.total_activities.toLocaleString()}</div>
            <div className="stat-label">Total Activities</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">👥</div>
            <div className="stat-value">{stats.unique_users}</div>
            <div className="stat-label">Unique Users</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⭐</div>
            <div className="stat-value">{Object.keys(stats.top_actions).length}</div>
            <div className="stat-label">Action Types</div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          placeholder="Username..."
          value={filters.username}
          onChange={(e) => setFilters({ ...filters, username: e.target.value, page: 1 })}
        />
        
        <select
          value={filters.action_type}
          onChange={(e) => setFilters({ ...filters, action_type: e.target.value, page: 1 })}
        >
          <option value="all">All Actions</option>
          <option value="user_login">Login</option>
          <option value="profile_viewed">Profile Viewed</option>
          <option value="favorite_added">Favorite Added</option>
          <option value="message_sent">Message Sent</option>
          <option value="search_performed">Search</option>
        </select>
        
        <input
          type="date"
          value={filters.start_date}
          onChange={(e) => setFilters({ ...filters, start_date: e.target.value, page: 1 })}
          placeholder="Start Date"
        />
        
        <input
          type="date"
          value={filters.end_date}
          onChange={(e) => setFilters({ ...filters, end_date: e.target.value, page: 1 })}
          placeholder="End Date"
        />
        
        <button onClick={() => setFilters({ username: '', action_type: 'all', target_username: '', start_date: '', end_date: '', page: 1, limit: 50 })}>
          Clear Filters
        </button>
        
        <div className="export-buttons">
          <button onClick={() => handleExport('json')}>Export JSON</button>
          <button onClick={() => handleExport('csv')}>Export CSV</button>
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
                <th>Timestamp</th>
                <th>User</th>
                <th>Action</th>
                <th>Target</th>
                <th>IP</th>
                <th>Duration</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const badge = getActionBadge(log.action_type);
                return (
                  <tr key={log._id}>
                    <td>{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="username">{log.username}</td>
                    <td>
                      <span className={`action-badge badge-${badge.color}`}>
                        {badge.icon} {badge.text}
                      </span>
                    </td>
                    <td>{log.target_username || '-'}</td>
                    <td className="ip-address">{log.ip_address || '-'}</td>
                    <td>{log.duration_ms ? `${log.duration_ms}ms` : '-'}</td>
                    <td>
                      <button className="btn-sm" onClick={() => alert(JSON.stringify(log.metadata, null, 2))}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      
      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={filters.page === 1}
          onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
        >
          Previous
        </button>
        <span>Page {filters.page} of {totalPages} ({total} total)</span>
        <button
          disabled={filters.page >= totalPages}
          onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
        >
          Next
        </button>
      </div>
    </div>
  );
};

export default ActivityLogs;
