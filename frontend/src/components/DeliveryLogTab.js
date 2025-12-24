import React from 'react';
import EmailDeliveryLog from './EmailDeliveryLog';
import SMSDeliveryLog from './SMSDeliveryLog';

/**
 * DeliveryLogTab - Container for Email and SMS delivery logs
 * Displays both logs in a single tab view
 */
const DeliveryLogTab = () => {
  return (
    <div className="delivery-log-tab">
      <EmailDeliveryLog />
      <SMSDeliveryLog />
    </div>
  );
};

export default DeliveryLogTab;
