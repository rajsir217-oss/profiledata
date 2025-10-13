// frontend/src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Register from './components/Register';
import Login from './components/Login';
import Profile from './components/Profile';
import EditProfile from './components/EditProfile';
import MatchingCriteria from './components/MatchingCriteria';
import TopMatches from './components/TopMatches';
import ShortLists from './components/ShortLists';
import SearchPage from './components/SearchPage';
import AdminPage from './components/AdminPage';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Favorites from './components/Favorites';
import Shortlist from './components/Shortlist';
import Exclusions from './components/Exclusions';
import MyLists from './components/MyLists';
import Messages from './components/Messages';
import Requests from './components/Requests';
import Dashboard from './components/Dashboard';
import Preferences from './components/Preferences';
import PIIManagement from './components/PIIManagement';
import UserManagement from './components/UserManagement';
import { TestDashboard } from './test-dashboard';
import ToastContainer from './components/ToastContainer';
import L3V3LInfo from './components/L3V3LInfo';
import L3V3LMatches from './components/L3V3LMatches';
import ProtectedRoute from './components/ProtectedRoute';
import TermsOfService from './components/TermsOfService';
import PrivacyPolicy from './components/PrivacyPolicy';
import CommunityGuidelines from './components/CommunityGuidelines';
import CookiePolicy from './components/CookiePolicy';
import './styles/index.css'; // Consolidated styles (includes themes)
import './App.css'; // App-specific layout only
import { getUserPreferences } from './api';

// Theme configuration
const themes = {
  'light-blue': { primary: '#6366f1', secondary: '#a78bfa', background: '#fffbf7', text: '#374151' },
  'dark': { primary: '#a78bfa', secondary: '#c4b5fd', background: '#1a1625', text: '#e5e7eb' },
  'light-pink': { primary: '#ec4899', secondary: '#f9a8d4', background: '#fdf2f8', text: '#4a5568' },
  'light-gray': { primary: '#64748b', secondary: '#94a3b8', background: '#f8fafc', text: '#1e293b' },
  'ultra-light-gray': { primary: '#475569', secondary: '#64748b', background: '#fcfcfd', text: '#0f172a' }
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

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

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
          console.log('✅ Loaded theme from database:', themeId);
        } catch (error) {
          console.log('⚠️ API error, using default theme');
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
      console.log('🔄 User logged in, reloading theme...');
      loadTheme();
    };
    
    window.addEventListener('userLoggedIn', handleUserLogin);
    
    return () => {
      window.removeEventListener('userLoggedIn', handleUserLogin);
    };
  }, []);

  // Initialize unified Socket.IO service (handles messages, online status, and unread counts)
  useEffect(() => {
    const username = localStorage.getItem('username');
    
    if (username) {
      console.log('🚀 Starting unified Socket.IO service for:', username);
      
      // Connect to WebSocket (handles everything: messages, status, unread counts)
      import('./services/socketService')
        .then(module => {
          module.default.connect(username);
        })
        .catch(error => {
          console.error('❌ Failed to connect to WebSocket:', error);
        });
    }

    // Cleanup on unmount
    return () => {
      const username = localStorage.getItem('username');
      
      if (username) {
        console.log('🧹 Disconnecting Socket.IO service');
        
        import('./services/socketService')
          .then(module => {
            module.default.disconnect();
          })
          .catch(error => {
            console.error('❌ Failed to disconnect:', error);
          });
        
        // Mark user as offline via beacon (non-blocking)
        navigator.sendBeacon(
          `${process.env.REACT_APP_API_URL || 'http://localhost:8000/api/users'}/online-status/${username}/offline`,
          ''
        );
      }
    };
  }, []);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };
  
  return (
    <Router>
      <div className="app-wrapper">
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onToggle={handleSidebarToggle}
        />
        <div className={`app-layout ${!isSidebarCollapsed ? 'sidebar-open' : ''}`}>
          <TopBar onSidebarToggle={handleSidebarToggle} isOpen={!isSidebarCollapsed} />
          <div className="main-content">
            <div className="container">
              <Routes>
              {/* Public routes */}
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Login />} />
              
              {/* Legal pages - accessible to all */}
              <Route path="/terms" element={<TermsOfService />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/community-guidelines" element={<CommunityGuidelines />} />
              <Route path="/cookie-policy" element={<CookiePolicy />} />
              <Route path="/about" element={<PrivacyPolicy />} />
              <Route path="/trademark" element={<PrivacyPolicy />} />
              
              {/* L3V3L Info page - accessible to all */}
              <Route path="/l3v3l-info" element={<L3V3LInfo />} />
              
              {/* Protected routes - require active status except profile/edit-profile/preferences */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
              <Route path="/matching-criteria" element={<ProtectedRoute><MatchingCriteria /></ProtectedRoute>} />
              <Route path="/top-matches" element={<ProtectedRoute><TopMatches /></ProtectedRoute>} />
              <Route path="/l3v3l-matches" element={<ProtectedRoute><L3V3LMatches /></ProtectedRoute>} />
              <Route path="/shortlists" element={<ProtectedRoute><ShortLists /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
              <Route path="/my-lists" element={<ProtectedRoute><MyLists /></ProtectedRoute>} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/shortlist" element={<ProtectedRoute><Shortlist /></ProtectedRoute>} />
              <Route path="/exclusions" element={<ProtectedRoute><Exclusions /></ProtectedRoute>} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/requests" element={<ProtectedRoute><Requests /></ProtectedRoute>} />
              <Route path="/pii-management" element={<ProtectedRoute><PIIManagement /></ProtectedRoute>} />
              <Route path="/user-management" element={<ProtectedRoute><UserManagement /></ProtectedRoute>} />
              <Route path="/test-dashboard" element={<ProtectedRoute><TestDashboard /></ProtectedRoute>} />
            </Routes>
          </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </Router>
  );
}

export default App;