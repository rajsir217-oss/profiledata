import React from 'react';
import './VerificationBadges.css';

/**
 * VerificationBadges - Displays trust badges on user profiles
 * 
 * @param {Object} badges - User's badges object { idVerified, communityVerified, ... }
 * @param {string} size - "small" (search cards), "medium" (profile page), "large" (expanded)
 * @param {boolean} showLabels - Show text labels next to icons (default: false for small)
 */
const VerificationBadges = ({ badges, size = 'small', showLabels = false }) => {
  if (!badges) return null;
  
  const hasBadges = badges.idVerified || badges.communityVerified;
  if (!hasBadges) return null;
  
  return (
    <span className={`verification-badges verification-badges-${size}`}>
      {badges.idVerified && (
        <span 
          className="vbadge vbadge-id" 
          title="Identity verified via ID.me"
        >
          <span className="vbadge-icon">🛡️</span>
          {showLabels && <span className="vbadge-label">ID Verified</span>}
        </span>
      )}
      {badges.communityVerified && (
        <span 
          className="vbadge vbadge-community" 
          title="Referred by a verified community member"
        >
          <span className="vbadge-icon">🤝</span>
          {showLabels && <span className="vbadge-label">Community Verified</span>}
        </span>
      )}
    </span>
  );
};

export default VerificationBadges;
