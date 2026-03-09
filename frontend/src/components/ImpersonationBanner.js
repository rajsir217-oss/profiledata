import React, { useState, useEffect } from 'react';
import { isImpersonating, getImpersonatedUser, getAdminUsername, exitImpersonation } from '../utils/impersonation';
import './ImpersonationBanner.css';

const ImpersonationBanner = () => {
  const [visible, setVisible] = useState(false);
  const [targetUser, setTargetUser] = useState('');
  const [adminUser, setAdminUser] = useState('');

  useEffect(() => {
    const check = () => {
      if (isImpersonating()) {
        setVisible(true);
        setTargetUser(getImpersonatedUser());
        setAdminUser(getAdminUsername());
      } else {
        setVisible(false);
      }
    };
    check();
    // Re-check on storage changes (in case another tab exits)
    window.addEventListener('storage', check);
    return () => window.removeEventListener('storage', check);
  }, []);

  if (!visible) return null;

  const handleExit = () => {
    exitImpersonation();
    // Navigate to admin page and reload to reset all state
    window.location.href = '/admin';
  };

  return (
    <div className="impersonation-banner">
      <span className="impersonation-icon">🎭</span>
      <span className="impersonation-text">
        Viewing as <strong>{targetUser}</strong>
        <span className="impersonation-admin"> (admin: {adminUser})</span>
      </span>
      <button className="impersonation-exit-btn" onClick={handleExit}>
        ✕ Exit Impersonation
      </button>
    </div>
  );
};

export default ImpersonationBanner;
