/**
 * MessageBadge Component
 * Shows a green badge on profile cards when there are unread messages
 */

import React, { useState, useEffect } from 'react';
import realtimeMessagingService from '../services/realtimeMessagingService';
import './MessageBadge.css';

const MessageBadge = ({ username, size = 'medium', showCount = true }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  
  useEffect(() => {
    // Subscribe to realtime updates
    const unsubscribe = realtimeMessagingService.subscribe((data) => {
      const count = realtimeMessagingService.getUnreadCount(username);
      setUnreadCount(count);
      setHasUnread(count > 0);
    });
    
    // Get initial count
    const count = realtimeMessagingService.getUnreadCount(username);
    setUnreadCount(count);
    setHasUnread(count > 0);
    
    return () => {
      unsubscribe();
    };
  }, [username]);
  
  if (!hasUnread) {
    return null;
  }
  
  // Size classes
  const sizeClass = `message-badge-${size}`;
  
  return (
    <div className={`message-badge ${sizeClass}`}>
      <div className="message-icon">
        💬
      </div>
      {showCount && unreadCount > 0 && (
        <div className="message-count">
          {unreadCount > 99 ? '99+' : unreadCount}
        </div>
      )}
    </div>
  );
};

export default MessageBadge;
