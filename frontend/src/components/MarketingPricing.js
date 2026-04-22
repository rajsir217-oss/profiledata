import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PromoCodeManager from './PromoCodeManager';
import PricingPage from './PricingPage';
import PromoCodeAccounting from './PromoCodeAccounting';
import './MarketingPricing.css';

const MarketingPricing = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('promo-codes');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Marketing & Pricing');
      navigate('/dashboard');
    }
  }, [navigate]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/marketing-pricing?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'promo-codes', label: 'Promo Codes', icon: '🎫', component: PromoCodeManager },
    { id: 'pricing', label: 'Pricing', icon: '💳', component: PricingPage },
    { id: 'lead-generation', label: 'Lead Generation', icon: '📈', component: PromoCodeAccounting },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || PromoCodeManager;

  return (
    <div className="marketing-pricing">
      <div className="mp-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => handleTabChange(tab.id)}
          >
            <span className="tab-icon">{tab.icon}</span>
            <span className="tab-label">{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="mp-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default MarketingPricing;
