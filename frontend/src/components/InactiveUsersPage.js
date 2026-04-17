import React, { useState, useEffect } from 'react';
import InactiveUsersReport from './InactiveUsersReport';
import './InactiveUsersPage.css';
import './InactiveUsersReport.css';

const InactiveUsersPage = () => {
  const [userRole, setUserRole] = useState('');

  useEffect(() => {
    // Check admin access
    const role = localStorage.getItem('userRole');
    setUserRole(role);
    
    if (role !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt to InactiveUsersPage');
      window.location.href = '/dashboard';
      return;
    }
  }, []);

  if (userRole !== 'admin') {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center', 
        color: 'var(--text-color)' 
      }}>
        <h2>Access Denied</h2>
        <p>You don't have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className="inactive-users-page">
      <InactiveUsersReport />
    </div>
  );
};

export default InactiveUsersPage;
