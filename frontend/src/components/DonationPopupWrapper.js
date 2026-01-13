import React, { useState, useEffect } from 'react';
import DonationPopup from './DonationPopup';
import useDonationPopup from '../hooks/useDonationPopup';

/**
 * Wrapper component that handles donation popup display logic
 * Should be rendered inside authenticated routes
 */
const DonationPopupWrapper = () => {
  const { showPopup, closePopup } = useDonationPopup();
  const [forceShow, setForceShow] = useState(false);

  // Listen for force-show event (for testing)
  useEffect(() => {
    const handleForceShow = () => {
      setForceShow(true);
    };
    
    window.addEventListener('force-donation-popup', handleForceShow);
    return () => window.removeEventListener('force-donation-popup', handleForceShow);
  }, []);

  const handleClose = () => {
    setForceShow(false);
    closePopup();
  };

  return (
    <DonationPopup 
      isOpen={showPopup || forceShow} 
      onClose={handleClose} 
    />
  );
};

export default DonationPopupWrapper;
