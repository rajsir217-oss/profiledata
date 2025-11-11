import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './AdminPage.css';
import MetaFieldsModal from './MetaFieldsModal';

// Create admin API client without baseURL prefix
import { getBackendUrl } from '../config/apiConfig';
const adminApi = axios.create({
  baseURL: getBackendUrl()
});

// Add auth token interceptor
adminApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

const AdminPage = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [genderFilter, setGenderFilter] = useState(''); // Gender filter
  const [statusFilter, setStatusFilter] = useState('pending_admin_approval'); // Default to Pending Admin Approval
  const [sortField, setSortField] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(20);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [selectedUserForMeta, setSelectedUserForMeta] = useState(null);
  const [showDeletionSummary, setShowDeletionSummary] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState(null);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const loadAllUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      // Fetch all users
      const response = await adminApi.get('/api/admin/users?limit=1000');
      setUsers(response.data.users || []);
      
      console.log(`✅ Loaded ${response.data.users?.length || 0} users`);
      // Debug: Check if first user has sex field
      if (response.data.users?.[0]) {
        console.log('🔍 First user data:', response.data.users[0]);
        console.log('🔍 Sex field:', response.data.users[0].sex);
      }
    } catch (err) {
      console.error('Error loading users:', err);
      setError('Failed to load users. ' + (err.response?.data?.detail || err.message));
      
      // If unauthorized, redirect
      if (err.response?.status === 401 || err.response?.status === 403) {
        navigate('/');
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  const handleEditStatus = (user) => {
    setSelectedUserForStatus(user);
    // Use accountStatus first (new system), then fall back to old status field
    const currentStatus = user.accountStatus || user.status?.status || user.status || 'pending_admin_approval';
    setSelectedStatus(currentStatus);
    setStatusChangeReason('');
    setShowStatusModal(true);
  };
  
  const handleStatusChange = async () => {
    if (!selectedUserForStatus || !selectedStatus) return;
    
    try {
      setError('');
      setSuccessMsg('');
      
      // Update user status via API
      await adminApi.patch(`/api/admin/users/${selectedUserForStatus.username}/status`, {
        status: selectedStatus
      });
      
      setSuccessMsg(`✅ Status updated to "${selectedStatus}" for ${selectedUserForStatus.username}`);
      setShowStatusModal(false);
      setSelectedUserForStatus(null);
      setSelectedStatus('');
      setStatusChangeReason('');
      
      // Reload users list
      loadAllUsers();
      
      // Auto-hide success message
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Error updating status:', err);
      setError('Failed to update status. ' + (err.response?.data?.detail || err.message));
    }
  };

  const handleDeleteClick = (user) => {
    setDeleteConfirm(user);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setError('');
      setSuccessMsg('');

      const response = await adminApi.delete(`/api/users/profile/${deleteConfirm.username}`);
      
      // Show deletion summary modal
      setDeletionSummary(response.data.summary);
      setShowDeletionSummary(true);
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

  // Calculate computed fields for a user
  const calculateComputedFields = (user) => {
    const now = new Date();
    
    // Calculate age from date of birth
    let age = 'N/A';
    if (user.dateOfBirth) {
      const birthDate = new Date(user.dateOfBirth);
      age = Math.floor((now - birthDate) / (1000 * 60 * 60 * 24 * 365.25));
    }
    
    // Calculate days since registration
    let daysActive = 'N/A';
    if (user.createdAt) {
      const createdDate = new Date(user.createdAt);
      daysActive = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    }
    
    return {
      ...user,
      computedAge: age,
      computedDaysActive: daysActive
    };
  };

  // Filter and sort users
  const getFilteredAndSortedUsers = () => {
    let filtered = users.map(calculateComputedFields).filter(user => {
      const searchLower = searchTerm.toLowerCase();
      
      // Apply search filter
      const matchesSearch = (
        user.username?.toLowerCase().includes(searchLower) ||
        user.firstName?.toLowerCase().includes(searchLower) ||
        user.lastName?.toLowerCase().includes(searchLower) ||
        user.contactEmail?.toLowerCase().includes(searchLower)
      );
      
      // Apply status filter - check new accountStatus field first, then fall back to old status.status
      const userStatus = user.accountStatus || user.status?.status || user.status || 'active';
      const matchesStatus = !statusFilter || userStatus === statusFilter;
      
      // Apply gender filter (case-insensitive, check multiple field names)
      const userGender = user.sex || user.gender || user.Sex || '';
      const matchesGender = !genderFilter || userGender.toLowerCase() === genderFilter.toLowerCase();
      
      return matchesSearch && matchesStatus && matchesGender;
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

  // Pagination calculations
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = filteredUsers.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil(filteredUsers.length / recordsPerPage);

  // Reset to page 1 when search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, genderFilter, statusFilter, sortField, sortOrder]);

  const handlePageChange = (pageNumber) => {
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxPagesToShow = 5;
    
    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('...');
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

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
            <div className="admin-stats">
              <span className="badge bg-primary">Users: {users.length}</span>
              <span className="badge bg-success ms-2">Filtered: {filteredUsers.length}</span>
              <span className="badge bg-info ms-2">Page: {currentPage}/{totalPages}</span>
            </div>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* Search and Filter Bar */}
        <div className="search-filter-bar mb-4 d-flex gap-3">
          <input
            type="text"
            className="form-control"
            placeholder="🔍 Search by username, name, or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 2 }}
          />
          
          <select
            className="form-select"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
            style={{ flex: 1, maxWidth: '200px' }}
          >
            <option value="">All Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ flex: 1, maxWidth: '250px' }}
          >
            <option value="">All Status</option>
            <option value="pending_email_verification">Pending Email Verification</option>
            <option value="pending_admin_approval">Pending Admin Approval</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
            <option value="banned">Banned</option>
          </select>
          
          <button
            className="btn btn-primary"
            onClick={loadAllUsers}
            title="Refresh List"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      <div className="table-responsive">
        <table className="table-hover admin-table">
          <thead>
            <tr>
              <th className="text-center">ACTIONS</th>
              <th onClick={() => handleSort('username')} style={{ cursor: 'pointer' }}>
                USERNAME {sortField === 'username' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('firstName')} style={{ cursor: 'pointer' }}>
                NAME {sortField === 'firstName' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>AGE</th>
              <th>DAYS ACTIVE</th>
              <th onClick={() => handleSort('contactEmail')} style={{ cursor: 'pointer' }}>
                EMAIL {sortField === 'contactEmail' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th>CONTACT</th>
              <th>GENDER</th>
              <th>LOCATION</th>
              <th>IMAGES</th>
              <th>MSGS SENT</th>
              <th>MSGS RCVD</th>
              <th>PENDING</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="13" className="text-center text-muted py-4">
                  No users found
                </td>
              </tr>
            ) : (
              currentRecords.map((user) => (
                <tr key={user.username}>
                  <td className="text-center">
                    <div className="btn-group" role="group">
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => navigate(`/profile/${user.username}`)}
                        title="View Profile"
                      >
                        👁️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-info"
                        onClick={() => setSelectedUserForMeta(user.username)}
                        title="Meta Fields"
                      >
                        🎖️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-warning"
                        onClick={() => handleEditStatus(user)}
                        title="Edit Status"
                      >
                        ✏️
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => handleDeleteClick(user)}
                        title="Delete Profile"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                  <td>
                    <strong>{user.username}</strong>
                  </td>
                  <td>{user.firstName} {user.lastName}</td>
                  <td>
                    <span className="badge bg-primary">{user.computedAge}</span>
                  </td>
                  <td>
                    <span className="badge bg-info">{user.computedDaysActive}</span>
                  </td>
                  <td>{user.contactEmail}</td>
                  <td>{user.contactNumber}</td>
                  <td>{user.sex || user.gender || user.Sex || '-'}</td>
                  <td>{user.location}</td>
                  <td>
                    <span className="badge bg-info">{user.images?.length || 0}</span>
                  </td>
                  <td>
                    <span className="badge bg-success">{user.messagesSent || 0}</span>
                  </td>
                  <td>
                    <span className="badge bg-primary">{user.messagesReceived || 0}</span>
                  </td>
                  <td>
                    <span className="badge bg-warning">{user.pendingReplies || 0}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <div className="pagination-info">
            Showing {indexOfFirstRecord + 1} - {Math.min(indexOfLastRecord, filteredUsers.length)} of {filteredUsers.length} records
          </div>
          <div className="pagination-controls">
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
            >
              ← Previous
            </button>
            
            <div className="page-numbers">
              {getPageNumbers().map((page, index) => (
                page === '...' ? (
                  <span key={`ellipsis-${index}`} className="page-ellipsis">...</span>
                ) : (
                  <button
                    key={page}
                    className={`btn btn-sm ${currentPage === page ? 'btn-primary' : 'btn-outline-primary'}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                )
              ))}
            </div>
            
            <button
              className="btn btn-sm btn-outline-primary"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Status Edit Modal */}
      {showStatusModal && selectedUserForStatus && (
        <div className="modal-overlay" onClick={() => setShowStatusModal(false)}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header with User Info */}
            <div className="status-modal-header">
              <div className="user-info">
                <div className="user-avatar">
                  {selectedUserForStatus.username.charAt(0).toUpperCase()}
                </div>
                <div className="user-details">
                  <h4>{selectedUserForStatus.username}</h4>
                  <p>{selectedUserForStatus.contactEmail || 'No email'}</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowStatusModal(false)}>
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="status-modal-body">
              <h3>🔐 Change User Status</h3>
              <p className="current-status">
                Select a new status for this user. Current status: <strong>{selectedUserForStatus.accountStatus || selectedUserForStatus.status?.status || selectedUserForStatus.status || 'pending_admin_approval'}</strong>
              </p>
              
              {/* Status Options */}
              <div className="status-radio-group">
                <label className={`status-radio-option ${selectedStatus === 'pending_email_verification' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="pending_email_verification"
                    checked={selectedStatus === 'pending_email_verification'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">📧</div>
                  <div className="status-info">
                    <strong>Pending Email Verification</strong>
                    <span>Awaiting email verification</span>
                  </div>
                </label>
                
                <label className={`status-radio-option ${selectedStatus === 'pending_admin_approval' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="pending_admin_approval"
                    checked={selectedStatus === 'pending_admin_approval'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">⏳</div>
                  <div className="status-info">
                    <strong>Pending Admin Approval</strong>
                    <span>Email verified, awaiting admin approval</span>
                  </div>
                </label>
                
                <label className={`status-radio-option ${selectedStatus === 'active' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={selectedStatus === 'active'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">✅</div>
                  <div className="status-info">
                    <strong>Active</strong>
                    <span>Full access to all features</span>
                  </div>
                </label>
                
                <label className={`status-radio-option ${selectedStatus === 'inactive' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="inactive"
                    checked={selectedStatus === 'inactive'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">⚪</div>
                  <div className="status-info">
                    <strong>Inactive</strong>
                    <span>Account dormant or on hold</span>
                  </div>
                </label>
                
                <label className={`status-radio-option ${selectedStatus === 'suspended' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="suspended"
                    checked={selectedStatus === 'suspended'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">⏸️</div>
                  <div className="status-info">
                    <strong>Suspended</strong>
                    <span>Temporarily restricted access</span>
                  </div>
                </label>
                
                <label className={`status-radio-option ${selectedStatus === 'banned' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="banned"
                    checked={selectedStatus === 'banned'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">🚫</div>
                  <div className="status-info">
                    <strong>Banned</strong>
                    <span>Permanently blocked from access</span>
                  </div>
                </label>
              </div>
              
              {/* Reason (Optional) */}
              <div className="status-reason">
                <label>Reason (optional)</label>
                <textarea
                  placeholder="Enter reason for status change..."
                  value={statusChangeReason}
                  onChange={(e) => setStatusChangeReason(e.target.value)}
                  rows="3"
                />
              </div>
              
              {/* Footer Buttons */}
              <div className="status-modal-footer">
                <button className="btn-cancel" onClick={() => setShowStatusModal(false)}>
                  Cancel
                </button>
                <button 
                  className="btn-confirm" 
                  onClick={handleStatusChange}
                  disabled={selectedStatus === (selectedUserForStatus.status?.status || selectedUserForStatus.status || 'pending')}
                >
                  🔐 Update Status
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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


      {/* Meta Fields Modal */}
      {selectedUserForMeta && (
        <MetaFieldsModal
          username={selectedUserForMeta}
          onClose={() => {
            setSelectedUserForMeta(null);
            loadAllUsers(); // Refresh user list when modal closes
          }}
        />
      )}

      {/* Deletion Summary Modal */}
      {showDeletionSummary && deletionSummary && (
        <div className="modal-overlay" onClick={() => setShowDeletionSummary(false)}>
          <div className="status-modal" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="status-modal-header">
              <div className="user-info">
                <div className="user-avatar" style={{background: 'var(--danger-color)'}}>
                  🗑️
                </div>
                <div className="user-details">
                  <h4>Profile Deleted Successfully</h4>
                  <p>{deletionSummary.username}</p>
                </div>
              </div>
              <button className="close-btn" onClick={() => setShowDeletionSummary(false)}>
                ✕
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="status-modal-body">
              <h3>🗑️ Deletion Summary</h3>
              <p className="current-status">
                All data for user <strong>{deletionSummary.username}</strong> has been permanently removed from the system.
              </p>
              
              {/* Deletion Stats Grid */}
              <div className="deletion-stats-grid">
                {deletionSummary.deleted_items.images > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">🖼️</span>
                    <span className="stat-label">Images</span>
                    <span className="stat-value">{deletionSummary.deleted_items.images}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.favorites_as_user > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">⭐</span>
                    <span className="stat-label">Favorites Given</span>
                    <span className="stat-value">{deletionSummary.deleted_items.favorites_as_user}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.favorited_by_others > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">💫</span>
                    <span className="stat-label">Favorited By Others</span>
                    <span className="stat-value">{deletionSummary.deleted_items.favorited_by_others}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.shortlists_as_user > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📝</span>
                    <span className="stat-label">Shortlists Created</span>
                    <span className="stat-value">{deletionSummary.deleted_items.shortlists_as_user}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.shortlisted_by_others > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📋</span>
                    <span className="stat-label">Shortlisted By Others</span>
                    <span className="stat-value">{deletionSummary.deleted_items.shortlisted_by_others}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.exclusions_as_user > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">🚫</span>
                    <span className="stat-label">Exclusions Made</span>
                    <span className="stat-value">{deletionSummary.deleted_items.exclusions_as_user}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.excluded_by_others > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">⛔</span>
                    <span className="stat-label">Excluded By Others</span>
                    <span className="stat-value">{deletionSummary.deleted_items.excluded_by_others}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.messages_sent > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📤</span>
                    <span className="stat-label">Messages Sent</span>
                    <span className="stat-value">{deletionSummary.deleted_items.messages_sent}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.messages_received > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📥</span>
                    <span className="stat-label">Messages Received</span>
                    <span className="stat-value">{deletionSummary.deleted_items.messages_received}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.activity_logs > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📊</span>
                    <span className="stat-label">Activity Logs</span>
                    <span className="stat-value">{deletionSummary.deleted_items.activity_logs}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.notifications > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">🔔</span>
                    <span className="stat-label">Notifications</span>
                    <span className="stat-value">{deletionSummary.deleted_items.notifications}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.profile_views_as_viewer > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">👀</span>
                    <span className="stat-label">Profile Views</span>
                    <span className="stat-value">{deletionSummary.deleted_items.profile_views_as_viewer}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.profile_views_as_viewed > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">👁️</span>
                    <span className="stat-label">Times Viewed</span>
                    <span className="stat-value">{deletionSummary.deleted_items.profile_views_as_viewed}</span>
                  </div>
                )}
                {deletionSummary.deleted_items.event_logs > 0 && (
                  <div className="stat-item">
                    <span className="stat-icon">📅</span>
                    <span className="stat-label">Event Logs</span>
                    <span className="stat-value">{deletionSummary.deleted_items.event_logs}</span>
                  </div>
                )}
              </div>

              {/* Total Count */}
              <div className="deletion-total">
                <strong>Total Items Deleted:</strong>
                <span className="total-count">{deletionSummary.total_items_deleted}</span>
              </div>

              {/* Privacy Notice */}
              <div className="privacy-notice">
                <p>
                  ✅ <strong>Privacy Compliance:</strong> All data has been permanently removed in compliance with GDPR and CCPA regulations.
                </p>
              </div>
              
              {/* Close Button */}
              <button 
                className="btn btn-primary w-100 mt-3"
                onClick={() => setShowDeletionSummary(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
