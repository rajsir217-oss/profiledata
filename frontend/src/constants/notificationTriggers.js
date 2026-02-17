/**
 * Centralized notification triggers and constants
 * Eliminates duplication across components
 */

export const NOTIFICATION_TRIGGERS = [
  { value: 'new_match', label: '💕 New Match', group: 'Match Events' },
  { value: 'mutual_favorite', label: '💖 Mutual Favorite', group: 'Match Events' },
  { value: 'shortlist_added', label: '⭐ Shortlist Added', group: 'Match Events' },
  { value: 'profile_view', label: '👁️ Profile View', group: 'Activity' },
  { value: 'favorited', label: '❤️ Favorited', group: 'Activity' },
  { value: 'new_message', label: '💬 New Message', group: 'Messages' },
  { value: 'unread_messages', label: '📬 Unread Messages', group: 'Messages' },
  { value: 'pii_request', label: '🔒 PII Request', group: 'Privacy' },
  { value: 'pii_granted', label: '✅ PII Granted', group: 'Privacy' },
  { value: 'pii_denied', label: '❌ PII Denied', group: 'Privacy' },
  { value: 'weekly_digest', label: '📊 Weekly Digest', group: 'Engagement' },
  { value: 'poll_reminder', label: '📋 Poll Reminder', group: 'Engagement' },
  { value: 'daily_digest', label: '📊 Daily Digest', group: 'Engagement' },
  { value: 'monthly_digest', label: '📈 Monthly Digest', group: 'Engagement' }
];

export const TRIGGER_ICONS = {
  new_match: '💕',
  mutual_favorite: '💖',
  shortlist_added: '⭐',
  profile_view: '👁️',
  favorited: '❤️',
  new_message: '💬',
  message_read: '✓✓',
  pii_request: '🔐',
  pii_granted: '🔓',
  unread_messages: '📬',
  weekly_digest: '📊',
  poll_reminder: '📋',
  daily_digest: '📊',
  monthly_digest: '📈'
};

export const API_ENDPOINTS = {
  QUEUE: '/api/notifications/queue',
  LOGS: '/api/notifications/logs',
  ANALYTICS: '/api/notifications/analytics',
  TEMPLATES: '/api/notifications/templates'
};

export const REFRESH_INTERVALS = {
  QUEUE: 10000,      // 10 seconds
  LOGS: 15000,       // 15 seconds
  ANALYTICS: 30000,   // 30 seconds
  TEMPLATES: 60000    // 1 minute
};

export const FILTER_OPTIONS = {
  STATUS: [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'sent', label: 'Sent' },
    { value: 'failed', label: 'Failed' },
    { value: 'skipped', label: 'Skipped' }
  ],
  CHANNEL: [
    { value: 'all', label: 'All Channels' },
    { value: 'email', label: 'Email' },
    { value: 'sms', label: 'SMS' },
    { value: 'push', label: 'Push' }
  ]
};

export const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created Time' },
  { value: 'username', label: 'Username' },
  { value: 'trigger', label: 'Trigger' },
  { value: 'status', label: 'Status' }
];
