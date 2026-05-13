/**
 * Runtime Configuration (Production)
 */
window.RUNTIME_CONFIG = {
  ENVIRONMENT: 'production',
  SOCKET_URL: 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app',
  API_URL: 'https://matrimonial-backend-7cxoxmouuq-uc.a.run.app/api/users',
  WS_URL: 'wss://matrimonial-backend-7cxoxmouuq-uc.a.run.app',
  TURNSTILE_SITE_KEY: '0x4AAAAAACAeADZnXAaS1tep',
  ENABLE_WEBSOCKETS: true,
  ENABLE_NOTIFICATIONS: true,
  DEBUG: false,
  LOG_LEVEL: 'ERROR'
};
console.log('✅ Runtime config loaded for', window.RUNTIME_CONFIG.ENVIRONMENT, '| Log Level:', window.RUNTIME_CONFIG.LOG_LEVEL);
