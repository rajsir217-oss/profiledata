/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging for push notifications
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../api';
import logger from '../utils/logger';

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// VAPID key for web push
const VAPID_KEY = process.env.REACT_APP_FIREBASE_VAPID_KEY;

// Check if Firebase is configured
const isFirebaseConfigured = () => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.projectId &&
    VAPID_KEY
  );
};

// Initialize Firebase only if configured
let app;
let messaging;
let firebaseEnabled = false;

if (isFirebaseConfigured()) {
  try {
    logger.debug('Firebase Config Check:', {
      hasApiKey: !!firebaseConfig.apiKey,
      hasProjectId: !!firebaseConfig.projectId,
      hasVapidKey: !!VAPID_KEY,
      vapidKeyLength: VAPID_KEY?.length,
      vapidKeyStart: VAPID_KEY?.substring(0, 10)
    });
    
    app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    firebaseEnabled = true;
    logger.success('Firebase initialized successfully');
  } catch (error) {
    logger.warn('Firebase initialization failed:', error.message);
    firebaseEnabled = false;
  }
} else {
  logger.info('Firebase push notifications not configured - skipping initialization');
  firebaseEnabled = false;
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM device token or null
 */
export const requestNotificationPermission = async () => {
  try {
    // Check if Firebase is configured
    if (!firebaseEnabled) {
      logger.info('Push notifications disabled - Firebase not configured');
      return null;
    }

    // Check if notifications are supported
    if (!('Notification' in window)) {
      logger.warn('This browser does not support notifications');
      return null;
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      logger.warn('This browser does not support service workers');
      return null;
    }

    // Request permission first
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      logger.success('Notification permission granted');
      logger.debug('Using VAPID key:', VAPID_KEY?.substring(0, 20) + '...');
      
      // Get FCM token (Firebase will register its own service worker)
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });
      
      if (token) {
        logger.success('FCM token obtained:', token.substring(0, 20) + '...');
        
        // Send token to backend
        try {
          await api.post('/push-subscriptions/subscribe', {
            token,
            deviceInfo: {
              browser: navigator.userAgent.split(' ').slice(-1)[0],
              os: navigator.platform,
              userAgent: navigator.userAgent
            }
          });
          
          logger.success('Device registered for push notifications');
          return token;
        } catch (error) {
          logger.error('Failed to register device:', error);
          return token; // Return token even if backend registration fails
        }
      } else {
        logger.warn('No FCM token available');
        return null;
      }
    } else if (permission === 'denied') {
      logger.warn('Notification permission denied');
      return null;
    } else {
      logger.info('Notification permission dismissed');
      return null;
    }
  } catch (error) {
    logger.error('Error requesting notification permission:', error);
    return null;
  }
};

/**
 * Listen for foreground messages
 * @param {Function} callback - Callback function to handle messages
 * @returns {Function} Unsubscribe function
 */
export const onMessageListener = (callback) => {
  if (!messaging) {
    logger.warn('Messaging not initialized');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    logger.info('Foreground message received:', payload);
    
    // Extract notification data
    const notification = {
      title: payload.notification?.title || 'New Notification',
      body: payload.notification?.body || '',
      data: payload.data || {}
    };
    
    // Call the callback
    if (callback) {
      callback(notification);
    }
  });
};

/**
 * Unsubscribe from push notifications
 * @param {string} token - FCM token to unsubscribe
 */
export const unsubscribeFromPush = async (token) => {
  try {
    await api.delete(`/push-subscriptions/unsubscribe?token=${encodeURIComponent(token)}`);
    logger.success('Unsubscribed from push notifications');
  } catch (error) {
    logger.error('Failed to unsubscribe:', error);
  }
};

/**
 * Get all active subscriptions for current user
 * @returns {Promise<Array>} List of subscriptions
 */
export const getMySubscriptions = async () => {
  try {
    const response = await api.get('/push-subscriptions/my-subscriptions');
    return response.data;
  } catch (error) {
    logger.error('Failed to get subscriptions:', error);
    return [];
  }
};

/**
 * Send a test notification
 */
export const sendTestNotification = async () => {
  try {
    const response = await api.post('/push-subscriptions/test');
    logger.success('Test notification sent:', response.data);
    return response.data;
  } catch (error) {
    logger.error('Failed to send test notification:', error);
    throw error;
  }
};

/**
 * Check if push notifications are supported
 * @returns {boolean}
 */
export const isPushNotificationSupported = () => {
  return 'Notification' in window && 'serviceWorker' in navigator && !!messaging;
};

/**
 * Get current notification permission status
 * @returns {string} 'granted', 'denied', or 'default'
 */
export const getNotificationPermission = () => {
  if (!('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
};

const pushNotificationService = {
  requestNotificationPermission,
  onMessageListener,
  unsubscribeFromPush,
  getMySubscriptions,
  sendTestNotification,
  isPushNotificationSupported,
  getNotificationPermission
};

export default pushNotificationService;
