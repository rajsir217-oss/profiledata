import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import PageHeader from './PageHeader';
import MessageList from './MessageList';
import ChatWindow from './ChatWindow';
import './Messages.css';

const Messages = () => {
  const [conversations, setConversations] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const location = useLocation();
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (!currentUsername) {
      navigate('/login');
      return;
    }
    loadConversations();

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

    return () => {
      socketService.off('new_message', handleNewMessage);
    };
  }, [location, selectedUser, currentUsername]);

  const loadConversations = async () => {
    console.log('📥 Messages.js: Loading conversations for:', currentUsername);
    try {
      const url = `/messages/conversations?username=${currentUsername}`;
      console.log('📡 Messages.js: Making request to:', url);
      const response = await api.get(url);
      console.log('✅ Messages.js: Response received:', response.data);
      console.log('📊 Messages.js: Conversations count:', response.data.conversations?.length || 0);
      setConversations(response.data.conversations || []);
      setLoading(false);
    } catch (err) {
      console.error('❌ Messages.js: Error loading conversations:', err);
      console.error('❌ Messages.js: Error response:', err.response?.data);
      setError('Failed to load conversations');
      setLoading(false);
    }
  };

  const handleSelectUser = async (username) => {
    setSelectedUser(username);
    setMessages([]);
    setOtherUser(null);

    try {
      const response = await api.get(`/messages/conversation/${username}?username=${currentUsername}`);
      setMessages(response.data.messages || []);
      setOtherUser(response.data.otherUser);
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

  return (
    <div className="messages-page">
      <PageHeader
        icon="💬"
        title="My Messages"
        subtitle="Communicate with your connections"
        variant="gradient"
      />
      
      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}
      
      <div className="messages-container">
        <MessageList
          conversations={conversations}
          selectedUser={selectedUser}
          onSelectUser={handleSelectUser}
          currentUsername={currentUsername}
        />
        <ChatWindow
          messages={messages}
          currentUsername={currentUsername}
          otherUser={otherUser}
          onSendMessage={handleSendMessage}
          onMessageDeleted={handleMessageDeleted}
        />
      </div>
    </div>
  );
};

export default Messages;
