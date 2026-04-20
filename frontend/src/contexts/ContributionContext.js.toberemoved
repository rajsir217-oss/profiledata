import React, { createContext, useCallback, useContext, useState } from 'react';
import useContributionPopup from '../hooks/useContributionPopup';

/**
 * ContributionContext
 *
 * Thin wrapper around the original `useContributionPopup` hook so its
 * eligibility + auto-popup business logic is preserved unchanged. The context
 * exists solely to:
 *   1. Deduplicate the hook call (was previously invoked in multiple components
 *      → now invoked ONCE here, shared via context)
 *   2. Expose an imperative `openPopup()` so banners can trigger the popup
 *      without navigating away.
 *   3. Provide a shared `dismissBanner()` + `bannerDismissed` flag so the
 *      profile banner and the footer banner share the same dismiss state
 *      per page-load (not persisted — that matches the prior per-component
 *      behavior, just scoped across multiple surfaces now).
 *
 * The original popup-dismiss semantics (writing `contribution_dismissed_at` to
 * localStorage inside `ContributionPopup.handleDismiss`) are untouched.
 */

const ContributionContext = createContext(null);

export const ContributionProvider = ({ children }) => {
  // Preserve the original business logic exactly — single hook instance.
  const hook = useContributionPopup();
  const [forcePopup, setForcePopup] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const openPopup = useCallback(() => setForcePopup(true), []);

  const closePopup = useCallback(() => {
    setForcePopup(false);
    hook.closePopup();
  }, [hook]);

  const dismissBanner = useCallback(() => {
    setBannerDismissed(true);
  }, []);

  const value = {
    // Auto-popup (from hook) OR imperatively opened via banner click.
    showPopup: hook.showPopup || forcePopup,
    openPopup,
    closePopup,
    contributionConfig: hook.contributionConfig,
    loading: hook.loading,
    // Banner visibility: eligible AND not dismissed in this session (in-memory).
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
    // Safe no-op fallback so accidental consumers outside the provider
    // don't crash the app.
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
