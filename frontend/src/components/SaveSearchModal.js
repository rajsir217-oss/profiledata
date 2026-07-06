import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useToast from '../hooks/useToast';
import logger from '../utils/logger';
import './SaveSearchModal.css';

const SaveSearchModal = ({ 
  show, 
  onClose, 
  onSave, 
  savedSearches, 
  onUpdate, 
  onDelete,
  currentCriteria,
  minMatchScore = 0,
  editingScheduleFor = null  // Passed when editing notification schedule for existing search
}) => {
  const [searchName, setSearchName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState('save'); // 'save' or 'manage'
  const [isSaving, setIsSaving] = useState(false);
  const toast = useToast();

  // Notification schedule state
  const [enableNotifications, setEnableNotifications] = useState(false);
  const [notificationFrequency, setNotificationFrequency] = useState('daily'); // 'daily' or 'weekly'
  const [notificationTime, setNotificationTime] = useState('09:00'); // 24-hour format
  const [notificationDay, setNotificationDay] = useState('monday'); // for weekly
  const [setAsDefault, setSetAsDefault] = useState(false); // Set as default search

  // When editingScheduleFor is set, pre-populate notification fields
  useEffect(() => {
    if (editingScheduleFor && show) {
      // Auto-generate corrected name from saved criteria using readable format with field labels
      const criteria = editingScheduleFor.criteria || {};
      const score = editingScheduleFor.minMatchScore || 0;
      const parts = [];

      // Gender
      if (criteria.gender) {
        const genderLabel = criteria.gender.charAt(0).toUpperCase() + criteria.gender.slice(1).toLowerCase();
        parts.push(genderLabel);
      }

      // Age range
      const ageMin = criteria.ageMin;
      const ageMax = criteria.ageMax;
      if (ageMin && ageMax) {
        parts.push(`age ${ageMin}-${ageMax}`);
      } else if (ageMin) {
        parts.push(`age ${ageMin}+`);
      } else if (ageMax) {
        parts.push(`age up to ${ageMax}`);
      }

      // Height range
      if (criteria.heightMinFeet && criteria.heightMaxFeet) {
        const minFt = criteria.heightMinFeet;
        const minIn = criteria.heightMinInches || 0;
        const maxFt = criteria.heightMaxFeet;
        const maxIn = criteria.heightMaxInches || 0;
        parts.push(`height ${minFt}'${minIn}"-${maxFt}'${maxIn}"`);
      } else if (criteria.heightMinFeet) {
        const minFt = criteria.heightMinFeet;
        const minIn = criteria.heightMinInches || 0;
        parts.push(`height ${minFt}'${minIn}"+`);
      } else if (criteria.heightMaxFeet) {
        const maxFt = criteria.heightMaxFeet;
        const maxIn = criteria.heightMaxInches || 0;
        parts.push(`height under ${maxFt}'${maxIn}"`);
      }

      // Location filter
      let locationText = '';
      if (criteria.locations && criteria.locations.length > 0) {
        if (criteria.locations.length === 1) {
          const location = criteria.locations[0];
          locationText = location.includes(',') ? location.split(',')[0].trim() : location;
        } else {
          locationText = `${criteria.locations.length} locations`;
        }
      } else if (criteria.location) {
        const location = criteria.location;
        locationText = location.includes(',') ? location.split(',')[0].trim() : location;
      }
      if (locationText) {
        parts.push(locationText);
      }

      // Occupation filter
      let occupationText = '';
      if (criteria.occupations && criteria.occupations.length > 0) {
        if (criteria.occupations.length === 1) {
          occupationText = criteria.occupations[0];
        } else {
          occupationText = `${criteria.occupations.length} occupations`;
        }
      } else if (criteria.occupation) {
        occupationText = criteria.occupation.includes(',') ? criteria.occupation.split(',')[0].trim() : criteria.occupation;
      }
      if (occupationText) {
        parts.push(occupationText);
      }

      // Days back filter
      const daysBack = criteria.daysBack;
      if (daysBack) {
        parts.push(`${daysBack} days`);
      }

      // L3V3L Score (only include if > 0)
      if (score > 0) {
        parts.push(`${score}% match`);
      }

      // Join with commas
      const correctedName = parts.join(', ');
      logger.info(`🔧 Generated corrected search name: ${correctedName}`);
      setSearchName(correctedName);

      // Pre-populate notification settings
      const notifications = editingScheduleFor.notifications || {};
      setEnableNotifications(notifications.enabled || false);
      setNotificationFrequency(notifications.frequency || 'daily');
      setNotificationTime(notifications.time || '09:00');
      setNotificationDay(notifications.dayOfWeek || 'monday');
      setSetAsDefault(editingScheduleFor.isDefault || false);

      // Switch to save tab to show schedule options
      setActiveTab('save');
    } else if (show && !editingScheduleFor) {
      // Reset to defaults when opening for new search
      setEnableNotifications(false);
      setNotificationFrequency('daily');
      setNotificationTime('09:00');
      setNotificationDay('monday');
      setSetAsDefault(false);
    }
  }, [editingScheduleFor, show]);

  // ESC key handler to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && show) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [show, onClose]);

  // Set default search name when modal opens
  useEffect(() => {
    // Skip name generation if editing schedule (name already set from editingScheduleFor)
    if (editingScheduleFor) {
      return;
    }

    if (show && activeTab === 'save') {
      // Generate readable search name with field labels
      // Example: "Female, age 19-25, height 5'9\"-6'3\", Nashville, Software Engineer, 7 days, 50% match"
      // Only include fields that have actual values

      const parts = [];

      // Gender
      if (currentCriteria.gender) {
        const genderLabel = currentCriteria.gender.charAt(0).toUpperCase() + currentCriteria.gender.slice(1).toLowerCase();
        parts.push(genderLabel);
      }

      // Age range
      const ageMin = currentCriteria.ageMin;
      const ageMax = currentCriteria.ageMax;
      if (ageMin && ageMax) {
        parts.push(`age ${ageMin}-${ageMax}`);
      } else if (ageMin) {
        parts.push(`age ${ageMin}+`);
      } else if (ageMax) {
        parts.push(`age up to ${ageMax}`);
      }

      // Height range
      if (currentCriteria.heightMinFeet && currentCriteria.heightMaxFeet) {
        const minFt = currentCriteria.heightMinFeet;
        const minIn = currentCriteria.heightMinInches || 0;
        const maxFt = currentCriteria.heightMaxFeet;
        const maxIn = currentCriteria.heightMaxInches || 0;
        parts.push(`height ${minFt}'${minIn}"-${maxFt}'${maxIn}"`);
      } else if (currentCriteria.heightMinFeet) {
        const minFt = currentCriteria.heightMinFeet;
        const minIn = currentCriteria.heightMinInches || 0;
        parts.push(`height ${minFt}'${minIn}"+`);
      } else if (currentCriteria.heightMaxFeet) {
        const maxFt = currentCriteria.heightMaxFeet;
        const maxIn = currentCriteria.heightMaxInches || 0;
        parts.push(`height under ${maxFt}'${maxIn}"`);
      }

      // Location filter
      let locationText = '';
      if (currentCriteria.locations && currentCriteria.locations.length > 0) {
        if (currentCriteria.locations.length === 1) {
          const location = currentCriteria.locations[0];
          locationText = location.includes(',') ? location.split(',')[0].trim() : location;
        } else {
          locationText = `${currentCriteria.locations.length} locations`;
        }
      } else if (currentCriteria.location) {
        const location = currentCriteria.location;
        locationText = location.includes(',') ? location.split(',')[0].trim() : location;
      }
      if (locationText) {
        parts.push(locationText);
      }

      // Occupation filter
      let occupationText = '';
      if (currentCriteria.occupations && currentCriteria.occupations.length > 0) {
        if (currentCriteria.occupations.length === 1) {
          occupationText = currentCriteria.occupations[0];
        } else {
          occupationText = `${currentCriteria.occupations.length} occupations`;
        }
      } else if (currentCriteria.occupation) {
        occupationText = currentCriteria.occupation.includes(',') ? currentCriteria.occupation.split(',')[0].trim() : currentCriteria.occupation;
      }
      if (occupationText) {
        parts.push(occupationText);
      }

      // Days back filter
      const daysBack = currentCriteria.daysBack;
      if (daysBack) {
        parts.push(`${daysBack} days`);
      }

      // L3V3L Score (only include if > 0)
      if (minMatchScore > 0) {
        parts.push(`${minMatchScore}% match`);
      }

      // Join with commas
      const name = parts.join(', ');

      // Set default name
      setSearchName(name);
    }
  }, [show, activeTab, currentCriteria, minMatchScore, savedSearches.length, editingScheduleFor]);

  if (!show) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('save-search-modal-overlay')) {
      onClose();
    }
  };

  const handleSave = async () => {
    if (!searchName.trim()) {
      toast.error('Please enter a search name');
      return;
    }

    // Validate that at least one search filter is set
    const criteria = editingScheduleFor ? editingScheduleFor.criteria : currentCriteria;
    const score = editingScheduleFor ? editingScheduleFor.minMatchScore : minMatchScore;

    const hasFilter =
      criteria.gender ||
      criteria.ageMin ||
      criteria.ageMax ||
      criteria.heightMinFeet ||
      criteria.heightMaxFeet ||
      (criteria.locations && criteria.locations.length > 0) ||
      (criteria.location) ||
      (criteria.occupations && criteria.occupations.length > 0) ||
      (criteria.occupation) ||
      criteria.daysBack ||
      score > 0;

    if (!hasFilter) {
      toast.error('Please set at least one search filter before saving.');
      return;
    }

    // Check for duplicate names (exclude current search if editing)
    const trimmedName = searchName.trim();
    const currentSearchId = editingScheduleFor ? (editingScheduleFor.id || editingScheduleFor._id) : null;
    const duplicateExists = savedSearches.some(
      search => (search.id || search._id) !== currentSearchId &&
               search.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicateExists) {
      toast.error('A search with this name already exists. Please choose a different name.');
      return;
    }

    // Check for duplicate search criteria (exclude current search if editing)
    const isCriteriaEqual = (criteria1, criteria2, score1, score2) => {
      // Compare minMatchScore
      if (score1 !== score2) return false;

      // Get all keys from both criteria objects
      const allKeys = new Set([...Object.keys(criteria1 || {}), ...Object.keys(criteria2 || {})]);

      // Exclude internal fields
      const excludeKeys = ['page', 'limit', 'status'];

      for (const key of allKeys) {
        if (excludeKeys.includes(key)) continue;

        const val1 = criteria1?.[key];
        const val2 = criteria2?.[key];

        // Handle arrays (like locations, occupations)
        if (Array.isArray(val1) && Array.isArray(val2)) {
          if (val1.length !== val2.length) return false;
          // Sort and compare
          const sorted1 = [...val1].sort();
          const sorted2 = [...val2].sort();
          if (JSON.stringify(sorted1) !== JSON.stringify(sorted2)) return false;
        }
        // Handle objects
        else if (typeof val1 === 'object' && typeof val2 === 'object' && val1 !== null && val2 !== null) {
          if (JSON.stringify(val1) !== JSON.stringify(val2)) return false;
        }
        // Handle primitives
        else if (val1 !== val2) {
          return false;
        }
      }

      return true;
    };

    const duplicateCriteriaExists = savedSearches.some(
      search => (search.id || search._id) !== currentSearchId &&
               isCriteriaEqual(criteria, search.criteria, score, search.minMatchScore)
    );

    if (duplicateCriteriaExists) {
      toast.error('A search with these filters already exists. Please modify the filters or use the existing search.');
      return;
    }

    if (!editingScheduleFor && (savedSearches?.length || 0) >= 5) {
      toast.error('You can save up to 5 searches. Please delete one before saving a new search.');
      return;
    }

    setIsSaving(true);
    try {
      // Build save data with notification settings
      const saveData = {
        name: trimmedName,
        criteria: criteria,
        minMatchScore: score,
        notifications: {
          enabled: enableNotifications,
          frequency: notificationFrequency,
          time: notificationTime,
          dayOfWeek: notificationFrequency === 'weekly' ? notificationDay : null
        },
        isDefault: setAsDefault
      };

      // If editing an existing search's schedule, include the ID
      if (editingScheduleFor) {
        saveData.id = editingScheduleFor.id || editingScheduleFor._id;
        saveData.isUpdate = true;
      }

      await onSave(saveData);
    } catch (error) {
      logger.error('Failed to save search:', error);
      toast.error('Failed to save search. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (search) => {
    setEditingId(search.id || search._id);
    setEditingName(search.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleUpdate = (searchId) => {
    if (!editingName.trim()) {
      toast.error('Search name cannot be empty');
      return;
    }
    if (onUpdate) {
      onUpdate(searchId, editingName.trim());
    }
    cancelEditing();
  };

  const handleDelete = (searchId) => {
    if (onDelete) {
      onDelete(searchId);
    }
  };

  return createPortal(
    <div className="save-search-modal-overlay" onClick={handleOverlayClick}>
      <div className="save-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            {editingScheduleFor ? '⏰ Edit Notification Schedule' : '💾 Saved Searches'}
          </h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Hide tabs when editing schedule - show single unified view */}
        {!editingScheduleFor && (
          <div className="modal-tabs">
            <button 
              className={`tab-btn ${activeTab === 'save' ? 'active' : ''}`}
              onClick={() => setActiveTab('save')}
            >
              ➕ Save Current Search
            </button>
            <button 
              className={`tab-btn ${activeTab === 'manage' ? 'active' : ''}`}
              onClick={() => setActiveTab('manage')}
            >
              📋 Manage Searches ({savedSearches.length})
            </button>
          </div>
        )}

        <div className="modal-body">
          {/* Single unified view for editing schedules */}
          {editingScheduleFor ? (
            <div className="edit-schedule-section">
              <div className="form-group">
                <label>Search Name</label>
                <input
                  type="text"
                  className="form-control"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                />
                <small className="text-muted">
                  You can rename this search if needed
                </small>
              </div>

              {/* Show search criteria preview */}
              {editingScheduleFor && editingScheduleFor.criteria && (
                <div className="criteria-preview">
                  <h5>Current Criteria:</h5>
                  <div className="criteria-list">
                    {Object.entries(editingScheduleFor.criteria)
                      .filter(([key, value]) => {
                        // Include boolean false values (like hasPhoto: false)
                        // Exclude empty strings, null, undefined, and internal fields
                        if (key === 'page' || key === 'limit' || key === 'status') return false;
                        if (value === '' || value === null || value === undefined) return false;
                        return true;
                      })
                      .map(([key, value]) => (
                        <span key={key} className="criteria-badge">
                          <strong>{key}:</strong> {String(value)}
                        </span>
                      ))}
                    {editingScheduleFor.minMatchScore > 0 ? (
                      <span key="l3v3l-score" className="criteria-badge criteria-badge-l3v3l">
                        <strong>L3V3L Score:</strong> ≥{editingScheduleFor.minMatchScore}%
                      </span>
                    ) : (
                      <span key="l3v3l-score" className="criteria-badge" style={{opacity: 0.5}}>
                        <strong>L3V3L Score:</strong> Not set (0%)
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="notification-schedule-section">
                <h5>📧 Email Notifications for New Matches</h5>
                <p className="text-muted">Get notified when new profiles match this search</p>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableNotifications}
                      onChange={(e) => setEnableNotifications(e.target.checked)}
                    />
                    <span>Enable email notifications</span>
                  </label>
                </div>

                {/* Set as Default checkbox */}
                <div className="form-group" style={{marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)'}}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      style={{marginRight: '8px'}}
                    />
                    <span style={{fontSize: '16px'}}>
                      ⭐ Set as default search
                    </span>
                  </label>
                  <small className="text-muted" style={{display: 'block', marginTop: '8px', marginLeft: '28px'}}>
                    This search will automatically run when you visit the search page
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : '⏰ Update Schedule'}
                </button>
              </div>
            </div>
          ) : activeTab === 'save' ? (
            <div className="save-section">
              <h4>Save Current Search Criteria</h4>
              <p className="text-muted">Auto-generated name (edit if needed)</p>
              
              <div className="form-group">
                <label>Search Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Auto-generated based on filters"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSave()}
                />
              </div>

              <div className="criteria-preview">
                <h5>Current Criteria:</h5>
                <div className="criteria-list">
                  {Object.entries(currentCriteria)
                    .filter(([key, value]) => {
                      // Include boolean false values (like hasPhoto: false)
                      // Exclude empty strings, null, undefined, and internal fields
                      if (key === 'page' || key === 'limit' || key === 'status') return false;
                      if (value === '' || value === null || value === undefined) return false;
                      return true;
                    })
                    .map(([key, value]) => (
                      <span key={key} className="criteria-badge">
                        <strong>{key}:</strong> {String(value)}
                      </span>
                    ))}
                  {minMatchScore > 0 ? (
                    <span key="l3v3l-score" className="criteria-badge criteria-badge-l3v3l">
                      <strong>L3V3L Score:</strong> ≥{minMatchScore}%
                    </span>
                  ) : (
                    <span key="l3v3l-score" className="criteria-badge" style={{opacity: 0.5}}>
                      <strong>L3V3L Score:</strong> Not set (0%)
                    </span>
                  )}
                </div>
              </div>

              <div className="notification-schedule-section">
                <h5>📧 Email Notifications for New Matches</h5>
                <p className="text-muted">Get notified when new profiles match this search</p>
                
                <div className="form-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={enableNotifications}
                      onChange={(e) => setEnableNotifications(e.target.checked)}
                    />
                    <span>Enable email notifications</span>
                  </label>
                </div>

                {/* Set as Default checkbox */}
                <div className="form-group" style={{marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)'}}>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      style={{marginRight: '8px'}}
                    />
                    <span style={{fontSize: '16px'}}>
                      ⭐ Set as default search
                    </span>
                  </label>
                  <small className="text-muted" style={{display: 'block', marginTop: '8px', marginLeft: '28px'}}>
                    This search will automatically run when you visit the search page
                  </small>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? 'Saving...' : '💾 Save Search'}
                </button>
              </div>
            </div>
          ) : (
            <div className="manage-section">
              <h4>Your Saved Searches</h4>
              {savedSearches.length === 0 ? (
                <p className="text-muted text-center py-4">
                  No saved searches yet. Switch to "Save Current Search" tab to create one.
                </p>
              ) : (
                <div className="saved-searches-list">
                  {savedSearches.map((search) => (
                    <div key={search.id || search._id} className="saved-search-item">
                      {editingId === (search.id || search._id) ? (
                        <div className="edit-mode">
                          <input
                            type="text"
                            className="form-control"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleUpdate(search.id)}
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdate(search.id)}
                            >
                              ✓
                            </button>
                            <button 
                              className="btn btn-sm btn-secondary"
                              onClick={cancelEditing}
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="search-info">
                            <h5>{search.name}</h5>
                            <p className="text-muted">
                              Created: {new Date(search.created_at || search.createdAt).toLocaleDateString()}
                            </p>
                            {search.notifications?.enabled && (
                              <div className="notification-badge">
                                📧 Email notifications enabled
                              </div>
                            )}
                          </div>
                          <div className="search-actions">
                            <button 
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => startEditing(search)}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button 
                              className="btn btn-sm btn-outline-danger"
                              onClick={() => handleDelete(search.id)}
                              title="Delete"
                            >
                              🗑️
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SaveSearchModal;
