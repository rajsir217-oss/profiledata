import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import { getDisplayName, getShortName } from '../utils/userDisplay';
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
        `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/users'}/online-status/${username}/offline`,
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
    
    // Dispatch event to notify other components (TopBar, etc.)
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    navigate('/login');
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
        icon: '💬', 
        label: 'My Messages', 
        subLabel: 'Chat with matches',
        action: () => navigate('/messages'),
        disabled: !isActive
      },
      { 
        icon: '🔍', 
        label: 'Search Profiles', 
        subLabel: 'Find matches',
        action: () => navigate('/search'),
        disabled: !isActive
      },
      { 
        icon: '🦋', 
        label: 'My L3V3L Matches', 
        subLabel: 'Love, Loyalty, Laughter+',
        action: () => navigate('/l3v3l-matches'),
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
      items.push({
        icon: '━━━',
        label: 'ADMIN SECTION',
        subLabel: '',
        action: () => {},
        isHeader: true
      });
      
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
      
      items.push({
        icon: '🧪',
        label: 'Test Dashboard',
        subLabel: 'Run & schedule tests',
        action: () => navigate('/test-dashboard')
      });
    }

    // Add Settings before logout
    items.push({ 
      icon: '⚙️', 
      label: 'Settings', 
      subLabel: 'Preferences & Theme',
      action: () => navigate('/preferences'),
      disabled: !isActive
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
              onClick={item.disabled ? undefined : item.action}
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
          <span className="footer-link" onClick={() => navigate('/l3v3l-info')}>🦋 L3V3L</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => navigate('/privacy')}>Privacy</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => navigate('/about')}>About Us</span>
          <span className="footer-separator">|</span>
          <span className="footer-link" onClick={() => navigate('/trademark')}>Trademark</span>
        </div>
    </div>
  );
};

export default Sidebar;
