import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UniversalTabContainer from './UniversalTabContainer';
import './NotificationManagement.css';
import EventQueueManager from './EventQueueManager';
import TemplateManager from './TemplateManager';
import EventStatusLog from './EventStatusLog';
import DeliveryLogTab from './DeliveryLogTab';

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

  // Force width via JavaScript as backup
  useEffect(() => {
    const element = document.querySelector('.notification-management');
    if (element) {
      element.style.width = '98%';
      element.style.maxWidth = '98%';
      element.style.margin = '0 auto';
      
      // Also try to force parent containers
      const parent = element.parentElement;
      if (parent) {
        parent.style.width = '98%';
        parent.style.maxWidth = '98%';
        parent.style.margin = '0 auto';
      }
      
      // Force tab containers to use full width
      const tabContainer = element.querySelector('.universal-tab-container');
      if (tabContainer) {
        tabContainer.style.width = '100%';
        tabContainer.style.maxWidth = '100%';
      }
      
      const tabContentArea = element.querySelector('.tab-content-area');
      if (tabContentArea) {
        tabContentArea.style.width = '100%';
        tabContentArea.style.maxWidth = '100%';
      }
      
      const tabPanels = element.querySelectorAll('.tab-panel');
      tabPanels.forEach(panel => {
        panel.style.width = '100%';
        panel.style.maxWidth = '100%';
      });
      
      // Force all nested components
      const nestedComponents = element.querySelectorAll('.event-queue-manager, .template-manager, .event-status-log, .delivery-log-tab');
      nestedComponents.forEach(comp => {
        comp.style.width = '100%';
        comp.style.maxWidth = '100%';
      });
    }
  }, []);

  return (
    <div 
      className="notification-management"
      style={{
        width: '98%',
        maxWidth: '98%',
        margin: '0 auto'
      }}
    >
      {/* Toast notifications handled by ToastContainer in App.js */}
      
      <button
        type="button"
        className="notification-management-scheduler-link"
        onClick={() => navigate('/dynamic-scheduler')}
      >
        🗓️ Dynamic Scheduler
      </button>

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
            content: <DeliveryLogTab />
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
