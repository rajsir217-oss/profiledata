/* eslint-disable no-undef */
/**
 * Firebase Cloud Messaging Service Worker
 * Handles background push notifications when the app is not in focus
 */

// Import Firebase scripts for service worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase configuration (must match your .env.local)
const firebaseConfig = {
  apiKey: "AIzaSyBIAPoQzqKnp7XovCmock897kMDpWY8QeQ",
  authDomain: "l3v3lmatchmsgs.firebaseapp.com",
  projectId: "l3v3lmatchmsgs",
  storageBucket: "l3v3lmatchmsgs.firebasestorage.app",
  messagingSenderId: "885095197155",
  appId: "1:885095197155:web:b24bd160c031e9097b18d6",
  measurementId: "G-GXYTLN1J8G"
};

// Initialize Firebase in service worker
firebase.initializeApp(firebaseConfig);

// Get Firebase Messaging instance
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  
  // Customize notification
  const notificationTitle = payload.notification?.title || 'ProfileData Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: payload.data?.trigger || 'general',
    data: payload.data,
    requireInteraction: false,
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  // Show notification
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if not
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
  );
});
