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
  const [selectedConversation, setSelectedConversation] = useState(null);
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
  const selectedUserRef = useRef(null);
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
    
    const urlParams = new URLSearchParams(location.search);
    const toUsername = urlParams.get('to');

    // Load unattended first so sort order is correct when conversations arrive
    loadUnattendedChats().then((unattended) => {
      loadConversations(unattended).then((convos) => {
        if (toUsername) {
          handleSelectUser(toUsername);
        } else if (convos.length > 0 && !selectedUser) {
          handleSelectUser(convos[0].username);
        }
      });
    });

    // Listen for real-time messages (uses ref to avoid re-registering on every selection change)
    const handleNewMessage = (data) => {
      console.log('💬 New message received:', data);
      
      // If the message is from the currently selected user, add it to messages
      if (selectedUserRef.current && data.from === selectedUserRef.current) {
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
      if (e.key === 'Escape' && selectedUserRef.current) {
        setSelectedUser(null);
        selectedUserRef.current = null;
      }
    };
    document.addEventListener('keydown', handleEscKey);

    return () => {
      socketService.off('new_message', handleNewMessage);
      document.removeEventListener('keydown', handleEscKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, currentUsername]);

  const loadConversations = async (unattendedOverride) => {
    console.log('📥 Messages.js: Loading conversations for:', currentUsername);
    try {
      // Try to load from messenger API first (includes US Vedika group)
      let url = `/messenger/conversations`;
      console.log('📡 Messages.js: Making request to messenger API:', url);
      let response = await api.get(url);
      console.log('✅ Messages.js: Messenger API response received:', response.data);
      
      let convos = response.data.conversations || [];
      
      // Try to get or create US Vedika group if not in conversations
      try {
        const usVedikaResponse = await api.get('/messenger/us-vedika/group');
        if (usVedikaResponse.data.success) {
          const usVedikaConv = usVedikaResponse.data.conversation;
          // Check if US Vedika is already in the list
          const hasUsVedika = convos.some(c => c.id === usVedikaConv.id || c.groupName === 'US Vedika');
          if (!hasUsVedika) {
            console.log('🇺🇸 Adding US Vedika group to conversations');
            convos.unshift({
              id: usVedikaConv.id,
              username: usVedikaConv.id, // Use conversation ID as username for selection
              groupName: usVedikaConv.groupName || 'US Vedika',
              type: usVedikaConv.type || 'public_group',
              lastMessage: usVedikaConv.lastMessage || null,
              lastMessageTime: usVedikaConv.lastMessageAt || usVedikaConv.createdAt,
              unreadCount: 0
            });
          }
        }
      } catch (usVedikaError) {
        console.warn('⚠️ Could not load US Vedika group:', usVedikaError.message);
      }
      
      // If no conversations from messenger API, fall back to old messages API
      if (convos.length === 0) {
        console.log('📡 Messages.js: No conversations from messenger API, falling back to messages API');
        url = `/messages/conversations`;
        response = await api.get(url);
        console.log('✅ Messages.js: Messages API response received:', response.data);
        
        // Transform old format to new format
        const oldConvos = response.data || [];
        convos = oldConvos.map(conv => ({
          id: conv._id || conv.username,
          username: conv.username,
          firstName: conv.firstName,
          lastName: conv.lastName,
          lastMessage: conv.lastMessage?.message || conv.lastMessage,
          lastMessageTime: conv.lastMessage?.createdAt || conv.lastMessageTime,
          unreadCount: conv.unreadCount || 0,
          type: 'direct' // Old API only supports 1:1
        }));
      }
      
      console.log('📊 Messages.js: Conversations count:', convos.length);
      
      // Sort conversations by urgency level (use fresh unattended data if provided)
      convos = sortConversationsByUrgency(convos, unattendedOverride);
      
      setConversations(convos);
      setLoading(false);
      
      // Log messages page viewed with conversation count
      logMessagesPageViewed(convos.length);
      return convos;
    } catch (err) {
      console.error('❌ Messages.js: Error loading conversations:', err);
      console.error('❌ Messages.js: Error response:', err.response?.data);
      setError('Failed to load conversations');
      setLoading(false);
      return [];
    }
  };

  const sortConversationsByUrgency = (conversations, unattendedOverride) => {
    const data = unattendedOverride || unattendedData;
    if (!data?.conversations) return conversations;
    
    // Get urgency info for each conversation
    const conversationsWithUrgency = conversations.map(conv => {
      const unattended = data.conversations.find(c => c.sender.username === conv.username);
      return {
        ...conv,
        urgency: unattended?.urgency || 'normal',
        waitingDays: unattended?.lastMessage?.waitingDays || 0
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
      return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
    });
  };

  const loadUnattendedChats = async () => {
    try {
      const response = await api.get('/messages/unattended');
      setUnattendedData(response.data);
      console.log('📬 Unattended chats:', response.data);
      return response.data;
    } catch (err) {
      console.error('Error loading unattended chats:', err);
      return null;
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

  const handleSelectUser = async (usernameOrConversationId) => {
    setSelectedUser(usernameOrConversationId);
    selectedUserRef.current = usernameOrConversationId;
    setMessages([]);
    setOtherUser(null);
    setConversationStatus(null);

    try {
      // Check if this is a group conversation (starts with conversation ID prefix or has group info)
      const conversation = conversations.find(c => c.id === usernameOrConversationId || c.username === usernameOrConversationId);
      
      if (conversation && (conversation.type === 'group' || conversation.type === 'public_group')) {
        // Handle group chat (US Vedika)
        setSelectedConversation(conversation);
        
        // Load messages using messenger API for group chats
        const response = await api.get(`/messenger/conversations/${conversation.id}/messages`);
        setMessages(response.data.messages || []);
        setOtherUser({
          username: conversation.groupName || 'Group Chat',
          firstName: conversation.groupName || 'Group',
          lastName: 'Chat',
          isGroup: true
        });
      } else {
        // Handle 1:1 conversation
        setSelectedConversation(null);
        const response = await api.get(`/messages/conversation/${usernameOrConversationId}?username=${currentUsername}`);
        setMessages(response.data.messages || []);
        setOtherUser(response.data.otherUser);
        
        // Load conversation status
        await loadConversationStatus(usernameOrConversationId);
      }
    } catch (err) {
      console.error('Error loading conversation:', err);
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
    selectedUserRef.current = null;
    setOtherUser(null);
    setMessages([]);
  };

  const handleSendMessage = async (content, options = {}) => {
    try {
      // Check if this is a group chat (US Vedika)
      if (selectedConversation && (selectedConversation.type === 'group' || selectedConversation.type === 'public_group')) {
        // Send to group chat using messenger API
        const payload = {
          senderUsername: currentUsername,
          content: content.trim()
        };
        
        // Add public recipients if provided (for US Vedika)
        if (options.publicRecipients && options.publicRecipients.length > 0) {
          payload.publicRecipients = options.publicRecipients;
          payload.deliveryMode = options.deliveryMode || 'both';
          payload.includeInvitation = options.includeInvitation !== false;
        }
        
        const response = await api.post(`/messenger/conversations/${selectedConversation.id}/messages`, payload);
        setMessages(prev => [...prev, response.data.message]);
        
        // Show success toast
        const toastService = (await import('../services/toastService')).default;
        if (options.publicRecipients && options.publicRecipients.length > 0) {
          toastService.success(`Message sent to ${options.publicRecipients.length} participant(s) via email!`);
        } else {
          toastService.success('Message sent successfully!');
        }
      } else {
        // Send to 1:1 conversation using old messages API
        const response = await api.post(`/messages/send?username=${currentUsername}`, {
          toUsername: selectedUser,
          content: content.trim()
        });
        setMessages(prev => [...prev, response.data.data]);
        
        // Also send via WebSocket for real-time delivery (only if connected)
        try {
          if (socketService.isConnected()) {
            socketService.sendMessage(selectedUser, content.trim());
            console.log('✅ Message sent via WebSocket for real-time delivery');
          } else {
            console.log('📡 WebSocket not connected, message saved to DB only');
          }
        } catch (wsError) {
          console.warn('⚠️ WebSocket send failed, but message saved to DB:', wsError.message);
        }
        
        // Refresh unattended data first, then reload conversations with fresh urgency data
        const freshUnattended = await loadUnattendedChats();
        await loadConversations(freshUnattended);
        
        // Show success toast
        const toastService = (await import('../services/toastService')).default;
        toastService.success('Message sent successfully!');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const toastService = (await import('../services/toastService')).default;
      toastService.error('Failed to send message');
    }
  };

  const handleQuickResponse = async (username, responseType) => {
    // Select the conversation first
    handleSelectUser(username);
    
    // Wait a moment for the conversation to load
    setTimeout(async () => {
      let message = '';
      
      switch (responseType) {
        case 'interested':
          message = "Hi! We're interested in learning more about you. Would you like to connect further?";
          break;
        case 'not_interested':
          message = "Thank you for your interest, but we don't feel this is the right match for us. Best wishes!";
          break;
        case 'need_time':
          message = "Hi! We're interested but need a bit more time to review. We'll get back to you soon.";
          break;
        default:
          return;
      }
      
      // Send the message
      await handleSendMessage(message);
      
      // If not interested, also close conversation and add to exclusions
      if (responseType === 'not_interested') {
        setTimeout(async () => {
          try {
            await handleCloseConversation(username);
            const formData = new FormData();
            formData.append('reason', 'Not interested - declined via quick response');
            await api.post(`/exclusions/${username}`, formData);
            
            const toastService = (await import('../services/toastService')).default;
            toastService.success('Conversation closed and user added to exclusions');
          } catch (error) {
            console.error('Error handling not interested:', error);
          }
        }, 1000);
      }
    }, 500);
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
          onQuickResponse={handleQuickResponse}
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
          isGroupChat={!!selectedConversation}
          groupInfo={selectedConversation}
        />
      </div>
    </div>
  );
};

export default Messages;
