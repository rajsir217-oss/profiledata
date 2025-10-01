import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AdminPage.css';

const AdminPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc');

  // Multi-layer security check
  useEffect(() => {
    const checkAdminAccess = () => {
      const username = localStorage.getItem('username');
      const token = localStorage.getItem('token');

      // Security Layer 1: Check if logged in
      if (!username || !token) {
        console.warn('⚠️ Unauthorized access attempt - No credentials');
        navigate('/login');
        return false;
      }

      // Security Layer 2: Check if user is admin
      if (username !== 'admin') {
        console.warn(`⚠️ Unauthorized access attempt by user: ${username}`);
        alert('🚫 Access Denied: Admin privileges required');
        navigate('/');
        return false;
      }

      // Security Layer 3: Verify token exists
      if (!token || token.length < 10) {
        console.warn('⚠️ Invalid token detected');
        navigate('/login');
        return false;
      }

      return true;
    };

    if (checkAdminAccess()) {
      loadAllUsers();
    }
  }, [navigate]);

  const loadAllUsers = async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all users - you'll need to create this endpoint
      const response = await api.get('/admin/users');
      setUsers(response.data.users || []);
      
      console.log(`✅ Loaded ${response.data.users?.length || 0} users`);
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. ' + (err.response?.data?.detail || err.message));
      
      // If unauthorized, redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        alert('🚫 Access Denied: Admin privileges required');
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (username) => {
    // Navigate to edit page for specific user
    navigate(`/admin/edit/${username}`);
  };

  const handleDeleteClick = (user) => {
    setDeleteConfirm(user);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setError('');
      setSuccessMsg('');

      const response = await api.delete(`/profile/${deleteConfirm.username}`);
      
      setSuccessMsg(`✅ User "${deleteConfirm.username}" deleted successfully`);
      setDeleteConfirm(null);
      
      // Reload users list
      loadAllUsers();
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. ' + (err.response?.data?.detail || err.message));
      setDeleteConfirm(null);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Filter and sort users
  const getFilteredAndSortedUsers = () => {
    let filtered = users.filter(user => {
      const searchLower = searchTerm.toLowerCase();
      return (
        user.username?.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.contactEmail?.toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      let aVal = a[sortField] || '';
      let bVal = b[sortField] || '';
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();

      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    return filtered;
  };

  const filteredUsers = getFilteredAndSortedUsers();

  if (loading) {
    return (
      <div className="admin-page">
        <div className="text-center mt-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2>🔐 Admin Dashboard</h2>
            <p className="text-muted mb-0">Manage all user profiles</p>
          </div>
          <div className="d-flex align-items-center gap-2">
            <button
              className="btn btn-warning btn-sm"
              onClick={() => navigate('/admin/change-password')}
              title="Change Admin Password"
            >
              🔒 Change Password
            </button>
            <div className="admin-stats">
              <span className="badge bg-primary">Total Users: {users.length}</span>
              <span className="badge bg-success ms-2">Filtered: {filteredUsers.length}</span>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* Search Bar */}
        <div className="search-bar mb-4">
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search by username, name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="table-responsive">
        <table className="table table-hover admin-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
                Username {sortField === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('firstName')} style={{ cursor: 'pointer' }}>
                Name {sortField === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('contactEmail')} style={{ cursor: 'pointer' }}>
                Email {sortField === 'contactEmail' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>Contact</th>
              <th>Sex</th>
              <th>Location</th>
              <th>Working</th>
              <th>Images</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="9" className="text-center text-muted py-4">
                  No users found
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.username}>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>{user.contactEmail}</td>
                  <td>{user.contactNumber}</td>
                  <td>{user.sex}</td>
                  <td>{user.location}</td>
                  <td>
                    <span className={`badge ${user.workingStatus === 'Yes' ? 'bg-success' : 'bg-secondary'}`}>
                      {user.workingStatus}
                    </span>
                  </td>
                  <td>
                    <span className="badge bg-info">{user.images?.length || 0}</span>
                  </td>
                  <td className="text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/profile/${user.username}`)}
                        title="View Profile"
                      >
                        👁️ View
                      </button>
                      <button
                        className="btn btn-sm btn-outline-warning"
                        onClick={() => handleEdit(user.username)}
                        title="Edit Profile"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteClick(user)}
                        title="Delete Profile"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h4>⚠️ Confirm Deletion</h4>
            <p>
              Are you sure you want to delete the profile for <strong>{deleteConfirm.username}</strong>?
            </p>
            <p className="text-muted small">
              Name: {deleteConfirm.firstName} {deleteConfirm.lastName}<br />
              Email: {deleteConfirm.contactEmail}
            </p>
            <p className="text-danger">
              <strong>This action cannot be undone!</strong>
            </p>
            <div className="d-flex justify-content-end gap-2 mt-4">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteConfirm}
              >
                Yes, Delete Profile
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
