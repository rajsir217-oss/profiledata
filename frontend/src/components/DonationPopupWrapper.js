import React from 'react';
import DonationPopup from './DonationPopup';
import useDonationPopup from '../hooks/useDonationPopup';

/**
 * Wrapper component that handles donation popup display logic
 * Should be rendered inside authenticated routes
 */
const DonationPopupWrapper = () => {
  const { showPopup, closePopup } = useDonationPopup();

  return (
    <DonationPopup 
      isOpen={showPopup} 
      onClose={closePopup} 
    />
  );
};

export default DonationPopupWrapper;
