import React, { useState } from 'react';
import api from '../api';
import './AccessRequestButton.css';

const AccessRequestButton = ({ profileUsername }) => {
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async () => {
    setRequesting(true);
    setError('');
    
    try {
      const requester = localStorage.getItem('username');
      
      if (!requester) {
        setError('You must be logged in to request contact info');
        setRequesting(false);
        return;
      }

      const data = new FormData();
      data.append('requester', requester);
      data.append('requested_user', profileUsername);
      if (message) {
        data.append('message', message);
      }
      
      await api.post('/access-request', data);
      setSuccess(true);
      setMessage('');
      
      setTimeout(() => {
        setShowModal(false);
        setSuccess(false);
      }, 2000);
    } catch (err) {
      console.error('Error sending request:', err);
      setError(err.response?.data?.detail || 'Failed to send request');
    } finally {
      setRequesting(false);
    }
  };

  const handleClose = () => {
    setShowModal(false);
    setSuccess(false);
    setError('');
    setMessage('');
  };

  return (
    <>
      <button 
        className="btn btn-primary btn-access-request" 
        onClick={() => setShowModal(true)}
      >
        🔓 Request Contact Info
      </button>
      
      {showModal && (
        <>
          <div className="modal-overlay" onClick={handleClose}></div>
          <div className="modal show d-block">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Request Contact Information</h5>
                  <button 
                    type="button" 
                    className="btn-close" 
                    onClick={handleClose}
                    disabled={requesting}
                  ></button>
                </div>
                <div className="modal-body">
                  {success ? (
                    <div className="alert alert-success">
                      <strong>✅ Request sent successfully!</strong>
                      <p className="mb-0 mt-2">
                        {profileUsername} will be notified and can approve or deny your request.
                      </p>
                    </div>
                  ) : (
                    <>
                      <p>
                        Send a request to view <strong>{profileUsername}</strong>'s contact information 
                        (email, phone number, exact location).
                      </p>
                      <div className="mb-3">
                        <label className="form-label">Message (Optional)</label>
                        <textarea
                          className="form-control"
                          placeholder="Introduce yourself or explain why you'd like to connect..."
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          rows={4}
                          maxLength={500}
                          disabled={requesting}
                        />
                        <small className="text-muted">{message.length}/500 characters</small>
                      </div>
                      {error && (
                        <div className="alert alert-danger">{error}</div>
                      )}
                    </>
                  )}
                </div>
                <div className="modal-footer">
                  <button 
                    className="btn btn-secondary" 
                    onClick={handleClose}
                    disabled={requesting}
                  >
                    {success ? 'Close' : 'Cancel'}
                  </button>
                  {!success && (
                    <button 
                      className="btn btn-primary" 
                      onClick={handleRequest} 
                      disabled={requesting}
                    >
                      {requesting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                          Sending...
                        </>
                      ) : (
                        '📤 Send Request'
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default AccessRequestButton;
