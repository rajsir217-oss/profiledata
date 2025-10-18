import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AdminSettings.css';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Ticket Management Settings
  const [ticketDeleteDays, setTicketDeleteDays] = useState(30);
  const [savingTicketSettings, setSavingTicketSettings] = useState(false);
  const [ticketSettingsMessage, setTicketSettingsMessage] = useState({ type: '', text: '' });
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      navigate('/');
      return;
    }
    setCurrentUser(username);
    loadSettings();
  }, [navigate]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load system settings
      const response = await api.get('/system-settings');
      console.log('📥 Loaded settings from API:', response.data);
      
      const days = response.data.ticket_delete_days;
      console.log('📅 Ticket delete days from API:', days, 'Type:', typeof days);
      
      // Use the value from API, default to 30 only if undefined/null
      setTicketDeleteDays(days !== undefined && days !== null ? days : 30);
    } catch (error) {
      console.error('Error loading settings:', error);
      // Set default on error
      setTicketDeleteDays(30);
    } finally {
      setLoading(false);
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


  if (loading) {
    return (
      <div className="admin-settings-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading admin settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-header">
        <h1>⚙️ System Configuration</h1>
        <p>Configure global system settings and preferences</p>
        <div className="migration-notice">
          <span className="info-icon">ℹ️</span>
          <span>Looking for scheduler jobs? Visit the <strong>Dynamic Scheduler</strong> page for advanced job management.</span>
        </div>
      </div>

      {/* Ticket Management Settings */}
      <div className="settings-section">
        <div className="section-header">
          <h2>🎫 Ticket Management</h2>
          <p className="section-description">Configure automatic cleanup for resolved support tickets</p>
        </div>

        {ticketSettingsMessage.text && (
          <div className={`alert alert-${ticketSettingsMessage.type}`}>
            {ticketSettingsMessage.text}
          </div>
        )}

        <div className="settings-card">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label htmlFor="ticketDeleteDays">Auto-Delete Period</label>
              <div className="tooltip-wrapper">
                <span 
                  className="info-tooltip-icon" 
                  onClick={() => setShowTooltip(!showTooltip)}
                >
                  ℹ️
                </span>
                {showTooltip && (
                  <>
                    <div className="tooltip-backdrop" onClick={() => setShowTooltip(false)} />
                    <div className="tooltip-bubble">
                      <div className="tooltip-content">
                        <strong>How it works:</strong>
                        <ul>
                          <li>When a ticket is marked as <strong>resolved</strong> or <strong>closed</strong>, a deletion timestamp is set</li>
                          <li>A background job runs every hour to delete tickets past their scheduled deletion time</li>
                          <li>All attachments are permanently deleted from the filesystem</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="help-text">
              Resolved/closed tickets and attachments will be automatically deleted after this period.
            </p>
            
            <div className="settings-control-row">
              <select
                id="ticketDeleteDays"
                value={ticketDeleteDays}
                onChange={(e) => setTicketDeleteDays(Number(e.target.value))}
                disabled={savingTicketSettings}
                className="form-control"
              >
                <option value={0}>Immediately (on resolve/close)</option>
                <option value={7}>7 days after resolved</option>
                <option value={14}>14 days after resolved</option>
                <option value={30}>30 days after resolved (Recommended)</option>
                <option value={60}>60 days after resolved</option>
                <option value={90}>90 days after resolved</option>
              </select>
              
              <button
                className="btn-save-settings"
                onClick={handleSaveTicketSettings}
                disabled={savingTicketSettings}
              >
                {savingTicketSettings ? '💾 Saving...' : '💾 Save Ticket Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default AdminSettings;
