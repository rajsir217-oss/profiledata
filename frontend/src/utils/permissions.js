/**
 * Frontend Permission Checking Utility
 * 
 * Provides permission and role checking functions for UI components
 */

// Role hierarchy - matches backend
const ROLE_HIERARCHY = {
  admin: ['moderator', 'premium_user', 'free_user'],
  moderator: ['premium_user', 'free_user'],
  premium_user: ['free_user'],
  free_user: []
};

// Default permissions per role - matches backend
const DEFAULT_PERMISSIONS = {
  admin: ['users.*', 'roles.*', 'permissions.*', 'profiles.*', 'messages.*', 'pii.*', 'audit.*', 'security.*'],
  moderator: ['users.read', 'users.update', 'profiles.read', 'profiles.update', 'profiles.delete', 'messages.read', 'messages.delete', 'pii.read', 'audit.read'],
  premium_user: ['profiles.read', 'profiles.create', 'profiles.update', 'messages.read', 'messages.create', 'pii.request', 'pii.grant', 'favorites.*', 'shortlist.*'],
  free_user: ['profiles.read', 'profiles.create', 'profiles.update', 'messages.read', 'messages.create', 'pii.request', 'favorites.read', 'favorites.create']
};

// Role limits - matches backend
const ROLE_LIMITS = {
  admin: {
    favorites_max: null,
    shortlist_max: null,
    messages_per_day: null,
    profile_views_per_day: null,
    pii_requests_per_month: null,
    search_results_max: null
  },
  moderator: {
    favorites_max: null,
    shortlist_max: null,
    messages_per_day: null,
    profile_views_per_day: null,
    pii_requests_per_month: null,
    search_results_max: null
  },
  premium_user: {
    favorites_max: null,
    shortlist_max: null,
    messages_per_day: null,
    profile_views_per_day: null,
    pii_requests_per_month: 10,
    search_results_max: 100
  },
  free_user: {
    favorites_max: 10,
    shortlist_max: 5,
    messages_per_day: 5,
    profile_views_per_day: 20,
    pii_requests_per_month: 3,
    search_results_max: 20
  }
};

/**
 * Get current user's role from localStorage
 */
export const getCurrentUserRole = () => {
  return localStorage.getItem('userRole') || 'free_user';
};

/**
 * Get current username from localStorage
 */
export const getCurrentUsername = () => {
  return localStorage.getItem('username') || null;
};

/**
 * Get inherited permissions for a role
 */
export const getInheritedPermissions = (roleName) => {
  const permissions = [...(DEFAULT_PERMISSIONS[roleName] || [])];
  
  // Add inherited permissions
  const inheritedRoles = ROLE_HIERARCHY[roleName] || [];
  inheritedRoles.forEach(inheritedRole => {
    permissions.push(...(DEFAULT_PERMISSIONS[inheritedRole] || []));
  });
  
  // Remove duplicates
  return [...new Set(permissions)];
};

/**
 * Check if user has a specific permission (supports wildcards)
 */
export const hasPermission = (permission) => {
  const role = getCurrentUserRole();
  const userPermissions = getInheritedPermissions(role);
  
  // Check exact match
  if (userPermissions.includes(permission)) {
    return true;
  }
  
  // Check wildcard match (e.g., users.* matches users.create)
  const [resource] = permission.split('.');
  if (userPermissions.includes(`${resource}.*`)) {
    return true;
  }
  
  // Check full wildcard
  if (userPermissions.includes('*') || userPermissions.includes('*.*')) {
    return true;
  }
  
  return false;
};

/**
 * Check if user has ANY of the specified permissions
 */
export const hasAnyPermission = (permissions) => {
  return permissions.some(perm => hasPermission(perm));
};

/**
 * Check if user has ALL of the specified permissions
 */
export const hasAllPermissions = (permissions) => {
  return permissions.every(perm => hasPermission(perm));
};

/**
 * Check if user has a specific role
 */
export const hasRole = (roleName) => {
  return getCurrentUserRole() === roleName;
};

/**
 * Check if user has ANY of the specified roles
 */
export const hasAnyRole = (roles) => {
  const currentRole = getCurrentUserRole();
  return roles.includes(currentRole);
};

/**
 * Check if user is admin
 */
export const isAdmin = () => {
  return hasRole('admin');
};

/**
 * Check if user is moderator or admin
 */
