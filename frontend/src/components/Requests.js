import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Requests = () => {
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('received');
  const navigate = useNavigate();

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      // Load received requests
      const receivedResponse = await api.get(`/api/users/pii-requests/${username}?type=received`);
      setReceivedRequests(receivedResponse.data.requests || []);

      // Load sent requests
      const sentResponse = await api.get(`/api/users/pii-requests/${username}?type=sent`);
      setSentRequests(sentResponse.data.requests || []);

    } catch (err) {
      console.error('Error loading requests:', err);
      setError('Failed to load requests');
    } finally {
      setLoading(false);
    }
  };

  const respondToRequest = async (requestId, response) => {
    try {
      const username = localStorage.getItem('username');
      await api.put(`/api/users/pii-request/${requestId}/respond`, {
        response,
        responder: username
      });

      // Refresh requests
      loadRequests();
    } catch (err) {
      console.error('Error responding to request:', err);
      setError('Failed to respond to request');
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>📨 PII Access Requests</h2>

      {/* Tabs */}
      <ul className="nav nav-tabs mb-4">
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'received' ? 'active' : ''}`}
            onClick={() => setActiveTab('received')}
          >
            Received ({receivedRequests.length})
          </button>
        </li>
        <li className="nav-item">
          <button
            className={`nav-link ${activeTab === 'sent' ? 'active' : ''}`}
            onClick={() => setActiveTab('sent')}
          >
            Sent ({sentRequests.length})
          </button>
        </li>
      </ul>

      {/* Received Requests */}
      {activeTab === 'received' && (
        <div>
          <h4>Requests to View My Information</h4>
          {receivedRequests.length === 0 ? (
            <p className="text-muted">No pending requests</p>
          ) : (
            receivedRequests.map(request => (
              <div key={request.id} className="card mb-3">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6>{request.requesterUsername} requested access to:</h6>
                      <p className="mb-2">
                        {request.requestType === 'contact_info' ? '📞 Contact Information' : '🖼️ Profile Images'}
                      </p>
                      {request.message && (
                        <p className="text-muted">Message: {request.message}</p>
                      )}
                      <small className="text-muted">
                        Requested on {new Date(request.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                    <div className="btn-group">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => respondToRequest(request.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => respondToRequest(request.id, 'reject')}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sent Requests */}
      {activeTab === 'sent' && (
        <div>
          <h4>My Sent Requests</h4>
          {sentRequests.length === 0 ? (
            <p className="text-muted">No sent requests</p>
          ) : (
            sentRequests.map(request => (
              <div key={request.id} className="card mb-3">
                <div className="card-body">
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <h6>Requested access to {request.requestedUsername}'s:</h6>
                      <p className="mb-2">
                        {request.requestType === 'contact_info' ? '📞 Contact Information' : '🖼️ Profile Images'}
                      </p>
                      {request.message && (
                        <p className="text-muted">Message: {request.message}</p>
                      )}
                      <small className={`text-${request.status === 'pending' ? 'warning' : request.status === 'approved' ? 'success' : 'danger'}`}>
                        Status: {request.status}
                      </small>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Requests;
