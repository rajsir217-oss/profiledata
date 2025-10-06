import React, { useState, useEffect } from 'react';
import './Preferences.css';

const Preferences = () => {
  const [selectedTheme, setSelectedTheme] = useState(
    localStorage.getItem('appTheme') || 'light-blue'
  );
  const [showSaveMessage, setShowSaveMessage] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  const themes = [
    {
      id: 'light-blue',
      name: 'Cozy Light',
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
      description: 'Ultra minimal gray theme with maximum whitespace',
      preview: {
        primary: '#475569',
        secondary: '#64748b',
        background: '#fcfcfd',
        text: '#0f172a'
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
  };

  return (
    <div className="preferences-container">
      <div className="preferences-header">
        <h1>My Preferences</h1>
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
