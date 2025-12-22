import React, { useEffect } from 'react';
import './ChatFirstPrompt.css';

/**
 * ChatFirstPrompt - Encourages users to chat before requesting contact info
 * 
 * Props:
 * - isOpen: boolean - Whether the prompt is visible
 * - onClose: function - Called when prompt is dismissed
 * - onContinue: function - Called when user chooses to continue with request
 * - onOpenChat: function - Called when user clicks to open chat
 * - targetUser: object - The user they want to request data from { username, firstName }
 */
const ChatFirstPrompt = ({ 
  isOpen, 
  onClose, 
  onContinue, 
  onOpenChat,
  targetUser 
}) => {
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

  return (
    <div className="chat-first-overlay" onClick={onClose}>
      <div className="chat-first-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-first-header">
          <span className="chat-first-icon">💬</span>
          <h3>Start a Conversation First?</h3>
        </div>
        
        <div className="chat-first-body">
          <p className="chat-first-message">
            We encourage you to <strong>chat with {firstName}</strong> first before requesting contact information.
          </p>
          <p className="chat-first-subtitle">
            Building a connection through messages helps both parties feel more comfortable sharing personal details.
          </p>
          
          <button 
            className="chat-first-chat-btn"
            onClick={() => {
              onClose();
              onOpenChat();
            }}
          >
            <span className="chat-btn-icon">💬</span>
            <span>Open Chat with {firstName}</span>
          </button>
        </div>
        
        <div className="chat-first-divider">
          <span>or</span>
        </div>
        
        <div className="chat-first-footer">
          <p className="continue-text">Continue with data request anyway?</p>
          <div className="chat-first-buttons">
            <button 
              className="btn-cancel"
              onClick={onClose}
            >
              Cancel
            </button>
            <button 
              className="btn-continue"
              onClick={() => {
                onClose();
                onContinue();
              }}
            >
              Yes, Continue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatFirstPrompt;
