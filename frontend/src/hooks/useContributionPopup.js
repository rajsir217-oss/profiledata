import { useState, useEffect, useCallback, useRef } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import { hasRecentPayment } from '../utils/dateUtils';

/**
 * Simplified hook to manage contribution popup display logic
 * 
 * Shows popup when:
 * - User is logged in
 * - Has NOT paid in the last 30 days
 */
const useContributionPopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contributionConfig, setContributionConfig] = useState(null);
  const popupTimeoutRef = useRef(null);

  const checkShouldShowPopup = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Fetch contribution status from backend
      const response = await fetch(`${getBackendUrl()}/api/contributions/contribution-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      if (!data.success) {
        setLoading(false);
        return;
      }

      // Store config for popup component
      setContributionConfig(data.popupConfig);

      // Check if site-level is enabled
      if (!data.siteEnabled) {
        setLoading(false);
        return;
      }

      // Check if admin disabled for this user
      if (data.userDisabledByAdmin) {
        setLoading(false);
        return;
      }

      // CORE LOGIC: Check if user paid in last 30 days
      if (hasRecentPayment(data.lastContributionDate, data.lastRecurringPaymentDate, 30)) {
        console.log('🔔 Contribution popup: User paid recently, skipping');
        setLoading(false);
        return;
      }

      // Check if dismissed this session
      if (sessionStorage.getItem('contribution_dismissed')) {
        console.log('🔔 Contribution popup: Dismissed this session');
        setLoading(false);
        return;
      }

      // All checks passed - show popup
      console.log('🔔 Contribution popup: ✅ Showing popup!');
      setShowPopup(true);
      localStorage.setItem('contribution_popup_last_shown', Date.now().toString());

    } catch (error) {
      console.error('🔔 Contribution popup: Error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Schedule popup check with race condition protection
  const schedulePopupCheck = useCallback((delay) => {
    // Cancel any pending check
    if (popupTimeoutRef.current) {
      clearTimeout(popupTimeoutRef.current);
    }
    
    popupTimeoutRef.current = setTimeout(() => {
      checkShouldShowPopup();
      popupTimeoutRef.current = null;
    }, delay);
  }, [checkShouldShowPopup]);

  useEffect(() => {
    // Check on mount if already logged in
    const token = localStorage.getItem('token');
    if (token) {
      // Small delay to allow page to load
      schedulePopupCheck(1000);
    }

    // Listen for login event
    const handleUserLoggedIn = () => {
      // Increment login count
      const loginCount = parseInt(localStorage.getItem('login_count') || '0');
      localStorage.setItem('login_count', (loginCount + 1).toString());

      // Show popup immediately after login (no 30s delay needed)
      schedulePopupCheck(500);
    };

    window.addEventListener('userLoggedIn', handleUserLoggedIn);

    return () => {
      // Cleanup
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
      }
      window.removeEventListener('userLoggedIn', handleUserLoggedIn);
    };
  }, [schedulePopupCheck]);

  const closePopup = useCallback(() => {
    setShowPopup(false);
  }, []);

  return {
    showPopup,
    closePopup,
    loading,
    contributionConfig
  };
};

export default useContributionPopup;
