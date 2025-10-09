import React, { useState, useEffect } from 'react';
import api from '../api';
import messagePollingService from '../services/messagePollingService';
import onlineStatusService from '../services/onlineStatusService';
import ChatWindow from './ChatWindow';
import './MessageModal.css';

const MessageModal = ({ isOpen, profile, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (isOpen && profile) {
      loadConversation();
      checkOnlineStatus();
      
      // Check online status every 30 seconds
      const onlineCheckInterval = setInterval(() => {
        checkOnlineStatus();
      }, 30000);
      
      // Check for any pending messages that arrived while modal was closed
      const pendingMessages = messagePollingService.getPendingMessages(currentUsername, profile.username);
      if (pendingMessages.length > 0) {
        console.log(`📥 Processing ${pendingMessages.length} pending messages`);
        pendingMessages.forEach(msg => {
          setMessages(prev => {
            // Check if message already exists
            const exists = prev.some(existing => 
              existing.from_username === msg.from && 
              existing.to_username === msg.to &&
              existing.message === msg.message &&
              Math.abs(new Date(existing.timestamp) - new Date(msg.timestamp)) < 1000
            );
            
            if (exists) return prev;
            
            return [...prev, {
              from_username: msg.from,
              to_username: msg.to,
              message: msg.message,
              timestamp: msg.timestamp,
              is_read: false
            }];
          });
        });
      }
      
      // Listen for real-time messages via polling
      const handleNewMessage = (data) => {
        console.log('💬 MessageModal: New message received:', data);
        console.log('🔍 Current chat with:', profile.username);
        console.log('🔍 Message from:', data.from, 'to:', data.to);
        console.log('🔍 Current user:', currentUsername);
        
        // Check if this message is part of the current conversation
        // Either: we sent it to them, OR they sent it to us
        const isFromThem = data.from === profile.username && data.to === currentUsername;
        const isFromUs = data.from === currentUsername && data.to === profile.username;
        const isRelevant = isFromThem || isFromUs;
        
        console.log('🔍 Is from them?', isFromThem);
        console.log('🔍 Is from us?', isFromUs);
        console.log('🔍 Is relevant?', isRelevant);
        
        if (isRelevant) {
          console.log('✅ Message is part of current conversation, adding to UI');
          
          // Check if message already exists (prevent duplicates)
          setMessages(prev => {
            const exists = prev.some(msg => 
              msg.from_username === data.from && 
              msg.to_username === data.to &&
              msg.message === data.message &&
              Math.abs(new Date(msg.timestamp) - new Date(data.timestamp)) < 1000
            );
            
            if (exists) {
              console.log('⚠️ Message already exists, skipping');
              return prev;
            }
            
            const newMessage = {
              from_username: data.from,
              to_username: data.to,
              message: data.message,
              timestamp: data.timestamp,
              is_read: false
            };
            
            console.log('📝 Adding new message to state');
            return [...prev, newMessage];
          });
        } else {
          console.log('⏭️ Message not part of current conversation, ignoring');
        }
      };

      messagePollingService.onNewMessage(handleNewMessage);

      return () => {
        messagePollingService.offNewMessage(handleNewMessage);
        clearInterval(onlineCheckInterval);
      };
    }
  }, [isOpen, profile, currentUsername]);

  const checkOnlineStatus = async () => {
    if (!profile?.username) return;
    
    try {
      const online = await onlineStatusService.isUserOnline(profile.username);
      setIsOnline(online);
    } catch (error) {
      console.error('Error checking online status:', error);
    }
  };

  const loadConversation = async () => {
    if (!profile?.username) {
      console.warn('⚠️ No profile username, skipping conversation load');
      return;
    }
    
    console.log('📥 Loading conversation with:', profile.username);
    setLoading(true);
    try {
      const response = await api.get(
        `/api/messages/conversation/${profile.username}?username=${currentUsername}`
      );
      console.log('✅ Conversation loaded:', response.data.messages?.length || 0, 'messages');
      setMessages(response.data.messages || []);
    } catch (err) {
      console.error('❌ Error loading conversation:', err);
      console.error('Error details:', err.response?.data || err.message);
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
      
      // Message will be delivered via Redis polling (no WebSocket needed)
      console.log('✅ MessageModal: Message sent, will be delivered via polling');
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
            <div className="modal-avatar-container">
              {profile?.images?.[0] ? (
                <img src={profile.images[0]} alt={profile.username} className="modal-avatar" />
              ) : (
                <div className="modal-avatar-placeholder">
                  {profile?.firstName?.[0] || profile?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className={`online-status-indicator ${isOnline ? '' : 'offline'}`} 
                   title={isOnline ? 'Online' : 'Offline'} />
            </div>
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
