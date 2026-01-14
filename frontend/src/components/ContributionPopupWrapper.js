import React, { useState, useEffect } from 'react';
import ContributionPopup from './ContributionPopup';
import useContributionPopup from '../hooks/useContributionPopup';

/**
 * Wrapper component that handles contribution popup display logic
 * Should be rendered inside authenticated routes
 */
const ContributionPopupWrapper = () => {
  const { showPopup, closePopup } = useContributionPopup();
  const [forceShow, setForceShow] = useState(false);

  // Listen for force-show event (for testing)
  useEffect(() => {
    const handleForceShow = () => {
      setForceShow(true);
    };
    
    window.addEventListener('force-contribution-popup', handleForceShow);
    return () => window.removeEventListener('force-contribution-popup', handleForceShow);
  }, []);

  const handleClose = () => {
    setForceShow(false);
    closePopup();
  };

  return (
    <ContributionPopup 
      isOpen={showPopup || forceShow} 
      onClose={handleClose} 
    />
  );
};

export default ContributionPopupWrapper;
