import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './ContributionManagement.css';
import './LoadMore.css';

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
    const [hasMoreContributions, setHasMoreContributions] = useState(true);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all'); // all, one_time, recurring
  const [activityFilter, setActivityFilter] = useState('all'); // all, popup_shown, closed, remind_later, proceed_to_payment
  const [searchFilter, setSearchFilter] = useState(''); // combined search for username, first name, last name
  const [activitySearchFilter, setActivitySearchFilter] = useState(''); // combined search for activity log
  const [thankYouSending, setThankYouSending] = useState({});
  const [thankYouSent, setThankYouSent] = useState({});
  const [toast, setToast] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, filter, activeTab, activityFilter, searchFilter, activitySearchFilter]);

  const loadContributions = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/stripe/admin/contributions?page=${page}&limit=20`;
      if (filter !== 'all') {
        url += `&payment_type=${filter}`;
      }
      if (searchFilter && searchFilter.trim()) {
        url += `&search=${encodeURIComponent(searchFilter.trim())}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        if (append) {
          setContributions(prev => [...prev, ...response.data.contributions]);
        } else {
          setContributions(response.data.contributions);
          setStats(response.data.stats);
        }
        setPagination(response.data.pagination);
        
        // Check if there are more rows to load
        const currentPage = response.data.pagination.page;
        const totalPages = response.data.pagination.totalPages;
        setHasMoreContributions(currentPage < totalPages);
      }
    } catch (err) {
      console.error('Error loading contributions:', err);
      setError('Failed to load contributions');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
    }
  };

  const loadActivities = async (page = 1, append = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const token = localStorage.getItem('token');
      
      let url = `${getBackendUrl()}/api/stripe/admin/contribution-activity?page=${page}&limit=20`;
      if (activityFilter !== 'all') {
        url += `&action_filter=${activityFilter}`;
      }
      if (activitySearchFilter && activitySearchFilter.trim()) {
        url += `&search=${encodeURIComponent(activitySearchFilter.trim())}`;
      }
      
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        if (append) {
          setActivities(prev => [...prev, ...response.data.activities]);
        } else {
          setActivities(response.data.activities);
          setActivityStats(response.data.stats || {});
        }
        setActivityPagination(response.data.pagination);
        
        // Check if there are more rows to load
        const currentPage = response.data.pagination.page;
        const totalPages = response.data.pagination.totalPages;
        setHasMoreActivities(currentPage < totalPages);
      }
    } catch (err) {
      console.error('Error loading activities:', err);
      setError('Failed to load activity log');
    } finally {
      setLoading(false);
      setIsLoadingMore(false);
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

      {/* User Filter - Only show for contributions tab */}
      {activeTab === 'contributions' && (
        <div className="user-filter-container">
          <div className="filter-row">
            <label htmlFor="search-filter" className="filter-label">Search:</label>
            <input
              id="search-filter"
              type="text"
              className="user-filter-input"
              placeholder="Search by username, first name, or last name..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
            />
            {searchFilter && (
              <button 
                className="clear-filter-btn"
                onClick={() => setSearchFilter('')}
                title="Clear search filter"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

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

      {/* User Filter - Only show for activity tab */}
      {activeTab === 'activity' && (
        <div className="user-filter-container">
          <div className="filter-row">
            <label htmlFor="activity-search-filter" className="filter-label">Search:</label>
            <input
              id="activity-search-filter"
              type="text"
              className="user-filter-input"
              placeholder="Search by username, first name, or last name..."
              value={activitySearchFilter}
              onChange={(e) => setActivitySearchFilter(e.target.value)}
            />
            {activitySearchFilter && (
              <button 
                className="clear-filter-btn"
                onClick={() => setActivitySearchFilter('')}
                title="Clear search filter"
              >
                ×
              </button>
            )}
          </div>
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
                    <th>Name</th>
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
                      <td className="name-cell">
                        {contribution.firstName || contribution.lastName ? 
                          `${contribution.firstName || ''} ${contribution.lastName || ''}`.trim() : 
                          '-'
                        }
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

          {/* Load More */}
          {contributions.length > 0 && (
            <div className="load-more-container">
              <div className="load-more-content">
                <div className="load-more-count">
                  Showing {contributions.length} of {pagination.total} rows
                </div>
                {hasMoreContributions && (
                  <button 
                    className="load-more-button"
                    onClick={() => loadContributions(pagination.page + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load {Math.min(20, pagination.total - contributions.length)} more [{contributions.length}/{pagination.total}]
                      </>
                    )}
                  </button>
                )}
                
                {!hasMoreContributions && contributions.length > 20 && (
                  <div className="load-more-complete">
                    ✓ All {pagination.total} records loaded
                  </div>
                )}
              </div>
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
                    <th>Name</th>
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
                      <td className="name-cell">
                        {activity.firstName || activity.lastName ? 
                          `${activity.firstName || ''} ${activity.lastName || ''}`.trim() : 
                          '-'
                        }
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

          {/* Load More */}
          {activities.length > 0 && (
            <div className="load-more-container">
              <div className="load-more-content">
                {hasMoreActivities && (
                  <button 
                    className="load-more-button"
                    onClick={() => loadActivities(activityPagination.page + 1, true)}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? (
                      <>
                        <div className="load-more-spinner"></div>
                        Loading...
                      </>
                    ) : (
                      <>
                        Load {Math.min(20, activityPagination.total - activities.length)} more [{activities.length}/{activityPagination.total}]
                      </>
                    )}
                  </button>
                )}
                
                {!hasMoreActivities && activities.length > 20 && (
                  <div className="load-more-complete">
                    ✓ All {activityPagination.total} records loaded
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

export default ContributionManagement;
