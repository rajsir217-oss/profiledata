// frontend/src/components/NotificationTester.js
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './NotificationTester.css';
import DeleteButton from './DeleteButton';

// Create a custom API instance with session handling
import { getBackendUrl } from '../config/apiConfig';
import { addSessionInterceptor } from '../utils/axiosInterceptors';
const notificationApi = addSessionInterceptor(axios.create({
  baseURL: getBackendUrl()
}));

// Add response interceptor for better error handling
notificationApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('❌ Notification API: Unauthorized (401) - Token may be invalid or expired');
    } else if (error.response?.status === 403) {
      console.error('❌ Notification API: Forbidden (403) - Insufficient permissions');
    }
    return Promise.reject(error);
  }
);

const NotificationTester = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [queue, setQueue] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Notification triggers with friendly names
  const triggers = [
    { id: 'new_match', name: 'New Match', icon: '💘', category: 'Matches' },
    { id: 'mutual_favorite', name: 'Mutual Favorite', icon: '💕', category: 'Matches' },
    { id: 'shortlist_added', name: 'Shortlist Added', icon: '⭐', category: 'Matches' },
    { id: 'match_milestone', name: 'Match Milestone', icon: '🎉', category: 'Matches' },
    { id: 'profile_view', name: 'Profile View', icon: '👁️', category: 'Activity' },
    { id: 'favorited', name: 'Someone Favorited You', icon: '❤️', category: 'Activity' },
    { id: 'new_message', name: 'New Message', icon: '💬', category: 'Messages' },
    { id: 'message_read', name: 'Message Read', icon: '✓✓', category: 'Messages' },
    { id: 'pii_request', name: 'PII Request', icon: '🔒', category: 'Privacy' },
    { id: 'pii_granted', name: 'PII Access Granted', icon: '✅', category: 'Privacy' },
    { id: 'unread_messages', name: 'Unread Messages', icon: '📨', category: 'Engagement' },
  ];

  const channels = ['email', 'sms', 'push'];

  const loadUserData = useCallback(async () => {
    try {
      // Try getting username from localStorage (it's stored as a string, not object)
      const username = localStorage.getItem('username');
      console.log('👤 Loading user data, username from localStorage:', username);
      
      if (username) {
        // Create a user object with the username
        const user = {
          username: username,
          firstName: username // Fallback to username if firstName not available
        };
        
        console.log('✅ Current user set:', user);
        setCurrentUser(user);
        
        await Promise.all([
          loadQueue(username),
          loadAnalytics(username),
          loadPreferences(username)
        ]);
      } else {
        console.warn('⚠️ No username found in localStorage - user not logged in');
      }
    } catch (error) {
      console.error('❌ Error loading user data:', error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const loadQueue = async (username) => {
    try {
      // Backend uses JWT token for username, not query param
      console.log('📬 Loading notification queue...');
      const response = await notificationApi.get('/api/notifications/queue?limit=20');
      console.log('📬 Queue response:', response.data);
      console.log('📬 Queue length:', response.data?.length || 0);
      setQueue(response.data || []);
    } catch (error) {
      console.error('❌ Error loading queue:', error);
      console.error('❌ Error response:', error.response?.data);
      showToast('Failed to load notification queue', 'error');
    }
  };

  const loadAnalytics = async (username) => {
    try {
      // Backend uses JWT token for username, not query param
      const response = await notificationApi.get('/api/notifications/analytics?days=7');
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
      showToast('Failed to load analytics', 'error');
    }
  };

  const loadPreferences = async (username) => {
    try {
      // Backend uses JWT token for username, not query param
      await notificationApi.get('/api/notifications/preferences');
      // Preferences loaded successfully
    } catch (error) {
      console.error('Error loading preferences:', error);
      showToast('Failed to load preferences', 'error');
    }
  };

  const sendTestNotification = async (trigger, selectedChannels) => {
    console.log('📨 sendTestNotification called:', { trigger, selectedChannels, currentUser: currentUser?.username });
    
    if (!currentUser) {
      console.error('❌ No current user, cannot send notification');
      showToast('Please login first', 'error');
      return;
    }

    setLoading(true);
    console.log('⏳ Loading state set to true');
    
    try {
      const testData = {
        username: currentUser.username,
        trigger: trigger,
        channels: selectedChannels,
        templateData: {
          recipient: {
            firstName: currentUser.firstName || 'User',
            username: currentUser.username
          },
          match: {
            firstName: 'Test User',
            age: 28,
            matchScore: 95,
            location: 'San Francisco, CA'
          },
          event: {
            type: trigger,
            timestamp: new Date().toISOString()
          },
          app: {
            profileUrl: `${window.location.origin}/profile/testuser`,
            chatUrl: `${window.location.origin}/messages`
          }
        },
        priority: 'high'
      };

      console.log('📤 Sending notification:', testData);
      const response = await notificationApi.post('/api/notifications/send', testData);
      console.log('✅ Notification response:', response.data);
      
      showToast(`Test notification sent: ${trigger}`, 'success');
      
      // Reload queue to show new notification
      setTimeout(() => {
        console.log('🔄 Reloading queue...');
        loadQueue(currentUser.username);
      }, 1000);
    } catch (error) {
      console.error('Error sending notification:', error);
      showToast('Failed to send test notification', 'error');
    } finally {
      setLoading(false);
    }
  };

  const deleteNotification = async (notification) => {
    try {
      // Determine if this is a hard delete (for cancelled items) or soft delete
      const isCancelled = notification.status === 'cancelled';
      const deleteType = isCancelled ? 'hard_delete=true' : '';
      
      console.log(`🗑️ ${isCancelled ? 'Permanently deleting' : 'Cancelling'} notification:`, notification._id);
      
      await notificationApi.delete(
        `/api/notifications/queue/${notification._id}${deleteType ? '?' + deleteType : ''}`
      );
      
      showToast(
        isCancelled ? 'Notification permanently deleted' : 'Notification cancelled',
        'success'
      );
      
      // Reload queue
      setTimeout(() => {
        loadQueue(currentUser.username);
      }, 500);
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      showToast('Failed to delete notification', 'error');
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const groupedTriggers = triggers.reduce((acc, trigger) => {
    if (!acc[trigger.category]) {
      acc[trigger.category] = [];
    }
    acc[trigger.category].push(trigger);
    return acc;
  }, {});

  if (!currentUser) {
    return (
      <div className="notification-tester">
        <div className="tester-header">
          <h1>🔔 Notification Tester</h1>
          <p>Please login to test notifications</p>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-tester">
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.message}
        </div>
      )}

      <div className="tester-header">
        <h1>🔔 Notification Tester</h1>
        <p>Test and manage notification system for <strong>{currentUser.username}</strong></p>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="analytics-section">
          <h2>📊 Analytics (Last 7 Days)</h2>
          <div className="analytics-grid">
            <div className="stat-card">
              <div className="stat-icon">📨</div>
              <div className="stat-value">{analytics.total_sent || 0}</div>
              <div className="stat-label">Total Sent</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✓</div>
              <div className="stat-value">{analytics.delivered || 0}</div>
              <div className="stat-label">Delivered</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">👁️</div>
              <div className="stat-value">{analytics.opened || 0}</div>
              <div className="stat-label">Opened</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🖱️</div>
              <div className="stat-value">{analytics.clicked || 0}</div>
              <div className="stat-label">Clicked</div>
            </div>
          </div>
        </div>
      )}

      {/* Test Notification Triggers */}
      <div className="triggers-section">
        <h2>🧪 Test Notifications</h2>
        <p className="section-description">Click any notification type below to send a test</p>

        {Object.entries(groupedTriggers).map(([category, categoryTriggers]) => (
          <div key={category} className="trigger-category">
            <h3>{category}</h3>
            <div className="trigger-grid">
              {categoryTriggers.map((trigger) => (
                <TestTriggerCard
                  key={trigger.id}
                  trigger={trigger}
                  onSend={sendTestNotification}
                  loading={loading}
                  channels={channels}
                  showToast={showToast}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Notification Queue */}
      <div className="queue-section">
        <div className="section-header">
          <h2>📬 Notification Queue</h2>
          <button 
            className="btn btn-secondary"
            onClick={() => loadQueue(currentUser.username)}
          >
            🔄 Refresh
          </button>
        </div>

        {queue.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No pending notifications</p>
          </div>
        ) : (
          <div className="queue-list">
            {queue.map((notification, index) => (
              <div key={index} className="queue-item">
                <div className="queue-item-content">
                  <div className="queue-item-header">
                    <span className="queue-trigger">{notification.trigger}</span>
                    <span className="queue-status">{notification.status}</span>
                  </div>
                  <div className="queue-channels">
                    {notification.channels.map((ch) => (
                      <span key={ch} className="channel-badge">{ch}</span>
                    ))}
                  </div>
                  <div className="queue-time">
                    Scheduled: {new Date(notification.scheduled_at).toLocaleString()}
                  </div>
                </div>
                <DeleteButton
                  onDelete={() => deleteNotification(notification)}
                  itemName="notification"
                  size="medium"
                  confirmText={notification.status === 'cancelled' ? 'Delete?' : 'Cancel?'}
                  icon={notification.status === 'cancelled' ? '🗑️' : '🗑️'}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Sub-component for each trigger card
const TestTriggerCard = ({ trigger, onSend, loading, channels, showToast }) => {
  const [selectedChannels, setSelectedChannels] = useState(['email']);

  const toggleChannel = (channel) => {
    if (selectedChannels.includes(channel)) {
      setSelectedChannels(selectedChannels.filter(ch => ch !== channel));
    } else {
      setSelectedChannels([...selectedChannels, channel]);
    }
  };

  const handleSend = () => {
    console.log('🎯 Send button clicked for:', trigger.name, 'Channels:', selectedChannels);
    
    if (selectedChannels.length === 0) {
      console.warn('⚠️ No channels selected');
      showToast('Please select at least one channel', 'error');
      return;
    }
    
    console.log('✅ Calling onSend with:', trigger.id, selectedChannels);
    onSend(trigger.id, selectedChannels);
  };

  return (
    <div className="trigger-card">
      <div className="trigger-icon">{trigger.icon}</div>
      <div className="trigger-name">{trigger.name}</div>
      
      <div className="channel-selector">
        {channels.map((channel) => (
          <button
            key={channel}
            className={`channel-btn ${selectedChannels.includes(channel) ? 'active' : ''}`}
            onClick={() => toggleChannel(channel)}
          >
            {channel}
          </button>
        ))}
      </div>

      <button 
        className="btn btn-primary btn-send"
        onClick={handleSend}
        disabled={loading || selectedChannels.length === 0}
      >
        {loading ? '⏳' : '📤'} Send Test
      </button>
    </div>
  );
};

export default NotificationTester;
