import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import axios from 'axios';
import './UserManagement.css';

// Create admin API client without baseURL prefix
const adminApi = axios.create({
  baseURL: 'http://localhost:8000'
});

// Add auth token interceptor
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState('');
  const navigate = useNavigate();

  const currentUser = localStorage.getItem('username');

  // Check if user is admin
  useEffect(() => {
    if (currentUser !== 'admin') {
      navigate('/dashboard');
      return;
    }
    loadUsers();
  }, [page, statusFilter, roleFilter, searchTerm]);

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (statusFilter) params.append('status', statusFilter);
      if (roleFilter) params.append('role', roleFilter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await adminApi.get(`/api/admin/users?${params.toString()}`);
      
      setUsers(response.data.users || []);
      setTotalPages(response.data.pages || 1);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleAssignRole = async (username, newRole, reason) => {
    try {
      await adminApi.post(`/api/admin/users/${username}/assign-role`, {
        role_name: newRole,
        reason: reason || 'Role updated by admin'
      });
      
      setShowRoleModal(false);
      setSelectedUser(null);
      loadUsers();
      alert(`Role assigned successfully to ${username}`);
    } catch (err) {
      console.error('Error assigning role:', err);
      alert('Failed to assign role: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleUserAction = async (username, action, reason) => {
    try {
      await adminApi.post(`/api/admin/users/${username}/manage`, {
        action: action,
        reason: reason || `${action} by admin`
      });
      
      setShowActionModal(false);
      setSelectedUser(null);
      setActionType('');
      loadUsers();
      alert(`User ${action}d successfully`);
    } catch (err) {
      console.error('Error performing action:', err);
      alert('Failed to perform action: ' + (err.response?.data?.detail || err.message));
    }
  };

  const openRoleModal = (user) => {
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const openActionModal = (user, action) => {
    setSelectedUser(user);
    setActionType(action);
    setShowActionModal(true);
  };

  const getRoleBadgeClass = (role) => {
    const roleClasses = {
      'admin': 'role-admin',
      'moderator': 'role-moderator',
      'premium_user': 'role-premium',
      'free_user': 'role-free'
    };
    return roleClasses[role] || 'role-free';
  };

  const getStatusBadgeClass = (status) => {
    const statusClasses = {
      'active': 'status-active',
      'inactive': 'status-inactive',
      'suspended': 'status-suspended',
      'banned': 'status-banned',
      'pending_verification': 'status-pending'
    };
    return statusClasses[status] || 'status-inactive';
  };

  if (loading && users.length === 0) {
    return (
      <div className="user-management-loading">
        <div className="spinner"></div>
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="user-management-container">
      <div className="user-management-header">
        <h1>👥 User Management</h1>
        <p>Manage user roles, permissions, and account status</p>
      </div>

      {/* Filters */}
      <div className="user-management-filters">
        <input
          type="text"
          placeholder="🔍 Search by username, email, or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
          <option value="pending_verification">Pending Verification</option>
        </select>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
          <option value="premium_user">Premium User</option>
          <option value="free_user">Free User</option>
        </select>

        <button onClick={loadUsers} className="btn-refresh">
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={loadUsers}>Retry</button>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.username}>
                <td>
                  <strong>{user.username}</strong>
                </td>
                <td>{user.firstName} {user.lastName}</td>
                <td>{user.email}</td>
                <td>
                  <span className={`role-badge ${getRoleBadgeClass(user.role_name)}`}>
                    {user.role_name || 'free_user'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${getStatusBadgeClass(user.status?.status)}`}>
                    {user.status?.status || 'unknown'}
                  </span>
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => openRoleModal(user)}
                      className="btn-action btn-role"
                      title="Assign Role"
                    >
                      🎭
                    </button>
                    <button
                      onClick={() => navigate(`/profile/${user.username}`)}
                      className="btn-action btn-view"
                      title="View Profile"
                    >
                      👁️
                    </button>
                    <button
                      onClick={() => openActionModal(user, 'activate')}
                      className="btn-action btn-activate"
                      title="Activate"
                      disabled={user.status?.status === 'active'}
                    >
                      ✅
                    </button>
                    <button
                      onClick={() => openActionModal(user, 'suspend')}
                      className="btn-action btn-suspend"
                      title="Suspend"
                    >
                      ⏸️
                    </button>
                    <button
                      onClick={() => openActionModal(user, 'ban')}
                      className="btn-action btn-ban"
                      title="Ban"
                    >
                      🚫
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="btn-page"
        >
          ← Previous
        </button>
        <span className="page-info">
          Page {page} of {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="btn-page"
        >
          Next →
        </button>
      </div>

      {/* Role Assignment Modal */}
      {showRoleModal && selectedUser && (
        <RoleModal
          user={selectedUser}
          onClose={() => {
            setShowRoleModal(false);
            setSelectedUser(null);
          }}
          onAssign={handleAssignRole}
        />
      )}

      {/* Action Modal */}
      {showActionModal && selectedUser && (
        <ActionModal
          user={selectedUser}
          action={actionType}
          onClose={() => {
            setShowActionModal(false);
            setSelectedUser(null);
            setActionType('');
          }}
          onConfirm={handleUserAction}
        />
      )}
    </div>
  );
};

// Role Assignment Modal Component
const RoleModal = ({ user, onClose, onAssign }) => {
  const [selectedRole, setSelectedRole] = useState(user.role_name || 'free_user');
  const [reason, setReason] = useState('');

  const roles = [
    { value: 'admin', label: 'Admin', description: 'Full system access' },
    { value: 'moderator', label: 'Moderator', description: 'User & content moderation' },
    { value: 'premium_user', label: 'Premium User', description: 'Enhanced features' },
    { value: 'free_user', label: 'Free User', description: 'Basic access' }
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>🎭 Assign Role to {user.username}</h2>
        <p className="modal-subtitle">Current role: <strong>{user.role_name}</strong></p>

        <div className="role-options">
          {roles.map((role) => (
            <label key={role.value} className="role-option">
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={selectedRole === role.value}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <div className="role-info">
                <strong>{role.label}</strong>
                <span>{role.description}</span>
              </div>
            </label>
          ))}
        </div>

        <textarea
          placeholder="Reason for role change (optional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="reason-input"
          rows="3"
        />

        <div className="modal-actions">
          <button onClick={onClose} className="btn-cancel">
            Cancel
          </button>
          <button
            onClick={() => onAssign(user.username, selectedRole, reason)}
            className="btn-confirm"
            disabled={selectedRole === user.role_name}
          >
            Assign Role
          </button>
        </div>
      </div>
    </div>
  );
};

// Action Confirmation Modal Component
const ActionModal = ({ user, action, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');

  const actionLabels = {
    'activate': { 
      title: 'Activate User Account', 
      icon: '✅', 
      color: '#10b981',
      description: 'This will grant the user full access to the platform.'
    },
    'suspend': { 
      title: 'Suspend User Account', 
      icon: '⏸️', 
      color: '#f59e0b',
      description: 'This will temporarily restrict the user\'s access.'
    },
    'ban': { 
      title: 'Ban User Account', 
      icon: '🚫', 
      color: '#ef4444',
      description: 'This will permanently block the user from the platform.'
    }
  };

  const actionInfo = actionLabels[action] || {};

  return (
    <div className="action-modal-overlay" onClick={onClose}>
      <div className="action-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header with User Info - Purple Theme */}
        <div className="action-modal-header">
          <div className="action-modal-user-info">
            <div className="action-modal-avatar">
              {user.username.charAt(0).toUpperCase()}
            </div>
            <div className="action-modal-user-details">
              <h3>{user.username}</h3>
              <p>{user.email || user.contactEmail || 'No email'}</p>
            </div>
          </div>
          <button className="action-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="action-modal-body">
          <div className="action-modal-title">
            <span className="action-icon" style={{ color: actionInfo.color }}>
              {actionInfo.icon}
            </span>
            <h2>{actionInfo.title}</h2>
          </div>
          
          <p className="action-modal-description">
            {actionInfo.description}
          </p>

          <div className="action-modal-warning" style={{ 
            borderLeftColor: actionInfo.color,
            background: `${actionInfo.color}15`
          }}>
            <strong style={{ color: actionInfo.color }}>⚠️ Confirmation Required</strong>
            <p>Are you sure you want to <strong>{action}</strong> this user?</p>
          </div>

          <div className="action-modal-form">
            <label>Reason (optional)</label>
            <textarea
              placeholder={`Enter reason for ${action}ing this user...`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="action-reason-input"
              rows="4"
            />
          </div>

          <div className="action-modal-footer">
            <button onClick={onClose} className="action-btn-cancel">
              Cancel
            </button>
            <button
              onClick={() => onConfirm(user.username, action, reason)}
              className="action-btn-confirm"
              style={{ backgroundColor: actionInfo.color }}
            >
              {actionInfo.icon} Confirm {action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
