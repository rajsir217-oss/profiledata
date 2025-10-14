import React, { useState, useEffect } from 'react';
import { hasPermission, getRoleDisplayName, getRoleBadgeColor, getInheritedPermissions, getAllLimits, formatLimit } from '../utils/permissions';
import './RoleManagement.css';

const RoleManagement = () => {
  const [selectedRole, setSelectedRole] = useState('free_user');
  const [activeTab, setActiveTab] = useState('permissions'); // permissions, limits, hierarchy

  const roles = ['admin', 'moderator', 'premium_user', 'free_user'];

  // Check if user has permission to view this page
  if (!hasPermission('roles.read')) {
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
    const limits = getAllLimits();
    
    // Mock current counts for demonstration
    const mockCounts = {
      admin: { favorites_max: 0, shortlist_max: 0, messages_per_day: 0, profile_views_per_day: 0 },
      moderator: { favorites_max: 0, shortlist_max: 0, messages_per_day: 0, profile_views_per_day: 0 },
      premium_user: { favorites_max: 50, shortlist_max: 20, messages_per_day: 15, profile_views_per_day: 80 },
      free_user: { favorites_max: 7, shortlist_max: 3, messages_per_day: 4, profile_views_per_day: 18 }
    };

    const currentCounts = mockCounts[selectedRole] || {};

    return (
      <div className="limits-tab">
        <h3>Limits for {getRoleDisplayName(selectedRole)}</h3>
        
        <div className="limits-grid">
          {Object.entries(limits).map(([limitName, limitValue]) => {
            const current = currentCounts[limitName] || 0;
            const limit = limitValue;
            const percentage = limit ? Math.min(100, (current / limit) * 100) : 0;
            const isUnlimited = limit === null || limit === undefined;

            return (
              <div key={limitName} className="limit-card">
                <div className="limit-header">
                  <span className="limit-name">{limitName.replace(/_/g, ' ')}</span>
                  <span className={`limit-value ${isUnlimited ? 'unlimited' : ''}`}>
                    {formatLimit(limit)}
                  </span>
                </div>
                
                {!isUnlimited && (
                  <>
                    <div className="limit-bar">
                      <div 
                        className={`limit-bar-fill ${percentage >= 80 ? 'near-limit' : ''} ${percentage >= 100 ? 'at-limit' : ''}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <div className="limit-stats">
                      <span>Current: {current}</span>
                      <span>Remaining: {Math.max(0, limit - current)}</span>
                    </div>
                  </>
                )}
                
                {isUnlimited && (
                  <div className="unlimited-indicator">
                    <span>✨ No restrictions</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="upgrade-hint">
          {selectedRole === 'free_user' && (
            <div className="hint-box">
              <h4>💎 Upgrade to Premium</h4>
              <p>Get unlimited favorites, shortlist, messages, and more!</p>
            </div>
          )}
        </div>
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
      <div className="role-management-header">
        <h1>🎭 Role Management</h1>
        <p>View and understand role permissions, limits, and hierarchy</p>
      </div>

      <div className="role-selector">
        <label>Select Role:</label>
        <div className="role-buttons">
          {roles.map(role => (
            <button
              key={role}
              className={`role-button ${selectedRole === role ? 'active' : ''}`}
              onClick={() => setSelectedRole(role)}
              style={{
                borderColor: selectedRole === role ? getRoleBadgeColor(role) : '#ddd',
                backgroundColor: selectedRole === role ? getRoleBadgeColor(role) + '20' : 'white'
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

      <div className="role-tabs">
        <button
          className={`tab-button ${activeTab === 'permissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('permissions')}
        >
          🔑 Permissions
        </button>
        <button
          className={`tab-button ${activeTab === 'limits' ? 'active' : ''}`}
          onClick={() => setActiveTab('limits')}
        >
          📊 Limits
        </button>
        <button
          className={`tab-button ${activeTab === 'hierarchy' ? 'active' : ''}`}
          onClick={() => setActiveTab('hierarchy')}
        >
          🏆 Hierarchy
        </button>
      </div>

      <div className="role-content">
        {activeTab === 'permissions' && renderPermissionsTab()}
        {activeTab === 'limits' && renderLimitsTab()}
        {activeTab === 'hierarchy' && renderHierarchyTab()}
      </div>
    </div>
  );
};

export default RoleManagement;
