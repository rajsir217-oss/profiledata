import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './AdminRecurringContributions.css';

const AdminRecurringContributions = () => {
  const [contributions, setContributions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [usernameFilter, setUsernameFilter] = useState('');
  const [selectedContribution, setSelectedContribution] = useState(null);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contributionToDelete, setContributionToDelete] = useState(null);

  useEffect(() => {
    fetchContributions();
    fetchStats();
  }, [statusFilter, usernameFilter]);

  const fetchContributions = async () => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (usernameFilter) params.append('username', usernameFilter);
      
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions?${params}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setContributions(data.contributions || []);
      } else {
        setError('Failed to fetch contributions');
      }
    } catch (err) {
      setError('Error fetching contributions');
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions/stats`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChargeNow = async (contribution) => {
    setSelectedContribution(contribution);
    setChargeAmount(contribution.amount.toString());
    setShowChargeModal(true);
  };

  const executeCharge = async () => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions/${selectedContribution.id}/charge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            amount: parseFloat(chargeAmount),
            notes: 'Manual charge by admin'
          })
        }
      );
      
      if (response.ok) {
        setShowChargeModal(false);
        fetchContributions();
        fetchStats();
        toastService.success('Charge successful!');
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Charge failed');
      }
    } catch (err) {
      toastService.error('Error processing charge');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async (contributionId) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions/${contributionId}/pause`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        fetchContributions();
        fetchStats();
      }
    } catch (err) {
      toastService.error('Error pausing contribution');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async (contributionId) => {
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions/${contributionId}/resume`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        fetchContributions();
        fetchStats();
      }
    } catch (err) {
      toastService.error('Error resuming contribution');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async (contribution) => {
    setContributionToDelete(contribution);
    setShowDeleteModal(true);
  };

  const executeCancel = async () => {
    if (!contributionToDelete) return;
    
    setActionLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/admin/recurring-contributions/${contributionToDelete.id}/cancel`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (response.ok) {
        setShowDeleteModal(false);
        setContributionToDelete(null);
        fetchContributions();
        fetchStats();
      }
    } catch (err) {
      toastService.error('Error cancelling contribution');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#10b981';
      case 'paused': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div className="admin-recurring-loading">Loading...</div>;
  }

  return (
    <div className="admin-recurring-container">
      <h1>Recurring Contributions</h1>
      
      {/* Stats Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <h3>Total Active</h3>
            <p>{stats.total_active}</p>
          </div>
          <div className="stat-card">
            <h3>Monthly Revenue</h3>
            <p>${stats.monthly_revenue?.toFixed(2) || '0.00'}</p>
          </div>
          <div className="stat-card">
            <h3>Due Soon</h3>
            <p>{stats.due_soon_count}</p>
          </div>
          <div className="stat-card">
            <h3>Overdue</h3>
            <p>{stats.overdue_count}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Filter by username..."
          value={usernameFilter}
          onChange={(e) => setUsernameFilter(e.target.value)}
          className="filter-input"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Error */}
      {error && <div className="error-message">{error}</div>}

      {/* Contributions Table */}
      <div className="contributions-table">
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Amount</th>
              <th>Frequency</th>
              <th>Status</th>
              <th>Last Paid</th>
              <th>Next Payment</th>
              <th>Total</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {contributions.map((contrib) => (
              <tr key={contrib.id}>
                <td>{contrib.username}</td>
                <td>${contrib.amount}</td>
                <td>{contrib.recurring_days} days</td>
                <td>
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(contrib.status) }}
                  >
                    {contrib.status}
                  </span>
                </td>
                <td>{formatDate(contrib.last_paid_date)}</td>
                <td>{formatDate(contrib.next_payment_date)}</td>
                <td>${contrib.total_contributed?.toFixed(2) || '0.00'}</td>
                <td>
                  <div className="action-buttons">
                    {contrib.status === 'active' && (
                      <>
                        <button 
                          onClick={() => handleChargeNow(contrib)}
                          disabled={actionLoading}
                          className="btn-charge"
                        >
                          Charge Now
                        </button>
                        <button 
                          onClick={() => handlePause(contrib.id)}
                          disabled={actionLoading}
                          className="btn-pause"
                        >
                          Pause
                        </button>
                      </>
                    )}
                    {contrib.status === 'paused' && (
                      <button 
                        onClick={() => handleResume(contrib.id)}
                        disabled={actionLoading}
                        className="btn-resume"
                      >
                        Resume
                      </button>
                    )}
                    {contrib.status !== 'cancelled' && (
                      <button 
                        onClick={() => handleCancel(contrib)}
                        disabled={actionLoading}
                        className="btn-cancel"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charge Modal */}
      {showChargeModal && selectedContribution && (
        <div className="modal-overlay" onClick={() => setShowChargeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Charge {selectedContribution.username}</h2>
            <p>Default amount: ${selectedContribution.amount}</p>
            <input
              type="number"
              value={chargeAmount}
              onChange={(e) => setChargeAmount(e.target.value)}
              placeholder="Enter amount"
              step="0.01"
              min="1"
            />
            <div className="modal-actions">
              <button 
                onClick={executeCharge}
                disabled={actionLoading}
                className="btn-confirm"
              >
                {actionLoading ? 'Processing...' : 'Charge Now'}
              </button>
              <button 
                onClick={() => setShowChargeModal(false)}
                className="btn-cancel"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && contributionToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Confirm Cancellation</h2>
            <p>
              Are you sure you want to cancel the recurring contribution for <strong>{contributionToDelete.username}</strong>?
            </p>
            <p>
              Amount: ${contributionToDelete.amount}<br />
              Frequency: Every {contributionToDelete.recurring_days} days
            </p>
            <p className="warning-text">
              This action cannot be undone!
            </p>
            <div className="modal-actions">
              <button 
                onClick={executeCancel}
                disabled={actionLoading}
                className="btn-confirm btn-danger"
              >
                {actionLoading ? 'Cancelling...' : 'Yes, Cancel Contribution'}
              </button>
              <button 
                onClick={() => {
                  setShowDeleteModal(false);
                  setContributionToDelete(null);
                }}
                className="btn-cancel-modal"
                disabled={actionLoading}
              >
                Keep Active
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRecurringContributions;
