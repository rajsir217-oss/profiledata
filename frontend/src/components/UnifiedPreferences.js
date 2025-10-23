import React, { useState, useEffect } from 'react';
import './UnifiedPreferences.css';
import { getUserPreferences, updateUserPreferences, changePassword, notifications } from '../api';
import api from '../api';

const UnifiedPreferences = () => {
  const [activeTab, setActiveTab] = useState('account');
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Account Settings State
  const [selectedTheme, setSelectedTheme] = useState('light-blue');
  const [isLoading, setIsLoading] = useState(true);

  // Admin Settings State
  const [ticketDeleteDays, setTicketDeleteDays] = useState(30);
  const [savingTicketSettings, setSavingTicketSettings] = useState(false);
  const [ticketSettingsMessage, setTicketSettingsMessage] = useState({ type: '', text: '' });
  const [showTooltip, setShowTooltip] = useState(false);
  const [adminSettingsLoading, setAdminSettingsLoading] = useState(false);
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

    const checkAdminStatus = () => {
      const username = localStorage.getItem('username');
      console.log('🔍 Checking admin status - Username:', username);
      console.log('🔍 Is Admin?', username === 'admin');
      setIsAdmin(username === 'admin');
    };

    fetchNotificationPreferences();
    checkAdminStatus();
  }, []);

  const loadAdminSettings = async () => {
    try {
      setAdminSettingsLoading(true);
      const response = await api.get('/system-settings');
      const days = response.data.ticket_delete_days;
      setTicketDeleteDays(days !== undefined && days !== null ? days : 30);
    } catch (error) {
      console.error('Error loading admin settings:', error);
      setTicketDeleteDays(30);
    } finally {
      setAdminSettingsLoading(false);
    }
  };

  const handleSaveTicketSettings = async () => {
    try {
      setSavingTicketSettings(true);
      setTicketSettingsMessage({ type: '', text: '' });

      await api.put('/system-settings', {
        ticket_delete_days: ticketDeleteDays
      });

      setTicketSettingsMessage({ type: 'success', text: '✅ Settings saved successfully!' });
      setTimeout(() => setTicketSettingsMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving ticket settings:', error);
      setTicketSettingsMessage({ type: 'error', text: '⚠️ Failed to save settings' });
    } finally {
      setSavingTicketSettings(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'admin' && isAdmin) {
      loadAdminSettings();
    }
  }, [activeTab, isAdmin]);

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
        {isAdmin && (
          <button
            className={`tab-button ${activeTab === 'admin' ? 'active' : ''}`}
            onClick={() => setActiveTab('admin')}
          >
            ⚙️ System Config
          </button>
        )}
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

      {/* Admin Settings Tab */}
      {activeTab === 'admin' && isAdmin && (
        <div className="tab-content admin-settings">
          <h2>⚙️ System Configuration</h2>
          <p className="section-description">Configure global system settings and preferences</p>
          
          <div className="info-banner" style={{
            background: 'var(--info-light)',
            border: '1px solid var(--info-color)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            gap: '12px',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '1.3rem' }}>ℹ️</span>
            <span>Looking for scheduler jobs? Visit the <strong>Dynamic Scheduler</strong> page for advanced job management.</span>
          </div>

          {adminSettingsLoading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div className="loading-spinner"></div>
              <p>Loading system settings...</p>
            </div>
          ) : (
            <div className="settings-card">
              <h3>🎫 Ticket Management</h3>
              <p>Configure automatic cleanup for resolved support tickets</p>
              
              {ticketSettingsMessage.text && (
                <div className={`alert alert-${ticketSettingsMessage.type}`} style={{ marginTop: '16px' }}>
                  {ticketSettingsMessage.text}
                </div>
              )}

              <div className="form-group" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <label htmlFor="ticketDeleteDays" style={{ fontWeight: '600' }}>Auto-Delete Period</label>
                  <div style={{ position: 'relative' }}>
                    <span 
                      onClick={() => setShowTooltip(!showTooltip)}
                      style={{
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '4px 8px',
                        borderRadius: '50%',
                        background: 'var(--info-light)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      ℹ️
                    </span>
                    {showTooltip && (
                      <>
                        <div 
                          onClick={() => setShowTooltip(false)}
                          style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            zIndex: 999
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: '0',
                          marginTop: '8px',
                          background: 'var(--card-background)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '16px',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          zIndex: 1000,
                          minWidth: '300px',
                          maxWidth: '400px'
                        }}>
                          <strong style={{ display: 'block', marginBottom: '8px' }}>How it works:</strong>
                          <ul style={{ marginLeft: '20px', lineHeight: '1.6' }}>
                            <li>When a ticket is marked as <strong>resolved</strong> or <strong>closed</strong>, a deletion timestamp is set</li>
                            <li>A background job runs every hour to delete tickets past their scheduled deletion time</li>
                            <li>All attachments are permanently deleted from the filesystem</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Resolved/closed tickets and attachments will be automatically deleted after this period.
                </p>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    id="ticketDeleteDays"
                    value={ticketDeleteDays}
                    onChange={(e) => setTicketDeleteDays(Number(e.target.value))}
                    disabled={savingTicketSettings}
                    className="form-control"
                    style={{ flex: '1', minWidth: '250px' }}
                  >
                    <option value={0}>Immediately (on resolve/close)</option>
                    <option value={7}>7 days after resolved</option>
                    <option value={14}>14 days after resolved</option>
                    <option value={30}>30 days after resolved (Recommended)</option>
                    <option value={60}>60 days after resolved</option>
                    <option value={90}>90 days after resolved</option>
                  </select>
                  
                  <button
                    onClick={handleSaveTicketSettings}
                    disabled={savingTicketSettings}
                    className="btn-primary"
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {savingTicketSettings ? '💾 Saving...' : '💾 Save Settings'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UnifiedPreferences;
