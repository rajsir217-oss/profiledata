import React, { useState } from 'react';
import './ScheduleNotificationModal.css';

const ScheduleNotificationModal = ({ template, onClose, onSchedule }) => {
  const [formData, setFormData] = useState({
    scheduleType: 'one_time',
    scheduledFor: '',
    scheduledTime: '09:00',
    recurrencePattern: 'daily',
    cronExpression: '0 9 * * *',
    dayOfWeek: 'Monday',
    timezone: 'America/Los_Angeles',
    recipientType: 'active_users',
    maxRecipients: 0,
    enabled: true
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleScheduleTypeChange = (type) => {
    setFormData(prev => ({ ...prev, scheduleType: type }));
  };

  const handleRecurrenceChange = (pattern) => {
    setFormData(prev => ({ ...prev, recurrencePattern: pattern }));
    
    // Update cron expression based on pattern
    let cron = '';
    const [hour, minute] = formData.scheduledTime.split(':');
    
    switch (pattern) {
      case 'daily':
        cron = `${minute} ${hour} * * *`;
        break;
      case 'weekly':
        const dayMap = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
        cron = `${minute} ${hour} * * ${dayMap[formData.dayOfWeek]}`;
        break;
      case 'monthly':
        cron = `${minute} ${hour} 1 * *`;
        break;
      default:
        break;
    }
    
    if (cron) {
      setFormData(prev => ({ ...prev, cronExpression: cron }));
    }
  };

  const handleTimeChange = (time) => {
    setFormData(prev => ({ ...prev, scheduledTime: time }));
    
    // Update cron if recurring
    if (formData.scheduleType === 'recurring' && formData.recurrencePattern !== 'custom') {
      handleRecurrenceChange(formData.recurrencePattern);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build schedule data
      const scheduleData = {
        templateId: template._id,
        trigger: template.trigger,
        channel: template.channel,
        scheduleType: formData.scheduleType,
        timezone: formData.timezone,
        recipientType: formData.recipientType,
        maxRecipients: parseInt(formData.maxRecipients) || 0,
        enabled: formData.enabled,
        templateData: {}
      };

      if (formData.scheduleType === 'one_time') {
        // Combine date and time for one-time schedule
        const dateTime = new Date(`${formData.scheduledFor}T${formData.scheduledTime}`);
        scheduleData.scheduledFor = dateTime.toISOString();
      } else {
        // Recurring schedule
        scheduleData.recurrencePattern = formData.recurrencePattern;
        if (formData.recurrencePattern === 'custom') {
          scheduleData.cronExpression = formData.cronExpression;
        }
      }

      const token = localStorage.getItem('token');
      const response = await fetch(`${window.RUNTIME_CONFIG?.SOCKET_URL || process.env.REACT_APP_SOCKET_URL || 'http://localhost:8000'}/api/notifications/scheduled`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(scheduleData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to schedule notification');
      }

      const result = await response.json();
      onSchedule(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content schedule-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⏰ Event Queue Schedule Notifications</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Template Info */}
          <div className="schedule-section">
            <div className="template-info-box">
              <strong>Template:</strong> {template.subject || template.trigger}
              <br />
              <small>{template.channel} notification</small>
            </div>
          </div>

          {/* Schedule Type */}
          <div className="schedule-section">
            <label>Send Type</label>
            <div className="schedule-type-buttons">
              <button
                type="button"
                className={`type-btn ${formData.scheduleType === 'one_time' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('one_time')}
              >
                📅 One-Time
              </button>
              <button
                type="button"
                className={`type-btn ${formData.scheduleType === 'recurring' ? 'active' : ''}`}
                onClick={() => handleScheduleTypeChange('recurring')}
              >
                🔄 Recurring
              </button>
            </div>
          </div>

          {/* One-Time Schedule */}
          {formData.scheduleType === 'one_time' && (
            <div className="schedule-section">
              <label>Send Date & Time</label>
              <div className="datetime-inputs">
                <input
                  type="date"
                  value={formData.scheduledFor}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduledFor: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
                <input
                  type="time"
                  value={formData.scheduledTime}
                  onChange={(e) => handleTimeChange(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Recurring Schedule */}
          {formData.scheduleType === 'recurring' && (
            <>
              <div className="schedule-section">
                <label>Recurrence Pattern</label>
                <div className="recurrence-buttons">
                  <button
                    type="button"
                    className={`pattern-btn ${formData.recurrencePattern === 'daily' ? 'active' : ''}`}
                    onClick={() => handleRecurrenceChange('daily')}
                  >
                    📅 Daily
                  </button>
                  <button
                    type="button"
                    className={`pattern-btn ${formData.recurrencePattern === 'weekly' ? 'active' : ''}`}
                    onClick={() => handleRecurrenceChange('weekly')}
                  >
                    📆 Weekly
                  </button>
                  <button
                    type="button"
                    className={`pattern-btn ${formData.recurrencePattern === 'monthly' ? 'active' : ''}`}
                    onClick={() => handleRecurrenceChange('monthly')}
                  >
                    🗓️ Monthly
                  </button>
                  <button
                    type="button"
                    className={`pattern-btn ${formData.recurrencePattern === 'custom' ? 'active' : ''}`}
                    onClick={() => handleRecurrenceChange('custom')}
                  >
                    ⚙️ Custom
                  </button>
                </div>
              </div>

              {formData.recurrencePattern === 'weekly' && (
                <div className="schedule-section">
                  <label>Day of Week</label>
                  <select
                    value={formData.dayOfWeek}
                    onChange={(e) => {
                      setFormData(prev => ({ ...prev, dayOfWeek: e.target.value }));
                      handleRecurrenceChange('weekly');
                    }}
                  >
                    <option value="Monday">Monday</option>
                    <option value="Tuesday">Tuesday</option>
                    <option value="Wednesday">Wednesday</option>
                    <option value="Thursday">Thursday</option>
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>
              )}

              {formData.recurrencePattern !== 'custom' && (
                <div className="schedule-section">
                  <label>Time of Day</label>
                  <input
                    type="time"
                    value={formData.scheduledTime}
                    onChange={(e) => handleTimeChange(e.target.value)}
                  />
                  <small className="schedule-preview">
                    {formData.recurrencePattern === 'daily' && `Sends daily at ${formData.scheduledTime}`}
                    {formData.recurrencePattern === 'weekly' && `Sends every ${formData.dayOfWeek} at ${formData.scheduledTime}`}
                    {formData.recurrencePattern === 'monthly' && `Sends on the 1st of each month at ${formData.scheduledTime}`}
                  </small>
                </div>
              )}

              {formData.recurrencePattern === 'custom' && (
                <div className="schedule-section">
                  <label>Cron Expression</label>
                  <input
                    type="text"
                    value={formData.cronExpression}
                    onChange={(e) => setFormData(prev => ({ ...prev, cronExpression: e.target.value }))}
                    placeholder="0 9 * * *"
                  />
                  <small>Format: minute hour day month weekday</small>
                </div>
              )}
            </>
          )}

          {/* Timezone */}
          <div className="schedule-section">
            <label>Timezone</label>
            <select
              value={formData.timezone}
              onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
            >
              <option value="UTC">UTC</option>
              <option value="America/Los_Angeles">Pacific Time (Los Angeles)</option>
              <option value="America/Denver">Mountain Time (Denver)</option>
              <option value="America/Chicago">Central Time (Chicago)</option>
              <option value="America/New_York">Eastern Time (New York)</option>
              <option value="Asia/Kolkata">India (Kolkata)</option>
              <option value="Europe/London">London</option>
            </select>
          </div>

          {/* Recipients */}
          <div className="schedule-section">
            <label>Recipients</label>
            <select
              value={formData.recipientType}
              onChange={(e) => setFormData(prev => ({ ...prev, recipientType: e.target.value }))}
            >
              <option value="active_users">Active Users Only</option>
              <option value="all_users">All Users</option>
              <option value="test">Test (Admin Only)</option>
            </select>
          </div>

          {/* Max Recipients */}
          <div className="schedule-section">
            <label>Max Recipients (0 = unlimited)</label>
            <input
              type="number"
              value={formData.maxRecipients}
              onChange={(e) => setFormData(prev => ({ ...prev, maxRecipients: e.target.value }))}
              min="0"
            />
          </div>

          {error && (
            <div className="error-banner">
              ❌ {error}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn btn-primary" 
            onClick={handleSubmit}
            disabled={loading || (formData.scheduleType === 'one_time' && !formData.scheduledFor)}
          >
            {loading ? 'Scheduling...' : '⏰ Schedule Notification Queue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleNotificationModal;
