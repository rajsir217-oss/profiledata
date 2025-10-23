import React, { useState, useEffect } from 'react';
import api from '../api';
import { getDisplayName } from '../utils/userDisplay';
import OnlineStatusBadge from './OnlineStatusBadge';
import './MessagesDropdown.css';

/**
 * MessagesDropdown Component
 * Shows recent conversations with unread counts and online status
 */
const MessagesDropdown = ({ isOpen, onClose, onOpenMessage }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    if (!currentUsername) return;

    setLoading(true);
    try {
      const response = await api.get(`/messages/recent/${currentUsername}?limit=10`);
      setConversations(response.data.conversations || []);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const truncateMessage = (message, maxLength = 40) => {
    if (!message) return '';
    return message.length > maxLength 
      ? message.substring(0, maxLength) + '...' 
      : message;
  };

  const handleConversationClick = (conversation) => {
    onOpenMessage({
      username: conversation.username,
      firstName: conversation.firstName,
      lastName: conversation.lastName,
      images: conversation.avatar ? [conversation.avatar] : []
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="messages-dropdown-backdrop" onClick={onClose} />
      
      {/* Dropdown */}
      <div className="messages-dropdown">
        <div className="messages-dropdown-header">
          <h3>Recent Messages</h3>
          <button className="close-dropdown-btn" onClick={onClose}>✕</button>
        </div>

        <div className="messages-dropdown-body">
          {loading ? (
            <div className="messages-loading">
              <div className="spinner-border spinner-border-sm text-primary"></div>
              <span>Loading...</span>
            </div>
          ) : conversations.length === 0 ? (
            <div className="no-conversations">
              <div className="no-conversations-icon">💬</div>
              <p>No messages yet</p>
              <small>Start a conversation!</small>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conv, index) => (
                <div
                  key={index}
                  className="conversation-item"
                  onClick={() => handleConversationClick(conv)}
                >
                  <div className="conversation-avatar-container">
                    {conv.avatar ? (
                      <img 
                        src={conv.avatar} 
                        alt={getDisplayName(conv)} 
                        className="conversation-avatar"
                      />
                    ) : (
                      <div className="conversation-avatar-placeholder">
                        {conv.firstName?.[0] || conv.username[0].toUpperCase()}
                      </div>
                    )}
                    <div className="conversation-status-badge">
                      <OnlineStatusBadge 
                        username={conv.username} 
                        size="small" 
                        showTooltip={false}
                      />
                    </div>
                  </div>

                  <div className="conversation-details">
                    <div className="conversation-header">
                      <span className="conversation-name">
                        {getDisplayName(conv)}
                      </span>
                      {conv.unreadCount > 0 && (
                        <span className="unread-badge">{conv.unreadCount}</span>
                      )}
                    </div>
                    <p className="conversation-message">
                      {truncateMessage(conv.lastMessage)}
                    </p>
                    <span className="conversation-time">
                      {formatTimestamp(conv.timestamp)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {conversations.length > 0 && (
          <div className="messages-dropdown-footer">
            <a href="/messages" className="view-all-link">
              View All Messages →
            </a>
          </div>
        )}
      </div>
    </>
  );
};

export default MessagesDropdown;
