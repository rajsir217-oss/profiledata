import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './PollWidget.css';

// Create axios instance for polls API (uses /api/polls, not /api/users)
const pollsApi = axios.create();
pollsApi.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * PollWidget - Displays active polls for users to respond to
 * Shows on dashboard as a card widget or inline with stat cards
 * @param {boolean} inline - If true, renders in compact inline mode
 */
const PollWidget = ({ onPollResponded, inline = false, renderPlaceholder = null }) => {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [comments, setComments] = useState({});
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false); // Modal state for inline mode
  const [selectedPollId, setSelectedPollId] = useState(null); // Which poll to show in modal

  useEffect(() => {
    fetchActivePolls();
  }, []);

  const fetchActivePolls = async () => {
    try {
      setLoading(true);
      const response = await pollsApi.get('/api/polls/active');
      if (response.data.success) {
        setPolls(response.data.polls || []);
        
        // Initialize selected options for polls user hasn't responded to
        const initialSelections = {};
        response.data.polls.forEach(poll => {
          if (poll.user_response) {
            initialSelections[poll._id] = poll.user_response.selected_options || [];
          }
        });
        setSelectedOptions(initialSelections);
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError('Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleOptionSelect = (pollId, optionId, pollType) => {
    setSelectedOptions(prev => {
      const current = prev[pollId] || [];
      
      if (pollType === 'multiple_choice') {
        // Toggle option for multiple choice
        if (current.includes(optionId)) {
          return { ...prev, [pollId]: current.filter(id => id !== optionId) };
        } else {
          return { ...prev, [pollId]: [...current, optionId] };
        }
      } else {
        // Single selection for RSVP and single choice
        return { ...prev, [pollId]: [optionId] };
      }
    });
  };

  const handleSubmitResponse = async (pollId) => {
    const selected = selectedOptions[pollId] || [];
    
    if (selected.length === 0) {
      showToast('Please select an option', 'error');
      return;
    }

    try {
      setSubmitting(prev => ({ ...prev, [pollId]: true }));
      
      const poll = polls.find(p => p._id === pollId);
      const isUpdate = poll?.user_has_responded;
      
      const payload = {
        poll_id: pollId,
        selected_options: selected,
        comment: comments[pollId] || null
      };

      let response;
      if (isUpdate) {
        response = await pollsApi.put(`/api/polls/${pollId}/respond`, payload);
      } else {
        response = await pollsApi.post(`/api/polls/${pollId}/respond`, payload);
      }

      if (response.data.success) {
        showToast(isUpdate ? 'Response updated!' : 'Response submitted!', 'success');
        
        // Refresh polls to update UI
        await fetchActivePolls();
        
        // Notify parent if callback provided
        if (onPollResponded) {
          onPollResponded(pollId);
        }
      }
    } catch (err) {
      console.error('Error submitting response:', err);
      showToast(err.response?.data?.detail || 'Failed to submit response', 'error');
    } finally {
      setSubmitting(prev => ({ ...prev, [pollId]: false }));
    }
  };

  const formatEventDate = (dateStr) => {
    if (!dateStr) return null;
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // ESC key handler for modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showModal) {
        setShowModal(false);
        setSelectedPollId(null);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showModal]);

  const openPollModal = (pollId) => {
    setSelectedPollId(pollId);
    setShowModal(true);
  };

  const closePollModal = () => {
    setShowModal(false);
    setSelectedPollId(null);
  };

  const getSelectedOptionText = (poll) => {
    if (!poll.user_response?.selected_options?.length) return null;
    const selectedIds = poll.user_response.selected_options;
    const selectedTexts = poll.options
      .filter(opt => selectedIds.includes(opt.id))
      .map(opt => opt.text);
    return selectedTexts.join(', ');
  };

  if (loading) {
    if (inline) return null; // Don't show loading state in inline mode
    return (
      <div className="poll-widget poll-widget-loading">
        <div className="poll-loading-spinner"></div>
        <span>Loading polls...</span>
      </div>
    );
  }

  if (error) {
    if (inline) return null; // Don't show error in inline mode
    return (
      <div className="poll-widget poll-widget-error">
        <span className="poll-error-icon">⚠️</span>
        <span>{error}</span>
        <button onClick={fetchActivePolls} className="poll-retry-btn">Retry</button>
      </div>
    );
  }

  if (polls.length === 0) {
    // Show placeholder if provided, otherwise return null
    if (renderPlaceholder) {
      return renderPlaceholder();
    }
    return null;
  }

  // Get the first poll for inline display (most recent/active)
  const firstPoll = polls[0];
  const firstPollResponded = firstPoll?.user_has_responded;
  const firstPollSelectedText = getSelectedOptionText(firstPoll);

  // Render poll form content (used in both modal and non-inline mode)
  const renderPollForm = (poll) => {
    const isResponded = poll.user_has_responded;
    
    return (
      <>
        {poll.description && (
          <p className="poll-description">{poll.description}</p>
        )}
        
        {/* Event Details for RSVP polls */}
        {poll.poll_type === 'rsvp' && (poll.event_date || poll.event_time || poll.event_location) && (
          <div className="poll-event-details">
            {poll.event_date && (
              <div className="poll-event-item">
                <span className="poll-event-icon">📅</span>
                <span>{formatEventDate(poll.event_date)}</span>
              </div>
            )}
            {poll.event_time && (
              <div className="poll-event-item">
                <span className="poll-event-icon">🕐</span>
                <span>{poll.event_time}</span>
              </div>
            )}
            {poll.event_location && (
              <div className="poll-event-item">
                <span className="poll-event-icon">📍</span>
                <span>{poll.event_location}</span>
              </div>
            )}
          </div>
        )}
        
        {poll.event_details && (
          <div className="poll-event-extra">
            {poll.event_details}
          </div>
        )}
        
        {/* Poll Options */}
        <div className="poll-options">
          {poll.options.map(option => {
            const isSelected = (selectedOptions[poll._id] || []).includes(option.id);
            const wasSelected = poll.user_response?.selected_options?.includes(option.id);
            
            return (
              <button
                key={option.id}
                className={`poll-option ${isSelected ? 'poll-option-selected' : ''} ${wasSelected ? 'poll-option-was-selected' : ''}`}
                onClick={() => handleOptionSelect(poll._id, option.id, poll.poll_type)}
                disabled={submitting[poll._id]}
              >
                <span className="poll-option-indicator">
                  {isSelected ? '●' : '○'}
                </span>
                <span className="poll-option-text">{option.text}</span>
              </button>
            );
          })}
        </div>
        
        {/* Comment field if allowed */}
        {poll.allow_comments && (
          <div className="poll-comment-section">
            <textarea
              className="poll-comment-input"
              placeholder="Add a comment (optional)..."
              value={comments[poll._id] || ''}
              onChange={(e) => setComments(prev => ({ ...prev, [poll._id]: e.target.value }))}
              disabled={submitting[poll._id]}
              rows={2}
            />
          </div>
        )}
        
        {/* Submit Button */}
        <div className="poll-actions">
          <button
            className="poll-submit-btn"
            onClick={() => handleSubmitResponse(poll._id)}
            disabled={submitting[poll._id] || (selectedOptions[poll._id] || []).length === 0}
          >
            {submitting[poll._id] ? (
              <>
                <span className="poll-btn-spinner"></span>
                Submitting...
              </>
            ) : isResponded ? (
              'Update Response'
            ) : (
              'Submit Response'
            )}
          </button>
        </div>
        
        {/* Info about contact collection */}
        {poll.collect_contact_info && !isResponded && (
          <p className="poll-info-text">
            ℹ️ Your contact information will be shared with the organizer
          </p>
        )}
      </>
    );
  };

  // INLINE MODE: Show compact stat card + modal
  if (inline) {
    const selectedPoll = polls.find(p => p._id === selectedPollId);
    
    return (
      <>
        {/* Compact stat card */}
        <div 
          className="stat-card-compact stat-card-poll clickable-card"
          onClick={() => openPollModal(firstPoll._id)}
          title="Click to view/respond to poll"
        >
          <div className="stat-icon-compact">🔔</div>
          <div className="stat-content-compact">
            <span className="stat-label-compact">POLL</span>
            {firstPollResponded && (
              <span className="stat-sublabel-compact" style={{ color: 'var(--success-color, #10b981)' }}>
                ✓ Responded
              </span>
            )}
          </div>
          {!firstPollResponded && (
            <span className="poll-badge-new">NEW</span>
          )}
        </div>

        {/* Poll Modal */}
        {showModal && selectedPoll && (
          <div className="poll-modal-overlay" onClick={closePollModal}>
            <div className="poll-modal" onClick={(e) => e.stopPropagation()}>
              <div className="poll-modal-header">
                <div className="poll-modal-title">
                  <span className="poll-icon">🔔</span>
                  <h2>{selectedPoll.title}</h2>
                </div>
                {selectedPoll.user_has_responded && (
                  <span className="poll-responded-badge">✓ Responded</span>
                )}
                <button className="poll-modal-close" onClick={closePollModal}>✕</button>
              </div>
              <div className="poll-modal-body">
                {renderPollForm(selectedPoll)}
              </div>
            </div>
          </div>
        )}

        {/* Toast notifications */}
        {toast && (
          <div className={`poll-toast poll-toast-${toast.type}`}>
            {toast.type === 'success' ? '✓' : '✕'} {toast.message}
          </div>
        )}
      </>
    );
  }

  // NON-INLINE MODE: Show full poll widget (original behavior)
  return (
    <div className="poll-widget-container">
      {toast && (
        <div className={`poll-toast poll-toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : '✕'} {toast.message}
        </div>
      )}
      
      {polls.map(poll => {
        const isResponded = poll.user_has_responded;
        
        return (
          <div key={poll._id} className={`poll-widget ${isResponded ? 'poll-responded' : ''}`}>
            <div className="poll-header">
              <div className="poll-icon">🔔</div>
              <div className="poll-header-content">
                <h3 className="poll-title">{poll.title}</h3>
                {isResponded && (
                  <span className="poll-responded-badge">✓ Responded</span>
                )}
              </div>
            </div>
            {renderPollForm(poll)}
          </div>
        );
      })}
    </div>
  );
};

export default PollWidget;
