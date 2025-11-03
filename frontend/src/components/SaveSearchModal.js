import React, { useState, useEffect } from 'react';
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
  minMatchScore = 0
}) => {
  const [searchName, setSearchName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState('save'); // 'save' or 'manage'
  const toast = useToast();

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
    if (show && activeTab === 'save') {
      // Generate short search name based on criteria (max 12 chars)
      const parts = [];
      
      // Gender (1 char: M/F)
      if (currentCriteria.gender) {
        parts.push(currentCriteria.gender.charAt(0).toUpperCase());
      }
      
      // Age range (format: 30-34)
      if (currentCriteria.ageMin || currentCriteria.ageMax) {
        const min = currentCriteria.ageMin || '?';
        const max = currentCriteria.ageMax || '?';
        parts.push(`${min}-${max}`);
      }
      
      // Height (format: 5'6-5'9 or just 5-6 if same feet)
      if (currentCriteria.heightMinFeet && currentCriteria.heightMaxFeet) {
        const minFt = currentCriteria.heightMinFeet;
        const minIn = currentCriteria.heightMinInches || 0;
        const maxFt = currentCriteria.heightMaxFeet;
        const maxIn = currentCriteria.heightMaxInches || 0;
        
        if (minFt === maxFt) {
          // Same feet, just show inches range: 5'6-9
          parts.push(`${minFt}'${minIn}-${maxIn}`);
        } else {
          // Different feet: 5'6-6'2
          parts.push(`${minFt}'${minIn}-${maxFt}'${maxIn}`);
        }
      }
      
      // L3V3L Score (format: L55) - only include if > 0
      // (L0 means no filtering, so we skip it to save space)
      if (minMatchScore > 0) {
        parts.push(`L${minMatchScore}`);
      }
      
      // Location (first 3 chars)
      if (currentCriteria.location) {
        parts.push(currentCriteria.location.substring(0, 3));
      }
      
      // Join and truncate to 12 chars
      const name = parts.join(' ').substring(0, 12);
      
      // Set default or generic name
      setSearchName(name || 'Search');
    }
  }, [show, activeTab, currentCriteria, minMatchScore]);

  if (!show) return null;

  const handleSave = () => {
    if (!searchName.trim()) {
      toast.warning('Please enter a search name');
      return;
    }
    onSave(searchName);
    setSearchName('');
    setActiveTab('manage');
  };

  const handleUpdate = (id) => {
    if (!editingName.trim()) {
      toast.warning('Please enter a search name');
      return;
    }
    onUpdate(id, editingName);
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (id) => {
    // Use the parent's onDelete handler directly
    // The parent (SearchPage2) will show a toast notification
    onDelete(id);
  };

  const startEditing = (search) => {
    setEditingId(search.id);
    setEditingName(search.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="save-search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💾 Saved Searches</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

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

        <div className="modal-body">
          {activeTab === 'save' ? (
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

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleSave}>
                  💾 Save Search
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
    </div>
  );
};

export default SaveSearchModal;
