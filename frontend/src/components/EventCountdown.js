import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './EventCountdown.css';

/**
 * EventCountdown - Shows countdown timer for events user RSVPed "Yes" to
 * Displays in the topbar center area
 * Supports multiple events with navigation
 */
const EventCountdown = () => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);
  const [countdown, setCountdown] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPollModal, setShowPollModal] = useState(false);

  // ESC key handler to close modal
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showPollModal) {
        setShowPollModal(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showPollModal]);

  // Fetch polls user responded "Yes" to
  useEffect(() => {
    const fetchRsvpEvents = async () => {
      // Only fetch if user is logged in
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      try {
        const backendUrl = getBackendUrl();
        const response = await axios.get(`${backendUrl}/api/polls/active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success && response.data.polls) {
          // Find polls where user responded "Yes" (first option is typically "Yes, I can join!")
          const yesPolls = response.data.polls.filter(poll => {
            if (!poll.user_has_responded || !poll.user_response?.selected_options?.length) {
              return false;
            }
            // Check if user selected the first option (Yes)
            const selectedOptionId = poll.user_response.selected_options[0];
            const selectedOption = poll.options.find(opt => opt.id === selectedOptionId);
            // Check if it's a "Yes" type response
            return selectedOption?.text?.toLowerCase().includes('yes') || 
                   selectedOption?.text?.toLowerCase().includes('can join');
          });

          // Find all upcoming events with dates
          const eventsWithDates = yesPolls
            .filter(poll => poll.event_date)
            .map(poll => {
              // Parse event_date and apply timezone from event_time if specified
              let eventDateTime;
              try {
                // Start with the base date
                eventDateTime = new Date(poll.event_date);
                
                // If event_time contains timezone info (e.g., "7am pst"), adjust the time
                if (poll.event_time) {
                  const timeStr = poll.event_time.toLowerCase();
                  
                  // Extract hour from time string (e.g., "7am" -> 7, "2pm" -> 14)
                  const hourMatch = timeStr.match(/(\d+)\s*(am|pm)/i);
                  if (hourMatch) {
                    let hour = parseInt(hourMatch[1]);
                    const isPM = hourMatch[2].toLowerCase() === 'pm';
                    if (isPM && hour !== 12) hour += 12;
                    if (!isPM && hour === 12) hour = 0;
                    
                    // Check for timezone and convert to UTC
                    // PST = UTC-8, PDT = UTC-7, EST = UTC-5, EDT = UTC-4, etc.
                    let tzOffset = 0;
                    if (timeStr.includes('pst')) tzOffset = 8;
                    else if (timeStr.includes('pdt')) tzOffset = 7;
                    else if (timeStr.includes('est')) tzOffset = 5;
                    else if (timeStr.includes('edt')) tzOffset = 4;
                    else if (timeStr.includes('cst')) tzOffset = 6;
                    else if (timeStr.includes('cdt')) tzOffset = 5;
                    else if (timeStr.includes('mst')) tzOffset = 7;
                    else if (timeStr.includes('mdt')) tzOffset = 6;
                    
                    // Set the correct time in UTC
                    // If event is 7am PST, that's 7 + 8 = 15:00 UTC
                    const utcHour = hour + tzOffset;
                    eventDateTime.setUTCHours(utcHour, 0, 0, 0);
                  }
                }
                
                // Check if date is valid
                if (isNaN(eventDateTime.getTime())) {
                  return null;
                }
              } catch (err) {
                console.error('🔔 EventCountdown: Error parsing date:', err);
                return null;
              }
              return {
                ...poll,
                eventDateTime
              };
            })
            .filter(poll => poll && poll.eventDateTime > new Date()) // Only future events
            .sort((a, b) => a.eventDateTime - b.eventDateTime);

          setUpcomingEvents(eventsWithDates);
        }
      } catch (err) {
        console.error('Error fetching RSVP events:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRsvpEvents();
  }, []);

  // Get current event
  const currentEvent = upcomingEvents[currentEventIndex];

  // Navigate between events
  const goToPrevEvent = (e) => {
    e.stopPropagation();
    setCurrentEventIndex(prev => (prev > 0 ? prev - 1 : upcomingEvents.length - 1));
  };

  const goToNextEvent = (e) => {
    e.stopPropagation();
    setCurrentEventIndex(prev => (prev < upcomingEvents.length - 1 ? prev + 1 : 0));
  };

  // Update countdown every second
  useEffect(() => {
    if (!currentEvent?.eventDateTime) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = currentEvent.eventDateTime - now;

      if (diff <= 0) {
        setCountdown({ expired: true });
        // Auto-open the poll modal when timer reaches 0
        setShowPollModal(true);
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setCountdown({ days, hours, minutes, seconds });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [currentEvent]);

  // Don't render if loading, no events, or event expired
  if (loading || upcomingEvents.length === 0 || !currentEvent || !countdown || countdown.expired) {
    return null;
  }

  // Format numbers with leading zeros
  const pad = (num) => String(num).padStart(2, '0');

  // Build countdown string in format: 03:14:32:15
  const countdownStr = countdown.days > 0
    ? `${pad(countdown.days)}:${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`
    : `${pad(countdown.hours)}:${pad(countdown.minutes)}:${pad(countdown.seconds)}`;

  // Handle click to open poll modal
  const handleCountdownClick = () => {
    setShowPollModal(true);
  };

  // Render poll form content (same as PollWidget)
  const renderPollModal = () => {
    if (!showPollModal || !currentEvent) return null;
    
    return (
      <div className="poll-modal-overlay" onClick={() => setShowPollModal(false)}>
        <div className="poll-modal" onClick={(e) => e.stopPropagation()}>
          <div className="poll-modal-header">
            {/* Navigation arrow - previous */}
            {upcomingEvents.length > 1 && (
              <button className="poll-nav-btn" onClick={goToPrevEvent} title="Previous event">
                ‹
              </button>
            )}
            <div className="poll-modal-title">
              <span className="poll-icon">🔔</span>
              <h2>{currentEvent.title}</h2>
            </div>
            <span className="poll-responded-badge">✓ Responded</span>
            {/* Event count indicator */}
            {upcomingEvents.length > 1 && (
              <span className="poll-count-badge">{currentEventIndex + 1}/{upcomingEvents.length}</span>
            )}
            {/* Navigation arrow - next */}
            {upcomingEvents.length > 1 && (
              <button className="poll-nav-btn" onClick={goToNextEvent} title="Next event">
                ›
              </button>
            )}
            <button className="poll-modal-close" onClick={() => setShowPollModal(false)}>✕</button>
          </div>
          <div className="poll-modal-body">
            {currentEvent.description && (
              <p className="poll-description">{currentEvent.description}</p>
            )}
            
            {/* Event Details */}
            <div className="poll-event-details">
              {currentEvent.event_date && (
                <div className="poll-event-item">
                  <span className="poll-event-icon">📅</span>
                  <span>{new Date(currentEvent.event_date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}</span>
                </div>
              )}
              {currentEvent.event_time && (
                <div className="poll-event-item">
                  <span className="poll-event-icon">🕐</span>
                  <span>{currentEvent.event_time}</span>
                </div>
              )}
              {currentEvent.event_location && (
                <div className="poll-event-item">
                  <span className="poll-event-icon">📍</span>
                  <span>{currentEvent.event_location}</span>
                </div>
              )}
            </div>
            
            {/* Countdown display */}
            <div className="poll-countdown-display">
              <span className="countdown-label">Event starts in:</span>
              <span className="countdown-timer-large">{countdownStr}</span>
            </div>
            
            {/* Your response */}
            <div className="poll-your-response">
              <span className="response-label">Your response:</span>
              <span className="response-value">✓ Yes, I can join!</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <div 
        className="event-countdown-container" 
        title={`${currentEvent.title} - Click to view details`}
        onClick={handleCountdownClick}
        style={{ cursor: 'pointer' }}
      >
        {/* Navigation arrow for multiple events */}
        {upcomingEvents.length > 1 && (
          <button className="countdown-nav-btn" onClick={goToPrevEvent} title="Previous event">
            ‹
          </button>
        )}
        
        <div className="event-countdown-inner">
          <span className="event-countdown-icon">🔔</span>
          <span className="event-countdown-label">Event:</span>
          <span className="event-countdown-name">{currentEvent.title}</span>
          <span className="event-countdown-text">in</span>
          <span className="event-countdown-timer">{countdownStr}</span>
        </div>
        
        {/* Navigation arrow for multiple events */}
        {upcomingEvents.length > 1 && (
          <button className="countdown-nav-btn" onClick={goToNextEvent} title="Next event">
            ›
          </button>
        )}
        
        {/* Event count indicator */}
        {upcomingEvents.length > 1 && (
          <span className="event-count-badge">{currentEventIndex + 1}/{upcomingEvents.length}</span>
        )}
      </div>
      
      {/* Poll Modal */}
      {renderPollModal()}
    </>
  );
};

export default EventCountdown;
