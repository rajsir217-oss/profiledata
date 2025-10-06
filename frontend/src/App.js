// frontend/src/App.js
import React, { useState } from 'react';
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
import { TestDashboard } from './test-dashboard';

function App() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);

  const handleSidebarToggle = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <Router>
      <Sidebar 
        isCollapsed={isSidebarCollapsed}
        onToggle={handleSidebarToggle}
      />
      <div className={`app-layout ${!isSidebarCollapsed ? 'sidebar-open' : ''}`}>
        <TopBar onSidebarToggle={handleSidebarToggle} isOpen={!isSidebarCollapsed} />
        <div className="main-content">
          <div className="container mt-5">
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/edit-profile" element={<EditProfile />} />
              <Route path="/matching-criteria" element={<MatchingCriteria />} />
              <Route path="/top-matches" element={<TopMatches />} />
              <Route path="/shortlists" element={<ShortLists />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/shortlist" element={<Shortlist />} />
              <Route path="/exclusions" element={<Exclusions />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/requests" element={<Requests />} />
              <Route path="/test-dashboard" element={<TestDashboard />} />
              <Route path="/" element={<Login />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;