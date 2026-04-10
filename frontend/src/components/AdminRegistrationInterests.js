import React, { useState, useEffect, useCallback } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './AdminRegistrationInterests.css';

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'var(--warning-color, #f59e0b)', icon: '⏳' },
  reference_validated: { label: 'Reference Validated', color: 'var(--success-color, #10b981)', icon: '✅' },
  idme_sent: { label: 'ID.me Sent', color: 'var(--info-color, #3b82f6)', icon: '🛡️' },
  idme_verified: { label: 'ID.me Verified', color: 'var(--success-color, #10b981)', icon: '🛡️' },
  idme_failed: { label: 'ID.me Failed', color: 'var(--danger-color, #ef4444)', icon: '❌' },
  invited: { label: 'Invited', color: 'var(--success-color, #10b981)', icon: '📧' },
  rejected: { label: 'Rejected', color: 'var(--danger-color, #ef4444)', icon: '🚫' }
};

const RESIDENCY_LABELS = {
  us_citizen: '🇺🇸 US Citizen',
  green_card: '🪪 Green Card'
};

const AdminRegistrationInterests = () => {
  const [interests, setInterests] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [activeFilter, setActiveFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);

  const adminApi = createApiInstance(getBackendUrl());

  const fetchInterests = useCallback(async () => {
    setLoading(true);
    try {
      const params = activeFilter ? `?status=${activeFilter}` : '';
      const res = await adminApi.get(`/api/registration-interest/admin/all${params}`);
      setInterests(res.data.interests || []);
      setTotal(res.data.total || 0);
      setStatusCounts(res.data.statusCounts || {});
    } catch (err) {
      logger.error('Failed to fetch interests:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  const handleAction = async (id, action, body = null) => {
    setActionLoading(prev => ({ ...prev, [id]: action }));
    try {
      await adminApi.put(`/api/registration-interest/${id}/${action}`, body);
      await fetchInterests();
      if (action === 'reject') {
        setShowRejectModal(null);
        setRejectReason('');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Action failed';
      logger.error(`Action ${action} failed:`, detail);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusBadge = (status) => {
    const config = STATUS_CONFIG[status] || { label: status, color: 'var(--text-muted)', icon: '?' };
    return (
      <span className="ari-status-badge" style={{ borderColor: config.color, color: config.color }}>
        {config.icon} {config.label}
      </span>
    );
  };

  const totalAll = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="ari-page">
      <div className="ari-header">
        <h1>📋 Registration Interests</h1>
        <p>Review and manage incoming registration interest forms</p>
      </div>

      {/* Status Filter Tabs */}
      <div className="ari-filters">
        <button
          className={`ari-filter-btn ${activeFilter === '' ? 'ari-filter-active' : ''}`}
          onClick={() => setActiveFilter('')}
        >
          All <span className="ari-filter-count">{totalAll}</span>
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            className={`ari-filter-btn ${activeFilter === key ? 'ari-filter-active' : ''}`}
            onClick={() => setActiveFilter(key)}
          >
            {cfg.icon} {cfg.label} <span className="ari-filter-count">{statusCounts[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Results */}
      {loading ? (
        <div className="ari-loading">Loading...</div>
      ) : interests.length === 0 ? (
        <div className="ari-empty">No registration interests found{activeFilter ? ` with status "${STATUS_CONFIG[activeFilter]?.label}"` : ''}.</div>
      ) : (
        <div className="ari-list">
          {interests.map(interest => (
            <div key={interest._id} className={`ari-card ${expandedId === interest._id ? 'ari-card-expanded' : ''}`}>
              <div className="ari-card-header" onClick={() => setExpandedId(expandedId === interest._id ? null : interest._id)}>
                <div className="ari-card-main">
                  <div className="ari-card-name">
                    {interest.firstName} {interest.lastName}
                    <span className="ari-residency">{RESIDENCY_LABELS[interest.residencyStatus] || interest.residencyStatus}</span>
                  </div>
                  <div className="ari-card-meta">
                    <span>📧 {interest.email}</span>
                    <span>📱 {interest.phone}</span>
                    <span>📅 {formatDate(interest.createdAt)}</span>
                  </div>
                </div>
                <div className="ari-card-right">
                  {getStatusBadge(interest.status)}
                  <span className="ari-expand-icon">{expandedId === interest._id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedId === interest._id && (
                <div className="ari-card-body">
                  {/* Referrer Info */}
                  <div className="ari-detail-section">
                    <h4>Referred By</h4>
                    {interest.referredBy ? (
                      <div className="ari-detail-grid">
                        <span><strong>Name:</strong> {interest.referredBy.firstName} {interest.referredBy.lastName}</span>
                        {interest.referredBy.phone && <span><strong>Phone:</strong> {interest.referredBy.phone}</span>}
                        {interest.referredBy.email && <span><strong>Email:</strong> {interest.referredBy.email}</span>}
                      </div>
                    ) : (
                      <p className="ari-no-data">No referrer provided</p>
                    )}
                  </div>

                  {/* Review Info */}
                  {interest.reviewedBy && (
                    <div className="ari-detail-section">
                      <h4>Review</h4>
                      <div className="ari-detail-grid">
                        <span><strong>Reviewed by:</strong> {interest.reviewedBy}</span>
                        <span><strong>Reviewed at:</strong> {formatDate(interest.reviewedAt)}</span>
                        {interest.verificationPath && <span><strong>Path:</strong> {interest.verificationPath}</span>}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {interest.reviewNotes && (
                    <div className="ari-detail-section">
                      <h4>Notes</h4>
                      <p className="ari-notes-text">{interest.reviewNotes}</p>
                    </div>
                  )}

                  {/* Actions — only for pending_review */}
                  {interest.status === 'pending_review' && (
                    <div className="ari-actions">
                      <button
                        className="ari-action-btn ari-btn-validate"
                        onClick={() => handleAction(interest._id, 'validate')}
                        disabled={!!actionLoading[interest._id]}
                      >
                        {actionLoading[interest._id] === 'validate' ? 'Validating...' : '✅ Validate Reference'}
                      </button>
                      <button
                        className="ari-action-btn ari-btn-idme"
                        onClick={() => handleAction(interest._id, 'send-idme')}
                        disabled={!!actionLoading[interest._id]}
                      >
                        {actionLoading[interest._id] === 'send-idme' ? 'Sending...' : '🛡️ Send ID.me'}
                      </button>
                      <button
                        className="ari-action-btn ari-btn-reject"
                        onClick={() => setShowRejectModal(interest._id)}
                        disabled={!!actionLoading[interest._id]}
                      >
                        🚫 Reject
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
          <div className="ari-reject-modal" onClick={e => e.stopPropagation()}>
            <div className="ari-reject-modal-header">
              <h2>🚫 Reject Interest</h2>
              <button className="ari-reject-modal-close" onClick={() => setShowRejectModal(null)}>✕</button>
            </div>
            <div className="ari-reject-modal-body">
              <label>Reason (optional)</label>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="Reason for rejection..."
                rows={3}
              />
            </div>
            <div className="ari-reject-modal-footer">
              <button className="ari-action-btn ari-btn-secondary" onClick={() => setShowRejectModal(null)}>Cancel</button>
              <button
                className="ari-action-btn ari-btn-reject"
                onClick={() => handleAction(showRejectModal, 'reject', { reason: rejectReason })}
                disabled={!!actionLoading[showRejectModal]}
              >
                {actionLoading[showRejectModal] === 'reject' ? 'Rejecting...' : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRegistrationInterests;
