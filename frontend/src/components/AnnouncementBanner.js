import React, { useState, useEffect } from 'react';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './AnnouncementBanner.css';

// Use global API factory for session handling
const announcementsApi = createApiInstance(`${getBackendUrl()}/api`);

/**
 * AnnouncementBanner Component
 * Displays active announcements as a marquee banner at the top of the page
 */
const AnnouncementBanner = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    // Only load announcements if user is authenticated
    const token = localStorage.getItem('token');
    if (token) {
      loadAnnouncements();
    } else {
      setLoading(false);
    }
  }, []);

  // Rotate through announcements every 8 seconds
  useEffect(() => {
    if (announcements.length <= 1) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % announcements.length);
    }, 8000);

    return () => clearInterval(timer);
  }, [announcements.length]);

  const loadAnnouncements = async () => {
    try {
      const response = await announcementsApi.get('/announcements/active');
      setAnnouncements(response.data);
    } catch (error) {
      logger.error('Error loading announcements:', error);
      // Fail silently - don't show error to user
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (announcementId) => {
    try {
      await announcementsApi.post(`/announcements/dismiss/${announcementId}`);
      // Remove from local state
      setAnnouncements(prev => prev.filter(a => a.id !== announcementId));
      // Adjust current index if needed
      if (currentIndex >= announcements.length - 1) {
        setCurrentIndex(0);
      }
    } catch (error) {
      logger.error('Error dismissing announcement:', error);
    }
  };

  const handleLinkClick = (announcement) => {
    if (announcement.link) {
      window.location.href = announcement.link;
    }
  };

  if (loading || announcements.length === 0) {
    return null;
  }

  const announcement = announcements[currentIndex];

  // Type-based styling
  const getTypeClass = (type) => {
    const typeMap = {
      info: 'banner-info',
      warning: 'banner-warning',
      error: 'banner-error',
      success: 'banner-success',
      maintenance: 'banner-maintenance',
      promotion: 'banner-promotion'
    };
    return typeMap[type] || 'banner-info';
  };

  // Priority-based icon
  const getPriorityIcon = (priority) => {
    const iconMap = {
      low: '💬',
      medium: '📢',
      high: '⚠️',
      urgent: '🚨'
    };
    return iconMap[priority] || '📢';
  };

  return (
    <div className={`announcement-banner ${getTypeClass(announcement.type)}`}>
      <div className="banner-content">
        {/* Priority Icon */}
        <span className="banner-icon">
          {announcement.icon || getPriorityIcon(announcement.priority)}
        </span>

        {/* Message */}
        <div className="banner-message">
          <span>{announcement.message}</span>
          
          {/* Link Button */}
          {announcement.link && announcement.linkText && (
            <button
              className="banner-link-button"
              onClick={() => handleLinkClick(announcement)}
            >
              {announcement.linkText} →
            </button>
          )}
        </div>

        {/* Pagination Dots (if multiple announcements) */}
        {announcements.length > 1 && (
          <div className="banner-dots">
            {announcements.map((_, index) => (
              <span
                key={index}
                className={`dot ${index === currentIndex ? 'active' : ''}`}
                onClick={() => setCurrentIndex(index)}
              />
            ))}
          </div>
        )}

        {/* Dismiss Button */}
        {announcement.dismissible && (
          <button
            className="banner-dismiss"
            onClick={() => handleDismiss(announcement.id)}
            aria-label="Dismiss announcement"
            title="Dismiss"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default AnnouncementBanner;
