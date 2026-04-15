import React, { useState, useEffect, useCallback } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import toastService from '../services/toastService';
import './AdminRegistrationInterests.css';

const STATUS_CONFIG = {
  pending_review: { label: 'Pending Review', color: 'var(--warning-color, #f59e0b)', icon: '⏳' },
  reference_validated: { label: 'Reference Validated', color: 'var(--success-color, #10b981)', icon: '✅' },
  idme_sent: { label: 'ID.me Sent', color: 'var(--info-color, #3b82f6)', icon: '🛡️' },
  idme_verified: { label: 'ID.me Verified', color: 'var(--success-color, #10b981)', icon: '🛡️' },
  idme_failed: { label: 'ID.me Failed', color: 'var(--danger-color, #ef4444)', icon: '❌' },
  invited: { label: 'Invited', color: 'var(--success-color, #10b981)', icon: '📧' },
  rejected: { label: 'Rejected', color: 'var(--danger-color, #ef4444)', icon: '🚫' },
  archived: { label: 'Archived', color: 'var(--text-muted, #6b7280)', icon: '📦' }
};

const RESIDENCY_LABELS = {
  us_citizen: '🇺🇸 US Citizen',
  green_card: '🪪 Green Card'
};

const HOW_DID_YOU_HEAR_LABELS = {
  friend_family: 'Friend or Family Member',
  community_event: 'Community Event / Gathering',
  social_media: 'Social Media',
  temple_organization: 'Temple / Cultural Organization',
  online_search: 'Online Search (Google, etc.)',
  word_of_mouth: 'Word of Mouth'
};

