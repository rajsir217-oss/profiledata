import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBackendUrl } from '../config/apiConfig';
import toastService from '../services/toastService';
import './InvitationManager.css';

const InvitationManager = () => {
  const navigate = useNavigate();
  const [invitations, setInvitations] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingInvitation, setEditingInvitation] = useState(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [filterBySender, setFilterBySender] = useState('all');
  const [sendersList, setSendersList] = useState([]);
  
  // Search filters state
  const [searchFilters, setSearchFilters] = useState({
    name: '',
    email: '',
    phone: '',
    comments: '',
    emailSubject: '',
    invitedBy: '',
    emailStatus: 'all',
    smsStatus: 'all',
    dateFrom: '',
    dateTo: ''
  });
  
  // Bulk selection state
  const [selectedInvitations, setSelectedInvitations] = useState([]);
  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [bulkEmailSubject, setBulkEmailSubject] = useState("You're Invited to Join USVedika for US Citizens & GC Holders");
  const [bulkSending, setBulkSending] = useState(false);
  
  // Pagination state
  const [displayedCount, setDisplayedCount] = useState(20);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState(null);
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  
  // Form state for new invitation
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    channel: 'email',
    customMessage: '',
    emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
    sendImmediately: true
  });
  
  // Form state for editing invitation
  const [editFormData, setEditFormData] = useState({
    name: '',
    email: '',
    phone: '',
    comments: '',
    emailSubject: ''
  });

  // Check admin access
  useEffect(() => {
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      navigate('/dashboard');
    }
  }, [navigate]);

  // Load invitations
  useEffect(() => {
    loadInvitations();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  // Extract unique senders when invitations load
  useEffect(() => {
    if (invitations.length > 0) {
      const uniqueSenders = [...new Set(invitations.map(inv => inv.invitedBy))];
      setSendersList(uniqueSenders.sort());
    }
  }, [invitations]);

  // Reset displayed count and selection when filter changes
  useEffect(() => {
    setDisplayedCount(20);
    setSelectedInvitations([]);
  }, [filterBySender, includeArchived, searchFilters]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showAddModal && !bulkSending) {
          setShowAddModal(false);
        } else if (showBulkSendModal && !bulkSending) {
          setShowBulkSendModal(false);
        }
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleEscKey);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showAddModal, showBulkSendModal, bulkSending]);

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to ascending
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const loadInvitations = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations?include_archived=${includeArchived}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setInvitations(data.invitations);
      } else {
        setError('Failed to load invitations');
      }
    } catch (err) {
      setError('Error loading invitations: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/invitations/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      } else {
        console.error('Failed to load stats:', response.status, response.statusText);
        // Set default stats to prevent UI breaking
        setStats({
          totalInvitations: 0,
          pendingInvitations: 0,
          sentInvitations: 0,
          acceptedInvitations: 0,
          expiredInvitations: 0,
          archivedInvitations: 0,
          emailSuccessRate: 0,
          smsSuccessRate: 0,
          acceptanceRate: 0
        });
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      // Set default stats to prevent UI breaking
      setStats({
        totalInvitations: 0,
        pendingInvitations: 0,
        sentInvitations: 0,
        acceptedInvitations: 0,
        expiredInvitations: 0,
        archivedInvitations: 0,
        emailSuccessRate: 0,
        smsSuccessRate: 0,
        acceptanceRate: 0
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBackendUrl()}/api/invitations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setShowAddModal(false);
        setFormData({
          name: '',
          email: '',
          phone: '',
          channel: 'email',
          customMessage: '',
          emailSubject: "You're Invited to Join USVedika for US Citizens & GC Holders",
          sendImmediately: true
        });
        loadInvitations();
        loadStats();
      } else {
        const data = await response.json();
        // Handle both string errors and validation error objects
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || JSON.stringify(data.detail) || 'Failed to create invitation';
        setError(errorMsg);
      }
    } catch (err) {
      setError('Error creating invitation: ' + err.message);
    }
  };

  const handleResend = async (invitationId, channel) => {
    console.log('🔵 handleResend called:', { invitationId, channel });
    
    try {
      const token = localStorage.getItem('token');
      const url = `${getBackendUrl()}/api/invitations/${invitationId}/resend`;
      console.log('🔵 Sending request to:', url);
      
      const response = await fetch(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ channel })
        }
      );

      console.log('🔵 Response status:', response.status);
      
      if (response.ok) {
        loadInvitations();
        toastService.success('Invitation resent successfully!');
      } else {
        const data = await response.json();
        console.log('🔴 Error response:', data);
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to resend invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      console.error('🔴 Error in handleResend:', err);
      toastService.error('Error resending invitation: ' + err.message);
    }
  };

  const handleArchive = async (invitationId) => {
    // No confirmation needed - archive is reversible

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${invitationId}/archive`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        loadInvitations();
        loadStats();
        toastService.success('Invitation archived successfully');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to archive invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error archiving invitation: ' + err.message);
    }
  };

  const handleDelete = async (invitationId) => {
    // Delete archived invitations only (2-click pattern: Archive → Delete)

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${invitationId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        loadInvitations();
        loadStats();
        toastService.success('Invitation deleted permanently');
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to delete invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error deleting invitation: ' + err.message);
    }
  };

  const handleEdit = (invitation) => {
    setEditingInvitation(invitation);
    setEditFormData({
      name: invitation.name,
      email: invitation.email,
      phone: invitation.phone || '',
      comments: invitation.comments || '',
      emailSubject: invitation.emailSubject || ''
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/${editingInvitation.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(editFormData)
        }
      );

      if (response.ok) {
        toastService.success('Invitation updated successfully');
        setShowEditModal(false);
        setEditingInvitation(null);
        setEditFormData({
          name: '',
          email: '',
          phone: '',
          comments: '',
          emailSubject: ''
        });
        loadInvitations();
        loadStats();
      } else {
        const data = await response.json();
        const errorMsg = typeof data.detail === 'string' 
          ? data.detail 
          : data.detail?.[0]?.msg || 'Failed to update invitation';
        toastService.error(errorMsg);
      }
    } catch (err) {
      toastService.error('Error updating invitation: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const statusClasses = {
      'pending': 'status-pending',
      'sent': 'status-sent',
      'delivered': 'status-delivered',
      'failed': 'status-failed',
      'accepted': 'status-accepted',
      'expired': 'status-expired'
    };

    return (
      <span className={`btn-action ${statusClasses[status] || ''}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const handleLoadMore = () => {
    setLoadingMore(true);
    setTimeout(() => {
      setDisplayedCount(prev => prev + 20);
      setLoadingMore(false);
    }, 300);
  };

  // Bulk selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all pending invitations only
      const pendingInvitations = displayedInvitations
        .filter(inv => inv.emailStatus === 'pending' && !inv.archived)
        .map(inv => inv.id);
      setSelectedInvitations(pendingInvitations);
    } else {
      setSelectedInvitations([]);
    }
  };

  const handleToggleSelection = (invitationId) => {
    setSelectedInvitations(prev => {
      if (prev.includes(invitationId)) {
        return prev.filter(id => id !== invitationId);
      } else {
        return [...prev, invitationId];
      }
    });
  };

  const handleBulkSend = async () => {
    if (selectedInvitations.length === 0) {
      toastService.error('No invitations selected');
      return;
    }

    setBulkSending(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBackendUrl()}/api/invitations/bulk-send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            invitationIds: selectedInvitations,
            channel: 'email',
            emailSubject: bulkEmailSubject
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        toastService.success(data.message);
        setShowBulkSendModal(false);
        setSelectedInvitations([]);
        loadInvitations();
        loadStats();
      } else {
        const data = await response.json();
        toastService.error(data.detail || 'Failed to send invitations');
      }
    } catch (err) {
      toastService.error('Error sending bulk invitations: ' + err.message);
    } finally {
      setBulkSending(false);
    }
  };

  // Filter and slice invitations for pagination
  const filteredInvitations = invitations.filter(inv => {
    // Filter by sender (case insensitive)
    if (filterBySender !== 'all' && inv.invitedBy.toLowerCase() !== filterBySender.toLowerCase()) return false;
    
    // Search filters (all case insensitive)
    if (searchFilters.name && !inv.name.toLowerCase().includes(searchFilters.name.toLowerCase())) return false;
    if (searchFilters.email && !inv.email.toLowerCase().includes(searchFilters.email.toLowerCase())) return false;
    if (searchFilters.phone && inv.phone && !inv.phone.toLowerCase().includes(searchFilters.phone.toLowerCase())) return false;
    if (searchFilters.comments && inv.comments && !inv.comments.toLowerCase().includes(searchFilters.comments.toLowerCase())) return false;
    if (searchFilters.emailSubject && inv.emailSubject && !inv.emailSubject.toLowerCase().includes(searchFilters.emailSubject.toLowerCase())) return false;
    if (searchFilters.invitedBy && !inv.invitedBy.toLowerCase().includes(searchFilters.invitedBy.toLowerCase())) return false;
    if (searchFilters.emailStatus !== 'all' && inv.emailStatus && inv.emailStatus.toLowerCase() !== searchFilters.emailStatus.toLowerCase()) return false;
    if (searchFilters.smsStatus !== 'all' && inv.smsStatus && inv.smsStatus.toLowerCase() !== searchFilters.smsStatus.toLowerCase()) return false;
    
    // Date range filter
    if (searchFilters.dateFrom || searchFilters.dateTo) {
      const invDate = new Date(inv.createdAt);
      if (searchFilters.dateFrom && invDate < new Date(searchFilters.dateFrom)) return false;
      if (searchFilters.dateTo) {
        const endDate = new Date(searchFilters.dateTo);
        endDate.setHours(23, 59, 59, 999); // End of day
        if (invDate > endDate) return false;
      }
    }
    
    return true;
  });
  
  // Sort invitations if sortColumn is set
  const sortedInvitations = sortColumn 
    ? [...filteredInvitations].sort((a, b) => {
        let aValue = a[sortColumn];
        let bValue = b[sortColumn];
        
        // Handle null/undefined values
        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';
        
        // Convert to lowercase for string comparison
        if (typeof aValue === 'string') aValue = aValue.toLowerCase();
        if (typeof bValue === 'string') bValue = bValue.toLowerCase();
        
        // Compare values
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      })
    : filteredInvitations;
  
  const displayedInvitations = sortedInvitations.slice(0, displayedCount);
  
  // Clear all search filters
  const handleClearFilters = () => {
    setSearchFilters({
      name: '',
      email: '',
      phone: '',
      comments: '',
      emailSubject: '',
      invitedBy: '',
      emailStatus: 'all',
      smsStatus: 'all',
      dateFrom: '',
      dateTo: ''
    });
    setFilterBySender('all');
  };
  
  // Check if any filters are active
  const hasActiveFilters = 
    searchFilters.name !== '' ||
    searchFilters.email !== '' ||
    searchFilters.phone !== '' ||
    searchFilters.comments !== '' ||
    searchFilters.emailSubject !== '' ||
    searchFilters.invitedBy !== '' ||
    searchFilters.emailStatus !== 'all' ||
    searchFilters.smsStatus !== 'all' ||
    searchFilters.dateFrom !== '' ||
    searchFilters.dateTo !== '' ||
    filterBySender !== 'all';

  if (loading) {
    return <div className="invitation-manager"><p>Loading invitations...</p></div>;
  }

  return (
    <div className="invitation-manager">
      <div className="invitation-header">
        <h1>📧 Invitation Manager</h1>
        <p className="subtitle">Manage user invitations and track registration conversions</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalInvitations}</div>
            <div className="stat-label">Total Invitations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.pendingInvitations}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptedInvitations}</div>
            <div className="stat-label">Accepted</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.acceptanceRate}%</div>
            <div className="stat-label">Acceptance Rate</div>
          </div>
        </div>
      )}

      {/* Action Bar */}
      <div className="action-bar">
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            ➕ New Invitation
          </button>
          {selectedInvitations.length > 0 && (
            <button 
              className="btn-primary" 
              onClick={() => setShowBulkSendModal(true)}
              style={{ background: 'var(--success-color)' }}
            >
              📧 Send Selected ({selectedInvitations.length})
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Show Archived
          </label>
          
          {sendersList.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '14px', color: 'var(--text-color)', fontWeight: '600' }}>
                Filter by sender:
              </label>
              <select
                value={filterBySender}
                onChange={(e) => setFilterBySender(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  border: '2px solid var(--border-color)',
                  background: 'var(--card-bg)',
                  color: 'var(--text-color)',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">All ({invitations.length})</option>
                {sendersList.map(sender => {
                  const count = invitations.filter(inv => inv.invitedBy === sender).length;
                  return (
                    <option key={sender} value={sender}>
                      {sender === 'admin' ? '👤 Admin' : `👥 ${sender}`} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Invitations Table */}
      <div className="table-container">
        {/* Search Filters Row */}
        <div className="search-filters-container">
          <div className="search-filters-header">
            <h3>🔍 Search Filters</h3>
            {hasActiveFilters && (
              <button className="btn-clear-filters" onClick={handleClearFilters}>
                ✕ Clear All Filters
              </button>
            )}
          </div>
          <div className="search-filters-grid">
            <div className="filter-item">
              <label>Name</label>
              <input
                type="text"
                placeholder="Search name..."
                value={searchFilters.name}
                onChange={(e) => setSearchFilters({...searchFilters, name: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Email</label>
              <input
                type="text"
                placeholder="Search email..."
                value={searchFilters.email}
                onChange={(e) => setSearchFilters({...searchFilters, email: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Phone</label>
              <input
                type="text"
                placeholder="Search phone..."
                value={searchFilters.phone}
                onChange={(e) => setSearchFilters({...searchFilters, phone: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Comments</label>
              <input
                type="text"
                placeholder="Search comments..."
                value={searchFilters.comments}
                onChange={(e) => setSearchFilters({...searchFilters, comments: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Email Subject</label>
              <input
                type="text"
                placeholder="Search subject..."
                value={searchFilters.emailSubject}
                onChange={(e) => setSearchFilters({...searchFilters, emailSubject: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Invited By</label>
              <input
                type="text"
                placeholder="Search inviter..."
                value={searchFilters.invitedBy}
                onChange={(e) => setSearchFilters({...searchFilters, invitedBy: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Email Status</label>
              <select
                value={searchFilters.emailStatus}
                onChange={(e) => setSearchFilters({...searchFilters, emailStatus: e.target.value})}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="filter-item">
              <label>SMS Status</label>
              <select
                value={searchFilters.smsStatus}
                onChange={(e) => setSearchFilters({...searchFilters, smsStatus: e.target.value})}
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="sent">Sent</option>
                <option value="delivered">Delivered</option>
                <option value="failed">Failed</option>
                <option value="accepted">Accepted</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div className="filter-item">
              <label>Date From</label>
              <input
                type="date"
                value={searchFilters.dateFrom}
                onChange={(e) => setSearchFilters({...searchFilters, dateFrom: e.target.value})}
              />
            </div>
            <div className="filter-item">
              <label>Date To</label>
              <input
                type="date"
                value={searchFilters.dateTo}
                onChange={(e) => setSearchFilters({...searchFilters, dateTo: e.target.value})}
              />
            </div>
          </div>
          <div className="search-results-summary">
            Showing {displayedInvitations.length} of {sortedInvitations.length} invitation{sortedInvitations.length !== 1 ? 's' : ''}
            {hasActiveFilters && ` (filtered from ${invitations.length} total)`}
          </div>
        </div>

        <table className="invitation-table">
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  onChange={handleSelectAll}
                  checked={selectedInvitations.length > 0 && selectedInvitations.length === displayedInvitations.filter(inv => inv.emailStatus === 'pending' && !inv.archived).length}
                  title="Select all pending invitations"
                />
              </th>
              <th className="sortable" onClick={() => handleSort('name')}>
                Name {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('email')}>
                Email {sortColumn === 'email' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('comments')}>
                Comments {sortColumn === 'comments' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('emailSubject')}>
                Email Subject {sortColumn === 'emailSubject' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('invitedBy')}>
                Invited By {sortColumn === 'invitedBy' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('emailStatus')}>
                Email Status {sortColumn === 'emailStatus' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>Action</th>
              <th className="sortable" onClick={() => handleSort('phone')}>
                SMS {sortColumn === 'phone' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th className="sortable" onClick={() => handleSort('smsStatus')}>
                SMS Status {sortColumn === 'smsStatus' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>Action</th>
              <th className="sortable" onClick={() => handleSort('createdAt')}>
                Time Lapse {sortColumn === 'createdAt' && (sortDirection === 'asc' ? '▲' : '▼')}
              </th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvitations.length === 0 ? (
              <tr>
                <td colSpan="13" style={{ textAlign: 'center', padding: '40px' }}>
                  No invitations found. Create your first invitation!
                </td>
              </tr>
            ) : (
              displayedInvitations.map((invitation) => (
                <tr key={invitation.id} className={invitation.archived ? 'archived-row' : ''}>
                  <td style={{ textAlign: 'center' }}>
                    {invitation.emailStatus === 'pending' && !invitation.archived && (
                      <input
                        type="checkbox"
                        checked={selectedInvitations.includes(invitation.id)}
                        onChange={() => handleToggleSelection(invitation.id)}
                      />
                    )}
                  </td>
                  <td>{invitation.name}</td>
                  <td>
                    <a href={`mailto:${invitation.email}`}>{invitation.email}</a>
                  </td>
                  <td>
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {invitation.comments || '-'}
                    </span>
                  </td>
                  <td style={{ maxWidth: '200px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {invitation.emailSubject || 'Default subject'}
                  </td>
                  <td>
                    <span className="invited-by-badge" title={`Invited by ${invitation.invitedBy}`}>
                      {invitation.invitedBy === 'admin' ? '👤 Admin' : `👥 ${invitation.invitedBy}`}
                    </span>
                  </td>
                  <td>{getStatusBadge(invitation.emailStatus)}</td>
                  <td>
                    {invitation.emailStatus !== 'accepted' && (
                      <button
                        className="btn-action btn-email"
                        onClick={() => handleResend(invitation.id, 'email')}
                        disabled={invitation.archived}
                      >
                        {invitation.emailStatus === 'pending' ? 'Send' : 'Resend'}
                      </button>
                    )}
                  </td>
                  <td>{invitation.phone || '-'}</td>
                  <td>
                    {invitation.phone ? getStatusBadge(invitation.smsStatus) : '-'}
                  </td>
                  <td>
                    {invitation.phone && invitation.smsStatus !== 'accepted' && (
                      <button
                        className="btn-action btn-sms"
                        onClick={() => handleResend(invitation.id, 'sms')}
                        disabled={invitation.archived}
                      >
                        {invitation.smsStatus === 'pending' ? 'Send' : 'Resend'}
                      </button>
                    )}
                  </td>
                  <td>{invitation.timeLapse}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="btn-icon"
                        onClick={() => handleEdit(invitation)}
                        title="Edit"
                      >
                        ✏️
                      </button>
                      {!invitation.archived ? (
                        <button
                          className="btn-icon"
                          onClick={() => handleArchive(invitation.id)}
                          title="Archive"
                        >
                          🗄️
                        </button>
                      ) : (
                        <button
                          className="btn-icon"
                          onClick={() => handleDelete(invitation.id)}
                          title="Delete Permanently"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View More Pagination - without outer container */}
      {sortedInvitations.length > 0 && (
        displayedCount < sortedInvitations.length ? (
          <div className="pagination-controls">
            <button
              className="view-more-btn"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              View more ({Math.min(20, sortedInvitations.length - displayedCount)} more) of {displayedCount}/{sortedInvitations.length}
            </button>
          </div>
        ) : (
          <div className="pagination-controls">
            <div className="all-loaded-message">
              ✓ All {sortedInvitations.length} invitations loaded
            </div>
          </div>
        )
      )}

      {/* Add Invitation Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create New Invitation</h2>
              <button className="btn-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone (Optional)</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div className="form-group">
                <label>Channel</label>
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                >
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                  <option value="both">Both Email & SMS</option>
                </select>
              </div>

              <div className="form-group">
                <label>Email Subject *</label>
                <input
                  type="text"
                  value={formData.emailSubject}
                  onChange={(e) => setFormData({ ...formData, emailSubject: e.target.value })}
                  required
                  placeholder="Email subject line"
                />
              </div>

              <div className="form-group">
                <label>Custom Message (Optional)</label>
                <textarea
                  value={formData.customMessage}
                  onChange={(e) => setFormData({ ...formData, customMessage: e.target.value })}
                  rows="3"
                  placeholder="Add a personal message to the invitation..."
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.sendImmediately}
                    onChange={(e) => setFormData({ ...formData, sendImmediately: e.target.checked })}
                  />
                  Send invitation immediately
                </label>
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Create Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Send Modal */}
      {showBulkSendModal && (
        <div className="modal-overlay" onClick={() => !bulkSending && setShowBulkSendModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h2>📧 Send Bulk Invitations</h2>
              <button className="btn-close" onClick={() => setShowBulkSendModal(false)} disabled={bulkSending}>✕</button>
            </div>
            
            <div style={{ padding: '20px' }}>
              <div style={{ 
                background: 'var(--info-bg)', 
                padding: '15px', 
                borderRadius: 'var(--radius-md)', 
                marginBottom: '20px',
                border: '1px solid var(--info-color)'
              }}>
                <p style={{ margin: 0, color: 'var(--text-color)', fontSize: '14px' }}>
                  📊 <strong>{selectedInvitations.length} invitations</strong> selected and ready to send
                </p>
              </div>

              <div className="form-group">
                <label style={{ fontWeight: '600', marginBottom: '8px', display: 'block' }}>
                  Email Subject Line:
                </label>
                <input
                  type="text"
                  value={bulkEmailSubject}
                  onChange={(e) => setBulkEmailSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: 'var(--radius-md)',
                    border: '2px solid var(--border-color)',
                    fontSize: '14px'
                  }}
                  disabled={bulkSending}
                />
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px' }}>
                  This subject line will be used for all selected invitations
                </p>
              </div>

              <div style={{ 
                background: 'var(--warning-bg)', 
                padding: '12px', 
                borderRadius: 'var(--radius-md)', 
                marginTop: '20px',
                border: '1px solid var(--warning-color)'
              }}>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-color)' }}>
                  ⚠️ <strong>Note:</strong> Emails will be sent immediately. This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setShowBulkSendModal(false)}
                disabled={bulkSending}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={handleBulkSend}
                disabled={bulkSending}
                style={{ background: 'var(--success-color)' }}
              >
                {bulkSending ? '⏳ Sending...' : `📧 Send ${selectedInvitations.length} Invitation${selectedInvitations.length > 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Invitation Modal */}
      {showEditModal && editingInvitation && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>✏️ Edit Invitation</h2>
              <button className="btn-close" onClick={() => setShowEditModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleUpdate}>
              <div className="form-group">
                <label>Name *</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  value={editFormData.email}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Phone (Optional)</label>
                <input
                  type="tel"
                  value={editFormData.phone}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  placeholder="+1 234 567 8900"
                />
              </div>

              <div className="form-group">
                <label>Email Subject</label>
                <input
                  type="text"
                  value={editFormData.emailSubject}
                  onChange={(e) => setEditFormData({ ...editFormData, emailSubject: e.target.value })}
                  placeholder="Invitation subject line"
                />
              </div>

              <div className="form-group">
                <label>Comments (Optional)</label>
                <textarea
                  value={editFormData.comments}
                  onChange={(e) => setEditFormData({ ...editFormData, comments: e.target.value })}
                  rows="3"
                  placeholder="Add notes or comments about this invitation..."
                />
              </div>

              {error && <div className="error-message">{error}</div>}

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowEditModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  Update Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast notifications handled by ToastContainer in App.js */}
    </div>
  );
};

export default InvitationManager;
