import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import PageHeader from './PageHeader';
import SystemStatus from './SystemStatus';
import UniversalTabContainer from './UniversalTabContainer';
import PauseSettings from './PauseSettings';
import './UnifiedPreferences.css';
import { 
  getUserPreferences, 
  updateUserPreferences, 
  changePassword, 
  notifications,
  requestAccountDeletion,
  exportAccountData
} from '../api';
import api from '../api';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';

const UnifiedPreferences = () => {
  const location = useLocation();
  const [toast, setToast] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Get initial tab from URL parameter
  const getInitialTab = () => {
    const params = new URLSearchParams(location.search);
    const tab = params.get('tab');
    return tab || 'account';
  };
  
  const [defaultTab] = useState(getInitialTab());

  // Account Settings State
  const [selectedTheme, setSelectedTheme] = useState('light-blue');
  const [isLoading, setIsLoading] = useState(true);

  // Admin Settings State
  const [ticketDeleteDays, setTicketDeleteDays] = useState(30);
  const [profileViewHistoryDays, setProfileViewHistoryDays] = useState(7);
  const [enableL3V3LForAll, setEnableL3V3LForAll] = useState(true);
  const [savingTicketSettings, setSavingTicketSettings] = useState(false);
  const [ticketSettingsMessage, setTicketSettingsMessage] = useState({ type: '', text: '' });
  const [showTooltip, setShowTooltip] = useState(false);
  const [showProfileViewTooltip, setShowProfileViewTooltip] = useState(false);
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

  // Pause Settings State
  const [pauseStatus, setPauseStatus] = useState(null);
  const [showPauseModal, setShowPauseModal] = useState(false);

  // Account Deletion State
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [downloadData, setDownloadData] = useState(false);

  // MFA Settings State
  const [mfaStatus, setMfaStatus] = useState({
    mfa_enabled: false,
    mfa_channel: null,
    contact_masked: null,
    backup_codes_count: 0
  });
  const [selectedMfaMethod, setSelectedMfaMethod] = useState('none');
  const [mfaStep, setMfaStep] = useState('select'); // 'select', 'verify', 'backup_codes'
  const [mfaVerificationCode, setMfaVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loadingMfa, setLoadingMfa] = useState(false);
  const [mfaMessage, setMfaMessage] = useState({ type: '', text: '' });
  const [showDisableMfaModal, setShowDisableMfaModal] = useState(false);
  const [disableMfaPassword, setDisableMfaPassword] = useState('');

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
      preview: { primary: '#94a3b8', secondary: '#cbd5e1', background: '#5e5e6a', text: '#f3f4f6' }
    },
    {
      id: 'ultra-light-green',
      name: 'Fresh Green',
      icon: '🌿',
      description: 'Clean and fresh light green theme',
      preview: { primary: '#10b981', secondary: '#34d399', background: '#f0fdf4', text: '#064e3b' }
    },
    {
      id: 'ultra-black',
      name: 'Midnight',
      icon: '🌑',
      description: 'Pure black OLED theme with vibrant purple accents',
      preview: { primary: '#7c3aed', secondary: '#6b7280', background: '#000000', text: '#e5e7eb' }
    },
    {
      id: 'indian-wedding',
      name: 'Indian Celebration',
      icon: '🪔',
      description: 'Vibrant marigold and gold celebrating Indian weddings',
      preview: { primary: '#ff6b35', secondary: '#f7931e', background: '#fffaf0', text: '#7c2d12' }
    },
    {
      id: 'newspaper',
      name: 'The Daily News',
      icon: '📰',
      description: 'Classic black and white newspaper style',
      preview: { primary: '#1a1a1a', secondary: '#4a4a4a', background: '#f4f1ea', text: '#1a1a1a' }
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
      const userRole = localStorage.getItem('userRole');
      console.log('🔍 Checking admin status - Username:', username, 'Role:', userRole);
      console.log('🔍 Is Admin?', userRole === 'admin');
      setIsAdmin(userRole === 'admin');
    };

    fetchNotificationPreferences();
    checkAdminStatus();
    loadPauseStatus();
  }, []);

  // Load MFA status
  useEffect(() => {
    const fetchMfaStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${getBackendUrl()}/api/auth/mfa/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMfaStatus(response.data);
        if (response.data.mfa_enabled) {
          setSelectedMfaMethod(response.data.mfa_channel || 'email');
        }
      } catch (error) {
        console.error('Error loading MFA status:', error);
      }
    };

    fetchMfaStatus();
  }, []);

  const loadAdminSettings = async () => {
    try {
      setAdminSettingsLoading(true);
      const response = await api.get('/system-settings');
      const ticketDays = response.data.ticket_delete_days;
      const profileViewDays = response.data.profile_view_history_days;
      const enableL3V3L = response.data.enable_l3v3l_for_all;
      setTicketDeleteDays(ticketDays !== undefined && ticketDays !== null ? ticketDays : 30);
      setProfileViewHistoryDays(profileViewDays !== undefined && profileViewDays !== null ? profileViewDays : 7);
      setEnableL3V3LForAll(enableL3V3L !== undefined && enableL3V3L !== null ? enableL3V3L : true);
    } catch (error) {
      console.error('Error loading admin settings:', error);
    } finally {
      setAdminSettingsLoading(false);
    }
  };

  const handleSaveTicketSettings = async () => {
    try {
      setSavingTicketSettings(true);
      setTicketSettingsMessage({ type: '', text: '' });

      await api.put('/system-settings', {
        ticket_delete_days: ticketDeleteDays,
        profile_view_history_days: profileViewHistoryDays,
        enable_l3v3l_for_all: enableL3V3LForAll
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
    if (isAdmin) {
      loadAdminSettings();
    }
  }, [isAdmin]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Pause feature functions
  const loadPauseStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(
        `${getBackendUrl()}/api/account/pause-status`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      setPauseStatus(response.data);
    } catch (error) {
      console.error('Error loading pause status:', error);
    }
  };

  const handlePauseSuccess = async (data) => {
    showToast('Your profile has been paused successfully', 'success');
    await loadPauseStatus();
  };

  const handleUnpause = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        `${getBackendUrl()}/api/account/unpause`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      showToast('Welcome back! Your profile is now active.', 'success');
      await loadPauseStatus();
    } catch (error) {
      console.error('Error unpausing account:', error);
      showToast('Failed to unpause account', 'error');
    }
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

  // MFA Handlers
  const handleMfaMethodChange = (method) => {
    if (mfaStatus.mfa_enabled) {
      showToast('Please disable MFA before changing methods', 'info');
      return;
    }
    setSelectedMfaMethod(method);
    setMfaMessage({ type: '', text: '' });
  };

  const handleSendMfaCode = async () => {
    if (selectedMfaMethod === 'none') {
      setMfaMessage({ type: 'error', text: 'Please select Email or SMS' });
      return;
    }

    try {
      setLoadingMfa(true);
      setMfaMessage({ type: '', text: '' });

      const token = localStorage.getItem('token');
      const response = await axios.post(`${getBackendUrl()}/api/auth/otp/send`, 
        { channel: selectedMfaMethod },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        setMfaStep('verify');
        setMfaMessage({ 
          type: 'success', 
          text: `Verification code sent to ${response.data.contact_masked || 'your ' + selectedMfaMethod}` 
        });
      } else if (response.data.mock_code) {
        setMfaStep('verify');
        setMfaMessage({ 
          type: 'warning', 
          text: `DEV MODE: Use code ${response.data.mock_code}` 
        });
      }
    } catch (error) {
      console.error('Error sending MFA code:', error);
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to send code' });
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleVerifyAndEnableMfa = async () => {
    if (!mfaVerificationCode || mfaVerificationCode.length !== 6) {
      setMfaMessage({ type: 'error', text: 'Please enter the 6-digit code' });
      return;
    }

    try {
      setLoadingMfa(true);
      setMfaMessage({ type: '', text: '' });

      const token = localStorage.getItem('token');
      const response = await axios.post(`${getBackendUrl()}/api/auth/mfa/enable`,
        {
          verification_code: mfaVerificationCode,
          channel: selectedMfaMethod
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.codes) {
        setBackupCodes(response.data.codes);
        setMfaStep('backup_codes');
        setMfaMessage({ type: 'success', text: 'MFA enabled successfully!' });
        
        // Refresh MFA status
        const statusResponse = await axios.get(`${getBackendUrl()}/api/auth/mfa/status`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setMfaStatus(statusResponse.data);
      }
    } catch (error) {
      console.error('Error enabling MFA:', error);
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to enable MFA' });
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!disableMfaPassword) {
      setMfaMessage({ type: 'error', text: 'Please enter your password' });
      return;
    }

    try {
      setLoadingMfa(true);
      setMfaMessage({ type: '', text: '' });

      const token = localStorage.getItem('token');
      await axios.post(`${getBackendUrl()}/api/auth/mfa/disable`,
        { password: disableMfaPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setMfaStatus({
        mfa_enabled: false,
        mfa_channel: null,
        contact_masked: null,
        backup_codes_count: 0
      });
      setSelectedMfaMethod('none');
      setShowDisableMfaModal(false);
      setDisableMfaPassword('');
      setMfaMessage({ type: 'success', text: 'MFA disabled successfully' });
      showToast('MFA has been disabled', 'success');
    } catch (error) {
      console.error('Error disabling MFA:', error);
      setMfaMessage({ type: 'error', text: error.response?.data?.detail || 'Failed to disable MFA' });
    } finally {
      setLoadingMfa(false);
    }
  };

  const handleFinishMfaSetup = () => {
    setMfaStep('select');
    setMfaVerificationCode('');
    setBackupCodes([]);
    showToast('MFA setup complete!', 'success');
  };

  const copyBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    navigator.clipboard.writeText(codesText);
    showToast('Backup codes copied to clipboard', 'success');
  };

  const downloadBackupCodes = () => {
    const codesText = backupCodes.join('\n');
    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mfa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup codes downloaded', 'success');
  };

  // Account Deletion Handlers
  const handleRequestDeletion = async () => {
    try {
      const response = await requestAccountDeletion(deletionReason, downloadData);
      
      const scheduledDate = new Date(response.data.scheduledDate).toLocaleDateString();
      showToast(
        `Account deletion scheduled for ${scheduledDate}. You have 30 days to change your mind. Simply log back in to reactivate.`,
        'info'
      );
      
      setShowDeleteModal(false);
      
      // Redirect to login after short delay
      setTimeout(() => {
        localStorage.clear();
        navigate('/login');
      }, 3000);
      
    } catch (error) {
      showToast('Error requesting deletion: ' + (error.response?.data?.detail || error.message), 'error');
    }
  };

  const handleDownloadData = async () => {
    try {
      const response = await exportAccountData();
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `account-data-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('Data exported successfully', 'success');
    } catch (error) {
      showToast('Error downloading data: ' + error.message, 'error');
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
      <PageHeader
        icon="⚙️"
        title="Preferences"
        subtitle="Manage your account settings and notification preferences"
        variant="gradient"
      />

      <UniversalTabContainer
        variant="underlined"
        defaultTab={defaultTab}
        tabs={[
          {
            id: 'account',
            icon: '👤',
            label: 'Settings',
            content: (
              <div className="account-settings">
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

          {/* Pause Account Section */}
          <section className="settings-section">
            <h2>⏸️ Account Pause</h2>
            <p className="section-description">
              Take a break from matchmaking without deactivating your account
            </p>
            
            {pauseStatus?.isPaused ? (
              <div className="pause-active-card">
                <div className="pause-active-header">
                  <span className="pause-icon">⏸️</span>
                  <div className="pause-info">
                    <strong>Your account is currently PAUSED</strong>
                    <p className="pause-details">
                      Paused {pauseStatus.pausedAt && `on ${new Date(pauseStatus.pausedAt).toLocaleDateString()}`}
                      {pauseStatus.pausedUntil && (
                        <> • Auto-unpause on {new Date(pauseStatus.pausedUntil).toLocaleDateString()}</>
                      )}
                    </p>
                    {pauseStatus.pauseReason && (
                      <p className="pause-reason">Reason: {pauseStatus.pauseReason.replace(/_/g, ' ')}</p>
                    )}
                  </div>
                </div>
                
                <div className="pause-effects-summary">
                  <p>While paused:</p>
                  <ul>
                    <li>❌ Hidden from all searches</li>
                    <li>❌ No new matches generated</li>
                    <li>❌ Cannot send/receive messages</li>
                    <li>✅ Can still edit your profile</li>
                    <li>✅ Subscription remains active</li>
                  </ul>
                </div>
                
                <button
                  className="btn-unpause"
                  onClick={handleUnpause}
                >
                  ▶️ Un-Pause My Account
                </button>
              </div>
            ) : (
              <div className="pause-inactive-card">
                <p className="pause-description">
                  Need a break? Pause your account to:
                </p>
                <ul className="pause-benefits">
                  <li>✅ Temporarily hide from searches and matches</li>
                  <li>✅ Stop receiving messages (read-only access)</li>
                  <li>✅ Keep your subscription and profile data</li>
                  <li>✅ Un-pause anytime you want to return</li>
                </ul>
                <button
                  className="btn-configure-pause"
                  onClick={() => setShowPauseModal(true)}
                >
                  ⏸️ Configure Pause Settings
                </button>
              </div>
            )}
          </section>

          {/* Data Export Section */}
          <section className="settings-section">
            <h2>� Data Export</h2>
            <p className="section-description">Download a copy of your personal data</p>
            
            <div className="data-export-section">
              <p className="data-export-description">
                Download all your profile data, messages, matches, and activity history in JSON format. 
                This includes everything we have stored about your account.
              </p>
              <button 
                className="btn-secondary download-data-btn"
                onClick={handleDownloadData}
              >
                📦 Download My Data (GDPR)
              </button>
            </div>
          </section>

          {/* DANGER ZONE - Account Deletion */}
          <section className="settings-section danger-zone-section">
            <h2 className="danger-zone-title">🗑️ Delete Account</h2>
            <div className="danger-zone-warning">
              <strong>⚠️ Warning: This starts a 30-day deletion process</strong>
              <p>Deleting your account will:</p>
              <ul>
                <li>Hide your profile from all searches immediately</li>
                <li>Delete all your messages and matches after 30 days</li>
                <li>Remove your photos and personal information</li>
                <li>You can reactivate anytime within 30 days by logging back in</li>
              </ul>
            </div>
            
            <button 
              className="btn btn-danger btn-lg delete-account-btn"
              onClick={() => setShowDeleteModal(true)}
            >
              Delete My Account
            </button>
          </section>
        </div>
            )
          },
          {
            id: 'security',
            icon: '🔐',
            label: 'MFA',
            content: (
              <div className="security-settings">
          {/* MFA Status Banner */}
          <section className="settings-section">
            <h2>🔐 Multi-Factor Authentication (MFA)</h2>
            <p className="section-description">Add an extra layer of security to your account</p>
            
            {/* Current Status */}
            <div className={`mfa-status-banner ${mfaStatus.mfa_enabled ? 'enabled' : 'disabled'}`}>
              <div className="status-icon">
                {mfaStatus.mfa_enabled ? '✅' : '⚪'}
              </div>
              <div className="status-info">
                <strong>{mfaStatus.mfa_enabled ? 'MFA Enabled' : 'MFA Disabled'}</strong>
                <p>
                  {mfaStatus.mfa_enabled 
                    ? `Active via ${mfaStatus.mfa_channel?.toUpperCase()} - ${mfaStatus.contact_masked}`
                    : 'Your account is not protected by MFA'
                  }
                </p>
                {mfaStatus.mfa_enabled && (
                  <p className="backup-codes-info">
                    {mfaStatus.backup_codes_count} backup codes remaining
                  </p>
                )}
              </div>
            </div>

            {/* MFA Messages */}
            {mfaMessage.text && (
              <div className={`alert alert-${mfaMessage.type}`} style={{ marginTop: '16px' }}>
                {mfaMessage.text}
              </div>
            )}

            {/* MFA Setup/Management */}
            {!mfaStatus.mfa_enabled ? (
              <>
                {/* Step 1: Select Method */}
                {mfaStep === 'select' && (
                  <div className="mfa-setup">
                    <h3>Choose MFA Method</h3>
                    <div className="mfa-options">
                      <label className={`mfa-option ${selectedMfaMethod === 'none' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="mfa-method"
                          value="none"
                          checked={selectedMfaMethod === 'none'}
                          onChange={() => handleMfaMethodChange('none')}
                        />
                        <div className="option-content">
                          <span className="option-icon">⚪</span>
                          <div>
                            <strong>None (Disabled)</strong>
                            <p>No additional security</p>
                          </div>
                        </div>
                      </label>

                      <label className={`mfa-option ${selectedMfaMethod === 'email' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="mfa-method"
                          value="email"
                          checked={selectedMfaMethod === 'email'}
                          onChange={() => handleMfaMethodChange('email')}
                        />
                        <div className="option-content">
                          <span className="option-icon">📧</span>
                          <div>
                            <strong>Email OTP</strong>
                            <p>Receive codes via email</p>
                          </div>
                        </div>
                      </label>

                      <label className={`mfa-option ${selectedMfaMethod === 'sms' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          name="mfa-method"
                          value="sms"
                          checked={selectedMfaMethod === 'sms'}
                          onChange={() => handleMfaMethodChange('sms')}
                        />
                        <div className="option-content">
                          <span className="option-icon">📱</span>
                          <div>
                            <strong>SMS OTP</strong>
                            <p>Receive codes via text message</p>
                          </div>
                        </div>
                      </label>
                    </div>

                    {selectedMfaMethod !== 'none' && (
                      <div className="mfa-info-box">
                        <p>ℹ️ You'll receive a verification code to confirm ownership before MFA is enabled.</p>
                      </div>
                    )}

                    <button
                      className="btn-primary"
                      onClick={handleSendMfaCode}
                      disabled={loadingMfa || selectedMfaMethod === 'none'}
                    >
                      {loadingMfa ? 'Sending Code...' : 'Enable MFA'}
                    </button>
                  </div>
                )}

                {/* Step 2: Verify Code */}
                {mfaStep === 'verify' && (
                  <div className="mfa-verify">
                    <h3>Enter Verification Code</h3>
                    <p>We sent a 6-digit code to your {selectedMfaMethod}</p>
                    
                    <input
                      type="text"
                      className="verification-code-input"
                      placeholder="000000"
                      maxLength="6"
                      value={mfaVerificationCode}
                      onChange={(e) => setMfaVerificationCode(e.target.value.replace(/\D/g, ''))}
                      style={{ fontSize: '24px', textAlign: 'center', letterSpacing: '0.5em', padding: '16px' }}
                    />

                    <div className="button-group">
                      <button
                        className="btn-primary"
                        onClick={handleVerifyAndEnableMfa}
                        disabled={loadingMfa || mfaVerificationCode.length !== 6}
                      >
                        {loadingMfa ? 'Verifying...' : 'Verify & Enable'}
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={handleSendMfaCode}
                        disabled={loadingMfa}
                      >
                        Resend Code
                      </button>
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setMfaStep('select');
                          setMfaVerificationCode('');
                          setMfaMessage({ type: '', text: '' });
                        }}
                        disabled={loadingMfa}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Backup Codes */}
                {mfaStep === 'backup_codes' && (
                  <div className="mfa-backup-codes">
                    <h3>⚠️ Save Your Backup Codes</h3>
                    <p className="warning-text">
                      Store these codes in a safe place. Each code can only be used once to access your account if you lose access to your {selectedMfaMethod}.
                    </p>

                    <div className="backup-codes-grid">
                      {backupCodes.map((code, index) => (
                        <div key={index} className="backup-code">
                          {code}
                        </div>
                      ))}
                    </div>

                    <div className="button-group">
                      <button className="btn-primary" onClick={copyBackupCodes}>
                        📋 Copy Codes
                      </button>
                      <button className="btn-primary" onClick={downloadBackupCodes}>
                        💾 Download Codes
                      </button>
                      <button className="btn-secondary" onClick={handleFinishMfaSetup}>
                        I've Saved My Codes
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* MFA Enabled - Show Management Options */
              <div className="mfa-management">
                <div className="button-group">
                  <button
                    className="btn-danger"
                    onClick={() => setShowDisableMfaModal(true)}
                  >
                    Disable MFA
                  </button>
                </div>

                {/* Disable MFA Modal */}
                {showDisableMfaModal && (
                  <div className="modal-overlay" onClick={() => setShowDisableMfaModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                      <h3>Disable MFA</h3>
                      <p>Enter your password to confirm</p>
                      
                      <input
                        type="password"
                        placeholder="Password"
                        value={disableMfaPassword}
                        onChange={(e) => setDisableMfaPassword(e.target.value)}
                        style={{ width: '100%', padding: '12px', marginBottom: '16px' }}
                      />

                      <div className="button-group">
                        <button
                          className="btn-danger"
                          onClick={handleDisableMfa}
                          disabled={loadingMfa}
                        >
                          {loadingMfa ? 'Disabling...' : 'Disable MFA'}
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setShowDisableMfaModal(false);
                            setDisableMfaPassword('');
                          }}
                          disabled={loadingMfa}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
            )
          },
          {
            id: 'notifications',
            icon: '🔔',
            label: 'Notifications ',
            content: notificationPreferences && (
              <div className="notification-settings">
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
            )
          },
          ...(isAdmin ? [{
            id: 'admin',
            icon: '⚙️',
            label: 'SysConfig',
            content: (
              <div className="admin-settings">
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

          {/* Backend Services Status */}
          <SystemStatus />

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

          {/* L3V3L Algorithm Feature Toggle */}
          {!adminSettingsLoading && (
            <div className="settings-card" style={{ marginTop: '24px' }}>
              <h3>🦋 L3V3L Compatibility Algorithm</h3>
              <p>Control access to AI-powered compatibility scoring feature</p>
              
              <div className="form-group" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', background: 'var(--hover-background)', borderRadius: '8px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="enableL3V3L" style={{ fontWeight: '600', display: 'block', marginBottom: '4px' }}>
                      Enable L3V3L for All Users
                    </label>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
                      When enabled, all users can filter search results by L3V3L compatibility score. Disable to make this a premium-only feature.
                    </p>
                  </div>
                  <label className="switch" style={{ marginLeft: 'auto' }}>
                    <input
                      id="enableL3V3L"
                      type="checkbox"
                      checked={enableL3V3LForAll}
                      onChange={(e) => setEnableL3V3LForAll(e.target.checked)}
                      disabled={savingTicketSettings}
                    />
                    <span className="slider round"></span>
                  </label>
                </div>
                
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px', 
                  background: enableL3V3LForAll ? 'var(--success-light)' : 'var(--warning-light)', 
                  borderRadius: '8px',
                  fontSize: '0.9rem'
                }}>
                  <strong>Current Status:</strong> {enableL3V3LForAll ? '✅ Available to all users (Testing Phase)' : '🔒 Premium users only'}
                  <br />
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {enableL3V3LForAll 
                      ? 'Use this setting to collect user feedback before deciding on premium monetization.' 
                      : 'Only users with premium subscription can use L3V3L compatibility filtering.'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Profile View History Settings */}
          {!adminSettingsLoading && (
            <div className="settings-card" style={{ marginTop: '24px' }}>
              <h3>👁️ Profile View History</h3>
              <p>Configure how long profile view history is visible to users</p>

              <div className="form-group" style={{ marginTop: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <label htmlFor="profileViewHistoryDays" style={{ fontWeight: '600' }}>View History Retention</label>
                  <div style={{ position: 'relative' }}>
                    <span 
                      onClick={() => setShowProfileViewTooltip(!showProfileViewTooltip)}
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
                    {showProfileViewTooltip && (
                      <>
                        <div 
                          onClick={() => setShowProfileViewTooltip(false)}
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
                            <li>Users can see who viewed their profile within this time period</li>
                            <li>Older views are hidden but not deleted from the database</li>
                            <li>Helps manage privacy and prevents stalking behavior</li>
                            <li>Recommended: 7-14 days for active engagement</li>
                          </ul>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                  Users will only see profile views from the last N days on their dashboard.
                </p>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <select
                    id="profileViewHistoryDays"
                    value={profileViewHistoryDays}
                    onChange={(e) => setProfileViewHistoryDays(Number(e.target.value))}
                    disabled={savingTicketSettings}
                    className="form-control"
                    style={{ flex: '1', minWidth: '250px' }}
                  >
                    <option value={1}>1 day (24 hours)</option>
                    <option value={3}>3 days</option>
                    <option value={7}>7 days (Recommended)</option>
                    <option value={14}>14 days (2 weeks)</option>
                    <option value={30}>30 days (1 month)</option>
                    <option value={60}>60 days (2 months)</option>
                    <option value={90}>90 days (3 months)</option>
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
            )
          }] : [])
        ]}
      />

      {/* Toast Notification */}
      {toast && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.type === 'success' && '✓ '}
          {toast.type === 'error' && '✕ '}
          {toast.message}
        </div>
      )}

      {/* Pause Settings Modal */}
      <PauseSettings
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onPause={handlePauseSuccess}
        currentStatus={pauseStatus}
      />

      {/* Account Deletion Confirmation Modal */}
      {showDeleteModal && (
        <div 
          className="deletion-modal-overlay" 
          onClick={() => setShowDeleteModal(false)}
        >
          <div 
            className="deletion-modal-content" 
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="deletion-modal-title">
              Are you absolutely sure?
            </h3>
            <p className="deletion-modal-description">
              This will start a 30-day deletion process. You can cancel anytime during this period by logging back in.
            </p>
            
            <div className="deletion-modal-options">
              <label className="deletion-modal-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={downloadData}
                  onChange={(e) => setDownloadData(e.target.checked)}
                  className="deletion-modal-checkbox"
                />
                <span>Download my data before deletion</span>
              </label>
            </div>
            
            <div className="deletion-modal-form-group">
              <label className="deletion-modal-label">
                Why are you leaving? (Optional)
              </label>
              <textarea 
                className="deletion-modal-textarea"
                value={deletionReason}
                onChange={(e) => setDeletionReason(e.target.value)}
                placeholder="Tell us why you're leaving..."
                rows={3}
              />
            </div>
            
            <div className="deletion-modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletionReason('');
                  setDownloadData(false);
                }}
              >
                Cancel
              </button>
              <button 
                className="btn btn-danger"
                onClick={handleRequestDeletion}
              >
                Yes, Delete My Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedPreferences;
