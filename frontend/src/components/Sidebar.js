import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const Sidebar = ({ onPinChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
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

  const handleMouseEnter = () => {
    if (!isPinned) {
      setIsOpen(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isPinned) {
      setIsOpen(false);
    }
  };

  const togglePin = () => {
    const newPinState = !isPinned;
    setIsPinned(newPinState);
    setIsOpen(newPinState);
    
    // Notify parent component about pin state change
    if (onPinChange) {
      onPinChange(newPinState);
    }
  };

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
        icon: '👤', 
        label: currentUser || '(profile picture)', 
        subLabel: 'Profile data',
        action: () => navigate(`/profile/${currentUser}`)
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
        label: 'My short lists', 
        action: () => navigate('/shortlists')
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
    <>
      {/* Sidebar Toggle Button (always visible) */}
      <div 
        className="sidebar-toggle"
        onMouseEnter={handleMouseEnter}
      >
        <div className="toggle-icon">☰</div>
      </div>

      {/* Sidebar Panel */}
      <div 
        className={`sidebar ${isOpen || isPinned ? 'open' : ''} ${isPinned ? 'pinned' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Pin Button */}
        <div className="sidebar-header">
          <button 
            className="pin-button" 
            onClick={togglePin}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            {isPinned ? '📌' : '📍'}
          </button>
        </div>

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

      {/* Overlay when sidebar is open (optional) */}
      {(isOpen || isPinned) && (
        <div className="sidebar-overlay" onClick={() => !isPinned && setIsOpen(false)} />
      )}
    </>
  );
};

export default Sidebar;
