import React from 'react';
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
  onStartScheduleEdit,
  onCancelScheduleEdit,
  onSaveSchedule,
  // Saved-search actions
  onSetDefault,
  onDelete,
  onLoad
}) => {
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
                return (
                  <div
                    key={searchId}
                    className={`saved-search-card ${search.isDefault ? 'is-default' : ''} ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="saved-search-header">
                      <h5 className="saved-search-name">
                        {search.isDefault && (
                          <button
                            type="button"
                            className="default-badge-btn"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onSetDefault(searchId, search.name, true);
                            }}
                            title="Click to remove as default"
                          >
                            ⭐
                          </button>
                        )}
                        {search.name}
                      </h5>
                      <div className="saved-search-actions">
                        <button
                          type="button"
                          className="btn-schedule-saved"
                          onClick={(e) => { e.preventDefault(); onStartScheduleEdit(search); }}
                          title="Edit schedule"
                        >
                          ⏰
                        </button>
                        <button
                          type="button"
                          className="btn-delete-saved"
                          onClick={(e) => { e.preventDefault(); onDelete(searchId); }}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    <div className="saved-search-description">
                      <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                    </div>
                    <div className="saved-search-footer">
                      <button
                        type="button"
                        className={`btn-set-default ${search.isDefault ? 'is-default' : ''}`}
                        onClick={(e) => { e.preventDefault(); onSetDefault(searchId, search.name, search.isDefault); }}
                        title={search.isDefault ? 'Remove as default' : 'Set as default'}
                      >
                        <span className="default-icon">{search.isDefault ? '⭐' : '☆'}</span>
                        <span className="default-text">{search.isDefault ? ' Unset' : ' Default'}</span>
                      </button>
                      <button
                        type="button"
                        className="btn-load-saved"
                        onClick={(e) => { e.preventDefault(); onLoad(search); }}
                      >
                        📂 Load
                      </button>
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
