import React, { useState, useEffect } from 'react';
import './Preferences.css';

const Preferences = () => {
  const [selectedTheme, setSelectedTheme] = useState(
    localStorage.getItem('appTheme') || 'light-blue'
  );
  const [showSaveMessage, setShowSaveMessage] = useState(false);

  const themes = [
    {
      id: 'light-blue',
      name: 'Light Blue',
      description: 'Clean and professional blue theme',
      preview: {
        primary: '#667eea',
        secondary: '#764ba2',
        background: '#f5f7fa',
        text: '#2c3e50'
      }
    },
    {
      id: 'dark',
      name: 'Dark Mode',
      description: 'Easy on the eyes dark theme',
      preview: {
        primary: '#bb86fc',
        secondary: '#3700b3',
        background: '#121212',
        text: '#ffffff'
      }
    },
    {
      id: 'light-pink',
      name: 'Light Pink',
      description: 'Soft and elegant pink theme',
      preview: {
        primary: '#ff6b9d',
        secondary: '#c44569',
        background: '#ffeef8',
        text: '#4a4a4a'
      }
    }
  ];

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
  }, [selectedTheme]);

  const handleThemeChange = (themeId) => {
    setSelectedTheme(themeId);
    localStorage.setItem('appTheme', themeId);
    setShowSaveMessage(true);
    
    // Hide save message after 2 seconds
    setTimeout(() => {
      setShowSaveMessage(false);
    }, 2000);
  };

  return (
    <div className="preferences-container">
      <div className="preferences-header">
        <h1>My Preferences</h1>
        <p>Customize your app experience</p>
      </div>

      {showSaveMessage && (
        <div className="save-message">
          ✅ Theme saved successfully!
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
              <div className="theme-preview">
                <div 
                  className="color-strip primary"
                  style={{ backgroundColor: theme.preview.primary }}
                />
                <div 
                  className="color-strip secondary"
                  style={{ backgroundColor: theme.preview.secondary }}
                />
                <div 
                  className="color-strip background"
                  style={{ backgroundColor: theme.preview.background }}
                />
                <div 
                  className="color-strip text"
                  style={{ backgroundColor: theme.preview.text }}
                />
              </div>
              <h3>{theme.name}</h3>
              <p>{theme.description}</p>
              {selectedTheme === theme.id && (
                <div className="selected-badge">✓ Active</div>
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
        <h2>🔒 Privacy Settings</h2>
        <p className="section-description">Coming soon...</p>
        <div className="coming-soon">
          <p>Control who can see your profile, message you, and access your information.</p>
        </div>
      </div>
    </div>
  );
};

export default Preferences;
