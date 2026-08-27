import React from 'react';
import './NotificationBanner.css';

const NotificationBanner = ({ type, message, onDismiss, onAction, actionText, dismissible = true }) => {
  if (!message) return null;

  const getBannerClass = () => {
    switch (type) {
      case 'grace_period':
        return 'warning';
      case 'expired':
        return 'error';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'grace_period':
        return '⏰';
      case 'expired':
        return '🔒';
      case 'info':
        return 'ℹ️';
      default:
        return 'ℹ️';
    }
  };

  return (
    <div className={`notification-banner ${getBannerClass()} ${!dismissible ? 'non-dismissible' : ''}`}>
      <span className="banner-icon">{getIcon()}</span>
      <div className="banner-content">
        <h4>{type === 'grace_period' ? 'Membership Expiring Soon' : 'Membership Expired'}</h4>
        <p>{message}</p>
      </div>
      {onAction && (
        <button className="action-button" onClick={onAction}>
          {actionText || 'Renew Now'}
        </button>
      )}
      {dismissible && onDismiss && (
        <button className="dismiss-button" onClick={onDismiss}>✕</button>
      )}
    </div>
  );
};

export default NotificationBanner;
