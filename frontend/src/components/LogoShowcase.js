import React, { useState } from 'react';
import Logo from './Logo';
import './LogoShowcase.css';

const LogoShowcase = () => {
  const [selectedTheme, setSelectedTheme] = useState('light');

  return (
    <div className="logo-showcase">
      <div className="showcase-header">
        <h1>💕 L3V3L Logo Design</h1>
        <p>Choose your preferred style for L3V3L - A Fresh Dating Philosophy</p>
        
        <div className="theme-toggle">
          <button 
            className={selectedTheme === 'light' ? 'active' : ''}
            onClick={() => setSelectedTheme('light')}
          >
            ☀️ Light Theme
          </button>
          <button 
            className={selectedTheme === 'dark' ? 'active' : ''}
            onClick={() => setSelectedTheme('dark')}
          >
            🌙 Dark Theme
          </button>
        </div>
      </div>

      <div className="showcase-grid">
        {/* GEOMETRIC/MINIMALIST STYLE */}
        <div className="showcase-card">
          <div className="card-header">
            <h2>🔷 Minimalist / Geometric</h2>
            <span className="badge">Option A</span>
          </div>
          
          <div className={`logo-preview ${selectedTheme === 'dark' ? 'dark' : ''}`}>
            <div className="preview-section">
              <h3>With Text</h3>
              <Logo variant="geometric" size="large" showText={true} theme={selectedTheme} />
            </div>
            
            <div className="preview-section">
              <h3>Icon Only</h3>
              <Logo variant="geometric" size="large" showText={false} theme={selectedTheme} />
            </div>
            
            <div className="preview-section">
              <h3>Small Size</h3>
              <Logo variant="geometric" size="small" showText={true} theme={selectedTheme} />
            </div>
          </div>
          
          <div className="card-description">
            <h4>✨ Style Features:</h4>
            <ul>
              <li>💕 Three stacked hearts = Mind, Body, Spirit</li>
              <li>❤️ Clear dating/love symbolism</li>
              <li>✅ Three levels = L3V3L philosophy</li>
              <li>✨ Clean, modern, romantic</li>
              <li>📱 Instantly recognizable as dating app</li>
              <li>🎯 Perfect for dating/relationship brand</li>
            </ul>
          </div>
        </div>

        {/* MODERN/PROFESSIONAL STYLE */}
        <div className="showcase-card">
          <div className="card-header">
            <h2>💼 Modern / Professional</h2>
            <span className="badge badge-alt">Option B</span>
          </div>
          
          <div className={`logo-preview ${selectedTheme === 'dark' ? 'dark' : ''}`}>
            <div className="preview-section">
              <h3>With Text</h3>
              <Logo variant="modern" size="large" showText={true} theme={selectedTheme} />
            </div>
            
            <div className="preview-section">
              <h3>Icon Only</h3>
              <Logo variant="modern" size="large" showText={false} theme={selectedTheme} />
            </div>
            
            <div className="preview-section">
              <h3>Small Size</h3>
              <Logo variant="modern" size="small" showText={true} theme={selectedTheme} />
            </div>
          </div>
          
          <div className="card-description">
            <h4>✨ Style Features:</h4>
            <ul>
              <li>👥 Two people connecting = Dating/relationships</li>
              <li>💖 Heart between them = Love & compatibility</li>
              <li>⚫⚫⚫ Three dots = 3 levels of matching</li>
              <li>🤝 Human-centered design = Connection focus</li>
              <li>✨ Professional, approachable, warm</li>
              <li>📱 Perfect for app icons & branding</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Usage Examples */}
      <div className="usage-examples">
        <h2>📱 Logo in Action</h2>
        
        <div className="example-grid">
          <div className="example-card">
            <h3>🧭 Navbar</h3>
            <div className={`example-preview navbar-preview ${selectedTheme === 'dark' ? 'dark' : ''}`}>
              <Logo variant="geometric" size="small" showText={true} theme={selectedTheme} />
              <span className="nav-text">Home • Matches • Messages</span>
            </div>
          </div>
          
          <div className="example-card">
            <h3>📱 App Icon</h3>
            <div className="example-preview app-icon-preview">
              <Logo variant="modern" size="large" showText={false} theme="light" />
            </div>
          </div>
          
          <div className="example-card">
            <h3>✉️ Email Header</h3>
            <div className={`example-preview email-preview ${selectedTheme === 'dark' ? 'dark' : ''}`}>
              <Logo variant="geometric" size="medium" showText={true} theme={selectedTheme} />
            </div>
          </div>
        </div>
      </div>

      <div className="decision-prompt">
        <h2>🤔 Which one speaks to you?</h2>
        <p>Both logos are production-ready and fully responsive!</p>
      </div>
    </div>
  );
};

export default LogoShowcase;
