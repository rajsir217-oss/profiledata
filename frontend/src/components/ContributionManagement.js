import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './ContributionManagement.css';

const ContributionManagement = () => {
  const navigate = useNavigate();
  const [contributions, setContributions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalAmount: 0,
    totalCount: 0,
    oneTimeCount: 0,
    recurringCount: 0
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  });
  const [filter, setFilter] = useState('all'); // all, one_time, recurring

  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Contribution Management');
      navigate('/dashboard');
      return;
    }
    loadContributions();
  }, [navigate, filter]);

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

      {/* Filter Tabs */}
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

      {/* Donations Table */}
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
                    <span className="username">{contribution.username}</span>
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
    </div>
  );
};

export default ContributionManagement;
