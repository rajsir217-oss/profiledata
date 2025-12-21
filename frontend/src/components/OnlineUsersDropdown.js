import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './OnlineUsersDropdown.css';
import socketService from '../services/socketService';
import { getImageUrl } from '../utils/urlHelper';
import logger from '../utils/logger';

const OnlineUsersDropdown = ({ isOpen, onClose }) => {
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      console.log('📂 Dropdown opened, loading users...');
      loadOnlineUsers();
    } else {
      console.log('📪 Dropdown closed');
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  const loadOnlineUsers = async () => {
    setLoading(true);
    try {
      console.log('🔍 Loading online users...');
      const users = await socketService.getOnlineUsers();
      console.log('✅ Online users loaded:', users);
      logger.info('Online users loaded:', users);
      setOnlineUsers(users || []);
    } catch (error) {
      console.error('❌ Error loading online users:', error);
      logger.error('Error loading online users:', error);
      setOnlineUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (username) => {
    navigate(`/profile/${username}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="online-users-dropdown" ref={dropdownRef}>
      <div className="dropdown-header">
        <h4>🟢 Online Users</h4>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>

      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading online users...</p>
        </div>
      ) : onlineUsers.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">😴</span>
          <p>No other members online right now</p>
        </div>
      ) : (
        <div className="online-users-list">
          {onlineUsers.map((user) => (
            <div
              key={user.username}
              className="online-user-item"
              onClick={() => handleUserClick(user.username)}
            >
              <div className="user-avatar">
                {user.profileImage ? (
                  <img
                    src={getImageUrl(user.profileImage)}
                    alt={user.username}
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div
                  className="avatar-placeholder"
                  style={{ display: user.profileImage ? 'none' : 'flex' }}
                >
                  {user.firstName?.[0] || user.username?.[0]?.toUpperCase() || '?'}
                </div>
                <span className="online-indicator-dot">🟢</span>
              </div>
              <div className="user-info">
                <div className="user-name">
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.username}
                </div>
                <div className="user-meta">
                  @{user.username}
                  {user.role && user.role !== 'free_user' && (
                    <span className={`user-badge ${user.role}`}>
                      {user.role === 'admin' ? '👑 Admin' : 
                       user.role === 'moderator' ? '🛡️ Mod' : 
                       user.role}
                    </span>
                  )}
                </div>
              </div>
              <div className="view-profile-arrow" title="View profile">👁️</div>
            </div>
          ))}
        </div>
      )}

      <div className="dropdown-footer">
        <small>{onlineUsers.length} member{onlineUsers.length !== 1 ? 's' : ''} online</small>
      </div>
    </div>
  );
};

export default OnlineUsersDropdown;
