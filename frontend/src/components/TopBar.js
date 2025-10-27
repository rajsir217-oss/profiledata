import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import { getApiUrl } from '../config/apiConfig';
import { getImageUrl } from '../utils/urlHelper';
import MessagesDropdown from './MessagesDropdown';
import MessageModal from './MessageModal';
import Logo from './Logo';
import StatCapsuleGroup from './StatCapsuleGroup';
import { getDisplayName } from '../utils/userDisplay';
import './TopBar.css';

const TopBar = ({ onSidebarToggle, isOpen }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [onlineCount, setOnlineCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showMessagesDropdown, setShowMessagesDropdown] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [currentTheme, setCurrentTheme] = useState('light');
  const [userStats, setUserStats] = useState({
    views: 0,
    likes: 0,
    approvals: 0
  });
  const [violations, setViolations] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const navigate = useNavigate();

  // Listen for window resize to toggle mobile view
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Detect current theme
  useEffect(() => {
    const detectTheme = () => {
      const bodyClass = document.body.className;
      if (bodyClass.includes('theme-dark')) {
        setCurrentTheme('dark');
      } else {
        setCurrentTheme('light');
      }
    };

    detectTheme();
    
    // Listen for theme changes
    const observer = new MutationObserver(detectTheme);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
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
            console.error('❌ SECURITY: Token/username mismatch detected!');
            console.error('   Stored username:', username);
            console.error('   Token username:', tokenUsername);
            console.error('   Logging out for security...');
            
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
          console.log('✅ Token validation passed for user:', username);
          setIsLoggedIn(true);
          setCurrentUser(username);
          
          // Load user profile for display name (pass requester to avoid PII masking)
          try {
            const response = await api.get(`/profile/${username}?requester=${username}`);
            setUserProfile(response.data);
            
            // Load user stats for capsules
            loadUserStats(username);
            
            // Load user violations
            loadUserViolations(username);
          } catch (profileError) {
            // Profile fetch failed - this is OK, don't logout
            // The Profile component will handle displaying the profile
            console.warn('⚠️ Could not load user profile in TopBar (non-critical):', profileError?.message || profileError);
            console.warn('   User stays logged in, profile will load from Profile component');
            // IMPORTANT: Do NOT logout here - profile fetch can fail for many reasons
          }
        } catch (error) {
          // This catch is for JWT token decoding errors only
          console.error('❌ Error decoding or validating JWT token:', error);
          console.error('   This is a critical error - token is invalid or corrupted');
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

  // Listen for WebSocket updates (online count and unread messages)
  useEffect(() => {
    if (!currentUser) return;

    // Update online count from WebSocket
    const handleOnlineCountUpdate = (data) => {
      setOnlineCount(data.count);
    };

    // Update unread count from WebSocket
    const handleUnreadUpdate = (data) => {
      setUnreadCount(data.totalUnread || 0);
    };

    const handleUnreadCountsLoaded = (data) => {
      setUnreadCount(data.totalUnread || 0);
    };

    socketService.on('online_count_update', handleOnlineCountUpdate);
    socketService.on('unread_update', handleUnreadUpdate);
    socketService.on('unread_counts_loaded', handleUnreadCountsLoaded);

    // Get initial counts
    setUnreadCount(socketService.getTotalUnread());

    return () => {
      socketService.off('online_count_update', handleOnlineCountUpdate);
      socketService.off('unread_update', handleUnreadUpdate);
      socketService.off('unread_counts_loaded', handleUnreadCountsLoaded);
    };
  }, [currentUser]);

  const handleLogout = async () => {
    const username = currentUser;
    
    // Disconnect WebSocket
    console.log('🔌 Disconnecting WebSocket');
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
  
  const handleTestDashboard = () => {
    navigate('/test-dashboard');
  };

  // Load user stats for capsules
  const loadUserStats = async (username) => {
    try {
      // Fetch stats from various endpoints
      const [viewsRes, favoritesRes] = await Promise.all([
        api.get(`/profile-views/${username}`).catch(() => ({ data: { totalViews: 0 } })),
        api.get(`/their-favorites/${username}`).catch(() => ({ data: { users: [] } }))
      ]);

      setUserStats({
        views: viewsRes.data?.totalViews || 0,
        likes: favoritesRes.data?.users?.length || 0,
        approvals: 0 // Placeholder - can be connected to verification status
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
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
      console.error('Error loading user violations:', error);
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
            <span className="logo-text">L3V3L</span>
          </div>
          
          {onlineCount > 0 && (
            <div className="online-indicator" title={`${onlineCount} users online`}>
              <span className="online-dot">🟢</span>
              <span className="online-count">{onlineCount}</span>
            </div>
          )}
        </div>
        <div className="top-bar-right">
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
            <span className="user-name">{userProfile ? getDisplayName(userProfile) : currentUser}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout} title="Logout">
            🚪 Logout
          </button>
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
    </div>
  );
};

export default TopBar;
