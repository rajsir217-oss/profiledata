import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

/**
 * ProfileCompletionChecker
 * 
 * Displays a banner prompting users to complete missing profile fields,
 * specifically birthMonth and birthYear which are required for age calculation
 * and proper matching.
 */
const ProfileCompletionChecker = ({ user }) => {
  const [showBanner, setShowBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user is missing required fields
    // User needs EITHER birthMonth+birthYear OR a valid dateOfBirth
    const hasBirthData = user && (
      (user.birthMonth && user.birthYear) || 
      user.dateOfBirth
    );
    
    if (user && !hasBirthData) {
      // Check if user dismissed this banner in this session
      const dismissedKey = `profile-completion-dismissed-${user.username}`;
      const isDismissed = sessionStorage.getItem(dismissedKey);
      
      if (!isDismissed) {
        setShowBanner(true);
      }
    } else {
      setShowBanner(false);
    }
  }, [user]);

  const handleDismiss = () => {
    setDismissed(true);
    setShowBanner(false);
    // Store dismissal in session storage (lasts until browser close)
    if (user) {
      sessionStorage.setItem(`profile-completion-dismissed-${user.username}`, 'true');
    }
  };

  if (!showBanner || dismissed) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '60px', // Below navbar
      left: '0',
      right: '0',
      background: 'linear-gradient(135deg, #ff6b6b 0%, #feca57 100%)',
      color: 'white',
      padding: '12px 20px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      zIndex: 999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      animation: 'slideDown 0.3s ease-out'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
        <span style={{ fontSize: '24px' }}>⚠️</span>
        <div>
          <strong style={{ fontSize: '15px', display: 'block', marginBottom: '2px' }}>
            Complete Your Profile
          </strong>
          <span style={{ fontSize: '13px', opacity: 0.95 }}>
            Your birth date is missing. Please add it to improve your matches and profile visibility.
          </span>
        </div>
      </div>
      
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        <Link
          to={`/profile/${user?.username}/edit`}
          style={{
            background: 'white',
            color: '#ff6b6b',
            padding: '8px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontWeight: '600',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            transition: 'transform 0.2s ease'
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
        >
          Complete Profile
        </Link>
        
        <button
          onClick={handleDismiss}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.3)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            e.target.style.borderColor = 'rgba(255, 255, 255, 0.5)';
          }}
        >
          Later
        </button>
      </div>

      <style>
        {`
          @keyframes slideDown {
            from {
              transform: translateY(-100%);
              opacity: 0;
            }
            to {
              transform: translateY(0);
              opacity: 1;
            }
          }

          @media (max-width: 768px) {
            .profile-completion-banner {
              padding: 10px 15px;
              flex-direction: column;
              gap: 12px;
              text-align: center;
            }
            
            .profile-completion-banner > div:first-child {
              flex-direction: column;
              text-align: center;
            }
            
            .profile-completion-banner button,
            .profile-completion-banner a {
              width: 100%;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ProfileCompletionChecker;
