import { useState, useEffect, useCallback, useRef } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import { isModeratorOrAdmin } from '../utils/permissions';
import { isSilenceActive, silenceDaysRemaining } from '../utils/contributionSilence';
import logger from '../utils/logger';

/**
 * Hook: useContributionPopup
 *
 * Business logic (gates evaluated in order):
 *   1. User is logged in.
 *   2. User is NOT admin or moderator  (staff roles excluded).
 *   3. Site-wide contributions are enabled.
 *   4. This user is NOT individually disabled by an admin.
 *   5. User is NOT inside the amount-tier silence window (see
 *      `utils/contributionSilence.js`). The more they donated, the longer
 *      we stay quiet.
 *
 * If all gates pass:
 *   - `shouldShowContribution` becomes true  → banners become visible.
 *   - The popup auto-opens ONCE per browser session. Once the user dismisses
 *     the popup (sessionStorage flag), it stays closed for the rest of the
 *     session. The banner stays visible regardless of the popup's session
 *     state — only the amount-tier silence can hide the banner.
 */

const SESSION_POPUP_DISMISSED = 'contribution_popup_dismissed_session';
const SESSION_POPUP_SHOWN     = 'contribution_popup_shown_session';
// Small settle delay so the popup doesn't interrupt the page render.
const POPUP_DELAY_MS = 1500;

const useContributionPopup = () => {
  const [showPopup, setShowPopup] = useState(false);
  const [shouldShowContribution, setShouldShowContribution] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contributionConfig, setContributionConfig] = useState(null);
  const popupTimeoutRef = useRef(null);

  const checkEligibility = useCallback(async () => {
    // Reset at the top so re-runs can REVOKE eligibility (e.g., after a
    // successful payment the silence window is now active).
    setShouldShowContribution(false);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      // Gate: staff roles are excluded (also skips the API call).
      if (isModeratorOrAdmin()) {
        setLoading(false);
        return;
      }

      const response = await fetch(`${getBackendUrl()}/api/contributions/contribution-status`, {
        headers: { Authorization: `Bearer ${token}` }
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

      // Config is needed by <ContributionPopup /> regardless of eligibility.
      setContributionConfig(data.popupConfig);

      // Gate: site-level enabled (strict True).
      if (!data.siteEnabled) {
        setLoading(false);
        return;
      }
      // Gate: admin disabled this particular user.
      if (data.userDisabledByAdmin) {
        setLoading(false);
        return;
      }

      // Gate: inside amount-tier silence window.
      if (
        isSilenceActive(
          data.lastContributionDate,
          data.lastRecurringPaymentDate,
          data.lastContributionAmount
        )
      ) {
        const remaining = silenceDaysRemaining(
          data.lastContributionDate,
          data.lastRecurringPaymentDate,
          data.lastContributionAmount
        );
        logger.debug(
          `🔔 Contribution: silenced for ${remaining}d ` +
          `(last amount: $${data.lastContributionAmount || 0})`
        );
        setLoading(false);
        return;
      }

      // Eligible — banners activate.
      setShouldShowContribution(true);

      // Popup: auto-show ONCE per browser session.
      // sessionStorage is cleared on browser close → fresh session every time.
      if (sessionStorage.getItem(SESSION_POPUP_DISMISSED)) {
        // User already dismissed the popup this session — keep banners, no popup.
        logger.debug('🔔 Contribution: popup dismissed this session, banners only');
        setLoading(false);
        return;
      }
      if (sessionStorage.getItem(SESSION_POPUP_SHOWN)) {
        // Already auto-shown once this session — don't re-trigger.
        setLoading(false);
        return;
      }

      logger.debug('🔔 Contribution: showing popup');
      sessionStorage.setItem(SESSION_POPUP_SHOWN, '1');
      setShowPopup(true);
    } catch (err) {
      logger.error('🔔 Contribution: eligibility check failed', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const scheduleCheck = useCallback((delay) => {
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      checkEligibility();
      popupTimeoutRef.current = null;
    }, delay);
  }, [checkEligibility]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) scheduleCheck(POPUP_DELAY_MS);

    const handleUserLoggedIn = () => {
      // Fresh login → clear per-session popup state so the popup can show once.
      sessionStorage.removeItem(SESSION_POPUP_DISMISSED);
      sessionStorage.removeItem(SESSION_POPUP_SHOWN);
      scheduleCheck(POPUP_DELAY_MS);
    };

    // Fired by payment-success handlers. Re-checks eligibility so the banner
    // disappears immediately after a contribution (silence window now active).
    const handleContributionMade = () => {
      // Popup-shown flag kept as-is; the silence gate will block it anyway.
      scheduleCheck(500);
    };

    window.addEventListener('userLoggedIn', handleUserLoggedIn);
    window.addEventListener('contributionMade', handleContributionMade);
    return () => {
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      window.removeEventListener('userLoggedIn', handleUserLoggedIn);
      window.removeEventListener('contributionMade', handleContributionMade);
    };
  }, [scheduleCheck]);

  // Closing the popup silences it for the rest of the browser session.
  // Banners remain visible (they only respect the amount-tier silence).
  const closePopup = useCallback(() => {
    sessionStorage.setItem(SESSION_POPUP_DISMISSED, '1');
    setShowPopup(false);
  }, []);

  // Imperative open (e.g., banner "Contribute Now" click). Ignores the
  // session-dismissed flag so a deliberate click always opens the popup.
  const openPopup = useCallback(() => setShowPopup(true), []);

  return {
    showPopup,
    shouldShowContribution,
    closePopup,
    openPopup,
    loading,
    contributionConfig,
  };
};

export default useContributionPopup;
