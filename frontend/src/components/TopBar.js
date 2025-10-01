import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './TopBar.css';

const TopBar = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();

  // Check login status
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

    // Listen for storage changes (login/logout from other tabs)
    window.addEventListener('storage', checkLoginStatus);
    
    // Custom event for same-tab login/logout
    window.addEventListener('loginStatusChanged', checkLoginStatus);

    return () => {
      window.removeEventListener('storage', checkLoginStatus);
      window.removeEventListener('loginStatusChanged', checkLoginStatus);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('username');
    localStorage.removeItem('token');
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

  if (!isLoggedIn) {
    return (
      <div className="top-bar">
        <div className="top-bar-content">
          <div className="top-bar-left">
            <h4 className="app-title">Matrimonial Profile</h4>
          </div>
          <div className="top-bar-right">
            <button className="btn-login" onClick={handleLogin}>
              🔑 Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="top-bar">
      <div className="top-bar-content">
        <div className="top-bar-left">
          <h4 className="app-title">Matrimonial Profile</h4>
        </div>
        <div className="top-bar-right">
          <div className="user-info" onClick={handleProfile}>
            <span className="user-icon">👤</span>
            <span className="user-name">{currentUser}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            🚪 Logout
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
