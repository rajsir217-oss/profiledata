import React, { useState, useEffect } from 'react';
import './MetaFieldsModal.css';

const MetaFieldsModal = ({ username, onClose, onUpdate }) => {
  const [metaFields, setMetaFields] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('verification'); // verification, premium, quality, visibility

  useEffect(() => {
    loadMetaFields();
  }, [username]);

  // Auto-dismiss toast notifications
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const loadMetaFields = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/meta/${username}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) throw new Error('Failed to load meta fields');
      
      const data = await response.json();
      setMetaFields(data.metaFields);
    } catch (err) {
      setToast({ message: 'Failed to load meta fields', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const updateVerification = async (type, verified) => {
    // Optimistic update - update UI immediately
    const updateKey = `${type}Verified`;
    const updatedFields = { ...metaFields, [updateKey]: verified };
    if (verified) {
      updatedFields[`${updateKey}At`] = new Date().toISOString();
    }
    setMetaFields(updatedFields);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/meta/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          verificationType: type,
          verified
        })
      });

      if (!response.ok) throw new Error('Failed to update verification');
      
      setToast({ message: `${type} verification updated`, type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update verification', type: 'error' });
      // Revert on error
      loadMetaFields();
    }
  };

  const updatePremium = async (isPremium, status) => {
    // Optimistic update
    setMetaFields({ ...metaFields, isPremium, premiumStatus: status });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/meta/premium', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          isPremium,
          premiumStatus: status
        })
      });

      if (!response.ok) throw new Error('Failed to update premium status');
      
      setToast({ message: 'Premium status updated', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update premium status', type: 'error' });
      loadMetaFields();
    }
  };

  const updateVisibility = async (visible) => {
    // Optimistic update
    setMetaFields({ ...metaFields, metaFieldsVisibleToPublic: visible });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/meta/visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          metaFieldsVisibleToPublic: visible
        })
      });

      if (!response.ok) throw new Error('Failed to update visibility');
      
      setToast({ message: 'Visibility settings updated', type: 'success' });
    } catch (err) {
      setToast({ message: 'Failed to update visibility', type: 'error' });
      loadMetaFields();
    }
  };

  const updateField = async (field, value) => {
    // Optimistic update
    setMetaFields({ ...metaFields, [field]: value });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/meta/field', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username,
          field,
          value
        })
      });

      if (!response.ok) throw new Error(`Failed to update ${field}`);
      
      setToast({ message: `${field} updated`, type: 'success' });
    } catch (err) {
      setToast({ message: `Failed to update ${field}`, type: 'error' });
      loadMetaFields();
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="meta-fields-modal">
          <div className="modal-header">
            <h2>Loading...</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="loading-spinner">Loading meta fields...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="meta-fields-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎖️ Meta Fields Manager</h2>
          <span className="username-badge">{username}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="modal-tabs">
          <button 
            className={activeTab === 'verification' ? 'active' : ''}
            onClick={() => setActiveTab('verification')}
          >
            ✓ Verification
          </button>
          <button 
            className={activeTab === 'premium' ? 'active' : ''}
            onClick={() => setActiveTab('premium')}
          >
            💎 Premium
          </button>
          <button 
            className={activeTab === 'quality' ? 'active' : ''}
            onClick={() => setActiveTab('quality')}
          >
            📊 Quality & Stats
          </button>
          <button 
            className={activeTab === 'visibility' ? 'active' : ''}
            onClick={() => setActiveTab('visibility')}
          >
            👁️ Visibility
          </button>
        </div>

        <div className="modal-content">
          {/* PHASE 1: Verification Tab */}
          {activeTab === 'verification' && (
            <div className="tab-section">
              <h3>Phase 1: Essential Verifications</h3>
              
              <div className="verification-grid">
                <div className="verification-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.idVerified}
                      onChange={(e) => updateVerification('id', e.target.checked)}
                    />
                    <span className="verification-label">✓ ID Verified</span>
                  </label>
                  {metaFields?.idVerifiedAt && (
                    <small>By: {metaFields.idVerifiedBy} on {new Date(metaFields.idVerifiedAt).toLocaleDateString()}</small>
                  )}
                </div>

                <div className="verification-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.emailVerified}
                      onChange={(e) => updateVerification('email', e.target.checked)}
                    />
                    <span className="verification-label">📧 Email Verified</span>
                  </label>
                </div>

                <div className="verification-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.phoneVerified}
                      onChange={(e) => updateVerification('phone', e.target.checked)}
                    />
                    <span className="verification-label">📱 Phone Verified</span>
                  </label>
                </div>
              </div>

              <h3>Phase 2: Professional Verifications</h3>
              
              <div className="verification-grid">
                <div className="verification-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.employmentVerified}
                      onChange={(e) => updateVerification('employment', e.target.checked)}
                    />
                    <span className="verification-label">💼 Employment Verified</span>
                  </label>
                </div>

                <div className="verification-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.educationVerified}
                      onChange={(e) => updateVerification('education', e.target.checked)}
                    />
                    <span className="verification-label">🎓 Education Verified</span>
                  </label>
                </div>

                <div className="field-group">
                  <label>Background Check Status:</label>
                  <select 
                    value={metaFields?.backgroundCheckStatus || 'none'}
                    onChange={(e) => updateField('backgroundCheckStatus', e.target.value)}
                  >
                    <option value="none">None</option>
                    <option value="pending">Pending</option>
                    <option value="passed">Passed</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Premium Tab */}
          {activeTab === 'premium' && (
            <div className="tab-section">
              <h3>Premium Status</h3>
              
              <div className="premium-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={metaFields?.isPremium}
                    onChange={(e) => updatePremium(e.target.checked, metaFields?.premiumStatus || 'free')}
                  />
                  <span className="premium-label">💎 Premium Member</span>
                </label>

                <div className="field-group">
                  <label>Premium Tier:</label>
                  <select 
                    value={metaFields?.premiumStatus || 'free'}
                    onChange={(e) => updatePremium(metaFields?.isPremium, e.target.value)}
                  >
                    <option value="free">Free</option>
                    <option value="premium">Premium</option>
                    <option value="elite">Elite</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>

                <div className="field-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.isFeatured}
                      onChange={(e) => updateField('isFeatured', e.target.checked)}
                    />
                    <span>⭐ Featured Profile</span>
                  </label>
                </div>

                <div className="field-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={metaFields?.isStaffPick}
                      onChange={(e) => updateField('isStaffPick', e.target.checked)}
                    />
                    <span>🎖️ Staff Pick</span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Quality & Stats Tab */}
          {activeTab === 'quality' && (
            <div className="tab-section">
              <h3>Quality Scores</h3>
              
              <div className="scores-grid">
                <div className="score-item">
                  <label>Trust Score (0-100):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={metaFields?.trustScore || 50}
                    onChange={(e) => updateField('trustScore', parseInt(e.target.value))}
                  />
                  <div className="score-bar">
                    <div className="score-fill" style={{width: `${metaFields?.trustScore || 50}%`}}></div>
                  </div>
                </div>

                <div className="score-item">
                  <label>Profile Completeness (0-100):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={metaFields?.profileCompleteness || 0}
                    onChange={(e) => updateField('profileCompleteness', parseInt(e.target.value))}
                  />
                  <div className="score-bar">
                    <div className="score-fill" style={{width: `${metaFields?.profileCompleteness || 0}%`}}></div>
                  </div>
                </div>

                <div className="score-item">
                  <label>Profile Quality Score (0-100):</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={metaFields?.profileQualityScore || 0}
                    onChange={(e) => updateField('profileQualityScore', parseInt(e.target.value))}
                  />
                  <div className="score-bar">
                    <div className="score-fill" style={{width: `${metaFields?.profileQualityScore || 0}%`}}></div>
                  </div>
                </div>
              </div>

              <h3>Engagement Stats (Read-only)</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <span className="stat-label">Profile Views:</span>
                  <span className="stat-value">{metaFields?.profileViews || 0}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Response Rate:</span>
                  <span className="stat-value">{metaFields?.responseRate || 0}%</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Achievement Points:</span>
                  <span className="stat-value">{metaFields?.achievementPoints || 0}</span>
                </div>
              </div>

              <div className="field-group">
                <label>Profile Rank:</label>
                <input
                  type="text"
                  value={metaFields?.profileRank || ''}
                  onChange={(e) => updateField('profileRank', e.target.value || null)}
                  placeholder="e.g., Rising Star, Top 1%"
                />
              </div>
            </div>
          )}

          {/* Visibility Tab */}
          {activeTab === 'visibility' && (
            <div className="tab-section">
              <h3>Meta Fields Visibility Control</h3>
              
              <div className="visibility-warning">
                ⚠️ By default, all meta fields are HIDDEN from public view. 
                Enable visibility to show badges and verification marks on user profiles.
              </div>

              <div className="visibility-controls">
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={metaFields?.metaFieldsVisibleToPublic}
                    onChange={(e) => updateVisibility(e.target.checked)}
                  />
                  <span className="toggle-label">
                    👁️ Show Meta Fields to Public
                  </span>
                </label>

                {metaFields?.metaFieldsVisibleToPublic && (
                  <div className="visible-badge success">
                    ✓ Meta fields are visible to all users
                  </div>
                )}
                {!metaFields?.metaFieldsVisibleToPublic && (
                  <div className="visible-badge hidden">
                    🔒 Meta fields are hidden (admin only)
                  </div>
                )}
              </div>

              <div className="moderation-section">
                <h3>Moderation Status</h3>
                <div className="field-group">
                  <label>Status:</label>
                  <select 
                    value={metaFields?.moderationStatus || 'approved'}
                    onChange={(e) => updateField('moderationStatus', e.target.value)}
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="flagged">Flagged</option>
                    <option value="suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {toast && (
          <div className={`toast-notification ${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetaFieldsModal;
