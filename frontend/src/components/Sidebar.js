import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import { getApiUrl } from '../config/apiConfig';
import socketService from '../services/socketService';
import { getShortName } from '../utils/userDisplay';
import './Sidebar.css';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userStatus, setUserStatus] = useState('active'); // Default to active
  const navigate = useNavigate();

  // Check login status and user activation status
  useEffect(() => {
    const checkLoginStatus = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      const status = localStorage.getItem('userStatus');
      
      if (username && token) {
        setIsLoggedIn(true);
        setCurrentUser(username);
        setUserStatus(status || 'pending');
        
        // Load user profile for display name (pass requester to avoid PII masking)
        try {
          const response = await api.get(`/profile/${username}?requester=${username}`);
          setUserProfile(response.data);
        } catch (error) {
          console.error('Error loading user profile:', error);
        }
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setUserProfile(null);
        setUserStatus('pending');
      }
    };

    checkLoginStatus();

    // Listen for login/logout events
    window.addEventListener('loginStatusChanged', checkLoginStatus);
    window.addEventListener('storage', checkLoginStatus);

    return () => {
      window.removeEventListener('loginStatusChanged', checkLoginStatus);
      window.removeEventListener('storage', checkLoginStatus);
    };
  }, []);

  const handleLogin = () => {
    navigate('/login');
  };

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
    setUserProfile(null);
    setUserStatus('pending');
    // Dispatch event to notify other components (TopBar, etc.)
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    navigate('/login');
  };

  // Helper function to handle menu item clicks (auto-close after selection)
  const handleMenuClick = (action) => {
    if (action) {
      action(); // Execute the navigation action
      
      // Always auto-close sidebar after menu selection for better UX
      if (onToggle) {
        onToggle();
      }
    }
  };

  // Build menu items based on user role
  const buildMenuItems = () => {
    // Check if user is activated (admin is always active)
    const isActive = currentUser === 'admin' || userStatus === 'active';
    // Debug logging removed - uncomment if needed for debugging
    // console.log('🔍 Sidebar Debug:', { isLoggedIn, currentUser, userStatus, isActive });
    
    if (!isLoggedIn) {
      return [
        { 
          icon: '🔑', 
          label: 'Login', 
          action: handleLogin
        },
        { 
          icon: '📝', 
          label: 'Register', 
          action: () => navigate('/register')
        },
      ];
    }

    // isActive already declared above with debug logging

    const items = [
      { 
        icon: '🏠', 
        label: 'My Dashboard', 
        subLabel: 'Overview & Activity',
        action: () => navigate('/dashboard'),
        disabled: !isActive
      },
      { 
        icon: '👤', 
        label: userProfile ? getShortName(userProfile) : (currentUser || 'Profile'), 
        subLabel: 'Profile data',
        action: () => navigate(`/profile/${currentUser}`),
        disabled: false, // Always enabled - users need to access their profile
        profileImage: true // Flag to render profile image instead of icon
      },
      { 
        icon: '🔍', 
        label: 'Search Profiles', 
        subLabel: 'Find matches',
        action: () => navigate('/search'),
        disabled: !isActive
      },
      { 
        icon: '💬', 
        label: 'My Messages', 
        subLabel: 'Chat with matches',
        action: () => navigate('/messages'),
        disabled: !isActive
      },
      { 
        icon: '🔒', 
        label: 'Privacy & Data', 
        subLabel: 'Manage PII access',
        action: () => navigate('/pii-management'),
        disabled: !isActive
      },
    ];

    // Add Admin section for admin user
    if (currentUser === 'admin') {
      // === CORE ADMIN SECTION ===
      items.push({ isHeader: true, label: 'ADMIN SECTION' });
      
      items.push({
        icon: '🔐',
        label: 'Admin Dashboard',
        subLabel: 'Manage all users',
        action: () => navigate('/admin')
      });
      
      items.push({
        icon: '👥',
        label: 'User Management',
        subLabel: 'Manage users',
        action: () => navigate('/user-management')
      });
      
      items.push({
        icon: '🎭',
        label: 'Role Management',
        subLabel: 'Roles & Permissions',
        action: () => navigate('/role-management')
      });
      
      // === MONITORING & AUTOMATION ===
      items.push({ isHeader: true, label: 'MONITORING & AUTOMATION' });
      
      items.push({
        icon: '📧',
        label: 'Email Analytics',
        subLabel: 'Track opens & clicks',
        action: () => navigate('/email-analytics')
      });
      
      items.push({
        icon: '📊',
        label: 'Activity Logs',
        subLabel: 'Monitor user activities',
        action: () => navigate('/activity-logs')
      });
      
      items.push({
        icon: '⏸️',
        label: 'Pause Analytics',
        subLabel: 'Track pause patterns',
        action: () => navigate('/pause-analytics')
      });
      
      items.push({
        icon: '📧',
        label: 'Invitations',
        subLabel: 'Manage user invitations',
        action: () => navigate('/invitations')
      });
      
      items.push({
        icon: '🗓️',
        label: 'Scheduler & Jobs',
        subLabel: 'Manage automated tasks',
        action: () => navigate('/dynamic-scheduler')
      });
      
      items.push({
        icon: '🔔',
        label: 'Notification Management',
        subLabel: 'Queue, logs & templates',
        action: () => navigate('/notification-management')
      });
      
      items.push({
        icon: '📧',
        label: 'Email Templates',
        subLabel: 'Preview & manage templates',
        action: () => navigate('/email-templates')
      });
      
      items.push({
        icon: '📧',
        label: 'Saved Search Notifications',
        subLabel: 'Override & manage user alerts',
        action: () => navigate('/admin/notifications')
      });
      
      // === CONFIGURATION ===
      items.push({ isHeader: true, label: 'CONFIGURATION' });
      
      items.push({ 
        icon: '⚙️', 
        label: 'Settings', 
        subLabel: 'App preferences',
        action: () => navigate('/preferences'),
        disabled: !isActive
      });
      
      // === TESTING & SUPPORT ===
      items.push({ isHeader: true, label: 'TESTING & SUPPORT' });
      
      items.push({
        icon: '🔔',
        label: 'Notification Tester',
        subLabel: 'Test & debug notifications',
        action: () => navigate('/notification-tester')
      });
      
      items.push({
        icon: '🧪',
        label: 'Test Dashboard',
        subLabel: 'Run & schedule tests',
        action: () => navigate('/test-dashboard')
      });
      
      items.push({
        icon: '📨',
        label: 'Contact Support',
        subLabel: 'Manage user inquiries',
        action: () => navigate('/admin/contact')
      });
    }

    // Show Settings for non-admin users (admins have it in their sections)
    if (isLoggedIn && currentUser !== 'admin' && localStorage.getItem('userRole') !== 'moderator') {
      items.push({ 
        icon: '⚙️', 
        label: 'Settings', 
        subLabel: 'Preferences, Theme & Notifications',
        action: () => navigate('/preferences'),
        disabled: !isActive
      });
    }

    // Add Contact Us before logout
    items.push({ 
      icon: '📧', 
      label: 'Contact Us', 
      subLabel: 'Get in touch with support',
      action: () => navigate('/contact')
    });

    // Add logout at the end
    items.push({ 
      icon: '🚪', 
      label: 'Logout', 
      action: handleLogout
    });

    return items;
  };

  const menuItems = buildMenuItems();
  // console.log('📋 Menu Items Count:', menuItems.length);

  return (
    <>
      {/* Backdrop - Click outside to close sidebar */}
      {!isCollapsed && (
        <div 
          className="sidebar-backdrop"
          onClick={() => onToggle()}
          aria-label="Close sidebar"
        />
      )}
      
      <div 
        className={`sidebar ${!isCollapsed ? 'open' : ''}`}
      >

          {/* Menu Items */}
          <div className="sidebar-menu">
          {menuItems.length === 0 && (
            <div style={{padding: '20px', color: '#666'}}>
              No menu items available
            </div>
          )}
          {menuItems.map((item, index) => (
            <div 
              key={index} 
              className={`menu-item ${item.isHeader ? 'menu-header' : ''} ${item.disabled ? 'disabled' : ''}`}
              onClick={item.disabled ? undefined : () => handleMenuClick(item.action)}
              title={item.disabled ? 'Please activate your account to access this feature' : ''}
            >
              {item.profileImage ? (
                <div className="menu-icon profile-icon">
                  {userProfile?.images?.[0] ? (
                    <img src={userProfile.images[0]} alt={currentUser} className="profile-avatar" />
                  ) : (
                    <div className="profile-avatar-placeholder">
                      {userProfile?.firstName?.[0] || currentUser?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="menu-icon">{item.icon}</div>
              )}
              <div className="menu-content">
                <div className="menu-label">{item.label}</div>
                {item.subLabel && (
                  <div className="menu-sublabel">{item.subLabel}</div>
                )}
              </div>
              {item.disabled && (
                <div className="disabled-badge">🔒</div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Links */}
        <div className="sidebar-footer">
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/help'))}>📚 Help</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/l3v3l-info'))}>🦋 L3V3L</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/privacy'))}>Privacy</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/about'))}>About Us</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/trademark'))}>Trademark</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/testimonials'))}>💬 Testimonials</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => handleMenuClick(() => navigate('/contact'))}>📧 Contact Us</span>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
