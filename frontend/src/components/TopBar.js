import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api, { createApiInstance } from '../api';
import socketService from '../services/socketService';
import { getApiUrl } from '../config/apiConfig';
// eslint-disable-next-line no-unused-vars
import { getImageUrl, getProfilePicUrl } from '../utils/urlHelper';
import MessagesDropdown from './MessagesDropdown';
import MessageModal from './MessageModal';
import OnlineUsersDropdown from './OnlineUsersDropdown';
import Logo from './Logo';
import InfoTicker from './InfoTicker';
import EventCountdown from './EventCountdown';
import { getFirstName } from '../utils/userDisplay';
import logger from '../utils/logger';
import { loadWhitelabelConfig } from '../utils/whitelabelConfig';
import './TopBar.css';

const TopBar = ({ onSidebarToggle, isOpen, isPinned }) => {
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
  const [onlineCount, setOnlineCount] = useState(1); // Default 1 (current user is online)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [adminPendingCounts, setAdminPendingCounts] = useState(null); // Unified admin pending counts
  const [showAdminActions, setShowAdminActions] = useState(false); // Admin Action Center dropdown
  const adminActionsRef = useRef(null); // Ref for click-outside detection
  const [unreadResponseCount, setUnreadResponseCount] = useState(0); // User unread admin responses
  const [urgencyCounts, setUrgencyCounts] = useState({ pending: 0, medium: 0, high: 0, critical: 0 }); // All urgency levels
  const [unattendedConversations, setUnattendedConversations] = useState([]); // For alert panel
  const [showUnattendedAlert, setShowUnattendedAlert] = useState(false); // Alert panel visibility
  const [brandConfig, setBrandConfig] = useState(null); // Whitelabel branding config

  // Compute highest urgency level for icon color
  const urgencyLevel = urgencyCounts.critical > 0 ? 'critical'
    : urgencyCounts.high > 0 ? 'high'
    : urgencyCounts.medium > 0 ? 'medium'
    : urgencyCounts.pending > 0 ? 'pending'
    : null;
  const totalUnattended = urgencyCounts.critical + urgencyCounts.high + urgencyCounts.medium + urgencyCounts.pending;
  const navigate = useNavigate();

  // Load branding config
  useEffect(() => {
    loadWhitelabelConfig().then(cfg => setBrandConfig(cfg));
  }, []);

  // Handle message deleted callback
  const handleMessageDeleted = (messageId) => {
    console.log('🗑️ Message deleted:', messageId);
    // Refresh the messages dropdown by closing and reopening it
    if (showMessagesDropdown) {
      // Temporarily close and reopen to refresh the data
      setShowMessagesDropdown(false);
      setTimeout(() => setShowMessagesDropdown(true), 100);
    }
  };

  // Handle urgency count update
  const handleCriticalCountUpdate = async () => {
    try {
      const response = await api.get('/messages/unattended');
      const data = response.data;
      setUrgencyCounts({
        pending: data.pendingCount || 0,
        medium: data.mediumCount || 0,
        high: data.highCount || 0,
        critical: data.criticalCount || 0
      });
      setUnattendedConversations(data.conversations || []);
    } catch (error) {
      logger.error('Error updating critical messages count:', error);
    }
  };

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
    if (path === '/whatsapp-verification') return { icon: '📱', title: 'WhatsApp Verification', subtitle: 'Verify group members against database' };
    if (path === '/testimonials') return { icon: '💬', title: 'Testimonials', subtitle: 'View success stories' };
    if (path === '/contact') return { icon: '📧', title: 'Contact Us', subtitle: 'Get in touch with support' };
    if (path === '/matching-criteria') return { icon: '🎯', title: 'Matching Criteria', subtitle: 'Configure your matching preferences' };
    if (path === '/top-matches') return { icon: '🏆', title: 'Top Matches', subtitle: 'Your best compatibility matches' };
    if (path === '/edit-profile') return { icon: '✏️', title: 'Edit Profile', subtitle: 'Update your profile information' };
    if (path === '/help') return { icon: '❓', title: 'Help Center', subtitle: 'Find answers to common questions' };
    if (path === '/promo-codes') return { icon: '🎫', title: 'Promo Code Manager', subtitle: 'Manage codes, discounts & QR' };
    if (path === '/membership-plans') return { icon: '💳', title: 'Membership Plans', subtitle: 'Configure pricing and plans' };
    if (path === '/lead-generation') return { icon: '📈', title: 'Lead Generation', subtitle: 'Track members & revenue' };
    if (path === '/admin-reports') return { icon: '📊', title: 'Admin Reports', subtitle: 'View system reports and analytics' };
    if (path === '/contribution-management') return { icon: '💝', title: 'Contribution Management', subtitle: 'Track and manage user contributions' };
    if (path === '/admin/recurring-contributions') return { icon: '🔄', title: 'Recurring Contributions', subtitle: 'Manage recurring payment subscriptions' };
    if (path === '/virtual-meets') return { icon: '🎥', title: 'Virtual Meets', subtitle: 'Match with participants and connect in 1:1 virtual rooms' };
    if (path === '/pricing') return { icon: '💎', title: 'Membership Pricing', subtitle: 'Choose your membership plan' };
    if (path === '/admin-backups') return { icon: '💾', title: 'Database Backups', subtitle: 'Manage MongoDB backups and restores' };
    if (path === '/admin/inactive-users') return { icon: '🔍', title: 'Inactive Users Report', subtitle: 'Comprehensive report of inactive users' };
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
    sessionStorage.removeItem('urgencyModalShown'); // Reset urgency modal for next login
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

  // Poll for admin pending counts (admin only) - unified endpoint
  useEffect(() => {
    if (userRole !== 'admin') {
      setAdminPendingCounts(null);
      return;
    }

    const fetchAdminPendingCounts = async () => {
      try {
        const adminApi = createApiInstance();
        const response = await adminApi.get('/api/admin/pending-counts');
        setAdminPendingCounts(response.data);
      } catch (error) {
        logger.error('Error fetching admin pending counts:', error);
      }
    };

    fetchAdminPendingCounts();
    const interval = setInterval(fetchAdminPendingCounts, 120000); // Reduced from 60s to 120s
    return () => clearInterval(interval);
  }, [userRole]);

  // Close admin actions dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (adminActionsRef.current && !adminActionsRef.current.contains(e.target)) {
        setShowAdminActions(false);
      }
    };
    if (showAdminActions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showAdminActions]);

  // Poll for unread admin responses (all logged-in users)
  useEffect(() => {
    if (!currentUser) {
      setUnreadResponseCount(0);
      return;
    }

    const fetchUnreadResponseCount = async () => {
      try {
        const response = await api.get(`/contact/user/${currentUser}/unread-count`);
        setUnreadResponseCount(response.data.count || 0);
      } catch (error) {
        logger.error('Error fetching unread response count:', error);
      }
    };

    // Fetch immediately
    fetchUnreadResponseCount();

    // Poll every 90 seconds (reduced from 60s to prevent too frequent updates)
    const interval = setInterval(fetchUnreadResponseCount, 90000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Poll for critical messages count
  useEffect(() => {
    if (!currentUser) {
      setUrgencyCounts({ pending: 0, medium: 0, high: 0, critical: 0 });
      return;
    }

    const fetchCriticalMessagesCount = async () => {
      try {
        const response = await api.get('/messages/unattended');
        const data = response.data;
        setUrgencyCounts({
          pending: data.pendingCount || 0,
          medium: data.mediumCount || 0,
          high: data.highCount || 0,
          critical: data.criticalCount || 0
        });
        setUnattendedConversations(data.conversations || []);
      } catch (error) {
        logger.error('Error fetching critical messages count:', error);
      }
    };

    // Fetch immediately
    fetchCriticalMessagesCount();

    // Poll every 30 seconds for critical messages (more frequent since it's urgent)
    const interval = setInterval(fetchCriticalMessagesCount, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  // Auto-show urgency modal once per login session (or when urgency escalates)
  const prevUrgencyRef = useRef(null);
  useEffect(() => {
    if (!urgencyLevel) {
      prevUrgencyRef.current = null;
      return;
    }
    const shownLevel = sessionStorage.getItem('urgencyModalShown');
    const urgencyRank = { pending: 1, medium: 2, high: 3, critical: 4 };
    const currentRank = urgencyRank[urgencyLevel] || 0;
    const shownRank = urgencyRank[shownLevel] || 0;

    // Show on first detection after login OR when urgency escalates beyond what was already shown
    if (!shownLevel || currentRank > shownRank) {
      setShowUnattendedAlert(true);
      sessionStorage.setItem('urgencyModalShown', urgencyLevel);
    }
    prevUrgencyRef.current = urgencyLevel;
  }, [urgencyLevel]);

  if (!isLoggedIn) {
    return (
      <div className={`top-bar ${isOpen ? (isPinned ? 'sidebar-pinned' : 'sidebar-open') : ''}`}>
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
    <div className={`top-bar ${isOpen ? (isPinned ? 'sidebar-pinned' : 'sidebar-open') : ''}`}>
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
          {/* Branding text - merged from BrandBanner */}
          {brandConfig && (
            <div className="topbar-branding">
              <span className="topbar-brand-name">{brandConfig.branding.appName}</span>
              {!isMobile && brandConfig.branding.tagline && (
                <span className="topbar-brand-tagline">{brandConfig.branding.tagline}</span>
              )}
            </div>

          )}
          {/* Event Countdown - Shows for users who RSVPed "Yes" to upcoming events */}
          <EventCountdown />
        </div>
        <div className="top-bar-right">
          {/* Search Button */}
          <button 
            className="btn-refer-friend" 
            onClick={() => {
              if (location.pathname === '/search') {
                window.dispatchEvent(new Event('openSearchModal'));
              } else {
                navigate('/search');
              }
            }}
            title="Search Profiles"
          >
            <span className="refer-icon">🔍</span>
            <span className="refer-text">Search</span>
          </button>
          
          {/* Admin Action Center - Unified pending items indicator */}
          {userRole === 'admin' && adminPendingCounts && (
            <div className="admin-actions-container" ref={adminActionsRef}>
              <button 
                className={`btn-admin-actions ${adminPendingCounts.total > 0 ? 'has-pending' : ''}`}
                onClick={() => setShowAdminActions(!showAdminActions)}
                title={`Admin Actions${adminPendingCounts.total > 0 ? ` (${adminPendingCounts.total} pending)` : ''}`}
              >
                🔔
                {adminPendingCounts.total > 0 && (
                  <span className="admin-actions-badge">{adminPendingCounts.total > 99 ? '99+' : adminPendingCounts.total}</span>
                )}
              </button>
              {showAdminActions && (
                <div className="admin-actions-dropdown">
                  <div className="admin-actions-header">Admin Actions Needed</div>
                  <button 
                    className="admin-action-item"
                    onClick={() => { navigate('/admin'); setShowAdminActions(false); }}
                  >
                    <span className="action-icon">👤</span>
                    <span className="action-label">Users pending approval</span>
                    <span className={`action-count ${adminPendingCounts.pendingApprovals > 0 ? 'has-items' : ''}`}>
                      {adminPendingCounts.pendingApprovals}
                    </span>
                  </button>
                  <button 
                    className="admin-action-item"
                    onClick={() => { navigate('/admin/contact'); setShowAdminActions(false); }}
                  >
                    <span className="action-icon">🎫</span>
                    <span className="action-label">Open support tickets</span>
                    <span className={`action-count ${adminPendingCounts.openTickets > 0 ? 'has-items' : ''}`}>
                      {adminPendingCounts.openTickets}
                    </span>
                  </button>
                  <button 
                    className="admin-action-item"
                    onClick={() => { navigate('/testimonials'); setShowAdminActions(false); }}
                  >
                    <span className="action-icon">⭐</span>
                    <span className="action-label">Pending testimonials</span>
                    <span className={`action-count ${adminPendingCounts.pendingTestimonials > 0 ? 'has-items' : ''}`}>
                      {adminPendingCounts.pendingTestimonials}
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
          
          {/* Support Response Alert - All Users (when they have unread admin responses) */}
          {unreadResponseCount > 0 && (
            <button 
              className="btn-support-response" 
              onClick={() => navigate('/contact')}
              title={`You have ${unreadResponseCount} unread support response${unreadResponseCount > 1 ? 's' : ''}`}
            >
              📩
              <span className="support-response-badge">{unreadResponseCount > 99 ? '99+' : unreadResponseCount}</span>
            </button>
          )}
          
          {/* Messages Icon with Dropdown */}
          <div className="messages-icon-container">
            <button 
              className={`btn-messages ${urgencyLevel || ''}`}
              onClick={() => setShowMessagesDropdown(!showMessagesDropdown)}
              title={urgencyLevel === 'critical'
                ? `${urgencyCounts.critical} critical message${urgencyCounts.critical > 1 ? 's' : ''} — reply now!`
                : urgencyLevel === 'high'
                  ? `${urgencyCounts.high} message${urgencyCounts.high > 1 ? 's' : ''} waiting 6-9 days`
                  : urgencyLevel === 'medium'
                    ? `${urgencyCounts.medium} message${urgencyCounts.medium > 1 ? 's' : ''} waiting 3-5 days`
                    : urgencyLevel === 'pending'
                      ? `${urgencyCounts.pending} message${urgencyCounts.pending > 1 ? 's' : ''} waiting 1-2 days`
                      : 'Messages'
              }
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
                // Merge profile with callbacks
                const profileWithCallback = {
                  ...profile,
                  onMessageDeleted: handleMessageDeleted,
                  onCriticalCountUpdate: handleCriticalCountUpdate
                };
                setSelectedProfile(profileWithCallback);
                setShowMessageModal(true);
              }}
              onMessageDeleted={handleMessageDeleted}
            />
          </div>
          
          {/* Online member count — clean number badge */}
          <div className="online-indicator-container">
            <button 
              className={`btn-online-count ${userRole === 'admin' || userRole === 'moderator' ? 'clickable' : ''}`}
              onClick={() => {
                if (userRole === 'admin' || userRole === 'moderator') {
                  setShowOnlineDropdown(!showOnlineDropdown);
                }
              }}
              title={`${onlineCount} member${onlineCount !== 1 ? 's' : ''} online`}
            >
              {onlineCount}
            </button>
            {(userRole === 'admin' || userRole === 'moderator') && (
              <OnlineUsersDropdown
                isOpen={showOnlineDropdown}
                onClose={() => setShowOnlineDropdown(false)}
              />
            )}
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
            onMessageDeleted={handleMessageDeleted}
          />
        )}
      </div>
      
      {/* Info Ticker - Scrolling information bar */}
      <InfoTicker />
      
      {/* Page Title Section - Horizontal bar below ticker */}
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

      {/* Urgency Popup Modal — rendered outside top-bar so it overlays the whole page */}
      {showUnattendedAlert && urgencyLevel && unattendedConversations.length > 0 && (
        <div className="urgency-modal-backdrop" onClick={() => setShowUnattendedAlert(false)}>
          <div className="urgency-modal" onClick={(e) => e.stopPropagation()}>
            <div className={`urgency-modal-header urgency-${urgencyLevel}`}>
              <span className="urgency-modal-title">
                {urgencyLevel === 'critical' && `🔴 ${urgencyCounts.critical} Critical Message${urgencyCounts.critical > 1 ? 's' : ''}`}
                {urgencyLevel === 'high' && `🟠 ${urgencyCounts.high} Message${urgencyCounts.high > 1 ? 's' : ''} Waiting 6-9 Days`}
                {urgencyLevel === 'medium' && `🟡 ${urgencyCounts.medium} Message${urgencyCounts.medium > 1 ? 's' : ''} Waiting 3-5 Days`}
                {urgencyLevel === 'pending' && `💬 ${urgencyCounts.pending} Message${urgencyCounts.pending > 1 ? 's' : ''} Waiting 1-2 Days`}
              </span>
              <button className="urgency-modal-close" onClick={() => setShowUnattendedAlert(false)}>✕</button>
            </div>
            <div className="urgency-modal-body">
              <p className="urgency-modal-message">
                {urgencyLevel === 'critical' && 'These messages have been waiting over 10 days. Please respond or politely decline.'}
                {urgencyLevel === 'high' && 'These messages are about to become critical. Please reply soon to keep the conversation going.'}
                {urgencyLevel === 'medium' && 'Someone took the time to reach out to you. A timely response would be appreciated.'}
                {urgencyLevel === 'pending' && 'You have new messages waiting for your reply.'}
              </p>
              <div className="urgency-modal-list">
                {unattendedConversations.map((item, idx) => (
                  <div key={idx} className="urgency-modal-item">
                    <div className={`urgency-modal-dot ${item.urgency}`} />
                    <div className="urgency-modal-item-info">
                      <span className="urgency-modal-name">{item.sender?.firstName} {item.sender?.lastName}</span>
                      <span className="urgency-modal-preview">{item.lastMessage?.text?.substring(0, 60)}{item.lastMessage?.text?.length > 60 ? '…' : ''}</span>
                    </div>
                    <span className={`urgency-modal-days ${item.urgency}`}>{item.lastMessage?.waitingDays}d</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="urgency-modal-footer">
              <button className="urgency-modal-cancel" onClick={() => setShowUnattendedAlert(false)}>Cancel</button>
              <button className="urgency-modal-goto" onClick={() => { setShowUnattendedAlert(false); navigate('/messages'); }}>Go to Messages →</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TopBar;
