// frontend/src/components/ToastContainer.js
import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import toastService from '../services/toastService';

// Theme-aware colors that work in both light and dark themes
const TOAST_COLORS = {
  success: { border: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', icon: '✅' },
  error: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', icon: '❌' },
  warning: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', icon: '⚠️' },
  info: { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6', icon: 'ℹ️' },
};

const containerStyle = {
  position: 'fixed',
  top: '20px',
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 999999,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '10px',
  pointerEvents: 'none',
};

const getToastStyle = (type) => {
  const colors = TOAST_COLORS[type] || TOAST_COLORS.info;
  return {
    pointerEvents: 'auto',
    minWidth: '300px',
    maxWidth: '500px',
    padding: '14px 18px',
    background: colors.bg,
    color: colors.text,
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    borderLeft: `4px solid ${colors.border}`,
    animation: 'toast-slide-in 0.3s ease-out',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '500',
  };
};

const iconStyle = {
  fontSize: '18px',
  minWidth: '24px',
  textAlign: 'center',
};

const messageStyle = {
  flex: 1,
  margin: 0,
};

const closeStyle = {
  background: 'none',
  border: 'none',
  fontSize: '18px',
  cursor: 'pointer',
  padding: '0',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '4px',
  color: '#6b7280',
  opacity: 0.7,
};

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unsubscribe = toastService.subscribe((toast) => {
      setToasts(prev => [...prev, toast]);

      if (toast.duration) {
        setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
      }
    });

    return unsubscribe;
  }, [removeToast]);

  if (toasts.length === 0) return null;

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes toast-slide-in {
          from { transform: translateY(-40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <div style={containerStyle}>
        {toasts.map((toast) => {
          const colors = TOAST_COLORS[toast.type] || TOAST_COLORS.info;
          return (
            <div key={toast.id} style={getToastStyle(toast.type)}>
              <span style={iconStyle}>{toast.icon || colors.icon}</span>
              <p style={messageStyle}>{toast.message}</p>
              <button
                style={closeStyle}
                onClick={() => removeToast(toast.id)}
                onMouseEnter={(e) => { e.target.style.opacity = 1; }}
                onMouseLeave={(e) => { e.target.style.opacity = 0.7; }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>
    </>,
    document.body
  );
};

export default ToastContainer;
