// frontend/src/components/DefaultAvatar.js
import React from 'react';
import './DefaultAvatar.css';

/**
 * DefaultAvatar - Gender-based placeholder avatar
 * 
 * Industry standard: Shows silhouette based on gender
 * Used when user has no profile photo
 * 
 * @param {string} gender - 'male', 'female', or undefined
 * @param {string} initials - User initials to display
 * @param {string} size - 'small', 'medium', 'large' (default: 'medium')
 */
const DefaultAvatar = ({ gender, initials = '?', size = 'medium' }) => {
  // Normalize gender value
  const normalizedGender = gender?.toLowerCase();
  const isMale = normalizedGender === 'male' || normalizedGender === 'm';
  const isFemale = normalizedGender === 'female' || normalizedGender === 'f';

  return (
    <div className={`default-avatar default-avatar-${size}`}>
      {/* Background gradient */}
      <div className="default-avatar-bg">
        {/* SVG Silhouette */}
        <svg 
          className="default-avatar-silhouette" 
          viewBox="0 0 100 120" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {isFemale ? (
            // Female silhouette - longer hair, softer features
            <g className="silhouette-female">
              {/* Head */}
              <ellipse cx="50" cy="35" rx="22" ry="24" />
              {/* Hair - longer, flowing */}
              <path d="M28 35 Q25 15 40 10 Q50 8 60 10 Q75 15 72 35 Q75 50 70 65 Q65 75 60 80 L55 70 Q58 55 55 40 Q52 30 50 30 Q48 30 45 40 Q42 55 45 70 L40 80 Q35 75 30 65 Q25 50 28 35" />
              {/* Body - shoulders */}
              <path d="M20 120 Q20 95 35 85 Q45 80 50 80 Q55 80 65 85 Q80 95 80 120" />
            </g>
          ) : isMale ? (
            // Male silhouette - shorter hair, broader shoulders
            <g className="silhouette-male">
              {/* Head */}
              <ellipse cx="50" cy="38" rx="20" ry="22" />
              {/* Hair - short */}
              <path d="M30 35 Q28 20 40 15 Q50 12 60 15 Q72 20 70 35 Q68 28 60 25 Q50 22 40 25 Q32 28 30 35" />
              {/* Body - broader shoulders */}
              <path d="M15 120 Q15 95 30 85 Q42 78 50 78 Q58 78 70 85 Q85 95 85 120" />
            </g>
          ) : (
            // Neutral silhouette - generic person
            <g className="silhouette-neutral">
              {/* Head */}
              <circle cx="50" cy="36" r="21" />
              {/* Body */}
              <path d="M18 120 Q18 95 32 85 Q44 79 50 79 Q56 79 68 85 Q82 95 82 120" />
            </g>
          )}
        </svg>

        {/* Initials overlay */}
        <div className="default-avatar-initials">
          {initials}
        </div>
      </div>
    </div>
  );
};

export default DefaultAvatar;
