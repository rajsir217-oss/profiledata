import React from 'react';
import './ProfileCreatorBadge.css';

/**
 * ProfileCreatorBadge Component
 * Displays a badge indicating who created the profile
 * Used in Messages, Profile pages, and User cards
 */

const CREATOR_TYPES = {
  me: {
    label: 'Myself',
    icon: '✋',
    tooltip: 'Profile created by the person themselves',
    color: '#22c55e' // Green
  },
  parent: {
    label: 'Parent',
    icon: '👨‍👩‍👦',
    tooltip: 'Profile created by parent or guardian',
    color: '#3b82f6' // Blue
  },
  other: {
    label: 'Relative/Friend',
    icon: '👥',
    tooltip: 'Profile created by sibling, friend, or relative',
    color: '#8b5cf6' // Purple
  }
};

const ProfileCreatorBadge = ({ 
  creatorType, 
  size = 'small', 
  showLabel = true,
  showIcon = true,
  position = 'inline' // 'inline' | 'overlay'
}) => {
  // Default to 'me' if no type provided or invalid type
  const creator = CREATOR_TYPES[creatorType] || CREATOR_TYPES.me;

  if (!creatorType || creatorType === 'me') {
    // Don't show badge for self-created profiles (most common case)
    return null;
  }

  const badgeClass = `profile-creator-badge profile-creator-badge-${size} profile-creator-badge-${position}`;

  return (
    <div 
      className={badgeClass}
      title={creator.tooltip}
      style={{ '--badge-color': creator.color }}
    >
      {showIcon && (
        <span className="badge-icon">{creator.icon}</span>
      )}
      {showLabel && (
        <span className="badge-label">{creator.label}</span>
      )}
    </div>
  );
};

export default ProfileCreatorBadge;
