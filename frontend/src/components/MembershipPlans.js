import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './MembershipPlans.css';

const MembershipPlans = () => {
  const navigate = useNavigate();
  const [membershipConfig, setMembershipConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedConfig, setEditedConfig] = useState({});
  const [editingPlan, setEditingPlan] = useState(null);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [newPlan, setNewPlan] = useState({
    id: '',
    name: '',
    price: 0,
    duration: 12,
    features: [],
    isActive: true
  });

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to MembershipPlans');
      navigate('/dashboard');
    }
  }, [navigate]);

  useEffect(() => {
    loadMembershipConfig();
  }, []);

  const loadMembershipConfig = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMembershipConfig(data.membership);
        }
      }
    } catch (error) {
      console.error('Error loading membership config:', error);
      toastService.error('Failed to load membership configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedConfig)
      });
      const data = await response.json();
      if (data.success) {
        setMembershipConfig(data.membership);
        setEditedConfig({});
        setEditMode(false);
        toastService.success('Settings updated successfully!');
      } else {
        toastService.error(data.detail || 'Failed to update settings');
      }
    } catch (error) {
      toastService.error('Error updating settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePlan = async (planId, updates) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership/plans/${planId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      if (data.success) {
        loadMembershipConfig();
        setEditingPlan(null);
        toastService.success('Plan updated!');
      } else {
        toastService.error(data.detail || 'Failed to update plan');
      }
    } catch (error) {
      toastService.error('Error updating plan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlan = async () => {
    if (!newPlan.id || !newPlan.name || newPlan.price < 0) {
      toastService.error('Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership/plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newPlan)
      });
      const data = await response.json();
      if (data.success) {
        loadMembershipConfig();
        setShowAddPlan(false);
        setNewPlan({ id: '', name: '', price: 0, duration: 12, features: [], isActive: true });
        toastService.success('Plan added!');
      } else {
        toastService.error(data.detail || 'Failed to add plan');
      }
    } catch (error) {
      toastService.error('Error adding plan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/site-settings/membership/plans/${planId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) {
        loadMembershipConfig();
        toastService.success('Plan deleted!');
      } else {
        toastService.error(data.detail || 'Failed to delete plan');
      }
    } catch (error) {
      toastService.error('Error deleting plan: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="membership-plans">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading membership plans...</p>
        </div>
      </div>
    );
  }

  const plans = membershipConfig?.plans || [];
  const sortedPlans = [...plans].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

  return (
    <div className="membership-plans">
      {/* Header Section */}
      <div className="mp-header">
        <div className="mp-header-content">
          <h1>💳 Membership Plans</h1>
          <p className="subtitle">Configure pricing, plans, and trial periods</p>
        </div>
        <button className="btn-add-plan" onClick={() => setShowAddPlan(true)}>
          ➕ Add Plan
        </button>
      </div>

      {/* Base Settings Card */}
      <div className="settings-card">
        <div className="settings-card-header">
          <h3>⚙️ Base Settings</h3>
          {!editMode ? (
            <button className="btn-edit" onClick={() => {
              setEditMode(true);
              setEditedConfig({
                baseFee: membershipConfig?.baseFee || 99,
                trialDays: membershipConfig?.trialDays || 0,
                gracePeriodDays: membershipConfig?.gracePeriodDays || 7
              });
            }}>
              ✏️ Edit
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-save" onClick={handleSaveConfig} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save'}
              </button>
              <button className="btn-cancel" onClick={() => { setEditMode(false); setEditedConfig({}); }}>
                Cancel
              </button>
            </div>
          )}
        </div>
        <div className="settings-grid">
          <div className="setting-item">
            <label>Base Membership Fee</label>
            {editMode ? (
              <div className="input-with-prefix">
                <span className="prefix">$</span>
                <input
                  type="number"
                  value={editedConfig.baseFee ?? membershipConfig?.baseFee}
                  onChange={(e) => setEditedConfig(prev => ({ ...prev, baseFee: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.01"
                />
              </div>
            ) : (
              <span className="setting-value">${membershipConfig?.baseFee?.toFixed(2)}</span>
            )}
          </div>
          <div className="setting-item">
            <label>Currency</label>
            <span className="setting-value">{membershipConfig?.currency || 'USD'}</span>
          </div>
          <div className="setting-item">
            <label>Trial Period</label>
            {editMode ? (
              <div className="input-with-suffix">
                <input
                  type="number"
                  value={editedConfig.trialDays ?? membershipConfig?.trialDays}
                  onChange={(e) => setEditedConfig(prev => ({ ...prev, trialDays: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
                <span className="suffix">days</span>
              </div>
            ) : (
              <span className="setting-value">{membershipConfig?.trialDays || 0} days</span>
            )}
          </div>
          <div className="setting-item">
            <label>Grace Period</label>
            {editMode ? (
              <div className="input-with-suffix">
                <input
                  type="number"
                  value={editedConfig.gracePeriodDays ?? membershipConfig?.gracePeriodDays}
                  onChange={(e) => setEditedConfig(prev => ({ ...prev, gracePeriodDays: parseInt(e.target.value) || 0 }))}
                  min="0"
                />
                <span className="suffix">days</span>
              </div>
            ) : (
              <span className="setting-value">{membershipConfig?.gracePeriodDays || 7} days</span>
            )}
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="plans-section">
        <h3>📋 Available Plans</h3>
        <div className="plans-grid">
          {sortedPlans.map(plan => (
            <div key={plan.id} className={`plan-card ${!plan.isActive ? 'inactive' : ''}`}>
              <div className="plan-header">
                <span className="plan-name">{plan.name}</span>
                {plan.id === membershipConfig?.defaultPlanId && (
                  <span className="default-badge">Default</span>
                )}
                {!plan.isActive && (
                  <span className="inactive-badge">Inactive</span>
                )}
              </div>
              <div className="plan-price">
                <span className="price-amount">${plan.price?.toFixed(2)}</span>
                <span className="price-duration">
                  {plan.duration ? `/ ${plan.duration} months` : '/ lifetime'}
                </span>
              </div>
              <div className="plan-features">
                {(plan.features || []).map((feature, idx) => (
                  <div key={idx} className="feature-item">
                    <span className="feature-check">✓</span>
                    <span>{feature}</span>
                  </div>
                ))}
                {(!plan.features || plan.features.length === 0) && (
                  <div className="no-features">No features defined</div>
                )}
              </div>
              <div className="plan-actions">
                <button className="btn-edit-plan" onClick={() => setEditingPlan({...plan})}>
                  ✏️ Edit
                </button>
                <button 
                  className="btn-delete-plan" 
                  onClick={() => {
                    if (window.confirm(`Delete "${plan.name}" plan?`)) {
                      handleDeletePlan(plan.id);
                    }
                  }}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Promo Code Integration Info */}
      <div className="promo-info-card">
        <h4>🎫 Promo Code Integration</h4>
        <p>Promo codes can apply discounts to these membership plans:</p>
        <ul>
          <li><strong>Percentage discount:</strong> e.g., 20% off → $99 becomes $79.20</li>
          <li><strong>Fixed discount:</strong> e.g., $25 off → $99 becomes $74</li>
        </ul>
        <p className="info-note">
          Configure promo codes in the <strong>Promo Code Manager</strong> page.
        </p>
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="modal-overlay" onClick={() => setEditingPlan(null)}>
          <div className="edit-plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Plan: {editingPlan.name}</h3>
              <button className="modal-close" onClick={() => setEditingPlan(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Plan Name</label>
                <input
                  type="text"
                  value={editingPlan.name}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  value={editingPlan.price}
                  onChange={(e) => setEditingPlan(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Duration (months, leave empty for lifetime)</label>
                <input
                  type="number"
                  value={editingPlan.duration || ''}
                  onChange={(e) => setEditingPlan(prev => ({ 
                    ...prev, 
                    duration: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  min="1"
                  placeholder="Leave empty for lifetime"
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={editingPlan.isActive}
                    onChange={(e) => setEditingPlan(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active (available for purchase)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setEditingPlan(null)}>Cancel</button>
              <button 
                className="btn-save"
                onClick={() => handleUpdatePlan(editingPlan.id, {
                  name: editingPlan.name,
                  price: editingPlan.price,
                  duration: editingPlan.duration,
                  isActive: editingPlan.isActive
                })}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Plan Modal */}
      {showAddPlan && (
        <div className="modal-overlay" onClick={() => setShowAddPlan(false)}>
          <div className="edit-plan-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>➕ Add New Plan</h3>
              <button className="modal-close" onClick={() => setShowAddPlan(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Plan ID (unique, lowercase)</label>
                <input
                  type="text"
                  value={newPlan.id}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, id: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                  placeholder="e.g., gold, enterprise"
                />
              </div>
              <div className="form-group">
                <label>Plan Name</label>
                <input
                  type="text"
                  value={newPlan.name}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Gold, Enterprise"
                />
              </div>
              <div className="form-group">
                <label>Price ($)</label>
                <input
                  type="number"
                  value={newPlan.price}
                  onChange={(e) => setNewPlan(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="form-group">
                <label>Duration (months, leave empty for lifetime)</label>
                <input
                  type="number"
                  value={newPlan.duration || ''}
                  onChange={(e) => setNewPlan(prev => ({ 
                    ...prev, 
                    duration: e.target.value ? parseInt(e.target.value) : null 
                  }))}
                  min="1"
                  placeholder="Leave empty for lifetime"
                />
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={newPlan.isActive}
                    onChange={(e) => setNewPlan(prev => ({ ...prev, isActive: e.target.checked }))}
                  />
                  Active (available for purchase)
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-cancel" onClick={() => setShowAddPlan(false)}>Cancel</button>
              <button className="btn-save" onClick={handleAddPlan} disabled={saving}>
                {saving ? 'Adding...' : 'Add Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MembershipPlans;
