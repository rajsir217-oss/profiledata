import React, { useEffect } from 'react';
import ContributionPopup from './ContributionPopup';
import { useContribution } from '../contexts/ContributionContext';

/**
 * Wrapper component that renders the contribution popup.
 * All display logic lives in the original useContributionPopup hook (wrapped
 * by ContributionContext). This wrapper just:
 *  - subscribes to context state
 *  - forwards the `force-contribution-popup` window event (admin/test) to
 *    the context's openPopup() so the popup can be triggered imperatively.
 */
const ContributionPopupWrapper = () => {
  const { showPopup, closePopup, openPopup, contributionConfig } = useContribution();

  useEffect(() => {
    const handleForceShow = () => openPopup();
    window.addEventListener('force-contribution-popup', handleForceShow);
    return () => window.removeEventListener('force-contribution-popup', handleForceShow);
  }, [openPopup]);

  return (
    <ContributionPopup
      isOpen={showPopup}
      onClose={closePopup}
      contributionConfig={contributionConfig}
    />
  );
};

export default ContributionPopupWrapper;