const AdminRegistrationInterests = () => {
  const [interests, setInterests] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusCounts, setStatusCounts] = useState({});
  const [activeFilter, setActiveFilter] = useState('pending_review');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(null);
  const [editingNotes, setEditingNotes] = useState(null);
  const [notesText, setNotesText] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(null);
  const [detailsMessage, setDetailsMessage] = useState('We would like to request additional information regarding your registration interest. Please provide your referred details so that we can process your request as soon as possible. If you have any questions, please contact admins. Thanks.');
  const [detailsChannel, setDetailsChannel] = useState('email');

  const adminApi = createApiInstance(getBackendUrl());

  const fetchInterests = useCallback(async () => {
    setLoading(true);
    try {
      let params = '';
      if (activeFilter) {
        params += `?status=${activeFilter}`;
      } else if (showArchived) {
        params += '?archived=true';
      }
      const res = await adminApi.get(`/api/registration-interest/admin/all${params}`);
      setInterests(res.data.interests || []);
      setTotal(res.data.total || 0);
      setStatusCounts(res.data.statusCounts || {});
    } catch (err) {
      logger.error('Failed to fetch interests:', err);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, showArchived]);

  useEffect(() => {
    fetchInterests();
  }, [fetchInterests]);

  useEffect(() => {
    // Reset active filter when switching to archived view
    if (showArchived) {
      setActiveFilter('');
    }
  }, [showArchived]);

  const handleAction = async (id, action, body = null) => {
    setActionLoading(prev => ({ ...prev, [id]: action }));
    try {
      const res = await adminApi.put(`/api/registration-interest/${id}/${action}`, body);
      const msg = res.data?.message || `${action} completed`;
      toastService.success(msg);
      await fetchInterests();
      if (action === 'reject') {
        setShowRejectModal(null);
        setRejectReason('');
      }
    } catch (err) {
      const detail = err.response?.data?.detail || 'Action failed';
      const status = err.response?.status;
      if (status === 409) {
        toastService.warning(detail);
        await fetchInterests();
      } else {
        toastService.error(detail);
      }
      logger.error(`Action ${action} failed:`, detail);
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }));
    }
  };

  const handleSaveNotes = async (id) => {
    try {
      await adminApi.put(`/api/registration-interest/${id}/notes`, { notes: notesText });
      toastService.success('Notes saved');
      setEditingNotes(null);
      await fetchInterests();
    } catch (err) {
      toastService.error('Failed to save notes');
    }
  };

  const handleArchive = async (id) => {
    try {
      await adminApi.put(`/api/registration-interest/${id}/archive`);
      toastService.success('Interest archived');
      await fetchInterests();
    } catch (err) {
      toastService.error('Failed to archive interest');
    }
  };

  const handleUnarchive = async (id) => {
    try {
      await adminApi.put(`/api/registration-interest/${id}/unarchive`);
      toastService.success('Interest restored to main view');
      await fetchInterests();
    } catch (err) {
      toastService.error('Failed to restore interest');
    }
  };

  const handleSendDetails = async (id) => {
    try {
      await adminApi.put(`/api/registration-interest/${id}/send-details-request`, {
        channel: detailsChannel,
        message: detailsMessage
      });
      toastService.success(`${detailsChannel.toUpperCase()} sent successfully`);
      setShowDetailsModal(null);
      setDetailsMessage('');
      setDetailsChannel('email');
      await fetchInterests();
    } catch (err) {
      toastService.error('Failed to send message');
    }
  };

  const EMOJI = {
    validate: '\u2705',
    shield: '\u{1F6E1}\uFE0F',
    reject: '\u{1F6AB}',
    email: '\u{1F4E7}',
    refresh: '\u{1F504}'
  };

  const getActionsForStatus = (interest) => {
    const s = interest.status;
    const id = interest._id;
    const isLoading = !!actionLoading[id];
    const loadingAction = actionLoading[id];
    const actions = [];

    if (s === 'pending_review') {
      actions.push(
        <button key="validate" className="ari-action-btn ari-btn-validate" onClick={() => handleAction(id, 'validate')} disabled={isLoading}>
          {loadingAction === 'validate' ? 'Validating...' : `${EMOJI.validate} Validate Reference`}
        </button>,
        <button key="idme" className="ari-action-btn ari-btn-idme" onClick={() => handleAction(id, 'send-idme')} disabled={isLoading}>
          {loadingAction === 'send-idme' ? 'Sending...' : `${EMOJI.shield} Send ID.me`}
        </button>,
        <button key="reject" className="ari-action-btn ari-btn-reject" onClick={() => setShowRejectModal(id)} disabled={isLoading}>
          {`${EMOJI.reject} Reject`}
        </button>
      );
    }

    if (s === 'reference_validated') {
      actions.push(
        <button key="send-inv" className="ari-action-btn ari-btn-invite" onClick={() => handleAction(id, 'send-invitation')} disabled={isLoading}>
          {loadingAction === 'send-invitation' ? 'Sending...' : `${EMOJI.email} Send Invitation`}
        </button>,
        <button key="switch-idme" className="ari-action-btn ari-btn-idme ari-btn-sm" onClick={() => handleAction(id, 'send-idme')} disabled={isLoading}>
          {loadingAction === 'send-idme' ? 'Switching...' : `${EMOJI.refresh} Switch to ID.me`}
        </button>,
        <button key="reject" className="ari-action-btn ari-btn-reject ari-btn-sm" onClick={() => setShowRejectModal(id)} disabled={isLoading}>
          {`${EMOJI.reject} Reject`}
        </button>
      );
    }

    if (s === 'idme_sent') {
      actions.push(
        <button key="switch-ref" className="ari-action-btn ari-btn-validate ari-btn-sm" onClick={() => handleAction(id, 'validate')} disabled={isLoading}>
          {loadingAction === 'validate' ? 'Switching...' : `${EMOJI.refresh} Switch to Validate Reference`}
        </button>,
        <button key="reject" className="ari-action-btn ari-btn-reject ari-btn-sm" onClick={() => setShowRejectModal(id)} disabled={isLoading}>
          {`${EMOJI.reject} Reject`}
        </button>
      );
    }

    if (s === 'idme_verified') {
      actions.push(
        <button key="send-inv" className="ari-action-btn ari-btn-invite" onClick={() => handleAction(id, 'send-invitation')} disabled={isLoading}>
          {loadingAction === 'send-invitation' ? 'Sending...' : `${EMOJI.email} Send Invitation`}
        </button>
      );
    }

    if (s === 'invited') {
      actions.push(
        <button key="archive" className="ari-action-btn ari-btn-secondary ari-btn-sm" onClick={() => handleArchive(id)} disabled={isLoading}>
          📦 Archive
        </button>
      );
    }

    if (s === 'idme_failed') {
      actions.push(
        <button key="switch-ref" className="ari-action-btn ari-btn-validate" onClick={() => handleAction(id, 'validate')} disabled={isLoading}>
          {loadingAction === 'validate' ? 'Validating...' : `${EMOJI.validate} Validate Reference Instead`}
        </button>,
        <button key="reopen" className="ari-action-btn ari-btn-secondary" onClick={() => handleAction(id, 'reopen')} disabled={isLoading}>
          {loadingAction === 'reopen' ? 'Reopening...' : `${EMOJI.refresh} Reopen`}
        </button>,
        <button key="reject" className="ari-action-btn ari-btn-reject ari-btn-sm" onClick={() => setShowRejectModal(id)} disabled={isLoading}>
          {`${EMOJI.reject} Reject`}
        </button>
      );
    }

    if (s === 'rejected') {
      actions.push(
        <button key="reopen" className="ari-action-btn ari-btn-secondary" onClick={() => handleAction(id, 'reopen')} disabled={isLoading}>
          {loadingAction === 'reopen' ? 'Reopening...' : `${EMOJI.refresh} Reopen for Review`}
        </button>
      );
    }

    if (interest.archived) {
      actions.push(
        <button key="unarchive" className="ari-action-btn ari-btn-validate ari-btn-sm" onClick={() => handleUnarchive(id)} disabled={isLoading}>
          📦 Restore
        </button>
      );
    }

    // Add send details button for all non-archived interests
    if (!interest.archived && s !== 'invited') {
      actions.push(
        <button key="send-details" className="ari-action-btn ari-btn-secondary ari-btn-sm" onClick={() => setShowDetailsModal(id)} disabled={isLoading}>
          📧 Request Details
        </button>
      );
    }

    // invited = terminal, no actions
    return actions;
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
          className={`ari-filter-btn ${activeFilter === '' && !showArchived ? 'ari-filter-active' : ''}`}
          onClick={() => { setActiveFilter(''); setShowArchived(false); }}
        >
          All <span className="ari-filter-count">{totalAll}</span>
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          key !== 'archived' && (
            <button
              key={key}
              className={`ari-filter-btn ${activeFilter === key && !showArchived ? 'ari-filter-active' : ''}`}
              onClick={() => { setActiveFilter(key); setShowArchived(false); }}
            >
              {cfg.icon} {cfg.label} <span className="ari-filter-count">{statusCounts[key] || 0}</span>
            </button>
          )
        ))}
        <button
          className={`ari-filter-btn ${showArchived ? 'ari-filter-active' : ''}`}
          onClick={() => { setActiveFilter(''); setShowArchived(true); }}
          style={{ marginLeft: 'auto' }}
        >
          📦 Archived
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div className="ari-loading">Loading...</div>
      ) : interests.length === 0 ? (
        <div className="ari-empty">
          {showArchived ? 'No archived interests' : `No registration interests found${activeFilter ? ` with status "${STATUS_CONFIG[activeFilter]?.label}"` : ''}.`}
        </div>
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
                  {interest.invitationInfo && (
                    <span className={`ari-inv-pill ${interest.invitationInfo.registeredUsername ? 'ari-inv-pill-registered' : 'ari-inv-pill-sent'}`}>
                      {interest.invitationInfo.registeredUsername ? '\u{2705} Registered' : '\u{1F4E7} Invited'}
                    </span>
                  )}
                  {getStatusBadge(interest.status)}
                  <span className="ari-expand-icon">{expandedId === interest._id ? '▲' : '▼'}</span>
                </div>
              </div>

              {expandedId === interest._id && (
                <div className="ari-card-body">
                  {/* Invitation Status Banner — shows if invitation exists for this email */}
                  {interest.invitationInfo && (
                    <div className={`ari-invitation-banner ${interest.invitationInfo.registeredUsername ? 'ari-invitation-registered' : ''}`}>
                      <span className="ari-invitation-banner-icon">
                        {interest.invitationInfo.registeredUsername ? '\u{2705}' : '\u{1F4E7}'}
                      </span>
                      <div className="ari-invitation-banner-text">
                        <strong>
                          {interest.invitationInfo.registeredUsername
                            ? `Registered as "${interest.invitationInfo.registeredUsername}"`
                            : interest.invitationInfo.emailStatus === 'sent' || interest.invitationInfo.emailStatus === 'delivered'
                              ? 'Invitation Sent'
                              : interest.invitationInfo.emailStatus === 'accepted'
                                ? 'Invitation Accepted'
                                : 'Invitation Pending'}
                        </strong>
                        <span>
                          {interest.invitationInfo.sentAt
                            ? `Sent on ${formatDate(interest.invitationInfo.sentAt)}`
                            : `Created on ${formatDate(interest.invitationInfo.createdAt)}`}
                          {' \u2022 '}Email status: {interest.invitationInfo.emailStatus}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Referrer Info */}
                  <div className="ari-detail-section">
                    <h4>
                      Referred By
                      {interest.referrerVerification?.verified && (
                        <span className="ari-ref-verified">✅ System Verified</span>
                      )}
                      {interest.referredBy && interest.referrerVerification && !interest.referrerVerification.verified && (
                        <span className="ari-ref-unverified">⚠️ Not Verified</span>
                      )}
                    </h4>
                    {interest.referredBy ? (
                      <>
                        <div className="ari-detail-grid">
                          <span><strong>Name:</strong> {interest.referredBy.firstName} {interest.referredBy.lastName}</span>
                          {interest.referredBy.phone && <span><strong>Phone:</strong> {interest.referredBy.phone}</span>}
                          {interest.referredBy.email && <span><strong>Email:</strong> {interest.referredBy.email}</span>}
                        </div>
                        {interest.referrerVerification?.verified && (
                          <div className="ari-ref-match-info">
                            Matched to member: <strong>{interest.referrerVerification.matchedName}</strong>
                            {interest.referrerVerification.matchedUsername && (
                              <span> (@{interest.referrerVerification.matchedUsername})</span>
                            )}
                          </div>
                        )}
                        {interest.referredBy && interest.referrerVerification && !interest.referrerVerification.verified && interest.referrerVerification.reason === 'no_match' && (
                          <div className="ari-ref-no-match">
                            No matching member found in the system
                          </div>
                        )}
                        {interest.referredBy && interest.referrerVerification && !interest.referrerVerification.verified && interest.referrerVerification.reason === 'insufficient_info' && (
                          <div className="ari-ref-no-match">
                            Insufficient referrer info to verify (need name + phone or email)
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="ari-no-data">No referrer provided</p>
                    )}
                  </div>

                  {/* How Did You Hear */}
                  {interest.howDidYouHear && (
                    <div className="ari-detail-section">
                      <h4>How Did You Hear About Us</h4>
                      <p className="ari-detail-value">{HOW_DID_YOU_HEAR_LABELS[interest.howDidYouHear] || interest.howDidYouHear}</p>
                    </div>
                  )}

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

                  {/* Notes Section — always visible with edit capability */}
                  <div className="ari-detail-section">
                    <h4>
                      Notes
                      {interest.status !== 'invited' && editingNotes !== interest._id && (
                        <button
                          className="ari-notes-edit-btn"
                          onClick={() => { setEditingNotes(interest._id); setNotesText(interest.reviewNotes || ''); }}
                        >
                          {interest.reviewNotes ? 'Edit' : '+ Add'}
                        </button>
                      )}
                    </h4>
                    {editingNotes === interest._id ? (
                      <div className="ari-notes-editor">
                        <textarea
                          value={notesText}
                          onChange={e => setNotesText(e.target.value)}
                          placeholder="Admin notes..."
                          rows={3}
                        />
                        <div className="ari-notes-editor-actions">
                          <button className="ari-action-btn ari-btn-validate ari-btn-sm" onClick={() => handleSaveNotes(interest._id)}>Save</button>
                          <button className="ari-action-btn ari-btn-secondary ari-btn-sm" onClick={() => setEditingNotes(null)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="ari-notes-text">{interest.reviewNotes || 'No notes yet'}</p>
                    )}
                  </div>

                  {/* Contextual Actions */}
                  {getActionsForStatus(interest).length > 0 && (
                    <div className="ari-actions">
                      {getActionsForStatus(interest)}
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

      {/* Send Details Request Modal */}
      {showDetailsModal && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(null)}>
          <div className="ari-details-modal" onClick={e => e.stopPropagation()}>
            <div className="ari-details-modal-header">
              <h2>📧 Request More Details</h2>
              <button className="ari-details-modal-close" onClick={() => setShowDetailsModal(null)}>✕</button>
            </div>
            <div className="ari-details-modal-body">
              <div className="ari-details-channel-selector">
                <label>Send via:</label>
                <div className="ari-details-channel-options">
                  <button
                    className={`ari-details-channel-btn ${detailsChannel === 'email' ? 'ari-details-channel-active' : ''}`}
                    onClick={() => setDetailsChannel('email')}
                  >
                    📧 Email
                  </button>
                  <button
                    className={`ari-details-channel-btn ${detailsChannel === 'sms' ? 'ari-details-channel-active' : ''}`}
                    onClick={() => setDetailsChannel('sms')}
                  >
                    📱 SMS
                  </button>
                </div>
              </div>
              <label>Message</label>
              <textarea
                value={detailsMessage}
                onChange={e => setDetailsMessage(e.target.value)}
                placeholder="Request additional information from the user..."
                rows={5}
              />
            </div>
            <div className="ari-details-modal-footer">
              <button className="ari-action-btn ari-btn-secondary" onClick={() => setShowDetailsModal(null)}>Cancel</button>
              <button
                className="ari-action-btn ari-btn-invite"
                onClick={() => handleSendDetails(showDetailsModal)}
                disabled={!!actionLoading[showDetailsModal] || !detailsMessage.trim()}
              >
                Send {detailsChannel === 'email' ? 'Email' : 'SMS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminRegistrationInterests;
