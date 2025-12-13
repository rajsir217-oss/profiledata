import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from './PageHeader';
import UniversalTabContainer from './UniversalTabContainer';
import './NotificationManagement.css';
import EventQueueManager from './EventQueueManager';
import TemplateManager from './TemplateManager';
import EventStatusLog from './EventStatusLog';
import EmailDeliveryLog from './EmailDeliveryLog';

const NotificationManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Check URL param for initial tab
  const tabParam = searchParams.get('tab');
  const defaultTab = tabParam === 'templates' ? 'templates' : 
                     tabParam === 'logs' ? 'logs' :
                     tabParam === 'delivery' ? 'delivery' : 'queue';

  // Admin-only protection
  useEffect(() => {
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
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
        actions={
          <button
            type="button"
            className="notification-management-scheduler-link"
            onClick={() => navigate('/dynamic-scheduler')}
          >
            🗓️ Dynamic Scheduler
          </button>
        }
        variant="gradient"
      />

      <UniversalTabContainer
        variant="underlined"
        defaultTab={defaultTab}
        tabs={[
          {
            id: 'queue',
            icon: '📋',
            label: 'EventQ',
            content: <EventQueueManager />
          },
          {
            id: 'logs',
            icon: '📜',
            label: 'Logs',
            content: <EventStatusLog />
          },
          {
            id: 'delivery',
            icon: '📬',
            label: 'DeliveryLog',
            content: <EmailDeliveryLog />
          },
          {
            id: 'templates',
            icon: '📧',
            label: 'MsgTempl',
            content: <TemplateManager />
          }
        ]}
      />
    </div>
  );
};

export default NotificationManagement;
