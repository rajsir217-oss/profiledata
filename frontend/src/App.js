// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
// Registration and Profile pages (both versions available)
import Register from './components/Register';
import Register2 from './components/Register2';
import EmailVerificationSent from './components/EmailVerificationSent';
import EditProfile from './components/EditProfile';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import VerifyEmail from './components/VerifyEmail';
import Profile from './components/Profile';
import MatchingCriteria from './components/MatchingCriteria';
import TopMatches from './components/TopMatches';
import SearchPage2 from './components/SearchPage2';
import AdminPage from './components/AdminPage';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Favorites from './components/Favorites';
import Shortlist from './components/Shortlist';
import Exclusions from './components/Exclusions';
import Messages from './components/Messages';
import Requests from './components/Requests';
import Dashboard from './components/Dashboard';
import UnifiedPreferences from './components/UnifiedPreferences';
import PIIManagement from './components/PIIManagement';
import Testimonials from './components/Testimonials';
import ContactUs from './components/ContactUs';
import AdminContactManagement from './components/AdminContactManagement';
import UserManagement from './components/UserManagement';
import ChangeAdminPassword from './components/ChangeAdminPassword';
import RoleManagement from './components/RoleManagement';
import SavedSearchNotificationManager from './components/admin/SavedSearchNotificationManager';
import { TestDashboard } from './test-dashboard';
import DynamicScheduler from './components/DynamicScheduler';
import NotificationTester from './components/NotificationTester';
import NotificationManagement from './components/NotificationManagement';
import EmailTemplatePreview from './components/EmailTemplatePreview';
import EmailAnalytics from './components/EmailAnalytics';
import ActivityLogs from './components/ActivityLogs';
import ToastContainer from './components/ToastContainer';
import InvitationManager from './components/InvitationManager';
import PauseAnalyticsDashboard from './components/PauseAnalyticsDashboard';
import PIIAccessRefreshNotification from './components/PIIAccessRefreshNotification';
import L3V3LInfo from './components/L3V3LInfo';
import HelpPage from './components/HelpPage';
// L3V3LMatches now handled by SearchPage2 with mode='l3v3l'
import LogoShowcase from './components/LogoShowcase';
import ProtectedRoute from './components/ProtectedRoute';
import { Navigate } from 'react-router-dom';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import CommunityGuidelines from './components/CommunityGuidelines';
import CookiePolicy from './components/CookiePolicy';
import './styles/index.css'; // Consolidated styles (includes themes)
import './App.css'; // App-specific layout only
import { getUserPreferences } from './api';
import { getApiUrl } from './config/apiConfig';
import { requestNotificationPermission, onMessageListener } from './services/pushNotificationService';
import toastService from './services/toastService';
import logger from './utils/logger';

// Theme configuration
const themes = {
  'light-blue': { primary: '#6366f1', secondary: '#a78bfa', background: '#fffbf7', text: '#374151' },
  'dark': { primary: '#a78bfa', secondary: '#c4b5fd', background: '#1a1625', text: '#e5e7eb' },
  'light-pink': { primary: '#ec4899', secondary: '#f9a8d4', background: '#fff5f7', text: '#374151' },
  'light-gray': { primary: '#64748b', secondary: '#94a3b8', background: '#f9fafb', text: '#1f2937' },
  'ultra-light-gray': { primary: '#475569', secondary: '#64748b', background: '#fcfcfd', text: '#0f172a' },
  'ultra-light-green': { primary: '#10b981', secondary: '#34d399', background: '#f0fdf4', text: '#064e3b' },
  'indian-wedding': { primary: '#ff6b35', secondary: '#f7931e', background: '#fffaf0', text: '#7c2d12' }
};

const applyTheme = (themeId) => {
  document.body.className = `theme-${themeId}`;
  const theme = themes[themeId];
  if (theme) {
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primary);
    root.style.setProperty('--secondary-color', theme.secondary);
    root.style.setProperty('--background-color', theme.background);
    root.style.setProperty('--text-color', theme.text);
  }
};

