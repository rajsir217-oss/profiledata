import React, { useState, useEffect, useCallback } from 'react';
import api from '../api';
import './AccessRequestManager.css';

const AccessRequestManager = ({ username, onRequestProcessed }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [customDuration, setCustomDuration] = useState(null);

  const loadPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/pii-requests/${username}/incoming?status_filter=pending`);
      setRequests(response.data.requests || []);
      setError('');
    } catch (err) {
      console.error('Error loading requests:', err);
      setError('Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    loadPendingRequests();
  }, [loadPendingRequests]);

  const handleApprove = async (request) => {
    setSelectedRequest(request);
    setCustomDuration(request.durationRequested);
    setResponseMessage('');
  };

  const confirmApprove = async () => {
    if (!selectedRequest) return;

    try {
      setProcessing(selectedRequest.id);
      await api.put(`/pii-requests/${selectedRequest.id}/approve?username=${username}`, {
        responseMessage,
        durationDays: customDuration || selectedRequest.durationRequested
      });

      // Remove from list
      setRequests(requests.filter(r => r.id !== selectedRequest.id));
      setSelectedRequest(null);
      setResponseMessage('');
      
      if (onRequestProcessed) {
        onRequestProcessed('approved', selectedRequest);
      }
    } catch (err) {
      console.error('Error approving request:', err);
      alert('Failed to approve request: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request) => {
    const message = prompt('Optional: Provide a reason for rejection');
    
    if (message === null) return; // User cancelled

    try {
      setProcessing(request.id);
      await api.put(`/pii-requests/${request.id}/reject?username=${username}`, {
        responseMessage: message
      });

      // Remove from list
      setRequests(requests.filter(r => r.id !== request.id));
      
      if (onRequestProcessed) {
        onRequestProcessed('rejected', request);
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
      alert('Failed to reject request: ' + (err.response?.data?.message || err.message));
    } finally {
      setProcessing(null);
    }
  };

  const getRequestAge = (createdAt) => {
    const now = new Date();
    const created = new Date(createdAt);
    const hours = Math.floor((now - created) / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;
    
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    return `${days} days ago`;
  };

  const getExpiryWarning = (expiresAt) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const hoursLeft = Math.ceil((expiry - now) / (1000 * 60 * 60));
    
    if (hoursLeft < 24) return `Expires in ${hoursLeft}h`;
    const daysLeft = Math.ceil(hoursLeft / 24);
    return `Expires in ${daysLeft}d`;
  };

  if (loading) {
    return (
      <div className="access-request-manager loading">
        <div className="spinner-border"></div>
        <p>Loading pending requests...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="access-request-manager error">
        <p>❌ {error}</p>
        <button onClick={loadPendingRequests} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="access-request-manager empty">
        <div className="empty-icon">📭</div>
        <h3>No Pending Requests</h3>
        <p>You don't have any image access requests waiting for your response.</p>
      </div>
    );
  }

  return (
    <div className="access-request-manager">
      <div className="manager-header">
        <h3>📬 Image Access Requests ({requests.length})</h3>
        <button onClick={loadPendingRequests} className="btn-refresh" title="Refresh">
          🔄
        </button>
      </div>

      <div className="requests-list">
        {requests.map((request) => (
          <div key={request._id} className="request-card">
            <div className="request-header">
              <div className="requester-info">
                <h4>{request.requesterUsername}</h4>
                <span className="request-type-badge">
                  {request.requestType === 'renewal' ? '⏰ Renewal' : '🆕 New'}
                </span>
              </div>
              <div className="request-meta">
                <span className="request-age">{getRequestAge(request.createdAt)}</span>
                <span className="expiry-warning">{getExpiryWarning(request.expiresAt)}</span>
              </div>
            </div>

            <div className="request-details">
              <div className="detail-item">
                <span className="label">📷 Images:</span>
                <span className="value">{request.imageIds.length}</span>
              </div>
              <div className="detail-item">
                <span className="label">⏱️ Duration:</span>
                <span className="value">{request.durationRequested} days</span>
              </div>
            </div>

            {request.message && (
              <div className="request-message">
                <div className="message-icon">💬</div>
                <p>{request.message}</p>
              </div>
            )}

            <div className="request-actions">
              <button
                onClick={() => handleReject(request)}
                className="btn btn-reject"
                disabled={processing === request._id}
              >
                ❌ Reject
              </button>
              <button
                onClick={() => handleApprove(request)}
                className="btn btn-approve"
                disabled={processing === request._id}
              >
                ✅ Approve
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Approval Modal */}
      {selectedRequest && (
        <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
          <div className="approval-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>✅ Approve Access Request</h3>
              <button className="close-btn" onClick={() => setSelectedRequest(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="approval-info">
                <p>
                  Approve access for <strong>{selectedRequest.requesterUsername}</strong> to 
                  view {selectedRequest.imageIds.length} {selectedRequest.imageIds.length === 1 ? 'photo' : 'photos'}.
                </p>
              </div>

              <div className="form-group">
                <label>Access Duration:</label>
                <select
                  value={customDuration}
                  onChange={(e) => setCustomDuration(parseInt(e.target.value))}
                  className="form-control"
                >
                  <option value="7">7 days (1 week)</option>
                  <option value="14">14 days (2 weeks)</option>
                  <option value="30">30 days (1 month)</option>
                  <option value="60">60 days (2 months)</option>
                  <option value="90">90 days (3 months)</option>
                  <option value="180">180 days (6 months)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Response Message (Optional):</label>
                <textarea
                  value={responseMessage}
                  onChange={(e) => setResponseMessage(e.target.value)}
                  className="form-control"
                  rows="3"
                  placeholder="Add a friendly message..."
                  maxLength="500"
                />
              </div>

              <div className="approval-notice">
                <div className="notice-icon">ℹ️</div>
                <div className="notice-text">
                  <strong>What happens next:</strong>
                  <ul>
                    <li>Access will be granted immediately</li>
                    <li>They'll receive a notification</li>
                    <li>Access will expire after selected duration</li>
                    <li>They can request renewal before expiry</li>
                  </ul>
                </div>
              </div>

              <div className="modal-actions">
                <button onClick={() => setSelectedRequest(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={confirmApprove} className="btn btn-primary" disabled={processing}>
                  {processing ? 'Processing...' : '✅ Confirm Approval'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccessRequestManager;
