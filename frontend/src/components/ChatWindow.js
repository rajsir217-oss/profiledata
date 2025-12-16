import React, { useEffect, useRef, useState } from 'react';
import api from '../api';
import ProfileCreatorBadge from './ProfileCreatorBadge';
import logger from '../utils/logger';
import './ChatWindow.css';

const ChatWindow = ({ messages, currentUsername, otherUser, onSendMessage, onMessageDeleted }) => {
  const messagesEndRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [headerImageError, setHeaderImageError] = useState(false);
  const [messageImageErrors, setMessageImageErrors] = useState({});

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
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
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
        <div className="chat-user-info">
          {otherUser.images?.[0] && !headerImageError ? (
            <img 
              src={otherUser.images[0]} 
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
                    {otherUser.images?.[0] && !messageImageErrors[index] ? (
                      <img 
                        src={otherUser.images[0]} 
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

      {/* Message Input */}
      <div className="message-input-container">
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
