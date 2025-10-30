import React, { useState, useEffect } from 'react';
import { hasPermission, getRoleDisplayName, getRoleBadgeColor, getInheritedPermissions, getAllLimits, formatLimit } from '../utils/permissions';
import api from '../api';
import PageHeader from './PageHeader';
import UniversalTabContainer from './UniversalTabContainer';
import './RoleManagement.css';

const RoleManagement = () => {
  const [selectedRole, setSelectedRole] = useState('free_user');
  const [editMode, setEditMode] = useState(false);
  const [roleConfig, setRoleConfig] = useState(null);
  const [editedLimits, setEditedLimits] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  const roles = ['admin', 'moderator', 'premium_user', 'free_user'];

  // Check if user has permission to view this page
  const currentUsername = localStorage.getItem('username');
  const isAdmin = currentUsername === 'admin';

  useEffect(() => {
    loadRoleConfig();
  }, []);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000); // Auto-hide after 3 seconds
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
  };

  const loadRoleConfig = async () => {
    try {
      const response = await api.get('/roles/config');
      setRoleConfig(response.data);
    } catch (error) {
      console.error('Error loading role config:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditLimit = (limitName, value) => {
    setEditedLimits(prev => ({
      ...prev,
      [selectedRole]: {
        ...prev[selectedRole],
        [limitName]: value === '' ? '' : parseInt(value)
      }
    }));
  };

  const handleSaveChanges = async () => {
    setSaving(true);
    try {
      // Merge edited limits with existing config
      const updatedConfig = {
        limits: {
          ...roleConfig.limits,
          ...Object.keys(editedLimits).reduce((acc, role) => {
            acc[role] = {
              ...roleConfig.limits[role],
              ...editedLimits[role]
            };
            return acc;
          }, {})
        }
      };

      await api.put(`/roles/config?username=${currentUsername}`, updatedConfig);
      setRoleConfig(updatedConfig);
      setEditedLimits({});
      setEditMode(false);
      showNotification('Role limits updated successfully!', 'success');
    } catch (error) {
      showNotification('Error updating limits: ' + (error.response?.data?.detail || error.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedLimits({});
    setEditMode(false);
  };
  
  if (!isAdmin && !hasPermission('roles.read')) {
    return (
      <div className="role-management-error">
        <h2>Access Denied</h2>
        <p>You don't have permission to view role management.</p>
      </div>
    );
  }

  const renderPermissionsTab = () => {
    const permissions = getInheritedPermissions(selectedRole);
    
    // Group permissions by resource
    const groupedPerms = {};
    permissions.forEach(perm => {
      const [resource] = perm.split('.');
      if (!groupedPerms[resource]) {
        groupedPerms[resource] = [];
      }
      groupedPerms[resource].push(perm);
    });

    return (
      <div className="permissions-tab">
        <h3>Permissions for {getRoleDisplayName(selectedRole)}</h3>
        <p className="info-text">
          Total: <strong>{permissions.length} permissions</strong> (including inherited)
        </p>

        <div className="permissions-grid">
          {Object.entries(groupedPerms).map(([resource, perms]) => (
            <div key={resource} className="permission-card">
              <div className="permission-header">
                <span className="resource-icon">
                  {resource === 'users' && '👥'}
                  {resource === 'roles' && '🎭'}
                  {resource === 'profiles' && '👤'}
                  {resource === 'messages' && '💬'}
                  {resource === 'pii' && '🔒'}
                  {resource === 'favorites' && '⭐'}
                  {resource === 'shortlist' && '📋'}
                  {resource === 'audit' && '📝'}
                  {resource === 'security' && '🛡️'}
                  {resource === 'permissions' && '🔑'}
                  {!['users', 'roles', 'profiles', 'messages', 'pii', 'favorites', 'shortlist', 'audit', 'security', 'permissions'].includes(resource) && '📌'}
                </span>
                <h4>{resource.toUpperCase()}</h4>
              </div>
              <ul className="permission-list">
                {perms.map(perm => (
                  <li key={perm}>
                    <span className="permission-name">{perm}</span>
                    {perm.endsWith('.*') && (
                      <span className="wildcard-badge">All Operations</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderLimitsTab = () => {
    if (loading || !roleConfig) {
      return <div className="limits-tab"><p>Loading limits...</p></div>;
    }

    const limits = roleConfig.limits[selectedRole] || {};
    const getCurrentLimit = (limitName) => {
      if (editedLimits[selectedRole] && editedLimits[selectedRole][limitName] !== undefined) {
        return editedLimits[selectedRole][limitName];
      }
      return limits[limitName];
    };

    return (
      <div className="limits-tab">
        <div className="limits-tab-header">
          <div>
            <h3>Limits for {getRoleDisplayName(selectedRole)}</h3>
            <p className="info-text">Configure resource limits for this role</p>
          </div>
          {isAdmin && !editMode && (
            <button className="btn-edit-limits" onClick={() => setEditMode(true)}>
              ✏️ Edit Limits
            </button>
          )}
          {isAdmin && editMode && (
            <div className="edit-actions">
              <button className="btn-save-limits" onClick={handleSaveChanges} disabled={saving}>
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button className="btn-cancel-limits" onClick={handleCancelEdit} disabled={saving}>
                ❌ Cancel
              </button>
            </div>
          )}
        </div>
        
        <div className="limits-grid">
          {Object.entries(limits).map(([limitName, limitValue]) => {
            const currentValue = getCurrentLimit(limitName);
            const displayValue = currentValue === -1 ? 'Unlimited' : currentValue;
            const isUnlimited = currentValue === -1;

            return (
              <div key={limitName} className={`limit-card ${editMode ? 'edit-mode' : ''}`}>
                <div className="limit-header">
                  <span className="limit-name">{limitName.replace(/_/g, ' ')}</span>
                  {!editMode && (
                    <span className={`limit-value ${isUnlimited ? 'unlimited' : ''}`}>
                      {displayValue}
                    </span>
                  )}
                  {editMode && (
                    <input
                      type="number"
                      className="limit-input"
                      value={currentValue === -1 ? '' : currentValue}
                      onChange={(e) => handleEditLimit(limitName, e.target.value)}
                      placeholder="Unlimited"
                      min="-1"
                    />
                  )}
                </div>
                
                {editMode && (
                  <div className="limit-hint">
                    <small>Use -1 for unlimited</small>
                  </div>
                )}
                
                {!editMode && !isUnlimited && (
                  <div className="limit-bar">
                    <div 
                      className="limit-bar-fill"
                      style={{ width: '0%' }}
                    />
                  </div>
                )}
                
                {!editMode && isUnlimited && (
                  <div className="unlimited-indicator">
                    <span>✨ No restrictions</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {!editMode && selectedRole === 'free_user' && (
          <div className="upgrade-hint">
            <div className="hint-box">
              <h4>💎 Upgrade to Premium</h4>
              <p>Get more favorites, shortlist, messages, and more!</p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderHierarchyTab = () => {
    const roleHierarchy = {
      admin: { level: 4, inherits: ['moderator', 'premium_user', 'free_user'], color: '#dc3545' },
      moderator: { level: 3, inherits: ['premium_user', 'free_user'], color: '#fd7e14' },
      premium_user: { level: 2, inherits: ['free_user'], color: '#6f42c1' },
      free_user: { level: 1, inherits: [], color: '#6c757d' }
    };

    return (
      <div className="hierarchy-tab">
        <h3>Role Hierarchy</h3>
        <p className="info-text">
          Higher roles inherit all permissions and privileges from lower roles.
        </p>

        <div className="hierarchy-visual">
          {roles.map((role, index) => {
            const info = roleHierarchy[role];
            const isSelected = role === selectedRole;
            
            return (
              <div key={role} className="hierarchy-level">
                <div 
                  className={`hierarchy-card ${isSelected ? 'selected' : ''}`}
                  style={{ borderColor: info.color }}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="hierarchy-badge" style={{ backgroundColor: info.color }}>
                    Level {info.level}
                  </div>
                  <h4>{getRoleDisplayName(role)}</h4>
                  
                  {info.inherits.length > 0 && (
                    <div className="inherits-from">
                      <span className="inherits-label">Inherits from:</span>
                      <div className="inherited-roles">
                        {info.inherits.map(inheritedRole => (
                          <span 
                            key={inheritedRole}
                            className="inherited-role-badge"
                            style={{ backgroundColor: roleHierarchy[inheritedRole].color }}
                          >
                            {getRoleDisplayName(inheritedRole)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {info.inherits.length === 0 && (
                    <div className="base-role">
                      <span>🏁 Base Role</span>
                    </div>
                  )}
                </div>
                
                {index < roles.length - 1 && (
                  <div className="hierarchy-arrow">↓</div>
                )}
              </div>
            );
          })}
        </div>

        <div className="inheritance-explanation">
          <h4>How Inheritance Works:</h4>
          <ul>
            <li><strong>Admin</strong> has all permissions from Moderator, Premium, and Free users</li>
            <li><strong>Moderator</strong> has all permissions from Premium and Free users</li>
            <li><strong>Premium User</strong> has all permissions from Free users</li>
            <li><strong>Free User</strong> is the base role with essential permissions</li>
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="role-management">
      {/* Notification Bubble */}
      {notification && (
        <div className={`notification-bubble ${notification.type}`}>
          <span className="notification-icon">
            {notification.type === 'success' ? '✅' : '❌'}
          </span>
          <span className="notification-message">{notification.message}</span>
        </div>
      )}

      <PageHeader
        icon="🎭"
        title="Role Management"
        subtitle="View and understand role permissions, limits, and hierarchy"
        variant="flat"
      />

      <div className="role-selector">
        <label>Select Role:</label>
        <div className="role-buttons">
          {roles.map(role => (
            <button
              key={role}
              className={`role-button ${selectedRole === role ? 'active' : ''}`}
              onClick={() => setSelectedRole(role)}
              style={{
                borderColor: selectedRole === role ? getRoleBadgeColor(role) : 'var(--border-color, #ddd)',
                backgroundColor: selectedRole === role ? getRoleBadgeColor(role) + '20' : 'var(--surface-color, white)'
              }}
            >
              <span className="role-button-name">{getRoleDisplayName(role)}</span>
              <span 
                className="role-button-badge"
                style={{ backgroundColor: getRoleBadgeColor(role) }}
              />
            </button>
          ))}
        </div>
      </div>

      <UniversalTabContainer
        variant="underlined"
        defaultTab="permissions"
        tabs={[
          {
            id: 'permissions',
            icon: '🔑',
            label: 'Permissions',
            content: renderPermissionsTab()
          },
          {
            id: 'limits',
            icon: '📊',
            label: 'Limits',
            content: renderLimitsTab()
          },
          {
            id: 'hierarchy',
            icon: '🏆',
            label: 'Hierarchy',
            content: renderHierarchyTab()
          }
        ]}
      />
    </div>
  );
};

export default RoleManagement;
