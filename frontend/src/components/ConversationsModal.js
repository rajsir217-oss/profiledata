import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './ConversationsModal.css';
import { formatRelativeTime } from '../utils/timeFormatter';

const ConversationsModal = ({ isOpen, onClose, username }) => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const loadConversations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/messages/conversations?username=${username}`);
      setConversations(response.data.conversations || []);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    if (isOpen && username) {
      loadConversations();
    }
  }, [isOpen, username, loadConversations]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  const handleOpenConversation = (conversationUser) => {
    // Navigate to messages page with the selected conversation
    navigate(`/messages?chat=${conversationUser.username}`);
    onClose();
  };

  const handleViewAllMessages = () => {
    navigate('/messages');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="conversations-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💬 My Conversations</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {loading && (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading conversations...</p>
            </div>
          )}

          {error && (
            <div className="error-state">
              <p>{error}</p>
              <button onClick={loadConversations}>Try Again</button>
            </div>
          )}

          {!loading && !error && conversations.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">💬</span>
              <p>No conversations yet</p>
              <small>Start messaging your matches to begin a conversation</small>
            </div>
          )}

          {!loading && !error && conversations.length > 0 && (
            <div className="conversations-list">
              {conversations.map((conv) => {
                // Handle both user object and simple username string formats
                const user = typeof conv === 'string' ? { username: conv } : conv;
                const displayName = user.firstName || user.username;
                const lastMessageTime = user.lastMessageTime || user.last_message_time;
                const unreadCount = user.unreadCount || user.unread_count || 0;
                
                return (
                  <div 
                    key={user.username} 
                    className="conversation-item"
                    onClick={() => handleOpenConversation(user)}
                  >
                    <div className="conversation-avatar">
                      {user.images && user.images.length > 0 ? (
                        <img 
                          src={user.images[0]} 
                          alt={user.username}
                          onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div 
                        className="avatar-placeholder" 
                        style={{ display: user.images && user.images.length > 0 ? 'none' : 'flex' }}
                      >
                        {displayName ? displayName.charAt(0).toUpperCase() : '?'}
                      </div>
                      {unreadCount > 0 && (
                        <div className="unread-badge">{unreadCount}</div>
                      )}
                    </div>

                    <div className="conversation-info">
                      <div className="conversation-name">
                        {displayName}
                        {unreadCount > 0 && <span className="new-indicator">New</span>}
                      </div>
                      <div className="conversation-username">@{user.username}</div>
                      {user.lastMessage && (
                        <div className="conversation-preview">
                          {user.lastMessage}
                        </div>
                      )}
                      {lastMessageTime && (
                        <div className="conversation-timestamp">
                          {formatRelativeTime(lastMessageTime)}
                        </div>
                      )}
                    </div>

                    <div className="conversation-arrow">→</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !error && conversations.length > 0 && (
          <div className="modal-footer">
            <button className="btn-view-all" onClick={handleViewAllMessages}>
              View All Messages →
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationsModal;
