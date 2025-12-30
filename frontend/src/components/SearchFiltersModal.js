import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './SearchFiltersModal.css';
import UniversalTabContainer from './UniversalTabContainer';
import SearchFilters from './SearchFilters';

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
  generateSearchDescription
}) => {
  // ESC key handler
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e) => {
    if (e.target.classList.contains('search-modal-overlay')) {
      onClose();
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
                                {search.isDefault && <span className="default-badge" title="Default Search">⭐ </span>}
                                {search.name}
                              </h5>
                              <div className="saved-search-actions">
                                <button type="button" className="btn-schedule-saved" onClick={(e) => { e.preventDefault(); handleEditSchedule(search); }} title="Edit schedule">⏰</button>
                                <button type="button" className="btn-delete-saved" onClick={(e) => { e.preventDefault(); handleDeleteSavedSearch(search.id); }} title="Delete">🗑️</button>
                              </div>
                            </div>
                            <div className="saved-search-description">
                              <p>{search.description || generateSearchDescription(search.criteria, search.minMatchScore)}</p>
                            </div>
                            <div className="saved-search-footer">
                              {!search.isDefault && (
                                <button type="button" className="btn-set-default" onClick={(e) => { e.preventDefault(); handleSetDefaultSearch(search.id, search.name); }}>⭐ Default</button>
                              )}
                              <button type="button" className="btn-load-saved" onClick={(e) => { e.preventDefault(); handleLoadSavedSearch(search); onClose(); }}>📂 Load</button>
                            </div>
                          </div>
                        ))}
                      </div>
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
