import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './ContributionManagement.css';

const ContributionManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('contributions'); // 'contributions' or 'activity'
  const [contributions, setContributions] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    oneTimeCount: 0,
    recurringCount: 0
  });
  const [activityStats, setActivityStats] = useState({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [activityPagination, setActivityPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [filter, setFilter] = useState('all'); // all, one_time, recurring
  const [activityFilter, setActivityFilter] = useState('all'); // all, popup_shown, closed, remind_later, proceed_to_payment

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Contribution Management');
      navigate('/dashboard');
      return;
    }
    if (activeTab === 'contributions') {
      loadContributions();
    } else {
      loadActivities();
    }
  }, [navigate, filter, activeTab, activityFilter]);

  const loadContributions = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/stripe/admin/contributions?page=${page}&limit=50`;
      if (filter !== 'all') {
        url += `&payment_type=${filter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setContributions(response.data.contributions);
        setStats(response.data.stats);
        setPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error loading contributions:', err);
      setError('Failed to load contributions');
    } finally {
      setLoading(false);
    }
  };

  const loadActivities = async (page = 1) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/stripe/admin/contribution-activity?page=${page}&limit=50`;
      if (activityFilter !== 'all') {
        url += `&action_filter=${activityFilter}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setActivities(response.data.activities);
        setActivityStats(response.data.stats || {});
        setActivityPagination(response.data.pagination);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      'popup_shown': '👁️ Popup Shown',
      'closed': '❌ Closed',
      'remind_later': '⏰ Remind Later',
      'proceed_to_payment': '💳 Proceeded to Payment',
      'contributed': '💝 Contributed'
    };
    return labels[action] || action;
  };

  const getActionClass = (action) => {
    const classes = {
      'popup_shown': 'action-shown',
      'closed': 'action-closed',
      'remind_later': 'action-remind',
      'proceed_to_payment': 'action-payment',
      'contributed': 'action-contributed'
    };
    return classes[action] || '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  return (
    <div className="contribution-management">
      <div className="page-header">
        <div className="header-content">
          <h1>💝 Contribution Management</h1>
          <p>View and manage all contributions</p>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">💰</div>
          <div className="stat-content">
            <div className="stat-value">{formatAmount(stats.totalAmount)}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalCount}</div>
            <div className="stat-label">Count</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💵</div>
          <div className="stat-content">
            <div className="stat-value">{stats.oneTimeCount}</div>
            <div className="stat-label">One-time</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🔄</div>
          <div className="stat-content">
            <div className="stat-value">{stats.recurringCount}</div>
            <div className="stat-label">Recurring</div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="main-tabs">
        <button 
          className={`main-tab ${activeTab === 'contributions' ? 'active' : ''}`}
          onClick={() => setActiveTab('contributions')}
        >
          💝 Contributions
        </button>
        <button 
          className={`main-tab ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => setActiveTab('activity')}
        >
          📋 Activity Log
        </button>
      </div>

      {/* Filter Tabs - Only show for contributions tab */}
      {activeTab === 'contributions' && (
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button 
            className={`filter-tab ${filter === 'one_time' ? 'active' : ''}`}
            onClick={() => setFilter('one_time')}
          >
            One-time
          </button>
          <button 
            className={`filter-tab ${filter === 'recurring' ? 'active' : ''}`}
            onClick={() => setFilter('recurring')}
          >
            Recurring
          </button>
        </div>
      )}

      {/* Activity Filter Tabs */}
      {activeTab === 'activity' && (
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${activityFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActivityFilter('all')}
          >
            All ({Object.values(activityStats).reduce((a, b) => a + b, 0) || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'popup_shown' ? 'active' : ''}`}
            onClick={() => setActivityFilter('popup_shown')}
          >
            👁️ Shown ({activityStats.popup_shown || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'closed' ? 'active' : ''}`}
            onClick={() => setActivityFilter('closed')}
          >
            ❌ Closed ({activityStats.closed || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'remind_later' ? 'active' : ''}`}
            onClick={() => setActivityFilter('remind_later')}
          >
            ⏰ Remind ({activityStats.remind_later || 0})
          </button>
          <button 
            className={`filter-tab ${activityFilter === 'proceed_to_payment' ? 'active' : ''}`}
            onClick={() => setActivityFilter('proceed_to_payment')}
          >
            💳 Payment ({activityStats.proceed_to_payment || 0})
          </button>
        </div>
      )}

      {/* Contributions Table */}
      {activeTab === 'contributions' && (
        <>
          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading contributions...</p>
              </div>
            ) : contributions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💝</div>
                <h3>No contributions yet</h3>
                <p>Contributions will appear here once users start contributing.</p>
              </div>
            ) : (
              <table className="contributions-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Stripe ID</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((contribution) => (
                    <tr key={contribution.id}>
                      <td className="user-cell">
                        <a 
                          href={`/profile/${contribution.username}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="username-link"
                        >
                          {contribution.username}
                        </a>
                      </td>
                      <td className="amount-cell">
                        <span className="amount">{formatAmount(contribution.amount)}</span>
                      </td>
                      <td>
                        <span className={`type-badge ${contribution.paymentType}`}>
                          {contribution.paymentType === 'recurring' ? '🔄 Monthly' : '💵 One-time'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${contribution.status}`}>
                          {contribution.status}
                        </span>
                      </td>
                      <td className="date-cell">
                        {formatDate(contribution.createdAt)}
                      </td>
                      <td className="stripe-id-cell">
                        <span className="stripe-id" title={contribution.stripeSessionId}>
                          {contribution.stripeSessionId ? contribution.stripeSessionId.slice(0, 20) + '...' : '-'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={pagination.page === 1}
                onClick={() => loadContributions(pagination.page - 1)}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <button 
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => loadContributions(pagination.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Activity Log Table */}
      {activeTab === 'activity' && (
        <>
          <div className="table-container">
            {loading ? (
              <div className="loading-state">
                <div className="spinner"></div>
                <p>Loading activity log...</p>
              </div>
            ) : activities.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <h3>No activity yet</h3>
                <p>User interactions with the contribution popup will appear here.</p>
              </div>
            ) : (
              <table className="contributions-table activity-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Action</th>
                    <th>Amount</th>
                    <th>Type</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((activity) => (
                    <tr key={activity.id}>
                      <td className="user-cell">
                        <a 
                          href={`/profile/${activity.username}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="username-link"
                        >
                          {activity.username}
                        </a>
                      </td>
                      <td>
                        <span className={`action-badge ${getActionClass(activity.action)}`}>
                          {getActionLabel(activity.action)}
                        </span>
                      </td>
                      <td className="amount-cell">
                        {activity.amount ? formatAmount(activity.amount) : '-'}
                      </td>
                      <td>
                        {activity.paymentType ? (
                          <span className="type-badge">
                            {activity.paymentType === 'monthly' ? '🔄 Monthly' : '💵 One-time'}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="date-cell">
                        {formatDate(activity.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Activity Pagination */}
          {activityPagination.totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={activityPagination.page === 1}
                onClick={() => loadActivities(activityPagination.page - 1)}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {activityPagination.page} of {activityPagination.totalPages}
              </span>
              <button 
                disabled={activityPagination.page >= activityPagination.totalPages}
                onClick={() => loadActivities(activityPagination.page + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ContributionManagement;
