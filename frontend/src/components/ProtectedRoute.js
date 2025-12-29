// frontend/src/components/ProtectedRoute.js
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../api';

const ProtectedRoute = ({ children }) => {
  // Check token synchronously on initial render - BEFORE any hooks
  const initialToken = localStorage.getItem('token');
  
  // DEBUG: Log token check
  console.log('🔒 ProtectedRoute RENDER - initialToken:', initialToken ? 'EXISTS' : 'NULL');
  
  // IMMEDIATE REDIRECT: If no token, redirect using window.location (most reliable)
  if (!initialToken) {
    console.warn('🔒 ProtectedRoute: No token found - forcing redirect to login');
    window.location.href = '/login';
    return null; // Return null while redirecting
  }
  
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const location = useLocation();
  
  // DEBUG: Log state
  console.log('🔒 ProtectedRoute STATE - loading:', loading);

  useEffect(() => {
    const checkUserStatus = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      
      // Check for missing token - redirect to login
      if (!token) {
        console.warn('🔒 ProtectedRoute useEffect: No token - redirecting to login');
        window.location.href = '/login';
        return;
      }
      
      if (!username) {
        setLoading(false);
        return;
      }

      setCurrentUsername(username);

      try {
        // Fetch user profile to get status (pass requester to avoid PII masking)
        const response = await api.get(`/profile/${username}?requester=${username}`);
        console.log('🔍 Full profile response:', response.data);
        
        // CRITICAL FIX: Use accountStatus (unified field), not legacy status.status
        const status = response.data.accountStatus || 'pending';
        console.log('🔍 accountStatus value:', status);
        
        // Normalize status to lowercase for comparison
        const normalizedStatus = status.toLowerCase();
        console.log('🔍 Normalized status:', normalizedStatus);
        setUserStatus(normalizedStatus);
      } catch (error) {
        console.error('Error fetching user status:', error);
        
        // If 401 error (session expired), clear auth data and redirect
        if (error.response?.status === 401) {
          console.warn('🔒 ProtectedRoute: Session expired, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userRole');
          setCurrentUsername(null); // This will trigger redirect to login
        } else {
          // For other errors, default to pending
          setUserStatus('pending');
        }
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [location.pathname]); // Re-check on route change

  
  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: 'var(--text-color)'
      }}>
        Loading...
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!currentUsername) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is trying to access their own profile
  const isOwnProfile = location.pathname === `/profile/${currentUsername}`;
  const isEditProfile = location.pathname === '/edit-profile';
  const isPreferences = location.pathname === '/preferences';
  const isNotifications = location.pathname === '/notifications';
  
  // Allow access to own profile, edit profile, preferences, and notifications regardless of status
  if (isOwnProfile || isEditProfile || isPreferences || isNotifications) {
    return children;
  }

  // If user status is not active, redirect to their profile with a message
  if (userStatus !== 'active') {
    // Store a message in sessionStorage to show on profile page
    sessionStorage.setItem('statusMessage', 
      `Your account status is "${userStatus}". Please complete your profile and wait for admin approval to access other features.`
    );
    return <Navigate to={`/profile/${currentUsername}`} replace />;
  }

  // User is active, allow access
  return children;
};

export default ProtectedRoute;
