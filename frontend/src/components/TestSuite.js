import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { TestDashboard } from '../test-dashboard';
import NotificationTester from './NotificationTester';
import './TestSuite.css';

const TestSuite = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('test-dashboard');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Test Suite');
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
    navigate(`/test-suite?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'test-dashboard', label: 'Test Dashboard', icon: '🧪', component: TestDashboard },
    { id: 'notification-tester', label: 'Notification Tester', icon: '🔔', component: NotificationTester },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || TestDashboard;

  return (
    <div className="test-suite">
      <div className="ts-tabs">
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

      <div className="ts-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default TestSuite;
