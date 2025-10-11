import React, { useState, useEffect } from 'react';
import onlineStatusService from '../services/onlineStatusService';
// Uses global .status-badge from styles/components.css

/**
 * OnlineStatusBadge Component
 * Displays a green/gray indicator showing if a user is online
 * Auto-updates via WebSocket events + 30s polling backup
 */
const OnlineStatusBadge = ({ username, size = 'small', showTooltip = true }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkStatus = React.useCallback(async () => {
    if (!username) return;

    try {
      const online = await onlineStatusService.isUserOnline(username);
      setIsOnline(online);
      setLoading(false);
    } catch (error) {
      console.error('Error checking online status:', error);
      setIsOnline(false);
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    // Initial check
    checkStatus();

    // Periodic check every 30 seconds (backup for missed WebSocket events)
    const statusCheckInterval = setInterval(() => {
      checkStatus();
    }, 30000);

    // Subscribe to real-time status changes via onlineStatusService
    const unsubscribe = onlineStatusService.subscribe((changedUsername, online) => {
      if (changedUsername === username) {
        setIsOnline(online);
        setLoading(false);
      }
    });

    return () => {
      clearInterval(statusCheckInterval);
      unsubscribe();
    };
  }, [username, checkStatus]);

  if (loading) {
    return null; // Don't show anything while loading
  }

  const statusClass = isOnline ? 'online' : 'offline';
  const tooltipText = isOnline ? 'Online' : 'Offline';

  return (
    <div
      className={`status-badge ${statusClass}`}
      style={{
        width: size === 'small' ? '14px' : size === 'large' ? '22px' : '18px',
        height: size === 'small' ? '14px' : size === 'large' ? '22px' : '18px'
      }}
      title={showTooltip ? tooltipText : ''}
      aria-label={tooltipText}
    />
  );
};

export default OnlineStatusBadge;
