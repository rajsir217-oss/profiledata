import React, { useEffect, useState } from 'react';
import api from '../api';
import './ChatFirstPrompt.css';

/**
 * ChatFirstPrompt - Encourages/requires users to chat before requesting contact info
 * 
 * Props:
 * - isOpen: boolean - Whether the prompt is visible
 * - onClose: function - Called when prompt is dismissed
 * - onContinue: function - Called when user chooses to continue with request
 * - onOpenChat: function - Called when user clicks to open chat
 * - targetUser: object - The user they want to request data from { username, firstName }
 * - requireConversation: boolean - If true, blocks PII request until conversation exists (default: true)
 * - minMessages: number - Minimum messages required before allowing PII request (default: 1)
 */
const ChatFirstPrompt = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  onOpenChat,
  targetUser,
  requireConversation = true,
  minMessages = 1
}) => {
  const [hasConversation, setHasConversation] = useState(false);
  const [messageCount, setMessageCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const currentUsername = localStorage.getItem('username');

  // Check if conversation exists when modal opens
  useEffect(() => {
    const checkConversation = async () => {
      if (!isOpen || !targetUser?.username || !currentUsername) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Check conversation history between users
        const response = await api.get(`/messages/conversation/${targetUser.username}?username=${currentUsername}&limit=50`);
        const messages = response.data?.messages || response.data || [];
        const count = Array.isArray(messages) ? messages.length : 0;
        setMessageCount(count);
        setHasConversation(count >= minMessages);
      } catch (err) {
        console.error('Error checking conversation:', err);
        // On error, default to no conversation (safer)
        setHasConversation(false);
        setMessageCount(0);
      } finally {
        setLoading(false);
      }
    };

    checkConversation();
  }, [isOpen, targetUser?.username, currentUsername, minMessages]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const firstName = targetUser?.firstName || targetUser?.username || 'this member';
  
  // Determine if user can continue with PII request
  const canContinue = !requireConversation || hasConversation;

  // Loading state
  if (loading) {
    return (
      <div className="chat-first-overlay">
        <div className="chat-first-modal" onClick={(e) => e.stopPropagation()}>
          <div className="chat-first-header">
            <span className="chat-first-icon">💬</span>
            <h3>Checking Conversation...</h3>
          </div>
          <div className="chat-first-body">
            <div className="chat-first-loading">
              <span className="loading-spinner">⏳</span>
              <p>Please wait...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-first-overlay" onClick={onClose}>
      <div className="chat-first-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-first-header">
          <span className="chat-first-icon">{canContinue ? '✅' : '�'}</span>
          <h3>{canContinue ? 'Ready to Request Access' : 'Conversation Required'}</h3>
        </div>
        
        <div className="chat-first-body">
          {canContinue ? (
            <>
              <p className="chat-first-message chat-first-success">
                <strong>Great!</strong> You've already connected with {firstName} through messages.
              </p>
              <p className="chat-first-subtitle">
                You can now proceed with your data request.
              </p>
              {messageCount > 0 && (
                <p className="chat-first-stats">
                  📊 {messageCount} message{messageCount !== 1 ? 's' : ''} exchanged
                </p>
              )}
            </>
          ) : (
            <>
              <p className="chat-first-message chat-first-required">
                <strong>Please chat with {firstName} first</strong> before requesting contact information.
              </p>
              <p className="chat-first-subtitle">
                Building a connection through messages helps both parties feel more comfortable sharing personal details. This is required before requesting private data.
              </p>
              <div className="chat-first-requirement">
                <span className="requirement-icon">📝</span>
                <span>Minimum {minMessages} message{minMessages !== 1 ? 's' : ''} required</span>
              </div>
            </>
          )}
          
          <button 
            className="chat-first-chat-btn"
            onClick={() => {
              onClose();
              onOpenChat();
            }}
          >
            <span className="chat-btn-icon">💬</span>
            <span>{canContinue ? `Continue Chatting with ${firstName}` : `Start Chat with ${firstName}`}</span>
          </button>
        </div>
        
        {canContinue ? (
          <div className="chat-first-footer">
            <div className="chat-first-buttons">
              <button 
                className="btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                className="btn-continue btn-success"
                onClick={() => {
                  onClose();
                  onContinue();
                }}
              >
                ✓ Proceed with Request
              </button>
            </div>
          </div>
        ) : (
          <div className="chat-first-footer chat-first-blocked">
            <p className="blocked-text">
              🔒 Data request is locked until you start a conversation
            </p>
            <button 
              className="btn-cancel"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatFirstPrompt;
