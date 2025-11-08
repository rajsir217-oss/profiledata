import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './EmailTemplatePreview.css';

const EmailTemplatePreview = () => {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Security check - admin only
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      navigate('/');
      return;
    }

    loadCategories();
    loadTemplates();
  }, [navigate]);

  const loadCategories = async () => {
    try {
      const response = await api.get('/email-templates/templates/categories');
      setCategories(response.data.categories || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const loadTemplates = async (category = null) => {
    try {
      setLoading(true);
      setError('');
      
      const params = category && category !== 'all' ? { category } : {};
      const response = await api.get('/email-templates/templates', { params });
      
      setTemplates(response.data.templates || []);
      setLoading(false);
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Failed to load email templates');
      setLoading(false);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    loadTemplates(category);
    setSelectedTemplate(null);
  };

  const handleTemplateClick = (template) => {
    setSelectedTemplate(template);
  };

  const renderSampleData = (body) => {
    // Replace template variables with sample data for preview
    return body
      .replace(/{recipient\.firstName}/g, 'John')
      .replace(/{recipient\.lastName}/g, 'Doe')
      .replace(/{match\.firstName}/g, 'Sarah')
      .replace(/{match\.lastName}/g, 'Smith')
      .replace(/{match\.age}/g, '28')
      .replace(/{match\.location}/g, 'San Francisco, CA')
      .replace(/{match\.profession}/g, 'Software Engineer')
      .replace(/{match\.matchScore}/g, '85')
      .replace(/{contact\.email}/g, 'sarah.smith@example.com')
      .replace(/{contact\.phone}/g, '+1 (555) 123-4567')
      .replace(/{login\.location}/g, 'San Francisco, CA')
      .replace(/{login\.device}/g, 'Chrome on Mac OS')
      .replace(/{login\.timestamp}/g, new Date().toLocaleString())
      .replace(/{login\.ipAddress}/g, '192.168.1.1')
      .replace(/{milestone\.description}/g, '10 Profile Views')
      .replace(/{milestone\.value}/g, '10')
      .replace(/{stats\.searchCount}/g, '50')
      .replace(/{stats\.profileCompleteness}/g, '75%')
      .replace(/{profile\.missingFields}/g, 'Photos, Education')
      .replace(/{matches\.count}/g, '5')
      .replace(/{stats\.viewsIncrease}/g, '50%')
      .replace(/{stats\.period}/g, 'this week')
      .replace(/{app\.profileUrl}/g, '#profile')
      .replace(/{app\.conversationUrl}/g, '#conversation')
      .replace(/{app\.favoriteBackUrl}/g, '#favorite')
      .replace(/{app\.changePasswordUrl}/g, '#change-password')
      .replace(/{app\.securitySettingsUrl}/g, '#security')
      .replace(/{app\.dashboardUrl}/g, '#dashboard')
      .replace(/{app\.actionUrl}/g, '#action')
      .replace(/{app\.unsubscribeUrl}/g, '#unsubscribe')
      .replace(/{app\.preferencesUrl}/g, '#preferences');
  };

  const getCategoryBadgeColor = (category) => {
    const colors = {
      match: '#ec4899',
      activity: '#06b6d4',
      messages: '#3b82f6',
      privacy: '#8b5cf6',
      engagement: '#f59e0b',
      security: '#dc2626',
      milestones: '#8b5cf6',
      onboarding: '#10b981',
      digest: '#6366f1'
    };
    return colors[category] || '#6b7280';
  };

  const getPriorityBadge = (priority) => {
    const badges = {
      critical: { label: 'CRITICAL', color: '#dc2626' },
      high: { label: 'HIGH', color: '#f59e0b' },
      medium: { label: 'MEDIUM', color: '#3b82f6' },
      low: { label: 'LOW', color: '#6b7280' }
    };
    return badges[priority] || badges.low;
  };

  return (
    <div className="email-template-preview-container">
      <div className="template-header">
        <h1>📧 Email Templates</h1>
        <p>Preview and manage all notification email templates</p>
      </div>

      {/* Category Filter */}
      <div className="template-filters">
        <button
          className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => handleCategoryChange('all')}
        >
          All Templates ({templates.length})
        </button>
        {categories.map((category) => (
          <button
            key={category}
            className={`filter-btn ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryChange(category)}
            style={{
              borderColor: selectedCategory === category ? getCategoryBadgeColor(category) : undefined,
              backgroundColor: selectedCategory === category ? getCategoryBadgeColor(category) + '20' : undefined
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="loading-spinner">Loading templates...</div>
      ) : (
        <div className="template-layout">
          {/* Template List */}
          <div className="template-list">
            <h2>Templates ({templates.length})</h2>
            {templates.map((template) => (
              <div
                key={template._id}
                className={`template-card ${selectedTemplate?._id === template._id ? 'selected' : ''}`}
                onClick={() => handleTemplateClick(template)}
              >
                <div className="template-card-header">
                  <h3>{template.trigger}</h3>
                  <span
                    className="category-badge"
                    style={{ backgroundColor: getCategoryBadgeColor(template.category) }}
                  >
                    {template.category}
                  </span>
                </div>
                <p className="template-subject">{template.subject}</p>
                <div className="template-meta">
                  <span
                    className="priority-badge"
                    style={{ color: getPriorityBadge(template.priority).color }}
                  >
                    {getPriorityBadge(template.priority).label}
                  </span>
                  <span className={`status-badge ${template.enabled ? 'enabled' : 'disabled'}`}>
                    {template.enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Template Preview */}
          <div className="template-preview">
            {selectedTemplate ? (
              <>
                <div className="preview-header">
                  <h2>Preview: {selectedTemplate.trigger}</h2>
                  <button className="btn-close" onClick={() => setSelectedTemplate(null)}>
                    ✕
                  </button>
                </div>
                
                <div className="preview-details">
                  <div className="detail-row">
                    <strong>Subject:</strong>
                    <span>{selectedTemplate.subject}</span>
                  </div>
                  <div className="detail-row">
                    <strong>Category:</strong>
                    <span
                      className="category-badge"
                      style={{ backgroundColor: getCategoryBadgeColor(selectedTemplate.category) }}
                    >
                      {selectedTemplate.category}
                    </span>
                  </div>
                  <div className="detail-row">
                    <strong>Priority:</strong>
                    <span style={{ color: getPriorityBadge(selectedTemplate.priority).color, fontWeight: 'bold' }}>
                      {getPriorityBadge(selectedTemplate.priority).label}
                    </span>
                  </div>
                  <div className="detail-row">
                    <strong>Status:</strong>
                    <span className={selectedTemplate.enabled ? 'text-success' : 'text-danger'}>
                      {selectedTemplate.enabled ? '✓ Enabled' : '✗ Disabled'}
                    </span>
                  </div>
                </div>

                <div className="preview-body">
                  <h3>Email Preview (with sample data)</h3>
                  <div className="email-iframe-container">
                    <iframe
                      title={`Preview of ${selectedTemplate.trigger}`}
                      srcDoc={renderSampleData(selectedTemplate.body)}
                      className="email-iframe"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="preview-placeholder">
                <div className="placeholder-icon">📧</div>
                <p>Select a template to preview</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplatePreview;
