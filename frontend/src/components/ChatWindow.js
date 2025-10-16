import React, { useEffect, useRef } from 'react';
import './ChatWindow.css';

const ChatWindow = ({ messages, currentUsername, otherUser, onSendMessage }) => {
  const messagesEndRef = useRef(null);
  const [messageText, setMessageText] = React.useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          {otherUser.images?.[0] ? (
            <img src={otherUser.images[0]} alt={otherUser.username} className="chat-avatar" />
          ) : (
            <div className="chat-avatar-placeholder">
              {otherUser.firstName?.[0] || otherUser.username[0].toUpperCase()}
            </div>
          )}
          <div className="chat-user-details">
            <h4>{otherUser.firstName || otherUser.username}</h4>
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
            
            return (
              <div
                key={msg.id || index}
                className={`message-bubble-container ${isOwnMessage ? 'own' : 'other'}`}
              >
                {!isOwnMessage && showAvatar && (
                  <div className="message-avatar">
                    {otherUser.images?.[0] ? (
                      <img src={otherUser.images[0]} alt={otherUser.username} />
                    ) : (
                      <div className="avatar-small">
                        {otherUser.firstName?.[0] || otherUser.username[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                {!isOwnMessage && !showAvatar && <div className="message-avatar-spacer" />}
                
                <div className={`message-bubble ${isOwnMessage ? 'own' : 'other'}`}>
                  <p>{msg.content || msg.message}</p>
                  <span className="message-time">{formatTime(msg.createdAt || msg.timestamp)}</span>
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
            placeholder="Type a message..."
            className="message-input"
            maxLength={1000}
          />
          <button
            type="submit"
            className="send-button"
            disabled={!messageText.trim()}
          >
            Send ➤
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatWindow;
