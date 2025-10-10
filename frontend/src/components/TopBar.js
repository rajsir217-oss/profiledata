import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import socketService from '../services/socketService';
import onlineStatusService from '../services/onlineStatusService';
import MessagesDropdown from './MessagesDropdown';
import MessageModal from './MessageModal';
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
  const navigate = useNavigate();

  // Check login status and load user profile
  useEffect(() => {
    const checkLoginStatus = async () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');
      if (username && token) {
        setIsLoggedIn(true);
        setCurrentUser(username);
        
        // Load user profile for display name
        try {
          const response = await api.get(`/profile/${username}`);
          setUserProfile(response.data);
        } catch (error) {
          console.error('Error loading user profile:', error);
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

  // Fetch online count and unread messages
  useEffect(() => {
    if (!currentUser) return;

    const fetchCounts = async () => {
      try {
        // Get online count
        const onlineResponse = await onlineStatusService.getOnlineCount();
        setOnlineCount(onlineResponse);

        // Get unread message count
        const unreadResponse = await api.get(`/messages/unread-count/${currentUser}`);
        setUnreadCount(unreadResponse.data.unreadCount || 0);
      } catch (error) {
        console.error('Error fetching counts:', error);
      }
    };

    fetchCounts();

    // Update every 30 seconds
    const interval = setInterval(fetchCounts, 30000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = async () => {
    const username = currentUser;
    
    // Mark user as offline
    if (username) {
      console.log('⚪ Logout, marking user as offline');
      await onlineStatusService.goOffline(username);
    }
    
    // Disconnect WebSocket
    console.log('🔌 Disconnecting WebSocket');
    socketService.disconnect();
    
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
  
  const handleTestDashboard = () => {
    navigate('/test-dashboard');
  };

  if (!isLoggedIn) {
    return (
      <div className={`top-bar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="top-bar-content">
          <div className="top-bar-left">
            <button className="sidebar-toggle-btn" onClick={onSidebarToggle} title="Toggle Sidebar">
              ☰
            </button>
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
    <div className={`top-bar ${isOpen ? 'sidebar-open' : ''}`}>
      <div className="top-bar-content">
        <div className="top-bar-left">
          <button className="sidebar-toggle-btn" onClick={onSidebarToggle} title="Toggle Sidebar">
            ☰
          </button>
          <h4 className="app-title">Matrimonial Profile</h4>
          {onlineCount > 0 && (
            <div className="online-indicator">
              <span className="online-dot">🟢</span>
              <span className="online-count">{onlineCount} online</span>
            </div>
          )}
        </div>
        <div className="top-bar-right">
          {currentUser === 'admin' && (
            <button className="btn-test-dashboard" onClick={handleTestDashboard}>
              🧪 Test Dashboard
            </button>
          )}
          
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
            <span className="user-icon">👤</span>
            <span className="user-name">{userProfile ? getDisplayName(userProfile) : currentUser}</span>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
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
