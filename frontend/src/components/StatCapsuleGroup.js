import React from 'react';
import StatCapsule from './StatCapsule';
import './StatCapsuleGroup.css';

/**
 * StatCapsuleGroup - Container for multiple StatCapsule components
 * 
 * Features:
 * - Vertical or horizontal layout
 * - Consistent spacing
 * - Responsive design
 * - Easy to add/remove capsules
 * 
 * Usage:
 * <StatCapsuleGroup
 *   stats={[
 *     { icon: '👁️', count: 42, variant: 'views', label: 'Views' },
 *     { icon: '❤️', count: 10, variant: 'likes', label: 'Likes' }
 *   ]}
 *   direction="vertical"
 * />
 */
const StatCapsuleGroup = ({ 
  stats = [],
  direction = 'vertical', // 'vertical' or 'horizontal'
  size = 'medium',
  gap = 'normal', // 'compact', 'normal', 'spacious'
  align = 'start' // 'start', 'center', 'end'
}) => {
  
  if (!stats || stats.length === 0) return null;

  return (
    <div className={`stat-capsule-group stat-capsule-group-${direction} gap-${gap} align-${align}`}>
      {stats.map((stat, index) => (
        <StatCapsule
          key={index}
          icon={stat.icon}
          count={stat.count}
          label={stat.label}
          variant={stat.variant}
          onClick={stat.onClick}
          tooltip={stat.tooltip}
          customColor={stat.customColor}
          animate={stat.animate}
          size={size}
        />
      ))}
    </div>
  );
};

export default StatCapsuleGroup;
