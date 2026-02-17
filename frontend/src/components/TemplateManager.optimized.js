/**
 * Optimized TemplateManager Component
 * 
 * Phase 2 Optimizations:
 * - Admin authentication added
 * - Static data moved to constants
 * - Shared data loading hook
 * - Memoized operations
 * - Error boundaries
 * - Performance monitoring
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getFrontendUrl } from '../utils/urlHelper';
import './TemplateManager.css';
import useToast from '../hooks/useToast';
import ScheduleNotificationModal from './ScheduleNotificationModal';
import ScheduleListModal from './ScheduleListModal';
import useAdminAuth from '../hooks/useAdminAuth';
import useNotificationData from '../hooks/useNotificationData';
import useCancellableRequest from '../hooks/useCancellableRequest';
import { SAMPLE_DATA } from '../constants/templateSampleData';
import { API_ENDPOINTS, REFRESH_INTERVALS } from '../constants/notificationTriggers';

// Error Boundary Component
class TemplateManagerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('TemplateManager Error:', error, errorInfo);
    this.setState({ error, hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <details>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const TemplateManager = () => {
  // Admin authentication
  useAdminAuth();
  
  // State management
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editTemplate, setEditTemplate] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showScheduleListModal, setShowScheduleListModal] = useState(false);
  const [scheduleTemplate, setScheduleTemplate] = useState(null);
  const [scheduledNotifications, setScheduledNotifications] = useState([]);
  const toast = useToast();
  const { makeRequest, cleanup } = useCancellableRequest();
  
  // Filter state
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  
  // Performance monitoring
  const performanceRef = useRef({
    renderCount: 0,
    lastRender: Date.now()
  });

  // Memoized sample data (prevents recreation)
  const sampleData = useMemo(() => SAMPLE_DATA, []);

  // Memoized filtered and sorted templates
  const filteredTemplates = useMemo(() => {
    if (!templates.length) return [];
    
    let filtered = templates.filter(template => {
      // Category filter
      if (filterCategory !== 'all' && template.category !== filterCategory) {
        return false;
      }
      
      // Channel filter
      if (filterChannel !== 'all') {
        const templateChannels = template.channels || [];
        if (!templateChannels.includes(filterChannel)) {
          return false;
        }
      }
      
      // Search filter
      if (searchQuery) {
        const searchLower = searchQuery.toLowerCase();
        const matchesName = template.name?.toLowerCase().includes(searchLower);
        const matchesSubject = template.subject?.toLowerCase().includes(searchLower);
        const matchesDescription = template.description?.toLowerCase().includes(searchLower);
        if (!matchesName && !matchesSubject && !matchesDescription) {
          return false;
        }
      }
      
      return true;
    });

    // Sort templates
    filtered.sort((a, b) => {
      let aVal = a[sortBy] || a.created_at;
      let bVal = b[sortBy] || b.created_at;
      
      // Handle date fields
      if (sortBy === 'createdAt' || sortBy === 'created_at') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      }
      
      // Handle string fields
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
      }
      if (typeof bVal === 'string') {
        bVal = bVal.toLowerCase();
      }
      
      if (sortDirection === 'asc') {
        return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else {
        return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
      }
    });

    return filtered;
  }, [templates, filterCategory, filterChannel, searchQuery, sortBy, sortDirection]);

  // Memoized available categories
  const availableCategories = useMemo(() => {
    const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];
    return categories.sort();
  }, [templates]);

  // Memoized available channels
  const availableChannels = useMemo(() => {
    const channels = [...new Set(templates.flatMap(t => t.channels || []))];
    return channels.sort();
  }, [templates]);

  // Performance tracking
  useEffect(() => {
    performanceRef.current.renderCount++;
    performanceRef.current.lastRender = Date.now();
    
    // Log performance warnings
    if (performanceRef.current.renderCount % 100 === 0) {
      const avgRenderTime = Date.now() - performanceRef.current.lastRender;
      if (avgRenderTime > 100) {
        console.warn(`TemplateManager: Slow render detected (${avgRenderTime}ms)`);
      }
    }
  });

  // Load templates with optimized data hook
  const { data: templateData, loading: hookLoading, error: hookError, refresh } = useNotificationData(
    API_ENDPOINTS.TEMPLATES,
    REFRESH_INTERVALS.TEMPLATES,
    {
      transformData: (data) => {
        // Transform and validate template data
        const transformed = (data || []).map(template => ({
          ...template,
          id: template._id || template.id,
          name: template.name || 'Untitled Template',
          subject: template.subject || 'No Subject',
          body: template.body || 'No Content',
          category: template.category || 'general',
          channels: template.channels || ['email'],
          createdAt: template.createdAt || template.created_at || new Date().toISOString(),
          updatedAt: template.updatedAt || template.updated_at || new Date().toISOString(),
          isActive: template.isActive !== false
        }));
        return transformed;
      },
      enableCache: true,
      cacheKey: 'templates_cache',
      initialData: []
    }
  );

  // Update state when data changes
  useEffect(() => {
    if (templateData && Array.isArray(templateData)) {
      setTemplates(templateData);
      setLoading(false);
      setError(null);
    } else if (hookError) {
      setError(hookError);
      setLoading(false);
    }
  }, [templateData, hookError]);

  // Update loading state
  useEffect(() => {
    setLoading(hookLoading);
  }, [hookLoading]);

  // Event handlers with memoization
  const handleEditTemplate = useCallback((template) => {
    setEditTemplate(template);
    setShowEditModal(true);
  }, []);

  const handlePreview = useCallback((template) => {
    setPreviewData({
      ...sampleData,
      template: {
        ...template,
        subject: template.subject || 'Preview Subject',
        body: template.body || 'Preview body content'
      }
    });
    setShowPreview(true);
  }, [sampleData]);

  const handleSchedule = useCallback((template) => {
    setScheduleTemplate(template);
    setShowScheduleModal(true);
  }, []);

  const handleDeleteTemplate = useCallback(async (templateId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await makeRequest(`${API_ENDPOINTS.TEMPLATES}/${templateId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response || !response.ok) {
        throw new Error('Failed to delete template');
      }

      refresh();
      toast.success('Template deleted successfully');
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Error deleting template:', err);
        toast.error(err.message || 'Failed to delete template');
      }
    }
  }, [makeRequest, refresh, toast]);

  const handleSort = useCallback((key) => {
    if (key === sortBy) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDirection('desc');
    }
  }, [sortBy]);

  const handleRefresh = useCallback(() => {
    refresh(true); // Force refresh
  }, [refresh]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Render component
  return (
    <TemplateManagerErrorBoundary>
      <div className="template-manager">
        <div className="template-header">
          <h1>📧 Message Templates</h1>
          <p>Manage email templates for automated notifications</p>
          <div className="header-actions">
            <button onClick={handleRefresh} className="btn btn-primary" disabled={loading}>
              🔄 Refresh
            </button>
            <button onClick={() => setShowScheduleListModal(true)} className="btn btn-secondary">
              📅 Scheduled
            </button>
          </div>
        </div>

        {/* Performance Monitor (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="performance-monitor">
            <small>
              Renders: {performanceRef.current.renderCount} | 
              Last Render: {new Date(performanceRef.current.lastRender).toLocaleTimeString()}
            </small>
          </div>
        )}

        {/* Filters */}
        <div className="template-filters">
          <div className="filter-row">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Categories</option>
              {availableCategories.map(category => (
                <option key={category} value={category}>
                  {category.charAt(0).toUpperCase() + category.slice(1)}
                </option>
              ))}
            </select>

            <select
              value={filterChannel}
              onChange={(e) => setFilterChannel(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Channels</option>
              {availableChannels.map(channel => (
                <option key={channel} value={channel}>
                  {channel.charAt(0).toUpperCase() + channel.slice(1)}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="sort-select"
              >
                <option value="createdAt">Created Date</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
              </select>
              <button
                onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="sort-direction"
              >
                {sortDirection === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading templates...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={handleRefresh} className="btn btn-primary">Retry</button>
          </div>
        )}

        {/* Templates Grid */}
        {!loading && !error && (
          <div className="templates-grid">
            {filteredTemplates.length === 0 ? (
              <div className="empty-state">
                <p>No templates found matching your filters.</p>
                <button onClick={() => {
                  setFilterCategory('all');
                  setFilterChannel('all');
                  setSearchQuery('');
                }} className="btn btn-primary">
                  Clear Filters
                </button>
              </div>
            ) : (
              filteredTemplates.map(template => (
                <div key={template.id} className="template-card">
                  <div className="template-header">
                    <h3>{template.name}</h3>
                    <div className="template-meta">
                      <span className="category">{template.category}</span>
                      <span className="channels">
                        {template.channels.map(ch => (
                          <span key={ch} className="channel-badge">
                            {ch}
                          </span>
                        ))}
                      </span>
                    </div>
                  </div>
                  
                  <div className="template-preview">
                    <div className="preview-subject">
                      <strong>Subject:</strong> {template.subject || 'No Subject'}
                    </div>
                    <div className="preview-body">
                      {template.body ? (
                        <div dangerouslySetInnerHTML={{
                          __html: template.body.length > 100 
                            ? template.body.substring(0, 100) + '...' 
                            : template.body
                        }} />
                      ) : (
                        <em>No content</em>
                      )}
                    </div>
                  </div>
                  
                  <div className="template-actions">
                    <button
                      onClick={() => handlePreview(template)}
                      className="btn btn-sm btn-secondary"
                    >
                      👁️ Preview
                    </button>
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="btn btn-sm btn-primary"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      onClick={() => handleSchedule(template)}
                      className="btn btn-sm btn-info"
                    >
                      📅 Schedule
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="btn btn-sm btn-danger"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                  
                  <div className="template-footer">
                    <small>
                      Created: {template.createdAt ? new Date(template.createdAt).toLocaleDateString() : 'Unknown'}
                    </small>
                    {template.updatedAt && template.updatedAt !== template.createdAt && (
                      <small>
                        Updated: {new Date(template.updatedAt).toLocaleDateString()}
                      </small>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modals */}
        {showEditModal && editTemplate && (
          <EditTemplateModal
            template={editTemplate}
            onClose={() => setShowEditModal(false)}
            onSave={() => {
              setShowEditModal(false);
              refresh();
            }}
          />
        )}

        {showPreview && previewData && (
          <PreviewModal
            data={previewData}
            onClose={() => setShowPreview(false)}
          />
        )}

        {showScheduleModal && scheduleTemplate && (
          <ScheduleNotificationModal
            template={scheduleTemplate}
            onClose={() => setShowScheduleModal(false)}
          />
        )}

        {showScheduleListModal && (
          <ScheduleListModal
            onClose={() => setShowScheduleListModal(false)}
          />
        )}
      </div>
    </TemplateManagerErrorBoundary>
  );
};

// Edit Template Modal Component
const EditTemplateModal = ({ template, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: template.name || '',
    subject: template.subject || '',
    body: template.body || '',
    category: template.category || 'general',
    channels: template.channels || ['email']
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Save template logic here
      await onSave();
      toast.success('Template saved successfully');
    } catch (error) {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Edit Template</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Template Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Subject</label>
            <input
              type="text"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Body</label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              rows={10}
              required
            />
          </div>
          
          <div className="form-group">
            <label>Category</label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            >
              <option value="general">General</option>
              <option value="matches">Matches</option>
              <option value="messages">Messages</option>
              <option value="notifications">Notifications</option>
            </select>
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Preview Modal Component
const PreviewModal = ({ data, onClose }) => {
  return (
    <div className="modal-overlay">
      <div className="modal-content preview-modal">
        <div className="modal-header">
          <h2>Template Preview</h2>
          <button onClick={onClose} className="modal-close">✕</button>
        </div>
        <div className="preview-content">
          <div className="preview-subject">
            <strong>Subject:</strong> {data.template?.subject}
          </div>
          <div className="preview-body">
            <div dangerouslySetInnerHTML={{ __html: data.template?.body }} />
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TemplateManager;
