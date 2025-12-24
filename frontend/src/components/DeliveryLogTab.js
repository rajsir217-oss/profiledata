import React, { useState } from 'react';
import EmailDeliveryLog from './EmailDeliveryLog';
import SMSDeliveryLog from './SMSDeliveryLog';
import './DeliveryLogTab.css';

/**
 * DeliveryLogTab - Container for Email and SMS delivery logs
 * Displays logs in sub-tabs for easy switching
 */
const DeliveryLogTab = () => {
  const [activeTab, setActiveTab] = useState('email');

  return (
    <div className="delivery-log-tab">
      <div className="delivery-sub-tabs">
        <button
          className={`sub-tab ${activeTab === 'email' ? 'active' : ''}`}
          onClick={() => setActiveTab('email')}
        >
          📧 Email Log
        </button>
        <button
          className={`sub-tab ${activeTab === 'sms' ? 'active' : ''}`}
          onClick={() => setActiveTab('sms')}
        >
          📱 SMS Log
        </button>
      </div>

      <div className="delivery-tab-content">
        {activeTab === 'email' && <EmailDeliveryLog />}
        {activeTab === 'sms' && <SMSDeliveryLog />}
      </div>
    </div>
  );
};

export default DeliveryLogTab;
