import React, { useState, useEffect, useCallback } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import useToast from '../hooks/useToast';
import DeleteButton from './DeleteButton';
import logger from '../utils/logger';

const tipsApi = createApiInstance(`${getBackendUrl()}/api`);

const TipsManagement = () => {
  const toast = useToast();
  const [tips, setTips] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [formData, setFormData] = useState({
    category: 'getting-started',
    icon: '💡',
    tipText: '',
    helpContext: '',
    link: '',
    linkText: '',
    priority: 5,
    active: true,
    showInTicker: true,
    showInHelp: true
  });

  const loadTips = useCallback(async () => {
    try {
      setLoading(true);
      const params = categoryFilter ? `?category=${categoryFilter}` : '';
      const response = await tipsApi.get(`/tips/admin/all${params}`);
      setTips(response.data.tips || []);
      if (response.data.categories) {
        setCategories(response.data.categories);
      }
    } catch (error) {
      logger.error('Error loading tips:', error);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => {
    loadTips();
  }, [loadTips]);

  const handleCreate = () => {
    setEditingId(null);
    setFormData({
      category: 'getting-started', icon: '💡', tipText: '', helpContext: '',
      link: '', linkText: '', priority: 5, active: true, showInTicker: true, showInHelp: true
    });
    setShowForm(true);
  };

  const handleEdit = (tip) => {
    setEditingId(tip.id);
    setFormData({
      category: tip.category || 'getting-started',
      icon: tip.icon || '💡',
      tipText: tip.tipText || '',
      helpContext: tip.helpContext || '',
      link: tip.link || '',
      linkText: tip.linkText || '',
      priority: tip.priority || 5,
      active: tip.active !== false,
      showInTicker: tip.showInTicker !== false,
      showInHelp: tip.showInHelp !== false
    });
    setShowForm(true);
  };

  const handleClone = (tip) => {
    setEditingId(null);
    setFormData({
      category: tip.category || 'getting-started',
      icon: tip.icon || '💡',
      tipText: tip.tipText || '',
      helpContext: tip.helpContext || '',
      link: tip.link || '',
      linkText: tip.linkText || '',
      priority: tip.priority || 5,
      active: true,
      showInTicker: tip.showInTicker !== false,
      showInHelp: tip.showInHelp !== false
    });
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.tipText.trim()) {
      toast.error('Tip text is required');
      return;
    }
    try {
      if (editingId) {
        await tipsApi.put(`/tips/admin/${editingId}`, formData);
        toast.success('Tip updated');
      } else {
        await tipsApi.post('/tips/admin/create', formData);
        toast.success('Tip created');
      }
      setShowForm(false);
      loadTips();
    } catch (error) {
      logger.error('Error saving tip:', error);
      toast.error(error.response?.data?.detail || 'Failed to save tip');
    }
  };

  const handleDelete = async (id) => {
    try {
      await tipsApi.delete(`/tips/admin/${id}`);
      toast.success('Tip deleted');
      loadTips();
    } catch (error) {
      logger.error('Error deleting tip:', error);
      toast.error('Failed to delete tip');
    }
  };

  const handleToggleActive = async (tip) => {
    try {
      await tipsApi.put(`/tips/admin/${tip.id}`, { active: !tip.active });
      loadTips();
    } catch (error) {
      logger.error('Error toggling tip:', error);
    }
  };

  const getCategoryLabel = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? `${cat.icon} ${cat.title}` : catId;
  };

  return (
    <div className="tips-management">
      {/* Filter & Create */}
      <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{
            padding: '8px 16px', borderRadius: '8px', border: '2px solid var(--border-color)',
            background: 'var(--card-bg)', color: 'var(--text-color)', fontSize: '0.875rem'
          }}
        >
          <option value="">All Categories</option>
          {categories.map(cat => (
            <option key={cat.id} value={cat.id}>{cat.icon} {cat.title}</option>
          ))}
        </select>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          {tips.length} tips
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={handleCreate} className="btn-create">
          ➕ Add Tip
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingId ? 'Edit Tip' : 'Create Tip'}</h2>
              <button onClick={() => setShowForm(false)} className="btn-close">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="announcement-form">
              <div className="form-group">
                <label>Tip Text *</label>
                <textarea
                  value={formData.tipText}
                  onChange={(e) => setFormData({...formData, tipText: e.target.value})}
                  placeholder="Enter tip text..."
                  rows={3}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '2px solid var(--border-color)', background: 'var(--card-bg)', color: 'var(--text-color)', resize: 'vertical' }}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => {
                      const cat = categories.find(c => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        category: e.target.value,
                        helpContext: cat ? cat.title : formData.helpContext
                      });
                    }}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.icon} {cat.title}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Icon (emoji)</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({...formData, icon: e.target.value})}
                    placeholder="💡"
                    maxLength="4"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Link (optional)</label>
                  <input
                    type="text"
                    value={formData.link}
                    onChange={(e) => setFormData({...formData, link: e.target.value})}
                    placeholder="/search"
                  />
                </div>
                <div className="form-group">
                  <label>Link Text (optional)</label>
                  <input
                    type="text"
                    value={formData.linkText}
                    onChange={(e) => setFormData({...formData, linkText: e.target.value})}
                    placeholder="Try it now"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Priority (1=highest)</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value) || 5})}
                    min="1" max="10"
                  />
                </div>
                <div className="form-group">
                  <label>Help Context</label>
                  <input
                    type="text"
                    value={formData.helpContext}
                    onChange={(e) => setFormData({...formData, helpContext: e.target.value})}
                    placeholder="Section title"
                  />
                </div>
              </div>

              <div className="form-row" style={{ gap: '24px' }}>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.showInTicker}
                      onChange={(e) => setFormData({...formData, showInTicker: e.target.checked})}
                    />
                    Show in Ticker (Tip of the Day)
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.showInHelp}
                      onChange={(e) => setFormData({...formData, showInHelp: e.target.checked})}
                    />
                    Show in Help Page
                  </label>
                </div>
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({...formData, active: e.target.checked})}
                    />
                    Active
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button type="button" onClick={() => setShowForm(false)} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-submit">{editingId ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tips List */}
      <div className="announcements-list">
        {loading ? (
          <p>Loading...</p>
        ) : tips.length === 0 ? (
          <p className="empty-state">No tips yet. Add your first tip!</p>
        ) : (
          tips.map(tip => (
            <div key={tip.id} className={`announcement-item ${tip.active ? 'active' : 'inactive'}`}>
              <div className="item-header">
                <span className="item-icon">{tip.icon || '💡'}</span>
                <div className="item-meta">
                  <span className="badge type-info">{getCategoryLabel(tip.category)}</span>
                  {tip.showInTicker && <span className="badge priority-medium">Ticker</span>}
                  {tip.showInHelp && <span className="badge priority-low">Help</span>}
                  <span className="badge">P{tip.priority}</span>
                </div>
                <div className="item-status">
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={tip.active}
                      onChange={() => handleToggleActive(tip)}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                  <span className="status-label">{tip.active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
              <div className="item-message" style={{ fontStyle: 'normal' }}>
                {tip.tipText}
              </div>
              {tip.link && (
                <div className="item-details">
                  <span>🔗 {tip.linkText || 'Link'}: {tip.link}</span>
                </div>
              )}
              <div className="item-actions">
                <button onClick={() => handleClone(tip)} className="btn-clone">📋 Clone</button>
                <button onClick={() => handleEdit(tip)} className="btn-edit">✏️ Edit</button>
                <DeleteButton onDelete={() => handleDelete(tip.id)} itemName="tip" size="medium" />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TipsManagement;
