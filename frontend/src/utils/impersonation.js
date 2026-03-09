/**
 * Admin Impersonation Utilities
 * Manages localStorage swap for impersonating users.
 */

const IMPERSONATION_KEYS = {
  FLAG: '_impersonating',
  TARGET_USER: '_impersonating_user',
  ADMIN_TOKEN: '_admin_token',
  ADMIN_USERNAME: '_admin_username',
  ADMIN_ROLE: '_admin_role',
};

/**
 * Start impersonation: stash admin session, switch to target user
 */
export const startImpersonation = (impersonationToken, targetUsername, targetRole) => {
  // Stash current admin session
  localStorage.setItem(IMPERSONATION_KEYS.ADMIN_TOKEN, localStorage.getItem('token'));
  localStorage.setItem(IMPERSONATION_KEYS.ADMIN_USERNAME, localStorage.getItem('username'));
  localStorage.setItem(IMPERSONATION_KEYS.ADMIN_ROLE, localStorage.getItem('userRole'));

  // Switch to impersonated user
  localStorage.setItem('token', impersonationToken);
  localStorage.setItem('username', targetUsername);
  localStorage.setItem('userRole', targetRole || 'free_user');
  localStorage.setItem(IMPERSONATION_KEYS.FLAG, 'true');
  localStorage.setItem(IMPERSONATION_KEYS.TARGET_USER, targetUsername);

  // Clear session-level caches so the app reloads fresh data for the target user
  sessionStorage.clear();
};

/**
 * Exit impersonation: restore admin session
 */
export const exitImpersonation = () => {
  const adminToken = localStorage.getItem(IMPERSONATION_KEYS.ADMIN_TOKEN);
  const adminUsername = localStorage.getItem(IMPERSONATION_KEYS.ADMIN_USERNAME);
  const adminRole = localStorage.getItem(IMPERSONATION_KEYS.ADMIN_ROLE);

  if (adminToken && adminUsername) {
    // Restore admin session
    localStorage.setItem('token', adminToken);
    localStorage.setItem('username', adminUsername);
    localStorage.setItem('userRole', adminRole || 'admin');
  }

  // Clean up impersonation keys
  Object.values(IMPERSONATION_KEYS).forEach((key) => localStorage.removeItem(key));

  // Clear session-level caches
  sessionStorage.clear();
};

/**
 * Check if currently impersonating
 */
export const isImpersonating = () => {
  return localStorage.getItem(IMPERSONATION_KEYS.FLAG) === 'true';
};

/**
 * Get the username being impersonated
 */
export const getImpersonatedUser = () => {
  return localStorage.getItem(IMPERSONATION_KEYS.TARGET_USER);
};

/**
 * Get the admin username who started impersonation
 */
export const getAdminUsername = () => {
  return localStorage.getItem(IMPERSONATION_KEYS.ADMIN_USERNAME);
};
