import React from 'react';
import './Logo.css';

const Logo = ({ variant = 'geometric', size = 'medium', showText = true, theme = 'light' }) => {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
    xlarge: 96
  };

  const height = sizeMap[size];
  const width = showText ? height * 4 : height;

  // Geometric/Minimalist Version - Three hearts forming levels (dating focus)
  const GeometricLogo = () => (
    <svg width={width} height={height} viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-geo-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="grad-geo-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#f472b6', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#c4b5fd', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="grad-geo-navbar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#f3f4f6', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#e5e7eb', stopOpacity: 1 }} />
        </linearGradient>
      </defs>
      
      {/* Three stacked hearts representing 3 levels of compatibility */}
      <g className="logo-icon">
        {/* Level 3 - Top heart (Mind) */}
        <path d="M 40 12 C 36 8, 30 8, 26 12 C 22 16, 22 22, 26 26 L 40 40 L 54 26 C 58 22, 58 16, 54 12 C 50 8, 44 8, 40 12 Z" 
          fill={`url(#grad-geo-${theme})`} 
          opacity="0.9" />
        
        {/* Level 2 - Middle heart (Body) */}
        <path d="M 40 32 C 36 28, 30 28, 26 32 C 22 36, 22 42, 26 46 L 40 60 L 54 46 C 58 42, 58 36, 54 32 C 50 28, 44 28, 40 32 Z" 
          fill={`url(#grad-geo-${theme})`} 
          opacity="0.7" />
        
        {/* Level 1 - Bottom heart (Spirit) */}
        <path d="M 40 52 C 36 48, 30 48, 26 52 C 22 56, 22 62, 26 66 L 40 80 L 54 66 C 58 62, 58 56, 54 52 C 50 48, 44 48, 40 52 Z" 
          fill={`url(#grad-geo-${theme})`} 
          opacity="0.5" />
      </g>
      
      {showText && (
        <text x="85" y="52" 
          className="logo-text"
          fill={theme === 'navbar' ? '#ffffff' : (theme === 'dark' ? '#f9fafb' : '#1f2937')}
          style={{ 
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
            fontSize: '36px',
            fontWeight: '700',
            letterSpacing: '2px'
          }}>
          L3V3L
        </text>
      )}
    </svg>
  );

  // Modern/Professional Version - Two people connecting with heart (dating focus)
  const ModernLogo = () => (
    <svg width={width} height={height} viewBox="0 0 200 80" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad-mod-light" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ec4899', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#8b5cf6', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#6366f1', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="grad-mod-dark" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#f472b6', stopOpacity: 1 }} />
          <stop offset="50%" style={{ stopColor: '#a78bfa', stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: '#c4b5fd', stopOpacity: 1 }} />
        </linearGradient>
        <linearGradient id="grad-mod-navbar" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#ffffff', stopOpacity: 0.95 }} />
          <stop offset="50%" style={{ stopColor: '#f9fafb', stopOpacity: 0.9 }} />
          <stop offset="100%" style={{ stopColor: '#f3f4f6', stopOpacity: 0.85 }} />
        </linearGradient>
      </defs>
      
      {/* Male and Female figures with connecting heart in the middle */}
      <g className="logo-icon">
        {/* Male figure (left) - Wider shoulders, straight body */}
        <circle cx="20" cy="28" r="7" 
          fill={`url(#grad-mod-${theme})`} 
          opacity="0.85" />
        {/* Male body - rectangular/straight */}
        <path d="M 20 35 L 12 40 L 12 62 L 16 62 L 16 50 L 20 50 L 24 50 L 24 62 L 28 62 L 28 40 L 20 35 Z"
          fill={`url(#grad-mod-${theme})`}
          opacity="0.85" />
        
        {/* Female figure (right) - Longer hair, dress shape */}
        <circle cx="60" cy="28" r="7" 
          fill={`url(#grad-mod-${theme})`} 
          opacity="0.85" />
        {/* Female hair (longer) */}
        <path d="M 53 28 Q 53 22, 60 22 Q 67 22, 67 28 L 67 32 Q 67 34, 65 34 L 55 34 Q 53 34, 53 32 Z"
          fill={`url(#grad-mod-${theme})`}
          opacity="0.85" />
        {/* Female body - dress/A-line shape */}
        <path d="M 60 35 L 54 42 L 50 62 L 70 62 L 66 42 Z"
          fill={`url(#grad-mod-${theme})`}
          opacity="0.85" />
        
        {/* Connecting heart in the middle */}
        <path d="M 40 45 C 38 42, 35 42, 33 45 C 31 48, 31 52, 33 54 L 40 61 L 47 54 C 49 52, 49 48, 47 45 C 45 42, 42 42, 40 45 Z" 
          fill={`url(#grad-mod-${theme})`} />
        
        {/* Three small dots representing 3 levels */}
        <circle cx="40" cy="68" r="2" fill={`url(#grad-mod-${theme})`} opacity="0.6" />
        <circle cx="46" cy="68" r="2" fill={`url(#grad-mod-${theme})`} opacity="0.8" />
        <circle cx="52" cy="68" r="2" fill={`url(#grad-mod-${theme})`} />
      </g>
      
      {showText && (
        <text x="85" y="52" 
          className="logo-text"
          fill={theme === 'navbar' ? '#ffffff' : (theme === 'dark' ? '#f9fafb' : '#1f2937')}
          style={{ 
            fontFamily: 'Plus Jakarta Sans, system-ui, sans-serif',
            fontSize: '36px',
            fontWeight: '600',
            letterSpacing: '1px'
          }}>
          L3V3L
        </text>
      )}
    </svg>
  );

  return (
    <div className={`logo-container logo-${variant} logo-${size}`}>
      {variant === 'geometric' ? <GeometricLogo /> : <ModernLogo />}
    </div>
  );
};

export default Logo;
