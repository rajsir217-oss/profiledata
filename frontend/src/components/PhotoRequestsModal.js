import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import logger from '../utils/logger';
import './PhotoRequestsModal.css';
import { formatRelativeTime } from '../utils/timeFormatter';

const PhotoRequestsModal = ({ isOpen, onClose, username, onRequestHandled }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const loadPendingRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch outgoing PII requests - same as Dashboard uses
      // Filter by pending status only
      const response = await api.get(`/pii-requests/${username}/outgoing?status_filter=pending`);
      const requests = response.data.requests || [];
      logger.debug('Photo Requests Response:', response.data);
      logger.debug('Number of requests:', requests.length);
      logger.debug('First request:', requests[0]);
      setRequests(requests);
    } catch (err) {
      logger.error('Error loading photo requests:', err);
      setError('Failed to load photo requests');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (isOpen && username) {
      loadPendingRequests();
    }
  }, [isOpen, username, loadPendingRequests]);

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

  const handleCancelRequest = async (request) => {
    setProcessingId(request.id);
    try {
      // Cancel outgoing PII request - same as Dashboard uses
      const targetUsername = request.profileOwner?.username;
      if (!targetUsername) {
        setError('Invalid request data');
        return;
      }
      await api.delete(`/pii-requests/${username}/outgoing/${targetUsername}`);
      
      // Reload requests
      await loadPendingRequests();
      
      // Notify parent to refresh dashboard data
      if (onRequestHandled) {
        onRequestHandled();
      }
    } catch (err) {
      logger.error('Error cancelling request:', err);
      setError('Failed to cancel request');
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
          <h2>🔒 My Photo Requests</h2>
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
              <small>You haven't sent any photo access requests yet</small>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <div className="requests-list">
              {requests.map((request) => {
                // For outgoing requests, show the profile owner (who we sent the request to)
                const targetUser = request.profileOwner || {};
                const requestedTypes = Array.isArray(request.requestedInfo) 
                  ? request.requestedInfo 
                  : [request.requestType];

                return (
                  <div key={request.id} className="request-item">
                    <div className="request-avatar">
                      {targetUser.images && targetUser.images.length > 0 ? (
                        <img 
                          src={targetUser.images[0]} 
                          alt={targetUser.username}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="avatar-placeholder" 
                        style={{ display: targetUser.images && targetUser.images.length > 0 ? 'none' : 'flex' }}
                      >
                        {targetUser.username ? targetUser.username.charAt(0).toUpperCase() : '?'}
                      </div>
                    </div>

                    <div className="request-info">
                      <div className="request-name">
                        {targetUser.firstName || targetUser.username || 'Unknown'}
                      </div>
                      <div className="request-username">@{targetUser.username}</div>
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
                        {formatRelativeTime(request.requestedAt)}
                      </div>
                    </div>

                    <div className="request-actions">
                      <button
                        className="btn-cancel"
                        onClick={() => handleCancelRequest(request)}
                        disabled={processingId === request.id}
                      >
                        {processingId === request.id ? '...' : '❌ Cancel Request'}
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
