import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import ProfileCreatorBadge from './ProfileCreatorBadge';
import logger from '../utils/logger';
import { getProfilePicUrl } from '../utils/urlHelper';
import { formatShortDateTime } from '../utils/timeFormatter';
import './ChatWindow.css';

const QUICK_REPLY_TEMPLATES = [
  { category: 'Introduction', icon: '👋', messages: [
    "Hi, we came across your profile and found it interesting. Would you like to connect and discuss further?",
    "Namaste! Your profile caught our attention. We'd love to know more about you."
  ]},
  { category: 'Interest', icon: '💝', messages: [
    "We liked your profile and feel there could be a good match. Can we exchange more details?",
    "Your profile aligns well with what we're looking for. Would you be open to a conversation?"
  ]},
  { category: 'More Info', icon: '📋', messages: [
    "Could you please share more about your family background and expectations?",
    "We'd like to know more about your education and career plans."
  ]},
  { category: 'Next Steps', icon: '📞', messages: [
    "If you're interested, we can arrange a call to discuss further.",
    "Would you be comfortable sharing contact details for a phone conversation?"
  ]},
  { category: 'Follow-up', icon: '🔔', messages: [
    "Hi, just following up on our earlier message. Looking forward to hearing from you.",
    "Hope you had a chance to review our profile. Let us know your thoughts."
  ]},
  { category: 'Decline', icon: '🙏', messages: [
    "Thank you for your interest, but we don't feel this is the right match for us. Best wishes!",
    "We appreciate you reaching out, but we're currently exploring other options."
  ]}
];

