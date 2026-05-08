import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ProfileCreatorBadge from './ProfileCreatorBadge';
import { getDisplayName } from '../utils/userDisplay';
import { getProfilePicUrl } from '../utils/urlHelper';
import { formatShortDateTime } from '../utils/timeFormatter';
import './MessageList.css';

const MessageList = ({ conversations, selectedUser, onSelectUser, currentUsername, unattendedData, onQuickResponse }) => {
  // Check if a conversation is a group chat
  const isGroupChat = (conv) => {
    return conv.type === 'group' || conv.type === 'public_group' || !!conv.groupName;
  };

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

  // Get urgency class for conversation item
  const getUrgencyClass = (username) => {
    const urgencyInfo = getUrgencyInfo(username);
    if (!urgencyInfo) return '';
    return urgencyInfo.urgency;
  };
  const navigate = useNavigate();
  const [imageErrors, setImageErrors] = useState({});
  
  // Get initials from first and last name
  const getInitials = (userProfile, username, isGroup) => {
    if (isGroup) {
      // For group chats, use first letter of group name
      const groupName = userProfile?.groupName || 'Group';
      return groupName[0].toUpperCase();
    }
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

  const handleQuickResponse = (e, username, responseType) => {
    e.stopPropagation();
    if (onQuickResponse) {
      onQuickResponse(username, responseType);
    }
  };

  return (
    <div className="message-list">
      
      <div className="conversations-container">
        {conversations.length === 0 ? (
          <div className="no-conversations">
            <p>No conversations yet</p>
            <small>Start chatting with your matches!</small>
          </div>
        ) : (
          conversations.map((conv) => {
            const isGroup = isGroupChat(conv);
            const urgencyClass = getUrgencyClass(conv.username);
            const urgencyInfo = getUrgencyInfo(conv.username);
            
            return (
              <div
                key={conv.id || conv.username}
                className={`conversation-item ${selectedUser === (conv.id || conv.username) ? 'active' : ''} ${isGroup ? 'group-chat' : ''} ${urgencyClass}`}
                onClick={() => onSelectUser(conv.id || conv.username)}
              >
                {/* Avatar - shows profile pic or initials */}
                <div className="conversation-avatar">
                  {isGroup ? (
                    // Group chat avatar
                    <div className="avatar-placeholder group-avatar">
                      🇺🇸
                    </div>
                  ) : getProfilePicUrl(conv.userProfile) && !imageErrors[conv.username] ? (
                    <img 
                      src={getProfilePicUrl(conv.userProfile)} 
                      alt={conv.username}
                      onError={() => handleImageError(conv.username)}
                    />
                  ) : (
                    <div className="avatar-placeholder">
                      {getInitials(conv.userProfile, conv.username, isGroup)}
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
                      {isGroup ? (conv.groupName || 'Group Chat') : (getDisplayName(conv.userProfile) || conv.username)}
                      {!isGroup && conv.userProfile?.profileCreatedBy && (
                        <ProfileCreatorBadge 
                          creatorType={conv.userProfile.profileCreatedBy}
                          size="small"
                          showLabel={false}
                          showIcon={true}
                        />
                      )}
                      {!isGroup && conv.userProfile?.accountStatus === 'paused' && (
                        <span className="pause-badge" title="User is on a break">⏸️</span>
                      )}
                      {isGroup && (
                        <span className="group-badge">👥 Group</span>
                      )}
                    </span>
                    <div className="conversation-meta">
                      {urgencyInfo && (
                        <span className={`urgency-badge urgency-${urgencyInfo.urgency}`} title={`Waiting ${urgencyInfo.waitingDays} days for your response`}>
                          {urgencyInfo.urgency === 'critical' && '🔴 Reply needed!'}
                          {urgencyInfo.urgency === 'high' && '🟠 ' + urgencyInfo.waitingDays + 'd'}
                          {urgencyInfo.urgency === 'medium' && '🟡 ' + urgencyInfo.waitingDays + 'd'}
                        </span>
                      )}
                      <span className="conversation-time">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                  </div>
                  <p className={`conversation-preview ${conv.unreadCount > 0 ? 'unread' : ''}`}>
                    {truncateMessage(conv.lastMessage)}
                  </p>
                </div>
                
                {/* View Profile Button - only for 1:1 chats */}
                {!isGroup && (
                  <button 
                    className="view-profile-btn"
                    onClick={(e) => handleViewProfile(e, conv.username)}
                    title="View Profile"
                  >
                    👁️
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MessageList;
