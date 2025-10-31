import React, { useState, useEffect } from 'react';
import { getFrontendUrl } from '../utils/urlHelper';
import './TemplateManager.css';
import useToast from '../hooks/useToast';
import ScheduleNotificationModal from './ScheduleNotificationModal';
import ScheduleListModal from './ScheduleListModal';
import { API_ENDPOINTS } from '../config/apiConfig';

const TemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScheduleListModal, setShowScheduleListModal] = useState(false);
  const [scheduleTemplate, setScheduleTemplate] = useState(null);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const toast = useToast();
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sample data for preview
  const sampleData = {
    recipient: {
      firstName: 'Sarah',
      username: 'sarah_j',
      age: 27,
      location: 'Boston'
    },
    match: {
      firstName: 'Mike',
      username: 'mike_dev',
      age: 30,
      matchScore: 92,
      location: 'Boston',
      occupation: 'Software Engineer',
      education: 'MBA',
      profession: 'Software Engineer'
    },
    event: {
      type: 'new_match',
      timestamp: new Date().toISOString(),
      message: 'You have a new match!'
    },
    app: {
      logoUrl: 'http://localhost:8000/uploads/logo.png',
      trackingPixelUrl: 'http://localhost:8000/api/email-tracking/pixel/preview',
      profileUrl: `${getFrontendUrl()}/profile/mike_dev`,
      profileUrl_tracked: `${getFrontendUrl()}/profile/mike_dev`,
      chatUrl: `${getFrontendUrl()}/messages`,
      chatUrl_tracked: `${getFrontendUrl()}/messages`,
      matchUrl: `${getFrontendUrl()}/matches`,
      settingsUrl: `${getFrontendUrl()}/settings`,
      unsubscribeUrl: `${getFrontendUrl()}/unsubscribe`,
      unsubscribeUrl_tracked: `${getFrontendUrl()}/unsubscribe`,
      preferencesUrl_tracked: `${getFrontendUrl()}/preferences`,
      approveUrl_tracked: `${getFrontendUrl()}/pii/approve`,
      denyUrl_tracked: `${getFrontendUrl()}/pii/deny`,
      dashboardUrl: `${getFrontendUrl()}/dashboard`,
      contactUrl: `${getFrontendUrl()}/contact`,
      searchUrl: `${getFrontendUrl()}/search`,
      securityUrl: `${getFrontendUrl()}/security`
    },
    stats: {
      mutualMatches: 12,
      unreadMessages: 5,
      profileViews: 23,
      newMatches: 3,
      favorites: 8,
      searchCount: 45,
      increase: 25
    },
    message: {
      preview: 'Hey! I saw your profile and would love to connect...'
    },
    pii: {
      daysRemaining: 7,
      expiryDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()
    },
    milestone: {
      description: '100 Profile Views',
      value: 100
    },
    profile: {
      completeness: 75,
      missingFields: 'photos, bio'
    },
    matches: {
      count: 5
    },
    login: {
      location: 'San Francisco, CA',
      device: 'Chrome on MacBook',
      timestamp: new Date().toLocaleString(),
      ipAddress: '192.168.1.1'
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATION_TEMPLATES}?include_job_templates=true`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Session expired - redirect to login
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Template load failed:', response.status, errorText);
        throw new Error(`Failed to load templates: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ Loaded templates from API:', data);
      console.log('   Template count:', Array.isArray(data) ? data.length : 'not an array');
      
      // Handle different response formats
      const templateArray = Array.isArray(data) ? data : (data.templates || []);
      setTemplates(templateArray);
    } catch (err) {
      console.error('❌ Error loading templates:', err);
      toast.error('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const loadScheduledNotifications = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(API_ENDPOINTS.NOTIFICATION_SCHEDULED, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setScheduledNotifications(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error loading scheduled notifications:', err);
    }
  };

  const getScheduleTooltip = (template) => {
    // Find all schedules for this template
    const schedules = scheduledNotifications.filter(
      s => s.templateId === template._id && s.enabled
    );

    if (schedules.length === 0) {
      return 'Schedule Notification Queue - No active schedules';
    }

    if (schedules.length === 1) {
      const schedule = schedules[0];
      const typeText = schedule.scheduleType === 'one_time' ? 'One-time' : 'Recurring';
      const timeText = schedule.scheduleType === 'one_time'
        ? new Date(schedule.scheduledFor).toLocaleString()
        : `${schedule.recurrencePattern} at ${schedule.nextRun ? new Date(schedule.nextRun).toLocaleTimeString() : 'scheduled'}`;
      const recipientText = schedule.recipientType.replace('_', ' ');
      
      return `${typeText}: ${timeText}\nRecipients: ${recipientText}`;
    }

    return `${schedules.length} active schedules\nClick to view details`;
  };

  const getScheduleDisplay = (template) => {
    // Find all schedules for this template
    const schedules = scheduledNotifications.filter(
      s => s.templateId === template._id && s.enabled
    );

    if (schedules.length === 0) {
      return null;
    }

    if (schedules.length === 1) {
      const schedule = schedules[0];
      const nextRun = schedule.nextRun ? new Date(schedule.nextRun) : null;
      
      return {
        type: schedule.scheduleType === 'one_time' ? 'One-time' : 'Recurring',
        nextRun: nextRun ? nextRun.toLocaleString() : 'Calculating...',
        count: 1
      };
    }

    // Multiple schedules - find the earliest nextRun
    const nextSchedule = schedules.reduce((earliest, current) => {
      const currentNext = new Date(current.nextRun);
      const earliestNext = new Date(earliest.nextRun);
      return currentNext < earliestNext ? current : earliest;
    });

    return {
      type: `${schedules.length} schedules`,
      nextRun: nextSchedule.nextRun ? new Date(nextSchedule.nextRun).toLocaleString() : 'Multiple',
      count: schedules.length
    };
  };

  useEffect(() => {
    loadTemplates();
    loadScheduledNotifications();
  }, []);

  // ESC key listener for preview modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showPreview) {
        setShowPreview(false);
      }
    };

    if (showPreview) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showPreview]);

  const handleEdit = (template) => {
    setEditTemplate({ ...template });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = editTemplate._id
        ? `${API_ENDPOINTS.NOTIFICATION_TEMPLATES}/${editTemplate._id}`
        : API_ENDPOINTS.NOTIFICATION_TEMPLATES;
      
      const response = await fetch(url, {
        method: editTemplate._id ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          trigger: editTemplate.trigger,
          channel: editTemplate.channel,
          category: editTemplate.category,
          subject: editTemplate.subject,
          body: editTemplate.body,
          active: editTemplate.active
        })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) throw new Error('Failed to save template');

      setShowEditModal(false);
      setEditTemplate(null);
      loadTemplates();
      toast.success('Template saved successfully!');
    } catch (err) {
      console.error('Error saving template:', err);
      toast.error('Failed to save template');
    }
  };

  const handleToggleActive = async (templateId, currentActive) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_ENDPOINTS.NOTIFICATION_TEMPLATES}/${templateId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: !currentActive })
      });

      if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('userRole');
        window.location.href = '/login';
        return;
      }

      if (!response.ok) throw new Error('Failed to toggle template');

      loadTemplates();
      toast.success(`Template ${!currentActive ? 'enabled' : 'disabled'}`);
    } catch (err) {
      console.error('Error toggling template:', err);
      toast.error('Failed to toggle template');
    }
  };

  const handlePreview = (template) => {
    // Simple variable replacement for preview
    let renderedBody = template.body;
    let renderedSubject = template.subject;

    // Replace variables in body
    Object.entries(sampleData).forEach(([category, data]) => {
      if (typeof data === 'object') {
        Object.entries(data).forEach(([key, value]) => {
          const regex = new RegExp(`{${category}\\.${key}}`, 'g');
          renderedBody = renderedBody.replace(regex, value);
          renderedSubject = renderedSubject.replace(regex, value);
        });
      }
    });

    setPreviewData({
      ...template,
      subject: renderedSubject,
      body: renderedBody
    });
    setShowPreview(true);
  };

  const handleTestSend = async (template) => {
    try {
      const token = localStorage.getItem('token');
      const username = localStorage.getItem('username');

      const response = await fetch(API_ENDPOINTS.NOTIFICATION_SEND, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: username,
          trigger: template.trigger,
          channels: [template.channel],
          templateData: sampleData
        })
      });

      if (!response.ok) throw new Error('Failed to send test notification');

      toast.success('Test notification sent! Check your email.');
    } catch (err) {
      console.error('Error sending test:', err);
      toast.error('Failed to send test notification');
    }
  };

  const getFilteredTemplates = () => {
    return templates.filter(t => {
      const matchesCategory = filterCategory === 'all' || t.category === filterCategory;
      const matchesChannel = filterChannel === 'all' || t.channel === filterChannel;
      const matchesSearch = !searchQuery || 
        t.trigger.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.subject.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchesCategory && matchesChannel && matchesSearch;
    });
  };

  const getCategoryIcon = (category) => {
    const icons = {
      match: '💕',
      activity: '👀',
      messages: '💬',
      privacy: '🔐',
      engagement: '📊',
      custom: '⚙️',
      system: '🔧',
      communication: '📧',
      maintenance: '🧹',
      notification: '🔔'
    };
    return icons[category] || '📧';
  };

  const filteredTemplates = getFilteredTemplates();

  return (
    <div className="template-manager">
      <div className="manager-header">
        <div className="header-left">
          <h1>📧 Event Message Template Manager</h1>
          <p>Manage email/SMS templates for notification events and preview messages</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary"
            onClick={loadTemplates}
            disabled={loading}
          >
            🔄 Refresh
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => {
              setEditTemplate({
                trigger: '',
                channel: 'email',
                category: 'custom',
                subject: '',
                body: '',
                active: true
              });
              setShowEditModal(true);
            }}
          >
            ➕ Create Template
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>🔍 Search:</label>
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Category:</label>
          <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="all">All Categories</option>
            <optgroup label="Notification Categories">
              <option value="match">💕 Match</option>
              <option value="activity">👀 Activity</option>
              <option value="messages">💬 Messages</option>
              <option value="privacy">🔐 Privacy</option>
              <option value="engagement">📊 Engagement</option>
              <option value="custom">⚙️ Custom</option>
            </optgroup>
            <optgroup label="Job Categories">
              <option value="system">🔧 System</option>
              <option value="communication">📧 Communication</option>
              <option value="maintenance">🧹 Maintenance</option>
              <option value="notification">🔔 Notification</option>
            </optgroup>
          </select>
        </div>

        <div className="filter-group">
          <label>Channel:</label>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
            <option value="all">All Channels</option>
            <option value="email">📧 Email</option>
            <option value="sms">📱 SMS</option>
            <option value="push">🔔 Push</option>
            <option value="job">⚙️ Job</option>
          </select>
        </div>

        <div className="filter-results">
          {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No templates found</h3>
          <p>Create your first template to get started</p>
        </div>
      ) : (
        <div className="templates-grid">
          {filteredTemplates.map(template => (
            <div key={template._id || template.trigger} className="template-card">
              <div className="template-card-header">
                <div className="template-icon">
                  {getCategoryIcon(template.category)}
                </div>
                <div className="header-content">
                  <h3>{template.trigger.replace(/_/g, ' ').toUpperCase()}</h3>
                  <span className={`status-badge ${template.active ? 'active' : 'inactive'}`}>
                    {template.active ? '🟢 Active' : '🔴 Disabled'}
                  </span>
                </div>
              </div>

              <div className="template-card-body">
                <div className="template-meta">
                  <span className="meta-item">📨 {template.channel}</span>
                  <span className="meta-item">🏷️ {template.category}</span>
                  {template.type === 'job' && template.schedule && (
                    <span className="meta-item">⏰ {template.schedule}</span>
                  )}
                  {template.type && (
                    <span className={`meta-item type-badge type-${template.type}`}>
                      {template.type === 'job' ? '⚙️ Job' : '📧 Notification'}
                    </span>
                  )}
                </div>
                <p className="template-subject">{template.subject}</p>
              </div>

              {/* Schedule Info Display */}
              {template.type !== 'job' && (
                <div className="template-schedule-info">
                  {getScheduleDisplay(template) ? (
                    <button
                      className="schedule-display has-schedule"
                      onClick={() => {
                        setScheduleTemplate(template);
                        setShowScheduleListModal(true);
                      }}
                      title="Click to view and manage schedules"
                    >
                      <div className="schedule-line">
                        <span className="schedule-label">Scheduled to Run:</span>
                        <span className="schedule-value">{getScheduleDisplay(template).type}</span>
                      </div>
                      <div className="schedule-line">
                        <span className="schedule-label">Next Run:</span>
                        <span className="schedule-value">{getScheduleDisplay(template).nextRun}</span>
                      </div>
                    </button>
                  ) : (
                    <div className="schedule-display no-schedule">
                      <button
                        className="add-schedule-link"
                        onClick={() => {
                          setScheduleTemplate(template);
                          setShowScheduleModal(true);
                        }}
                      >
                        <span className="schedule-label">Scheduled to Run:</span>
                        <span className="schedule-link">[details]</span>
                      </button>
                      <div className="schedule-line muted">
                        <span className="schedule-label">Next Run:</span>
                        <span className="schedule-value">[details]</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="template-card-actions">
                {template.type === 'job' ? (
                  <>
                    <button
                      className="btn-icon"
                      title="View Job in Scheduler"
                      onClick={() => window.location.href = '/dynamic-scheduler'}
                    >
                      📋
                    </button>
                    <button
                      className="btn-icon"
                      title="Create Job from Template"
                      onClick={() => {
                        // Store template type (more reliable for job templates)
                        const templateId = template.template_type || template.trigger || template._id;
                        localStorage.setItem('selectedJobTemplate', templateId);
                        window.location.href = '/dynamic-scheduler';
                      }}
                    >
                      ➕
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-icon"
                      title="Edit Template"
                      onClick={() => handleEdit(template)}
                    >
                      ✏️
                    </button>
                    <button
                      className="btn-icon"
                      title="Preview"
                      onClick={() => handlePreview(template)}
                    >
                      👁️
                    </button>
                    <button
                      className="btn-icon"
                      title="Send Test"
                      onClick={() => handleTestSend(template)}
                    >
                      📤
                    </button>
                    <button
                      className={`btn-icon schedule-btn ${
                        scheduledNotifications.filter(s => s.templateId === template._id && s.enabled).length > 0 
                          ? 'has-schedules' 
                          : ''
                      }`}
                      title={getScheduleTooltip(template)}
                      onClick={() => {
                        setScheduleTemplate(template);
                        setShowScheduleModal(true);
                      }}
                    >
                      ⏰
                      {scheduledNotifications.filter(s => s.templateId === template._id && s.enabled).length > 0 && (
                        <span className="schedule-count">
                          {scheduledNotifications.filter(s => s.templateId === template._id && s.enabled).length}
                        </span>
                      )}
                    </button>
                    <button
                      className={`btn-icon ${template.active ? '' : 'success'}`}
                      title={template.active ? 'Disable' : 'Enable'}
                      onClick={() => handleToggleActive(template._id, template.active)}
                    >
                      {template.active ? '⏸️' : '▶️'}
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editTemplate && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editTemplate._id ? '✏️ Edit Template' : '➕ Create Template'}</h2>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Trigger Name *</label>
                  <input
                    type="text"
                    value={editTemplate.trigger}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, trigger: e.target.value }))}
                    placeholder="e.g., new_match"
                    disabled={!!editTemplate._id}
                  />
                </div>

                <div className="form-group">
                  <label>Channel *</label>
                  <select
                    value={editTemplate.channel}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, channel: e.target.value }))}
                  >
                    <option value="email">Email</option>
                    <option value="sms">SMS</option>
                    <option value="push">Push</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Category *</label>
                  <select
                    value={editTemplate.category}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="match">Match</option>
                    <option value="activity">Activity</option>
                    <option value="messages">Messages</option>
                    <option value="privacy">Privacy</option>
                    <option value="engagement">Engagement</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Subject Line *</label>
                <input
                  type="text"
                  value={editTemplate.subject}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="e.g., 🎉 You have a new match, {recipient.firstName}!"
                />
              </div>

              <div className="form-group">
                <label>Email Body (HTML) *</label>
                <textarea
                  value={editTemplate.body}
                  onChange={(e) => setEditTemplate(prev => ({ ...prev, body: e.target.value }))}
                  rows={15}
                  placeholder="Enter HTML template..."
                  style={{ fontFamily: 'monospace' }}
                />
              </div>

              <div className="variable-helper">
                <strong>📝 Available Variables:</strong>
                <div className="variable-list">
                  <code>{'{recipient.firstName}'}</code>
                  <code>{'{recipient.username}'}</code>
                  <code>{'{match.firstName}'}</code>
                  <code>{'{match.age}'}</code>
                  <code>{'{match.matchScore}'}</code>
                  <code>{'{match.location}'}</code>
                  <code>{'{app.profileUrl}'}</code>
                  <code>{'{app.chatUrl}'}</code>
                  <code>{'{stats.unreadMessages}'}</code>
                </div>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editTemplate.active}
                    onChange={(e) => setEditTemplate(prev => ({ ...prev, active: e.target.checked }))}
                  />
                  <span>Enable template</span>
                </label>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                💾 Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👁️ Template Preview</h2>
              <button className="modal-close" onClick={() => setShowPreview(false)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="preview-container">
                <div className="preview-subject">
                  <strong>Subject:</strong> {previewData.subject}
                </div>
                <div className="preview-body" dangerouslySetInnerHTML={{ __html: previewData.body }} />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowPreview(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Notification Modal */}
      {showScheduleModal && scheduleTemplate && (
        <ScheduleNotificationModal
          template={scheduleTemplate}
          onClose={() => {
            setShowScheduleModal(false);
            setScheduleTemplate(null);
          }}
          onSchedule={(result) => {
            toast.success('Notification scheduled successfully!');
            loadTemplates();
            loadScheduledNotifications(); // Reload to update tooltips
          }}
        />
      )}

      {/* Schedule List Modal */}
      {showScheduleListModal && scheduleTemplate && (
        <ScheduleListModal
          template={scheduleTemplate}
          onClose={() => {
            setShowScheduleListModal(false);
            setScheduleTemplate(null);
          }}
          onUpdate={() => {
            loadScheduledNotifications(); // Reload to update tooltips and counts
            loadTemplates();
          }}
        />
      )}

      {/* Toast */}
      {/* Toast notifications handled by ToastContainer in App.js */}
    </div>
  );
};

export default TemplateManager;
