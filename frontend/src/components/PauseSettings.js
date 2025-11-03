import React, { useState } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './PauseSettings.css';

const PauseSettings = ({ isOpen, onClose, onPause, currentStatus }) => {
  const [duration, setDuration] = useState('manual');
  const [reason, setReason] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pauseReasons = [
    { value: '', label: 'Select a reason...' },
    { value: 'busy_work', label: '💼 Busy with work' },
    { value: 'traveling', label: '✈️ Traveling/Vacation' },
    { value: 'focusing_match', label: '💑 Focusing on current match' },
    { value: 'personal', label: '🏠 Personal reasons' },
    { value: 'mental_break', label: '🧘 Need a mental break' },
    { value: 'custom', label: '✏️ Other (specify below)' }
  ];

  const durationOptions = [
    { value: 'manual', label: 'Until I unpause' },
    { value: '3', label: '3 days' },
    { value: '7', label: '1 week' },
    { value: '14', label: '2 weeks' },
    { value: '30', label: '1 month' }
  ];

  const handlePause = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      
      // Call pause API directly with backend URL
      const response = await axios.post(
        `${getBackendUrl()}/api/account/pause`,
        {
          duration: duration === 'manual' ? null : parseInt(duration),
          reason: reason || null,
          message: customMessage.trim() || null
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      // Call success callback
      if (onPause) {
        onPause(response.data);
      }
      
      // Close modal
      onClose();
    } catch (err) {
      console.error('Error pausing account:', err);
      setError(err.response?.data?.detail || 'Failed to pause account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setDuration('manual');
    setReason('');
    setCustomMessage('');
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content pause-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>⏸️ Pause Your Profile</h2>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
          <p className="pause-description">
            Take a break from L3V3LMATCH. Here's what happens when you pause:
          </p>

          <div className="pause-effects">
            <div className="effect-item positive">
              <span className="icon">✅</span>
              <span>Your subscription stays active</span>
            </div>
            <div className="effect-item positive">
              <span className="icon">👀</span>
              <span>You can still view and edit your profile</span>
            </div>
            <div className="effect-item positive">
              <span className="icon">⏱️</span>
              <span>Un-pause anytime you want</span>
            </div>
            <div className="effect-item negative">
              <span className="icon">❌</span>
              <span>Hidden from all searches</span>
            </div>
            <div className="effect-item negative">
              <span className="icon">❌</span>
              <span>No new matches generated</span>
            </div>
            <div className="effect-item negative">
              <span className="icon">📩</span>
              <span>Existing chats become read-only</span>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <span className="icon">⚠️</span>
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="duration">How long?</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              disabled={loading}
            >
              {durationOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <small className="form-hint">
              {duration === 'manual' 
                ? 'You\'ll need to manually unpause when ready' 
                : `Your profile will automatically unpause after ${durationOptions.find(o => o.value === duration)?.label.toLowerCase()}`
              }
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="reason">Reason (optional)</label>
            <select
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={loading}
            >
              {pauseReasons.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <small className="form-hint">
              This helps us understand why users take breaks
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="message">Message for others (optional)</label>
            <textarea
              id="message"
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="e.g., 'Taking a break for work. Back soon!' or 'Traveling abroad, catch you later!'"
              maxLength={200}
              rows={3}
              disabled={loading}
            />
            <small className="form-hint">
              {customMessage.length}/200 characters
              {customMessage.length > 0 && ' • This message will be shown to others who try to contact you'}
            </small>
          </div>
        </div>

        <div className="modal-actions">
          <button 
            className="btn-secondary" 
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="btn-pause"
            onClick={handlePause}
            disabled={loading}
          >
            {loading ? 'Pausing...' : '⏸️ Pause My Profile'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PauseSettings;
