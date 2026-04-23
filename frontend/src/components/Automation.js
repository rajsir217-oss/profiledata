import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DynamicScheduler from './DynamicScheduler';
import NotificationManagement from './NotificationManagement';
import './Automation.css';

const Automation = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('scheduler');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Automation');
      navigate('/dashboard');
    }
  }, [navigate]);

  // Check for tab in URL query params
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/automation?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'scheduler', label: 'Dynamic Scheduler', icon: '🗓️', component: DynamicScheduler },
    { id: 'notifications', label: 'Notification Management', icon: '🔔', component: NotificationManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || DynamicScheduler;

  return (
    <div className="automation">
      <div className="automation-tabs">
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

      <div className="automation-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default Automation;
