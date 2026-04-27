/**
 * useAuth Hook
 * Reactive auth state that listens for login/logout events across tabs.
 * Replaces direct localStorage.getItem('token') reads that are stale after mount.
 */

import { useState, useEffect, useCallback } from 'react';

export function useAuth() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('token'));
  const [username, setUsername] = useState(() => localStorage.getItem('username') || null);
  const [userRole, setUserRole] = useState(() => localStorage.getItem('userRole') || null);

  const refresh = useCallback(() => {
    setIsLoggedIn(!!localStorage.getItem('token'));
    setUsername(localStorage.getItem('username') || null);
    setUserRole(localStorage.getItem('userRole') || null);
  }, []);

  useEffect(() => {
    // Login dispatched from Login.js (same-tab)
    const onLogin = () => refresh();
    window.addEventListener('loginStatusChanged', onLogin);

    // Logout in other tabs triggers storage event on 'token' key removal
    const onStorage = (e) => {
      if (e.key === 'token') {
        refresh();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener('loginStatusChanged', onLogin);
      window.removeEventListener('storage', onStorage);
    };
  }, [refresh]);

  return { isLoggedIn, username, userRole };
}

export default useAuth;
