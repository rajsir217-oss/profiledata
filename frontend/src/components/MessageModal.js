import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import api from '../api';
import socketService from '../services/socketService';
import ChatWindow from './ChatWindow';
// eslint-disable-next-line no-unused-vars
import { getAuthenticatedImageUrl } from '../utils/imageUtils';
import { getProfilePicUrl } from '../utils/urlHelper';
import './MessageModal.css';

const MessageModal = ({ isOpen, profile, onClose, onMessageDeleted }) => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const [unattendedData, setUnattendedData] = useState(null);
  const currentUsername = localStorage.getItem('username');

  useEffect(() => {
    if (isOpen && profile) {
      loadConversation();
      checkOnlineStatus();
      loadUnattendedData();
      
      // Listen for real-time messages via WebSocket
      const handleNewMessage = (data) => {
        console.log('💬 MessageModal: New message via WebSocket');
        console.log('   From:', data.from, 'To:', data.to);
        console.log('   Current conversation with:', profile.username);
        console.log('   Current user:', currentUsername);
        
        // Check if this message is part of the current conversation
        const isFromThem = data.from === profile.username && (data.to === currentUsername || !data.to);
        const isFromUs = data.from === currentUsername && data.to === profile.username;
        
        console.log('   Is from them?', isFromThem);
        console.log('   Is from us?', isFromUs);
        
        if (isFromThem || isFromUs) {
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
            
            console.log('➕ Adding message to state');
            return [...prev, {
              from_username: data.from,
              to_username: data.to,
              message: data.message,
              timestamp: data.timestamp,
              is_read: false
            }];
          });
        } else {
          console.log('⏭️ Message not for current conversation, ignoring');
        }
      };

      // Listen for online status changes
      const handleUserOnline = (data) => {
        if (data.username === profile.username) {
          setIsOnline(true);
        }
      };

      const handleUserOffline = (data) => {
        if (data.username === profile.username) {
          setIsOnline(false);
        }
      };

      socketService.on('new_message', handleNewMessage);
      socketService.on('user_online', handleUserOnline);
      socketService.on('user_offline', handleUserOffline);

      return () => {
        socketService.off('new_message', handleNewMessage);
        socketService.off('user_online', handleUserOnline);
        socketService.off('user_offline', handleUserOffline);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, profile, currentUsername]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
      return () => {
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose]);

  const checkOnlineStatus = async () => {
    if (!profile?.username) return;
    
    try {
      const online = await socketService.isUserOnline(profile.username);
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
        `/messages/conversation/${profile.username}?username=${currentUsername}`
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

  const loadUnattendedData = async () => {
    try {
      const response = await api.get('/messages/unattended');
      setUnattendedData(response.data);
    } catch (error) {
      console.error('Error loading unattended data:', error);
    }
  };

  const getUrgencyInfo = () => {
    if (!unattendedData?.conversations || !profile?.username) return null;
    const unattended = unattendedData.conversations.find(c => c.sender.username === profile.username);
    if (!unattended) return null;
    return {
      urgency: unattended.urgency,
      waitingDays: unattended.lastMessage?.waitingDays || 0
    };
  };

  const getUrgencyBadge = (urgency) => {
    const badges = {
      'critical': { emoji: '🔴', text: 'CRITICAL', class: 'critical' },
      'high': { emoji: '🟠', text: 'HIGH', class: 'high' },
      'medium': { emoji: '🟡', text: 'MEDIUM', class: 'medium' },
      'pending': { emoji: '🔵', text: 'PENDING', class: 'pending' }
    };
    return badges[urgency] || null;
  };

  const handleQuickResponse = async (responseType) => {
    let message = '';
    
    switch (responseType) {
      case 'interested':
        message = "Hi! We're interested in learning more about you. Would you like to connect further?";
        break;
      case 'not_interested':
        message = "Thank you for reaching out, but we don't think we're a match. We wish you the best in your search!";
        break;
      case 'need_time':
        message = "Thanks for your message! We need some time to review your profile. We'll get back to you soon.";
        break;
    }
    
    if (message) {
      await handleSendMessage(message);
    }
  };

  const handleSendMessage = async (content) => {
    if (!content.trim() || !profile?.username) return;

    try {
      // Save message to database via API
      const response = await api.post(
        `/messages/send?username=${currentUsername}`,
        {
          toUsername: profile.username,
          content: content.trim()
        }
      );

      const newMsg = response.data.data;
      setMessages(prev => [...prev, newMsg]);
      
      // Also send via WebSocket for real-time delivery (only if connected)
      try {
        if (socketService.isConnected()) {
          socketService.sendMessage(profile.username, content.trim());
          console.log('✅ Message sent via WebSocket for real-time delivery');
        } else {
          console.log('📡 WebSocket not connected, message saved to DB only');
        }
      } catch (wsError) {
        console.warn('⚠️ WebSocket send failed, but message saved to DB:', wsError.message);
      }

      // Refresh critical messages count since we just responded to a conversation
      // This will immediately update the red pulsing icon if this was a critical message
      try {
        if (profile.onCriticalCountUpdate) {
          await profile.onCriticalCountUpdate();
          console.log('🔄 Critical messages count updated immediately after sending message');
        } else {
          // Fallback: just log that we couldn't update immediately
          console.log('📡 No critical count update callback available');
        }
      } catch (error) {
        console.warn('⚠️ Could not update critical messages count:', error);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const handleMessageDeleted = (messageId) => {
    console.log('🗑️ MessageModal: Message deleted, refreshing local state');
    // Remove message from local state immediately
    setMessages(prev => prev.filter(msg => (msg._id || msg.id) !== messageId));
    
    // Call parent callback if provided
    if (onMessageDeleted) {
      onMessageDeleted(messageId);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('message-modal-overlay')) {
      onClose();
    }
  };

  if (!isOpen) return null;

  // Use Portal to render modal at document body level to escape z-index stacking context
  return createPortal(
    <div className="message-modal-overlay" onClick={handleOverlayClick}>
      <div className="message-modal">
        <div className="message-modal-header">
          <div className="modal-user-info">
            <div className="modal-avatar-container">
              {getProfilePicUrl(profile) ? (
                <img src={getProfilePicUrl(profile)} alt={profile.username} className="modal-avatar" />
              ) : (
                <div className="modal-avatar-placeholder">
                  {profile?.firstName?.[0] || profile?.username?.[0]?.toUpperCase()}
                </div>
              )}
              <div className={`online-status-indicator ${isOnline ? '' : 'offline'}`} 
                   title={isOnline ? 'Online' : 'Offline'} />
            </div>
            <div>
              <div className="modal-user-header">
                <h3>
                  {profile?.firstName || profile?.username}
                  {/* Urgency Badge - INSIDE the h3 element */}
                  {(() => {
                    const urgencyInfo = getUrgencyInfo();
                    const badge = urgencyInfo ? getUrgencyBadge(urgencyInfo.urgency) : null;
                    return badge ? (
                      <span className={`urgency-badge ${badge.class}`}>
                        {badge.emoji} {badge.text}
                      </span>
                    ) : null;
                  })()}
                </h3>
              </div>
              <p>
                {profile?.location || 'Location not specified'}
                {(() => {
                  const h = profile?.height || (profile?.heightInches ? `${Math.floor(profile.heightInches / 12)}'${profile.heightInches % 12}"` : null);
                  return h ? ` · ${h}` : '';
                })()}
                {(() => {
                  let age = profile?.age;
                  if (!age && profile?.birthYear) {
                    const now = new Date();
                    age = now.getFullYear() - parseInt(profile.birthYear);
                    if (profile.birthMonth && (now.getMonth() + 1) < parseInt(profile.birthMonth)) age--;
                  }
                  return age ? ` · ${age}yrs` : '';
                })()}
                {profile?.eatingPreference && profile.eatingPreference !== 'None' ? ` · ${profile.eatingPreference}` : ''}
              </p>
              {/* Quick Actions for urgent conversations */}
              {(() => {
                const urgencyInfo = getUrgencyInfo();
                if (urgencyInfo && (urgencyInfo.urgency === 'critical' || urgencyInfo.urgency === 'high')) {
                  return (
                    <div className="modal-quick-actions">
                      <button 
                        className="quick-action-btn interested"
                        onClick={() => handleQuickResponse('interested')}
                        title="Send positive response"
                      >
                        💝
                      </button>
                      <button 
                        className="quick-action-btn not-interested"
                        onClick={() => handleQuickResponse('not_interested')}
                        title="Politely decline"
                      >
                        🙏
                      </button>
                      <button 
                        className="quick-action-btn need-time"
                        onClick={() => handleQuickResponse('need_time')}
                        title="Request more time"
                      >
                        ⏰
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
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
              onMessageDeleted={handleMessageDeleted}
            />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default MessageModal;
