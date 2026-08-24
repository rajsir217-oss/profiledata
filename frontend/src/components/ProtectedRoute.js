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
import api, { trustedDeviceAutoLogin } from '../api';
import logger from '../utils/logger';
import sessionManager from '../services/sessionManager';
import socketService from '../services/socketService';
import {
  clearTrustedDeviceToken,
  getTrustedDeviceContext,
  getTrustedDeviceToken,
  getTrustedUsernames,
} from '../utils/trustedDevice';

const ProtectedRoute = ({ children }) => {
  // All hooks MUST be called before any conditional returns
  const [loading, setLoading] = useState(true);
  const [userStatus, setUserStatus] = useState(null);
  const [currentUsername, setCurrentUsername] = useState(null);
  const [shouldRedirectToLogin, setShouldRedirectToLogin] = useState(false);
  const [autoLoginAttempted, setAutoLoginAttempted] = useState(false);
  const [unattendedData, setUnattendedData] = useState(null);
  const [warningDismissed, setWarningDismissed] = useState(() => sessionStorage.getItem('unattendedWarningDismissed') === 'true');
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkUserStatus = async () => {
      const username = localStorage.getItem('username');
      let token = localStorage.getItem('token');
      
      if (!token) {
        if (autoLoginAttempted) {
          logger.warn('ProtectedRoute: No token after trusted-device attempt; redirecting to login');
          setShouldRedirectToLogin(true);
          setLoading(false);
          return;
        }

        const usernames = getTrustedUsernames();
        const legacyToken = getTrustedDeviceToken();
        const accounts = usernames.length > 0 ? usernames : (legacyToken ? [''] : []);

        if (accounts.length === 0) {
          setAutoLoginAttempted(true);
          setShouldRedirectToLogin(true);
          setLoading(false);
          return;
        }

        // More than one saved account: send the user to the login page picker.
        if (accounts.length > 1) {
          logger.info('ProtectedRoute: multiple trusted accounts, redirecting to login picker');
          navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`, { replace: true });
          return;
        }

        const trustedToken = accounts[0] ? getTrustedDeviceToken(accounts[0]) : legacyToken;

        try {
          const deviceContext = getTrustedDeviceContext();
          const autoLoginResponse = await trustedDeviceAutoLogin({
            trusted_device_token: trustedToken,
            device_id: deviceContext.deviceId,
            app_id: deviceContext.appId,
          });

          if (autoLoginResponse?.access_token && autoLoginResponse?.user?.username) {
            localStorage.setItem('token', autoLoginResponse.access_token);
            localStorage.setItem('username', autoLoginResponse.user.username);
            if (autoLoginResponse.refresh_token) {
              localStorage.setItem('refreshToken', autoLoginResponse.refresh_token);
            }
            localStorage.setItem('userStatus', autoLoginResponse.user.accountStatus || 'active');
            localStorage.setItem('userRole', autoLoginResponse.user.role_name || autoLoginResponse.user.role || 'free_user');

            sessionManager.init();
            socketService.connect(autoLoginResponse.user.username);
            window.dispatchEvent(new Event('loginStatusChanged'));
            window.dispatchEvent(new Event('userLoggedIn'));
            token = autoLoginResponse.access_token;
          }
        } catch (autoLoginError) {
          logger.warn('Trusted-device auto-login failed', autoLoginError);
          if (autoLoginError?.response?.status === 401) {
            clearTrustedDeviceToken(trustedToken);
          }
        } finally {
          setAutoLoginAttempted(true);
        }

        if (!token) {
          setShouldRedirectToLogin(true);
          setLoading(false);
          return;
        }
      }

      const resolvedUsername = localStorage.getItem('username');
      
      if (!resolvedUsername) {
        setLoading(false);
        return;
      }

      setCurrentUsername(resolvedUsername);

      try {
        // Fetch user profile to get status (pass requester to avoid PII masking)
        const response = await api.get(`/profile/${resolvedUsername}?requester=${resolvedUsername}`);
        
        // CRITICAL FIX: Use accountStatus (unified field), not legacy status.status
        const status = response.data.accountStatus || 'pending';
        
        // Normalize status to lowercase for comparison
        const normalizedStatus = status.toLowerCase();
        setUserStatus(normalizedStatus);
      } catch (error) {
        logger.error('Error fetching user status', error);
        
        // If 401 error (session expired), clear auth data and redirect
        if (error.response?.status === 401) {
          logger.warn('ProtectedRoute: Session expired, clearing auth data');
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
        logger.warn('Could not check unattended chats', error);
        setUnattendedData(null);
      }
    };
    
    if (localStorage.getItem('token')) {
      checkUnattendedChats();
    }
  }, [autoLoginAttempted, location.pathname, navigate]); // Re-check on route change

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
