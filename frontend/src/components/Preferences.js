import React, { useState, useEffect } from 'react';
import './Preferences.css';
import { getUserPreferences, updateUserPreferences, changePassword } from '../api';

const Preferences = () => {
  const [selectedTheme, setSelectedTheme] = useState('light-blue');
  const [isLoading, setIsLoading] = useState(true);
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  
  // Password change state
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

  const themes = [
    {
      id: 'light-blue',
      name: 'Cozy Light',
      icon: '☀️',
      description: 'Warm and inviting light theme with soft colors',
      preview: {
        primary: '#6366f1',
        secondary: '#a78bfa',
        background: '#fffbf7',
        text: '#374151'
      }
    },
    {
      id: 'dark',
      name: 'Cozy Night',
      icon: '🌙',
      description: 'Warm purple dark mode for comfortable evening browsing',
      preview: {
        primary: '#a78bfa',
        secondary: '#c4b5fd',
        background: '#1a1625',
        text: '#e5e7eb'
      }
    },
    {
      id: 'light-pink',
      name: 'Cozy Rose',
      icon: '🌸',
      description: 'Soft rose theme with gentle pink accents',
      preview: {
        primary: '#ec4899',
        secondary: '#f9a8d4',
        background: '#fdf2f8',
        text: '#4a5568'
      }
    },
    {
      id: 'light-gray',
      name: 'Light Gray',
      icon: '⚡',
      description: 'Clean neutral gray theme for minimal distraction',
      preview: {
        primary: '#64748b',
        secondary: '#94a3b8',
        background: '#f8fafc',
        text: '#1e293b'
      }
    },
    {
      id: 'ultra-light-gray',
      name: 'Ultra Light Gray',
      icon: '✨',
      description: 'Ultra minimal gray theme with maximum whitespace',
      preview: {
        primary: '#475569',
        secondary: '#64748b',
        background: '#fcfcfd',
        text: '#0f172a'
      }
    }
  ];

  // Load theme from API on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const prefs = await getUserPreferences();
        const themeId = prefs.themePreference || 'light-blue';
        setSelectedTheme(themeId);
      } catch (error) {
        console.error('Failed to load theme from server:', error);
        setSelectedTheme('light-blue'); // Use default on error
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Apply theme whenever it changes
  useEffect(() => {
    // Apply the theme to the body element
    document.body.className = `theme-${selectedTheme}`;
    
    // Also update the root CSS variables
    const root = document.documentElement;
    const theme = themes.find(t => t.id === selectedTheme);
    if (theme) {
      root.style.setProperty('--primary-color', theme.preview.primary);
      root.style.setProperty('--secondary-color', theme.preview.secondary);
      root.style.setProperty('--background-color', theme.preview.background);
      root.style.setProperty('--text-color', theme.preview.text);
    }
  }, [selectedTheme, themes]);

  const handleThemeChange = async (themeId) => {
    setSelectedTheme(themeId);
    
    try {
      // Save to server (database) - NOT localStorage
      await updateUserPreferences({ themePreference: themeId });
      console.log('✅ Theme saved to database:', themeId);
      
      // Show success message
      setShowSaveMessage(true);
      setFadeOut(false);
      
      // Start fade out animation after 1.5 seconds
      setTimeout(() => {
        setFadeOut(true);
      }, 1500);
      
      // Actually hide the message after animation completes
      setTimeout(() => {
        setShowSaveMessage(false);
        setFadeOut(false);
      }, 2000);
    } catch (error) {
      console.error('❌ Failed to save theme to server:', error);
      alert('Failed to save theme preference. Please try again.');
    }
  };

  const handlePasswordInputChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear messages when user starts typing
    if (passwordMessage.text) {
      setPasswordMessage({ type: '', text: '' });
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    
    // Validate password length
    if (passwordData.newPassword.length < 6) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 6 characters long' });
      return;
    }
    
    setIsChangingPassword(true);
    setPasswordMessage({ type: '', text: '' });
    
    try {
      const result = await changePassword({
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword,
        confirm_password: passwordData.confirmPassword
      });
      
      setPasswordMessage({ 
        type: 'success', 
        text: result.message || 'Password changed successfully!' 
      });
      
      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => {
        setPasswordMessage({ type: '', text: '' });
      }, 5000);
      
    } catch (error) {
      console.error('Password change error:', error);
      const errorMessage = error.detail || error.message || 'Failed to change password. Please try again.';
      setPasswordMessage({ type: 'error', text: errorMessage });
    } finally {
      setIsChangingPassword(false);
    }
  };

  return (
    <div className="preferences-container">
      <div className="preferences-header">
        <h1>⚙️ Settings</h1>
        <p>Customize your app experience</p>
      </div>

      {showSaveMessage && (
        <div className={`save-message ${fadeOut ? 'fade-out' : ''}`}>
          <span>✅</span>
          <span>Theme saved successfully!</span>
        </div>
      )}

      <div className="preferences-section">
        <h2>🎨 Theme Selection</h2>
        <p className="section-description">Choose your preferred color theme</p>
        
        <div className="theme-options">
          {themes.map(theme => (
            <div
              key={theme.id}
              className={`theme-card ${selectedTheme === theme.id ? 'selected' : ''}`}
              onClick={() => handleThemeChange(theme.id)}
            >
              <div className="theme-icon">{theme.icon}</div>
              <div className="theme-preview">
                <div 
                  className="color-block primary"
                  style={{ backgroundColor: theme.preview.background }}
                  title="Background"
                />
                <div 
                  className="color-block accent"
                  style={{ backgroundColor: theme.preview.primary }}
                  title="Primary Color"
                />
                <div 
                  className="color-block text"
                  style={{ backgroundColor: theme.preview.text }}
                  title="Text Color"
                />
              </div>
              <div className="theme-info">
                <h3>{theme.name}</h3>
                <p>{theme.description}</p>
              </div>
              {selectedTheme === theme.id && (
                <div className="selected-badge badge badge-success">
                  <span>✓</span> Active
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="preferences-section">
        <h2>🔔 Notification Settings</h2>
        <p className="section-description">Coming soon...</p>
        <div className="coming-soon">
          <p>Email notifications, push alerts, and more preferences will be available here.</p>
        </div>
      </div>

      <div className="preferences-section">
        <h2>🔒 Change Password</h2>
        <p className="section-description">Update your account password</p>
        
        {passwordMessage.text && (
          <div className={`password-message ${passwordMessage.type}`}>
            <span>{passwordMessage.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{passwordMessage.text}</span>
          </div>
        )}
        
        <form onSubmit={handlePasswordChange} className="password-form">
          <div className="form-group">
            <label htmlFor="currentPassword">Current Password</label>
            <div className="input-with-toggle">
              <input
                type={showPasswords.current ? "text" : "password"}
                id="currentPassword"
                name="currentPassword"
                value={passwordData.currentPassword}
                onChange={handlePasswordInputChange}
                placeholder="Enter current password"
                required
                disabled={isChangingPassword}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPasswords({...showPasswords, current: !showPasswords.current})}
                disabled={isChangingPassword}
                tabIndex="-1"
              >
                {showPasswords.current ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="newPassword">New Password</label>
            <div className="input-with-toggle">
              <input
                type={showPasswords.new ? "text" : "password"}
                id="newPassword"
                name="newPassword"
                value={passwordData.newPassword}
                onChange={handlePasswordInputChange}
                placeholder="Enter new password (min 6 characters)"
                required
                minLength="6"
                disabled={isChangingPassword}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPasswords({...showPasswords, new: !showPasswords.new})}
                disabled={isChangingPassword}
                tabIndex="-1"
              >
                {showPasswords.new ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm New Password</label>
            <div className="input-with-toggle">
              <input
                type={showPasswords.confirm ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={passwordData.confirmPassword}
                onChange={handlePasswordInputChange}
                placeholder="Confirm new password"
                required
                minLength="6"
                disabled={isChangingPassword}
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPasswords({...showPasswords, confirm: !showPasswords.confirm})}
                disabled={isChangingPassword}
                tabIndex="-1"
              >
                {showPasswords.confirm ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>
          
          <button 
            type="submit" 
            className="btn-change-password"
            disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
          >
            {isChangingPassword ? '🔄 Changing Password...' : '🔒 Change Password'}
          </button>
        </form>
        
        <div className="password-requirements">
          <p><strong>Password Requirements:</strong></p>
          <ul>
            <li>Minimum 6 characters</li>
            <li>Cannot be the same as current password</li>
            <li>Cannot reuse recent passwords</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
