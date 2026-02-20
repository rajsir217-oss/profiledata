import React, { useState, useEffect } from 'react';
import InactiveUsersReport from './InactiveUsersReport';
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
    <div style={{ 
      padding: '20px',
      backgroundColor: 'var(--background-color)',
      minHeight: '100vh',
      color: 'var(--text-color)'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ 
          marginBottom: '30px',
          padding: '20px',
          backgroundColor: 'var(--surface-color)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <h1 style={{ 
            margin: '0 0 10px 0',
            color: 'var(--text-color)'
          }}>
            🔍 Admin: Inactive Users Report
          </h1>
          <p style={{ 
            margin: '0',
            color: 'var(--text-secondary)',
            fontSize: '14px'
          }}>
            Comprehensive report of inactive users with filtering, sorting, and engagement tools.
          </p>
        </div>
        
        <InactiveUsersReport />
      </div>
    </div>
  );
};

export default InactiveUsersPage;
