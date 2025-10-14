import React from 'react';
import './StatCapsule.css';

/**
 * StatCapsule - Reusable badge/capsule component for displaying stats
 * 
 * Features:
 * - Icon + count display
 * - Multiple color variants
 * - Optional click handler
 * - Hover effects
 * - Tooltip support
 * 
 * Usage:
 * <StatCapsule icon="👁️" count={42} variant="views" label="Profile Views" />
 * <StatCapsule icon="❤️" count={10} variant="likes" label="Favorites" />
 */
const StatCapsule = ({ 
  icon, 
  count = 0, 
  label,
  variant = 'default', // 'default', 'views', 'likes', 'approvals', 'l3v3l', 'custom'
  onClick,
  tooltip,
  customColor,
  animate = false,
  size = 'medium' // 'small', 'medium', 'large'
}) => {
  
  const handleClick = (e) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  return (
    <div 
      className={`stat-capsule stat-capsule-${variant} stat-capsule-${size} ${onClick ? 'clickable' : ''} ${animate ? 'animate' : ''}`}
      onClick={handleClick}
      title={tooltip || label}
      style={customColor ? { backgroundColor: customColor } : {}}
    >
      <span className="stat-icon">{icon}</span>
      {count !== null && count !== undefined && (
        <span className="stat-count">{count}</span>
      )}
      {label && !count && count !== 0 && (
        <span className="stat-label">{label}</span>
      )}
    </div>
  );
};

export default StatCapsule;
