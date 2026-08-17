// frontend/src/components/ProtectedRoute.js
//
// Business Requirements:
// - Protected routes must allow navigation even when the user has critical messages.
// - A persistent (locked) critical/warning banner is shown across all protected pages.
// - Critical banner is non-dismissible; warning banner can be dismissed for the session.
// - The /messages page has its own local banner; the route guard banner appears on all other pages.
//
// Checkpoint: 2026-08-17 - Replaced critical-message navigation lock with a persistent banner.
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import './Messages.css';
import api from '../api';

const ProtectedRoute = ({ children }) => {
  // All hooks MUST be called before any conditional returns
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const [unattendedData, setUnattendedData] = useState(null);
  const [warningDismissed, setWarningDismissed] = useState(() => sessionStorage.getItem('unattendedWarningDismissed') === 'true');
  const navigate = useNavigate();
  const location = useLocation();
  
  // Check token synchronously on initial render
  const initialToken = localStorage.getItem('token');

  useEffect(() => {
    // Check for missing token - redirect to login
    if (!initialToken) {
      console.warn('🔒 ProtectedRoute: No token found - redirecting to login');
      setShouldRedirectToLogin(true);
      setLoading(false);
      return;
    }
  }, [initialToken]);

  useEffect(() => {
    const checkUserStatus = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      
      // Check for missing token - redirect to login
      if (!token) {
        console.warn('🔒 ProtectedRoute useEffect: No token - redirecting to login');
        setShouldRedirectToLogin(true);
        setLoading(false);
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
        
        // CRITICAL FIX: Use accountStatus (unified field), not legacy status.status
        const status = response.data.accountStatus || 'pending';
        
        // Normalize status to lowercase for comparison
        const normalizedStatus = status.toLowerCase();
        setUserStatus(normalizedStatus);
      } catch (error) {
        console.error('Error fetching user status:', error);
        
        // If 401 error (session expired), clear auth data and redirect
        if (error.response?.status === 401) {
          console.warn('🔒 ProtectedRoute: Session expired, clearing auth data');
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userRole');
          setShouldRedirectToLogin(true);
        } else {
          // For other errors, default to pending
          setUserStatus('pending');
        }
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
    
    // Check for unattended chats (only if not on messages page - messages page has its own banner)
    const checkUnattendedChats = async () => {
      if (location.pathname === '/messages') {
        setUnattendedData(null);
        return;
      }
      
      try {
        const response = await api.get('/messages/unattended');
        setUnattendedData(response.data);
      } catch (error) {
        console.warn('Could not check unattended chats:', error);
        setUnattendedData(null);
      }
    };
    
    if (localStorage.getItem('token')) {
      checkUnattendedChats();
    }
  }, [location.pathname]); // Re-check on route change

  // Handle redirect to login
  if (shouldRedirectToLogin) {
    return <Navigate to="/login" replace />;
  }
  
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
  const onMessagesPage = location.pathname === '/messages';
  const hasCritical = !onMessagesPage && unattendedData && unattendedData.criticalCount > 0;
  const hasWarning = !onMessagesPage && unattendedData && unattendedData.warningCount > 0 && unattendedData.criticalCount === 0 && !warningDismissed;

  return (
    <>
      {hasCritical && (
        <div className="global-unattended-banner">
          <div className="unattended-banner">
            <div className="unattended-banner-content">
              <span className="unattended-icon">🚨</span>
              <div className="unattended-text">
                <strong>You have {unattendedData.criticalCount} critical message{unattendedData.criticalCount > 1 ? 's' : ''} (10+ days) requiring your response</strong>
                <p className="unattended-explanation">
                  Please respond or decline from the <strong>Messages</strong> page. This banner remains visible on all pages until the conversation is addressed.
                </p>
              </div>
              <button className="pending-action-btn" onClick={() => navigate('/messages')}>
                Go to Messages
              </button>
            </div>
          </div>
        </div>
      )}
      {hasWarning && (
        <div className="global-unattended-banner">
          <div className="pending-warning-banner">
            <div className="pending-warning-content">
              <span className="pending-icon">�</span>
              <div className="pending-text">
                <strong>You have {unattendedData.warningCount} message{unattendedData.warningCount > 1 ? 's' : ''} waiting for a response</strong>
                <span className="pending-subtext">
                  {unattendedData.highCount > 0 && `🟠 ${unattendedData.highCount} high (6-9 days) `}
                  {unattendedData.mediumCount > 0 && `🟡 ${unattendedData.mediumCount} medium (3-5 days) `}
                  {unattendedData.pendingCount > 0 && `💬 ${unattendedData.pendingCount} pending (1-2 days)`}
                </span>
              </div>
              <button className="pending-action-btn" onClick={() => navigate('/messages')}>
                View Messages
              </button>
              <button
                className="pending-dismiss-btn"
                onClick={() => {
                  setWarningDismissed(true);
                  sessionStorage.setItem('unattendedWarningDismissed', 'true');
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      )}
      {children}
    </>
  );
};

export default ProtectedRoute;
