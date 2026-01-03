import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';
import logger from '../utils/logger';
import './AnnouncementManagement.css';
import './TickerSettings.css';

// Create axios instance for announcements API
const announcementsApi = axios.create({
  baseURL: `${getBackendUrl()}/api`
});

// Add auth token interceptor
announcementsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * AnnouncementManagement Component
 * Admin interface for creating and managing announcements
 */
const AnnouncementManagement = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tickerSettings, setTickerSettings] = useState({
    profileViewsHours: 24,
    profileViewsLimit: 5,
    favoritesHours: 24,
    favoritesLimit: 5,
    shortlistsHours: 24,
    shortlistsLimit: 5,
    messagesLimit: 3,
    piiRequestsLimit: 5,
    expiringAccessDays: 3,
    expiringAccessLimit: 3,
    totalItemsLimit: 15,
    enableProfileViews: true,
    enableFavorites: true,
    enableShortlists: true,
    enableMessages: true,
    enablePiiRequests: true,
    enableExpiringAccess: true,
    enableTips: true
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [formData, setFormData] = useState({
    message: '',
    type: 'info',
    priority: 'medium',
    targetAudience: 'all',
    link: '',
    linkText: '',
    dismissible: true,
    icon: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    // Check admin or moderator access
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/dashboard');
      return;
    }

    loadAnnouncements();
    loadStats();
    loadTickerSettings();
  }, [navigate]);

  // ESC key to close modal
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && showForm) {
        setShowForm(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showForm]);

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await announcementsApi.get('/announcements/admin/all');
      setAnnouncements(response.data);
    } catch (error) {
      logger.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await announcementsApi.get('/announcements/admin/stats');
      setStats(response.data);
    } catch (error) {
      logger.error('Error loading stats:', error);
    }
  };

  const loadTickerSettings = async () => {
    try {
      const response = await announcementsApi.get('/ticker/settings');
      if (response.data) {
        setTickerSettings(response.data);
      }
    } catch (error) {
      logger.error('Error loading ticker settings:', error);
    }
  };

  const handleSaveTickerSettings = async () => {
    try {
      setSavingSettings(true);
      await announcementsApi.post('/ticker/settings', tickerSettings);
      toast.success('Ticker settings saved successfully!');
    } catch (error) {
      logger.error('Error saving ticker settings:', error);
      toast.error('Failed to save ticker settings');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleTickerSettingChange = (field, value) => {
    setTickerSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      message: '',
      type: 'info',
      priority: 'medium',
      targetAudience: 'all',
      link: '',
      linkText: '',
      dismissible: true,
      icon: '',
      startDate: '',
      endDate: ''
    });
    setShowForm(true);
  };

  const handleEdit = (announcement) => {
    setEditingId(announcement.id);
    setFormData({
      message: announcement.message,
      type: announcement.type,
      priority: announcement.priority,
      targetAudience: announcement.targetAudience,
      link: announcement.link || '',
      linkText: announcement.linkText || '',
      dismissible: announcement.dismissible,
      icon: announcement.icon || '',
      startDate: announcement.startDate ? announcement.startDate.split('T')[0] : '',
      endDate: announcement.endDate ? announcement.endDate.split('T')[0] : ''
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.message || formData.message.trim() === '') {
      toast.error('Message is required');
      return;
    }

    try {
      // Convert date strings to ISO datetime format
      const convertToISO = (dateString) => {
        if (!dateString) return null;
        // Date input gives "YYYY-MM-DD", convert to "YYYY-MM-DDTHH:MM:SS"
        return `${dateString}T00:00:00`;
      };

      // Clean up payload - remove empty strings for optional fields
      const payload = {
        message: formData.message,
        type: formData.type,
        priority: formData.priority,
        targetAudience: formData.targetAudience,
        dismissible: formData.dismissible,
        startDate: convertToISO(formData.startDate),
        endDate: convertToISO(formData.endDate)
      };

      // Only include optional fields if they have values
      if (formData.link) payload.link = formData.link;
      if (formData.linkText) payload.linkText = formData.linkText;
      if (formData.icon) payload.icon = formData.icon;

      logger.debug('📤 Sending announcement payload:', payload);

      if (editingId) {
        // Update
        await announcementsApi.put(`/announcements/admin/${editingId}`, payload);
      } else {
        // Create
        await announcementsApi.post('/announcements/admin/create', payload);
      }

      setShowForm(false);
      loadAnnouncements();
      loadStats();
      toast.success(editingId ? 'Announcement updated successfully' : 'Announcement created successfully');
    } catch (error) {
      logger.error('Error saving announcement:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to save announcement';
      toast.error(errorMessage);
    }
  };

  const handleDelete = async (id) => {
    try {
      await announcementsApi.delete(`/announcements/admin/${id}`);
      loadAnnouncements();
      loadStats();
      toast.success('Announcement deleted successfully');
    } catch (error) {
      logger.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    }
  };

  const handleToggleActive = async (id, currentActive) => {
    try {
      await announcementsApi.put(`/announcements/admin/${id}`, {
        active: !currentActive
      });
      loadAnnouncements();
      loadStats();
    } catch (error) {
      logger.error('Error toggling active status:', error);
    }
  };

  const getTypeEmoji = (type) => {
    const emojiMap = {
      info: 'ℹ️',
      success: '✅',
      warning: '⚠️',
      error: '❌',
      maintenance: '🔧',
      promotion: '🎉'
    };
    return emojiMap[type] || 'ℹ️';
  };

  const getPriorityBadge = (priority) => {
    const badgeMap = {
      low: { label: 'Low', class: 'priority-low' },
      medium: { label: 'Medium', class: 'priority-medium' },
      high: { label: 'High', class: 'priority-high' },
      urgent: { label: 'Urgent', class: 'priority-urgent' }
    };
    return badgeMap[priority] || badgeMap.medium;
  };

  return (
    <div className="announcement-management">
      {/* Header */}
      <div className="management-header">
        <h1>📢 Announcement Management</h1>
        <p>Create and manage site-wide announcements and ticker settings</p>
      </div>

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button 
          className={`tab-button ${activeTab === 'announcements' ? 'active' : ''}`}
          onClick={() => setActiveTab('announcements')}
        >
          📢 Announcements
        </button>
        <button 
          className={`tab-button ${activeTab === 'ticker' ? 'active' : ''}`}
          onClick={() => setActiveTab('ticker')}
        >
          ⚙️ Ticker Settings
        </button>
      </div>

      {/* Announcements Tab */}
      {activeTab === 'announcements' && (
        <>
          {/* Stats */}
          {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalAnnouncements}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card active">
            <div className="stat-value">{stats.activeAnnouncements}</div>
            <div className="stat-label">Active</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.scheduledAnnouncements}</div>
            <div className="stat-label">Scheduled</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalViews}</div>
            <div className="stat-label">Total Views</div>
          </div>
        </div>
      )}

      {/* Create Button */}
      <div className="actions-bar">
        <button onClick={handleCreate} className="btn-create">
          ➕ Create Announcement
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Announcement' : 'Create Announcement'}</h2>
              <button onClick={() => setShowForm(false)} className="btn-close">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="announcement-form">
              {/* Message */}
              <div className="form-group">
                <label>Message *</label>
                <textarea
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  placeholder="Enter announcement message..."
                  required
                  maxLength="500"
                  rows="3"
                />
                <small>{formData.message.length}/500 characters</small>
              </div>

              {/* Type & Priority */}
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                  >
                    <option value="info">ℹ️ Info</option>
                    <option value="success">✅ Success</option>
                    <option value="warning">⚠️ Warning</option>
                    <option value="error">❌ Error</option>
                    <option value="maintenance">🔧 Maintenance</option>
                    <option value="promotion">🎉 Promotion</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Target Audience */}
              <div className="form-group">
                <label>Target Audience</label>
                <select
                  value={formData.targetAudience}
                  onChange={(e) => setFormData({...formData, targetAudience: e.target.value})}
                >
                  <option value="all">👥 All Users</option>
                  <option value="authenticated">🔐 Authenticated</option>
                  <option value="admins">👑 Admins Only</option>
                  <option value="premium">⭐ Premium Users</option>
                  <option value="free">👤 Free Users</option>
                </select>
              </div>

              {/* Link */}
              <div className="form-row">
                <div className="form-group">
                  <label>Link (optional)</label>
                  <input
                    type="text"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="/preferences"
                  />
                </div>

                <div className="form-group">
                  <label>Link Text (optional)</label>
                  <input
                    type="text"
                    value={formData.linkText}
                    onChange={(e) => setFormData({...formData, linkText: e.target.value})}
                    placeholder="Learn more"
                  />
                </div>
              </div>

              {/* Icon */}
              <div className="form-group">
                <label>Custom Icon (emoji, optional)</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({...formData, icon: e.target.value})}
                  placeholder="🎉"
                  maxLength="2"
                />
              </div>

              {/* Dates */}
              <div className="form-row">
                <div className="form-group">
                  <label>Start Date (optional)</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => setFormData({...formData, startDate: e.target.value})}
                  />
                  <small>Leave empty to start immediately</small>
                </div>

                <div className="form-group">
                  <label>End Date (optional)</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => setFormData({...formData, endDate: e.target.value})}
                  />
                  <small>Leave empty for no expiry</small>
                </div>
              </div>

              {/* Dismissible */}
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.dismissible}
                    onChange={(e) => setFormData({...formData, dismissible: e.target.checked})}
                  />
                  Allow users to dismiss this announcement
                </label>
              </div>

              {/* Submit */}
              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn-cancel">
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  {editingId ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Announcements List */}
      <div className="announcements-list">
        {loading ? (
          <p>Loading...</p>
        ) : announcements.length === 0 ? (
          <p className="empty-state">No announcements yet. Create your first one!</p>
        ) : (
          announcements.map(announcement => (
            <div key={announcement.id} className={`announcement-item ${announcement.active ? 'active' : 'inactive'}`}>
              <div className="item-header">
                <span className="item-icon">{announcement.icon || getTypeEmoji(announcement.type)}</span>
                <div className="item-meta">
                  <span className={`badge type-${announcement.type}`}>{announcement.type}</span>
                  <span className={`badge ${getPriorityBadge(announcement.priority).class}`}>
                    {getPriorityBadge(announcement.priority).label}
                  </span>
                  <span className="badge">{announcement.targetAudience}</span>
                </div>
                <div className="item-status">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={announcement.active}
                      onChange={() => handleToggleActive(announcement.id, announcement.active)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="status-label">{announcement.active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>

              <div className="item-message">{announcement.message}</div>

              {(announcement.link || announcement.startDate || announcement.endDate) && (
                <div className="item-details">
                  {announcement.link && (
                    <span>🔗 {announcement.linkText || 'Link'}: {announcement.link}</span>
                  )}
                  {announcement.startDate && (
                    <span>📅 Start: {new Date(announcement.startDate).toLocaleDateString()}</span>
                  )}
                  {announcement.endDate && (
                    <span>⏰ End: {new Date(announcement.endDate).toLocaleDateString()}</span>
                  )}
                </div>
              )}

              <div className="item-stats">
                <span>👁️ {announcement.viewCount} views</span>
                <span>✕ {announcement.dismissCount} dismissed</span>
                <span className="item-creator">Created by {announcement.createdBy}</span>
              </div>

              <div className="item-actions">
                <button onClick={() => handleEdit(announcement)} className="btn-edit">
                  ✏️ Edit
                </button>
                <DeleteButton
                  onDelete={() => handleDelete(announcement.id)}
                  itemName="announcement"
                  size="medium"
                />
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}

      {/* Ticker Settings Tab */}
      {activeTab === 'ticker' && (
        <div className="ticker-settings-panel">
          <div className="settings-header">
            <h2>🎛️ Ticker Configuration</h2>
            <p>Configure what appears in the scrolling info ticker and how often</p>
          </div>

          <div className="settings-grid">
            {/* Profile Views */}
            <div className="setting-section">
              <div className="section-header">
                <h3>👁️ Profile Views</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableProfileViews}
                    onChange={(e) => handleTickerSettingChange('enableProfileViews', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enableProfileViews && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Time Window (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={tickerSettings.profileViewsHours}
                      onChange={(e) => handleTickerSettingChange('profileViewsHours', parseInt(e.target.value))}
                    />
                    <small>Show profile views from the last X hours</small>
                  </div>
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tickerSettings.profileViewsLimit}
                      onChange={(e) => handleTickerSettingChange('profileViewsLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum profile views to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* Favorites */}
            <div className="setting-section">
              <div className="section-header">
                <h3>⭐ Favorites</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableFavorites}
                    onChange={(e) => handleTickerSettingChange('enableFavorites', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enableFavorites && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Time Window (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={tickerSettings.favoritesHours}
                      onChange={(e) => handleTickerSettingChange('favoritesHours', parseInt(e.target.value))}
                    />
                    <small>Show favorites from the last X hours</small>
                  </div>
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tickerSettings.favoritesLimit}
                      onChange={(e) => handleTickerSettingChange('favoritesLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum favorites to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* Shortlists */}
            <div className="setting-section">
              <div className="section-header">
                <h3>📋 Shortlists</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableShortlists}
                    onChange={(e) => handleTickerSettingChange('enableShortlists', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enableShortlists && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Time Window (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={tickerSettings.shortlistsHours}
                      onChange={(e) => handleTickerSettingChange('shortlistsHours', parseInt(e.target.value))}
                    />
                    <small>Show shortlists from the last X hours</small>
                  </div>
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tickerSettings.shortlistsLimit}
                      onChange={(e) => handleTickerSettingChange('shortlistsLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum shortlists to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* Messages */}
            <div className="setting-section">
              <div className="section-header">
                <h3>💬 Messages</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableMessages}
                    onChange={(e) => handleTickerSettingChange('enableMessages', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enableMessages && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tickerSettings.messagesLimit}
                      onChange={(e) => handleTickerSettingChange('messagesLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum unread messages to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* PII Requests */}
            <div className="setting-section">
              <div className="section-header">
                <h3>📸 PII Requests</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enablePiiRequests}
                    onChange={(e) => handleTickerSettingChange('enablePiiRequests', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enablePiiRequests && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tickerSettings.piiRequestsLimit}
                      onChange={(e) => handleTickerSettingChange('piiRequestsLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum pending PII requests to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* Expiring Access */}
            <div className="setting-section">
              <div className="section-header">
                <h3>⏰ Expiring Access</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableExpiringAccess}
                    onChange={(e) => handleTickerSettingChange('enableExpiringAccess', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              {tickerSettings.enableExpiringAccess && (
                <div className="setting-inputs">
                  <div className="input-group">
                    <label>Warning Days</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={tickerSettings.expiringAccessDays}
                      onChange={(e) => handleTickerSettingChange('expiringAccessDays', parseInt(e.target.value))}
                    />
                    <small>Show access expiring within X days</small>
                  </div>
                  <div className="input-group">
                    <label>Max Items</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tickerSettings.expiringAccessLimit}
                      onChange={(e) => handleTickerSettingChange('expiringAccessLimit', parseInt(e.target.value))}
                    />
                    <small>Maximum expiring access items to show</small>
                  </div>
                </div>
              )}
            </div>

            {/* Tips */}
            <div className="setting-section">
              <div className="section-header">
                <h3>💡 Tips</h3>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={tickerSettings.enableTips}
                    onChange={(e) => handleTickerSettingChange('enableTips', e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              <p className="section-description">Show profile completion tips and suggestions</p>
            </div>

            {/* Global Settings */}
            <div className="setting-section global-settings">
              <div className="section-header">
                <h3>🎯 Global Settings</h3>
              </div>
              <div className="setting-inputs">
                <div className="input-group">
                  <label>Total Items Limit</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={tickerSettings.totalItemsLimit}
                    onChange={(e) => handleTickerSettingChange('totalItemsLimit', parseInt(e.target.value))}
                  />
                  <small>Maximum total items to show in ticker (across all types)</small>
                </div>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="settings-actions">
            <button 
              onClick={handleSaveTickerSettings} 
              className="btn-save-settings"
              disabled={savingSettings}
            >
              {savingSettings ? '💾 Saving...' : '💾 Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AnnouncementManagement;
