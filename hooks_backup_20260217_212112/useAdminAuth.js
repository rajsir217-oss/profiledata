/**
 * Custom hook for admin authentication
 * Centralizes admin access checking logic across all components
 */

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const useAdminAuth = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    const username = localStorage.getItem('username');
    const userRole = localStorage.getItem('userRole');
    
    if (userRole !== 'admin') {
      console.warn('⚠️ Unauthorized access attempt by:', username);
      navigate('/dashboard');
    }
  }, [navigate]);
  
  return null;
};

export default useAdminAuth;
