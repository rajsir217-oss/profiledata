import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getDisplayName } from '../utils/userDisplay';
import { getProfilePicUrl } from '../utils/urlHelper';
import { formatShortDateTime } from '../utils/timeFormatter';
import onlineStatusService from '../services/onlineStatusService';
import './MessagesDropdown.css';

/**
 * MessagesDropdown Component
 * Shows recent conversations with unread counts and online status
 */
const MessagesDropdown = ({ isOpen, onClose, onOpenMessage, onMessageDeleted }) => {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onlineStatuses, setOnlineStatuses] = useState({});
  const [unattendedData, setUnattendedData] = useState(null);
  const currentUsername = localStorage.getItem('username');
  
  // Get initials from first and last name
  const getInitials = (conv) => {
    const firstName = conv?.firstName || '';
    const lastName = conv?.lastName || '';
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    } else if (firstName) {
      return firstName[0].toUpperCase();
    }
    return conv?.username?.[0]?.toUpperCase() || '?';
  };
  
  const isUserOnline = useCallback((username) => {
    return onlineStatuses[username] || false;
  }, [onlineStatuses]);

  const loadConversations = useCallback(async () => {
    if (!currentUsername) return;

    setLoading(true);
    try {
      // Load both conversations and unattended data for urgency sorting
      const [conversationsResponse, unattendedResponse] = await Promise.all([
        api.get(`/messages/recent/${currentUsername}?limit=10`),
        api.get('/messages/unattended')
      ]);
      
      const unattended = unattendedResponse.data;
      setUnattendedData(unattended);
      
      let convos = conversationsResponse.data.conversations || [];
      // Sort by urgency first
      convos = sortConversationsByUrgency(convos, unattended);
      setConversations(convos);
    } catch (error) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
    }
  }, [currentUsername]);

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen, loadConversations]);
  
  // Create a stable list of usernames to track
  const usernames = React.useMemo(() => 
    conversations?.map(c => c.username).join(',') || '', 
    [conversations]
  );
  
  // Track online status for conversation users
  useEffect(() => {
    if (!usernames) return;
    
    const usernameList = usernames.split(',').filter(Boolean);
    if (usernameList.length === 0) return;
    
    let isMounted = true;
    
    const checkAllStatuses = async () => {
      const statuses = {};
      for (const username of usernameList) {
        try {
          const online = await onlineStatusService.isUserOnline(username);
          statuses[username] = online;
        } catch (e) {
          statuses[username] = false;
        }
      }
      if (isMounted) {
        setOnlineStatuses(prev => {
          const hasChanges = Object.keys(statuses).some(k => prev[k] !== statuses[k]);
          return hasChanges ? { ...prev, ...statuses } : prev;
        });
      }
    };
    
    checkAllStatuses();
    
    const unsubscribe = onlineStatusService.subscribe((username, online) => {
      if (isMounted && usernameList.includes(username)) {
        setOnlineStatuses(prev => {
          if (prev[username] === online) return prev;
          return { ...prev, [username]: online };
        });
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [usernames]);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';

    return formatShortDateTime(timestamp);
  };

  const truncateMessage = (message, maxLength = 40) => {
    if (!message) return '';
    return message.length > maxLength 
      ? message.substring(0, maxLength) + '...' 
      : message;
  };

  const sortConversationsByUrgency = (conversations, unattended) => {
    if (!unattended?.conversations) return conversations;
    
    // Get urgency info for each conversation
    const conversationsWithUrgency = conversations.map(conv => {
      const unattendedConv = unattended.conversations.find(c => c.sender.username === conv.username);
      return {
        ...conv,
        urgency: unattendedConv?.urgency || 'normal',
        waitingDays: unattendedConv?.lastMessage?.waitingDays || 0
      };
    });
    
    // Sort by urgency priority
    const urgencyPriority = {
      'critical': 0,
      'high': 1,
      'medium': 2,
      'pending': 3,
      'normal': 4
    };
    
    return conversationsWithUrgency.sort((a, b) => {
      // First sort by urgency
      const urgencyDiff = urgencyPriority[a.urgency] - urgencyPriority[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      
      // Then by waiting days (longer wait first)
      const daysDiff = b.waitingDays - a.waitingDays;
      if (daysDiff !== 0) return daysDiff;
      
      // Finally by last message time (most recent first)
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  };

  const getUrgencyInfo = (username) => {
    if (!unattendedData?.conversations) return null;
    const unattended = unattendedData.conversations.find(c => c.sender.username === username);
    if (!unattended) return null;
    return {
      urgency: unattended.urgency,
      waitingDays: unattended.lastMessage?.waitingDays || 0
    };
  };

  const getUrgencyBadge = (urgency) => {
    const badges = {
      'critical': { emoji: '🔴', text: 'CRITICAL', class: 'critical' },
      'high': { emoji: '🟠', text: 'HIGH', class: 'high' },
      'medium': { emoji: '🟡', text: 'MEDIUM', class: 'medium' },
      'pending': { emoji: '🔵', text: 'PENDING', class: 'pending' }
    };
    return badges[urgency] || null;
  };

  const handleConversationClick = (conversation) => {
    onOpenMessage({
      username: conversation.username,
      firstName: conversation.firstName,
      lastName: conversation.lastName,
      images: conversation.avatar ? [conversation.avatar] : [],
      onMessageDeleted
    });
    onClose();
  };

  const handleViewProfile = (e, username) => {
    e.stopPropagation();
    navigate(`/profile/${username}`);
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

        {/* Critical Banner */}
        {unattendedData && unattendedData.criticalCount > 0 && (
          <div className="critical-banner">
            <div className="critical-banner-content">
              <span className="critical-icon">🚨</span>
              <div className="critical-text">
                <strong>You have {unattendedData.criticalCount} critical message{unattendedData.criticalCount > 1 ? 's' : ''}</strong>
                <span className="critical-subtext">Requires immediate response</span>
              </div>
            </div>
          </div>
        )}

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
                    {getProfilePicUrl(conv) ? (
                      <img 
                        src={getProfilePicUrl(conv)} 
                        alt={getDisplayName(conv)} 
                        className="conversation-avatar"
                      />
                    ) : (
                      <div className="conversation-avatar-placeholder">
                        {getInitials(conv)}
                      </div>
                    )}
                  </div>

                  <div className="conversation-details">
                    <div className="conversation-header">
                      <div className="conversation-name-section">
                        {/* Name + Badge on same line */}
                        <span className={`conversation-name ${isUserOnline(conv.username) ? 'online' : 'offline'}`}>
                          {getDisplayName(conv)}
                          {(() => {
                            const urgencyInfo = getUrgencyInfo(conv.username);
                            const badge = urgencyInfo ? getUrgencyBadge(urgencyInfo.urgency) : null;
                            return badge ? (
                              <span className={`urgency-badge ${badge.class}`}>
                                {badge.emoji} {badge.text}
                              </span>
                            ) : null;
                          })()}
                        </span>
                        {/* Time on new line below */}
                        <span className="conversation-time">
                          {formatTimestamp(conv.timestamp)}
                        </span>
                      </div>
                      <div className="conversation-meta">
                        {/* Unread Count */}
                        {conv.unreadCount > 0 && (
                          <span className="unread-count">{conv.unreadCount}</span>
                        )}
                      </div>
                    </div>
                    <p className="conversation-message">
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
