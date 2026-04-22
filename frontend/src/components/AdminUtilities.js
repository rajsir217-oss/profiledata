import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import AdminBackups from './AdminBackups';
import WhatsAppVerification from './WhatsAppVerification';
import EmailTemplatePreview from './EmailTemplatePreview';
import NotificationConfigManager from './NotificationConfigManager';
import SavedSearchNotificationManager from './admin/SavedSearchNotificationManager';
import './AdminUtilities.css';

const AdminUtilities = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('backups');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Admin Utilities');
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
    navigate(`/admin-utilities?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'backups', label: 'Database Backups', icon: '💾', component: AdminBackups },
    { id: 'whatsapp', label: 'WhatsApp Verification', icon: '📱', component: WhatsAppVerification },
    { id: 'email-templates', label: 'Email Templates', icon: '✉️', component: EmailTemplatePreview },
    { id: 'notification-config', label: 'Notification Config', icon: '⚙️', component: NotificationConfigManager },
    { id: 'saved-search-notifications', label: 'Saved Search Notifications', icon: '📬', component: SavedSearchNotificationManager },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || AdminBackups;

  return (
    <div className="admin-utilities">
      <div className="au-tabs">
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

      <div className="au-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default AdminUtilities;
