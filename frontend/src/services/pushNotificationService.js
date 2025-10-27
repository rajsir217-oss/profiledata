/**
 * Push Notification Service
 * Handles Firebase Cloud Messaging for push notifications
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import api from '../api';

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

// Initialize Firebase
let app;
let messaging;

try {
  app = initializeApp(firebaseConfig);
  messaging = getMessaging(app);
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
}

/**
 * Request notification permission and get FCM token
 * @returns {Promise<string|null>} FCM device token or null
 */
export const requestNotificationPermission = async () => {
  try {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return null;
    }

    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.warn('This browser does not support service workers');
      return null;
    }

    // Request permission first
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('✅ Notification permission granted');
      
      // Get FCM token (Firebase will register its own service worker)
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY
      });
      
      if (token) {
        console.log('✅ FCM token obtained:', token.substring(0, 20) + '...');
        
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
          
          console.log('✅ Device registered for push notifications');
          return token;
        } catch (error) {
          console.error('❌ Failed to register device:', error);
          return token; // Return token even if backend registration fails
        }
      } else {
        console.warn('⚠️ No FCM token available');
        return null;
      }
    } else if (permission === 'denied') {
      console.warn('⚠️ Notification permission denied');
      return null;
    } else {
      console.log('ℹ️ Notification permission dismissed');
      return null;
    }
  } catch (error) {
    console.error('❌ Error requesting notification permission:', error);
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
    console.warn('Messaging not initialized');
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    console.log('📬 Foreground message received:', payload);
    
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
    console.log('✅ Unsubscribed from push notifications');
  } catch (error) {
    console.error('❌ Failed to unsubscribe:', error);
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
    console.error('❌ Failed to get subscriptions:', error);
    return [];
  }
};

/**
 * Send a test notification
 */
export const sendTestNotification = async () => {
  try {
    const response = await api.post('/push-subscriptions/test');
    console.log('✅ Test notification sent:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Failed to send test notification:', error);
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

export default {
  requestNotificationPermission,
  onMessageListener,
  unsubscribeFromPush,
  getMySubscriptions,
  sendTestNotification,
  isPushNotificationSupported,
  getNotificationPermission
};
