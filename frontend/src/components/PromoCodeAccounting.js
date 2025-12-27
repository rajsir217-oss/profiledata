import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './PromoCodeAccounting.css';

const PromoCodeAccounting = () => {
  const navigate = useNavigate();
  const [promoCodes, setPromoCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState(null);
  const [expandedUsersData, setExpandedUsersData] = useState(null);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userFilters, setUserFilters] = useState({ gender: 'all', state: 'all', isPaid: 'all' });
  const [expandedUser, setExpandedUser] = useState(null); // Username for expanded payment history
  const [userPaymentHistory, setUserPaymentHistory] = useState({}); // Cache payment history by username
  const [loadingPayments, setLoadingPayments] = useState(null); // Username currently loading
  
  // Yearly accounting state
  const [yearlySummary, setYearlySummary] = useState(null);
  const [selectedYear, setSelectedYear] = useState('all'); // 'all' or specific year
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(null); // Year to purge
  const [purging, setPurging] = useState(false);
  const [yearDetailModal, setYearDetailModal] = useState(null); // Year to show details
  const [yearPayments, setYearPayments] = useState([]); // Payments for detail modal
  const [loadingYearPayments, setLoadingYearPayments] = useState(false);

  useEffect(() => {
    loadPromoCodes();
    loadYearlySummary();
  }, []);

  const loadPromoCodes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setPromoCodes(data.promoCodes || []);
      } else {
        toastService.error('Failed to load promo codes');
      }
    } catch (err) {
      toastService.error('Error loading promo codes: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadYearlySummary = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/payments/yearly-summary`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setYearlySummary(data);
      }
    } catch (err) {
      console.error('Error loading yearly summary:', err);
    }
  };

  const handlePurgeYear = async (year) => {
    try {
      setPurging(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/payments/purge/${year}?archive=true`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        toastService.success(data.message);
        setShowPurgeConfirm(null);
        loadYearlySummary(); // Refresh data
        setUserPaymentHistory({}); // Clear cached payment history
      } else {
        const error = await response.json();
        toastService.error(error.detail || 'Failed to purge data');
      }
    } catch (err) {
      toastService.error('Error purging data: ' + err.message);
    } finally {
      setPurging(false);
    }
  };

  // Filter payment history by selected year
  const filterPaymentsByYear = (payments) => {
    if (selectedYear === 'all' || !payments) return payments;
    return payments.filter(p => {
      if (!p.createdAt) return false;
      const paymentYear = new Date(p.createdAt).getFullYear();
      return paymentYear === parseInt(selectedYear);
    });
  };

  // Load payments for a specific year (for detail modal)
  const loadYearPayments = async (year) => {
    try {
      setLoadingYearPayments(true);
      setYearDetailModal(year);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/payments/year/${year}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setYearPayments(data.payments || []);
      } else {
        toastService.error('Failed to load year payments');
        setYearPayments([]);
      }
    } catch (err) {
      toastService.error('Error loading year payments: ' + err.message);
      setYearPayments([]);
    } finally {
      setLoadingYearPayments(false);
    }
  };

  const toggleExpandedCode = async (code) => {
    if (expandedCode === code) {
      setExpandedCode(null);
      setExpandedUsersData(null);
      setUserFilters({ gender: 'all', state: 'all', isPaid: 'all' });
      return;
    }

    try {
      setLoadingUsers(true);
      setExpandedCode(code);
      setUserFilters({ gender: 'all', state: 'all', isPaid: 'all' });
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/promo-codes/users/${encodeURIComponent(code)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setExpandedUsersData(data);
      } else {
        toastService.error('Failed to load users');
        setExpandedCode(null);
      }
    } catch (err) {
      toastService.error('Error loading users: ' + err.message);
      setExpandedCode(null);
    } finally {
      setLoadingUsers(false);
    }
  };

  const getFilteredUsers = () => {
    if (!expandedUsersData?.users) return [];
    
    return expandedUsersData.users.filter(user => {
      if (userFilters.gender !== 'all' && user.gender !== userFilters.gender) return false;
      if (userFilters.state !== 'all' && user.state !== userFilters.state) return false;
      if (userFilters.isPaid === 'paid' && !user.isPaid) return false;
      if (userFilters.isPaid === 'free' && user.isPaid) return false;
      return true;
    });
  };

  const getUniqueStates = () => {
    if (!expandedUsersData?.users) return [];
    const states = [...new Set(expandedUsersData.users.map(u => u.state).filter(s => s && s !== '-'))];
    return states.sort();
  };

  const toggleUserPaymentHistory = async (username) => {
    // If clicking same user, collapse
    if (expandedUser === username) {
      setExpandedUser(null);
      return;
    }

    // Expand and load if not cached
    setExpandedUser(username);
    
    if (userPaymentHistory[username]) {
      return; // Already cached
    }

    try {
      setLoadingPayments(username);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/payments/user/${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUserPaymentHistory(prev => ({ ...prev, [username]: data }));
      } else {
        toastService.error('Failed to load payment history');
      }
    } catch (err) {
      toastService.error('Error loading payment history: ' + err.message);
    } finally {
      setLoadingPayments(null);
    }
  };

  // Calculate totals
  const totalMembers = promoCodes.reduce((sum, code) => sum + (code.registrations || code.currentUses || 0), 0);
  const totalRevenue = promoCodes.reduce((sum, code) => sum + (code.revenue || 0), 0);

  if (loading) {
    return (
      <div className="promo-accounting">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading promo code data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="promo-accounting">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-item">
          <span className="stat-value">{promoCodes.length}</span>
          <span className="stat-label">Promo Codes</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{totalMembers}</span>
          <span className="stat-label">Total Members</span>
        </div>
        <div className="stat-item highlight">
          <span className="stat-value">${totalRevenue.toFixed(2)}</span>
          <span className="stat-label">Total Revenue</span>
        </div>
      </div>

      {/* Yearly Accounting Section */}
      {yearlySummary && yearlySummary.years?.length > 0 && (
        <div className="yearly-accounting-section">
          <div className="yearly-header">
            <h3>📅 Yearly Breakdown</h3>
            <div className="year-filter">
              <label>Filter by Year:</label>
              <select 
                value={selectedYear} 
                onChange={(e) => setSelectedYear(e.target.value)}
                className="year-select"
              >
                <option value="all">All Years</option>
                {yearlySummary.years.map(y => (
                  <option key={y.year} value={y.year}>{y.year}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="yearly-cards">
            {yearlySummary.years.map(yearData => (
              <div 
                key={yearData.year} 
                className={`yearly-card ${selectedYear === String(yearData.year) ? 'selected' : ''}`}
                onClick={() => loadYearPayments(yearData.year)}
              >
                <div className="year-badge">{yearData.year}</div>
                <div className="year-stats">
                  <div className="year-stat">
                    <span className="ys-value">{yearData.totalPayments}</span>
                    <span className="ys-label">Payments</span>
                  </div>
                  <div className="year-stat">
                    <span className="ys-value">{yearData.uniqueUsers}</span>
                    <span className="ys-label">Users</span>
                  </div>
                  <div className="year-stat revenue">
                    <span className="ys-value">${yearData.totalRevenue.toFixed(2)}</span>
                    <span className="ys-label">Revenue</span>
                  </div>
                </div>
                {yearData.canPurge && (
                  <button 
                    className="btn-purge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPurgeConfirm(yearData.year);
                    }}
                    title="Archive and purge this year's data"
                  >
                    🗑️ Purge
                  </button>
                )}
              </div>
            ))}
          </div>
          
          {/* Grand Total */}
          <div className="yearly-grand-total">
            <span>Grand Total:</span>
            <span className="gt-payments">{yearlySummary.grandTotalPayments} payments</span>
            <span className="gt-revenue">${yearlySummary.grandTotalRevenue.toFixed(2)}</span>
          </div>
        </div>
      )}

      {/* Purge Confirmation Modal */}
      {showPurgeConfirm && (
        <div className="modal-overlay" onClick={() => setShowPurgeConfirm(null)}>
          <div className="purge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header warning">
              <h3>⚠️ Purge {showPurgeConfirm} Data</h3>
              <button className="modal-close" onClick={() => setShowPurgeConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p>Are you sure you want to purge all payment data for <strong>{showPurgeConfirm}</strong>?</p>
              <ul className="purge-info">
                <li>✅ Data will be <strong>archived</strong> before deletion</li>
                <li>✅ Archived data can be restored if needed</li>
                <li>⚠️ This action removes data from active reports</li>
              </ul>
              <p className="purge-warning">This is a standard accounting practice for closing fiscal years.</p>
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => setShowPurgeConfirm(null)}
                disabled={purging}
              >
                Cancel
              </button>
              <button 
                className="btn-danger" 
                onClick={() => handlePurgeYear(showPurgeConfirm)}
                disabled={purging}
              >
                {purging ? 'Purging...' : `🗑️ Purge ${showPurgeConfirm}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Year Detail Modal */}
      {yearDetailModal && (
        <div className="modal-overlay" onClick={() => setYearDetailModal(null)}>
          <div className="year-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>📅 {yearDetailModal} Payment Details</h3>
              <button className="modal-close" onClick={() => setYearDetailModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              {loadingYearPayments ? (
                <div className="loading-inline">Loading payments...</div>
              ) : (
                <>
                  <div className="year-detail-summary">
                    <div className="yds-stat">
                      <span className="yds-value">{yearPayments.length}</span>
                      <span className="yds-label">Total Payments</span>
                    </div>
                    <div className="yds-stat">
                      <span className="yds-value">{new Set(yearPayments.map(p => p.username)).size}</span>
                      <span className="yds-label">Unique Users</span>
                    </div>
                    <div className="yds-stat highlight">
                      <span className="yds-value">${yearPayments.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</span>
                      <span className="yds-label">Total Revenue</span>
                    </div>
                  </div>
                  
                  {yearPayments.length > 0 ? (
                    <div className="year-payments-table-container">
                      <table className="year-payments-table">
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th>USER</th>
                            <th>AMOUNT</th>
                            <th>TYPE</th>
                            <th>METHOD</th>
                            <th>PROMO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearPayments.map((payment, idx) => (
                            <tr key={payment.id || idx}>
                              <td>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}</td>
                              <td>
                                <span 
                                  className="username-link"
                                  onClick={() => {
                                    setYearDetailModal(null);
                                    navigate(`/profile/${payment.username}`);
                                  }}
                                >
                                  @{payment.username}
                                </span>
                              </td>
                              <td className="amount-cell">${(payment.amount || 0).toFixed(2)}</td>
                              <td>{payment.paymentType || 'one_time'}</td>
                              <td>{payment.paymentMethod || '-'}</td>
                              <td>{payment.promoCode || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="no-payments-message">
                      No payments found for {yearDetailModal}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="modal-footer">
              <button 
                className="btn-secondary" 
                onClick={() => {
                  setSelectedYear(String(yearDetailModal));
                  setYearDetailModal(null);
                }}
              >
                Filter by {yearDetailModal}
              </button>
              <button className="btn-primary" onClick={() => setYearDetailModal(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promo Code Cards */}
      <div className="promo-cards-container">
        {promoCodes.length === 0 ? (
          <div className="empty-state">
            <p>No promo codes found. Create promo codes in the Promo Code Manager.</p>
          </div>
        ) : (
          promoCodes.map((code) => (
            <div key={code.code} className={`promo-card ${expandedCode === code.code ? 'expanded' : ''}`}>
              {/* Summary Row */}
              <div 
                className="promo-card-header"
                onClick={() => toggleExpandedCode(code.code)}
              >
                <div className="expand-indicator">
                  {expandedCode === code.code ? '▼' : '▶'}
                </div>
                <div className="code-info">
                  <span className="code-name">{code.code}</span>
                  <span className="code-description">{code.name || ''}</span>
                </div>
                <div className="summary-flow">
                  <div className="flow-item members">
                    <span className="flow-value">{code.registrations || code.currentUses || 0}</span>
                    <span className="flow-label">members</span>
                  </div>
                  <span className="flow-arrow">→</span>
                  <div className="flow-item revenue">
                    <span className="flow-value">${(code.revenue || 0).toFixed(2)}</span>
                    <span className="flow-label">revenue</span>
                  </div>
                </div>
              </div>

              {/* Expanded Users Section */}
              {expandedCode === code.code && (
                <div className="promo-card-body">
                  {loadingUsers ? (
                    <div className="loading-users">Loading users...</div>
                  ) : expandedUsersData ? (
                    <>
                      {/* Filters */}
                      <div className="users-filters">
                        <select 
                          value={userFilters.gender} 
                          onChange={(e) => setUserFilters({...userFilters, gender: e.target.value})}
                          className="filter-select"
                        >
                          <option value="all">All Genders</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                        </select>
                        <select 
                          value={userFilters.state} 
                          onChange={(e) => setUserFilters({...userFilters, state: e.target.value})}
                          className="filter-select"
                        >
                          <option value="all">All States</option>
                          {getUniqueStates().map(state => (
                            <option key={state} value={state}>{state}</option>
                          ))}
                        </select>
                        <select 
                          value={userFilters.isPaid} 
                          onChange={(e) => setUserFilters({...userFilters, isPaid: e.target.value})}
                          className="filter-select"
                        >
                          <option value="all">All Members</option>
                          <option value="paid">💰 Paid Only</option>
                          <option value="free">🆓 Free Only</option>
                        </select>
                        <span className="filter-count">
                          Showing {getFilteredUsers().length} of {expandedUsersData.users?.length || 0}
                        </span>
                      </div>

                      {/* Users Table */}
                      {getFilteredUsers().length > 0 ? (
                        <div className="users-table-container">
                          <table className="users-table">
                            <thead>
                              <tr>
                                <th>USERNAME</th>
                                <th>GENDER</th>
                                <th>STATE</th>
                                <th>ACTIVATED</th>
                                <th>AMOUNT</th>
                                <th>PAYMENT</th>
                                <th>HISTORY</th>
                              </tr>
                            </thead>
                            <tbody>
                              {getFilteredUsers().map((user) => (
                                <React.Fragment key={user.username}>
                                  <tr className={expandedUser === user.username ? 'expanded-user-row' : ''}>
                                    <td>
                                      <span 
                                        className="username-link"
                                        onClick={() => navigate(`/profile/${user.username}`)}
                                        title="View profile"
                                      >
                                        @{user.username}
                                      </span>
                                      <br />
                                      <small className="user-fullname">{user.firstName} {user.lastName}</small>
                                    </td>
                                    <td>{user.gender || '-'}</td>
                                    <td>{user.state || '-'}</td>
                                    <td>
                                      {user.activatedAt ? new Date(user.activatedAt).toLocaleDateString() : '-'}
                                    </td>
                                    <td className={user.isPaid ? 'paid-cell' : 'free-cell'}>
                                      {user.isPaid ? `$${(user.amount || 0).toFixed(2)}` : 'Free'}
                                    </td>
                                    <td>{user.paymentMethod || '-'}</td>
                                    <td>
                                      <button 
                                        className={`btn-history ${expandedUser === user.username ? 'active' : ''}`}
                                        onClick={() => toggleUserPaymentHistory(user.username)}
                                        title={expandedUser === user.username ? 'Hide payment history' : 'View payment history'}
                                      >
                                        {expandedUser === user.username ? '▼' : '▶'} 💳
                                      </button>
                                    </td>
                                  </tr>
                                  {/* Inline Payment History Row */}
                                  {expandedUser === user.username && (
                                    <tr className="payment-history-row">
                                      <td colSpan="7">
                                        <div className="inline-payment-history">
                                          {loadingPayments === user.username ? (
                                            <div className="loading-inline">Loading payment history...</div>
                                          ) : userPaymentHistory[user.username] ? (
                                            <>
                                              <div className="payment-history-header">
                                                <span className="history-title">💳 Payment History {selectedYear !== 'all' && `(${selectedYear})`}</span>
                                                <span className="history-summary">
                                                  {filterPaymentsByYear(userPaymentHistory[user.username].payments)?.length || 0} payments • 
                                                  <strong> ${filterPaymentsByYear(userPaymentHistory[user.username].payments)?.reduce((sum, p) => sum + (p.amount || 0), 0).toFixed(2)}</strong> total
                                                </span>
                                              </div>
                                              {filterPaymentsByYear(userPaymentHistory[user.username].payments)?.length > 0 ? (
                                                <div className="payment-history-list">
                                                  {filterPaymentsByYear(userPaymentHistory[user.username].payments).map((payment, idx) => (
                                                    <div key={payment.id || idx} className="payment-history-item">
                                                      <span className="ph-amount">${(payment.amount || 0).toFixed(2)}</span>
                                                      <span className="ph-type">{payment.paymentType || 'one_time'}</span>
                                                      <span className="ph-method">{payment.paymentMethod || '-'}</span>
                                                      <span className="ph-date">
                                                        {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '-'}
                                                      </span>
                                                      {payment.promoCode && (
                                                        <span className="ph-promo">🎫 {payment.promoCode}</span>
                                                      )}
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : (
                                                <div className="no-payment-history">
                                                  No payment records yet
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <div className="no-payment-history">No payment data available</div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </React.Fragment>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="no-users">No users match the selected filters.</div>
                      )}
                    </>
                  ) : (
                    <div className="no-users">No users registered with this promo code yet.</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default PromoCodeAccounting;
