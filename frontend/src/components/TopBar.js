import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import { getApiUrl } from '../config/apiConfig';
import { getImageUrl } from '../utils/urlHelper';
import MessagesDropdown from './MessagesDropdown';
import MessageModal from './MessageModal';
import OnlineUsersDropdown from './OnlineUsersDropdown';
import Logo from './Logo';
import { getFirstName } from '../utils/userDisplay';
import logger from '../utils/logger';
import './TopBar.css';

const TopBar = ({ onSidebarToggle, isOpen }) => {
  const location = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [showOnlineDropdown, setShowOnlineDropdown] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [violations, setViolations] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();

  // Get page title based on current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/dashboard') return { icon: '💑', title: 'My Dashboard', subtitle: 'View your matches and activity' };
    if (path === '/search') return { icon: '🔍', title: 'Search Profiles', subtitle: 'Find your perfect match' };
    if (path === '/messages') return { icon: '💬', title: 'My Messages', subtitle: 'Communicate with your connections' };
    if (path === '/favorites') return { icon: '⭐', title: 'Favorites', subtitle: 'Profiles you\'ve marked as favorites' };
    if (path === '/shortlist') return { icon: '📋', title: 'Shortlist', subtitle: 'Your curated list of potential matches' };
    if (path === '/exclusions') return { icon: '🚫', title: 'Exclusions', subtitle: 'Profiles you\'ve chosen to hide' };
    if (path === '/l3v3l-matches') return { icon: '🎯', title: 'L3V3L Matches', subtitle: 'AI-powered compatibility matches' };
    if (path === '/pii-management') return { icon: '🔒', title: 'Privacy & Data Management', subtitle: 'Manage who can access your private information' };
    if (path === '/requests') return { icon: '📬', title: 'Contact Requests', subtitle: 'Manage incoming contact requests' };
    if (path === '/preferences') return { icon: '🔔', title: 'Notification Preferences', subtitle: 'Customize your notification settings' };
    if (path === '/user-management') return { icon: '👥', title: 'User Management', subtitle: 'Manage user roles, permissions, and account status' };
    if (path === '/role-management') return { icon: '🎭', title: 'Role Management', subtitle: 'Configure user roles and permissions' };
    if (path.startsWith('/profile/')) return { icon: '👤', title: 'Profile', subtitle: 'View profile details' };
    if (path === '/settings') return { icon: '⚙️', title: 'Settings', subtitle: 'Manage your account settings' };
    if (path === '/admin') return { icon: '🔧', title: 'Admin', subtitle: 'System administration and configuration' };
    if (path === '/invite-friends') return { icon: '👥', title: 'Invite Friends', subtitle: 'Share the platform with friends and family' };
    if (path === '/invitations') return { icon: '✉️', title: 'Invitations', subtitle: 'Manage invitation codes and referrals' };
    if (path === '/dynamic-scheduler') return { icon: '🗓️', title: 'Dynamic Scheduler', subtitle: 'Manage scheduled jobs and automation tasks' };
    if (path === '/notification-management') return { icon: '🔔', title: 'Notification Management', subtitle: 'Manage notification queue and templates' };
    if (path === '/activity-logs') return { icon: '📊', title: 'Activity Logs', subtitle: 'Monitor user activities and system events' };
    if (path === '/email-analytics') return { icon: '📧', title: 'Email Analytics', subtitle: 'Track email opens, clicks, and engagement' };
    if (path === '/pause-analytics') return { icon: '⏸️', title: 'Pause Analytics', subtitle: 'Monitor pause feature usage and patterns' };
    if (path === '/announcement-management') return { icon: '📢', title: 'Announcement Management', subtitle: 'Create and manage site-wide announcements' };
    if (path === '/email-templates') return { icon: '✉️', title: 'Email Templates', subtitle: 'Preview and manage email templates' };
    if (path === '/notification-tester') return { icon: '🧪', title: 'Notification Tester', subtitle: 'Test notification delivery' };
    if (path === '/admin/notification-config') return { icon: '⚙️', title: 'Notification Config', subtitle: 'Configure notification settings' };
    if (path === '/admin/notifications') return { icon: '📬', title: 'Saved Search Notifications', subtitle: 'Manage saved search notification schedules' };
    if (path === '/admin/contact') return { icon: '📩', title: 'Contact Management', subtitle: 'Manage contact form submissions' };
    if (path === '/test-dashboard') return { icon: '🧪', title: 'Test Dashboard', subtitle: 'Testing and development tools' };
    if (path === '/poll-management') return { icon: '📊', title: 'Poll Management', subtitle: 'Create and manage polls' };
    if (path === '/testimonials') return { icon: '💬', title: 'Testimonials', subtitle: 'View success stories' };
    if (path === '/contact') return { icon: '📧', title: 'Contact Us', subtitle: 'Get in touch with support' };
    if (path === '/matching-criteria') return { icon: '🎯', title: 'Matching Criteria', subtitle: 'Configure your matching preferences' };
    if (path === '/top-matches') return { icon: '🏆', title: 'Top Matches', subtitle: 'Your best compatibility matches' };
    if (path === '/edit-profile') return { icon: '✏️', title: 'Edit Profile', subtitle: 'Update your profile information' };
    if (path === '/help') return { icon: '❓', title: 'Help Center', subtitle: 'Find answers to common questions' };
    return null;
  };

  const pageTitle = getPageTitle();

  // Listen for window resize to toggle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check login status and load user profile
  useEffect(() => {
    const checkLoginStatus = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      
      if (username && token) {
        // SECURITY: Verify token matches username to prevent session contamination
        try {
          // Decode JWT payload (format: header.payload.signature)
          const payloadBase64 = token.split('.')[1];
          const payload = JSON.parse(atob(payloadBase64));
          const tokenUsername = payload.sub; // JWT subject claim contains username
          
          // Check if token username matches stored username
          if (tokenUsername !== username) {
            logger.error('SECURITY: Token/username mismatch detected!');
            logger.error('Stored username:', username);
            logger.error('Token username:', tokenUsername);
            logger.error('Logging out for security...');
            
            // Clear contaminated session
            localStorage.removeItem('username');
            localStorage.removeItem('token');
            localStorage.removeItem('userRole');
            localStorage.removeItem('userStatus');
            setIsLoggedIn(false);
            setCurrentUser(null);
            setUserProfile(null);
            return;
          }
          
          // Token matches username - proceed with login
          logger.info('Token validation passed for user:', username);
          setIsLoggedIn(true);
          setCurrentUser(username);
          
          // Load user role from localStorage
          const role = localStorage.getItem('userRole');
          setUserRole(role);
          
          // Load user profile for display name (pass requester to avoid PII masking)
          try {
            const response = await api.get(`/profile/${username}?requester=${username}`);
            setUserProfile(response.data);
            
            // Update role from profile if available
            if (response.data.role) {
              setUserRole(response.data.role);
            }
            
            // Load user violations
            loadUserViolations(username);
          } catch (profileError) {
            // Profile fetch failed - this is OK, don't logout
            // The Profile component will handle displaying the profile
            logger.warn('Could not load user profile in TopBar (non-critical):', profileError?.message || profileError);
            logger.warn('User stays logged in, profile will load from Profile component');
            // IMPORTANT: Do NOT logout here - profile fetch can fail for many reasons
          }
        } catch (error) {
          // This catch is for JWT token decoding errors only
          logger.error('Error decoding or validating JWT token:', error);
          logger.error('This is a critical error - token is invalid or corrupted');
          // Clear session due to token validation failure
          localStorage.removeItem('username');
          localStorage.removeItem('token');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userStatus');
          setIsLoggedIn(false);
          setCurrentUser(null);
          setUserProfile(null);
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setUserProfile(null);
      }
    };

    checkLoginStatus();

    // Listen for storage changes (login/logout from other tabs)
    window.addEventListener('storage', checkLoginStatus);
    
    // Custom event for same-tab login/logout
    window.addEventListener('loginStatusChanged', checkLoginStatus);

    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('loginStatusChanged', checkLoginStatus);
    };
  }, []);

  // Listen for WebSocket updates (unread messages)
  useEffect(() => {
    if (!currentUser) return;

    // Update unread count from WebSocket
    const handleUnreadUpdate = (data) => {
      setUnreadCount(data.totalUnread || 0);
    };

    const handleUnreadCountsLoaded = (data) => {
      setUnreadCount(data.totalUnread || 0);
    };

    socketService.on('unread_update', handleUnreadUpdate);
    socketService.on('unread_counts_loaded', handleUnreadCountsLoaded);

    // Get initial counts
    setUnreadCount(socketService.getTotalUnread());

    return () => {
      socketService.off('unread_update', handleUnreadUpdate);
      socketService.off('unread_counts_loaded', handleUnreadCountsLoaded);
    };
  }, [currentUser]);

  // Listen for online count updates (original implementation)
  useEffect(() => {
    const handleOnlineCountUpdate = (data) => {
      setOnlineCount(data.count || 0);
    };

    socketService.on('online_count_update', handleOnlineCountUpdate);
    
    return () => {
      socketService.off('online_count_update', handleOnlineCountUpdate);
    };
  }, []);

  // eslint-disable-next-line no-unused-vars
  const handleLogout = async () => {
    const username = currentUser;
    
    // Disconnect WebSocket
    logger.info('Disconnecting WebSocket');
    socketService.disconnect();
    
    // Mark user as offline (non-blocking beacon)
    if (username) {
      navigator.sendBeacon(
        `${getApiUrl()}/online-status/${username}/offline`,
        ''
      );
    }
    
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userStatus');
    localStorage.removeItem('appTheme'); // Clear theme cache
    setIsLoggedIn(false);
    setCurrentUser(null);
    
    // Dispatch custom event for sidebar to update
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    navigate('/login');
  };

  const handleLogin = () => {
    navigate('/login');
  };

  const handleProfile = () => {
    if (currentUser) {
      navigate(`/profile/${currentUser}`);
    }
  };

  // Load user violations
  const loadUserViolations = async (username) => {
    try {
      const response = await api.get(`/violations/${username}`);
      if (response.data && response.data.violationCount > 0) {
        setViolations(response.data);
      } else {
        setViolations(null); // Clear violations if count is 0
      }
    } catch (error) {
      logger.error('Error loading user violations:', error);
    }
  };

  // Listen for violation updates
  useEffect(() => {
    if (!currentUser) return;

    const handleViolationUpdate = () => {
      loadUserViolations(currentUser);
    };

    window.addEventListener('violationUpdate', handleViolationUpdate);

    return () => {
      window.removeEventListener('violationUpdate', handleViolationUpdate);
    };
  }, [currentUser]);

  if (!isLoggedIn) {
    return (
      <div className={`top-bar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="top-bar-content">
          <div className="top-bar-left">
            <button className="sidebar-toggle-btn" onClick={onSidebarToggle} title="Toggle Sidebar">
              ☰
            </button>
            <div className="app-logo" onClick={() => navigate('/')}>
              <Logo variant="modern" size="small" showText={!isMobile} theme="navbar" />
            </div>
          </div>
          <div className="top-bar-right">
            <button className="btn-login" onClick={handleLogin} title="Login">
              🔑
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`top-bar ${isOpen ? 'sidebar-open' : ''}`}>
      {/* Violation Warning Banner */}
      {violations && violations.violationCount > 0 && (
        <div className={`violation-banner violation-${violations.warningLevel}`}>
          <span className="violation-icon">
            {violations.warningLevel === 'banned' ? '🚫' : violations.warningLevel === 'suspended' ? '⏸️' : '⚠️'}
          </span>
          <span className="violation-message">{violations.warningMessage}</span>
          <span className="violation-count">{violations.violationCount}/3</span>
        </div>
      )}
      <div className="top-bar-content">
        <div className="top-bar-left">
          <button className="sidebar-toggle-btn" onClick={onSidebarToggle} title="Toggle Sidebar">
            ☰
          </button>
          <div className="app-logo" onClick={() => navigate('/dashboard')}>
            <span className="logo-text">
              <span className="butterfly-icon">🦋</span>
              <span className="logo-text-full"> L3V3L</span>
            </span>
          </div>
          {onlineCount > 0 && (
            <div className="online-indicator-container">
              <div 
                className={`online-indicator ${userRole === 'admin' || userRole === 'moderator' ? 'clickable' : ''}`}
                onClick={() => {
                  if (userRole === 'admin' || userRole === 'moderator') {
                    setShowOnlineDropdown(!showOnlineDropdown);
                  }
                }}
              >
                <span className="online-dot">🟢</span>
                <span className="online-count">{onlineCount}</span>
                <span className="online-text">{onlineCount} user{onlineCount !== 1 ? 's' : ''} online</span>
              </div>
              {(userRole === 'admin' || userRole === 'moderator') && (
                <OnlineUsersDropdown
                  isOpen={showOnlineDropdown}
                  onClose={() => setShowOnlineDropdown(false)}
                />
              )}
            </div>
          )}
        </div>
        <div className="top-bar-right">
          {/* Search Button */}
          <button 
            className="btn-refer-friend" 
            onClick={() => navigate('/search')}
            title="Search Profiles"
          >
            <span className="refer-icon">🔍</span>
            <span className="refer-text">Search</span>
          </button>
          
          {/* Messages Icon with Dropdown */}
          <div className="messages-icon-container">
            <button 
              className="btn-messages" 
              onClick={() => setShowMessagesDropdown(!showMessagesDropdown)}
              title="Messages"
            >
              💬
              {unreadCount > 0 && (
                <span className="unread-count-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
            <MessagesDropdown
              isOpen={showMessagesDropdown}
              onClose={() => setShowMessagesDropdown(false)}
              onOpenMessage={(profile) => {
                setSelectedProfile(profile);
                setShowMessageModal(true);
              }}
            />
          </div>
          
          <div className="user-info" onClick={handleProfile}>
            <div className="user-icon">
              {userProfile?.images?.[0] ? (
                <img src={getImageUrl(userProfile.images[0])} alt={currentUser} className="topbar-profile-avatar" />
              ) : (
                <div className="topbar-profile-placeholder">
                  {userProfile?.firstName?.[0] || currentUser?.[0]?.toUpperCase() || '?'}
                </div>
              )}
            </div>
            <span className="user-name">{userProfile ? getFirstName(userProfile) : currentUser}</span>
          </div>
        </div>
        
        {/* Message Modal */}
        {showMessageModal && selectedProfile && (
          <MessageModal
            isOpen={showMessageModal}
            profile={selectedProfile}
            onClose={() => {
              setShowMessageModal(false);
              setSelectedProfile(null);
            }}
          />
        )}
      </div>
      
      {/* Page Title Section - Horizontal bar below main topbar */}
      {pageTitle && (
        <div className="page-title-section">
          <span className="page-title-icon">{pageTitle.icon}</span>
          <div className="page-title-content">
            <span className="page-title-text">{pageTitle.title}</span>
            {pageTitle.subtitle && (
              <span className="page-title-subtitle">{pageTitle.subtitle}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
