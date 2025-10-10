/**
 * MessageBadge Component
 * Shows a green badge on profile cards when there are unread messages
 */

import React, { useState, useEffect } from 'react';
import socketService from '../services/socketService';
import './MessageBadge.css';

const MessageBadge = ({ username, size = 'medium', showCount = true }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [hasUnread, setHasUnread] = useState(false);
  
  useEffect(() => {
    // Update count function
    const updateCount = () => {
      const count = socketService.getUnreadCount(username);
      setUnreadCount(count);
      setHasUnread(count > 0);
    };
    
    // Listen for unread updates
    const handleUnreadUpdate = (data) => {
      if (data.username === username || !data.username) {
        updateCount();
      }
    };
    
    socketService.on('unread_update', handleUnreadUpdate);
    socketService.on('unread_counts_loaded', updateCount);
    
    // Get initial count
    updateCount();
    
    return () => {
      socketService.off('unread_update', handleUnreadUpdate);
      socketService.off('unread_counts_loaded', updateCount);
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
