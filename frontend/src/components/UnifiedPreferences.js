import React, { useState, useEffect } from 'react';
import './UnifiedPreferences.css';
import { getUserPreferences, updateUserPreferences, changePassword, notifications } from '../api';

const UnifiedPreferences = () => {
  const [activeTab, setActiveTab] = useState('account');
  const [toast, setToast] = useState(null);

  // Account Settings State
  const [selectedTheme, setSelectedTheme] = useState('light-blue');
  const [isLoading, setIsLoading] = useState(true);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });

  // Notification Settings State
  const [notificationPreferences, setNotificationPreferences] = useState(null);
  const [loadingNotifications, setLoadingNotifications] = useState(true);
  const [savingNotifications, setSavingNotifications] = useState(false);

  const themes = [
    {
      id: 'light-blue',
      name: 'Cozy Light',
      icon: '☀️',
      description: 'Warm and inviting light theme with soft colors',
      preview: { primary: '#6366f1', secondary: '#a78bfa', background: '#fffbf7', text: '#374151' }
    },
    {
      id: 'dark',
      name: 'Cozy Night',
      icon: '🌙',
      description: 'Warm purple dark mode for comfortable evening browsing',
      preview: { primary: '#a78bfa', secondary: '#c4b5fd', background: '#1a1625', text: '#e5e7eb' }
    },
    {
      id: 'light-pink',
      name: 'Rose Garden',
      icon: '🌹',
      description: 'Romantic rose-tinted theme',
      preview: { primary: '#ec4899', secondary: '#f9a8d4', background: '#fff5f7', text: '#374151' }
    },
    {
      id: 'light-gray',
      name: 'Minimal Gray',
      icon: '⚪',
      description: 'Clean and minimal light gray theme',
      preview: { primary: '#6b7280', secondary: '#9ca3af', background: '#f9fafb', text: '#1f2937' }
    },
    {
      id: 'ultra-light-gray',
      name: 'Ultra Light',
      icon: '🤍',
      description: 'Ultra minimal white theme',
      preview: { primary: '#9ca3af', secondary: '#d1d5db', background: '#ffffff', text: '#111827' }
    },
    {
      id: 'ultra-light-green',
      name: 'Fresh Green',
      icon: '🌿',
      description: 'Clean and fresh light green theme',
      preview: { primary: '#10b981', secondary: '#34d399', background: '#f0fdf4', text: '#064e3b' }
    }
  ];

  const notificationTriggers = {
    matches: [
      { id: 'new_match', label: 'New Match', description: 'Someone matches with you' },
      { id: 'mutual_favorite', label: 'Mutual Favorite', description: 'You both favorited each other' },
      { id: 'shortlist_added', label: 'Shortlist Added', description: 'Someone adds you to their shortlist' },
      { id: 'match_milestone', label: 'Match Milestone', description: 'Match anniversaries' }
    ],
    activity: [
      { id: 'profile_view', label: 'Profile Views', description: 'Someone views your profile' },
      { id: 'favorited', label: 'Favorited', description: 'Someone favorites you' },
      { id: 'profile_visibility_spike', label: 'Visibility Spike', description: 'Unusual traffic' },
      { id: 'search_appearance', label: 'Search Appearances', description: 'Profile in search results' }
    ],
    messages: [
      { id: 'new_message', label: 'New Messages', description: 'New message received' },
      { id: 'message_read', label: 'Message Read', description: 'Your message was read' },
      { id: 'conversation_cold', label: 'Conversation Reminder', description: 'No reply in 3 days' }
    ],
    privacy: [
      { id: 'pii_request', label: 'PII Request', description: 'Someone requests access' },
      { id: 'pii_granted', label: 'PII Granted', description: 'Access request approved' },
      { id: 'pii_denied', label: 'PII Denied', description: 'Access request denied' },
      { id: 'pii_expiring', label: 'PII Expiring', description: 'Access expiring in 24h' },
      { id: 'suspicious_login', label: 'Suspicious Login', description: 'Unusual login detected' }
    ],
    engagement: [
      { id: 'unread_messages', label: 'Unread Messages', description: 'You have unread messages' },
      { id: 'new_users_matching', label: 'New Users', description: 'New users match criteria' },
      { id: 'profile_incomplete', label: 'Complete Profile', description: 'Profile completion reminder' },
      { id: 'upload_photos', label: 'Upload Photos', description: 'Photo upload reminder' }
    ]
  };

  const channels = ['email', 'sms', 'push'];

  // Load account preferences
  useEffect(() => {
    const loadAccountPreferences = async () => {
      try {
        const userPrefs = await getUserPreferences();
        if (userPrefs.themePreference) {
          setSelectedTheme(userPrefs.themePreference);
          // Theme is already applied by App.js, no need to reapply here
        }
      } catch (error) {
        console.error('Error loading preferences:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadAccountPreferences();
  }, []);

  // Load notification preferences
  useEffect(() => {
    const fetchNotificationPreferences = async () => {
      try {
        setLoadingNotifications(true);
        const data = await notifications.getPreferences();
        setNotificationPreferences(data);
      } catch (error) {
        console.error('Error loading notification preferences:', error);
        showToast('Failed to load notification preferences', 'error');
      } finally {
        setLoadingNotifications(false);
      }
    };

    fetchNotificationPreferences();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Theme change handler
  const handleThemeChange = async (themeId) => {
    setSelectedTheme(themeId);
    // Apply theme to body element (CSS uses body.theme-*)
    document.body.className = `theme-${themeId}`;
    
    try {
      await updateUserPreferences({ themePreference: themeId });
      console.log('✅ Theme saved to database:', themeId);
      showToast('Theme updated successfully!', 'success');
    } catch (error) {
      console.error('Error saving theme:', error);
      showToast('Failed to save theme preference', 'error');
    }
  };

  // Password change handler
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters' });
      return;
    }

    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });

    try {
      await changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });
      setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showToast('Password changed successfully!', 'success');
    } catch (error) {
      const errorMessage = error.error || error.message || 'Failed to change password';
      setPasswordMessage({ type: 'error', text: errorMessage });
      showToast(errorMessage, 'error');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Notification handlers
  const handleChannelToggle = (triggerId, channel) => {
    const currentChannels = notificationPreferences.channels[triggerId] || [];
    const newChannels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];

    setNotificationPreferences({
      ...notificationPreferences,
      channels: {
        ...notificationPreferences.channels,
        [triggerId]: newChannels
      }
    });
  };

  const handleQuietHoursToggle = () => {
    setNotificationPreferences({
      ...notificationPreferences,
      quietHours: {
        ...notificationPreferences.quietHours,
        enabled: !notificationPreferences.quietHours.enabled
      }
    });
  };

  const handleQuietHoursChange = (field, value) => {
    setNotificationPreferences({
      ...notificationPreferences,
      quietHours: {
        ...notificationPreferences.quietHours,
        [field]: value
      }
    });
  };

  const handleSaveNotifications = async () => {
    try {
      setSavingNotifications(true);
      await notifications.updatePreferences({
        channels: notificationPreferences.channels,
        quietHours: notificationPreferences.quietHours
      });
      showToast('Notification preferences saved successfully!', 'success');
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      showToast('Failed to save notification preferences', 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  const handleResetNotifications = async () => {
    if (!window.confirm('Reset all notification preferences to defaults?')) return;

    try {
      setSavingNotifications(true);
      const data = await notifications.resetPreferences();
      setNotificationPreferences(data);
      showToast('Notification preferences reset to defaults', 'success');
    } catch (error) {
      console.error('Error resetting preferences:', error);
      showToast('Failed to reset preferences', 'error');
    } finally {
      setSavingNotifications(false);
    }
  };

  if (isLoading || loadingNotifications) {
    return (
      <div className="unified-preferences-container">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading preferences...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-preferences-container">
      <div className="preferences-header">
        <h1>⚙️ Preferences</h1>
        <p>Manage your account settings and notification preferences</p>
      </div>

      {/* Tab Navigation */}
      <div className="preferences-tabs">
        <button
          className={`tab-button ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => setActiveTab('account')}
        >
          🎨 Account Settings
        </button>
        <button
          className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications
        </button>
      </div>

      {/* Account Settings Tab */}
      {activeTab === 'account' && (
        <div className="tab-content account-settings">
          {/* Theme Selection */}
          <section className="settings-section">
            <h2>🎨 Theme</h2>
            <p className="section-description">Choose your preferred color theme</p>
            
            <div className="themes-grid">
              {themes.map((theme) => (
                <div
                  key={theme.id}
                  className={`theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
                  onClick={() => handleThemeChange(theme.id)}
                >
                  <div className="theme-icon">{theme.icon}</div>
                  <h3>{theme.name}</h3>
                  <p>{theme.description}</p>
                  <div className="theme-preview">
                    <span style={{ backgroundColor: theme.preview.primary }}></span>
                    <span style={{ backgroundColor: theme.preview.secondary }}></span>
                    <span style={{ backgroundColor: theme.preview.background }}></span>
                    <span style={{ backgroundColor: theme.preview.text }}></span>
                  </div>
                  {selectedTheme === theme.id && (
                    <div className="selected-badge">✓ Active</div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Password Change */}
          <section className="settings-section">
            <h2>🔒 Change Password</h2>
            <p className="section-description">Update your account password</p>
            
            <form onSubmit={handlePasswordChange} className="password-form">
              <div className="form-group">
                <label>Current Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.current ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                  >
                    {showPasswords.current ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.new ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                  >
                    {showPasswords.new ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <div className="password-input-wrapper">
                  <input
                    type={showPasswords.confirm ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                  >
                    {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {passwordMessage.text && (
                <div className={`password-message ${passwordMessage.type}`}>
                  {passwordMessage.text}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={isChangingPassword}>
                {isChangingPassword ? 'Changing Password...' : 'Change Password'}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && notificationPreferences && (
        <div className="tab-content notification-settings">
          {/* Notification Channels */}
          <section className="settings-section">
            <h2>🔔 Notification Channels</h2>
            <p className="section-description">Choose how you want to be notified for different events</p>

            {Object.entries(notificationTriggers).map(([category, triggers]) => (
              <div key={category} className="trigger-category">
                <h3>{category.charAt(0).toUpperCase() + category.slice(1)}</h3>
                {triggers.map((trigger) => (
                  <div key={trigger.id} className="trigger-row">
                    <div className="trigger-info">
                      <strong>{trigger.label}</strong>
                      <small>{trigger.description}</small>
                    </div>
                    <div className="channel-toggles">
                      {channels.map((channel) => (
                        <label key={channel} className="channel-toggle">
                          <input
                            type="checkbox"
                            checked={notificationPreferences.channels[trigger.id]?.includes(channel)}
                            onChange={() => handleChannelToggle(trigger.id, channel)}
                          />
                          <span className={`channel-icon ${channel}`}>
                            {channel === 'email' && '📧'}
                            {channel === 'sms' && '📱'}
                            {channel === 'push' && '🔔'}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>

          {/* Quiet Hours */}
          <section className="settings-section">
            <h2>🌙 Quiet Hours</h2>
            <p className="section-description">Set Do Not Disturb hours</p>

            <div className="quiet-hours-toggle">
              <label>
                <input
                  type="checkbox"
                  checked={notificationPreferences.quietHours.enabled}
                  onChange={handleQuietHoursToggle}
                />
                <span>Enable Quiet Hours</span>
              </label>
            </div>

            {notificationPreferences.quietHours.enabled && (
              <div className="quiet-hours-settings">
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    value={notificationPreferences.quietHours.start}
                    onChange={(e) => handleQuietHoursChange('start', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    value={notificationPreferences.quietHours.end}
                    onChange={(e) => handleQuietHoursChange('end', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Timezone</label>
                  <input
                    type="text"
                    value={notificationPreferences.quietHours.timezone}
                    onChange={(e) => handleQuietHoursChange('timezone', e.target.value)}
                    placeholder="UTC"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <div className="notification-actions">
            <button
              className="btn-primary"
              onClick={handleSaveNotifications}
              disabled={savingNotifications}
            >
              {savingNotifications ? 'Saving...' : 'Save Notification Settings'}
            </button>
            <button
              className="btn-secondary"
              onClick={handleResetNotifications}
              disabled={savingNotifications}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default UnifiedPreferences;
