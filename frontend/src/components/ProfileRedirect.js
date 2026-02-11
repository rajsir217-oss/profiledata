import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';

/**
 * ProfileRedirect - Resolves a short profileId to the full profile URL.
 * Used for shareable tiny URLs: /p/{profileId} → /profile/{username}
 */
const ProfileRedirect = () => {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    const resolve = async () => {
      try {
        const res = await api.get(`/resolve-profile/${profileId}`);
        if (res.data?.username) {
          navigate(`/profile/${res.data.username}`, { replace: true });
        } else {
          setError('Profile not found');
        }
      } catch {
        setError('Profile not found or link expired');
      }
    };
    resolve();
  }, [profileId, navigate]);

  if (error) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '60vh', flexDirection: 'column', gap: '16px',
        color: 'var(--text-color)'
      }}>
        <span style={{ fontSize: '48px' }}>🔗</span>
        <h2>{error}</h2>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '10px 24px', borderRadius: '8px', border: 'none',
            background: 'var(--primary-color)', color: 'white', cursor: 'pointer',
            fontSize: '14px', fontWeight: '600'
          }}
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', color: 'var(--text-muted)'
    }}>
      Loading profile...
    </div>
  );
};

export default ProfileRedirect;
