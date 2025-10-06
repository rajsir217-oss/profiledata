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
      name: 'Professional Light',
      description: 'Clean and modern light theme for daily use',
      preview: {
        primary: '#0052ff',
        secondary: '#188fff',
        background: '#ffffff',
        text: '#000000'
      }
    },
    {
      id: 'dark',
      name: 'Professional Dark',
      description: 'High contrast dark mode for reduced eye strain',
      preview: {
        primary: '#5b7fff',
        secondary: '#4a9fff',
        background: '#0a0e13',
        text: '#d1d4dc'
      }
    },
    {
      id: 'light-pink',
      name: 'Professional Classic',
      description: 'Elegant gray theme with purple accents',
      preview: {
        primary: '#570df8',
        secondary: '#6366f1',
        background: '#f5f5f5',
        text: '#1a1a1a'
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
