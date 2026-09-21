/**
 * Push Notification Service for Messenger Web (Capacitor)
 * Handles Firebase Cloud Messaging for push notifications on Android
 */

import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { isNativePlatform } from './biometricAuth';
import axios from 'axios';
import logger from '../utils/logger';
import { getBackendUrl } from '../config/apiConfig';

// Create axios instance for push notification API calls
const pushApi = axios.create();

pushApi.interceptors.request.use((config) => {
  if (!config.baseURL && !config.url?.startsWith('http')) {
    config.baseURL = `${getBackendUrl()}/api/push-subscriptions`;
  }
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Request notification permission and register for push notifications
 * @returns {Promise<string|null>} FCM device token or null
 */
export const requestNotificationPermission = async () => {
  logger.info('[Push] requestNotificationPermission called');
  
  try {
    // Only push notifications work on native platforms
    if (!isNativePlatform()) {
      logger.warn('[Push] Push notifications only supported on native platforms');
      return null;
    }

    // Request permission
    const result = await PushNotifications.requestPermissions();
    
    if (result.receive === 'granted') {
      logger.info('[Push] ✅ Notification permission granted');
      
      // Register with FCM
      await PushNotifications.register();
      
      // The token will be received via the registration listener
      return new Promise((resolve) => {
        const listener = PushNotifications.addListener('registration', (token) => {
          logger.info('[Push] ✅ FCM token obtained:', token.value);
          listener.remove();
          resolve(token.value);
        });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          listener.remove();
          logger.warn('[Push] ⚠️ Token registration timeout');
          resolve(null);
        }, 10000);
      });
    } else {
      logger.warn('[Push] ❌ Notification permission denied');
      return null;
    }
  } catch (error) {
    logger.error('[Push] ❌ Error requesting notification permission:', error);
    return null;
  }
};

/**
 * Register FCM token with backend
 * @param {string} token - FCM device token
 */
export const registerTokenWithBackend = async (token) => {
  try {
    logger.info('[Push] Registering token with backend...');
    await pushApi.post('/subscribe', {
      token,
      deviceInfo: {
        platform: Capacitor.getPlatform(),
        app: 'messenger-web'
      }
    });
    logger.info('[Push] ✅ Device registered for push notifications');
  } catch (error) {
    logger.error('[Push] ❌ Failed to register device:', error);
  }
};

/**
 * Listen for push notifications
 * @param {Function} callback - Callback function to handle notifications
 */
export const addPushNotificationListener = (callback) => {
  // Listen for foreground notifications
  const foregroundListener = PushNotifications.addListener('pushNotificationReceived', (notification) => {
    logger.info('[Push] Foreground notification received:', notification);
    if (callback) {
      callback(notification);
    }
  });

  // Listen for notification taps (app opened from notification)
  const tapListener = PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    logger.info('[Push] Notification action performed:', action);
    if (callback) {
      callback(action);
    }
  });

  return () => {
    foregroundListener.remove();
    tapListener.remove();
  };
};

/**
 * Unsubscribe from push notifications
 * @param {string} token - FCM token to unsubscribe
 */
export const unsubscribeFromPush = async (token) => {
  try {
    await pushApi.delete(`/unsubscribe?token=${encodeURIComponent(token)}`);
    logger.info('[Push] ✅ Unsubscribed from push notifications');
  } catch (error) {
    logger.error('[Push] ❌ Failed to unsubscribe:', error);
  }
};

/**
 * Get all active subscriptions for current user
 * @returns {Promise<Array>} List of subscriptions
 */
export const getMySubscriptions = async () => {
  try {
    const response = await pushApi.get('/my-subscriptions');
    return response.data;
  } catch (error) {
    logger.error('[Push] Failed to get subscriptions:', error);
    return [];
  }
};

/**
 * Check if push notifications are supported
 * @returns {boolean}
 */
export const isPushNotificationSupported = () => {
  return isNativePlatform();
};

/**
 * Initialize push notifications (call on app startup)
 */
export const initializePushNotifications = async () => {
  if (!isNativePlatform()) {
    return;
  }

  try {
    // Add listeners for token registration
    await PushNotifications.addListener('registration', (token) => {
      logger.info('[Push] Registration token:', token.value);
      registerTokenWithBackend(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      logger.error('[Push] Registration error:', error.error);
    });

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      logger.info('[Push] Push notification received:', notification);
    });

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      logger.info('[Push] Push notification action performed:', action);
    });

    logger.info('[Push] ✅ Push notification listeners initialized');
  } catch (error) {
    logger.error('[Push] ❌ Failed to initialize push notifications:', error);
  }
};

const pushNotificationService = {
  requestNotificationPermission,
  registerTokenWithBackend,
  addPushNotificationListener,
  unsubscribeFromPush,
  getMySubscriptions,
  isPushNotificationSupported,
  initializePushNotifications
};

export default pushNotificationService;
