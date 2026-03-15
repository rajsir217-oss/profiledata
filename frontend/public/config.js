/**
 * Runtime Configuration (Local Development)
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'local',
  SOCKET_URL: 'http://localhost:8000',
  API_URL: 'http://localhost:8000/api/users',
  WS_URL: 'ws://localhost:8000',
  ENABLE_WEBSOCKETS: true,
  ENABLE_NOTIFICATIONS: true,
  DEBUG: true,
  LOG_LEVEL: 'DEBUG'
};
console.log('✅ Runtime config loaded for', window.RUNTIME_CONFIG.ENVIRONMENT, '| Log Level:', window.RUNTIME_CONFIG.LOG_LEVEL);
