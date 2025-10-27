/**
 * Runtime Configuration
 * Auto-generated during deployment
 * 
 * NOTE: For local development, this is set to 'local'
 * For production deployment, this should be updated to 'pod' with GCP URLs
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'local',
  SOCKET_URL: 'http://localhost:8000',
  API_URL: 'http://localhost:8000/api/users',
  WS_URL: 'ws://localhost:8000',
  FRONTEND_URL: 'http://localhost:3000',
  ENABLE_NOTIFICATIONS: true,
  DEBUG: true
};
console.log('✅ Runtime config loaded:', window.RUNTIME_CONFIG.ENVIRONMENT);
