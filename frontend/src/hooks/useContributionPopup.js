import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../config/apiConfig';

/**
 * Hook to manage contribution popup display logic
 * 
 * Shows popup when:
 * - Site-level contribution is enabled (default: disabled)
 * - User is not disabled by admin
 * - User doesn't have active recurring contribution
 * - User has logged in 3+ times (configurable)
 * - Cooldown period has passed (remind me next week)
 * - Not dismissed this session
 */
const useContributionPopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contributionConfig, setContributionConfig] = useState(null);

  const checkShouldShowPopup = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Check if dismissed this session
      if (sessionStorage.getItem('contribution_dismissed')) {
        setLoading(false);
        return;
      }

      // Check remind cooldown
      const remindAt = localStorage.getItem('contribution_remind_at');
      if (remindAt && Date.now() < parseInt(remindAt)) {
        setLoading(false);
        return;
      }

      // Fetch contribution status from backend
      const response = await fetch(`${getBackendUrl()}/api/stripe/contribution-status`, {
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

      setContributionConfig(data.popupConfig);

      // Check site-level enabled (default: disabled)
      if (!data.siteEnabled) {
        setLoading(false);
        return;
      }

      // Check if admin disabled for this user
      if (data.userDisabledByAdmin) {
        setLoading(false);
        return;
      }

      // Check if user has active recurring contribution
      if (data.hasActiveRecurringContribution) {
        setLoading(false);
        return;
      }

      // Check login count
      const loginCount = parseInt(localStorage.getItem('login_count') || '0');
      const minLogins = data.popupConfig?.minLogins || 3;
      if (loginCount < minLogins) {
        setLoading(false);
        return;
      }

      // Check frequency (for users who never contributed)
      const lastPopupShown = localStorage.getItem('contribution_popup_last_shown');
      const frequencyDays = data.popupConfig?.frequencyDays || 14;
      
      if (!data.lastContributionDate && lastPopupShown) {
        const daysSincePopup = (Date.now() - parseInt(lastPopupShown)) / (1000 * 60 * 60 * 24);
        if (daysSincePopup < frequencyDays) {
          setLoading(false);
          return;
        }
      }

      // Check if one-time contributor (remind after 30 days)
      if (data.lastContributionDate && !data.hasActiveRecurringContribution) {
        const daysSinceContribution = (Date.now() - new Date(data.lastContributionDate).getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceContribution < 30) {
          setLoading(false);
          return;
        }
      }

      // All checks passed - show popup
      setShowPopup(true);
      localStorage.setItem('contribution_popup_last_shown', Date.now().toString());

    } catch (error) {
      console.error('Error checking contribution popup:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Increment login count
    const loginCount = parseInt(localStorage.getItem('login_count') || '0');
    localStorage.setItem('login_count', (loginCount + 1).toString());

    // Check if should show popup (with small delay to not block initial render)
    const timer = setTimeout(() => {
      checkShouldShowPopup();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkShouldShowPopup]);

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
