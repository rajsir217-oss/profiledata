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
  { category: 'Decline', icon: '🙏', isDecline: true, messages: [
    "Thank you for your interest, but we don't feel this is the right match for us. Best wishes!",
    "We appreciate you reaching out, but we're currently exploring other options."
  ]}
];

const ChatWindow = ({ messages, currentUsername, otherUser, onSendMessage, onMessageDeleted, onBack, conversationStatus, onCloseConversation }) => {
  const messagesEndRef = useRef(null);
  const [messageText, setMessageText] = useState('');
  const [deletingMessage, setDeletingMessage] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [headerImageError, setHeaderImageError] = useState(false);
  const [messageImageErrors, setMessageImageErrors] = useState({});
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [blockStatus, setBlockStatus] = useState({ iBlockedThem: false, theyBlockedMe: false, canMessage: true });
  const [addingToExclusion, setAddingToExclusion] = useState(false);
  const [removingFromExclusion, setRemovingFromExclusion] = useState(false);
  const [reconnectStatus, setReconnectStatus] = useState({ hasRecentRequest: false, status: null });
  const [sendingReconnect, setSendingReconnect] = useState(false);
  const [showNotInterestedMenu, setShowNotInterestedMenu] = useState(false);
  const [notInterestedProcessing, setNotInterestedProcessing] = useState(false);
  const notInterestedRef = useRef(null);

  const scrollToBottom = () => {
    // Use block: 'nearest' to prevent page scroll, only scroll within the messages container
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Reset image errors when switching conversations
    setHeaderImageError(false);
    setMessageImageErrors({});
  }, [otherUser]);

  // Check block status when conversation changes
  useEffect(() => {
    const checkBlockStatus = async () => {
      if (!otherUser?.username) return;
      try {
        const response = await api.get(`/messages/block-status/${otherUser.username}`);
        setBlockStatus(response.data);
      } catch (error) {
        logger.warn('Could not check block status:', error);
        setBlockStatus({ iBlockedThem: false, theyBlockedMe: false, canMessage: true });
      }
    };
    checkBlockStatus();
  }, [otherUser?.username]);

  // Handle adding user to exclusion list
  const handleAddToExclusion = async () => {
    if (!otherUser?.username) return;
    setAddingToExclusion(true);
    try {
      const formData = new FormData();
      formData.append('reason', 'User is not reachable');
      await api.post(`/exclusions/${otherUser.username}`, formData);
      setBlockStatus(prev => ({ ...prev, iBlockedThem: true, canMessage: false }));
      // Show success toast
      const toastService = (await import('../services/toastService')).default;
      toastService.success(`${otherUser.firstName || otherUser.username} has been added to your exclusion list.`);
    } catch (error) {
      logger.error('Error adding to exclusion:', error);
      const toastService = (await import('../services/toastService')).default;
      toastService.error('Failed to add to exclusion list.');
    } finally {
      setAddingToExclusion(false);
    }
  };

  // Handle removing user from exclusion list
  const handleRemoveFromExclusion = async () => {
    if (!otherUser?.username) return;
    setRemovingFromExclusion(true);
    try {
      const currentUsername = localStorage.getItem('username');
      await api.delete(`/exclusions/${otherUser.username}?username=${encodeURIComponent(currentUsername)}`);
      setBlockStatus(prev => ({ ...prev, iBlockedThem: false, canMessage: true }));
      // Show success toast
      const toastService = (await import('../services/toastService')).default;
      toastService.success(`${otherUser.firstName || otherUser.username} has been removed from your exclusion list. You can now continue the conversation.`);
    } catch (error) {
      logger.error('Error removing from exclusion:', error);
      const toastService = (await import('../services/toastService')).default;
      toastService.error('Failed to remove from exclusion list.');
    } finally {
      setRemovingFromExclusion(false);
    }
  };

  // Check reconnect request status when they blocked us
  useEffect(() => {
    const checkReconnectStatus = async () => {
      if (!otherUser?.username || !blockStatus.theyBlockedMe) return;
      try {
        const response = await api.get(`/exclusions/reconnect-status/${otherUser.username}`);
        setReconnectStatus(response.data);
      } catch (error) {
        logger.warn('Could not check reconnect status:', error);
      }
    };
    checkReconnectStatus();
  }, [otherUser?.username, blockStatus.theyBlockedMe]);

  // Handle sending reconnect request
  const handleRequestReconnect = async () => {
    if (!otherUser?.username) return;
    setSendingReconnect(true);
    try {
      await api.post(`/exclusions/request-reconnect/${otherUser.username}`);
      setReconnectStatus({ hasRecentRequest: true, status: 'pending' });
      const toastService = (await import('../services/toastService')).default;
      toastService.success(`Reconnect request sent to ${otherUser.firstName || otherUser.username}!`);
    } catch (error) {
      logger.error('Error sending reconnect request:', error);
      const toastService = (await import('../services/toastService')).default;
      const message = error.response?.data?.detail || 'Failed to send reconnect request.';
      toastService.error(message);
    } finally {
      setSendingReconnect(false);
    }
  };

  // Combined "Not Interested" action: decline msg + close convo + exclude
  const handleNotInterested = async () => {
    if (!otherUser?.username || notInterestedProcessing) return;
    setNotInterestedProcessing(true);
    try {
      const toastService = (await import('../services/toastService')).default;
      const declineMsg = "Thank you for your interest, but we don't feel this is the right match for us. Wishing you the very best!";

      // Step 1: Send decline message
      onSendMessage(declineMsg);

      // Step 2: Close the conversation (small delay so message sends first)
      await new Promise(r => setTimeout(r, 500));
      if (onCloseConversation) {
        await onCloseConversation(otherUser.username);
      }

      // Step 3: Add to exclusion list
      const formData = new FormData();
      formData.append('reason', 'Not interested - declined via messages');
      await api.post(`/exclusions/${otherUser.username}`, formData);
      setBlockStatus(prev => ({ ...prev, iBlockedThem: true, canMessage: false }));

      toastService.success(`Conversation closed and ${otherUser.firstName || otherUser.username} added to your exclusion list.`);
      setShowNotInterestedMenu(false);
    } catch (error) {
      logger.error('Error in Not Interested flow:', error);
      const toastService = (await import('../services/toastService')).default;
      toastService.error('Something went wrong. Please try again.');
    } finally {
      setNotInterestedProcessing(false);
    }
  };

  // Close the Not Interested dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notInterestedRef.current && !notInterestedRef.current.contains(e.target)) {
        setShowNotInterestedMenu(false);
      }
    };
    if (showNotInterestedMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showNotInterestedMenu]);

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
            <p className="chat-user-subtitle">
              {console.log('🔍 ChatWindow otherUser fields:', { height: otherUser.height, heightInches: otherUser.heightInches, age: otherUser.age, birthYear: otherUser.birthYear, birthMonth: otherUser.birthMonth, eatingPreference: otherUser.eatingPreference, location: otherUser.location, keys: Object.keys(otherUser).join(', ') })}
              {otherUser.location || 'Location not specified'}
              {(() => {
                const h = otherUser.height || (otherUser.heightInches ? `${Math.floor(otherUser.heightInches / 12)}'${otherUser.heightInches % 12}"` : null);
                return h ? <span className="chat-detail-separator"> · {h}</span> : null;
              })()}
              {(() => {
                let age = otherUser.age;
                if (!age && otherUser.birthYear) {
                  const now = new Date();
                  age = now.getFullYear() - parseInt(otherUser.birthYear);
                  if (otherUser.birthMonth && (now.getMonth() + 1) < parseInt(otherUser.birthMonth)) age--;
                }
                return age ? <span className="chat-detail-separator"> · {age}yrs</span> : null;
              })()}
              {otherUser.eatingPreference && otherUser.eatingPreference !== 'None' && (
                <span className="chat-detail-separator"> · {otherUser.eatingPreference}</span>
              )}
            </p>
          </div>
        </div>

        {/* Not Interested action - only when conversation is active (not already closed/blocked) */}
        {conversationStatus?.status !== 'closed' && !blockStatus.iBlockedThem && !blockStatus.theyBlockedMe && (
          <div className="chat-header-actions" ref={notInterestedRef}>
            <button
              className={`not-interested-btn ${showNotInterestedMenu ? 'active' : ''}`}
              onClick={() => setShowNotInterestedMenu(!showNotInterestedMenu)}
              title="Not interested — decline, close & exclude"
              disabled={notInterestedProcessing}
            >
              {notInterestedProcessing ? '...' : '✋'}
            </button>
            {showNotInterestedMenu && (
              <div className="not-interested-dropdown">
                <div className="ni-dropdown-header">Not Interested?</div>
                <p className="ni-dropdown-desc">
                  This will send a polite decline message, close the conversation, and add {otherUser.firstName || otherUser.username} to your exclusion list.
                </p>
                <div className="ni-dropdown-actions">
                  <button
                    className="ni-confirm-btn"
                    onClick={handleNotInterested}
                    disabled={notInterestedProcessing}
                  >
                    {notInterestedProcessing ? 'Processing...' : 'Yes, Not Interested'}
                  </button>
                  <button
                    className="ni-cancel-btn"
                    onClick={() => setShowNotInterestedMenu(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Community Guidelines Banner */}
      <div className="chat-guidelines-banner">
        <span className="guidelines-icon">⚠️</span>
        <span className="guidelines-text">
          <strong>Be Professional.</strong> No vulgar or abusive language. Violations result in immediate suspension or ban.
        </span>
      </div>

      {/* You Excluded This User Banner */}
      {blockStatus.iBlockedThem && (
        <div className="chat-exclusion-notice">
          <span className="exclusion-notice-icon">🚫</span>
          <div className="exclusion-notice-content">
            <div className="exclusion-notice-text">
              <strong>You excluded this user</strong>
              <p>You added {otherUser?.firstName || otherUser?.username} to your exclusion list. Remove them from exclusions to continue the conversation.</p>
            </div>
            <button 
              className="btn-remove-exclusion"
              onClick={handleRemoveFromExclusion}
              disabled={removingFromExclusion}
            >
              {removingFromExclusion ? 'Removing...' : 'Remove from Exclusions'}
            </button>
          </div>
        </div>
      )}

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

      {/* Conversation Closed Banner */}
      {conversationStatus?.status === 'closed' && (
        <div className="chat-closed-notice">
          <span className="closed-notice-icon">💔</span>
          <div className="closed-notice-text">
            <strong>This conversation has ended</strong>
            <p>
              {conversationStatus.closedBy === currentUsername 
                ? "You closed this conversation."
                : "This member has indicated they're not the right match. Don't worry - there are many great matches waiting for you!"
              }
            </p>
          </div>
        </div>
      )}

      {/* User Not Reachable Banner (they blocked you) */}
      {blockStatus.theyBlockedMe && !blockStatus.iBlockedThem && (
        <div className="chat-not-reachable-notice">
          <span className="not-reachable-icon">🚫</span>
          <div className="not-reachable-content">
            <div className="not-reachable-text">
              <strong>{otherUser?.firstName || otherUser?.username} is not reachable</strong>
              <p>This user is no longer accepting messages from you. Would you like to add them to your exclusion list to remove this conversation?</p>
            </div>
            <div className="not-reachable-actions">
              <button 
                className="btn-add-exclusion"
                onClick={handleAddToExclusion}
                disabled={addingToExclusion}
              >
                {addingToExclusion ? 'Adding...' : 'Yes, Add to My Exclusions'}
              </button>
              <button className="btn-cancel-exclusion" onClick={() => {}}>
                No, Keep Conversation
              </button>
            </div>
            
            {/* Request to Reconnect Button */}
            <div className="reconnect-request-section">
              <div className="reconnect-divider">
                <span>or</span>
              </div>
              {reconnectStatus.hasRecentRequest ? (
                <div className="reconnect-status">
                  {reconnectStatus.status === 'pending' && (
                    <span className="reconnect-pending">
                      🔔 Reconnect request sent - waiting for response
                    </span>
                  )}
                  {reconnectStatus.status === 'accepted' && (
                    <span className="reconnect-accepted">
                      ✅ Your reconnect request was accepted!
                    </span>
                  )}
                  {reconnectStatus.status === 'declined' && (
                    <span className="reconnect-declined">
                      Request was declined. You can try again in 24 hours.
                    </span>
                  )}
                </div>
              ) : (
                <button 
                  className="btn-request-reconnect"
                  onClick={handleRequestReconnect}
                  disabled={sendingReconnect}
                  title="Send a notification asking to reconnect"
                >
                  {sendingReconnect ? (
                    <>Sending...</>
                  ) : (
                    <>🔔 Request to Reconnect</>
                  )}
                </button>
              )}
              <p className="reconnect-hint">
                This will send a notification to {otherUser?.firstName || otherUser?.username} asking them to reconsider.
              </p>
            </div>
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
                  className={`quick-message-btn ${QUICK_REPLY_TEMPLATES[selectedCategory].isDecline ? 'decline-btn' : ''}`}
                  onClick={async () => {
                    if (QUICK_REPLY_TEMPLATES[selectedCategory].isDecline) {
                      // For decline messages: send message, then close conversation
                      onSendMessage(msg);
                      setShowQuickReplies(false);
                      setSelectedCategory(null);
                      // Close the conversation after sending decline message
                      if (onCloseConversation && otherUser?.username) {
                        setTimeout(() => {
                          onCloseConversation(otherUser.username);
                        }, 500); // Small delay to ensure message is sent first
                      }
                    } else {
                      setMessageText(msg);
                      setShowQuickReplies(false);
                      setSelectedCategory(null);
                    }
                  }}
                >
                  {QUICK_REPLY_TEMPLATES[selectedCategory].isDecline && <span className="decline-icon">🚪</span>}
                  {msg}
                  {QUICK_REPLY_TEMPLATES[selectedCategory].isDecline && (
                    <span className="decline-note">(closes conversation)</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Message Input */}
      {conversationStatus?.status === 'closed' ? (
        <div className="message-input-disabled">
          <span>🚫 This conversation is closed. You cannot send messages.</span>
        </div>
      ) : !blockStatus.canMessage ? (
        <div className="message-input-disabled">
          <span>🚫 {blockStatus.theyBlockedMe ? 'This user is not accepting messages from you.' : 'You cannot send messages to users in your exclusion list.'}</span>
        </div>
      ) : (
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
      )}
    </div>
  );
};

export default ChatWindow;
