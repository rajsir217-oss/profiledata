import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getBackendUrl } from '../config/apiConfig';
import './PollManagement.css';

// Create axios instance for polls API (uses /api/polls, not /api/users)
const pollsApi = axios.create();
pollsApi.interceptors.request.use((config) => {
  config.baseURL = getBackendUrl();
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

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
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [selectedPoll, setSelectedPoll] = useState(null);
  const [pollResults, setPollResults] = useState(null);
  const [resultsLoading, setResultsLoading] = useState(false);
  
  // Form state for creating/editing polls
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    poll_type: 'rsvp',
    event_date: '',
    event_time: '',
    event_location: '',
    event_details: '',
    collect_contact_info: true,
    allow_comments: true,
    options: ['']
  });
  const [formSubmitting, setFormSubmitting] = useState(false);

  useEffect(() => {
    // Check if user is admin
    const userRole = localStorage.getItem('userRole');
    if (userRole !== 'admin') {
      navigate('/dashboard');
      return;
    }
    
    fetchPolls();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, statusFilter]);

  // ESC key handler
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        if (showResultsModal) setShowResultsModal(false);
        else if (showCreateModal) setShowCreateModal(false);
      }
    };
    document.addEventListener('keydown', handleEscKey);
    return () => document.removeEventListener('keydown', handleEscKey);
  }, [showCreateModal, showResultsModal]);

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
        event_date: formData.event_date ? new Date(formData.event_date).toISOString() : null,
        event_time: formData.event_time || null,
        event_location: formData.event_location || null,
        event_details: formData.event_details || null,
        collect_contact_info: formData.collect_contact_info,
        allow_comments: formData.allow_comments,
        options: formData.poll_type !== 'rsvp' ? formData.options.filter(o => o.trim()) : null
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
      event_date: '',
      event_time: '',
      event_location: '',
      event_details: '',
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

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

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
                <p className="poll-card-description">{poll.description}</p>
              )}
              
              <div className="poll-card-actions">
                <button 
                  className="poll-action-btn poll-action-results"
                  onClick={() => handleViewResults(poll)}
                >
                  📈 Results
                </button>
                
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
                  <button 
                    className="poll-action-btn poll-action-archive"
                    onClick={() => handleStatusChange(poll._id, 'archived')}
                  >
                    📦 Archive
                  </button>
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
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this poll is about..."
                  rows={3}
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
                      type="text"
                      value={formData.event_time}
                      onChange={(e) => setFormData(prev => ({ ...prev, event_time: e.target.value }))}
                      placeholder="e.g., 7:00 PM PST"
                    />
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
                    <h3>All Responses</h3>
                    {pollResults.responses?.length > 0 ? (
                      <div className="poll-responses-table-wrapper">
                        <table className="poll-responses-table">
                          <thead>
                            <tr>
                              <th>User</th>
                              <th>Full Name</th>
                              <th>Email</th>
                              <th>Phone</th>
                              <th>Response</th>
                              <th>Comment</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pollResults.responses.map(resp => (
                              <tr key={resp._id}>
                                <td>{resp.username}</td>
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
