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
        console.log('🔔 Contribution popup: No token, skipping');
        setLoading(false);
        return;
      }

      // Check if dismissed this session
      if (sessionStorage.getItem('contribution_dismissed')) {
        console.log('🔔 Contribution popup: Dismissed this session');
        setLoading(false);
        return;
      }

      // Check remind cooldown
      const remindAt = localStorage.getItem('contribution_remind_at');
      if (remindAt && Date.now() < parseInt(remindAt)) {
        console.log('🔔 Contribution popup: In remind cooldown until', new Date(parseInt(remindAt)));
        setLoading(false);
        return;
      }

      // Fetch contribution status from backend
      console.log('🔔 Contribution popup: Fetching status from backend...');
      const response = await fetch(`${getBackendUrl()}/api/stripe/contribution-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        console.log('🔔 Contribution popup: Backend response not OK:', response.status);
        setLoading(false);
        return;
      }

      const data = await response.json();
      console.log('🔔 Contribution popup: Backend data:', data);

      if (!data.success) {
        console.log('🔔 Contribution popup: Backend returned success=false');
        setLoading(false);
        return;
      }

      setContributionConfig(data.popupConfig);

      // Check site-level enabled (default: disabled)
      if (!data.siteEnabled) {
        console.log('🔔 Contribution popup: Site-level disabled');
        setLoading(false);
        return;
      }

      // Check if admin disabled for this user
      if (data.userDisabledByAdmin) {
        console.log('🔔 Contribution popup: Admin disabled for this user');
        setLoading(false);
        return;
      }

      // Check if user has active recurring contribution
      if (data.hasActiveRecurringContribution) {
        console.log('🔔 Contribution popup: User has active recurring contribution');
        setLoading(false);
        return;
      }

      // Check login count
      const loginCount = parseInt(localStorage.getItem('login_count') || '0');
      const minLogins = data.popupConfig?.minLogins || 3;
      console.log('🔔 Contribution popup: Login count check:', loginCount, '>=', minLogins);
      if (loginCount < minLogins) {
        console.log('🔔 Contribution popup: Not enough logins');
        setLoading(false);
        return;
      }

      // Check frequency (for users who never contributed)
      const lastPopupShown = localStorage.getItem('contribution_popup_last_shown');
      const frequencyDays = data.popupConfig?.frequencyDays || 14;
      
      if (!data.lastContributionDate && lastPopupShown) {
        const daysSincePopup = (Date.now() - parseInt(lastPopupShown)) / (1000 * 60 * 60 * 24);
        console.log('🔔 Contribution popup: Days since last popup:', daysSincePopup, 'frequency:', frequencyDays);
        if (daysSincePopup < frequencyDays) {
          console.log('🔔 Contribution popup: Too soon since last popup');
          setLoading(false);
          return;
        }
      }

      // Check if one-time contributor (remind after 30 days)
      if (data.lastContributionDate && !data.hasActiveRecurringContribution) {
        const daysSinceContribution = (Date.now() - new Date(data.lastContributionDate).getTime()) / (1000 * 60 * 60 * 24);
        console.log('🔔 Contribution popup: Days since contribution:', daysSinceContribution);
        if (daysSinceContribution < 30) {
          console.log('🔔 Contribution popup: Recent one-time contributor');
          setLoading(false);
          return;
        }
      }

      // All checks passed - show popup
      console.log('🔔 Contribution popup: ✅ All checks passed, showing popup!');
      setShowPopup(true);
      localStorage.setItem('contribution_popup_last_shown', Date.now().toString());

    } catch (error) {
      console.error('🔔 Contribution popup: Error:', error);
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
