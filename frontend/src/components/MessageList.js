import React from 'react';
import { useNavigate } from 'react-router-dom';
import OnlineStatusBadge from './OnlineStatusBadge';
import ProfileCreatorBadge from './ProfileCreatorBadge';
import { getDisplayName } from '../utils/userDisplay';
import { getProfilePicUrl } from '../utils/urlHelper';
import './MessageList.css';

const MessageList = ({ conversations, selectedUser, onSelectUser, currentUsername }) => {
  const navigate = useNavigate();
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

  const handleViewProfile = (e, username) => {
    e.stopPropagation();
    navigate(`/profile/${username}`);
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
                {getProfilePicUrl(conv.userProfile) && !imageErrors[conv.username] ? (
                  <img 
                    src={getProfilePicUrl(conv.userProfile)} 
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
                    {/* Profile Creator Badge */}
                    {conv.userProfile?.profileCreatedBy && (
                      <ProfileCreatorBadge 
                        creatorType={conv.userProfile.profileCreatedBy}
                        size="small"
                        showLabel={false}
                        showIcon={true}
                      />
                    )}
                    {/* Pause Status Badge */}
                    {conv.userProfile?.accountStatus === 'paused' && (
                      <span className="pause-badge" title="User is on a break">
                        ⏸️
                      </span>
                    )}
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
              
              {/* View Profile Button */}
              <button 
                className="view-profile-btn"
                onClick={(e) => handleViewProfile(e, conv.username)}
                title="View Profile"
              >
                👁️
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MessageList;
