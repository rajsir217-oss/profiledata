import React, { useState, useEffect } from 'react';
import './TemplateManager.css';
import Toast from './Toast';

const TemplateManager = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editTemplate, setEditTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [toast, setToast] = useState(null);
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
      education: 'MBA'
    },
    event: {
      type: 'new_match',
      timestamp: new Date().toISOString(),
      message: 'You have a new match!'
    },
    app: {
      profileUrl: 'http://localhost:3000/profile/mike_dev',
      chatUrl: 'http://localhost:3000/messages',
      matchUrl: 'http://localhost:3000/matches',
      settingsUrl: 'http://localhost:3000/settings',
      unsubscribeUrl: 'http://localhost:3000/unsubscribe'
    },
    stats: {
      mutualMatches: 12,
      unreadMessages: 5,
      profileViews: 23,
      newMatches: 3
    }
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/notifications/templates', {
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

      if (!response.ok) throw new Error('Failed to load templates');

      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      console.error('Error loading templates:', err);
      setToast({ type: 'error', message: 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleEdit = (template) => {
    setEditTemplate({ ...template });
    setShowEditModal(true);
  };

  const handleSave = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = editTemplate._id
        ? `http://localhost:8000/api/notifications/templates/${editTemplate._id}`
        : 'http://localhost:8000/api/notifications/templates';
      
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
      setToast({ type: 'success', message: 'Template saved successfully!' });
    } catch (err) {
      console.error('Error saving template:', err);
      setToast({ type: 'error', message: 'Failed to save template' });
    }
  };

  const handleToggleActive = async (templateId, currentActive) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/notifications/templates/${templateId}`, {
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
      setToast({ 
        type: 'success', 
        message: `Template ${!currentActive ? 'enabled' : 'disabled'}` 
      });
    } catch (err) {
      console.error('Error toggling template:', err);
      setToast({ type: 'error', message: 'Failed to toggle template' });
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

      const response = await fetch('http://localhost:8000/api/notifications/send', {
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

      setToast({ type: 'success', message: 'Test notification sent! Check your email.' });
    } catch (err) {
      console.error('Error sending test:', err);
      setToast({ type: 'error', message: 'Failed to send test notification' });
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
      custom: '⚙️'
    };
    return icons[category] || '📧';
  };

  const filteredTemplates = getFilteredTemplates();

  return (
    <div className="template-manager">
      <div className="manager-header">
        <div className="header-left">
          <h1>📧 Template Manager</h1>
          <p>Manage notification templates and preview emails</p>
        </div>
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
            <option value="match">Match</option>
            <option value="activity">Activity</option>
            <option value="messages">Messages</option>
            <option value="privacy">Privacy</option>
            <option value="engagement">Engagement</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Channel:</label>
          <select value={filterChannel} onChange={(e) => setFilterChannel(e.target.value)}>
            <option value="all">All Channels</option>
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="push">Push</option>
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
                <div className="template-status">
                  <span className={`status-badge ${template.active ? 'active' : 'inactive'}`}>
                    {template.active ? '🟢 Active' : '🔴 Disabled'}
                  </span>
                </div>
              </div>

              <div className="template-card-body">
                <h3>{template.trigger.replace(/_/g, ' ').toUpperCase()}</h3>
                <div className="template-meta">
                  <span className="meta-item">📨 {template.channel}</span>
                  <span className="meta-item">🏷️ {template.category}</span>
                </div>
                <p className="template-subject">{template.subject}</p>
              </div>

              <div className="template-card-actions">
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
                  className={`btn-icon ${template.active ? '' : 'success'}`}
                  title={template.active ? 'Disable' : 'Enable'}
                  onClick={() => handleToggleActive(template._id, template.active)}
                >
                  {template.active ? '⏸️' : '▶️'}
                </button>
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

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default TemplateManager;