export const isModeratorOrAdmin = () => {
  return hasAnyRole(['admin', 'moderator']);
};

/**
 * Check if user is premium or higher
 */
export const isPremiumUser = () => {
  return hasAnyRole(['admin', 'moderator', 'premium_user']);
};

/**
 * Get role hierarchy level (higher = more privileges)
 */
export const getRoleHierarchyLevel = (roleName) => {
  const hierarchy = {
    admin: 4,
    moderator: 3,
    premium_user: 2,
    free_user: 1
  };
  return hierarchy[roleName] || 0;
};

/**
 * Check if role1 has higher privileges than role2
 */
export const isHigherRole = (role1, role2) => {
  return getRoleHierarchyLevel(role1) > getRoleHierarchyLevel(role2);
};

/**
 * Get limit value for user's role
 */
export const getUserLimit = (limitName) => {
  const role = getCurrentUserRole();
  const limits = ROLE_LIMITS[role] || {};
  return limits[limitName];
};

/**
 * Check if user has reached their limit
 */
export const checkLimit = (limitName, currentCount) => {
  const limit = getUserLimit(limitName);
  
  // null means unlimited
  if (limit === null || limit === undefined) {
    return true;
  }
  
  return currentCount < limit;
};

/**
 * Get remaining count before hitting limit (null = unlimited)
 */
export const getRemaining = (limitName, currentCount) => {
  const limit = getUserLimit(limitName);
  
  if (limit === null || limit === undefined) {
    return null; // Unlimited
  }
  
  const remaining = limit - currentCount;
  return Math.max(0, remaining);
};

/**
 * Get all limits for user's role
 */
export const getAllLimits = () => {
  const role = getCurrentUserRole();
  return ROLE_LIMITS[role] || {};
};

/**
 * Check if user owns a resource
 */
export const isOwner = (resourceOwner) => {
  const currentUser = getCurrentUsername();
  return currentUser === resourceOwner;
};

/**
 * Check if user is owner or admin
 */
export const isOwnerOrAdmin = (resourceOwner) => {
  return isOwner(resourceOwner) || isAdmin();
};

/**
 * Get user-friendly role display name
 */
export const getRoleDisplayName = (roleName) => {
  const displayNames = {
    admin: 'Administrator',
    moderator: 'Moderator',
    premium_user: 'Premium Member',
    free_user: 'Free Member'
  };
  return displayNames[roleName] || roleName;
};

/**
 * Get role badge color
 */
export const getRoleBadgeColor = (roleName) => {
  const colors = {
    admin: '#dc3545',      // Red
    moderator: '#fd7e14',  // Orange
    premium_user: '#6f42c1', // Purple
    free_user: '#6c757d'   // Gray
  };
  return colors[roleName] || '#6c757d';
};

/**
 * Get formatted limit display (null becomes "Unlimited")
 */
export const formatLimit = (limit) => {
  if (limit === null || limit === undefined) {
    return 'Unlimited';
  }
  return limit.toString();
};

/**
 * Get limit status with percentage
 */
export const getLimitStatus = (limitName, currentCount) => {
  const limit = getUserLimit(limitName);
  
  if (limit === null || limit === undefined) {
    return {
      current: currentCount,
      limit: 'Unlimited',
      remaining: null,
      percentage: 0,
      isUnlimited: true,
      isNearLimit: false,
      isAtLimit: false
    };
  }
  
  const remaining = Math.max(0, limit - currentCount);
  const percentage = limit > 0 ? (currentCount / limit) * 100 : 0;
  
  return {
    current: currentCount,
    limit: limit,
    remaining: remaining,
    percentage: Math.min(100, percentage),
    isUnlimited: false,
    isNearLimit: percentage >= 80,
    isAtLimit: currentCount >= limit
  };
};

// Export all functions as default object as well
export default {
  getCurrentUserRole,
  getCurrentUsername,
  getInheritedPermissions,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  hasRole,
  hasAnyRole,
  isAdmin,
  isModeratorOrAdmin,
  isPremiumUser,
  getRoleHierarchyLevel,
  isHigherRole,
  getUserLimit,
  checkLimit,
  getRemaining,
  getAllLimits,
  isOwner,
  isOwnerOrAdmin,
  getRoleDisplayName,
  getRoleBadgeColor,
  formatLimit,
  getLimitStatus
};
