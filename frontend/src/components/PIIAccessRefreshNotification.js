import React, { useState, useEffect } from 'react';
import { onPIIAccessChange } from '../utils/piiAccessEvents';

/**
 * Global PII Access Refresh Notification
 * 
 * Shows a toast notification when PII access changes
 * and prompts the user to refresh to see updated access status
 */
const PIIAccessRefreshNotification = () => {
  const [show, setShow] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const cleanup = onPIIAccessChange((detail) => {
      const { action, targetUsername } = detail;
      
      if (action === 'revoked') {
        setMessage(`Access revoked for ${targetUsername}. Refresh to update.`);
      } else if (action === 'granted') {
        setMessage(`Access granted to ${targetUsername}. Refresh to update.`);
      }
      
      setShow(true);
      
      // Auto-hide after 8 seconds
      setTimeout(() => setShow(false), 8000);
    });

    return cleanup;
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleDismiss = () => {
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#4CAF50',
      color: 'white',
      padding: '16px 20px',
      borderRadius: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
      zIndex: 9999,
      maxWidth: '400px',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      animation: 'slideInRight 0.3s ease-out'
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
          ✅ Access Updated
        </div>
        <div style={{ fontSize: '14px', opacity: 0.9 }}>
          {message}
        </div>
      </div>
      
      <button
        onClick={handleRefresh}
        style={{
          background: 'white',
          color: '#4CAF50',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '13px'
        }}
      >
        🔄 Refresh
      </button>
      
      <button
        onClick={handleDismiss}
        style={{
          background: 'transparent',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '20px',
          padding: '0',
          width: '24px',
          height: '24px'
        }}
      >
        ×
      </button>
    </div>
  );
};

export default PIIAccessRefreshNotification;
