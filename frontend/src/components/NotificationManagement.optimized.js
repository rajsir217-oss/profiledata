/**
 * Optimized NotificationManagement Component
 * 
 * Optimizations:
 * - Centralized admin authentication
 * - Memoized tab configuration
 * - Reduced re-renders
 * - Better error handling
 */

import React, { useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UniversalTabContainer from './UniversalTabContainer';
import './NotificationManagement.css';
import EventQueueManager from './EventQueueManager.optimized';
import TemplateManager from './TemplateManager';
import EventStatusLog from './EventStatusLog';
import DeliveryLogTab from './DeliveryLogTab';
import useAdminAuth from '../hooks/useAdminAuth';

const NotificationManagement = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Centralized admin authentication
  useAdminAuth();
  
  // Memoized tab configuration to prevent recreation on every render
  const tabs = useMemo(() => [
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
  ], []);

  // Memoized default tab calculation
  const defaultTab = useMemo(() => {
    const tabParam = searchParams.get('tab');
    return tabParam === 'templates' ? 'templates' : 
           tabParam === 'logs' ? 'logs' :
           tabParam === 'delivery' ? 'delivery' : 'queue';
  }, [searchParams]);

  // Memoized navigation handler
  const handleSchedulerNavigation = useMemo(() => () => {
    navigate('/dynamic-scheduler');
  }, [navigate]);

  return (
    <div className="notification-management">
      {/* Toast notifications handled by ToastContainer in App.js */}
      
      <button
        type="button"
        className="notification-management-scheduler-link"
        onClick={handleSchedulerNavigation}
      >
        🗓️ Dynamic Scheduler
      </button>

      <UniversalTabContainer
        variant="underlined"
        defaultTab={defaultTab}
        tabs={tabs}
      />
    </div>
  );
};

export default NotificationManagement;
