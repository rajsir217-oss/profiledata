import React, { useState, useEffect } from 'react';
import { getBackendUrl } from '../config/apiConfig';
import logger from '../utils/logger';
import './MembershipStatus.css';

const MembershipStatus = () => {
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMembershipStatus();
  }, []);

  const fetchMembershipStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/contributions/membership/status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();
      if (data.success) {
        setMembership(data.membership);
      }
    } catch (error) {
      logger.error('Error fetching membership status:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="membership-status loading">Loading...</div>;
  }

  if (!membership || membership.type === 'none') {
    return null;
  }

  const getBadgeClass = () => {
    switch (membership.type) {
      case 'one_time':
        return 'badge permanent';
      case '3_month':
        return 'badge subscription';
      case '1_year':
        return 'badge subscription premium';
      default:
        return 'badge';
    }
  };

  const getBadgeText = () => {
    switch (membership.type) {
      case 'one_time':
        return '🏆 Lifetime Member';
      case '3_month':
        return '⏰ 3-Month Member';
      case '1_year':
        return '⭐ 1-Year Member';
      default:
        return 'Member';
    }
  };

  const formatDate = (dateString) => {
    if (! dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="membership-status">
      <div className={`status-badge ${getBadgeClass()}`}>
        {getBadgeText()}
      </div>
      {membership.endDate && (
        <div className="expiry-info">
          Expires: {formatDate(membership.endDate)}
        </div>
      )}
      {membership.autoRenew && (
        <div className="auto-renew-info">
          ♻️ Auto-renewal enabled
        </div>
      )}
    </div>
  );
};

export default MembershipStatus;
