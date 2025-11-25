import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './BrandBanner.css';
import { 
  loadWhitelabelConfig, 
  getBannerBackground, 
  getBannerTextColor 
} from '../utils/whitelabelConfig';

/**
 * BrandBanner Component
 * Displays customizable branding banner above the TopBar
 * Configuration loaded from whitelabel.json or whitelabel.ini
 */
const BrandBanner = () => {
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadConfig = async () => {
      const whitelabelConfig = await loadWhitelabelConfig();
      setConfig(whitelabelConfig);
      setLoading(false);
    };
    loadConfig();
  }, []);

  if (loading || !config) {
    return null; // Don't show banner while loading
  }

  const { branding, behavior, environment } = config;
  const bannerBg = getBannerBackground(config);
  const textColor = getBannerTextColor(config);

  const handleClick = () => {
    if (behavior.clickableHome && behavior.homeRoute) {
      navigate(behavior.homeRoute);
    }
  };

  const bannerStyle = {
    background: bannerBg,
    color: textColor,
    height: branding.bannerHeight,
    cursor: behavior.clickableHome ? 'pointer' : 'default'
  };

  return (
    <div 
      className={`brand-banner ${behavior.sticky ? 'sticky' : ''}`}
      style={bannerStyle}
      onClick={handleClick}
      role={behavior.clickableHome ? 'button' : 'banner'}
      tabIndex={behavior.clickableHome ? 0 : undefined}
      onKeyPress={(e) => {
        if (behavior.clickableHome && (e.key === 'Enter' || e.key === ' ')) {
          handleClick();
        }
      }}
    >
      <div className="brand-banner-content">
        {/* Logo */}
        {branding.showLogo && (
          <>
            {/* Text/Emoji Logo */}
            {branding.logoText && (
              <span className="brand-logo-text">{branding.logoText}</span>
            )}
            {/* Image Logo */}
            {branding.logoPath && (
              <img 
                src={branding.logoPath} 
                alt={`${branding.appName} logo`}
                className="brand-logo"
                onError={(e) => {
                  // Hide logo if image fails to load
                  e.target.style.display = 'none';
                }}
              />
            )}
          </>
        )}

        {/* App Name */}
        <div className="brand-text">
          <span className="brand-app-name">{branding.appName}</span>
          
          {/* Tagline */}
          {branding.showTagline && branding.tagline && (
            <span className="brand-tagline">{branding.tagline}</span>
          )}
        </div>

        {/* Environment Badge */}
        {environment.showBadge && environment.badgeText && (
          <span 
            className="environment-badge"
            style={{ backgroundColor: environment.badgeColor }}
          >
            {environment.badgeText}
          </span>
        )}
      </div>
    </div>
  );
};

export default BrandBanner;
