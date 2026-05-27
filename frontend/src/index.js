import React from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// frontend/src/index.js
import 'bootstrap/dist/css/bootstrap.min.css';

// Suppress cross-origin "Script error." from third-party SDKs (PayPal, etc.)
// These are harmless errors masked by browser CORS policy. Use the capture
// phase so we run before react-error-overlay's listener and can stop it from
// rendering the red dev overlay.
const isCrossOriginScriptError = (event) => {
  if (!event) return false;
  // window 'error' event for cross-origin scripts: message='Script error.' and no filename/lineno.
  if (event.message === 'Script error.' && !event.filename) return true;
  // unhandledrejection from blocked PayPal/Clover logger requests, etc.
  const reason = event.reason;
  if (reason) {
    const msg = (typeof reason === 'string' ? reason : (reason.message || '')) + '';
    if (
      msg.includes('Script error') ||
      msg.includes('ERR_BLOCKED_BY_CLIENT') ||
      msg.includes('Failed to fetch') && (msg.includes('paypal') || msg.includes('clover'))
    ) {
      return true;
    }
  }
  return false;
};

window.addEventListener('error', (event) => {
  if (isCrossOriginScriptError(event)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }
}, true);

window.addEventListener('unhandledrejection', (event) => {
  if (isCrossOriginScriptError(event)) {
    event.stopImmediatePropagation();
    event.preventDefault();
    return true;
  }
}, true);

// CRITICAL: Check for token on protected routes BEFORE React mounts
const publicPaths = ['/', '/login', '/register', '/register2', '/register-interest', '/verify-email', '/verify-email-sent', '/forgot-password', '/terms', '/privacy', '/community-guidelines', '/cookie-policy', '/l3v3l-info', '/help', '/logo-showcase', '/tooltip-demo'];
const currentPath = window.location.pathname;
const isPublicPath = publicPaths.some(path => currentPath === path || currentPath.startsWith(path + '/'));
const token = localStorage.getItem('token');

if (!isPublicPath && !token) {
  console.warn('🔒 index.js: No token on protected route - redirecting to login');
  window.location.replace('/login');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
