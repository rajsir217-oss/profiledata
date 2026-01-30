import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import MessageList from './MessageList';
import ChatWindow from './ChatWindow';
import useActivityLogger from '../hooks/useActivityLogger';
import './Messages.css';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unattendedData, setUnattendedData] = useState(null);
  const [conversationStatus, setConversationStatus] = useState(null);
  const [pendingDismissed, setPendingDismissed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem('messagesSidebarWidth');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentUsername = localStorage.getItem('username');
  const { logMessagesPageViewed, logPageVisit } = useActivityLogger();

  // Handle resize drag
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e) => {
    if (!isResizing || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const newWidth = e.clientX - containerRect.left;
    
    // Clamp between 200px and 500px
    const clampedWidth = Math.min(Math.max(newWidth, 200), 500);
    setSidebarWidth(clampedWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    if (isResizing) {
      setIsResizing(false);
      localStorage.setItem('messagesSidebarWidth', sidebarWidth.toString());
    }
  }, [isResizing, sidebarWidth]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
      return;
    }
    
    // Log page visit
    logPageVisit('Messages Page');
    
    // Check if user was blocked from navigating away
    const wasBlocked = sessionStorage.getItem('unattendedChatsBlock');
    if (wasBlocked) {
      sessionStorage.removeItem('unattendedChatsBlock');
      // Show toast notification
      import('../services/toastService').then(({ default: toastService }) => {
        toastService.warning('Please respond to or decline your pending messages before navigating to other areas.');
      });
    }
    
    loadConversations();
    loadUnattendedChats();

    // Check if we should open a specific conversation
    const urlParams = new URLSearchParams(location.search);
    const toUsername = urlParams.get('to');
    if (toUsername) {
      handleSelectUser(toUsername);
    }

    // Listen for real-time messages
    const handleNewMessage = (data) => {
      console.log('💬 New message received:', data);
      
      // If the message is from the currently selected user, add it to messages
      if (selectedUser && data.from === selectedUser) {
        const newMessage = {
          from_username: data.from,
          to_username: currentUsername,
          message: data.message,
          timestamp: data.timestamp,
          is_read: false
        };
        setMessages(prev => [...prev, newMessage]);
        
        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`New message from ${data.from}`, {
            body: data.message,
            icon: '/logo192.png'
          });
        }
      }
      
      // Always reload conversations to update last message and unread count
      loadConversations();
    };

    socketService.on('new_message', handleNewMessage);

    // ESC key handler to close message window (deselect user)
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && selectedUser) {
        setSelectedUser(null);
      }
    };
    document.addEventListener('keydown', handleEscKey);

    return () => {
      socketService.off('new_message', handleNewMessage);
      document.removeEventListener('keydown', handleEscKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, selectedUser, currentUsername]);

  const loadConversations = async () => {
    console.log('📥 Messages.js: Loading conversations for:', currentUsername);
    try {
      const url = `/messages/conversations?username=${currentUsername}`;
      console.log('📡 Messages.js: Making request to:', url);
      const response = await api.get(url);
      console.log('✅ Messages.js: Response received:', response.data);
      console.log('📊 Messages.js: Conversations count:', response.data.conversations?.length || 0);
      const convos = response.data.conversations || [];
      setConversations(convos);
      setLoading(false);
      
      // Log messages page viewed with conversation count
      logMessagesPageViewed(convos.length);
    } catch (err) {
      console.error('❌ Messages.js: Error loading conversations:', err);
      console.error('❌ Messages.js: Error response:', err.response?.data);
      setError('Failed to load conversations');
      setLoading(false);
    }
  };

  const loadUnattendedChats = async () => {
    try {
      const response = await api.get('/messages/unattended');
      setUnattendedData(response.data);
      console.log('📬 Unattended chats:', response.data);
    } catch (err) {
      console.error('Error loading unattended chats:', err);
    }
  };

  const loadConversationStatus = async (username) => {
    try {
      const response = await api.get(`/messages/conversation/${username}/status`);
      setConversationStatus(response.data);
    } catch (err) {
      console.error('Error loading conversation status:', err);
      setConversationStatus(null);
    }
  };

  const handleCloseConversation = async (username) => {
    try {
      const response = await api.post(`/messages/conversation/${username}/close`);
      if (response.data.success) {
        // Reload data
        await loadConversations();
        await loadUnattendedChats();
        await loadConversationStatus(username);
      }
    } catch (err) {
      console.error('Error closing conversation:', err);
      setError('Failed to close conversation');
    }
  };

  const handleSelectUser = async (username) => {
    setSelectedUser(username);
    setMessages([]);
    setOtherUser(null);
    setConversationStatus(null);

    try {
      const response = await api.get(`/messages/conversation/${username}?username=${currentUsername}`);
      setMessages(response.data.messages || []);
      setOtherUser(response.data.otherUser);
      
      // Load conversation status
      await loadConversationStatus(username);
    } catch (err) {
      console.error('Error loading conversation:', err);
      setError('Failed to load conversation');
    }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim() || !selectedUser) return;

    try {
      const response = await api.post(`/messages/send?username=${currentUsername}`, {
        toUsername: selectedUser,
        content: content.trim()
      });

      // Add message to local state
      const newMsg = response.data.data;
      setMessages(prev => [...prev, newMsg]);

      // Send real-time notification via WebSocket
      console.log('📤 Sending real-time message via WebSocket');
      socketService.sendMessage(selectedUser, content.trim());

      // Update conversation list
      await loadConversations();
      
      // Remove this conversation from unattended list locally (no API call)
      // Full recalculation only happens on page refresh
      if (unattendedData?.conversations) {
        const wasUnattended = unattendedData.conversations.some(c => c.sender.username === selectedUser);
        if (wasUnattended) {
          const removedConvo = unattendedData.conversations.find(c => c.sender.username === selectedUser);
          setUnattendedData(prev => ({
            ...prev,
            conversations: prev.conversations.filter(c => c.sender.username !== selectedUser),
            unattendedCount: Math.max(0, (prev.unattendedCount || 0) - 1),
            criticalCount: removedConvo?.urgency === 'critical' ? Math.max(0, (prev.criticalCount || 0) - 1) : prev.criticalCount,
            highCount: removedConvo?.urgency === 'high' ? Math.max(0, (prev.highCount || 0) - 1) : prev.highCount,
            mediumCount: removedConvo?.urgency === 'medium' ? Math.max(0, (prev.mediumCount || 0) - 1) : prev.mediumCount
          }));
        }
      }
    } catch (err) {
      console.error('Error sending message:', err);
      const errorMessage = err.response?.data?.detail || 'Failed to send message';
      setError(errorMessage);
      
      // If it's a profanity violation (400 or 403 status), trigger violation reload
      if (err.response?.status === 400 || err.response?.status === 403) {
        window.dispatchEvent(new Event('violationUpdate'));
      }
    }
  };

  const handleMessageDeleted = (messageId) => {
    // Remove message from local state
    setMessages(prev => prev.filter(msg => (msg._id || msg.id) !== messageId));
    // Reload conversations to update last message
    loadConversations();
  };

  if (loading) {
    return (
      <div className="messages-loading">
        <div className="spinner-border text-primary"></div>
        <p>Loading messages...</p>
      </div>
    );
  }

  const handleBackToList = () => {
    setSelectedUser(null);
    setOtherUser(null);
    setMessages([]);
  };

  return (
    <div className="messages-page">
      {/* Warning Banner for High/Medium/Pending messages (dismissible, non-blocking) */}
      {unattendedData && unattendedData.warningCount > 0 && unattendedData.criticalCount === 0 && !pendingDismissed && (
        <div className="pending-warning-banner">
          <div className="pending-warning-content">
            <span className="pending-icon">💬</span>
            <div className="pending-text">
              <strong>You have {unattendedData.warningCount} message{unattendedData.warningCount > 1 ? 's' : ''} waiting for a response</strong>
              <span className="pending-subtext">
                {unattendedData.highCount > 0 && `🟠 ${unattendedData.highCount} high (6-9 days) `}
                {unattendedData.mediumCount > 0 && `🟡 ${unattendedData.mediumCount} medium (3-5 days) `}
                {unattendedData.pendingCount > 0 && `💬 ${unattendedData.pendingCount} pending (1-2 days)`}
              </span>
            </div>
            <button 
              className="pending-action-btn"
              onClick={() => {
                const warningConvo = unattendedData.conversations?.find(c => ['high', 'medium', 'pending'].includes(c.urgency));
                if (warningConvo) handleSelectUser(warningConvo.sender.username);
              }}
            >
              View Messages
            </button>
            <button 
              className="pending-dismiss-btn"
              onClick={() => setPendingDismissed(true)}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Critical Chats Banner (10+ days - BLOCKS navigation) */}
      {unattendedData && unattendedData.criticalCount > 0 && (
        <div className="unattended-banner">
          <div className="unattended-banner-content">
            <span className="unattended-icon">�</span>
            <div className="unattended-text">
              <strong>You have {unattendedData.criticalCount} critical message{unattendedData.criticalCount > 1 ? 's' : ''} (10+ days) requiring your response</strong>
              <p className="unattended-explanation">
                Someone took the time to reach out to you! Please respond to each conversation (open the message by selecting the profile card on the left) or politely decline using the <strong>⚡ Quick Messages → Decline</strong> option. 
                You'll be able to browse other areas once critical messages are addressed.
                <br /><span className="exclusion-tip">💡 Tip: If you're not interested, you can also add them to your exclusions list to avoid future messages from this profile.</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}
      
      <div 
        ref={containerRef}
        className={`messages-container ${selectedUser ? 'chat-active' : ''} ${isResizing ? 'resizing' : ''}`}
        style={{ gridTemplateColumns: `${sidebarWidth}px 6px 1fr` }}
      >
        <MessageList
          conversations={conversations}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          currentUsername={currentUsername}
          unattendedData={unattendedData}
        />
        <div 
          className="messages-resizer"
          onMouseDown={handleMouseDown}
        />
        <ChatWindow
          messages={messages}
          currentUsername={currentUsername}
          otherUser={otherUser}
          onSendMessage={handleSendMessage}
          onMessageDeleted={handleMessageDeleted}
          onBack={handleBackToList}
          conversationStatus={conversationStatus}
          onCloseConversation={handleCloseConversation}
        />
      </div>
    </div>
  );
};

export default Messages;
