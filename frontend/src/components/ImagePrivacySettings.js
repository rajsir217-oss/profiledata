import React, { useState, useEffect } from 'react';
import './ImagePrivacySettings.css';

const ImagePrivacySettings = ({ 
  imageId,
  imageUrl,
  imageOrder,
  isProfilePic,
  initialSettings,
  onSave,
  onCancel,
  compact = false
}) => {
  const [settings, setSettings] = useState({
    initialVisibility: {
      type: 'blurred',
      blurLevel: 'medium',
      placeholderType: 'lock',
      customPlaceholder: '',
      clearForFavorites: true,
      clearForShortlist: true,
      clearAfterMessage: false,
      minConnectionLevel: 0
    },
    accessControl: {
      defaultDuration: 30,
      autoRenew: false,
      blurWarningStart: 3,
      maxViewers: 0,
      viewsPerUser: 0,
      downloadAllowed: false,
      requiresApproval: true,
      notifications: {
        beforeExpiry: 3,
        onExpiry: true,
        onRenewalRequest: true
      }
    }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (initialSettings) {
      setSettings({
        initialVisibility: {
          ...settings.initialVisibility,
          ...initialSettings.initialVisibility
        },
        accessControl: {
          ...settings.accessControl,
          ...initialSettings.accessControl,
          notifications: {
            ...settings.accessControl.notifications,
            ...initialSettings.accessControl?.notifications
          }
        }
      });
    }
  }, [initialSettings]);

  const updateInitialVisibility = (field, value) => {
    setSettings({
      ...settings,
      initialVisibility: {
        ...settings.initialVisibility,
        [field]: value
      }
    });
  };

  const updateAccessControl = (field, value) => {
    setSettings({
      ...settings,
      accessControl: {
        ...settings.accessControl,
        [field]: value
      }
    });
  };

  const updateNotification = (field, value) => {
    setSettings({
      ...settings,
      accessControl: {
        ...settings.accessControl,
        notifications: {
          ...settings.accessControl.notifications,
          [field]: value
        }
      }
    });
  };

  const applyPreset = (presetName) => {
    const presets = {
      maximum_privacy: {
        initialVisibility: {
          type: 'hidden',
          placeholderType: 'lock'
        },
        accessControl: {
          defaultDuration: 30,
          autoRenew: false,
          blurWarningStart: 3,
          requiresApproval: true,
          downloadAllowed: false
        }
      },
      balanced: {
        initialVisibility: {
          type: 'blurred',
          blurLevel: 'medium'
        },
        accessControl: {
          defaultDuration: 30,
          autoRenew: false,
          blurWarningStart: 3,
          requiresApproval: true,
          downloadAllowed: false
        }
      },
      smart: {
        initialVisibility: {
          type: 'smart',
          clearForFavorites: true,
          clearForShortlist: true
        },
        accessControl: {
          defaultDuration: 30,
          autoRenew: false,
          blurWarningStart: 3,
          requiresApproval: false,
          downloadAllowed: false
        }
      },
      open: {
        initialVisibility: {
          type: 'clear'
        },
        accessControl: {
          defaultDuration: 0,
          autoRenew: false,
          requiresApproval: false,
          downloadAllowed: true
        }
      }
    };

    const preset = presets[presetName];
    if (preset) {
      setSettings({
        initialVisibility: {
          ...settings.initialVisibility,
          ...preset.initialVisibility
        },
        accessControl: {
          ...settings.accessControl,
          ...preset.accessControl
        }
      });
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        imageId,
        imageUrl,
        imageOrder,
        isProfilePic,
        ...settings
      });
    }
  };

  if (compact) {
    return (
      <div className="image-privacy-settings compact">
        <div className="settings-header">
          <h4>🔒 Privacy Settings</h4>
        </div>

        <div className="preset-selector">
          <label>Quick Setup:</label>
          <div className="preset-buttons">
            <button onClick={() => applyPreset('maximum_privacy')} className="preset-btn">
              🔒 Private
            </button>
            <button onClick={() => applyPreset('balanced')} className="preset-btn active">
              ⚖️ Balanced
            </button>
            <button onClick={() => applyPreset('smart')} className="preset-btn">
              💝 Smart
            </button>
            <button onClick={() => applyPreset('open')} className="preset-btn">
              🌟 Public
            </button>
          </div>
        </div>

        <div className="compact-summary">
          <p>
            <strong>Visibility:</strong> {settings.initialVisibility.type === 'clear' ? 'Public' : 
              settings.initialVisibility.type === 'hidden' ? 'Hidden' :
              settings.initialVisibility.type === 'smart' ? 'Smart (favorites see)' : 
              `Blurred (${settings.initialVisibility.blurLevel})`}
          </p>
          <p>
            <strong>Access:</strong> {settings.accessControl.defaultDuration} days
            {settings.accessControl.requiresApproval ? ' (approval required)' : ' (auto-approve)'}
          </p>
        </div>

        <div className="settings-actions">
          <button onClick={() => setShowAdvanced(!showAdvanced)} className="btn-link">
            {showAdvanced ? '▼ Hide Advanced' : '▶ Show Advanced'}
          </button>
        </div>

        {showAdvanced && renderAdvancedSettings()}
      </div>
    );
  }

  const renderAdvancedSettings = () => (
    <div className="advanced-settings">
      {/* Initial Visibility Section */}
      <div className="settings-section">
        <h5>Initial Visibility (Before Access Granted)</h5>
        
        <div className="form-group">
          <label>Visibility Type:</label>
          <select 
            value={settings.initialVisibility.type}
            onChange={(e) => updateInitialVisibility('type', e.target.value)}
            className="form-control"
          >
            <option value="clear">🌟 Clear (Public)</option>
            <option value="blurred">🌫️ Blurred (Request Required)</option>
            <option value="hidden">🔒 Hidden (Request Required)</option>
            <option value="smart">👁️ Smart (Conditional)</option>
          </select>
        </div>

        {settings.initialVisibility.type === 'blurred' && (
          <div className="form-group">
            <label>Blur Level:</label>
            <div className="blur-level-selector">
              <input
                type="range"
                min="0"
                max="2"
                value={settings.initialVisibility.blurLevel === 'light' ? 0 : settings.initialVisibility.blurLevel === 'medium' ? 1 : 2}
                onChange={(e) => {
                  const levels = ['light', 'medium', 'heavy'];
                  updateInitialVisibility('blurLevel', levels[e.target.value]);
                }}
                className="blur-slider"
              />
              <div className="blur-labels">
                <span>Light</span>
                <span>Medium</span>
                <span>Heavy</span>
              </div>
            </div>
          </div>
        )}

        {settings.initialVisibility.type === 'hidden' && (
          <div className="form-group">
            <label>Placeholder:</label>
            <div className="placeholder-selector">
              <label className={`placeholder-option ${settings.initialVisibility.placeholderType === 'lock' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="placeholder"
                  value="lock"
                  checked={settings.initialVisibility.placeholderType === 'lock'}
                  onChange={(e) => updateInitialVisibility('placeholderType', e.target.value)}
                />
                <span className="icon">🔒</span>
                <span>Lock</span>
              </label>
              <label className={`placeholder-option ${settings.initialVisibility.placeholderType === 'silhouette' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="placeholder"
                  value="silhouette"
                  checked={settings.initialVisibility.placeholderType === 'silhouette'}
                  onChange={(e) => updateInitialVisibility('placeholderType', e.target.value)}
                />
                <span className="icon">👤</span>
                <span>Silhouette</span>
              </label>
              <label className={`placeholder-option ${settings.initialVisibility.placeholderType === 'frame' ? 'active' : ''}`}>
                <input
                  type="radio"
                  name="placeholder"
                  value="frame"
                  checked={settings.initialVisibility.placeholderType === 'frame'}
                  onChange={(e) => updateInitialVisibility('placeholderType', e.target.value)}
                />
                <span className="icon">🖼️</span>
                <span>Frame</span>
              </label>
            </div>
          </div>
        )}

        {settings.initialVisibility.type === 'smart' && (
          <div className="form-group">
            <label>Show Clear For:</label>
            <div className="checkbox-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.initialVisibility.clearForFavorites}
                  onChange={(e) => updateInitialVisibility('clearForFavorites', e.target.checked)}
                />
                <span>⭐ Users who favorited me</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.initialVisibility.clearForShortlist}
                  onChange={(e) => updateInitialVisibility('clearForShortlist', e.target.checked)}
                />
                <span>📋 Users who shortlisted me</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={settings.initialVisibility.clearAfterMessage}
                  onChange={(e) => updateInitialVisibility('clearAfterMessage', e.target.checked)}
                />
                <span>💬 Users who messaged me</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Access Control Section */}
      <div className="settings-section">
        <h5>After Access Granted</h5>
        
        <div className="form-group">
          <label>Access Duration:</label>
          <select
            value={settings.accessControl.defaultDuration}
            onChange={(e) => updateAccessControl('defaultDuration', parseInt(e.target.value))}
            className="form-control"
          >
            <option value="7">7 days (1 week)</option>
            <option value="14">14 days (2 weeks)</option>
            <option value="30">30 days (1 month)</option>
            <option value="60">60 days (2 months)</option>
            <option value="90">90 days (3 months)</option>
            <option value="180">180 days (6 months)</option>
            <option value="0">Unlimited</option>
          </select>
        </div>

        <div className="form-group">
          <label>Blur Warning:</label>
          <div className="input-group">
            <input
              type="number"
              min="1"
              max="7"
              value={settings.accessControl.blurWarningStart}
              onChange={(e) => updateAccessControl('blurWarningStart', parseInt(e.target.value))}
              className="form-control"
            />
            <span className="input-addon">days before expiry</span>
          </div>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.accessControl.autoRenew}
              onChange={(e) => updateAccessControl('autoRenew', e.target.checked)}
            />
            <span>⚡ Auto-renew access when it expires</span>
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.accessControl.requiresApproval}
              onChange={(e) => updateAccessControl('requiresApproval', e.target.checked)}
            />
            <span>✋ Require my approval for access requests</span>
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.accessControl.downloadAllowed}
              onChange={(e) => updateAccessControl('downloadAllowed', e.target.checked)}
            />
            <span>⬇️ Allow downloads (not recommended)</span>
          </label>
        </div>
      </div>

      {/* Notifications Section */}
      <div className="settings-section">
        <h5>Notifications</h5>
        
        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.accessControl.notifications.onExpiry}
              onChange={(e) => updateNotification('onExpiry', e.target.checked)}
            />
            <span>🔔 Notify when access expires</span>
          </label>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.accessControl.notifications.onRenewalRequest}
              onChange={(e) => updateNotification('onRenewalRequest', e.target.checked)}
            />
            <span>🔔 Notify on renewal requests</span>
          </label>
        </div>

        <div className="form-group">
          <label>Warn me:</label>
          <select
            value={settings.accessControl.notifications.beforeExpiry}
            onChange={(e) => updateNotification('beforeExpiry', parseInt(e.target.value))}
            className="form-control"
          >
            <option value="1">1 day before expiry</option>
            <option value="3">3 days before expiry</option>
            <option value="7">7 days before expiry</option>
          </select>
        </div>
      </div>
    </div>
  );

  return (
    <div className="image-privacy-settings full">
      <div className="settings-header">
        <h3>📷 Image Privacy Settings</h3>
        {imageUrl && (
          <div className="image-preview">
            <img src={imageUrl} alt="Preview" />
            {isProfilePic && <span className="badge">Profile Picture</span>}
          </div>
        )}
      </div>

      <div className="preset-selector">
        <label>⚡ Quick Setup Presets:</label>
        <div className="preset-grid">
          <div 
            className="preset-card"
            onClick={() => applyPreset('maximum_privacy')}
          >
            <div className="preset-icon">🔒</div>
            <h4>Maximum Privacy</h4>
            <p>Hidden placeholder, 30-day access, approval required</p>
          </div>

          <div 
            className="preset-card"
            onClick={() => applyPreset('balanced')}
          >
            <div className="preset-icon">⚖️</div>
            <h4>Balanced</h4>
            <p>Medium blur, 30-day access, approval required</p>
          </div>

          <div 
            className="preset-card"
            onClick={() => applyPreset('smart')}
          >
            <div className="preset-icon">💝</div>
            <h4>Smart (Recommended)</h4>
            <p>Clear for favorites, blur for others</p>
          </div>

          <div 
            className="preset-card"
            onClick={() => applyPreset('open')}
          >
            <div className="preset-icon">🌟</div>
            <h4>Open</h4>
            <p>All photos clear, unlimited access</p>
          </div>
        </div>
      </div>

      {renderAdvancedSettings()}

      <div className="settings-actions">
        <button onClick={onCancel} className="btn btn-secondary">
          Cancel
        </button>
        <button onClick={handleSave} className="btn btn-primary">
          💾 Save Settings
        </button>
      </div>
    </div>
  );
};

export default ImagePrivacySettings;
