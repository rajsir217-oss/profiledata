import React, { useState, useEffect } from 'react';
import api from '../api';
import socketService from '../services/socketService';
import ChatWindow from './ChatWindow';
import './MessageModal.css';

const MessageModal = ({ isOpen, profile, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (isOpen && profile) {
      loadConversation();
      
      // Listen for real-time messages
      const handleNewMessage = (data) => {
        console.log('💬 MessageModal: New message received:', data);
        
        // If message is from the profile user we're chatting with
        if (data.from === profile.username) {
          const newMessage = {
            from_username: data.from,
            to_username: currentUsername,
            message: data.message,
            timestamp: data.timestamp,
            is_read: false
          };
          setMessages(prev => [...prev, newMessage]);
        }
      };

      socketService.on('new_message', handleNewMessage);

      return () => {
        socketService.off('new_message', handleNewMessage);
      };
    }
  }, [isOpen, profile, currentUsername]);

  const loadConversation = async () => {
    if (!profile?.username) return;
    
    setLoading(true);
    try {
      const response = await api.get(
        `/api/messages/conversation/${profile.username}?username=${currentUsername}`
      );
      setMessages(response.data.messages || []);
    } catch (err) {
      console.error('Error loading conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim() || !profile?.username) return;

    try {
      const response = await api.post(
        `/api/messages/send?username=${currentUsername}`,
        {
          toUsername: profile.username,
          content: content.trim()
        }
      );

      const newMsg = response.data.data;
      setMessages(prev => [...prev, newMsg]);
      
      // Send real-time notification via WebSocket
      console.log('📤 MessageModal: Sending real-time message via WebSocket');
      socketService.sendMessage(profile.username, content.trim());
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('message-modal-overlay')) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="message-modal-overlay" onClick={handleOverlayClick}>
      <div className="message-modal">
        <div className="message-modal-header">
          <div className="modal-user-info">
            {profile?.images?.[0] ? (
              <img src={profile.images[0]} alt={profile.username} className="modal-avatar" />
            ) : (
              <div className="modal-avatar-placeholder">
                {profile?.firstName?.[0] || profile?.username?.[0]?.toUpperCase()}
              </div>
            )}
            <div>
              <h3>{profile?.firstName || profile?.username}</h3>
              <p>{profile?.location || 'Location not specified'}</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="message-modal-body">
          {loading ? (
            <div className="modal-loading">
              <div className="spinner-border text-primary"></div>
              <p>Loading messages...</p>
            </div>
          ) : (
            <ChatWindow
              messages={messages}
              currentUsername={currentUsername}
              otherUser={profile}
              onSendMessage={handleSendMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageModal;
