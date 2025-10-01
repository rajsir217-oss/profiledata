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
import AdminPage from './components/AdminPage';
import ChangeAdminPassword from './components/ChangeAdminPassword';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import './App.css';

function App() {
  const [isSidebarPinned, setIsSidebarPinned] = useState(false);

  const handleSidebarPinChange = (isPinned) => {
    setIsSidebarPinned(isPinned);
  };

  return (
    <Router>
      <Sidebar onPinChange={handleSidebarPinChange} />
      <div className={`app-layout ${isSidebarPinned ? 'sidebar-pinned' : ''}`}>
        <TopBar />
        <div className="main-content">
          <div className="container mt-5">
            <Routes>
              <Route path="/register" element={<Register />} />
              <Route path="/login" element={<Login />} />
              <Route path="/profile/:username" element={<Profile />} />
              <Route path="/edit-profile" element={<EditProfile />} />
              <Route path="/matching-criteria" element={<MatchingCriteria />} />
              <Route path="/top-matches" element={<TopMatches />} />
              <Route path="/shortlists" element={<ShortLists />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/admin/edit/:username" element={<EditProfile />} />
              <Route path="/admin/change-password" element={<ChangeAdminPassword />} />
              <Route path="/" element={<Login />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;