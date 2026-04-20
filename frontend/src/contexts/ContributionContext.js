import React, { createContext, useCallback, useContext, useState } from 'react';
import useContributionPopup from '../hooks/useContributionPopup';

/**
 * ContributionContext
 *
 * Thin wrapper around `useContributionPopup` that:
 *   1. Ensures a single eligibility check is shared across all consumers
 *      (popup wrapper, profile banner, footer banner).
 *   2. Adds an in-memory `bannerDismissed` flag for the current page view.
 *      This is NOT persisted — a full page reload resets it (the amount-tier
 *      silence remains the long-term gate).
 *
 * Semantics (matches the agreed business rule):
 *   - Banner visibility  = eligible AND not just-dismissed-in-memory
 *   - Popup visibility   = auto-shown once per browser session (hook-driven),
 *     OR imperatively opened via `openPopup()` (e.g. banner button click).
 *     Closing the popup flags it dismissed for the rest of the session (hook).
 */

const ContributionContext = createContext(null);

export const ContributionProvider = ({ children }) => {
  const hook = useContributionPopup();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Banner ✕ hides both banners until next page load / navigation remount.
  // (Silence is governed by the amount-tier rule in the hook, not here.)
  const dismissBanner = useCallback(() => setBannerDismissed(true), []);

  const value = {
    showPopup: hook.showPopup,
    openPopup: hook.openPopup,
    closePopup: hook.closePopup,
    contributionConfig: hook.contributionConfig,
    loading: hook.loading,
    shouldShowContribution: hook.shouldShowContribution && !bannerDismissed,
    bannerDismissed,
    dismissBanner,
  };

  return (
    <ContributionContext.Provider value={value}>
      {children}
    </ContributionContext.Provider>
  );
};

export const useContribution = () => {
  const ctx = useContext(ContributionContext);
  if (!ctx) {
    return {
      showPopup: false,
      openPopup: () => {},
      closePopup: () => {},
      contributionConfig: null,
      loading: false,
      shouldShowContribution: false,
      bannerDismissed: false,
      dismissBanner: () => {},
    };
  }
  return ctx;
};

export default ContributionContext;
