import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ isCollapsed, onToggle }) => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  // Check login status on mount and listen for changes
  useEffect(() => {
    const checkLoginStatus = () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      if (username && token) {
        setIsLoggedIn(true);
        setCurrentUser(username);
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
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

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
    setIsLoggedIn(false);
    setCurrentUser(null);
    
    // Dispatch event to notify other components (TopBar, etc.)
    window.dispatchEvent(new Event('loginStatusChanged'));
    
    navigate('/login');
  };

  // Build menu items based on user role
  const buildMenuItems = () => {
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

    const items = [
      { 
        icon: '🏠', 
        label: 'My Dashboard', 
        subLabel: 'Overview & Activity',
        action: () => navigate('/dashboard')
      },
      { 
        icon: '👤', 
        label: currentUser || '(profile picture)', 
        subLabel: 'Profile data',
        action: () => navigate(`/profile/${currentUser}`)
      },
      { 
        icon: '⚙️', 
        label: 'My Preferences', 
        subLabel: 'Theme & Settings',
        action: () => navigate('/preferences')
      },
      { 
        icon: '🔍', 
        label: 'Search Profiles', 
        subLabel: 'Find matches',
        action: () => navigate('/search')
      },
      { 
        icon: '🔍', 
        label: 'My matching criteria', 
        action: () => navigate('/matching-criteria')
      },
      { 
        icon: '💑', 
        label: 'My top 3 matches', 
        action: () => navigate('/top-matches')
      },
      { 
        icon: '⭐', 
        label: 'My Favorites', 
        subLabel: 'Profiles I liked',
        action: () => navigate('/favorites')
      },
      { 
        icon: '📋', 
        label: 'My Shortlist', 
        subLabel: 'Profiles to consider',
        action: () => navigate('/shortlist')
      },
      { 
        icon: '❌', 
        label: 'My Exclusions', 
        subLabel: 'Profiles to hide',
        action: () => navigate('/exclusions')
      },
      { 
        icon: '💬', 
        label: 'My Messages', 
        subLabel: 'Chat with matches',
        action: () => navigate('/messages')
      },
      { 
        icon: '📨', 
        label: 'My Requests', 
        subLabel: 'PII access requests',
        action: () => navigate('/requests')
      },
    ];

    // Add Admin Dashboard for admin user
    if (currentUser === 'admin') {
      items.push({
        icon: '🔐',
        label: 'Admin Dashboard',
        subLabel: 'Manage all users',
        action: () => navigate('/admin')
      });
      
      items.push({
        icon: '🧪',
        label: 'Test Dashboard',
        subLabel: 'Run & schedule tests',
        action: () => navigate('/test-dashboard')
      });
    }

    // Add logout at the end
    items.push({ 
      icon: '🚪', 
      label: 'Logout', 
      action: handleLogout
    });

    return items;
  };

  const menuItems = buildMenuItems();

  return (
    <div 
      className={`sidebar ${!isCollapsed ? 'open' : ''}`}
    >

        {/* Menu Items */}
        <div className="sidebar-menu">
          {menuItems.map((item, index) => (
            <div 
              key={index} 
              className="menu-item"
              onClick={item.action}
            >
              <div className="menu-icon">{item.icon}</div>
              <div className="menu-content">
                <div className="menu-label">{item.label}</div>
                {item.subLabel && (
                  <div className="menu-sublabel">{item.subLabel}</div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Links */}
        <div className="sidebar-footer">
          <a href="#privacy" className="footer-link">Privacy</a>
          <span className="footer-separator">|</span>
          <a href="#about" className="footer-link">about us</a>
          <span className="footer-separator">|</span>
          <a href="#trademark" className="footer-link">Registed Trade mark</a>
        </div>
    </div>
  );
};

export default Sidebar;
