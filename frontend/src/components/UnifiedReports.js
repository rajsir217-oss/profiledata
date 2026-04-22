import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ActivityLogs from './ActivityLogs';
import AdminReports from './AdminReports';
import PauseAnalyticsDashboard from './PauseAnalyticsDashboard';
import EmailAnalytics from './EmailAnalytics';
import InactiveUsersReport from './InactiveUsersReport';
import './UnifiedReports.css';

const UnifiedReports = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('activity-logs');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Unified Reports');
      navigate('/dashboard');
    }
  }, [navigate]);

  // Set document title
  React.useEffect(() => {
    document.title = '📊 Reports & Analytics - ProfileData';
  }, []);

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
    // Update URL without page reload
    navigate(`/unified-reports?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'activity-logs', label: 'Activity Logs', icon: '📝', component: ActivityLogs },
    { id: 'admin-reports', label: 'Admin Reports', icon: '📊', component: AdminReports },
    { id: 'email-analytics', label: 'Email Analytics', icon: '📮', component: EmailAnalytics },
    { id: 'inactive-users', label: 'Inactive Users', icon: '😴', component: InactiveUsersReport },
    { id: 'pause-analytics', label: 'Pause Analytics', icon: '⏸️', component: PauseAnalyticsDashboard },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ActivityLogs;

  return (
    <div className="unified-reports">
      <div className="reports-tabs">
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

      <div className="reports-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default UnifiedReports;
