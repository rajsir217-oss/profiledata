import React from 'react';
import './ActivationBadge.css';

const ActivationBadge = ({ accountStatus, emailVerified, adminApprovalStatus, onResendEmail, username }) => {
  
  // Determine badge configuration based on status
  const getBadgeConfig = () => {
    // Priority 1: Pending email verification
    if (!emailVerified && accountStatus === 'pending_email_verification') {
      return {
        type: 'warning',
        icon: '📧',
        title: 'Email Verification Pending',
        message: "Please check your email and click the verification link to activate your account.",
        action: onResendEmail ? {
          label: 'Resend Verification Email',
          handler: onResendEmail
        } : null
      };
    }

    // Priority 2: Pending admin approval
    if (emailVerified && adminApprovalStatus === 'pending' && accountStatus === 'pending_admin_approval') {
      return {
        type: 'info',
        icon: '⏳',
        title: 'Pending Admin Activation',
        message: "Your email is verified! Our team is reviewing your profile. This usually takes less than 24 hours.",
        action: null
      };
    }

    // Priority 3: Admin rejected
    if (adminApprovalStatus === 'rejected') {
      return {
        type: 'danger',
        icon: '❌',
        title: 'Application Rejected',
        message: "Your application was not approved. Please contact support for more information.",
        action: null
      };
    }

    // Priority 4: Account suspended
    if (accountStatus === 'suspended') {
      return {
        type: 'danger',
        icon: '🚫',
        title: 'Account Suspended',
        message: "Your account has been suspended. Please contact support to resolve this issue.",
        action: null
      };
    }

    // Priority 5: Account deactivated
    if (accountStatus === 'deactivated') {
      return {
        type: 'secondary',
        icon: '⚪',
        title: 'Account Deactivated',
        message: "Your account is currently deactivated. You can reactivate it anytime from your settings.",
        action: null
      };
    }

    // No badge needed for active users
    return null;
  };

  const config = getBadgeConfig();

  // Don't render anything for active users
  if (!config) {
    return null;
  }

  return (
    <div className={`activation-badge activation-badge-${config.type}`}>
      <div className="activation-badge-header">
        <span className="activation-badge-icon">{config.icon}</span>
        <h5 className="activation-badge-title">{config.title}</h5>
      </div>
      <p className="activation-badge-message">{config.message}</p>
      {config.action && (
        <button 
          className="btn btn-sm btn-outline-primary activation-badge-action"
          onClick={config.action.handler}
        >
          {config.action.label}
        </button>
      )}
    </div>
  );
};

export default ActivationBadge;
