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
              // Parse event_date + event_time (HH:MM) + event_timezone
              let eventDateTime;
              try {
                // Get the date part (YYYY-MM-DD)
                const baseDate = new Date(poll.event_date);
                const dateStr = baseDate.toISOString().split('T')[0]; // "2026-03-29"
                
                if (poll.event_time) {
                  // event_time is in HH:MM format (e.g., "14:32")
                  const timeParts = poll.event_time.split(':');
                  const hour = parseInt(timeParts[0]) || 0;
                  const minute = parseInt(timeParts[1]) || 0;
                  
                  // Get timezone offset based on event_timezone or end_timezone
                  const tz = poll.event_timezone || 'America/Los_Angeles';
                  const tzOffsets = {
                    'America/Los_Angeles': -7, // PDT (summer) / -8 PST (winter)
                    'America/Denver': -6,      // MDT / -7 MST
                    'America/Chicago': -5,     // CDT / -6 CST
                    'America/New_York': -4,    // EDT / -5 EST
                    'America/Phoenix': -7,     // MST (no DST)
                    'Pacific/Honolulu': -10,   // HST
                    'America/Anchorage': -8,   // AKDT / -9 AKST
                    'UTC': 0
                  };
                  
                  // Use Intl to get accurate offset for the specific date
                  let offsetMinutes;
                  try {
                    const testDate = new Date(`${dateStr}T${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}:00`);
                    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
                    const parts = formatter.formatToParts(testDate);
                    const offsetPart = parts.find(p => p.type === 'timeZoneName');
                    if (offsetPart) {
                      const match = offsetPart.value.match(/GMT([+-]\d+)/);
                      if (match) {
                        offsetMinutes = parseInt(match[1]) * 60;
                      }
                    }
                  } catch (e) {
                    // Fallback to static offsets
                    const fallbackOffset = tzOffsets[tz] || -7;
                    offsetMinutes = fallbackOffset * 60;
                  }
                  
                  if (offsetMinutes === undefined) {
                    const fallbackOffset = tzOffsets[tz] || -7;
                    offsetMinutes = fallbackOffset * 60;
                  }
                  
                  // Create UTC time: local time - offset = UTC
                  const totalMinutes = hour * 60 + minute - offsetMinutes;
                  const utcHour = Math.floor(totalMinutes / 60);
                  const utcMinute = totalMinutes % 60;
                  
                  eventDateTime = new Date(`${dateStr}T00:00:00Z`);
                  eventDateTime.setUTCHours(utcHour, utcMinute, 0, 0);
                } else {
                  // No time specified, use midnight UTC
                  eventDateTime = new Date(`${dateStr}T00:00:00Z`);
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
              <div className="poll-description" dangerouslySetInnerHTML={{ __html: currentEvent.description }} />
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
                  <span>
                    {(() => {
                      // Format HH:MM to readable time
                      const parts = currentEvent.event_time.split(':');
                      if (parts.length === 2) {
                        let h = parseInt(parts[0]);
                        const m = parts[1];
                        const ampm = h >= 12 ? 'PM' : 'AM';
                        if (h > 12) h -= 12;
                        if (h === 0) h = 12;
                        const tzLabels = {
                          'America/Los_Angeles': 'PT', 'America/Denver': 'MT',
                          'America/Chicago': 'CT', 'America/New_York': 'ET',
                          'America/Phoenix': 'MST', 'Pacific/Honolulu': 'HST',
                          'America/Anchorage': 'AKT', 'UTC': 'UTC'
                        };
                        const tzLabel = tzLabels[currentEvent.event_timezone] || '';
                        return `${h}:${m} ${ampm}${tzLabel ? ` ${tzLabel}` : ''}`;
                      }
                      return currentEvent.event_time;
                    })()}
                  </span>
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
