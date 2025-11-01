import React from 'react';
import OnlineStatusBadge from './OnlineStatusBadge';
import { getDisplayName } from '../utils/userDisplay';
import './MessageList.css';

const MessageList = ({ conversations, selectedUser, onSelectUser, currentUsername }) => {
  const [imageErrors, setImageErrors] = React.useState({});

  const handleImageError = (username) => {
    setImageErrors(prev => ({ ...prev, [username]: true }));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const truncateMessage = (message, maxLength = 40) => {
    if (!message) return 'No messages yet';
    return message.length > maxLength ? message.substring(0, maxLength) + '...' : message;
  };

  return (
    <div className="message-list">
      <div className="message-list-header">
        <h3>💬 My Messages</h3>
      </div>
      
      <div className="conversations-container">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <small>Start chatting with your matches!</small>
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.username}
              className={`conversation-item ${selectedUser === conv.username ? 'active' : ''}`}
              onClick={() => onSelectUser(conv.username)}
            >
              <div className="conversation-avatar">
                {conv.userProfile?.images?.[0] && !imageErrors[conv.username] ? (
                  <img 
                    src={conv.userProfile.images[0]} 
                    alt={conv.username}
                    onError={() => handleImageError(conv.username)}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {conv.userProfile?.firstName?.[0] || conv.username[0].toUpperCase()}
                  </div>
                )}
                {/* Online Status Badge */}
                <div className="status-badge-absolute">
                  <OnlineStatusBadge username={conv.username} size="small" />
                </div>
                {conv.unreadCount > 0 && (
                  <span className="unread-badge">{conv.unreadCount}</span>
                )}
              </div>
              
              <div className="conversation-info">
                <div className="conversation-header">
                  <span className="conversation-name">
                    {getDisplayName(conv.userProfile) || conv.username}
                  </span>
                  <span className="conversation-time">
                    {formatTime(conv.lastMessageTime)}
                  </span>
                </div>
                <div className="conversation-preview">
                  <p className={conv.unreadCount > 0 ? 'unread' : ''}>
                    {truncateMessage(conv.lastMessage)}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;
