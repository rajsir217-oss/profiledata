import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './SearchFiltersModal.css';
import UniversalTabContainer from './UniversalTabContainer';
import SearchFilters from './SearchFilters';
import api from '../api';
import toastService from '../services/toastService';

const SearchFiltersModal = ({
  isOpen,
  onClose,
  searchCriteria,
  minMatchScore,
  setMinMatchScore,
  handleInputChange,
  showAdvancedFilters,
  setShowAdvancedFilters,
  onSearch,
  onClear,
  onSave,
  systemConfig,
  isPremiumUser,
  currentUserProfile,
  bodyTypeOptions,
  occupationOptions,
  eatingOptions,
  lifestyleOptions,
  isAdmin,
  savedSearches,
  selectedSearch,
  handleLoadSavedSearch,
  handleDeleteSavedSearch,
  handleEditSchedule,
  handleSetDefaultSearch,
  generateSearchDescription,
  loadSavedSearches
}) => {
  // Inline schedule editing state
  const [editingScheduleSearch, setEditingScheduleSearch] = useState(null);
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleFrequency, setScheduleFrequency] = useState('daily');
  const [scheduleTime, setScheduleTime] = useState('09:00');
  const [scheduleDay, setScheduleDay] = useState('monday');
  const [savingSchedule, setSavingSchedule] = useState(false);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        if (editingScheduleSearch) {
          setEditingScheduleSearch(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose, editingScheduleSearch]);

  // Start inline schedule editing
  const startInlineScheduleEdit = (search) => {
    setEditingScheduleSearch(search);
    const notifications = search.notifications || {};
    setScheduleEnabled(notifications.enabled || false);
    setScheduleFrequency(notifications.frequency || 'daily');
    setScheduleTime(notifications.time || '09:00');
    setScheduleDay(notifications.dayOfWeek || 'monday');
  };

  // Cancel inline schedule editing
  const cancelInlineScheduleEdit = () => {
    setEditingScheduleSearch(null);
  };

  // Save inline schedule
  const saveInlineSchedule = async () => {
    if (!editingScheduleSearch) return;
    
    setSavingSchedule(true);
    try {
      const username = localStorage.getItem('username');
      const searchId = editingScheduleSearch.id || editingScheduleSearch._id;
      
      await api.put(`/${username}/saved-searches/${searchId}`, {
        notifications: {
          enabled: scheduleEnabled,
          frequency: scheduleFrequency,
          time: scheduleTime,
          dayOfWeek: scheduleFrequency === 'weekly' ? scheduleDay : null
        }
      });
      
      toastService.success('✅ Schedule updated successfully');
      setEditingScheduleSearch(null);
      
      // Refresh saved searches list
      if (loadSavedSearches) {
        loadSavedSearches();
      }
    } catch (err) {
      toastService.error('Failed to update schedule');
    } finally {
      setSavingSchedule(false);
    }
  };

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('search-modal-overlay')) {
      if (editingScheduleSearch) {
        setEditingScheduleSearch(null);
      } else {
        onClose();
      }
    }
  };

  return createPortal(
    <div className="search-modal-overlay" onClick={handleOverlayClick}>
      <div className="search-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="search-modal-header">
          <h3><span className="modal-icon">🔍</span> Search Profiles</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="search-modal-body">
          <UniversalTabContainer
            key={`search-tabs-${savedSearches.length}`}
            variant="pills"
            defaultTab={savedSearches.length > 0 ? "saved" : "search"}
            tabs={[
              {
                id: 'search',
                icon: '🔍',
                label: 'Filters',
                badge: minMatchScore > 0 ? `${minMatchScore}%` : null,
                content: (
                  <SearchFilters
                    searchCriteria={searchCriteria}
                    minMatchScore={minMatchScore}
                    setMinMatchScore={setMinMatchScore}
                    handleInputChange={handleInputChange}
                    showAdvancedFilters={showAdvancedFilters}
                    setShowAdvancedFilters={setShowAdvancedFilters}
                    onSearch={() => {
                      onSearch();
                      onClose();
                    }}
                    onClear={onClear}
                    onSave={() => {
                      // Don't close search modal, just open save modal on top
                      onSave();
                    }}
                    systemConfig={systemConfig}
                    isPremiumUser={isPremiumUser}
                    currentUserProfile={currentUserProfile}
                    bodyTypeOptions={bodyTypeOptions}
                    occupationOptions={occupationOptions}
                    eatingOptions={eatingOptions}
                    lifestyleOptions={lifestyleOptions}
                    isAdmin={isAdmin}
                  />
                )
              },
              {
                id: 'saved',
                icon: '💾',
                label: 'Saved',
                badge: savedSearches.length > 0 ? savedSearches.length : null,
                content: (
                  <div className="saved-searches-tab">
                    {/* Inline Schedule Edit Form */}
                    {editingScheduleSearch && (
                      <div className="inline-schedule-edit">
                        <div className="schedule-edit-header">
                          <h4>⏰ Edit Schedule: {editingScheduleSearch.name}</h4>
                          <button type="button" className="btn-close-schedule" onClick={cancelInlineScheduleEdit}>✕</button>
                        </div>
                        <div className="schedule-edit-body">
                          <div className="schedule-toggle">
                            <label className="toggle-label">
                              <input
                                type="checkbox"
                                checked={scheduleEnabled}
                                onChange={(e) => setScheduleEnabled(e.target.checked)}
                              />
                              <span className="toggle-text">Enable Email Notifications</span>
                            </label>
                          </div>
                          
                          {/* DISABLED: Frequency/Time settings - job now runs on fixed weekly schedule
                             User-level scheduling is no longer needed. Re-enable if per-user scheduling is restored.
                          {scheduleEnabled && (
                            <>
                              <div className="schedule-options">
                                <div className="form-group">
                                  <label>Frequency</label>
                                  <select
                                    className="form-control"
                                    value={scheduleFrequency}
                                    onChange={(e) => setScheduleFrequency(e.target.value)}
                                  >
                                    <option value="daily">Daily</option>
                                    <option value="weekly">Weekly</option>
                                  </select>
                                </div>
                                
                                {scheduleFrequency === 'weekly' && (
                                  <div className="form-group">
                                    <label>Day of Week</label>
                                    <select
                                      className="form-control"
                                      value={scheduleDay}
                                      onChange={(e) => setScheduleDay(e.target.value)}
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
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                          */}
                        </div>
                        <div className="schedule-edit-footer">
                          <button type="button" className="btn btn-secondary" onClick={cancelInlineScheduleEdit}>Cancel</button>
                          <button type="button" className="btn btn-primary" onClick={saveInlineSchedule} disabled={savingSchedule}>
                            {savingSchedule ? '⏳ Saving...' : '💾 Save Schedule'}
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {/* Saved Searches List (hidden when editing schedule) */}
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
                            {savedSearches.map(search => (
                              <div key={search.id} className={`saved-search-card ${search.isDefault ? 'is-default' : ''} ${selectedSearch?.id === search.id ? 'is-active' : ''}`}>
                                <div className="saved-search-header">
                                  <h5 className="saved-search-name">
                                    {search.isDefault && (
                                      <button 
                                        type="button" 
                                        className="default-badge-btn" 
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSetDefaultSearch(search.id, search.name, true); }}
                                        title="Click to remove as default"
                                      >
                                        ⭐
                                      </button>
                                    )}
                                    {search.name}
                                  </h5>
                                  <div className="saved-search-actions">
                                    <button type="button" className="btn-schedule-saved" onClick={(e) => { e.preventDefault(); startInlineScheduleEdit(search); }} title="Edit schedule">⏰</button>
                                    <button type="button" className="btn-delete-saved" onClick={(e) => { e.preventDefault(); handleDeleteSavedSearch(search.id); }} title="Delete">🗑️</button>
                                  </div>
                                </div>
                                <div className="saved-search-description">
                                  <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                                </div>
                                <div className="saved-search-footer">
                                  <button 
                                    type="button" 
                                    className={`btn-set-default ${search.isDefault ? 'is-default' : ''}`} 
                                    onClick={(e) => { e.preventDefault(); handleSetDefaultSearch(search.id, search.name, search.isDefault); }} 
                                    title={search.isDefault ? "Remove as default" : "Set as default"}
                                  >
                                    <span className="default-icon">{search.isDefault ? '⭐' : '☆'}</span>
                                    <span className="default-text">{search.isDefault ? ' Unset' : ' Default'}</span>
                                  </button>
                                  <button type="button" className="btn-load-saved" onClick={(e) => { e.preventDefault(); handleLoadSavedSearch(search); onClose(); }}>📂 Load</button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              }
            ]}
          />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default SearchFiltersModal;
