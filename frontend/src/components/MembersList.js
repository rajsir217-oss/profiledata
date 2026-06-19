import React, { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import './MembersList.css';

const MembersList = () => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (planFilter) params.set('plan', planFilter);
      if (paymentMethodFilter) params.set('payment_method', paymentMethodFilter);
      params.set('sort_by', sortBy);
      params.set('sort_order', sortOrder);
      params.set('page', page);
      params.set('limit', '50');

      const res = await fetch(`${getBackendUrl()}/api/admin/membership-transactions?${params}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        if (res.status === 403) { setError('Admin access required'); return; }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      if (data.success) {
        setTransactions(data.transactions || []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      }
    } catch (err) {
      setError('Failed to load membership transactions');
    } finally {
      setLoading(false);
    }
  }, [search, planFilter, paymentMethodFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchTransactions();
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  };

  const SortArrow = ({ field }) => {
    if (sortBy !== field) return <span className="sort-arrow">⇅</span>;
    return <span className="sort-arrow active">{sortOrder === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="members-list">
      <div className="members-list-header">
        <h2>Members</h2>
        <span className="members-count">{total} total transactions</span>
      </div>

      {/* Filters */}
      <div className="members-filters">
        <form onSubmit={handleSearch} className="members-search">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by username or full name..."
            className="search-input"
          />
          <button type="submit" className="search-btn">Search</button>
        </form>
        <div className="filter-group">
          <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}>
            <option value="">All Plans</option>
            <option value="premium">Premium</option>
            <option value="lifetime">Lifetime</option>
          </select>
          <select value={paymentMethodFilter} onChange={(e) => { setPaymentMethodFilter(e.target.value); setPage(1); }}>
            <option value="">All Methods</option>
            <option value="paypal">PayPal</option>
            <option value="clover">Clover</option>
          </select>
        </div>
      </div>

      {error && <div className="members-error">{error}</div>}

      {/* Table */}
      <div className="members-table-wrapper">
        <table className="members-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('username')}>
                Username <SortArrow field="username" />
              </th>
              <th>Full Name</th>
              <th onClick={() => handleSort('activatedAt')}>
                Activated <SortArrow field="activatedAt" />
              </th>
              <th onClick={() => handleSort('planId')}>
                Plan <SortArrow field="planId" />
              </th>
              <th onClick={() => handleSort('amount')}>
                Amount <SortArrow field="amount" />
              </th>
              <th onClick={() => handleSort('paymentMethod')}>
                Method <SortArrow field="paymentMethod" />
              </th>
              <th onClick={() => handleSort('createdAt')}>
                Paid <SortArrow field="createdAt" />
              </th>
              <th>Reference ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="members-loading">
                  <div className="spinner"></div>
                  <span>Loading...</span>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={8} className="members-empty">No membership transactions found.</td>
              </tr>
            ) : (
              transactions.map((tx) => (
                <tr key={tx._id}>
                  <td>
                    <a
                      href={`/profile/${tx.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="username-link"
                    >
                      {tx.username}
                    </a>
                  </td>
                  <td>{tx.fullName || '—'}</td>
                  <td>{formatDate(tx.activatedAt)}</td>
                  <td>
                    <span className={`plan-badge plan-${tx.planId}`}>
                      {tx.planId === 'lifetime' ? '💎 Lifetime' : '⭐ Premium'}
                    </span>
                  </td>
                  <td className="amount-cell">${tx.amount?.toFixed(2)}</td>
                  <td>
                    <span className={`method-badge method-${tx.paymentMethod}`}>
                      {tx.paymentMethod === 'paypal' ? 'PayPal' : 'Clover'}
                    </span>
                  </td>
                  <td>{formatDate(tx.createdAt)}</td>
                  <td className="ref-cell" title={tx.transactionId}>
                    {tx.transactionId ? tx.transactionId.substring(0, 16) + '...' : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="members-pagination">
          <button
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            ← Prev
          </button>
          <span>Page {page} of {totalPages}</span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default MembersList;
