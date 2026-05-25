import React, { useState } from 'react';
import { generateSearchDescription } from '../../utils/searchDescription';
import InlineScheduleEditor from './InlineScheduleEditor';

// Saved-searches tab panel.
// Pure presentational — receives data and callbacks from parent (SearchPage2).
// Renders either the inline schedule editor (when one is active) OR the
// grid of saved-search cards.
//
// Extracted from SearchPage2.js as part of the #11 refactor.
const SavedSearchesPanel = ({
  savedSearches,
  selectedSearch,
  // Inline schedule editor wiring
  editingScheduleSearch,
  scheduleEnabled,
  setScheduleEnabled,
  savingSchedule,
  onCancelScheduleEdit,
  onSaveSchedule,
  // Saved-search actions
  onUpdateSavedSearch,
  onSetDefault,
  onDelete,
  onLoad
}) => {
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({ name: '', notificationsEnabled: false });

  const handleStartEdit = (search) => {
    const searchId = search.id || search._id;
    setEditingId(searchId);
    setEditFormData({
      name: search.name || '',
      notificationsEnabled: search.notifications?.enabled !== false
    });
  };

  const handleSaveEdit = async (search) => {
    const searchId = search.id || search._id;
    if (!onUpdateSavedSearch || !searchId || !editFormData.name.trim()) return;

    const existingNotifications = search.notifications || {};
    const nextNotifications = {
      ...existingNotifications,
      enabled: Boolean(editFormData.notificationsEnabled)
    };

    if (nextNotifications.enabled && !nextNotifications.frequency) {
      nextNotifications.frequency = 'daily';
    }

    await onUpdateSavedSearch({
      isUpdate: true,
      id: searchId,
      name: editFormData.name.trim(),
      notifications: nextNotifications
    });

    setEditingId(null);
    setEditFormData({ name: '', notificationsEnabled: false });
  };

  const handleToggleNotifications = async (search, enabled) => {
    const searchId = search.id || search._id;
    if (!onUpdateSavedSearch || !searchId) return;

    const existingNotifications = search.notifications || {};
    const nextNotifications = {
      ...existingNotifications,
      enabled: Boolean(enabled)
    };

    if (nextNotifications.enabled && !nextNotifications.frequency) {
      nextNotifications.frequency = 'daily';
    }

    await onUpdateSavedSearch({
      isUpdate: true,
      id: searchId,
      name: (search.name || '').trim(),
      notifications: nextNotifications
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData({ name: '', notificationsEnabled: false });
  };
  return (
    <div className="saved-searches-tab">
      {editingScheduleSearch && (
        <InlineScheduleEditor
          search={editingScheduleSearch}
          scheduleEnabled={scheduleEnabled}
          setScheduleEnabled={setScheduleEnabled}
          savingSchedule={savingSchedule}
          onCancel={onCancelScheduleEdit}
          onSave={onSaveSchedule}
        />
      )}

      {!editingScheduleSearch && (
        <>
          {savedSearches.length === 0 ? (
            <div className="empty-saved-searches">
              <div className="empty-icon">📋</div>
              <h4>No Saved Searches Yet</h4>
              <p>Save your search criteria to quickly access them later.</p>
            </div>
          ) : (
            <div className="saved-searches-grid">
              {savedSearches.map(search => {
                const searchId = search.id || search._id;
                const isActive = selectedSearch?.id === searchId || selectedSearch?._id === searchId;
                const isEditing = editingId === searchId;
                const notificationsEnabled = search.notifications?.enabled !== false;
                return (
                  <div
                    key={searchId}
                    className={`saved-search-card ${search.isDefault ? 'is-default' : ''} ${isActive ? 'is-active' : ''} ${isEditing ? 'is-editing' : ''}`}
                  >
                    <div className="saved-search-row">
                      <div className="saved-search-col-name">
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={editFormData.name}
                              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                              className="saved-search-name-input-inline"
                              placeholder="Name"
                              autoFocus
                            />
                            <button
                              type="button"
                              className="btn-save-edit"
                              onClick={(e) => { e.preventDefault(); handleSaveEdit(search); }}
                              title="Save"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              className="btn-cancel-edit"
                              onClick={(e) => { e.preventDefault(); handleCancelEdit(); }}
                              title="Cancel"
                            >
                              ✕
                            </button>
                          </>
                        ) : (
                          <span className="saved-search-name-text">{search.name}</span>
                        )}
                      </div>

                      <div className="saved-search-col-description">
                        <div className="saved-search-description">
                          <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                        </div>
                      </div>

                      <div className="saved-search-col-actions">
                        <label className="saved-search-notif-inline" title="Email notifications">
                          <input
                            type="checkbox"
                            checked={isEditing ? Boolean(editFormData.notificationsEnabled) : notificationsEnabled}
                            onChange={(e) => {
                              if (isEditing) {
                                setEditFormData({ ...editFormData, notificationsEnabled: e.target.checked });
                                return;
                              }
                              handleToggleNotifications(search, e.target.checked);
                            }}
                          />
                          <span className={`email-icon ${isEditing ? (editFormData.notificationsEnabled ? 'checked' : '') : (notificationsEnabled ? 'checked' : '')}`}>📧</span>
                        </label>
                        <button
                          type="button"
                          className={`btn-set-default ${search.isDefault ? 'is-default' : ''}`}
                          onClick={(e) => { e.preventDefault(); onSetDefault(searchId, search.name, search.isDefault); }}
                          title={search.isDefault ? 'Remove as default' : 'Set as default'}
                          disabled={isEditing}
                        >
                          <span className="default-icon">{search.isDefault ? '⭐' : '☆'}</span>
                          <span className="default-text">{search.isDefault ? ' Unset' : ' Default'}</span>
                        </button>

                        <button
                          type="button"
                          className="btn-edit-schedule"
                          onClick={(e) => { e.preventDefault(); handleStartEdit(search); }}
                          title="Edit name and notifications"
                          disabled={isEditing}
                        >
                          ✏️
                        </button>

                        <button
                          type="button"
                          className="btn-delete-saved"
                          onClick={(e) => { e.preventDefault(); onDelete(searchId); }}
                          title="Delete"
                          disabled={isEditing}
                        >
                          🗑️
                        </button>

                        <button
                          type="button"
                          className="btn-load-saved"
                          onClick={(e) => { e.preventDefault(); onLoad(search); }}
                          disabled={isEditing}
                        >
                          📂 Load
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SavedSearchesPanel;
