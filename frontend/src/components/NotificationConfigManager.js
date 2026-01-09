import React, { useState, useEffect } from 'react';
import { createApiInstance } from '../api';
import toastService from '../services/toastService';
import './NotificationConfigManager.css';

// Use global API factory for session handling
const adminApi = createApiInstance();

const NotificationConfigManager = () => {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

      </div>
    </div>
  );
};

export default NotificationConfigManager;
