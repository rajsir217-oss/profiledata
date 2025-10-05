import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const Exclusions = () => {
  const [exclusions, setExclusions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadExclusions();
  }, []);

  const loadExclusions = async () => {
    try {
      const username = localStorage.getItem('username');
      if (!username) {
        navigate('/login');
        return;
      }

      const response = await api.get(`/exclusions/${username}`);
      setExclusions(response.data.exclusions || []);
    } catch (err) {
      console.error('Error loading exclusions:', err);
      setError('Failed to load exclusions');
    } finally {
      setLoading(false);
    }
  };

  const removeExclusion = async (targetUsername) => {
    try {
      const currentUser = localStorage.getItem('username');
      if (!currentUser) {
        setError('Please login to perform this action');
        return;
      }

      await api.delete(`/exclusions/${targetUsername}?username=${encodeURIComponent(currentUser)}`);

      // Remove from local state
      setExclusions(prev => prev.filter(username => username !== targetUsername));

      console.log(`Successfully removed ${targetUsername} from exclusions`);
    } catch (err) {
      console.error('Error removing exclusion:', err);
      setError('Failed to remove exclusion');
    }
  };

  return (
    <div className="container mt-4">
      <h2>❌ My Exclusions</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {exclusions.length === 0 ? (
        <p className="text-muted">No excluded profiles. These profiles will be hidden from your search results.</p>
      ) : (
        <div className="row">
          {exclusions.map(username => (
            <div key={username} className="col-md-6 col-lg-4 mb-3">
              <div className="card">
                <div className="card-body">
                  <h6 className="card-title">{username}</h6>
                  <p className="card-text text-muted">This profile is excluded from search results</p>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => {
                      removeExclusion(username);
                    }}
                  >
                    Remove Exclusion
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Exclusions;
