import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import logger from '../utils/logger';
import './ContactRequestsModal.css';
import { formatRelativeTime } from '../utils/timeFormatter';

/**
 * ContactRequestsModal - Shows incoming contact/PII requests from other users
 * This is different from PhotoRequestsModal which shows OUTGOING requests
 */
const ContactRequestsModal = ({ isOpen, onClose, username, onRequestHandled }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const navigate = useNavigate();

  const loadIncomingRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch INCOMING PII requests - requests FROM others TO this user
      const response = await api.get(`/pii-requests/${username}/incoming?status_filter=pending`);
      const requests = response.data.requests || [];
      logger.debug('Incoming Contact Requests Response:', response.data);
      logger.debug('Number of incoming requests:', requests.length);
      setRequests(requests);
    } catch (err) {
      logger.error('Error loading incoming contact requests:', err);
      setError('Failed to load contact requests');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (isOpen && username) {
      loadIncomingRequests();
    }
  }, [isOpen, username, loadIncomingRequests]);

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

  const handleApproveRequest = async (request) => {
    setProcessingId(request.id);
    try {
      await api.put(`/pii-requests/${request.id}/approve?username=${username}`);
      
      // Reload requests
      await loadIncomingRequests();
      
      // Notify parent to refresh dashboard data
      if (onRequestHandled) {
        onRequestHandled();
      }
    } catch (err) {
      logger.error('Error approving request:', err);
      setError('Failed to approve request');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectRequest = async (request) => {
    setProcessingId(request.id);
    try {
      await api.put(`/pii-requests/${request.id}/reject?username=${username}`);
      
      // Reload requests
      await loadIncomingRequests();
      
      // Notify parent to refresh dashboard data
      if (onRequestHandled) {
        onRequestHandled();
      }
    } catch (err) {
      logger.error('Error rejecting request:', err);
      setError('Failed to reject request');
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

  const handleViewProfile = (requesterUsername) => {
    navigate(`/profile/${requesterUsername}`);
    onClose();
  };

  const handleViewAll = () => {
    navigate('/pii-management?tab=incoming');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="contact-requests-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📬 Contact Requests</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-subheader">
          <p>These users want to connect with you outside the platform</p>
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
              <button onClick={loadIncomingRequests}>Try Again</button>
            </div>
          )}

          {!loading && !error && requests.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">📬</span>
              <p>No pending contact requests</p>
              <small>When someone requests your contact info, it will appear here</small>
            </div>
          )}

          {!loading && !error && requests.length > 0 && (
            <div className="requests-list">
              {requests.map((request) => {
                // For incoming requests, show the requester (who sent the request)
                const requester = request.requesterProfile || {};
                const requestedTypes = Array.isArray(request.requestedInfo) 
                  ? request.requestedInfo 
                  : [request.requestType];

                return (
                  <div key={request.id} className="request-item">
                    <div 
                      className="request-avatar clickable"
                      onClick={() => handleViewProfile(requester.username)}
                      title="View profile"
                    >
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
                      <div 
                        className="request-name clickable"
                        onClick={() => handleViewProfile(requester.username)}
                      >
                        {requester.firstName || requester.username || 'Unknown'}
                        {requester.age && <span className="request-age">, {requester.age}</span>}
                      </div>
                      <div className="request-username">@{requester.username}</div>
                      {requester.location && (
                        <div className="request-location">📍 {requester.location}</div>
                      )}
                      <div className="request-details">
                        <span className="request-types">
                          Requesting: {requestedTypes.map((type, idx) => (
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
                        className="btn-approve"
                        onClick={() => handleApproveRequest(request)}
                        disabled={processingId === request.id}
                        title="Approve request"
                      >
                        {processingId === request.id ? '...' : '✓ Approve'}
                      </button>
                      <button
                        className="btn-reject"
                        onClick={() => handleRejectRequest(request)}
                        disabled={processingId === request.id}
                        title="Reject request"
                      >
                        {processingId === request.id ? '...' : '✕ Reject'}
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
              Manage All Requests →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactRequestsModal;