// App Content Component (inside Router to use useLocation)
function AppContent() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const location = useLocation();
  
  // Routes where sidebar and topbar should be hidden
  const hideNavigation = ['/', '/login', '/register', '/register2', '/verify-email', '/verify-email-sent'].includes(location.pathname);

  // Initialize theme on app load
  useEffect(() => {
    const loadTheme = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        // User is logged in, load theme from API (not localStorage!)
        try {
          const prefs = await getUserPreferences();
          const themeId = prefs.themePreference || 'light-blue';
          applyTheme(themeId);
          // Theme loaded from database
        } catch (error) {
          // If 401, the interceptor will redirect to login
          // For other errors, use default theme
          if (error.response?.status !== 401) {
            console.warn('Failed to load theme preferences, using default');
          }
          applyTheme('light-blue');
        }
      } else {
        // Not logged in, use default
        applyTheme('light-blue');
      }
    };
    
    loadTheme();
    
    // Listen for login events to reload theme
    const handleUserLogin = () => {
      // User logged in, reloading theme
      loadTheme();
    };
    
    window.addEventListener('userLoggedIn', handleUserLogin);
    
    return () => {
      window.removeEventListener('userLoggedIn', handleUserLogin);
    };
  }, []);

  // Initialize push notifications when user is logged in
  useEffect(() => {
    const initializePushNotifications = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        // User is logged in, request notification permission
        // TEMPORARILY DISABLED: Backend endpoint not yet implemented
        // TODO: Enable when /api/users/push-subscriptions/subscribe endpoint is ready
        try {
          // await requestNotificationPermission();
          logger.info('Push notifications temporarily disabled - endpoint not implemented');
        } catch (error) {
          logger.error('Failed to initialize push notifications:', error);
        }
        
        // Listen for foreground messages
        const unsubscribe = onMessageListener((notification) => {
          // Show toast notification when message received in foreground
          const message = `${notification.title}\n${notification.body}`;
          toastService.info(message, 5000);
        });
        
        return unsubscribe;
      }
    };
    
    initializePushNotifications();
    
    // Re-initialize on login
    const handleLogin = () => {
      initializePushNotifications();
    };
    
    window.addEventListener('userLoggedIn', handleLogin);
    
    return () => {
      window.removeEventListener('userLoggedIn', handleLogin);
    };
  }, []);

  // Initialize unified Socket.IO service (handles messages, online status, and unread counts)
  useEffect(() => {
    const username = localStorage.getItem('username');
    
    if (username) {
      // Starting Socket.IO service
      
      // Connect to WebSocket (handles everything: messages, status, unread counts)
      import('./services/socketService')
        .then(module => {
          module.default.connect(username);
        })
        .catch(error => {
          logger.error('Failed to connect to WebSocket:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      const username = localStorage.getItem('username');
      
      if (username) {
        // Disconnecting Socket.IO service
        
        import('./services/socketService')
          .then(module => {
            module.default.disconnect();
          })
          .catch(error => {
            logger.error('Failed to disconnect:', error);
          });
        
        // Mark user as offline via beacon (non-blocking)
        navigator.sendBeacon(
          `${getApiUrl()}/online-status/${username}/offline`,
          ''
        );
      }
    };
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  return (
    <div className="app-wrapper">
      {!hideNavigation && (
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
        />
      )}
      <div className={`app-layout ${!isSidebarCollapsed && !hideNavigation ? 'sidebar-open' : ''} ${hideNavigation ? 'no-navigation' : ''}`}>
        {!hideNavigation && (
          <TopBar onSidebarToggle={handleSidebarToggle} isOpen={!isSidebarCollapsed} />
        )}
        <div className={hideNavigation ? "main-content-full" : "main-content"}>
          <div className={hideNavigation ? "" : "container"}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/register" element={<Register />} />
              <Route path="/register2" element={<Register2 />} />
              <Route path="/login" element={<Login />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email-sent" element={<EmailVerificationSent />} />
              
              {/* Legal pages - accessible to all */}
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/community-guidelines" element={<CommunityGuidelines />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/about" element={<PrivacyPolicy />} />
              <Route path="/trademark" element={<PrivacyPolicy />} />
              
              {/* L3V3L Info page - accessible to all */}
              <Route path="/l3v3l-info" element={<L3V3LInfo />} />
              
              {/* Help Center - accessible to all */}
              <Route path="/help" element={<HelpPage />} />
              
              {/* Logo Showcase - for design review */}
              <Route path="/logo-showcase" element={<LogoShowcase />} />
              
              {/* Protected routes - require active status except profile/edit-profile/preferences */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/admin/change-password" element={<ProtectedRoute><ChangeAdminPassword /></ProtectedRoute>} />
              <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><Register2 mode="edit" /></ProtectedRoute>} />
              <Route path="/edit-profile-old" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/preferences" element={<ProtectedRoute><UnifiedPreferences /></ProtectedRoute>} />
              <Route path="/testimonials" element={<ProtectedRoute><Testimonials /></ProtectedRoute>} />
              <Route path="/contact" element={<ProtectedRoute><ContactUs /></ProtectedRoute>} />
              <Route path="/admin/contact" element={<ProtectedRoute><AdminContactManagement /></ProtectedRoute>} />
              <Route path="/admin/notifications" element={<ProtectedRoute><SavedSearchNotificationManager /></ProtectedRoute>} />
              <Route path="/admin/settings" element={<Navigate to="/preferences" replace />} />
              <Route path="/matching-criteria" element={<ProtectedRoute><MatchingCriteria /></ProtectedRoute>} />
              <Route path="/top-matches" element={<ProtectedRoute><TopMatches /></ProtectedRoute>} />
              {/* Hybrid Search - filters + L3V3L scoring (premium) */}
              <Route path="/search" element={<ProtectedRoute><SearchPage2 /></ProtectedRoute>} />
              {/* Legacy L3V3L route redirects to search */}
              <Route path="/l3v3l-matches" element={<Navigate to="/search" replace />} />
              {/* MyLists removed - functionality merged into Dashboard */}
              <Route path="/my-lists" element={<Navigate to="/dashboard" replace />} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/shortlist" element={<ProtectedRoute><Shortlist /></ProtectedRoute>} />
              <Route path="/exclusions" element={<ProtectedRoute><Exclusions /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
              <Route path="/pii-management" element={<ProtectedRoute><PIIManagement /></ProtectedRoute>} />
              <Route path="/notifications" element={<Navigate to="/preferences" replace />} />
              <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/role-management" element={<ProtectedRoute><RoleManagement /></ProtectedRoute>} />
              <Route path="/test-dashboard" element={<ProtectedRoute><TestDashboard /></ProtectedRoute>} />
              <Route path="/dynamic-scheduler" element={<ProtectedRoute><DynamicScheduler currentUser={localStorage.getItem('username')} /></ProtectedRoute>} />
              <Route path="/notification-tester" element={<ProtectedRoute><NotificationTester /></ProtectedRoute>} />
              <Route path="/notification-management" element={<ProtectedRoute><NotificationManagement /></ProtectedRoute>} />
              <Route path="/email-templates" element={<ProtectedRoute><EmailTemplatePreview /></ProtectedRoute>} />
              <Route path="/email-analytics" element={<ProtectedRoute><EmailAnalytics /></ProtectedRoute>} />
              <Route path="/activity-logs" element={<ProtectedRoute><ActivityLogs /></ProtectedRoute>} />
              <Route path="/pause-analytics" element={<ProtectedRoute><PauseAnalyticsDashboard /></ProtectedRoute>} />
              <Route path="/invitations" element={<ProtectedRoute><InvitationManager /></ProtectedRoute>} />
              {/* Legacy routes - redirect to unified page */}
              <Route path="/template-manager" element={<Navigate to="/notification-management" replace />} />
              <Route path="/event-queue-manager" element={<Navigate to="/notification-management" replace />} />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component (wrapper for Router)
function App() {
  return (
    <HelmetProvider>
      <Router>
        <AppContent />
        <ToastContainer />
        <PIIAccessRefreshNotification />
      </Router>
    </HelmetProvider>
  );
}

export default App;