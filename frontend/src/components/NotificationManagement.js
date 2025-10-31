import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from './PageHeader';
import UniversalTabContainer from './UniversalTabContainer';
import './NotificationManagement.css';
import EventQueueManager from './EventQueueManager';
import TemplateManager from './TemplateManager';

const NotificationManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check URL param for initial tab
  const defaultTab = searchParams.get('tab') === 'templates' ? 'templates' : 'queue';

  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Notification Management by:', username);
      navigate('/dashboard');
    }
  }, [navigate]);

  return (
    <div className="notification-management">
      {/* Toast notifications handled by ToastContainer in App.js */}
      
      <PageHeader
        icon="🔔"
        title="Notification Management"
        subtitle="Manage notification queue and email/SMS event message templates"
        variant="gradient"
      />

      <UniversalTabContainer
        variant="underlined"
        defaultTab={defaultTab}
        tabs={[
          {
            id: 'queue',
            icon: '📋',
            label: 'Event Queue',
            content: <EventQueueManager />
          },
          {
            id: 'templates',
            icon: '📧',
            label: 'Event Message Templates',
            content: <TemplateManager />
          }
        ]}
      />
    </div>
  );
};

export default NotificationManagement;
