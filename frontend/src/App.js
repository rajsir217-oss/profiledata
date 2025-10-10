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
import Messages from './components/Messages';
import Requests from './components/Requests';
import Dashboard from './components/Dashboard';
import Preferences from './components/Preferences';
import PIIManagement from './components/PIIManagement';
import UserManagement from './components/UserManagement';
import { TestDashboard } from './test-dashboard';
import ToastContainer from './components/ToastContainer';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';
import './themes/themes.css';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  // Initialize theme on app load
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme') || 'light-blue';
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  // Start message polling, WebSocket, realtime messaging, and mark user as online when logged in
  useEffect(() => {
    console.log('🚀 App.js useEffect running - checking for username');
    const username = localStorage.getItem('username');
    console.log('👤 Username from localStorage:', username);
    
    if (username) {
      console.log('✅ Username found, starting services');
      
      // Initialize realtime messaging service (SSE)
      import('./services/realtimeMessagingService')
        .then(module => {
          console.log('📡 Initializing realtime messaging service');
          module.default.initialize(username);
        })
        .catch(error => {
          console.error('❌ Failed to initialize realtime messaging:', error);
        });
      
      // Connect to WebSocket
      import('./services/socketService')
        .then(module => {
          console.log('🔌 Connecting to WebSocket');
          module.default.connect(username);
        })
        .catch(error => {
          console.error('❌ Failed to connect to WebSocket:', error);
        });
      
      // Start message polling (backup)
      import('./services/messagePollingService')
        .then(module => {
          console.log('📦 Message polling service loaded');
          module.default.startPolling(username);
        })
        .catch(error => {
          console.error('❌ Failed to load message polling service:', error);
        });
      
      // Mark user as online
      import('./services/onlineStatusService')
        .then(module => {
          console.log('🟢 Marking user as online');
          module.default.goOnline(username);
        })
        .catch(error => {
          console.error('❌ Failed to mark user as online:', error);
        });
    } else {
      console.log('⚠️ No username in localStorage, skipping services');
    }

    // Cleanup on unmount
    return () => {
      const username = localStorage.getItem('username');
      console.log('🧹 App.js cleanup - stopping services');
      
      // Disconnect realtime messaging service
      import('./services/realtimeMessagingService')
        .then(module => {
          console.log('📡 Disconnecting realtime messaging');
          module.default.disconnect();
        })
        .catch(error => {
          console.error('❌ Failed to disconnect realtime messaging:', error);
        });
      
      // Disconnect WebSocket
      import('./services/socketService')
        .then(module => {
          console.log('🔌 Disconnecting WebSocket');
          module.default.disconnect();
        })
        .catch(error => {
          console.error('❌ Failed to disconnect WebSocket:', error);
        });
      
      // Stop message polling
      import('./services/messagePollingService')
        .then(module => {
          module.default.stopPolling();
        })
        .catch(error => {
          console.error('❌ Failed to stop message polling:', error);
        });
      
      // Mark user as offline
      if (username) {
        import('./services/onlineStatusService')
          .then(module => {
            console.log('⚪ Marking user as offline');
            module.default.goOffline(username);
          })
          .catch(error => {
            console.error('❌ Failed to mark user as offline:', error);
          });
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
              
              {/* Protected routes - require active status except profile/edit-profile/preferences */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />
              <Route path="/profile/:username" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/edit-profile" element={<ProtectedRoute><EditProfile /></ProtectedRoute>} />
              <Route path="/preferences" element={<ProtectedRoute><Preferences /></ProtectedRoute>} />
              <Route path="/matching-criteria" element={<ProtectedRoute><MatchingCriteria /></ProtectedRoute>} />
              <Route path="/top-matches" element={<ProtectedRoute><TopMatches /></ProtectedRoute>} />
              <Route path="/shortlists" element={<ProtectedRoute><ShortLists /></ProtectedRoute>} />
              <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
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