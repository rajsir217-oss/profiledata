import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileCreatorBadge from './ProfileCreatorBadge';
import { getDisplayName } from '../utils/userDisplay';
import { getProfilePicUrl } from '../utils/urlHelper';
import { formatShortDateTime } from '../utils/timeFormatter';
import './MessageList.css';

const MessageList = ({ conversations, selectedUser, onSelectUser, currentUsername, unattendedData }) => {
  // Get urgency info for a conversation
  const getUrgencyInfo = (username) => {
    if (!unattendedData?.conversations) return null;
    const unattended = unattendedData.conversations.find(c => c.sender.username === username);
    if (!unattended) return null;
    return {
      urgency: unattended.urgency,
      waitingDays: unattended.lastMessage.waitingDays
    };
  };
  const navigate = useNavigate();
  const [imageErrors, setImageErrors] = useState({});
  
  // Get initials from first and last name
  const getInitials = (userProfile, username) => {
    const firstName = userProfile?.firstName || '';
    const lastName = userProfile?.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    }
    return username?.[0]?.toUpperCase() || '?';
  };

  const handleImageError = (username) => {
    setImageErrors(prev => ({ ...prev, [username]: true }));
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return formatShortDateTime(timestamp);
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
              {/* Avatar - shows profile pic or initials */}
              <div className="conversation-avatar">
                {getProfilePicUrl(conv.userProfile) && !imageErrors[conv.username] ? (
                  <img 
                    src={getProfilePicUrl(conv.userProfile)} 
                    alt={conv.username}
                    onError={() => handleImageError(conv.username)}
                  />
                ) : (
                  <div className="avatar-placeholder">
                    {getInitials(conv.userProfile, conv.username)}
                  </div>
                )}
                {conv.unreadCount > 0 && (
                  <span className="unread-badge">{conv.unreadCount}</span>
                )}
              </div>
              
              {/* Info - Name, Date, Message Preview */}
              <div className="conversation-info">
                <div className="conversation-header">
                  <span className="conversation-name">
                    {getDisplayName(conv.userProfile) || conv.username}
                    {conv.userProfile?.profileCreatedBy && (
                      <ProfileCreatorBadge 
                        creatorType={conv.userProfile.profileCreatedBy}
                        size="small"
                        showLabel={false}
                        showIcon={true}
                      />
                    )}
                    {conv.userProfile?.accountStatus === 'paused' && (
                      <span className="pause-badge" title="User is on a break">⏸️</span>
                    )}
                  </span>
                  <div className="conversation-meta">
                    {getUrgencyInfo(conv.username) && (
                      <span className={`urgency-badge urgency-${getUrgencyInfo(conv.username).urgency}`} title={`Waiting ${getUrgencyInfo(conv.username).waitingDays} days`}>
                        {getUrgencyInfo(conv.username).urgency === 'critical' && '🔴'}
                        {getUrgencyInfo(conv.username).urgency === 'high' && '🟠'}
                        {getUrgencyInfo(conv.username).urgency === 'medium' && '🟡'}
                        {getUrgencyInfo(conv.username).waitingDays}d
                      </span>
                    )}
                    <span className="conversation-time">{formatTime(conv.lastMessageTime)}</span>
                  </div>
                </div>
                <p className={`conversation-preview ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                  {truncateMessage(conv.lastMessage)}
                </p>
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
