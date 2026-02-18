/**
 * Custom hook for notification status utilities
 * Centralizes status mapping logic across all components
 */

import { useCallback } from 'react';

// Unified status mappings
export const STATUS_MAPPINGS = {
  BADGE: {
    'pending': 'queued',
    'scheduled': 'queued',
    'sent': 'sent',
    'delivered': 'sent',
    'failed': 'failed',
    'cancelled': 'failed',
    'processing': 'processing',
    'skipped': 'skipped',
    'error': 'failed'
  },
  CLASS: {
    'sent': 'status-sent',
    'delivered': 'status-sent',
    'pending': 'status-pending',
    'queued': 'status-pending',
    'scheduled': 'status-pending',
    'processing': 'status-processing',
    'failed': 'status-failed',
    'error': 'status-failed',
    'cancelled': 'status-failed',
    'skipped': 'status-skipped',
    'unknown': 'status-unknown'
  },
  ICON: {
    'sent': '✅',
    'delivered': '✅',
    'pending': '⏳',
    'queued': '⏳',
    'scheduled': '⏳',
    'processing': '⚙️',
    'failed': '❌',
    'error': '❌',
    'cancelled': '❌',
    'skipped': '⏭️',
    'unknown': '❓'
  }
};

const useNotificationStatus = () => {
  const getStatusBadge = useCallback((status) => {
    const mappedStatus = STATUS_MAPPINGS.BADGE[status] || status;
    
    const badges = {
      queued: { color: 'blue', icon: '⏳', text: 'Queued' },
      processing: { color: 'yellow', icon: '⚙️', text: 'Processing' },
      sent: { color: 'green', icon: '✅', text: 'Sent' },
      success: { color: 'green', icon: '✅', text: 'Success' },
      failed: { color: 'red', icon: '❌', text: 'Failed' },
      error: { color: 'red', icon: '❌', text: 'Error' },
      skipped: { color: 'gray', icon: '⏭️', text: 'Skipped' }
    };

    const badge = badges[mappedStatus] || badges.queued;
    return {
      className: `status-${badge.color}`,
      icon: badge.icon,
      text: badge.text
    };
  }, []);

  const getStatusClass = useCallback((status) => {
    return STATUS_MAPPINGS.CLASS[status] || STATUS_MAPPINGS.CLASS.unknown;
  }, []);

  const getStatusIcon = useCallback((status) => {
    return STATUS_MAPPINGS.ICON[status] || STATUS_MAPPINGS.ICON.unknown;
  }, []);

  return {
    getStatusBadge,
    getStatusClass,
    getStatusIcon,
    STATUS_MAPPINGS
  };
};

export default useNotificationStatus;
