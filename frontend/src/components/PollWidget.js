import React, { useState, useEffect } from 'react';
import { createApiInstance } from '../api';
import { formatDate, getTimeRemaining, formatTimeRemaining } from '../utils/timezoneHelper';
import Toast from './Toast';
import PollPaymentInline from './PollPaymentInline';
import './PollWidget.css';

// Use global API factory for session handling
const pollsApi = createApiInstance();

/**
 * PollWidget - Displays active polls for users to respond to
 * Shows on dashboard as a card widget or inline with stat cards
 * @param {boolean} inline - If true, renders in compact inline mode
 * @param {boolean} autoPopup - If true, automatically shows modal for unanswered polls on mount
 */
const PollWidget = ({ onPollResponded, inline = false, renderPlaceholder = null, autoPopup = false }) => {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState({});
  const [selectedOptions, setSelectedOptions] = useState({});
  const [comments, setComments] = useState({});
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false); // Modal state for inline mode
  const [selectedPollId, setSelectedPollId] = useState(null); // Which poll to show in modal
  const [autoPopupShown, setAutoPopupShown] = useState(false); // Track if auto-popup was shown this session
  const [timers, setTimers] = useState({}); // Store countdown timers for each poll
  
  // Payment state for Virtual Meet polls
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentPendingPoll, setPaymentPendingPoll] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  // Debug payment state
  console.log('🔍 Payment state:', { paymentModalOpen, paymentPendingPoll });
  
  // Check if user is admin
  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'admin';

  // Update timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      const newTimers = {};
      polls.forEach(poll => {
        // Combine date and time for accurate countdown
        let targetDate = null;
        
        if (poll.end_date && poll.end_time) {
          // Combine end_date and end_time
          const dateStr = new Date(poll.end_date).toISOString().split('T')[0];
          targetDate = `${dateStr}T${poll.end_time}`;
        } else if (poll.event_date && poll.event_time) {
          // Fall back to event_date and event_time
          const dateStr = new Date(poll.event_date).toISOString().split('T')[0];
          targetDate = `${dateStr}T${poll.event_time}`;
        } else if (poll.end_date) {
          targetDate = poll.end_date;
        } else if (poll.event_date) {
          targetDate = poll.event_date;
        }
        
        if (targetDate) {
          const remaining = getTimeRemaining(targetDate);
          newTimers[poll._id] = remaining;
        }
      });
      setTimers(newTimers);
    }, 1000);

    return () => clearInterval(interval);
  }, [polls]);

  useEffect(() => {
    fetchActivePolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        
        // Auto-popup logic: Show modal for first unanswered poll on EVERY login
        // Keep showing until user responds - no session tracking needed
        if (autoPopup && !autoPopupShown && response.data.polls.length > 0) {
          const unansweredPoll = response.data.polls.find(p => !p.user_has_responded);
          if (unansweredPoll) {
            // Show the modal automatically for unanswered polls
            setSelectedPollId(unansweredPoll._id);
            setShowModal(true);
            setAutoPopupShown(true);
          }
        }
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
    const poll = polls.find(p => p._id === pollId);
    const selectedOption = poll?.options?.find(opt => opt.id === optionId);
    const optionText = selectedOption?.text?.toLowerCase() || '';
    
    console.log('🔍 Poll Debug:', {
      pollId,
      optionId,
      pollType,
      optionText,
      eventType: poll?.event_type,
      userResponded: poll?.user_has_responded
    });
    
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
        const newSelection = [optionId];
        
        // Check if this is a "Yes" selection for a Virtual Meet poll
        if (poll?.event_type && 
            ['in-person', 'virtual', 'zoom-call', 'hybrid'].includes(poll.event_type) && 
            optionText.includes('yes') &&
            !poll?.user_has_responded) {
          
          console.log('💳 Showing inline payment for:', poll?.event_type);
          
          // Show inline payment for Virtual Meet "Yes" selection
          setPaymentPendingPoll({
            pollId: pollId,
            optionId: optionId,
            paymentAmount: poll.virtual_meet_payment_amount || 5.00,
            pollTitle: poll.title
          });
          setPaymentModalOpen(true);
        }
        
        return { ...prev, [pollId]: newSelection };
      }
    });
  };

  const handlePaymentComplete = async () => {
    // VirtualMeetPaymentModal handles payment confirmation with backend
    // We just need to update the UI and refresh polls
    showToast('RSVP confirmed with payment!', 'success');
    
    // Close payment modal
    setPaymentModalOpen(false);
    setPaymentPendingPoll(null);
    
    // Refresh polls to show updated response
    fetchActivePolls();
    
    if (onPollResponded) {
      onPollResponded(paymentPendingPoll?.pollId);
    }
  };

  const handlePaymentCancel = () => {
    setPaymentModalOpen(false);
    setPaymentPendingPoll(null);
    // Clear the selection since payment was cancelled
    if (paymentPendingPoll) {
      setSelectedOptions(prev => {
        const newPrev = { ...prev };
        delete newPrev[paymentPendingPoll.pollId];
        return newPrev;
      });
    }
  };

  const handleSubmitResponse = async (pollId) => {
    const selected = selectedOptions[pollId] || [];
    
    if (selected.length === 0) {
      showToast('Please select an option', 'error');
      return;
    }

    // Check if this is a Virtual Meet poll with "Yes" selection
    const poll = polls.find(p => p._id === pollId);
    const selectedOption = poll?.options?.find(opt => opt.id === selected[0]);
    const optionText = selectedOption?.text?.toLowerCase() || '';
    
    if (poll?.event_type && 
        ['in-person', 'virtual', 'zoom-call', 'hybrid'].includes(poll.event_type) && 
        optionText.includes('yes') &&
        !poll?.user_has_responded) {
      
      // Don't submit directly - payment is required
      showToast('Payment required to confirm "Yes" response', 'warning');
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
        
        // Close modal after successful submission
        closePollModal();
        
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

  // Use timezone helper for date formatting
  const formatEventDate = (dateStr) => {
    return formatDate(dateStr, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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

  // Navigate to previous poll in modal
  const goToPrevPoll = (e) => {
    e.stopPropagation();
    const currentIndex = polls.findIndex(p => p._id === selectedPollId);
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : polls.length - 1;
    setSelectedPollId(polls[prevIndex]._id);
  };

  // Navigate to next poll in modal
  const goToNextPoll = (e) => {
    e.stopPropagation();
    const currentIndex = polls.findIndex(p => p._id === selectedPollId);
    const nextIndex = currentIndex < polls.length - 1 ? currentIndex + 1 : 0;
    setSelectedPollId(polls[nextIndex]._id);
  };

  // Get current poll index for display
  const getCurrentPollIndex = () => {
    return polls.findIndex(p => p._id === selectedPollId) + 1;
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
  // eslint-disable-next-line no-unused-vars
  const firstPollSelectedText = getSelectedOptionText(firstPoll);

  // Render poll form content (used in both modal and non-inline mode)
  const renderPollForm = (poll) => {
    const isResponded = poll.user_has_responded;
    
    return (
      <>
        {poll.description && (
          <div className="poll-description" dangerouslySetInnerHTML={{ __html: poll.description }} />
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
        
        {/* Poll Options */}
        {poll.options && (
          <div className="poll-options">
            {poll.options.map(option => {
              const isSelected = (selectedOptions[poll._id] || []).includes(option.id);
              const wasSelected = poll.user_response?.selected_options?.includes(option.id);
              const rsvpResponse = poll.user_response?.rsvp_response || '';
              const isPaidYesResponse = rsvpResponse.toLowerCase() === 'yes' && 
                                       option.text.toLowerCase().includes('yes') && 
                                       poll.payment_status === 'completed';
              
              return (
                <div key={option.id}>
                  <button
                    className={`poll-option ${isSelected ? 'poll-option-selected' : ''} ${wasSelected ? 'poll-option-was-selected' : ''} ${isPaidYesResponse ? 'poll-option-paid' : ''}`}
                    onClick={() => handleOptionSelect(poll._id, option.id, poll.poll_type)}
                    disabled={submitting[poll._id] || isPaidYesResponse}
                  >
                    <span className="poll-option-indicator">
                      {isSelected ? '●' : '○'}
                    </span>
                    <span className="poll-option-text">{option.text}</span>
                    {isPaidYesResponse && <span className="paid-badge">✓ Paid</span>}
                  </button>
                  
                  {/* Show payment component right after "Yes" option when selected */}
                  {isSelected && 
                   option.text.toLowerCase().includes('yes') && 
                   paymentPendingPoll?.pollId === poll._id && (
                    <PollPaymentInline
                      isVisible={true}
                      onCancel={handlePaymentCancel}
                      onComplete={handlePaymentComplete}
                      pollData={paymentPendingPoll}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        {/* Show user's response if already responded */}
        {isResponded && poll.user_response && (
          <div className="poll-user-response">
            <strong>Your response:</strong> {poll.user_response.rsvp_response || poll.user_response.selected_options?.map(optId => poll.options?.find(o => o.id === optId)?.text).filter(Boolean).join(', ') || 'Submitted'}
            {poll.payment_status === 'completed' && (
              <span className="paid-badge">✓ Paid</span>
            )}
          </div>
        )}
        
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
        
        {/* Countdown Timer */}
        {timers[poll._id] && (
          <div className="poll-timer">
            {timers[poll._id].expired ? (
              <div className="poll-timer-expired">
                <span className="poll-timer-icon">⏰</span>
                <span className="poll-timer-text">Poll has ended</span>
              </div>
            ) : (
              <div className="poll-timer-active">
                <span className="poll-timer-icon">⏱️</span>
                <span className="poll-timer-text">
                  Time remaining: <strong>
                    {timers[poll._id].days > 0 && `${timers[poll._id].days}d `}
                    {timers[poll._id].hours > 0 && `${timers[poll._id].hours}h `}
                    {timers[poll._id].minutes > 0 && `${timers[poll._id].minutes}m `}
                    {timers[poll._id].days === 0 && timers[poll._id].hours === 0 && `${timers[poll._id].seconds}s`}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
        
        {poll.event_details && (
          <div className="poll-event-extra">
            {poll.event_details}
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
          <span className="stat-label-mobile">Poll</span>
          <div className="stat-content-compact">
            <span className="stat-label-compact">POLL</span>
            {firstPollResponded && (
              <span className="stat-sublabel-compact" style={{ color: 'var(--success-color, #10b981)' }}>
                ✓
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
                {/* Navigation arrow - previous */}
                {polls.length > 1 && (
                  <button className="poll-nav-btn poll-nav-prev" onClick={goToPrevPoll} title="Previous poll">
                    ‹
                  </button>
                )}
                <div className="poll-modal-title">
                  <span className="poll-icon">🔔</span>
                  <h2>{selectedPoll.title}</h2>
                </div>
                {selectedPoll.user_has_responded && (
                  <span className="poll-responded-badge">✓ Responded</span>
                )}
                {/* Poll count indicator */}
                {polls.length > 1 && (
                  <span className="poll-count-badge">{getCurrentPollIndex()}/{polls.length}</span>
                )}
                {isAdmin && (
                  <button 
                    className="poll-edit-btn"
                    onClick={() => window.open(`/poll-management?edit=${selectedPoll._id}`, '_blank')}
                    title="Edit poll in admin panel"
                  >
                    ✏️
                  </button>
                )}
                {/* Navigation arrow - next */}
                {polls.length > 1 && (
                  <button className="poll-nav-btn poll-nav-next" onClick={goToNextPoll} title="Next poll">
                    ›
                  </button>
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
              {isAdmin && (
                <button 
                  className="poll-edit-btn"
                  onClick={() => window.open(`/poll-management?edit=${poll._id}`, '_blank')}
                  title="Edit poll in admin panel"
                >
                  ✏️
                </button>
              )}
            </div>
            {renderPollForm(poll)}
          </div>
        );
      })}
    </div>
  );
};

export default PollWidget;
