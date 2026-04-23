import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ContactUs from './ContactUs';
import AdminContactManagement from './AdminContactManagement';
import './Support.css';

const Support = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('contact-us');

  // Admin-only access check for admin tab
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin' && activeTab === 'admin-contact') {
      console.warn('⚠️ Unauthorized access attempt to Admin Contact tab');
      setActiveTab('contact-us');
    }
  }, [activeTab]);

  // Check for tab in URL query params
  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [location.search]);

  const handleTabChange = (tab) => {
    const userRole = localStorage.getItem('userRole');
    if (tab === 'admin-contact' && userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Admin Contact tab');
      return;
    }
    setActiveTab(tab);
    navigate(`/support?tab=${tab}`, { replace: true });
  };

  const userRole = localStorage.getItem('userRole');
  const isAdmin = userRole === 'admin';

  const tabs = [
    { id: 'contact-us', label: 'Contact Us', icon: '📨', component: ContactUs },
  ];

  if (isAdmin) {
    tabs.push({ id: 'admin-contact', label: 'Contact Management', icon: '📧', component: AdminContactManagement });
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ContactUs;

  return (
    <div className="support">
      <div className="support-tabs">
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

      <div className="support-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default Support;
