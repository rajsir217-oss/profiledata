import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useToast from '../hooks/useToast';
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
      // Auto-generate corrected name from saved criteria
      const criteria = editingScheduleFor.criteria || {};
      const score = editingScheduleFor.minMatchScore || 0;
      const parts = [];
      
      // Gender
      const gender = criteria.gender ? criteria.gender.charAt(0).toUpperCase() : '';
      parts.push(gender);
      
      // Age range
      const ageMin = criteria.ageMin || '';
      const ageMax = criteria.ageMax || '';
      const ageRange = ageMin && ageMax ? `${ageMin}-${ageMax}` : (ageMin || ageMax || '');
      parts.push(ageRange);
      
      // Height range
      let heightRange = '';
      if (criteria.heightMinFeet && criteria.heightMaxFeet) {
        const minFt = criteria.heightMinFeet;
        const minIn = criteria.heightMinInches || 0;
        const maxFt = criteria.heightMaxFeet;
        const maxIn = criteria.heightMaxInches || 0;
        heightRange = `${minFt}'${minIn}-${maxFt}'${maxIn}`;
      } else if (criteria.heightMinFeet) {
        const minFt = criteria.heightMinFeet;
        const minIn = criteria.heightMinInches || 0;
        heightRange = `${minFt}'${minIn}+`;
      } else if (criteria.heightMaxFeet) {
        const maxFt = criteria.heightMaxFeet;
        const maxIn = criteria.heightMaxInches || 0;
        heightRange = `<${maxFt}'${maxIn}`;
      }
      parts.push(heightRange);
      
      // Days back filter
      const daysBack = criteria.daysBack || '';
      parts.push(daysBack ? `${daysBack}d` : '');
      
      // L3V3L Score
      parts.push(score.toString());
      
      // Keep existing unique number or generate new one
      const currentName = editingScheduleFor.name || '';
      const currentParts = currentName.split('|');
      // Format: Gender|Age|Height|DaysBack|Score|UniqueNum (6 parts) or old format (5 parts)
      const uniqueNum = currentParts.length === 6 ? currentParts[5] : 
                        currentParts.length === 5 ? currentParts[4] : 
                        String(Date.now() % 1000).padStart(3, '0');
      parts.push(uniqueNum);
      
      const correctedName = parts.join('|');
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
      // Generate search name in format: gender|minage-maxage|minheight-maxheight|l3v3lscore|uniquenumber
      // Example: M|19-77|5'6-5'9|55|001
      
      const parts = [];
      
      // Gender (M/F or blank)
      const gender = currentCriteria.gender ? currentCriteria.gender.charAt(0).toUpperCase() : '';
      parts.push(gender);
      
      // Age range (format: 19-77 or just min/max if one is missing)
      const ageMin = currentCriteria.ageMin || '';
      const ageMax = currentCriteria.ageMax || '';
      const ageRange = ageMin && ageMax ? `${ageMin}-${ageMax}` : (ageMin || ageMax || '');
      parts.push(ageRange);
      
      // Height range (format: 5'6-5'9)
      let heightRange = '';
      if (currentCriteria.heightMinFeet && currentCriteria.heightMaxFeet) {
        const minFt = currentCriteria.heightMinFeet;
        const minIn = currentCriteria.heightMinInches || 0;
        const maxFt = currentCriteria.heightMaxFeet;
        const maxIn = currentCriteria.heightMaxInches || 0;
        heightRange = `${minFt}'${minIn}-${maxFt}'${maxIn}`;
      } else if (currentCriteria.heightMinFeet) {
        const minFt = currentCriteria.heightMinFeet;
        const minIn = currentCriteria.heightMinInches || 0;
        heightRange = `${minFt}'${minIn}+`;
      } else if (currentCriteria.heightMaxFeet) {
        const maxFt = currentCriteria.heightMaxFeet;
        const maxIn = currentCriteria.heightMaxInches || 0;
        heightRange = `<${maxFt}'${maxIn}`;
      }
      parts.push(heightRange);
      
      // Days back filter
      const daysBack = currentCriteria.daysBack || '';
      parts.push(daysBack ? `${daysBack}d` : '');
      
      // L3V3L Score (just the number)
      const score = minMatchScore > 0 ? minMatchScore.toString() : '0';
      parts.push(score);
      
      // Unique number (3 digits based on timestamp + existing search count)
      const uniqueNum = String((Date.now() % 1000) + (savedSearches.length || 0)).padStart(3, '0');
      parts.push(uniqueNum);
      
      // Join with pipe separator
      const name = parts.join('|');
      
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

  const handleSave = () => {
    if (!searchName.trim()) {
      toast.error('Please enter a search name');
      return;
    }

    // Build save data with notification settings
    const saveData = {
      name: searchName.trim(),
      criteria: editingScheduleFor ? editingScheduleFor.criteria : currentCriteria,
      minMatchScore: editingScheduleFor ? editingScheduleFor.minMatchScore : minMatchScore,
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

    onSave(saveData);
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
                      .filter(([key, value]) => value && value !== '' && key !== 'page' && key !== 'limit' && key !== 'status')
                      .map(([key, value]) => (
                        <span key={key} className="criteria-badge">
                          <strong>{key}:</strong> {value}
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

                {enableNotifications && (
                  <>
                    <div className="form-group">
                      <label>Frequency</label>
                      <select
                        className="form-control"
                        value={notificationFrequency}
                        onChange={(e) => setNotificationFrequency(e.target.value)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    {notificationFrequency === 'weekly' && (
                      <div className="form-group">
                        <label>Day of Week</label>
                        <select
                          className="form-control"
                          value={notificationDay}
                          onChange={(e) => setNotificationDay(e.target.value)}
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Time</label>
                      <input
                        type="time"
                        className="form-control"
                        value={notificationTime}
                        onChange={(e) => setNotificationTime(e.target.value)}
                      />
                      <small className="text-muted">
                        {formatTimeDisplay(notificationTime)}
                      </small>
                    </div>
                  </>
                )}
                
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
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  ⏰ Update Schedule
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
                    .filter(([key, value]) => value && value !== '' && key !== 'page' && key !== 'limit' && key !== 'status')
                    .map(([key, value]) => (
                      <span key={key} className="criteria-badge">
                        <strong>{key}:</strong> {value}
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

                {enableNotifications && (
                  <>
                    <div className="form-group">
                      <label>Frequency</label>
                      <select
                        className="form-control"
                        value={notificationFrequency}
                        onChange={(e) => setNotificationFrequency(e.target.value)}
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>

                    {notificationFrequency === 'weekly' && (
                      <div className="form-group">
                        <label>Day of Week</label>
                        <select
                          className="form-control"
                          value={notificationDay}
                          onChange={(e) => setNotificationDay(e.target.value)}
                        >
                          <option value="monday">Monday</option>
                          <option value="tuesday">Tuesday</option>
                          <option value="wednesday">Wednesday</option>
                          <option value="thursday">Thursday</option>
                          <option value="friday">Friday</option>
                          <option value="saturday">Saturday</option>
                          <option value="sunday">Sunday</option>
                        </select>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Time</label>
                      <input
                        type="time"
                        className="form-control"
                        value={notificationTime}
                        onChange={(e) => setNotificationTime(e.target.value)}
                      />
                      <small className="text-muted">
                        {formatTimeDisplay(notificationTime)}
                      </small>
                    </div>
                  </>
                )}
              </div>

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  {editingScheduleFor ? '⏰ Update Schedule' : '💾 Save Search'}
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
                    <div key={search.id} className="saved-search-item">
                      {editingId === search.id ? (
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
                              Created: {new Date(search.created_at).toLocaleDateString()}
                            </p>
                            {search.notifications?.enabled && (
                              <div className="notification-badge">
                                📧 {search.notifications.frequency === 'daily' ? 'Daily' : search.notifications.dayOfWeek} at {formatTimeDisplay(search.notifications.time)}
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

// Helper function to format time display
function formatTimeDisplay(time) {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

export default SaveSearchModal;
