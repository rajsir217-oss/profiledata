import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './ProfileNotes.css';

// Create a dedicated API instance for notes (uses /api/notes prefix, not /api/users)
const notesApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor
notesApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * ProfileNotes Component
 * Allows users to save private notes about profiles they're interested in.
 * Features: auto-save, expiry warning, dropdown selection, delete
 */
const ProfileNotes = () => {
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableProfiles, setAvailableProfiles] = useState([]);
  const [selectedProfile, setSelectedProfile] = useState('');
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [savingNotes, setSavingNotes] = useState({}); // Track which notes are saving
  const [deleteConfirm, setDeleteConfirm] = useState(null); // Track which note is pending delete
  
  const saveTimeoutRefs = useRef({});

  // Fetch all notes
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await notesApi.get('/api/notes');
      if (response.data.success) {
        setNotes(response.data.notes || []);
      } else {
        // API returned success: false
        setNotes([]);
      }
    } catch (err) {
      // Don't show error for empty notes, just set empty array
      if (err.response?.status === 404) {
        setNotes([]);
      } else {
        setError('Failed to load notes');
        console.error('Error fetching notes:', err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Fetch available profiles (from Messages, Favorites, Shortlists)
  const fetchAvailableProfiles = useCallback(async () => {
    try {
      setLoadingProfiles(true);
      const response = await notesApi.get('/api/notes/available-profiles');
      if (response.data.success) {
        setAvailableProfiles(response.data.profiles || []);
      }
    } catch (err) {
      console.error('Error fetching available profiles:', err);
    } finally {
      setLoadingProfiles(false);
    }
  }, []);

  // Load available profiles when Add Note is clicked
  const handleShowAddNote = () => {
    setShowAddNote(true);
    setSelectedProfile('');
    fetchAvailableProfiles();
  };

  // Create new note from dropdown selection
  const handleCreateNote = async () => {
    if (!selectedProfile) return;
    
    const profile = availableProfiles.find(p => p.username === selectedProfile);
    if (!profile) return;
    
    try {
      const response = await notesApi.post('/api/notes', {
        targetUsername: profile.username,
        note: ''
      });

      if (response.data.success) {
        setNotes(prev => [response.data.note, ...prev]);
        setShowAddNote(false);
        setSelectedProfile('');
        // Remove from available profiles
        setAvailableProfiles(prev => prev.filter(p => p.username !== profile.username));
      }
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  // Auto-save note (debounced)
  const handleNoteChange = (targetUsername, newNote) => {
    // Update local state immediately
    setNotes(prev => prev.map(n => 
      n.targetUsername === targetUsername 
        ? { ...n, note: newNote }
        : n
    ));

    // Clear existing timeout for this note
    if (saveTimeoutRefs.current[targetUsername]) {
      clearTimeout(saveTimeoutRefs.current[targetUsername]);
    }

    // Set saving indicator
    setSavingNotes(prev => ({ ...prev, [targetUsername]: 'typing' }));

    // Debounce the save
    saveTimeoutRefs.current[targetUsername] = setTimeout(async () => {
      try {
        setSavingNotes(prev => ({ ...prev, [targetUsername]: 'saving' }));
        
        await notesApi.put(`/api/notes/${targetUsername}`, { note: newNote });
        
        setSavingNotes(prev => ({ ...prev, [targetUsername]: 'saved' }));
        
        // Clear saved indicator after 2 seconds
        setTimeout(() => {
          setSavingNotes(prev => ({ ...prev, [targetUsername]: null }));
        }, 2000);
      } catch (err) {
        console.error('Error saving note:', err);
        setSavingNotes(prev => ({ ...prev, [targetUsername]: 'error' }));
      }
    }, 1000);
  };

  // Delete note
  const handleDeleteNote = async (targetUsername) => {
    try {
      await notesApi.delete(`/api/notes/${targetUsername}`);
      setNotes(prev => prev.filter(n => n.targetUsername !== targetUsername));
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting note:', err);
      alert('Failed to delete note');
    }
  };

  // Navigate to profile
  const handleViewProfile = (username) => {
    navigate(`/profile/${username}`);
  };

  // Get save status indicator
  const getSaveStatus = (targetUsername) => {
    const status = savingNotes[targetUsername];
    switch (status) {
      case 'typing':
        return <span className="save-status typing">...</span>;
      case 'saving':
        return <span className="save-status saving">Saving...</span>;
      case 'saved':
        return <span className="save-status saved">✓ Saved</span>;
      case 'error':
        return <span className="save-status error">⚠ Error</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="profile-notes-container">
        <div className="notes-loading">Loading notes...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-notes-container">
        <div className="notes-error">{error}</div>
      </div>
    );
  }

  return (
    <div className="profile-notes-container">
      {/* Header */}
      <div className="notes-header">
        <h3>📝 Notes <span className="notes-count">{notes.length}</span></h3>
        <button 
          className="add-note-btn"
          onClick={() => showAddNote ? setShowAddNote(false) : handleShowAddNote()}
        >
          {showAddNote ? '✕ Cancel' : '+ Add Note'}
        </button>
      </div>

      {/* Add Note Dropdown */}
      {showAddNote && (
        <div className="add-note-dropdown">
          <label>Select a profile from your Messages, Favorites, or Shortlists:</label>
          {loadingProfiles ? (
            <div className="dropdown-loading">Loading profiles...</div>
          ) : availableProfiles.length === 0 ? (
            <div className="no-profiles">
              No profiles available. Add profiles to Messages, Favorites, or Shortlists first.
            </div>
          ) : (
            <>
              <select 
                value={selectedProfile} 
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="profile-select"
              >
                <option value="">-- Select a profile --</option>
                {availableProfiles.map(profile => (
                  <option key={profile.username} value={profile.username}>
                    {profile.displayName} ({profile.sources.join(', ')})
                  </option>
                ))}
              </select>
              <button 
                className="create-note-btn"
                onClick={handleCreateNote}
                disabled={!selectedProfile}
              >
                Create Note
              </button>
            </>
          )}
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="no-notes">
          <p>No notes yet.</p>
          <p>Add notes about profiles you're interested in!</p>
        </div>
      ) : (
        <div className="notes-list">
          {notes.map(note => (
            <div key={note.id} className={`note-card ${note.isExpiringSoon ? 'expiring-soon' : ''}`}>
              {/* Note Header */}
              <div className="note-header">
                <div 
                  className="profile-link"
                  onClick={() => handleViewProfile(note.targetUsername)}
                >
                  <span className="profile-icon">👤</span>
                  <span className="profile-name">{note.targetFirstName || note.targetUsername}</span>
                  <span className="arrow">→</span>
                </div>
                <div className="note-meta">
                  {note.isExpiringSoon ? (
                    <span className="expiry-warning">
                      ⚠️ Expires in {note.daysUntilExpiry} days
                    </span>
                  ) : (
                    <span className="updated-at">
                      Updated {formatTimeAgo(note.updatedAt)}
                    </span>
                  )}
                </div>
              </div>

              {/* Note Content */}
              <textarea
                className="note-textarea"
                value={note.note}
                onChange={(e) => handleNoteChange(note.targetUsername, e.target.value)}
                placeholder="Write your notes here..."
                rows={3}
              />

              {/* Note Footer */}
              <div className="note-footer">
                <div className="save-indicator">
                  {getSaveStatus(note.targetUsername)}
                </div>
                <div className="note-actions">
                  {deleteConfirm === note.targetUsername ? (
                    <>
                      <button 
                        className="confirm-delete-btn"
                        onClick={() => handleDeleteNote(note.targetUsername)}
                      >
                        Confirm Delete
                      </button>
                      <button 
                        className="cancel-delete-btn"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button 
                      className="delete-btn"
                      onClick={() => setDeleteConfirm(note.targetUsername)}
                    >
                      🗑️ Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Helper function to format time ago
function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return `${Math.floor(diffDays / 30)} months ago`;
}

export default ProfileNotes;
