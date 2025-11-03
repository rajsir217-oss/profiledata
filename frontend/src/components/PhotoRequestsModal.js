import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './PhotoRequestsModal.css';
import { formatRelativeTime } from '../utils/timeFormatter';

const PhotoRequestsModal = ({ isOpen, onClose, username, onRequestHandled }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen && username) {
      loadPendingRequests();
    }
  }, [isOpen, username]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/pii-requests/${username}/incoming?status_filter=pending`);
      setRequests(response.data.requests || []);
    } catch (err) {
      console.error('Error loading photo requests:', err);
      setError('Failed to load photo requests');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (request) => {
    setProcessingId(request.id);
    try {
      // For photo requests, we could navigate to PII Management for full image selection
      // For now, approve directly with permanent access
      await api.put(`/pii-requests/${request.id}/approve?username=${username}`, {});
      
      // Reload requests
      await loadPendingRequests();
      
      // Notify parent to refresh dashboard data
      if (onRequestHandled) {
        onRequestHandled();
      }
    } catch (err) {
      console.error('Error approving request:', err);
      setError('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (request) => {
    setProcessingId(request.id);
    try {
      await api.delete(`/pii-requests/${request.id}?username=${username}`);
      
      // Reload requests
      await loadPendingRequests();
      
      // Notify parent to refresh dashboard data
      if (onRequestHandled) {
        onRequestHandled();
      }
    } catch (err) {
      console.error('Error denying request:', err);
      setError('Failed to deny request');
    } finally {
      setProcessingId(null);
    }
  };

  const getRequestTypeIcon = (type) => {
    if (type === 'images' || type === 'photos') return '📷';
    if (type === 'linkedin_url') return '🔗';
    if (type === 'contact_info') return '📧';
    return '🔒';
  };

  const getRequestTypeLabel = (type) => {
    if (type === 'images' || type === 'photos') return 'Photos';
    if (type === 'linkedin_url') return 'LinkedIn Profile';
    if (type === 'contact_info') return 'Contact Info';
    return type;
  };

  const handleViewAll = () => {
    navigate('/pii-management');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="photo-requests-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🔒 Pending Photo Requests</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading requests...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadPendingRequests}>Try Again</button>
            </div>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🔒</span>
              <p>No pending requests</p>
              <small>You don't have any photo access requests at the moment</small>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <div className="requests-list">
              {requests.map((request) => {
                const requester = request.requesterProfile || {};
                const requestedTypes = Array.isArray(request.requestedInfo) 
                  ? request.requestedInfo 
                  : [request.requestType];

                return (
                  <div key={request.id} className="request-item">
                    <div className="request-avatar">
                      {requester.images && requester.images.length > 0 ? (
                        <img 
                          src={requester.images[0]} 
                          alt={requester.username}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="avatar-placeholder" 
                        style={{ display: requester.images && requester.images.length > 0 ? 'none' : 'flex' }}
                      >
                        {requester.username ? requester.username.charAt(0).toUpperCase() : '?'}
                      </div>
                    </div>

                    <div className="request-info">
                      <div className="request-name">
                        {requester.firstName || requester.username || 'Unknown'}
                      </div>
                      <div className="request-username">@{requester.username}</div>
                      <div className="request-details">
                        <span className="request-types">
                          {requestedTypes.map((type, idx) => (
                            <span key={idx} className="request-type-badge">
                              {getRequestTypeIcon(type)} {getRequestTypeLabel(type)}
                            </span>
                          ))}
                        </span>
                      </div>
                      {request.message && (
                        <div className="request-message">
                          💬 "{request.message}"
                        </div>
                      )}
                      <div className="request-timestamp">
                        {formatRelativeTime(request.requested_at)}
                      </div>
                    </div>

                    <div className="request-actions">
                      <button
                        className="btn-approve"
                        onClick={() => handleApprove(request)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? '...' : '✅ Approve'}
                      </button>
                      <button
                        className="btn-deny"
                        onClick={() => handleDeny(request)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? '...' : '❌ Deny'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !error && requests.length > 0 && (
          <div className="modal-footer">
            <button className="btn-view-all" onClick={handleViewAll}>
              View All in Photo Management →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoRequestsModal;
