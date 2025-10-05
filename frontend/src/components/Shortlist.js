import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Shortlist = () => {
  const [shortlist, setShortlist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadShortlist();
  }, []);

  const loadShortlist = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/shortlist/${username}`);
      setShortlist(response.data.shortlist || []);
    } catch (err) {
      console.error('Error loading shortlist:', err);
      setError('Failed to load shortlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromShortlist = async (targetUsername) => {
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/shortlist/${targetUsername}?username=${encodeURIComponent(username)}`);
      setShortlist(shortlist.filter(item => item.username !== targetUsername));
      setStatusMessage('✅ Removed from shortlist!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing from shortlist:', err);
      setError('Failed to remove from shortlist');
      setStatusMessage('❌ Failed to remove from shortlist');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>📋 My Shortlist</h2>

      {statusMessage && (
        <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
          {statusMessage}
          <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
        </div>
      )}

      {shortlist.length === 0 ? (
        <p className="text-muted">No profiles in shortlist yet. Add profiles you're considering!</p>
      ) : (
        <div className="row">
          {shortlist.map(user => (
            <div key={user.username} className="col-md-6 col-lg-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">{user.firstName} {user.lastName}</h6>
                  <p className="card-text">
                    📍 {user.location}<br/>
                    🎓 {user.education}<br/>
                    💼 {user.occupation}
                  </p>
                  {user.notes && (
                    <p className="text-muted small">Note: {user.notes}</p>
                  )}
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/profile/${user.username}`)}
                    >
                      View Profile
                    </button>
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      onClick={() => navigate(`/messages?to=${user.username}`)}
                    >
                      Message
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Shortlist;
