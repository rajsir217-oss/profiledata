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
  const [selectedUsers, setSelectedUsers] = useState([]); // For bulk operations
  const [sortField, setSortField] = useState('username'); // Sort field
  const [sortOrder, setSortOrder] = useState('asc'); // Sort order
  const [showBulkRoleModal, setShowBulkRoleModal] = useState(false); // Bulk role modal
  const [successMessage, setSuccessMessage] = useState(''); // Success notification
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
      
      // Check if token expired
      if (err.response?.status === 401) {
        const errorMsg = err.response?.data?.detail || '';
        if (errorMsg.includes('expired') || errorMsg.includes('Invalid token')) {
          // Clear localStorage and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userStatus');
          alert('Your session has expired. Please login again.');
          navigate('/login');
          return;
        }
      }
      
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
      
      setSuccessMessage(`✅ Successfully assigned ${newRole} role to ${username}`);
      setError('');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Failed to assign role:', err);
      setError(`Failed to assign role: ${err.response?.data?.detail || err.message}`);
    }
  };

  const handleUserAction = async (username, action, reason) => {
    await adminApi.post(`/api/admin/users/${username}/manage`, {
      action: action,
      reason: reason || `${action} by admin`
    });
  };

  const openRoleModal = (user) => {
    // For now, just show a simple prompt for role selection
    // We'll make this a quick inline action
    const roles = ['admin', 'moderator', 'premium_user', 'free_user'];
    const roleLabels = {
      'admin': 'Admin',
      'moderator': 'Moderator', 
      'premium_user': 'Premium User',
      'free_user': 'Free User'
    };
    
    // Show role options inline - we'll create a better UX
    // For now, let's keep the modal but make it simpler
    setSelectedUser(user);
    setShowRoleModal(true);
  };

  const openActionModal = async (user, action) => {
    // Execute action directly without modal
    try {
      await handleUserAction(user.username, action, `${action} by admin`);
      loadUsers();
      setSuccessMessage(`✅ Successfully ${action}ed user ${user.username}`);
      setError('');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error(`Failed to ${action} user:`, error);
      setError(`Failed to ${action} user: ${error.response?.data?.detail || error.message}`);
    }
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

  // Sorting function
  const handleSort = (field) => {
    if (sortField === field) {
      // Toggle sort order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Sort users
  const sortedUsers = [...users].sort((a, b) => {
    let aValue = a[sortField];
    let bValue = b[sortField];

    // Handle nested status field
    if (sortField === 'status') {
      aValue = a.status?.status || '';
      bValue = b.status?.status || '';
    }

    // Handle date fields
    if (sortField === 'created_at') {
      aValue = new Date(aValue || 0);
      bValue = new Date(bValue || 0);
    }

    // String comparison
    if (typeof aValue === 'string') {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }

    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  // Bulk selection functions
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUsers(users.map(u => u.username));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (username) => {
    if (selectedUsers.includes(username)) {
      setSelectedUsers(selectedUsers.filter(u => u !== username));
    } else {
      setSelectedUsers([...selectedUsers, username]);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      setError('Please select users first');
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      // Perform bulk action
      for (const username of selectedUsers) {
        try {
          await handleUserAction(username, action, `Bulk ${action}`);
          successCount++;
        } catch (error) {
          console.error(`Failed to ${action} ${username}:`, error);
          failCount++;
        }
      }
      
      setSelectedUsers([]);
      loadUsers();

      // Show success message
      if (failCount === 0) {
        setSuccessMessage(`✅ Successfully ${action}ed ${successCount} user(s)`);
        setError('');
      } else {
        setSuccessMessage(`⚠️ Bulk ${action}: ${successCount} success, ${failCount} failed`);
      }

      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Bulk action error:', error);
      setError(`Bulk ${action} failed. Please try again.`);
    }
  };

  const handleBulkRoleAssignment = async (newRole, reason) => {
    if (selectedUsers.length === 0) {
      setError('Please select users first');
      return;
    }

    // Filter out admin user from bulk operations
    const usersToUpdate = selectedUsers.filter(username => username !== 'admin');
    const skippedAdmin = selectedUsers.length !== usersToUpdate.length;

    if (usersToUpdate.length === 0) {
      setError('Cannot change admin user role. Please select other users.');
      return;
    }

    try {
      let successCount = 0;
      let failCount = 0;

      for (const username of usersToUpdate) {
        try {
          await adminApi.post(`/api/admin/users/${username}/assign-role`, {
            role_name: newRole,
            reason: reason || `Bulk role assignment to ${newRole}`
          });
          successCount++;
        } catch (error) {
          console.error(`Failed to assign role to ${username}:`, error);
          failCount++;
        }
      }

      setShowBulkRoleModal(false);
      setSelectedUsers([]);
      loadUsers();
      
      // Show success message in the UI instead of alert
      let message = '';
      if (skippedAdmin && failCount === 0) {
        message = `✅ Successfully assigned role to ${successCount} user(s). Admin user skipped.`;
      } else if (failCount === 0) {
        message = `✅ Successfully assigned role to ${successCount} user(s)`;
      } else if (skippedAdmin) {
        message = `⚠️ Bulk role assignment: ${successCount} success, ${failCount} failed. Admin user skipped.`;
      } else {
        message = `⚠️ Bulk role assignment completed: ${successCount} success, ${failCount} failed`;
      }
      
      setSuccessMessage(message);
      setError(''); // Clear any previous errors
      
      // Auto-hide success message after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (error) {
      console.error('Bulk role assignment error:', error);
      setError('Bulk role assignment failed. Please try again.');
    }
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
          <option value="pending">Pending Verification</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="banned">Banned</option>
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

      {successMessage && (
        <div className="success-message">
          <p>{successMessage}</p>
          <button onClick={() => setSuccessMessage('')}>✕</button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {selectedUsers.length > 0 && (
        <div className="bulk-actions-bar">
          <span className="bulk-selected-count">
            {selectedUsers.length} user(s) selected
          </span>
          <div className="bulk-action-buttons">
            <button onClick={() => setShowBulkRoleModal(true)} className="bulk-btn bulk-role">
              🎭 Assign Role
            </button>
            <button onClick={() => handleBulkAction('activate')} className="bulk-btn bulk-activate">
              ✅ Activate
            </button>
            <button onClick={() => handleBulkAction('suspend')} className="bulk-btn bulk-suspend">
              ⏸️ Suspend
            </button>
            <button onClick={() => handleBulkAction('ban')} className="bulk-btn bulk-ban">
              🚫 Ban
            </button>
            <button onClick={() => setSelectedUsers([])} className="bulk-btn bulk-clear">
              ✕ Clear Selection
            </button>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  checked={selectedUsers.length === users.length && users.length > 0}
                  onChange={handleSelectAll}
                  title="Select all"
                />
              </th>
              <th className={`sortable ${sortField === 'username' ? 'active-sort' : ''}`} onClick={() => handleSort('username')}>
                Username
                {sortField === 'username' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th className={`sortable ${sortField === 'firstName' ? 'active-sort' : ''}`} onClick={() => handleSort('firstName')}>
                Name
                {sortField === 'firstName' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th>Email</th>
              <th className={`sortable ${sortField === 'role_name' ? 'active-sort' : ''}`} onClick={() => handleSort('role_name')}>
                Role
                {sortField === 'role_name' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th className={`sortable ${sortField === 'status' ? 'active-sort' : ''}`} onClick={() => handleSort('status')}>
                Status
                {sortField === 'status' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th className={`sortable ${sortField === 'created_at' ? 'active-sort' : ''}`} onClick={() => handleSort('created_at')}>
                Created
                {sortField === 'created_at' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((user) => (
              <tr key={user.username} className={selectedUsers.includes(user.username) ? 'selected-row' : ''}>
                <td className="td-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedUsers.includes(user.username)}
                    onChange={() => handleSelectUser(user.username)}
                    disabled={user.username === 'admin'}
                    title={user.username === 'admin' ? 'Admin user cannot be modified' : ''}
                  />
                </td>
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
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => openRoleModal(user)}
                      className="btn-action btn-role"
                      title={user.username === currentUser ? 'Cannot modify your own role' : 'Assign Role'}
                      disabled={user.username === currentUser}
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
                      title={user.username === currentUser ? 'Cannot modify your own account' : 'Activate'}
                      disabled={user.status?.status === 'active' || user.username === currentUser}
                    >
                      ✅
                    </button>
                    <button
                      onClick={() => openActionModal(user, 'suspend')}
                      className="btn-action btn-suspend"
                      title={user.username === currentUser ? 'Cannot suspend your own account' : 'Suspend'}
                      disabled={user.username === currentUser}
                    >
                      ⏸️
                    </button>
                    <button
                      onClick={() => openActionModal(user, 'ban')}
                      className="btn-action btn-ban"
                      title={user.username === currentUser ? 'Cannot ban your own account' : 'Ban'}
                      disabled={user.username === currentUser}
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

      {/* Bulk Role Assignment Modal */}
      {showBulkRoleModal && (
        <BulkRoleModal
          userCount={selectedUsers.length}
          onClose={() => setShowBulkRoleModal(false)}
          onAssign={handleBulkRoleAssignment}
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
    { value: 'admin', label: 'Admin', icon: '👑', description: 'Full system access', color: '#3b82f6' },
    { value: 'moderator', label: 'Moderator', icon: '🛡️', description: 'User & content moderation', color: '#f59e0b' },
    { value: 'premium_user', label: 'Premium User', icon: '⭐', description: 'Enhanced features', color: '#ec4899' },
    { value: 'free_user', label: 'Free User', icon: '👤', description: 'Basic access', color: '#6b7280' }
  ];

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
            <span className="action-icon">🎭</span>
            <h2>Assign Role</h2>
          </div>
          
          <p className="action-modal-description">
            Select a new role for this user. Current role: <strong>{user.role_name || 'free_user'}</strong>
          </p>

          <div className="role-options">
            {roles.map((role) => (
              <label 
                key={role.value} 
                className={`role-option ${selectedRole === role.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                <div className="role-icon" style={{ color: role.color }}>
                  {role.icon}
                </div>
                <div className="role-info">
                  <strong>{role.label}</strong>
                  <span>{role.description}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="action-modal-form">
            <label>Reason (optional)</label>
            <textarea
              placeholder="Enter reason for role change..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="action-reason-input"
              rows="3"
            />
          </div>

          <div className="action-modal-footer">
            <button onClick={onClose} className="action-btn-cancel">
              Cancel
            </button>
            <button
              onClick={() => onAssign(user.username, selectedRole, reason)}
              className="action-btn-confirm"
              disabled={selectedRole === user.role_name}
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              🎭 Assign Role
            </button>
          </div>
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

// Bulk Role Assignment Modal Component
const BulkRoleModal = ({ userCount, onClose, onAssign }) => {
  const [selectedRole, setSelectedRole] = useState('free_user');
  const [reason, setReason] = useState('');

  const roles = [
    { value: 'admin', label: 'Admin', icon: '👑', description: 'Full system access', color: '#3b82f6' },
    { value: 'moderator', label: 'Moderator', icon: '🛡️', description: 'User & content moderation', color: '#f59e0b' },
    { value: 'premium_user', label: 'Premium User', icon: '⭐', description: 'Enhanced features', color: '#ec4899' },
    { value: 'free_user', label: 'Free User', icon: '👤', description: 'Basic access', color: '#6b7280' }
  ];

  return (
    <div className="action-modal-overlay" onClick={onClose}>
      <div className="action-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header - Purple Theme */}
        <div className="action-modal-header">
          <div className="action-modal-user-info">
            <div className="action-modal-avatar">
              {userCount}
            </div>
            <div className="action-modal-user-details">
              <h3>Bulk Role Assignment</h3>
              <p>{userCount} users selected</p>
            </div>
          </div>
          <button className="action-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="action-modal-body">
          <div className="action-modal-title">
            <span className="action-icon">🎭</span>
            <h2>Assign Role to Multiple Users</h2>
          </div>
          
          <p className="action-modal-description">
            Select a role to assign to all {userCount} selected users. This will update their permissions immediately.
          </p>

          <div className="role-options">
            {roles.map((role) => (
              <label 
                key={role.value} 
                className={`role-option ${selectedRole === role.value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="role"
                  value={role.value}
                  checked={selectedRole === role.value}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                <div className="role-icon" style={{ color: role.color }}>
                  {role.icon}
                </div>
                <div className="role-info">
                  <strong>{role.label}</strong>
                  <span>{role.description}</span>
                </div>
              </label>
            ))}
          </div>

          <div className="action-modal-form">
            <label>Reason (optional)</label>
            <textarea
              placeholder="Enter reason for bulk role assignment..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="action-reason-input"
              rows="3"
            />
          </div>

          <div className="action-modal-footer">
            <button onClick={onClose} className="action-btn-cancel">
              Cancel
            </button>
            <button
              onClick={() => onAssign(selectedRole, reason)}
              className="action-btn-confirm"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}
            >
              🎭 Assign Role to {userCount} Users
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
