import React, { useState, useEffect } from 'react';
import onlineStatusService from '../services/onlineStatusService';
import './OnlineStatusBadge.css';

/**
 * OnlineStatusBadge Component
 * Displays a green/gray indicator showing if a user is online
 * Auto-updates every 15 seconds for more responsive status changes
 */
const OnlineStatusBadge = ({ username, size = 'small', showTooltip = true }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!username) {
      setLoading(false);
      return;
    }

    // Initial check
    checkStatus();

    // Update every 15 seconds (reduced from 30s for more responsive updates)
    const interval = setInterval(checkStatus, 15000);

    // Subscribe to real-time status changes
    const unsubscribe = onlineStatusService.subscribe((changedUsername, online) => {
      if (changedUsername === username) {
        setIsOnline(online);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, [username]);

  const checkStatus = async () => {
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
  };

  if (loading) {
    return null; // Don't show anything while loading
  }

  const sizeClass = `status-badge-${size}`;
  const statusClass = isOnline ? 'online' : 'offline';
  const tooltipText = isOnline ? 'Online' : 'Offline';

  return (
    <div
      className={`online-status-badge ${sizeClass} ${statusClass}`}
      title={showTooltip ? tooltipText : ''}
      aria-label={tooltipText}
    />
  );
};

export default OnlineStatusBadge;
