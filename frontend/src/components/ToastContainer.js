// frontend/src/components/ToastContainer.js
import React, { useState, useEffect } from 'react';
import toastService from '../services/toastService';
// Uses global .toast-container and .toast from styles/components.css

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const unsubscribe = toastService.subscribe((toast) => {
      setToasts(prev => [...prev, toast]);

      // Auto-dismiss after duration
      if (toast.duration) {
        setTimeout(() => {
          removeToast(toast.id);
        }, toast.duration);
      }
    });

    return unsubscribe;
  }, []);

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}`}
        >
          <span className="toast-icon">{toast.icon}</span>
          <p className="toast-message">{toast.message}</p>
          <button
            className="toast-close"
            onClick={() => removeToast(toast.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
