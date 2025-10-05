import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Favorites = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/favorites/${username}`);
      setFavorites(response.data.favorites || []);
    } catch (err) {
      console.error('Error loading favorites:', err);
      setError('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  const removeFromFavorites = async (targetUsername) => {
    try {
      const username = localStorage.getItem('username');
      await api.delete(`/favorites/${targetUsername}?username=${encodeURIComponent(username)}`);
      setFavorites(favorites.filter(fav => fav.username !== targetUsername));
      setStatusMessage('✅ Removed from favorites!');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err) {
      console.error('Error removing from favorites:', err);
      setError('Failed to remove from favorites');
      setStatusMessage('❌ Failed to remove from favorites');
      setTimeout(() => setStatusMessage(''), 3000);
    }
  };

  if (loading) return <div className="text-center py-4"><div className="spinner-border"></div></div>;
  if (error) return <div className="alert alert-danger">{error}</div>;

  return (
    <div className="container mt-4">
      <h2>⭐ My Favorites</h2>

      {statusMessage && (
        <div className={`alert ${statusMessage.includes('❌') ? 'alert-danger' : 'alert-success'} alert-dismissible fade show`} role="alert">
          {statusMessage}
          <button type="button" className="btn-close" onClick={() => setStatusMessage('')}></button>
        </div>
      )}

      {favorites.length === 0 ? (
        <p className="text-muted">No favorites yet. Start browsing and add profiles you like!</p>
      ) : (
        <div className="row">
          {favorites.map(user => (
            <div key={user.username} className="col-md-6 col-lg-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">{user.firstName} {user.lastName}</h6>
                  <p className="card-text">
                    📍 {user.location}<br/>
                    🎓 {user.education}<br/>
                    💼 {user.occupation}
                  </p>
                  <div className="d-flex gap-2">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => navigate(`/profile/${user.username}`)}
                    >
                      View Profile
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => removeFromFavorites(user.username)}
                    >
                      Remove
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

export default Favorites;
