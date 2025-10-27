/**
 * Runtime Configuration
 * Auto-generated during deployment
 * 
 * NOTE: For local development, this is set to 'local'
 * For production deployment, this should be updated to 'pod' with GCP URLs
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'pod',
  SOCKET_URL: 'https://matrimonial-backend-458052696267.us-central1.run.app',
  API_URL: 'https://matrimonial-backend-458052696267.us-central1.run.app/api/users',
  WS_URL: 'wss://matrimonial-backend-458052696267.us-central1.run.app',
  FRONTEND_URL: 'https://profiledata-pod.ue.r.appspot.com',
  ENABLE_NOTIFICATIONS: true,
  DEBUG: false
};
console.log('✅ Runtime config loaded:', window.RUNTIME_CONFIG.ENVIRONMENT);
