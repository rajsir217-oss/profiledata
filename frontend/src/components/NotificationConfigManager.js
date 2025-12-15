import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './NotificationConfigManager.css';

// Create admin API instance (bypasses /api/users prefix)
const adminApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 errors
adminApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const NotificationConfigManager = () => {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [testMode, setTestMode] = useState(false);
  const [testOldStatus, setTestOldStatus] = useState('active');
  const [testNewStatus, setTestNewStatus] = useState('suspended');
  const [testResult, setTestResult] = useState(null);
  const [saving, setSaving] = useState(null);

  // Fetch all notification triggers
  useEffect(() => {
    fetchTriggers();
  }, []);

  const fetchTriggers = async () => {
    try {
      setLoading(true);
      const response = await adminApi.get('/api/admin/notification-config/triggers');
      setTriggers(response.data.triggers || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching triggers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle notification trigger
  const handleToggle = async (transition, currentEnabled) => {
    try {
      setSaving(transition);
      const encodedTransition = encodeURIComponent(transition);
      
      await adminApi.patch(
        `/api/admin/notification-config/triggers/${encodedTransition}/toggle`,
        {
          transition: transition,
          enabled: !currentEnabled
        }
      );

      // Update local state
      setTriggers(triggers.map(t => 
        t.transition === transition 
          ? { ...t, enabled: !currentEnabled }
          : t
      ));

      // Show success notification
      showNotification('success', `Notification ${!currentEnabled ? 'enabled' : 'disabled'} for ${transition}`);
    } catch (err) {
      console.error('Error toggling trigger:', err);
      showNotification('error', `Failed to update trigger: ${err.message}`);
    } finally {
      setSaving(null);
    }
  };

  // Test status transition
  const handleTest = async () => {
    try {
      const response = await adminApi.get(
        `/api/admin/notification-config/triggers/check?old_status=${testOldStatus}&new_status=${testNewStatus}`
      );
      setTestResult(response.data);
    } catch (err) {
      console.error('Test error:', err);
      setTestResult({ error: err.message });
    }
  };

  // Preview email template
  const handlePreview = async (trigger) => {
    try {
      const response = await adminApi.get(`/api/notifications/templates/${trigger}`);
      setSelectedTemplate(response.data);
    } catch (err) {
      console.error('Error loading template:', err);
      showNotification('error', 'Template not found or failed to load');
    }
  };

  // Show notification
  const showNotification = (type, message) => {
    if (type === 'success') {
      toastService.success(message);
    } else if (type === 'error') {
      toastService.error(message);
    } else {
      toastService.info(message);
    }
  };

  // Render sample data for template preview
  const renderSampleData = (text) => {
    if (!text) return '';
    return text
      // Recipient/User variables
      .replace(/{recipient_firstName}/g, 'John')
      .replace(/{recipient\.firstName}/g, 'John')
      .replace(/{firstname}/g, 'John')
      .replace(/{lastname}/g, 'Doe')
      .replace(/{username}/g, 'johndoe')
      // Match/Actor variables
      .replace(/{match_firstName}/g, 'Sarah')
      .replace(/{match\.firstName}/g, 'Sarah')
      .replace(/{match_lastName}/g, 'Smith')
      .replace(/{match_username}/g, 'sarahsmith')
      // Status variables
      .replace(/{message}/g, 'Your account status has been updated.')
      .replace(/{reason}/g, 'Policy violation')
      // Stats variables
      .replace(/{stats_matchCount}/g, '5')
      .replace(/{stats_messageCount}/g, '12')
      .replace(/{stats_viewCount}/g, '25')
      .replace(/{stats_increase}/g, '50')
      .replace(/{stats_searchCount}/g, '50')
      .replace(/{matches_count}/g, '5')
      .replace(/{profile_completeness}/g, '75')
      .replace(/{milestone_description}/g, '10 Profile Views')
      .replace(/{pii_daysRemaining}/g, '3')
      // URL variables
      .replace(/{dashboard_url}/g, '#')
      .replace(/{profile_url}/g, '#')
      .replace(/{chat_url}/g, '#')
      .replace(/{search_url}/g, '#')
      .replace(/{preferences_url}/g, '#')
      .replace(/{unsubscribe_url}/g, '#')
      .replace(/{tracking_pixel_url}/g, '#')
      .replace(/{reset_url}/g, '#')
      .replace(/{security_url}/g, '#')
      .replace(/{contact_url}/g, '#');
  };

  // Group triggers by category
  const groupedTriggers = triggers.reduce((acc, trigger) => {
    const [, newStatus] = trigger.transition.split(' → ');
    
    let category;
    if (newStatus === 'active') {
      category = 'Activation & Reactivation';
    } else if (['suspended', 'banned'].includes(newStatus)) {
      category = 'Restrictions & Suspensions';
    } else if (newStatus === 'paused') {
      category = 'Paused';
    } else if (newStatus.includes('pending')) {
      category = 'Pending States';
    } else {
      category = 'Other';
    }

    if (!acc[category]) acc[category] = [];
    acc[category].push(trigger);
    return acc;
  }, {});

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical': return 'var(--error-color)';
      case 'high': return 'var(--warning-color)';
      case 'medium': return 'var(--info-color)';
      case 'low': return 'var(--text-secondary)';
      default: return 'var(--text-color)';
    }
  };

  const getPriorityIcon = (priority) => {
    switch (priority) {
      case 'critical': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '⚪';
    }
  };

  if (loading) {
    return (
      <div className="notification-config-manager">
        <div className="loading-spinner">Loading notification configurations...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="notification-config-manager">
        <div className="error-message">
          <span>❌</span>
          <p>{error}</p>
          <button onClick={fetchTriggers}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="notification-config-manager">
      <div className="config-header">
        <h1>📧 Notification Trigger Configuration</h1>
        <p className="subtitle">
          Control which status changes send email notifications to users
        </p>
        <div className="stats">
          <div className="stat-card">
            <span className="stat-label">Total Triggers</span>
            <span className="stat-value">{triggers.length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Enabled</span>
            <span className="stat-value">{triggers.filter(t => t.enabled).length}</span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Disabled</span>
            <span className="stat-value">{triggers.filter(t => !t.enabled).length}</span>
          </div>
        </div>
      </div>

      <div className="config-content">
        {/* Left Panel: Trigger List */}
        <div className="triggers-panel">
          <div className="panel-header">
            <h2>Status Change Triggers</h2>
            <button className="refresh-btn" onClick={fetchTriggers}>
              🔄 Refresh
            </button>
          </div>

          {Object.entries(groupedTriggers).map(([category, categoryTriggers]) => (
            <div key={category} className="trigger-category">
              <h3 className="category-title">{category}</h3>
              
              {categoryTriggers.map((trigger) => (
                <div 
                  key={trigger.transition} 
                  className={`trigger-item ${trigger.enabled ? 'enabled' : 'disabled'}`}
                >
                  <div className="trigger-info">
                    <div className="trigger-transition">
                      {trigger.transition}
                    </div>
                    <div className="trigger-description">
                      {trigger.description}
                    </div>
                    <div className="trigger-meta">
                      <span className="priority" style={{ color: getPriorityColor(trigger.priority) }}>
                        {getPriorityIcon(trigger.priority)} {trigger.priority}
                      </span>
                      {trigger.trigger && (
                        <span className="template-trigger">
                          📄 {trigger.trigger}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="trigger-actions">
                    {trigger.trigger && (
                      <button
                        className="preview-btn"
                        onClick={() => handlePreview(trigger.trigger)}
                        title="Preview email template"
                      >
                        👁️
                      </button>
                    )}
                    
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={trigger.enabled}
                        onChange={() => handleToggle(trigger.transition, trigger.enabled)}
                        disabled={saving === trigger.transition}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Right Panel: Preview & Test */}
        <div className="preview-panel">
          {/* Test Mode */}
          <div className="test-section">
            <div className="section-header">
              <h3>🧪 Test Mode</h3>
              <label className="test-toggle">
                <input
                  type="checkbox"
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                />
                <span>Enable Test Mode</span>
              </label>
            </div>

            {testMode && (
              <div className="test-controls">
                <p className="test-description">
                  Test if a status transition would trigger a notification
                </p>
                
                <div className="test-inputs">
                  <div className="input-group">
                    <label>Old Status:</label>
                    <select 
                      value={testOldStatus}
                      onChange={(e) => setTestOldStatus(e.target.value)}
                    >
                      <option value="pending_email_verification">Pending Email Verification</option>
                      <option value="pending_admin_approval">Pending Admin Approval</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="banned">Banned</option>
                      <option value="paused">Paused</option>
                      <option value="deactivated">Deactivated</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>

                  <div className="arrow">→</div>

                  <div className="input-group">
                    <label>New Status:</label>
                    <select 
                      value={testNewStatus}
                      onChange={(e) => setTestNewStatus(e.target.value)}
                    >
                      <option value="pending_email_verification">Pending Email Verification</option>
                      <option value="pending_admin_approval">Pending Admin Approval</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="banned">Banned</option>
                      <option value="paused">Paused</option>
                      <option value="deactivated">Deactivated</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <button className="test-btn" onClick={handleTest}>
                  Run Test
                </button>

                {testResult && (
                  <div className={`test-result ${testResult.should_notify ? 'will-notify' : 'wont-notify'}`}>
                    {testResult.error ? (
                      <>
                        <span className="result-icon">❌</span>
                        <div className="result-content">
                          <strong>Error:</strong> {testResult.error}
                        </div>
                      </>
                    ) : (
                      <>
                        <span className="result-icon">
                          {testResult.should_notify ? '✅' : '❌'}
                        </span>
                        <div className="result-content">
                          <strong>Transition:</strong> {testResult.transition}<br/>
                          <strong>Will Notify:</strong> {testResult.should_notify ? 'Yes' : 'No'}<br/>
                          {testResult.should_notify && (
                            <>
                              <strong>Template:</strong> {testResult.trigger}<br/>
                              <strong>Priority:</strong> {testResult.priority}<br/>
                            </>
                          )}
                          <strong>Description:</strong> {testResult.description}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Template Preview */}
          <div className="template-section">
            <h3>📄 Email Template Preview</h3>
            
            {selectedTemplate ? (
              <div className="template-preview">
                <div className="template-header">
                  <h4>{selectedTemplate.name}</h4>
                  <button 
                    className="close-btn"
                    onClick={() => setSelectedTemplate(null)}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="template-details">
                  <div className="detail-row">
                    <span className="label">Trigger:</span>
                    <span className="value">{selectedTemplate.trigger}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Subject:</span>
                    <span className="value">{renderSampleData(selectedTemplate.subject)}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Channel:</span>
                    <span className="value">{selectedTemplate.channel}</span>
                  </div>
                </div>

                <div className="template-body">
                  <h5>Email Body:</h5>
                  <div 
                    className="template-html"
                    dangerouslySetInnerHTML={{ __html: renderSampleData(selectedTemplate.body) }}
                  />
                </div>
              </div>
            ) : (
              <div className="no-template">
                <span>👁️</span>
                <p>Click the eye icon on any trigger to preview its email template</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationConfigManager;
