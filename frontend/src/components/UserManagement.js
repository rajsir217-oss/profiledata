import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './UserManagement.css';
import Pagination from './Pagination';

// Create admin API client without baseURL prefix
import { getBackendUrl } from '../config/apiConfig';
const adminApi = axios.create({
  baseURL: getBackendUrl()
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
  const [roleFilter, setRoleFilter] = useState(''); // Show all roles by default
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]); // For bulk operations
  const [sortField, setSortField] = useState('username'); // Sort field
  const [sortOrder, setSortOrder] = useState('asc'); // Sort order
  const [showBulkRoleModal, setShowBulkRoleModal] = useState(false); // Bulk role modal
  const [successMessage, setSuccessMessage] = useState(''); // Success notification
  const [imageValidationStatus, setImageValidationStatus] = useState({}); // Image validation status by username
  const [validatingImages, setValidatingImages] = useState({}); // Track validation in progress
  const [showCleanupModal, setShowCleanupModal] = useState(false); // Cleanup settings modal
  const [selectedUserForCleanup, setSelectedUserForCleanup] = useState(null); // User for cleanup settings
  const [cleanupDays, setCleanupDays] = useState(90); // Cleanup days
  const [openDropdown, setOpenDropdown] = useState(null); // Track which dropdown is open
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdown && !event.target.closest('.action-dropdown-container')) {
        setOpenDropdown(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdown]);

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
      
      const loadedUsers = response.data.users || [];
      setUsers(loadedUsers);
      setTotalPages(response.data.pages || 1);
      setTotalUsers(response.data.total || loadedUsers.length);
      
      // Load image validation status for each user
      loadImageValidationStatus(loadedUsers);
    } catch (err) {
      console.error('Error loading users:', err);
      
      // Check if token expired - ProtectedRoute will handle redirect
      if (err.response?.status === 401) {
        const errorMsg = err.response?.data?.detail || '';
        if (errorMsg.includes('expired') || errorMsg.includes('Invalid token')) {
          // Clear localStorage - ProtectedRoute will redirect automatically
          localStorage.removeItem('token');
          localStorage.removeItem('username');
          localStorage.removeItem('userRole');
          localStorage.removeItem('userStatus');
          localStorage.removeItem('appTheme');
          navigate('/login');
          return;
        }
      }
      
      setError('Failed to load users: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  const loadImageValidationStatus = async (userList) => {
    const statusMap = {};
    
    for (const user of userList) {
      if (user.imageValidation) {
        statusMap[user.username] = user.imageValidation;
      }
    }
    
    setImageValidationStatus(statusMap);
  };

  const handleValidateImages = async (username) => {
    try {
      setValidatingImages(prev => ({ ...prev, [username]: true }));
      
      const response = await adminApi.post(`/api/admin/users/${username}/validate-images`);
      
      // Update validation status
      setImageValidationStatus(prev => ({
        ...prev,
        [username]: response.data.validation_status
      }));
      
      setSuccessMessage(`✅ Images validated for ${username}`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Reload users to get updated data
      loadUsers();
    } catch (err) {
      console.error('Error validating images:', err);
      setError('Failed to validate images: ' + (err.response?.data?.detail || err.message));
    } finally {
      setValidatingImages(prev => ({ ...prev, [username]: false }));
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
      'deactivated': 'status-inactive',
      'pending_verification': 'status-pending',
      'pending_email_verification': 'status-pending',
      'pending_admin_approval': 'status-pending'
    };
    return statusClasses[status] || 'status-inactive';
  };

  const formatStatusDisplay = (status) => {
    const statusLabels = {
      'pending_email_verification': 'Pending Email',
      'pending_admin_approval': 'Pending Approval',
      'active': 'Active',
      'inactive': 'Inactive',
      'suspended': 'Suspended',
      'deactivated': 'Deactivated',
      'banned': 'Banned',
      'pending_verification': 'Pending'
    };
    return statusLabels[status] || status || 'Unknown';
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

    // Ensure values are defined before string operations
    aValue = aValue ?? '';
    bValue = bValue ?? '';

    // String comparison
    if (typeof aValue === 'string' && typeof bValue === 'string') {
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

  const openCleanupModal = async (user) => {
    setSelectedUserForCleanup(user);
    
    // Fetch user's current cleanup settings
    try {
      const response = await adminApi.get(`/api/users/${user.username}/cleanup-settings`);
      setCleanupDays(response.data.cleanup_days || 90);
    } catch (err) {
      console.error('Error fetching cleanup settings:', err);
      setCleanupDays(90); // Default
    }
    
    setShowCleanupModal(true);
  };

  const handleCleanupSettingsUpdate = async () => {
    if (!selectedUserForCleanup) return;
    
    try {
      await adminApi.put(`/api/admin/users/${selectedUserForCleanup.username}/cleanup-settings`, {
        cleanup_days: cleanupDays
      });
      
      setSuccessMessage(`✅ Cleanup period set to ${cleanupDays} days for ${selectedUserForCleanup.username}`);
      setShowCleanupModal(false);
      setSelectedUserForCleanup(null);
      
      // Auto-hide success message
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('Error updating cleanup settings:', err);
      setError('Failed to update cleanup settings: ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleBulkRoleAssign = async (role, reason) => {
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
            role_name: role,
            reason: reason || `Bulk role assignment to ${role}`
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
          <option value="pending_email_verification">Pending Email Verification</option>
          <option value="pending_admin_approval">Pending Admin Approval</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
          <option value="deactivated">Deactivated</option>
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
                  checked={selectedUsers.length === sortedUsers.length && sortedUsers.length > 0}
                  onChange={handleSelectAll}
                />
              </th>
              <th>Actions</th>
              <th onClick={() => handleSort('username')}>
                Username
                {sortField === 'username' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th onClick={() => handleSort('firstName')}>
                Name
                {sortField === 'firstName' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th>Email</th>
              <th onClick={() => handleSort('role_name')}>
                Role
                {sortField === 'role_name' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th onClick={() => handleSort('status')}>
                Status
                {sortField === 'status' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
              <th onClick={() => handleSort('created_at')}>
                Created
                {sortField === 'created_at' && (
                  <span className="sort-indicator">{sortOrder === 'asc' ? ' ▲' : ' ▼'}</span>
                )}
              </th>
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
                  <div className="action-dropdown-container">
                    <button
                      className="btn-actions-menu"
                      onClick={() => setOpenDropdown(openDropdown === user.username ? null : user.username)}
                    >
                      ⋮ Actions
                    </button>
                    
                    {openDropdown === user.username && (
                      <div className="actions-dropdown-menu">
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            navigate(`/profile/${user.username}`);
                            setOpenDropdown(null);
                          }}
                        >
                          <span className="dropdown-icon">👤</span>
                          View Profile
                        </button>
                        
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            openRoleModal(user);
                            setOpenDropdown(null);
                          }}
                          disabled={user.username === currentUser}
                        >
                          <span className="dropdown-icon">👥</span>
                          Assign Role
                        </button>
                        
                        {(() => {
                          const validation = imageValidationStatus[user.username];
                          const hasImages = user.images && user.images.length > 0;
                          const needsReview = validation?.needs_review || false;
                          const isValidating = validatingImages[user.username] || false;
                          
                          if (hasImages) {
                            return (
                              <button
                                className={`dropdown-item ${needsReview ? 'dropdown-item-warning' : 'dropdown-item-success'}`}
                                onClick={() => {
                                  handleValidateImages(user.username);
                                  setOpenDropdown(null);
                                }}
                                disabled={isValidating}
                              >
                                <span className="dropdown-icon">
                                  {isValidating ? '🔄' : needsReview ? '⚠️' : validation ? '✓' : '🔍'}
                                </span>
                                {isValidating ? 'Validating...' : needsReview ? 'Review Images' : validation ? 'Images Verified' : 'Validate Images'}
                              </button>
                            );
                          }
                          return null;
                        })()}
                        
                        <div className="dropdown-divider"></div>
                        
                        <button
                          className="dropdown-item dropdown-item-success"
                          onClick={() => {
                            openActionModal(user, 'activate');
                            setOpenDropdown(null);
                          }}
                          disabled={user.status?.status === 'active' || user.username === currentUser}
                        >
                          <span className="dropdown-icon">✅</span>
                          Activate
                        </button>
                        
                        <button
                          className="dropdown-item dropdown-item-warning"
                          onClick={() => {
                            openActionModal(user, 'suspend');
                            setOpenDropdown(null);
                          }}
                          disabled={user.username === currentUser}
                        >
                          <span className="dropdown-icon">⏸️</span>
                          Suspend
                        </button>
                        
                        <button
                          className="dropdown-item dropdown-item-danger"
                          onClick={() => {
                            openActionModal(user, 'ban');
                            setOpenDropdown(null);
                          }}
                          disabled={user.username === currentUser}
                        >
                          <span className="dropdown-icon">🚫</span>
                          Ban
                        </button>
                        
                        <div className="dropdown-divider"></div>
                        
                        <button
                          className="dropdown-item"
                          onClick={() => {
                            openCleanupModal(user);
                            setOpenDropdown(null);
                          }}
                        >
                          <span className="dropdown-icon">🗑️</span>
                          Configure Cleanup
                        </button>
                      </div>
                    )}
                  </div>
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
                  <span className={`status-badge ${getStatusBadgeClass(user.status?.status || user.accountStatus)}`}>
                    {formatStatusDisplay(user.status?.status || user.accountStatus)}
                  </span>
                </td>
                <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={totalUsers}
        itemsPerPage={20}
        onPageChange={setPage}
        itemLabel="records"
      />

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
          onAssign={handleBulkRoleAssign}
        />
      )}

      {/* Cleanup Settings Modal */}
      {showCleanupModal && selectedUserForCleanup && (
        <div className="cleanup-modal-overlay" onClick={() => setShowCleanupModal(false)}>
          <div className="cleanup-modal" onClick={(e) => e.stopPropagation()}>
            {/* Purple Gradient Header */}
            <div className="cleanup-modal-header">
              <div className="cleanup-user-info">
                <div className="cleanup-avatar">
                  {selectedUserForCleanup.username.charAt(0).toUpperCase()}
                </div>
                <div className="cleanup-user-details">
                  <div className="cleanup-username">{selectedUserForCleanup.username}</div>
                  <div className="cleanup-email">{selectedUserForCleanup.email || selectedUserForCleanup.contactEmail || 'No email'}</div>
                </div>
              </div>
              <button className="cleanup-close-btn" onClick={() => setShowCleanupModal(false)}>
                ✕
              </button>
            </div>

            {/* White Body Content */}
            <div className="cleanup-modal-body">
              <div className="cleanup-title">
                <span className="cleanup-icon">🗑️</span>
                <h3>Configure Data Cleanup Settings</h3>
              </div>
              
              <div className="cleanup-description">
                Data older than this period will be automatically deleted
              </div>

              <div className="cleanup-period-section">
                <label className="cleanup-label">Cleanup Period</label>
                <select
                  className="cleanup-select"
                  value={cleanupDays}
                  onChange={(e) => setCleanupDays(Number(e.target.value))}
                >
                  <option value={30}>30 days (1 month)</option>
                  <option value={60}>60 days (2 months)</option>
                  <option value={90}>90 days (3 months) - Recommended</option>
                  <option value={120}>120 days (4 months)</option>
                  <option value={180}>180 days (6 months)</option>
                  <option value={365}>365 days (1 year)</option>
                </select>
                
                <div className="cleanup-current-setting">
                  <div className="cleanup-setting-text">
                    <strong>Current setting:</strong> {cleanupDays} days
                  </div>
                  <div className="cleanup-affects">
                    This affects: Favorites ❤️, Shortlist ⭐, Messages 💬
                  </div>
                </div>
              </div>

              <div className="cleanup-modal-footer">
                <button onClick={() => setShowCleanupModal(false)} className="cleanup-btn-cancel">
                  Cancel
                </button>
                <button
                  onClick={handleCleanupSettingsUpdate}
                  className="cleanup-btn-save"
                >
                  🗑️ Save Cleanup Settings
                </button>
              </div>
            </div>
          </div>
        </div>
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
// eslint-disable-next-line no-unused-vars
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
