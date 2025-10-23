import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './NotificationManagement.css';
import Toast from './Toast';
import EventQueueManager from './EventQueueManager';
import TemplateManager from './TemplateManager';

const NotificationManagement = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('queue'); // 'queue' or 'templates'
  const [toast, setToast] = useState(null);

  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Notification Management by:', username);
      navigate('/dashboard');
    }
  }, [navigate]);

  const tabs = [
    { id: 'queue', label: '📋 Event Queue', icon: '📋' },
    { id: 'templates', label: '📧 Templates', icon: '📧' }
  ];

  return (
    <div className="notification-management">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      <div className="notification-management-header">
        <h1>🔔 Notification Management</h1>
        <p className="subtitle">Manage notification queue and email/SMS templates</p>
      </div>

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
