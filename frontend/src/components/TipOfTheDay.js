import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import './TipOfTheDay.css';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/register2', '/verify-email', '/verify-email-sent', '/forgot-password', '/terms', '/privacy', '/refund', '/community-guidelines', '/cookie-policy', '/l3v3l-info', '/help', '/about', '/trademark'];

/**
 * Tip of the Day Modal
 * Shows a rich-content tip with next/prev navigation.
 * Displays once per session; user can dismiss or browse tips.
 */
const TipOfTheDay = () => {
  const location = useLocation();
  const [tips, setTips] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchTips = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Don't show on public/login pages
      if (PUBLIC_ROUTES.includes(location.pathname)) return;

      // Check if already dismissed this session
      if (sessionStorage.getItem('tip_of_day_dismissed')) return;

      const res = await fetch(`${getBackendUrl()}/api/tips/by-category?help_only=false`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;

      const data = await res.json();
      // Flatten all categories into a single array of active ticker tips
      const allTips = [];
      if (data.tips) {
        Object.values(data.tips).forEach(catTips => {
          catTips.forEach(tip => allTips.push(tip));
        });
      }

      if (allTips.length === 0) return;

      // Start at today's tip (rotate by day-of-year)
      const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
      const startIndex = dayOfYear % allTips.length;

      setTips(allTips);
      setCurrentIndex(startIndex);
      setIsOpen(true);
    } catch (err) {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Delay showing the modal so the page loads first
    const timer = setTimeout(fetchTips, 2000);
    return () => clearTimeout(timer);
  }, [fetchTips]);

  const handleDismiss = () => {
    setIsOpen(false);
    sessionStorage.setItem('tip_of_day_dismissed', 'true');
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + tips.length) % tips.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % tips.length);
  };

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape') handleDismiss(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen || loading || tips.length === 0) return null;

  const tip = tips[currentIndex];

  return (
    <div className="totd-overlay" onClick={handleDismiss}>
      <div className="totd-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="totd-header">
          <div className="totd-header-left">
            <span className="totd-header-icon">💡</span>
            <h2>Tip of the Day</h2>
          </div>
          <button className="totd-close" onClick={handleDismiss}>✕</button>
        </div>

        {/* Content */}
        <div className="totd-body">
          <div className="totd-icon">{tip.icon || '💡'}</div>
          <div
            className="totd-content"
            dangerouslySetInnerHTML={{ __html: tip.tipText }}
          />
          {tip.link && tip.linkText && (
            <a href={tip.link} className="totd-cta" onClick={handleDismiss}>
              {tip.linkText} →
            </a>
          )}
        </div>

        {/* Footer with navigation */}
        <div className="totd-footer">
          <button className="totd-nav-btn" onClick={handlePrev} title="Previous tip">
            ← Prev
          </button>
          <span className="totd-counter">
            {currentIndex + 1} / {tips.length}
          </span>
          <button className="totd-nav-btn" onClick={handleNext} title="Next tip">
            Next →
          </button>
        </div>
      </div>
    </div>
  );
};

export default TipOfTheDay;
