import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createApiInstance } from '../api';
import { getBackendUrl } from '../config/apiConfig';
import './AdminPage.css';
import './LoadMore.css'; // Import LoadMore styles
import MetaFieldsModal from './MetaFieldsModal';
import { startImpersonation } from '../utils/impersonation';
import UniversalTabContainer from './UniversalTabContainer';
import AdminRegistrationInterests from './AdminRegistrationInterests';

// Use global API factory for session handling
const adminApi = createApiInstance();

const AdminPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');
  const [pendingInterestCount, setPendingInterestCount] = useState(0);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailSearch, setEmailSearch] = useState(''); // Dedicated email search
  const [phoneSearch, setPhoneSearch] = useState(''); // Dedicated phone search
  const [genderFilter, setGenderFilter] = useState(''); // Gender filter
  const [statusFilter, setStatusFilter] = useState('pending_admin_approval'); // Default to Pending Admin Approval
  const [sortField, setSortField] = useState('username');
  const [sortOrder, setSortOrder] = useState('asc');
  const [displayCount, setDisplayCount] = useState(20);
  const recordsPerPage = 20;
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [selectedUserForStatus, setSelectedUserForStatus] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusChangeReason, setStatusChangeReason] = useState('');
  const [selectedUserForMeta, setSelectedUserForMeta] = useState(null);
  const [showDeletionSummary, setShowDeletionSummary] = useState(false);
  const [deletionSummary, setDeletionSummary] = useState(null);

  // Fetch pending interest count for badge
  const backendApi = createApiInstance(getBackendUrl());
  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const res = await backendApi.get('/api/registration-interest/admin/pending-count');
        setPendingInterestCount(res.data.count || 0);
      } catch (err) {
        // Silently fail — badge just won't show
      }
    };
    fetchPendingCount();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // Sync tab to URL
  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'users') {
      searchParams.delete('tab');
    } else {
      searchParams.set('tab', tabId);
    }
    setSearchParams(searchParams, { replace: true });
  };

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

      // Security Layer 2: Check if user is admin or moderator
      const userRole = localStorage.getItem('userRole');
      if (userRole !== 'admin' && userRole !== 'moderator') {
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

    // Just check access - the useEffect with filters will handle loading
    checkAdminAccess();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Server-side filtered user loading
  const loadUsers = useCallback(async (filters = {}) => {
    try {
      setLoading(true);
      setError('');

      // Build query params for server-side filtering
      const params = new URLSearchParams({ limit: '1000' });
      
      // Apply status filter (server-side)
      if (filters.status) {
        params.append('status', filters.status);
      }
      
      // Apply gender filter (server-side)
      if (filters.gender) {
        params.append('gender', filters.gender);
      }
      
      // Apply search filter (server-side)
      if (filters.search) {
        params.append('search', filters.search);
      }
      
      // Apply email search filter (server-side)
      if (filters.emailSearch) {
        params.append('email_search', filters.emailSearch);
      }
      
      // Apply phone search filter (server-side)
      if (filters.phoneSearch) {
        params.append('phone_search', filters.phoneSearch);
      }

      // Fetch users with server-side filtering
      const response = await adminApi.get(`/api/admin/users?${params.toString()}`);
      setUsers(response.data.users || []);
      
      console.log(`✅ Loaded ${response.data.users?.length || 0} users with filters:`, filters);
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

  // Reload users when dropdown filters change (server-side filtering)
  // NOTE: searchTerm and emailSearch are NOT in dependencies - only trigger on Search button click
  useEffect(() => {
    // Skip if not authenticated yet
    const token = localStorage.getItem('token');
    const userRole = localStorage.getItem('userRole');
    if (!token || (userRole !== 'admin' && userRole !== 'moderator')) {
      return;
    }
    
    loadUsers({
      status: statusFilter,
      gender: genderFilter,
      search: searchTerm,
      emailSearch: emailSearch,
      phoneSearch: phoneSearch
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, genderFilter, loadUsers]);

  // Handle manual search button click - triggers search for username/email fields
  const handleSearch = () => {
    loadUsers({
      status: statusFilter,
      gender: genderFilter,
      search: searchTerm.trim(),
      emailSearch: emailSearch.trim(),
      phoneSearch: phoneSearch.trim()
    });
  };

  const handleEditStatus = (user) => {
    setSelectedUserForStatus(user);
    // Use accountStatus (unified field)
    const currentStatus = user.accountStatus || 'pending_admin_approval';
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
      
      // Reload users list with current filters
      loadUsers({
        status: statusFilter,
        gender: genderFilter,
        search: searchTerm,
        emailSearch: emailSearch
      });
      
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
      
      // Reload users list with current filters
      loadUsers({
        status: statusFilter,
        gender: genderFilter,
        search: searchTerm,
        emailSearch: emailSearch
      });
    } catch (err) {
      console.error('Error deleting user:', err);
      setError('Failed to delete user. ' + (err.response?.data?.detail || err.message));
      setDeleteConfirm(null);
    }
  };


  const handleImpersonate = async (user) => {
    try {
      setError('');
      const response = await adminApi.post(`/api/admin/impersonate/${user.username}`);
      if (response.data.success) {
        startImpersonation(response.data.token, response.data.username, response.data.role);
        // Full page reload to reset all app state as the impersonated user
        window.location.href = '/dashboard';
      }
    } catch (err) {
      console.error('Impersonation failed:', err);
      setError(err.response?.data?.detail || 'Failed to impersonate user');
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
    
    // Calculate age from birth month and year
    let age = 'N/A';
    if (user.birthMonth && user.birthYear) {
      const currentMonth = now.getMonth() + 1; // JS months are 0-indexed
      const currentYear = now.getFullYear();
      age = currentYear - user.birthYear;
      // If birthday hasn't happened this year yet, subtract 1
      if (currentMonth < user.birthMonth) {
        age--;
      }
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

  // Sort users (filtering is now done server-side)
  const getSortedUsers = () => {
    // Add computed fields and sort
    let sorted = users.map(calculateComputedFields);

    sorted.sort((a, b) => {
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

    return sorted;
  };

  const filteredUsers = getSortedUsers();

  // Load more pattern calculations
  const currentRecords = filteredUsers.slice(0, displayCount);
  const hasMore = displayCount < filteredUsers.length;
  const allLoaded = displayCount >= filteredUsers.length;

  // Reset display count when search/filter changes
  useEffect(() => {
    setDisplayCount(recordsPerPage);
  }, [searchTerm, genderFilter, statusFilter, sortField, sortOrder]);

  // ESC key handler to close modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showStatusModal) {
          setShowStatusModal(false);
          setSelectedUserForStatus(null);
        }
        if (deleteConfirm) {
          setDeleteConfirm(null);
        }
        if (showDeletionSummary) {
          setShowDeletionSummary(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showStatusModal, deleteConfirm, showDeletionSummary]);

  const handleLoadMore = () => {
    setDisplayCount(prev => Math.min(prev + recordsPerPage, filteredUsers.length));
  };


  // Tab configuration
  const tabs = [
    {
      id: 'users',
      label: 'User Management',
      icon: '👥',
      badge: users.length || null,
      content: renderUserManagement()
    },
    {
      id: 'interests',
      label: 'Registration Interests',
      icon: '📋',
      badge: pendingInterestCount || null,
      content: <AdminRegistrationInterests />
    }
  ];

  return (
    <div className="admin-page">
      <UniversalTabContainer
        tabs={tabs}
        variant="pills"
        defaultTab={activeTab}
        onTabChange={handleTabChange}
      />
    </div>
  );

  function renderUserManagement() {
    if (loading) {
      return (
        <div className="text-center mt-5">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading users...</p>
        </div>
      );
    }

    return (
      <div>
      <div className="admin-header">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div className="admin-stats">
            <span className="badge bg-primary">USERS: {users.length}</span>
            <span className="badge bg-success">FILTERED: {filteredUsers.length}</span>
            <span className="badge bg-info">SHOWING: {currentRecords.length}</span>
          </div>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}
        {successMsg && <div className="alert alert-success">{successMsg}</div>}

        {/* Search and Filter Bar - Single Row */}
        <div className="admin-filter-row">
          <input
            type="text"
            className="form-control admin-filter-input"
            placeholder="🔍 Username, first name, or last name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          <input
            type="text"
            className="form-control admin-filter-input"
            placeholder="📧 Email (partial)..."
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          <input
            type="text"
            className="form-control admin-filter-input admin-phone-input"
            placeholder="📞 Phone..."
            value={phoneSearch}
            onChange={(e) => setPhoneSearch(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          />
          
          <select
            className="form-select admin-filter-select"
            value={genderFilter}
            onChange={(e) => setGenderFilter(e.target.value)}
          >
            <option value="">All Gender</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
          
          <select
            className="form-select admin-filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="pending_email_verification">Pending Email</option>
            <option value="pending_admin_approval">Pending Approval</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
            <option value="deactivated">Deactivated</option>
            <option value="banned">Banned</option>
          </select>
          
          <button
            className="admin-search-btn"
            onClick={handleSearch}
            title="Search"
          >
            🔍 Search
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
              <th onClick={() => handleSort('computedAge')} style={{ cursor: 'pointer' }}>
                AGE {sortField === 'computedAge' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('computedDaysActive')} style={{ cursor: 'pointer' }}>
                DAYS {sortField === 'computedDaysActive' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('contactEmail')} style={{ cursor: 'pointer' }}>
                EMAIL {sortField === 'contactEmail' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('contactNumber')} style={{ cursor: 'pointer' }}>
                CONTACT {sortField === 'contactNumber' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('sex')} style={{ cursor: 'pointer' }}>
                GNDR {sortField === 'sex' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('location')} style={{ cursor: 'pointer' }}>
                LOC{sortField === 'location' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('imagesCount')} style={{ cursor: 'pointer' }}>
                IMAGES {sortField === 'imagesCount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('invitedBy')} style={{ cursor: 'pointer' }}>
                INV BY {sortField === 'invitedBy' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('promoCode')} style={{ cursor: 'pointer' }}>
                PROMO CD {sortField === 'promoCode' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('adminApprovedAt')} style={{ cursor: 'pointer' }}>
                APPRV DT {sortField === 'adminApprovedAt' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('accountStatus')} style={{ cursor: 'pointer' }}>
                STATUS {sortField === 'accountStatus' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="14" className="text-center text-muted py-4">
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
                        onClick={() => window.open(`/profile/${user.username}`, '_blank')}
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
                      <button
                        className="btn btn-sm btn-outline-secondary"
                        onClick={() => handleImpersonate(user)}
                        title={`Impersonate ${user.username}`}
                      >
                        🎭
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
                    {user.invitedBy && user.invitedBy !== 'system' ? (
                      <span
                        className="invited-by-link"
                        style={{ 
                          color: '#667eea', 
                          cursor: 'pointer',
                          textDecoration: 'underline',
                          fontWeight: '500'
                        }}
                        onClick={() => navigate(`/profile/${user.invitedBy}`)}
                        title={`View ${user.invitedBy}'s profile`}
                      >
                        {user.invitedBy}
                      </span>
                    ) : (
                      <span style={{ color: '#999', fontStyle: 'italic' }}>system</span>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-info" style={{ fontSize: '11px' }}>
                      🎫 {user.promoCode || 'USVEDIKA'}
                    </span>
                  </td>
                  <td>
                    {user.adminApprovedAt ? (
                      <span style={{ fontSize: '12px' }}>
                        {new Date(user.adminApprovedAt).toLocaleDateString()}
                      </span>
                    ) : (
                      <span style={{ color: '#999', fontStyle: 'italic', fontSize: '12px' }}>—</span>
                    )}
                  </td>
                  <td>
                    {(() => {
                      const status = user.accountStatus || 'active';
                      const statusConfig = {
                        'pending_email_verification': { label: 'Pending Email', bg: 'bg-warning', icon: '📧' },
                        'pending_admin_approval': { label: 'Pending Approval', bg: 'bg-info', icon: '⏳' },
                        'active': { label: 'Active', bg: 'bg-success', icon: '✓' },
                        'inactive': { label: 'Inactive', bg: 'bg-secondary', icon: '💤' },
                        'paused': { label: 'Paused', bg: 'bg-warning', icon: '⏸️' },
                        'suspended': { label: 'Suspended', bg: 'bg-danger', icon: '🔒' },
                        'banned': { label: 'Banned', bg: 'bg-dark', icon: '🚫' }
                      };
                      const config = statusConfig[status] || { label: status, bg: 'bg-secondary', icon: '?' };
                      return (
                        <span 
                          className={`badge ${config.bg}`} 
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleEditStatus(user)}
                          title="Click to change status"
                        >
                          {config.icon} {config.label}
                        </span>
                      );
                    })()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Load More Controls */}
      <div className="load-more-container">
        <div className="load-more-content">
          {hasMore && (
            <button 
              className="load-more-button"
              onClick={handleLoadMore}
            >
              Load {Math.min(recordsPerPage, filteredUsers.length - displayCount)} more [{displayCount}/{filteredUsers.length}]
            </button>
          )}
          
          {allLoaded && filteredUsers.length > recordsPerPage && (
            <div className="load-more-complete">
              ✓ All {filteredUsers.length} records loaded
            </div>
          )}
        </div>
      </div>

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
                Select a new status for this user. Current status: <strong>{selectedUserForStatus.accountStatus || 'pending_admin_approval'}</strong>
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
                
                <label className={`status-radio-option ${selectedStatus === 'paused' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value="paused"
                    checked={selectedStatus === 'paused'}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  />
                  <div className="status-icon">⏸️</div>
                  <div className="status-info">
                    <strong>Paused</strong>
                    <span>User-initiated temporary pause</span>
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
                  <div className="status-icon">🔒</div>
                  <div className="status-info">
                    <strong>Suspended</strong>
                    <span>Admin-restricted access</span>
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
            </div>
            
            {/* Footer Buttons - Outside body for sticky positioning */}
            <div className="status-modal-footer">
              <button className="btn-cancel" onClick={() => setShowStatusModal(false)}>
                Cancel
              </button>
              <button 
                className="btn-confirm" 
                onClick={handleStatusChange}
                disabled={selectedStatus === (selectedUserForStatus.accountStatus || 'pending_admin_approval')}
              >
                🔐 Update<span className="hide-on-mobile"> Status</span>
              </button>
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
            loadUsers({
              status: statusFilter,
              gender: genderFilter,
              search: searchTerm,
              emailSearch: emailSearch
            }); // Refresh user list when modal closes
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
  } // end renderUserManagement
};

export default AdminPage;
