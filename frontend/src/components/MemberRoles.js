import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserManagement from './UserManagement';
import RoleManagement from './RoleManagement';
import './MemberRoles.css';

const MemberRoles = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('users');

  // Admin-only access check
  React.useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to Member Roles');
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
    navigate(`/member-roles?tab=${tab}`, { replace: true });
  };

  const tabs = [
    { id: 'users', label: 'User Management', icon: '👥', component: UserManagement },
    { id: 'roles', label: 'Role Management', icon: '🎭', component: RoleManagement },
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || UserManagement;

  return (
    <div className="member-roles">
      <div className="mr-tabs">
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

      <div className="mr-content">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default MemberRoles;
