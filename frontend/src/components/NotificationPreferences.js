import React, { useState, useEffect } from 'react';
import { notifications } from '../api';
import './NotificationPreferences.css';

const NotificationPreferences = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState(null);
  const [toast, setToast] = useState(null);
  const [authError, setAuthError] = useState(false);

  // Notification triggers grouped by category
  const triggers = {
    matches: [
      { id: 'new_match', label: 'New Match', description: 'Someone matches with you' },
      { id: 'mutual_favorite', label: 'Mutual Favorite', description: 'You both favorited each other' },
      { id: 'shortlist_added', label: 'Shortlist Added', description: 'Someone adds you to their shortlist' },
      { id: 'match_milestone', label: 'Match Milestone', description: 'Match anniversaries (1 week, 1 month)' }
    ],
    activity: [
      { id: 'profile_view', label: 'Profile Views', description: 'Someone views your profile' },
      { id: 'favorited', label: 'Favorited', description: 'Someone favorites you' },
      { id: 'profile_visibility_spike', label: 'Visibility Spike', description: 'Unusual traffic to your profile' },
      { id: 'search_appearance', label: 'Search Appearances', description: 'Your profile in search results' }
    ],
    messages: [
      { id: 'new_message', label: 'New Messages', description: 'New message received' },
      { id: 'message_read', label: 'Message Read', description: 'Your message was read' },
      { id: 'conversation_cold', label: 'Conversation Reminder', description: 'No reply in 3 days' }
    ],
    privacy: [
      { id: 'pii_request', label: 'PII Request', description: 'Someone requests access to your info' },
      { id: 'pii_granted', label: 'PII Granted', description: 'Your PII access request approved' },
      { id: 'pii_denied', label: 'PII Denied', description: 'Your PII access request denied' },
      { id: 'pii_expiring', label: 'PII Expiring', description: 'PII access expiring in 24h' },
      { id: 'suspicious_login', label: 'Suspicious Login', description: 'Unusual login detected' }
    ],
    engagement: [
      { id: 'unread_messages', label: 'Unread Messages', description: 'You have unread messages' },
      { id: 'new_users_matching', label: 'New Users', description: 'New users match your criteria' },
      { id: 'profile_incomplete', label: 'Complete Profile', description: 'Profile completion reminder' },
      { id: 'upload_photos', label: 'Upload Photos', description: 'Photo upload reminder' }
    ]
  };

  const channels = ['email', 'sms', 'push'];

  useEffect(() => {
    // Debug: Check authentication
    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');
    console.log('🔐 Auth check:', { 
      hasToken: !!token, 
      tokenPreview: token?.substring(0, 20) + '...',
      username 
    });
    
    fetchPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPreferences = async () => {
    try {
      setLoading(true);
      console.log('📡 Fetching notification preferences...');
      const data = await notifications.getPreferences();
      console.log('✅ Preferences loaded:', data);
      setPreferences(data);
    } catch (error) {
      console.error('❌ Failed to load preferences:', error);
      console.error('Error details:', {
        status: error.response?.status,
        message: error.response?.data?.detail || error.message
      });
      
      // Show more helpful error message
      if (error.response?.status === 401) {
        setAuthError(true);
        showToast('Session expired. Please log in again.', 'error');
      } else {
        showToast('Failed to load preferences', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChannelToggle = (triggerId, channel) => {
    const currentChannels = preferences.channels[triggerId] || [];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];

    setPreferences({
      ...preferences,
      channels: {
        ...preferences.channels,
        [triggerId]: newChannels
      }
    });
  };

  const handleQuietHoursToggle = () => {
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        enabled: !preferences.quietHours.enabled
      }
    });
  };

  const handleQuietHoursChange = (field, value) => {
    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await notifications.updatePreferences({
        channels: preferences.channels,
        quietHours: preferences.quietHours,
        smsOptimization: preferences.smsOptimization
      });
      showToast('Preferences saved successfully!', 'success');
    } catch (error) {
      showToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Reset all preferences to defaults?')) return;
    
    try {
      setSaving(true);
      await notifications.resetPreferences();
      await fetchPreferences();
      showToast('Preferences reset to defaults', 'success');
    } catch (error) {
      showToast('Failed to reset preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  if (loading) {
    return (
      <div className="notification-preferences">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="notification-preferences">
        <div className="error-container">
          <p>❌ Failed to load notification preferences</p>
          {authError ? (
            <div>
              <p style={{ marginTop: '10px', color: 'var(--warning-color)' }}>
                🔒 Your session has expired
              </p>
              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button onClick={() => window.location.href = '/login'}>
                  🔑 Log In Again
                </button>
                <button onClick={fetchPreferences} className="secondary">
                  🔄 Retry
                </button>
              </div>
            </div>
          ) : (
            <button onClick={fetchPreferences}>Retry</button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="notification-preferences">
      {/* Header */}
      <div className="preferences-header">
        <div>
          <h1>🔔 Notification Preferences</h1>
          <p>Choose how and when you want to be notified</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={handleReset}
            disabled={saving}
          >
            Reset to Defaults
          </button>
          <button 
            className="btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Quiet Hours Section */}
      <div className="preferences-section">
        <h2>🌙 Quiet Hours</h2>
        <p className="section-description">
          Don't disturb me during these hours (except critical alerts)
        </p>

        <div className="quiet-hours-container">
          <div className="toggle-row">
            <label className="toggle-label">
              <input
                type="checkbox"
                checked={preferences.quietHours.enabled}
                onChange={handleQuietHoursToggle}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Enable Quiet Hours</span>
            </label>
          </div>

          {preferences.quietHours.enabled && (
            <div className="quiet-hours-settings">
              <div className="time-picker-group">
                <div className="time-picker">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={preferences.quietHours.start}
                    onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  />
                </div>
                <div className="time-picker">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={preferences.quietHours.end}
                    onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  />
                </div>
              </div>
              <p className="help-text">
                💡 Critical alerts (PII requests, suspicious logins) will still be sent
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Notification Channels by Category */}
      {Object.entries(triggers).map(([category, categoryTriggers]) => (
        <div key={category} className="preferences-section">
          <h2>
            {category === 'matches' && '💕 Matches'}
            {category === 'activity' && '👀 Profile Activity'}
            {category === 'messages' && '💬 Messages'}
            {category === 'privacy' && '🔐 Privacy & Security'}
            {category === 'engagement' && '⭐ Engagement'}
          </h2>

          <div className="triggers-list">
            {categoryTriggers.map(trigger => {
              const triggerChannels = preferences.channels[trigger.id] || [];
              
              return (
                <div key={trigger.id} className="trigger-item">
                  <div className="trigger-info">
                    <h3>{trigger.label}</h3>
                    <p>{trigger.description}</p>
                  </div>
                  <div className="channel-toggles">
                    {channels.map(channel => (
                      <button
                        key={channel}
                        className={`channel-btn ${triggerChannels.includes(channel) ? 'active' : ''}`}
                        onClick={() => handleChannelToggle(trigger.id, channel)}
                        title={channel === 'push' ? 'Coming soon' : ''}
                        disabled={channel === 'push'}
                      >
                        {channel === 'email' && '📧'}
                        {channel === 'sms' && '📱'}
                        {channel === 'push' && '🔔'}
                        <span>{channel.toUpperCase()}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* SMS Optimization */}
      <div className="preferences-section">
        <h2>💰 SMS Cost Optimization</h2>
        <p className="section-description">
          Reduce SMS costs by filtering notifications
        </p>

        <div className="optimization-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.smsOptimization?.verifiedUsersOnly}
              onChange={(e) => setPreferences({
                ...preferences,
                smsOptimization: {
                  ...preferences.smsOptimization,
                  verifiedUsersOnly: e.target.checked
                }
              })}
            />
            <span>Only send SMS for verified users</span>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={preferences.smsOptimization?.priorityTriggersOnly}
              onChange={(e) => setPreferences({
                ...preferences,
                smsOptimization: {
                  ...preferences.smsOptimization,
                  priorityTriggersOnly: e.target.checked
                }
              })}
            />
            <span>Only send SMS for high-priority notifications</span>
          </label>

          <div className="score-filter">
            <label>
              Minimum match score for SMS:
              <input
                type="number"
                min="0"
                max="100"
                value={preferences.smsOptimization?.minimumMatchScore || 0}
                onChange={(e) => setPreferences({
                  ...preferences,
                  smsOptimization: {
                    ...preferences.smsOptimization,
                    minimumMatchScore: parseInt(e.target.value)
                  }
                })}
              />
              <span className="score-label">%</span>
            </label>
          </div>
        </div>

        {/* SMS Compliance Footer */}
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6'
        }}>
          <p style={{
            fontSize: '11px',
            lineHeight: '1.5',
            color: '#6c757d',
            margin: 0
          }}>
            📱 <strong>SMS Terms:</strong> I agree to receive promotional messages sent via an autodialer, and this agreement isn't a condition of any purchase. I also agree to the{' '}
            <a href="https://l3v3lmatches.com/terms" target="_blank" rel="noopener noreferrer" style={{color: '#667eea'}}>Terms of Service</a> and{' '}
            <a href="https://l3v3lmatches.com/privacy" target="_blank" rel="noopener noreferrer" style={{color: '#667eea'}}>Privacy Policy</a>. 
            4 Msgs/Month. Msg & Data Rates may apply. Text STOP to opt out anytime. Text HELP for more information.
          </p>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && '✓'}
          {toast.type === 'error' && '✕'}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default NotificationPreferences;