const ChatWindow = ({ messages, currentUsername, otherUser, onSendMessage, onMessageDeleted, onBack }) => {
  const messagesEndRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [headerImageError, setHeaderImageError] = useState(false);
  const [messageImageErrors, setMessageImageErrors] = useState({});
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Reset image errors when switching conversations
    setHeaderImageError(false);
    setMessageImageErrors({});
  }, [otherUser]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return formatShortDateTime(timestamp);
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (messageText.trim()) {
      onSendMessage(messageText.trim());
      setMessageText('');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      setDeletingMessage(messageId);
      await api.delete(`/messages/${messageId}?username=${currentUsername}`);
      
      // Notify parent to refresh messages
      if (onMessageDeleted) {
        onMessageDeleted(messageId);
      }
      
      setDeleteConfirm(null);
    } catch (error) {
      logger.error('Error deleting message:', error);
      setDeleteError(error.response?.data?.detail || 'Failed to delete message');
      setTimeout(() => setDeleteError(null), 3000);
    } finally {
      setDeletingMessage(null);
    }
  };

  const confirmDelete = (messageId) => {
    setDeleteConfirm(messageId);
  };

  const cancelDelete = () => {
    setDeleteConfirm(null);
  };

  if (!otherUser) {
    return (
      <div className="chat-window">
        <div className="no-chat-selected">
          <div className="no-chat-icon">💬</div>
          <h3>Select a conversation</h3>
          <p>Choose a conversation from the list to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      {/* Chat Header */}
      <div className="chat-header">
        {/* Back button for mobile */}
        {onBack && (
          <button className="chat-back-btn" onClick={onBack} title="Back to conversations">
            ←
          </button>
        )}
        <div className="chat-user-info">
          {getProfilePicUrl(otherUser) && !headerImageError ? (
            <img 
              src={getProfilePicUrl(otherUser)} 
              alt={otherUser.username} 
              className="chat-avatar"
              onError={() => setHeaderImageError(true)}
            />
          ) : (
            <div className="chat-avatar-placeholder">
              {otherUser.firstName?.[0] || otherUser.username?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <div className="chat-user-details">
            <h4>
              {otherUser.firstName || otherUser.username}
              {/* Profile Creator Badge */}
              {otherUser.profileCreatedBy && (
                <ProfileCreatorBadge 
                  creatorType={otherUser.profileCreatedBy}
                  size="small"
                  showLabel={true}
                  showIcon={true}
                />
              )}
              {/* Pause Status Badge */}
              {otherUser.accountStatus === 'paused' && (
                <span className="pause-badge-header" title="User is on a break">
                  ⏸️ PAUSED
                </span>
              )}
            </h4>
            <p>{otherUser.location || 'Location not specified'}</p>
          </div>
        </div>
      </div>

      {/* Community Guidelines Banner */}
      <div className="chat-guidelines-banner">
        <span className="guidelines-icon">⚠️</span>
        <span className="guidelines-text">
          <strong>Be Professional.</strong> No vulgar or abusive language. Violations result in immediate suspension or ban.
        </span>
      </div>

      {/* Pause Status Notice */}
      {otherUser.accountStatus === 'paused' && (
        <div className="chat-pause-notice">
          <span className="pause-notice-icon">⏸️</span>
          <div className="pause-notice-text">
            <strong>This user is taking a break</strong>
            <p>{otherUser.pauseMessage || 'They have temporarily paused their account and cannot receive messages.'}</p>
          </div>
        </div>
      )}

      {/* Delete Error Toast */}
      {deleteError && (
        <div className="chat-error-toast">
          <span className="error-icon">⚠️</span>
          <span>{deleteError}</span>
        </div>
      )}

      {/* Messages Area */}
      <div className="messages-area">
        {messages.length === 0 ? (
          <div className="no-messages">
            <p>No messages yet</p>
            <small>Send a message to start the conversation</small>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isOwnMessage = (msg.fromUsername || msg.from_username) === currentUsername;
            const showAvatar = index === 0 || (messages[index - 1].fromUsername || messages[index - 1].from_username) !== (msg.fromUsername || msg.from_username);
            const messageId = msg._id || msg.id;
            const isConfirmingDelete = deleteConfirm === messageId;
            const isDeleting = deletingMessage === messageId;
            
            return (
              <div
                key={messageId || index}
                className={`message-bubble-container ${isOwnMessage ? 'own' : 'other'} ${isDeleting ? 'deleting' : ''}`}
              >
                {!isOwnMessage && showAvatar && (
                  <div className="message-avatar">
                    {getProfilePicUrl(otherUser) && !messageImageErrors[index] ? (
                      <img 
                        src={getProfilePicUrl(otherUser)} 
                        alt={otherUser.username}
                        onError={() => setMessageImageErrors(prev => ({ ...prev, [index]: true }))}
                      />
                    ) : (
                      <div className="avatar-small">
                        {otherUser.firstName?.[0] || otherUser.username?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                  </div>
                )}
                {!isOwnMessage && !showAvatar && <div className="message-avatar-spacer" />}
                
                <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                  <div className="message-content">
                    <p>{msg.content || msg.message}</p>
                    <span className="message-time">{formatTime(msg.createdAt || msg.timestamp)}</span>
                  </div>
                  
                  {isOwnMessage && messageId && (
                    <div className="message-actions">
                      {isConfirmingDelete ? (
                        <div className="delete-confirmation">
                          <button
                            className="confirm-delete-btn"
                            onClick={() => handleDeleteMessage(messageId)}
                            disabled={isDeleting}
                          >
                            ✓ Delete
                          </button>
                          <button
                            className="cancel-delete-btn"
                            onClick={cancelDelete}
                            disabled={isDeleting}
                          >
                            ✗ Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="delete-message-btn"
                          onClick={() => confirmDelete(messageId)}
                          title="Delete message"
                          disabled={isDeleting}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Reply Templates */}
      {showQuickReplies && (
        <div className="quick-replies-panel">
          <div className="quick-replies-header">
            <span className="quick-replies-title">⚡ Quick Messages</span>
            <button 
              className="quick-replies-close"
              onClick={() => { setShowQuickReplies(false); setSelectedCategory(null); }}
            >
              ✕
            </button>
          </div>
          <div className="quick-replies-categories">
            {QUICK_REPLY_TEMPLATES.map((cat, idx) => (
              <button
                key={idx}
                className={`quick-category-btn ${selectedCategory === idx ? 'active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === idx ? null : idx)}
              >
                {cat.icon} {cat.category}
              </button>
            ))}
          </div>
          {selectedCategory !== null && (
            <div className="quick-replies-messages">
              {QUICK_REPLY_TEMPLATES[selectedCategory].messages.map((msg, idx) => (
                <button
                  key={idx}
                  className="quick-message-btn"
                  onClick={() => {
                    setMessageText(msg);
                    setShowQuickReplies(false);
                    setSelectedCategory(null);
                  }}
                >
                  {msg}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message Input */}
      <div className="message-input-container">
        <button
          type="button"
          className="quick-replies-toggle"
          onClick={() => setShowQuickReplies(!showQuickReplies)}
          title="Quick messages"
          disabled={otherUser.accountStatus === 'paused'}
        >
          ⚡
        </button>
        <form onSubmit={handleSend} className="message-input-form">
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={otherUser.accountStatus === 'paused' ? 'User is paused - messages disabled' : 'Type a message...'}
            className="message-input"
            maxLength={1000}
            disabled={otherUser.accountStatus === 'paused'}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!messageText.trim() || otherUser.accountStatus === 'paused'}
          >
            <span className="send-text">Send </span><span className="send-icon">➤</span>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
