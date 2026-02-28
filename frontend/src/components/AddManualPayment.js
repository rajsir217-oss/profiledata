import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './AddManualPayment.css';

const AddManualPayment = ({ onClose, onSuccess }) => {
  const [username, setUsername] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('venmo');
  const [paymentType, setPaymentType] = useState('one_time');
  const [notes, setNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [sendThankYou, setSendThankYou] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleEscKey = (e) => { if (e.key === 'Escape' && !submitting) onClose(); };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [onClose, submitting]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!username || username.length < 1 || selectedUser) {
      setSearchResults([]); setShowDropdown(false); return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${getBackendUrl()}/api/contributions/admin/search-users?q=${encodeURIComponent(username)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.data.success) {
          setSearchResults(res.data.users);
          setShowDropdown(res.data.users.length > 0);
        }
      } catch (err) { setSearchResults([]); }
      finally { setSearching(false); }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [username, selectedUser]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setUsername(`${user.username} (${user.firstName || ''} ${user.lastName || ''})`);
    setShowDropdown(false);
  };

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    if (selectedUser) setSelectedUser(null);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!selectedUser) { setError('Please select a valid user from the dropdown'); return; }
    if (!amount || parseFloat(amount) <= 0) { setError('Please enter a valid amount'); return; }
    setSubmitting(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        username: selectedUser.username,
        amount: parseFloat(amount),
        paymentMethod, paymentType, notes: notes || null,
        paymentDate: paymentDate || null,
        sendThankYou
      };
      const res = await axios.post(
        `${getBackendUrl()}/api/contributions/admin/add-manual`,
        payload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) { onSuccess(res.data); }
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to record payment');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-manual-payment-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💰 Record Manual Payment</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="amp-error">{error}</div>}
            <div className="amp-field" ref={dropdownRef}>
              <label>User *</label>
              <input type="text" value={username} onChange={handleUsernameChange}
                placeholder="Search by username or name..." autoFocus />
              {searching && <div className="amp-searching">Searching...</div>}
              {showDropdown && (
                <div className="amp-dropdown">
                  {searchResults.map((u) => (
                    <div key={u.username} className="amp-dropdown-item" onClick={() => handleSelectUser(u)}>
                      <span className="amp-user-name">{u.username}</span>
                      <span className="amp-user-fullname">{u.firstName} {u.lastName}</span>
                    </div>
                  ))}
                </div>
              )}
              {selectedUser && <div className="amp-selected-badge">✓ {selectedUser.username}</div>}
            </div>
            <div className="amp-field">
              <label>Amount ($) *</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00" min="0.01" step="0.01" />
            </div>
            <div className="amp-field">
              <label>Payment Method *</label>
              <div className="amp-method-options">
                {['venmo', 'paypal', 'zelle', 'cash', 'other'].map((m) => (
                  <button key={m} type="button"
                    className={`amp-method-btn ${paymentMethod === m ? 'active' : ''}`}
                    onClick={() => setPaymentMethod(m)}>
                    {m === 'venmo' && '📱'} {m === 'paypal' && '🅿️'} {m === 'zelle' && '⚡'}
                    {m === 'cash' && '💵'} {m === 'other' && '📋'}
                    {' '}{m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="amp-field">
              <label>Payment Type</label>
              <div className="amp-type-options">
                <button type="button" className={`amp-type-btn ${paymentType === 'one_time' ? 'active' : ''}`}
                  onClick={() => setPaymentType('one_time')}>One-Time</button>
                <button type="button" className={`amp-type-btn ${paymentType === 'recurring' ? 'active' : ''}`}
                  onClick={() => setPaymentType('recurring')}>Recurring</button>
              </div>
            </div>
            <div className="amp-field">
              <label>Payment Date (optional — leave blank for today)</label>
              <input type="datetime-local" value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)} />
            </div>
            <div className="amp-field">
              <label>Notes (optional)</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Venmo transfer confirmed" rows={2} />
            </div>
            <div className="amp-field amp-toggle-field">
              <label className="amp-toggle-label">
                <input type="checkbox" checked={sendThankYou}
                  onChange={(e) => setSendThankYou(e.target.checked)} />
                <span className="amp-toggle-text">Send thank you email</span>
              </label>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="amp-btn-cancel" onClick={onClose} disabled={submitting}>Cancel</button>
            <button type="submit" className="amp-btn-submit" disabled={submitting || !selectedUser || !amount}>
              {submitting ? 'Recording...' : '💰 Record Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddManualPayment;
