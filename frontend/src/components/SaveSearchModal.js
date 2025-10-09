import React, { useState } from 'react';
import './SaveSearchModal.css';

const SaveSearchModal = ({ 
  show, 
  onClose, 
  onSave, 
  savedSearches, 
  onUpdate, 
  onDelete,
  currentCriteria 
}) => {
  const [searchName, setSearchName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [activeTab, setActiveTab] = useState('save'); // 'save' or 'manage'

  if (!show) return null;

  const handleSave = () => {
    if (!searchName.trim()) {
      alert('Please enter a search name');
      return;
    }
    onSave(searchName);
    setSearchName('');
    setActiveTab('manage');
  };

  const handleUpdate = (id) => {
    if (!editingName.trim()) {
      alert('Please enter a search name');
      return;
    }
    onUpdate(id, editingName);
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this saved search?')) {
      onDelete(id);
    }
  };

  const startEditing = (search) => {
    setEditingId(search._id);
    setEditingName(search.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-user-info">
            <div className="modal-avatar-placeholder">
              💾
            </div>
            <div>
              <h3>Saved Searches</h3>
              <p>Manage your search criteria</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
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
              <p className="text-muted">Give this search a memorable name</p>
              
              <div className="form-group">
                <label>Search Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g., Engineers in New York"
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
                    <div key={search._id} className="saved-search-item">
                      {editingId === search._id ? (
                        <div className="edit-mode">
                          <input
                            type="text"
                            className="form-control"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleUpdate(search._id)}
                            autoFocus
                          />
                          <div className="edit-actions">
                            <button 
                              className="btn btn-sm btn-success"
                              onClick={() => handleUpdate(search._id)}
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
                              onClick={() => handleDelete(search._id)}
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
