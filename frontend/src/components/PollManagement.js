import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createApiInstance } from '../api';
import RichTextEditor from './shared/RichTextEditor';
import { formatDate, formatDateTime, getTimeRemaining, formatTimeRemaining, toUTCISOString, getDateInputValue } from '../utils/timezoneHelper';
import './PollManagement.css';

// Use global API factory for session handling
const pollsApi = createApiInstance();

/**
 * PollManagement - Admin page for managing polls
 * Create, edit, view results, and manage poll lifecycle
 */
const PollManagement = () => {
  const navigate = useNavigate();
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toast, setToast] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPoll, setEditingPoll] = useState(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  
  // Response table sorting and filtering
  const [responseSortBy, setResponseSortBy] = useState('responded_at');
  const [responseSortOrder, setResponseSortOrder] = useState('desc');
  const [responseFilter, setResponseFilter] = useState('all');
  
  // Form state for creating/editing polls
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    poll_type: 'rsvp',
    event_type: '',
    event_date: '',
    event_time: '',
    event_timezone: 'America/Los_Angeles', // Default to PST
    event_location: '',
    event_details: '',
    virtual_meet_payment_amount: 5.00,
    end_date: '',
    end_time: '',
    end_timezone: 'America/Los_Angeles', // Default to PST
    collect_contact_info: true,
    allow_comments: true,
    options: ['']
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    // Check if user is admin or moderator
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin' && userRole !== 'moderator') {
      navigate('/');
      return;
    }
    fetchPolls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, statusFilter]);

  // Handle ?edit=<poll_id> URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editPollId = params.get('edit');
    
    if (editPollId && polls.length > 0 && !showEditModal) {
      const pollToEdit = polls.find(p => p._id === editPollId);
      if (pollToEdit) {
        // Open edit modal
        setEditingPoll(pollToEdit);
        setFormData({
          title: pollToEdit.title || '',
          description: pollToEdit.description || '',
          poll_type: pollToEdit.poll_type || 'rsvp',
          event_type: pollToEdit.event_type || '',
          event_date: pollToEdit.event_date ? getDateInputValue(pollToEdit.event_date) : '',
          event_time: pollToEdit.event_time || '',
          event_timezone: pollToEdit.event_timezone || 'America/Los_Angeles',
          event_location: pollToEdit.event_location || '',
          event_details: pollToEdit.event_details || '',
          virtual_meet_payment_amount: pollToEdit.virtual_meet_payment_amount ?? 5.00,
          end_date: pollToEdit.end_date ? getDateInputValue(pollToEdit.end_date) : '',
          end_time: pollToEdit.end_time || '',
          end_timezone: pollToEdit.end_timezone || 'America/Los_Angeles',
          collect_contact_info: pollToEdit.collect_contact_info !== false,
          allow_comments: pollToEdit.allow_comments !== false,
          anonymous: pollToEdit.anonymous || false,
          target_all_users: pollToEdit.target_all_users !== false,
          target_usernames: pollToEdit.target_usernames || [],
          options: pollToEdit.options?.map(opt => opt.text) || ['']
        });
        setShowEditModal(true);
        // Clear the URL parameter after opening the modal
        window.history.replaceState({}, '', '/poll-management');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polls, showEditModal]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showResultsModal) setShowResultsModal(false);
        else if (showEditModal) { setShowEditModal(false); setEditingPoll(null); }
        else if (showCreateModal) setShowCreateModal(false);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showCreateModal, showEditModal, showResultsModal]);

  const fetchPolls = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      params.append('page_size', '50');
      
      const response = await pollsApi.get(`/api/polls/admin/list?${params.toString()}`);
      if (response.data.success) {
        setPolls(response.data.polls || []);
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
      setError('Failed to load polls');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Get sorted and filtered responses
  const getSortedFilteredResponses = () => {
    if (!pollResults?.responses) return [];
    
    let filtered = [...pollResults.responses];
    
    // Apply filter
    if (responseFilter !== 'all') {
      filtered = filtered.filter(r => 
        (r.rsvp_response || '').toLowerCase() === responseFilter.toLowerCase()
      );
    }
    
    // Apply sort
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (responseSortBy) {
        case 'username':
          aVal = (a.username || '').toLowerCase();
          bVal = (b.username || '').toLowerCase();
          break;
        case 'user_full_name':
          aVal = (a.user_full_name || '').toLowerCase();
          bVal = (b.user_full_name || '').toLowerCase();
          break;
        case 'rsvp_response':
          aVal = (a.rsvp_response || '').toLowerCase();
          bVal = (b.rsvp_response || '').toLowerCase();
          break;
        case 'responded_at':
        default:
          aVal = new Date(a.responded_at || 0).getTime();
          bVal = new Date(b.responded_at || 0).getTime();
          break;
      }
      
      if (aVal < bVal) return responseSortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return responseSortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    
    return filtered;
  };

  // Handle column header click for sorting
  const handleResponseSort = (column) => {
    if (responseSortBy === column) {
      setResponseSortOrder(responseSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setResponseSortBy(column);
      setResponseSortOrder('asc');
    }
  };

  // Open profile in new tab
  const openProfileInNewTab = (username) => {
    window.open(`/profile/${username}`, '_blank');
  };

  const handleCreatePoll = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showToast('Please enter a poll title', 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      
      const payload = {
        title: formData.title,
        description: formData.description || null,
        poll_type: formData.poll_type,
        event_type: formData.event_type || null,
        event_date: formData.event_date ? `${formData.event_date}T00:00:00` : null,
        event_time: formData.event_time || null,
        event_timezone: formData.event_timezone || 'America/Los_Angeles',
        event_location: formData.event_location || null,
        event_details: formData.event_details || null,
        virtual_meet_payment_amount: formData.event_type === 'zoom-call' ? (parseFloat(formData.virtual_meet_payment_amount) ?? 5.00) : null,
        end_date: formData.end_date ? `${formData.end_date}T00:00:00` : null,
        end_time: formData.end_time || null,
        end_timezone: formData.end_timezone || 'America/Los_Angeles',
        collect_contact_info: formData.collect_contact_info,
        allow_comments: formData.allow_comments,
        anonymous: formData.anonymous || false,
        target_all_users: formData.target_all_users !== false,
        target_usernames: formData.target_usernames || []
      };

      const response = await pollsApi.post('/api/polls/admin/create', payload);
      
      if (response.data.success) {
        showToast('Poll created successfully!', 'success');
        setShowCreateModal(false);
        resetForm();
        fetchPolls();
      }
    } catch (err) {
      console.error('Error creating poll:', err);
      showToast(err.response?.data?.detail || 'Failed to create poll', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleClonePoll = (poll) => {
    setEditingPoll(null);
    setFormData({
      title: `Copy of ${poll.title || ''}`,
      description: poll.description || '',
      poll_type: poll.poll_type || 'rsvp',
      event_type: poll.event_type || '',
      event_date: '',
      event_time: poll.event_time || '',
      event_timezone: poll.event_timezone || 'America/Los_Angeles',
      event_location: poll.event_location || '',
      event_details: poll.event_details || '',
      virtual_meet_payment_amount: poll.virtual_meet_payment_amount ?? 5.00,
      end_date: '',
      end_time: poll.end_time || '',
      end_timezone: poll.end_timezone || 'America/Los_Angeles',
      collect_contact_info: poll.collect_contact_info !== false,
      allow_comments: poll.allow_comments !== false,
      anonymous: poll.anonymous || false,
      target_all_users: poll.target_all_users !== false,
      target_usernames: poll.target_usernames || [],
      options: poll.options?.map(opt => opt.text) || ['']
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (poll) => {
    setEditingPoll(poll);
    setFormData({
      title: poll.title || '',
      description: poll.description || '',
      poll_type: poll.poll_type || 'rsvp',
      event_type: poll.event_type || '',
      event_date: poll.event_date ? getDateInputValue(poll.event_date) : '',
      event_time: poll.event_time || '',
      event_timezone: poll.event_timezone || 'America/Los_Angeles',
      event_location: poll.event_location || '',
      event_details: poll.event_details || '',
      virtual_meet_payment_amount: poll.virtual_meet_payment_amount ?? 5.00,
      end_date: poll.end_date ? getDateInputValue(poll.end_date) : '',
      end_time: poll.end_time || '',
      end_timezone: poll.end_timezone || 'America/Los_Angeles',
      collect_contact_info: poll.collect_contact_info !== false,
      allow_comments: poll.allow_comments !== false,
      anonymous: poll.anonymous || false,
      target_all_users: poll.target_all_users !== false,
      target_usernames: poll.target_usernames || [],
      options: poll.options?.map(opt => opt.text) || ['']
    });
    setShowEditModal(true);
  };

  const handleEditPoll = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      showToast('Please enter a poll title', 'error');
      return;
    }

    try {
      setFormSubmitting(true);
      
      const payload = {
        title: formData.title,
        description: formData.description || null,
        event_type: formData.event_type || null,
        event_date: formData.event_date ? `${formData.event_date}T00:00:00` : undefined,
        event_time: formData.event_time || null,
        event_timezone: formData.event_timezone || 'America/Los_Angeles',
        event_location: formData.event_location || null,
        event_details: formData.event_details || null,
        virtual_meet_payment_amount: formData.event_type === 'zoom-call' ? (parseFloat(formData.virtual_meet_payment_amount) ?? 5.00) : null,
        end_date: formData.end_date ? `${formData.end_date}T00:00:00` : undefined,
        end_time: formData.end_time || null,
        end_timezone: formData.end_timezone || 'America/Los_Angeles',
        collect_contact_info: formData.collect_contact_info,
        allow_comments: formData.allow_comments,
        anonymous: formData.anonymous || false,
        target_all_users: formData.target_all_users !== false,
        target_usernames: formData.target_usernames || []
      };

      const response = await pollsApi.put(`/api/polls/admin/${editingPoll._id}`, payload);
      
      if (response.data.success) {
        showToast('Poll updated successfully!', 'success');
        setShowEditModal(false);
        setEditingPoll(null);
        resetForm();
        fetchPolls();
      }
    } catch (err) {
      console.error('Error updating poll:', err);
      showToast(err.response?.data?.detail || 'Failed to update poll', 'error');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleStatusChange = async (pollId, newStatus) => {
    try {
      let endpoint = '';
      switch (newStatus) {
        case 'active':
          endpoint = `/api/polls/admin/${pollId}/activate`;
          break;
        case 'closed':
          endpoint = `/api/polls/admin/${pollId}/close`;
          break;
        case 'archived':
          endpoint = `/api/polls/admin/${pollId}/archive`;
          break;
        default:
          return;
      }
      
      const response = await pollsApi.post(endpoint);
      if (response.data.success) {
        showToast(`Poll ${newStatus}!`, 'success');
        fetchPolls();
      }
    } catch (err) {
      console.error('Error changing poll status:', err);
      showToast(err.response?.data?.detail || 'Failed to change status', 'error');
    }
  };

  const handleDeletePoll = async (pollId, pollTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${pollTitle}"? This will also delete all responses.`)) {
      return;
    }

    try {
      const response = await pollsApi.delete(`/api/polls/admin/${pollId}`);
      if (response.data.success) {
        showToast('Poll deleted', 'success');
        fetchPolls();
      }
    } catch (err) {
      console.error('Error deleting poll:', err);
      showToast(err.response?.data?.detail || 'Failed to delete poll', 'error');
    }
  };

  const handleViewResults = async (poll) => {
    setSelectedPoll(poll);
    setShowResultsModal(true);
    setResultsLoading(true);
    
    try {
      const response = await pollsApi.get(`/api/polls/admin/${poll._id}/results`);
      if (response.data.success) {
        setPollResults(response.data);
      }
    } catch (err) {
      console.error('Error fetching results:', err);
      showToast('Failed to load results', 'error');
    } finally {
      setResultsLoading(false);
    }
  };

  const handleExportResults = async (pollId) => {
    try {
      const response = await pollsApi.get(`/api/polls/admin/${pollId}/export`);
      if (response.data.success) {
        // Convert to CSV
        const data = response.data.data;
        if (data.length === 0) {
          showToast('No responses to export', 'warning');
          return;
        }
        
        const headers = Object.keys(data[0]);
        const csvContent = [
          headers.join(','),
          ...data.map(row => headers.map(h => `"${(row[h] || '').toString().replace(/"/g, '""')}"`).join(','))
        ].join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `poll_responses_${pollId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        showToast('Export downloaded!', 'success');
      }
    } catch (err) {
      console.error('Error exporting:', err);
      showToast('Failed to export', 'error');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      poll_type: 'rsvp',
      event_type: '',
      event_date: '',
      event_time: '',
      event_timezone: 'America/Los_Angeles',
      event_location: '',
      event_details: '',
      virtual_meet_payment_amount: 5.00,
      end_date: '',
      end_time: '',
      end_timezone: 'America/Los_Angeles',
      collect_contact_info: true,
      allow_comments: true,
      options: ['']
    });
  };

  const addOption = () => {
    setFormData(prev => ({
      ...prev,
      options: [...prev.options, '']
    }));
  };

  const removeOption = (index) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.filter((_, i) => i !== index)
    }));
  };

  const updateOption = (index, value) => {
    setFormData(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { label: 'Draft', className: 'status-draft' },
      active: { label: 'Active', className: 'status-active' },
      closed: { label: 'Closed', className: 'status-closed' },
      archived: { label: 'Archived', className: 'status-archived' }
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <span className={`poll-status-badge ${config.className}`}>{config.label}</span>;
  };

  // Use timezone helper for date formatting

  if (loading && polls.length === 0) {
    return (
      <div className="poll-management">
        <div className="poll-management-loading">
          <div className="loading-spinner"></div>
          <span>Loading polls...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="poll-management">
      {toast && (
        <div className={`poll-toast poll-toast-${toast.type}`}>
          {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠' : '✕'} {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="poll-management-header">
        <div className="poll-header-left">
          <h1>📊 Poll Management</h1>
          <p className="poll-subtitle">Create and manage polls for your users</p>
        </div>
        <button className="poll-create-btn" onClick={() => setShowCreateModal(true)}>
          + Create Poll
        </button>
      </div>

      {/* Filters */}
      <div className="poll-filters">
        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="poll-filter-select"
        >
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="archived">Archived</option>
        </select>
        <button onClick={fetchPolls} className="poll-refresh-btn" title="Refresh">
          🔄
        </button>
      </div>

      {/* Polls List */}
      {error ? (
        <div className="poll-error-state">
          <span>⚠️ {error}</span>
          <button onClick={fetchPolls}>Retry</button>
        </div>
      ) : polls.length === 0 ? (
        <div className="poll-empty-state">
          <span className="poll-empty-icon">📊</span>
          <h3>No polls yet</h3>
          <p>Create your first poll to start collecting responses from users.</p>
          <button onClick={() => setShowCreateModal(true)} className="poll-create-btn">
            + Create Poll
          </button>
        </div>
      ) : (
        <div className="poll-list">
          {polls.map(poll => (
            <div key={poll._id} className="poll-card">
              <div className="poll-card-header">
                <div className="poll-card-title-row">
                  <h3 className="poll-card-title">{poll.title}</h3>
                  {getStatusBadge(poll.status)}
                </div>
                <div className="poll-card-meta">
                  <span>📅 {formatDate(poll.event_date || poll.created_at)}</span>
                  <span>👥 {poll.response_count || 0} responses</span>
                </div>
              </div>
              
              {poll.description && (
                <div className="poll-card-description" dangerouslySetInnerHTML={{ __html: poll.description }} />
              )}
              
              <div className="poll-card-actions">
                <button 
                  className="poll-action-btn poll-action-results"
                  onClick={() => handleViewResults(poll)}
                >
                  📈 Results
                </button>
                
                <button 
                  className="poll-action-btn poll-action-clone"
                  onClick={() => handleClonePoll(poll)}
                  title="Clone this poll"
                >
                  📋 Clone
                </button>
                
                {(poll.status === 'active' || poll.status === 'draft' || poll.status === 'closed') && (
                  <button 
                    className="poll-action-btn poll-action-edit"
                    onClick={() => handleOpenEdit(poll)}
                  >
                    ✏️ Edit
                  </button>
                )}
                
                {poll.status === 'draft' && (
                  <button 
                    className="poll-action-btn poll-action-activate"
                    onClick={() => handleStatusChange(poll._id, 'active')}
                  >
                    ▶️ Activate
                  </button>
                )}
                
                {poll.status === 'active' && (
                  <button 
                    className="poll-action-btn poll-action-close"
                    onClick={() => handleStatusChange(poll._id, 'closed')}
                  >
                    ⏹️ Close
                  </button>
                )}
                
                {poll.status === 'closed' && (
                  <>
                    <button 
                      className="poll-action-btn poll-action-reopen"
                      onClick={() => handleStatusChange(poll._id, 'active')}
                      title="Reopen this poll"
                    >
                      🔄 Reopen
                    </button>
                    <button 
                      className="poll-action-btn poll-action-archive"
                      onClick={() => handleStatusChange(poll._id, 'archived')}
                    >
                      📦 Archive
                    </button>
                  </>
                )}
                
                <button 
                  className="poll-action-btn poll-action-export"
                  onClick={() => handleExportResults(poll._id)}
                >
                  📥 Export
                </button>
                
                <button 
                  className="poll-action-btn poll-action-delete"
                  onClick={() => handleDeletePoll(poll._id, poll.title)}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Poll Modal */}
      {showCreateModal && (
        <div className="poll-modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="poll-modal" onClick={(e) => e.stopPropagation()}>
            <div className="poll-modal-header">
              <h2>📊 Create New Poll</h2>
              <button className="poll-modal-close" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleCreatePoll} className="poll-modal-body">
              <div className="poll-form-group">
                <label>Poll Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Video Dating Call - Jan 16th 2026"
                  required
                />
              </div>
              
              <div className="poll-form-group">
                <label>Description</label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Describe what this poll is about..."
                  minHeight="120px"
                />
              </div>
              
              <div className="poll-form-group">
                <label>Poll Type</label>
                <select
                  value={formData.poll_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, poll_type: e.target.value }))}
                >
                  <option value="rsvp">RSVP (Yes/No/Maybe)</option>
                  <option value="single_choice">Single Choice</option>
                  <option value="multiple_choice">Multiple Choice</option>
                </select>
              </div>
              
              {/* Custom options for non-RSVP polls */}
              {formData.poll_type !== 'rsvp' && (
                <div className="poll-form-group">
                  <label>Options</label>
                  {formData.options.map((opt, index) => (
                    <div key={index} className="poll-option-input-row">
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                      />
                      {formData.options.length > 1 && (
                        <button type="button" onClick={() => removeOption(index)} className="poll-remove-option">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={addOption} className="poll-add-option">+ Add Option</button>
                </div>
              )}
              
              <div className="poll-form-section">
                <h4>Event Details (Optional)</h4>

                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>Event Type</label>
                    <select
                      value={formData.event_type}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_type: e.target.value }))}
                    >
                      <option value="">— Select —</option>
                      <option value="in-person">In Person</option>
                      <option value="virtual">Virtual</option>
                      <option value="zoom-call">Zoom Call</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  {formData.event_type === 'zoom-call' && (
                    <div className="poll-form-group">
                      <label className="poll-checkbox-label poll-free-event-toggle">
                        <input
                          type="checkbox"
                          checked={parseFloat(formData.virtual_meet_payment_amount) === 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, virtual_meet_payment_amount: e.target.checked ? 0 : 5.00 }))}
                        />
                        <span>Free Event (no payment required)</span>
                      </label>
                      {parseFloat(formData.virtual_meet_payment_amount) !== 0 && (
                        <>
                          <label>Virtual Meet Fee ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.virtual_meet_payment_amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, virtual_meet_payment_amount: e.target.value }))}
                            placeholder="5.00"
                          />
                          <small className="poll-form-hint">Users pay this to access Virtual Meets match list</small>
                        </>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>Event Date</label>
                    <input
                      type="date"
                      value={formData.event_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="poll-form-group">
                    <label>Event Time</label>
                    <input
                      type="time"
                      value={formData.event_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_time: e.target.value }))}
                    />
                  </div>
                  
                  <div className="poll-form-group">
                    <label>Timezone</label>
                    <select
                      value={formData.event_timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_timezone: e.target.value }))}
                    >
                      <option value="America/Los_Angeles">PST/PDT (Pacific)</option>
                      <option value="America/Denver">MST/MDT (Mountain)</option>
                      <option value="America/Chicago">CST/CDT (Central)</option>
                      <option value="America/New_York">EST/EDT (Eastern)</option>
                      <option value="America/Phoenix">MST (Arizona)</option>
                      <option value="Pacific/Honolulu">HST (Hawaii)</option>
                      <option value="America/Anchorage">AKST/AKDT (Alaska)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                
                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                  
                  <div className="poll-form-group">
                    <label>End Time</label>
                    <input
                      type="time"
                      value={formData.end_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))}
                    />
                  </div>
                  
                  <div className="poll-form-group">
                    <label>Timezone</label>
                    <select
                      value={formData.end_timezone}
                      onChange={(e) => setFormData(prev => ({ ...prev, end_timezone: e.target.value }))}
                    >
                      <option value="America/Los_Angeles">PST/PDT (Pacific)</option>
                      <option value="America/Denver">MST/MDT (Mountain)</option>
                      <option value="America/Chicago">CST/CDT (Central)</option>
                      <option value="America/New_York">EST/EDT (Eastern)</option>
                      <option value="America/Phoenix">MST (Arizona)</option>
                      <option value="Pacific/Honolulu">HST (Hawaii)</option>
                      <option value="America/Anchorage">AKST/AKDT (Alaska)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                
                <div className="poll-form-group">
                  <label>Location / Platform</label>
                  <input
                    type="text"
                    value={formData.event_location}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_location: e.target.value }))}
                    placeholder="e.g., Zoom (link will be shared)"
                  />
                </div>
                
                <div className="poll-form-group">
                  <label>Additional Details</label>
                  <textarea
                    value={formData.event_details}
                    onChange={(e) => setFormData(prev => ({ ...prev, event_details: e.target.value }))}
                    placeholder="Any additional information about the event..."
                    rows={2}
                  />
                </div>
              </div>
              
              <div className="poll-form-section">
                <h4>Settings</h4>
                
                <label className="poll-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.collect_contact_info}
                    onChange={(e) => setFormData(prev => ({ ...prev, collect_contact_info: e.target.checked }))}
                  />
                  <span>Collect user's contact information with response</span>
                </label>
                
                <label className="poll-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.allow_comments}
                    onChange={(e) => setFormData(prev => ({ ...prev, allow_comments: e.target.checked }))}
                  />
                  <span>Allow users to add comments</span>
                </label>
              </div>
            </form>
            
            <div className="poll-modal-footer">
              <button 
                type="button" 
                className="poll-btn-secondary" 
                onClick={() => setShowCreateModal(false)}
                disabled={formSubmitting}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className="poll-btn-primary"
                onClick={handleCreatePoll}
                disabled={formSubmitting}
              >
                {formSubmitting ? 'Creating...' : 'Create Poll'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Poll Modal */}
      {showEditModal && editingPoll && (
        <div className="poll-modal-overlay" onClick={() => { setShowEditModal(false); setEditingPoll(null); resetForm(); }}>
          <div className="poll-modal" onClick={(e) => e.stopPropagation()}>
            <div className="poll-modal-header">
              <h2>✏️ Edit Poll</h2>
              <button className="poll-modal-close" onClick={() => { setShowEditModal(false); setEditingPoll(null); resetForm(); }}>✕</button>
            </div>
            
            <form onSubmit={handleEditPoll} className="poll-modal-body">
              <div className="poll-form-group">
                <label>Poll Title *</label>
                <input type="text" value={formData.title} onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))} required />
              </div>
              <div className="poll-form-group">
                <label>Description</label>
                <RichTextEditor
                  value={formData.description}
                  onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
                  placeholder="Describe what this poll is about..."
                  minHeight="120px"
                />
              </div>
              <div className="poll-form-section">
                <h4>Event Details</h4>
                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>Event Type</label>
                    <select value={formData.event_type} onChange={(e) => setFormData(prev => ({ ...prev, event_type: e.target.value }))}>
                      <option value="">— Select —</option>
                      <option value="in-person">In Person</option>
                      <option value="virtual">Virtual</option>
                      <option value="zoom-call">Zoom Call</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  {formData.event_type === 'zoom-call' && (
                    <div className="poll-form-group">
                      <label className="poll-checkbox-label poll-free-event-toggle">
                        <input
                          type="checkbox"
                          checked={parseFloat(formData.virtual_meet_payment_amount) === 0}
                          onChange={(e) => setFormData(prev => ({ ...prev, virtual_meet_payment_amount: e.target.checked ? 0 : 5.00 }))}
                        />
                        <span>Free Event (no payment required)</span>
                      </label>
                      {parseFloat(formData.virtual_meet_payment_amount) !== 0 && (
                        <>
                          <label>Virtual Meet Fee ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            value={formData.virtual_meet_payment_amount}
                            onChange={(e) => setFormData(prev => ({ ...prev, virtual_meet_payment_amount: e.target.value }))}
                            placeholder="5.00"
                          />
                          <small className="poll-form-hint">Users pay this to access Virtual Meets match list</small>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>Event Date</label>
                    <input type="date" value={formData.event_date} onChange={(e) => setFormData(prev => ({ ...prev, event_date: e.target.value }))} />
                  </div>
                  <div className="poll-form-group">
                    <label>Event Time</label>
                    <input type="time" value={formData.event_time} onChange={(e) => setFormData(prev => ({ ...prev, event_time: e.target.value }))} />
                  </div>
                  <div className="poll-form-group">
                    <label>Timezone</label>
                    <select value={formData.event_timezone} onChange={(e) => setFormData(prev => ({ ...prev, event_timezone: e.target.value }))}>
                      <option value="America/Los_Angeles">PST/PDT (Pacific)</option>
                      <option value="America/Denver">MST/MDT (Mountain)</option>
                      <option value="America/Chicago">CST/CDT (Central)</option>
                      <option value="America/New_York">EST/EDT (Eastern)</option>
                      <option value="America/Phoenix">MST (Arizona)</option>
                      <option value="Pacific/Honolulu">HST (Hawaii)</option>
                      <option value="America/Anchorage">AKST/AKDT (Alaska)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div className="poll-form-row">
                  <div className="poll-form-group">
                    <label>End Date</label>
                    <input type="date" value={formData.end_date} onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))} />
                  </div>
                  <div className="poll-form-group">
                    <label>End Time</label>
                    <input type="time" value={formData.end_time} onChange={(e) => setFormData(prev => ({ ...prev, end_time: e.target.value }))} />
                  </div>
                  <div className="poll-form-group">
                    <label>Timezone</label>
                    <select value={formData.end_timezone} onChange={(e) => setFormData(prev => ({ ...prev, end_timezone: e.target.value }))}>
                      <option value="America/Los_Angeles">PST/PDT (Pacific)</option>
                      <option value="America/Denver">MST/MDT (Mountain)</option>
                      <option value="America/Chicago">CST/CDT (Central)</option>
                      <option value="America/New_York">EST/EDT (Eastern)</option>
                      <option value="America/Phoenix">MST (Arizona)</option>
                      <option value="Pacific/Honolulu">HST (Hawaii)</option>
                      <option value="America/Anchorage">AKST/AKDT (Alaska)</option>
                      <option value="UTC">UTC</option>
                    </select>
                  </div>
                </div>
                <div className="poll-form-group">
                  <label>Location / Platform</label>
                  <input type="text" value={formData.event_location} onChange={(e) => setFormData(prev => ({ ...prev, event_location: e.target.value }))} />
                </div>
                <div className="poll-form-group">
                  <label>Additional Details</label>
                  <textarea value={formData.event_details} onChange={(e) => setFormData(prev => ({ ...prev, event_details: e.target.value }))} rows={2} />
                </div>
              </div>
              <div className="poll-form-section">
                <h4>Settings</h4>
                <label className="poll-checkbox-label">
                  <input type="checkbox" checked={formData.collect_contact_info} onChange={(e) => setFormData(prev => ({ ...prev, collect_contact_info: e.target.checked }))} />
                  <span>Collect user's contact information with response</span>
                </label>
                <label className="poll-checkbox-label">
                  <input type="checkbox" checked={formData.allow_comments} onChange={(e) => setFormData(prev => ({ ...prev, allow_comments: e.target.checked }))} />
                  <span>Allow users to add comments</span>
                </label>
              </div>
            </form>
            
            <div className="poll-modal-footer">
              <button type="button" className="poll-btn-secondary" onClick={() => { setShowEditModal(false); setEditingPoll(null); resetForm(); }} disabled={formSubmitting}>Cancel</button>
              <button type="submit" className="poll-btn-primary" onClick={handleEditPoll} disabled={formSubmitting}>{formSubmitting ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Results Modal */}
      {showResultsModal && selectedPoll && (
        <div className="poll-modal-overlay" onClick={() => setShowResultsModal(false)}>
          <div className="poll-modal poll-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="poll-modal-header">
              <h2>📈 Poll Results: {selectedPoll.title}</h2>
              <button className="poll-modal-close" onClick={() => setShowResultsModal(false)}>✕</button>
            </div>
            
            <div className="poll-modal-body">
              {resultsLoading ? (
                <div className="poll-results-loading">
                  <div className="loading-spinner"></div>
                  <span>Loading results...</span>
                </div>
              ) : pollResults ? (
                <div className="poll-results-content">
                  {/* Summary */}
                  <div className="poll-results-summary">
                    <div className="poll-result-stat">
                      <span className="poll-stat-value">{pollResults.total_responses}</span>
                      <span className="poll-stat-label">Total Responses</span>
                    </div>
                    
                    {selectedPoll.poll_type === 'rsvp' && (
                      <>
                        <div className="poll-result-stat poll-stat-yes">
                          <span className="poll-stat-value">{pollResults.rsvp_counts?.yes || 0}</span>
                          <span className="poll-stat-label">Yes</span>
                        </div>
                        <div className="poll-result-stat poll-stat-no">
                          <span className="poll-stat-value">{pollResults.rsvp_counts?.no || 0}</span>
                          <span className="poll-stat-label">No</span>
                        </div>
                        <div className="poll-result-stat poll-stat-maybe">
                          <span className="poll-stat-value">{pollResults.rsvp_counts?.maybe || 0}</span>
                          <span className="poll-stat-label">Maybe</span>
                        </div>
                      </>
                    )}
                  </div>
                  
                  {/* Responses Table */}
                  <div className="poll-responses-section">
                    <div className="poll-responses-header">
                      <h3>All Responses</h3>
                      <div className="poll-responses-controls">
                        <select 
                          value={responseFilter} 
                          onChange={(e) => setResponseFilter(e.target.value)}
                          className="poll-filter-select"
                        >
                          <option value="all">All Responses</option>
                          <option value="yes">Yes Only</option>
                          <option value="no">No Only</option>
                          <option value="maybe">Maybe Only</option>
                        </select>
                        <span className="poll-response-count">
                          Showing {getSortedFilteredResponses().length} of {pollResults.responses?.length || 0}
                        </span>
                      </div>
                    </div>
                    {pollResults.responses?.length > 0 ? (
                      <div className="poll-responses-table-wrapper">
                        <table className="poll-responses-table">
                          <thead>
                            <tr>
                              <th 
                                onClick={() => handleResponseSort('username')} 
                                className="sortable-header"
                                title="Click to sort by username"
                              >
                                User {responseSortBy === 'username' && (responseSortOrder === 'asc' ? '↑' : '↓')}
                              </th>
                              <th 
                                onClick={() => handleResponseSort('user_full_name')} 
                                className="sortable-header"
                                title="Click to sort by name"
                              >
                                Full Name {responseSortBy === 'user_full_name' && (responseSortOrder === 'asc' ? '↑' : '↓')}
                              </th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th 
                                onClick={() => handleResponseSort('rsvp_response')} 
                                className="sortable-header"
                                title="Click to sort by response"
                              >
                                Response {responseSortBy === 'rsvp_response' && (responseSortOrder === 'asc' ? '↑' : '↓')}
                              </th>
                              <th>Comment</th>
                              <th 
                                onClick={() => handleResponseSort('responded_at')} 
                                className="sortable-header"
                                title="Click to sort by date"
                              >
                                Date {responseSortBy === 'responded_at' && (responseSortOrder === 'asc' ? '↑' : '↓')}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {getSortedFilteredResponses().map(resp => (
                              <tr key={resp._id}>
                                <td>
                                  <span 
                                    className="poll-username-link"
                                    onClick={() => openProfileInNewTab(resp.username)}
                                    title="Open profile in new tab"
                                  >
                                    {resp.username}
                                  </span>
                                </td>
                                <td>{resp.user_full_name || '-'}</td>
                                <td>{resp.user_email || '-'}</td>
                                <td>{resp.user_phone || '-'}</td>
                                <td>
                                  <span className={`poll-response-badge poll-response-${resp.rsvp_response || 'other'}`}>
                                    {resp.rsvp_response || 'Selected'}
                                  </span>
                                </td>
                                <td>{resp.comment || '-'}</td>
                                <td>{formatDate(resp.responded_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="poll-no-responses">No responses yet</p>
                    )}
                  </div>
                </div>
              ) : (
                <p>Failed to load results</p>
              )}
            </div>
            
            <div className="poll-modal-footer">
              <button 
                className="poll-btn-secondary"
                onClick={() => handleExportResults(selectedPoll._id)}
              >
                📥 Export CSV
              </button>
              <button 
                className="poll-btn-primary"
                onClick={() => setShowResultsModal(false)}
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

export default PollManagement;
