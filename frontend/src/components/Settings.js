import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './Settings.css';

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  // Cleanup settings
  const [cleanupDays, setCleanupDays] = useState(90);
  const [cleanupStats, setCleanupStats] = useState(null);
  
  const cleanupOptions = [
    { value: 30, label: '30 days (1 month)' },
    { value: 60, label: '60 days (2 months)' },
    { value: 90, label: '90 days (3 months) - Recommended' },
    { value: 120, label: '120 days (4 months)' },
    { value: 180, label: '180 days (6 months)' },
    { value: 365, label: '365 days (1 year)' }
  ];

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');

      // Load cleanup settings
      const cleanupResponse = await api.get('/cleanup-settings');
      setCleanupDays(cleanupResponse.data.cleanup_days);

      // Load cleanup stats
      const statsResponse = await api.get('/cleanup-stats');
      setCleanupStats(statsResponse.data);

      console.log('✅ Settings loaded');
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCleanupSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccessMsg('');

      const response = await api.put('/cleanup-settings', {
        cleanup_days: cleanupDays
      });

      setSuccessMsg(`✅ ${response.data.message}`);
      
      // Reload stats
      const statsResponse = await api.get('/cleanup-stats');
      setCleanupStats(statsResponse.data);

      // Auto-hide success message
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings: ' + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="settings-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-page">
      {/* Header */}
      <div className="settings-header">
        <h2>⚙️ Settings</h2>
        <p className="text-muted">Manage your account preferences</p>
      </div>

      {error && (
        <div className="alert alert-danger">{error}</div>
      )}

      {successMsg && (
        <div className="alert alert-success">{successMsg}</div>
      )}

      {/* Cleanup Settings Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>🗑️ Data Cleanup Settings</h3>
          <p className="section-description">
            Automatically clean up old favorites, shortlist items, and messages to keep your account fresh.
            You'll receive notifications 30, 10, and 1 day(s) before cleanup.
          </p>
        </div>

        <div className="cleanup-settings-card">
          {/* Cleanup Period Selector */}
          <div className="form-group">
            <label htmlFor="cleanup-days">
              <strong>Cleanup Period</strong>
            </label>
            <p className="help-text">
              Data older than this period will be automatically deleted
            </p>
            <select
              id="cleanup-days"
              className="form-control"
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
            >
              {cleanupOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Current Stats */}
          {cleanupStats && (
            <div className="cleanup-stats">
              <h4>📊 Current Data Status</h4>
              <p className="stats-info">
                Items that will be cleaned if older than <strong>{cleanupStats.cleanup_days} days</strong>:
              </p>
              <div className="stats-grid">
                <div className="stat-item">
                  <div className="stat-icon">❤️</div>
                  <div className="stat-details">
                    <div className="stat-label">Favorites</div>
                    <div className="stat-value">{cleanupStats.stats.favorites}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">⭐</div>
                  <div className="stat-details">
                    <div className="stat-label">Shortlist</div>
                    <div className="stat-value">{cleanupStats.stats.shortlist}</div>
                  </div>
                </div>
                <div className="stat-item">
                  <div className="stat-icon">💬</div>
                  <div className="stat-details">
                    <div className="stat-label">Messages</div>
                    <div className="stat-value">{cleanupStats.stats.messages}</div>
                  </div>
                </div>
                <div className="stat-item total">
                  <div className="stat-icon">📦</div>
                  <div className="stat-details">
                    <div className="stat-label">Total Items</div>
                    <div className="stat-value">{cleanupStats.stats.total}</div>
                  </div>
                </div>
              </div>
              {cleanupStats.stats.total > 0 ? (
                <div className="alert alert-warning mt-3">
                  ⚠️ <strong>{cleanupStats.stats.total}</strong> items are scheduled for cleanup.
                  Interact with them to prevent deletion.
                </div>
              ) : (
                <div className="alert alert-success mt-3">
                  ✅ No items scheduled for cleanup. All your data is recent!
                </div>
              )}
            </div>
          )}

          {/* Save Button */}
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={handleSaveCleanupSettings}
              disabled={saving}
            >
              {saving ? '💾 Saving...' : '💾 Save Cleanup Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Community Guidelines Section */}
      <div className="settings-section">
        <div className="section-header">
          <h3>📜 Community Guidelines</h3>
          <p className="section-description">
            Please review our community guidelines to ensure a safe and respectful environment for all users.
          </p>
        </div>

        <div className="guidelines-card">
          <div className="guideline-item">
            <div className="guideline-icon">🤝</div>
            <div className="guideline-content">
              <h4>Professional Conduct</h4>
              <p>
                All users must maintain professional and respectful communication.
                Vulgar, abusive, or inappropriate language is strictly prohibited.
              </p>
            </div>
          </div>

          <div className="guideline-item">
            <div className="guideline-icon">🚫</div>
            <div className="guideline-content">
              <h4>Zero Tolerance Policy</h4>
              <p>
                We have zero tolerance for harassment, hate speech, threats, or
                sexually explicit content. Violations will result in immediate
                account suspension or permanent ban.
              </p>
            </div>
          </div>

          <div className="guideline-item">
            <div className="guideline-icon">⚖️</div>
            <div className="guideline-content">
              <h4>Consequences</h4>
              <ul>
                <li><strong>1st violation:</strong> Warning</li>
                <li><strong>2nd violation:</strong> 7-day suspension</li>
                <li><strong>3rd violation:</strong> Permanent ban</li>
              </ul>
              <p className="text-danger">
                <strong>Severe violations may result in immediate permanent ban.</strong>
              </p>
            </div>
          </div>

          <div className="guideline-item">
            <div className="guideline-icon">📢</div>
            <div className="guideline-content">
              <h4>Reporting Violations</h4>
              <p>
                If you encounter inappropriate behavior, please report it immediately.
                All reports are reviewed promptly and kept confidential.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Back Button */}
      <div className="settings-footer">
        <button
          className="btn btn-secondary"
          onClick={() => navigate('/')}
        >
          ← Back to Dashboard
        </button>
      </div>
    </div>
  );
};

export default Settings;
