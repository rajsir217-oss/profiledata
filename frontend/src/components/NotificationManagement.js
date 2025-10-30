import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from './PageHeader';
import './NotificationManagement.css';
import EventQueueManager from './EventQueueManager';
import TemplateManager from './TemplateManager';

const NotificationManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL param for initial tab
    const tabParam = searchParams.get('tab');
    return tabParam === 'templates' ? 'templates' : 'queue';
  });

  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Notification Management by:', username);
      navigate('/dashboard');
    }
  }, [navigate]);

  const tabs = [
    { id: 'queue', label: 'Event Queue', icon: '📋' },
    { id: 'templates', label: 'Templates', icon: '📧' }
  ];

  return (
    <div className="notification-management">
      {/* Toast notifications handled by ToastContainer in App.js */}
      
      <PageHeader
        icon="🔔"
        title="Notification Management"
        subtitle="Manage notification queue and email/SMS templates"
        variant="gradient"
      />

      {/* Tab Navigation */}
      <div className="tabs-container">
        <div className="tabs">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="tab-icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'queue' && <EventQueueManager />}
        {activeTab === 'templates' && <TemplateManager />}
      </div>
    </div>
  );
};

export default NotificationManagement;
