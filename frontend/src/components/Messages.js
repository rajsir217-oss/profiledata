import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
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
  }, [location]);

  const loadConversations = async () => {
    try {
      const response = await api.get(`/api/messages/conversations?username=${currentUsername}`);
      setConversations(response.data.conversations || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Failed to load conversations');
      setLoading(false);
    }
  };

  const handleSelectUser = async (username) => {
    setSelectedUser(username);
    setMessages([]);
    setOtherUser(null);

    try {
      const response = await api.get(`/api/messages/conversation/${username}?username=${currentUsername}`);
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
      const response = await api.post(`/api/messages/send?username=${currentUsername}`, {
        toUsername: selectedUser,
        content: content.trim()
      });

      // Add message to local state
      const newMsg = response.data.data;
      setMessages(prev => [...prev, newMsg]);

      // Update conversation list
      await loadConversations();
    } catch (err) {
      console.error('Error sending message:', err);
      setError('Failed to send message');
    }
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
        />
      </div>
    </div>
  );
};

export default Messages;
