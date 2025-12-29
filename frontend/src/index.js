import React from 'react';
import ReactDOM from 'react-dom/client';
// import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
// frontend/src/index.js
import 'bootstrap/dist/css/bootstrap.min.css';

// CRITICAL: Check for token on protected routes BEFORE React mounts
const publicPaths = ['/', '/login', '/register', '/register2', '/verify-email', '/verify-email-sent', '/forgot-password', '/terms', '/privacy', '/community-guidelines', '/cookie-policy', '/l3v3l-info', '/help', '/logo-showcase', '/tooltip-demo'];
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
