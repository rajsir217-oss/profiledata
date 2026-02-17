/**
 * Optimized DynamicScheduler Component
 * 
 * Phase 1 Optimizations:
 * - Shared hooks integration
 * - Memoized filtering and sorting
 * - Cancellable API requests
 * - Error boundaries
 * - Performance monitoring
 * - Centralized keyboard shortcuts
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useToast from '../hooks/useToast';
import { getBackendApiUrl } from '../utils/urlHelper';
import './DynamicScheduler.css';
import JobCreationModal from './JobCreationModal';
import JobExecutionHistory from './JobExecutionHistory';
import './LoadMore.css';
import useAdminAuth from '../hooks/useAdminAuth';
import useSchedulerData from '../hooks/useSchedulerData';
import useDebounce from '../hooks/useDebounce';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import usePerformanceMonitor from '../hooks/usePerformanceMonitor';

// Error Boundary Component
class DynamicSchedulerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('DynamicScheduler Error:', error, errorInfo);
    this.setState({ error, hasError: true });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Something went wrong</h3>
          <details>
            {this.state.error && this.state.error.toString()}
          </details>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

const DynamicScheduler = ({ currentUser }) => {
  // Admin authentication
  useAdminAuth();
  
  const navigate = useNavigate();
  const toast = useToast();
  const { recordRender } = usePerformanceMonitor('DynamicScheduler');
  
  // Shared data hook
  const { jobs, templates, status, loading, error, refresh } = useSchedulerData();
  
  // UI state
  const [selectedJob, setSelectedJob] = useState(null);
  const [editJob, setEditJob] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [filterTemplates, setFilterTemplates] = useState([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [displayCount, setDisplayCount] = useState(20);
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Debounced search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Memoized filtered and sorted jobs
  const filteredJobs = useMemo(() => {
    if (!jobs.length) return [];
    
    let filtered = jobs.filter(job => {
      // Template filter
      const matchesTemplate = filterTemplates.length === 0 || filterTemplates.includes(job.template_type);
      
      // Enabled filter
      const matchesEnabled = filterEnabled === 'all' || 
        (filterEnabled === 'enabled' && job.enabled) || 
        (filterEnabled === 'disabled' && !job.enabled);
      
      // Search filter
      const matchesSearch = !debouncedSearchTerm || 
        job.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        job.description?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        job.template_type?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      
      return matchesTemplate && matchesEnabled && matchesSearch;
    });

    // Sort jobs
    if (sortBy) {
      filtered.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];
        
        // Handle date fields
        if (sortBy === 'createdAt' || sortBy === 'lastRunAt' || sortBy === 'nextRunAt') {
          aVal = aVal ? new Date(aVal).getTime() : 0;
          bVal = bVal ? new Date(bVal).getTime() : 0;
        }
        
        // Handle string fields
        if (typeof aVal === 'string') {
          aVal = aVal.toLowerCase();
        }
        if (typeof bVal === 'string') {
          bVal = bVal.toLowerCase();
        }
        
        if (sortOrder === 'asc') {
          return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        } else {
          return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
        }
      });
    }

    return filtered;
  }, [jobs, filterTemplates, filterEnabled, debouncedSearchTerm, sortBy, sortOrder]);

  // Memoized displayed jobs (with pagination)
  const displayedJobs = useMemo(() => {
    return filteredJobs.slice(0, displayCount);
  }, [filteredJobs, displayCount]);

  // Memoized available templates for filtering
  const availableTemplates = useMemo(() => {
    const templateTypes = [...new Set(jobs.map(job => job.template_type).filter(Boolean))];
    return templateTypes.sort();
  }, [jobs]);

  // Memoized template options for dropdown
  const templateOptions = useMemo(() => {
    return availableTemplates.map(template => ({
      value: template,
      label: template.charAt(0).toUpperCase() + template.slice(1),
      selected: filterTemplates.includes(template)
    }));
  }, [availableTemplates, filterTemplates]);

  // Performance tracking
  useEffect(() => {
    recordRender();
  }, [recordRender]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      keys: 'Escape',
      action: useCallback(() => {
        if (showCreateModal) {
          setShowCreateModal(false);
        } else if (showHistoryModal) {
          setShowHistoryModal(false);
        } else if (selectedJob) {
          setSelectedJob(null);
        }
      }, [showCreateModal, showHistoryModal, selectedJob])
    },
    {
      keys: 'n',
      ctrl: true,
      action: useCallback(() => {
        setSelectedJob(null);
        setEditJob(null);
        setShowCreateModal(true);
      }, [])
    },
    {
      keys: 'r',
      ctrl: true,
      action: useCallback(() => {
        refresh();
      }, [refresh])
    }
  ], [showCreateModal, showHistoryModal, selectedJob, refresh]);

  useKeyboardShortcuts(shortcuts);

  // Event handlers with memoization
  const handleCreateJob = useCallback(() => {
    setSelectedJob(null);
    setEditJob(null);
    setShowCreateModal(true);
  }, []);

  const handleEditJob = useCallback((job) => {
    setSelectedJob(job);
    setEditJob(job);
    setShowCreateModal(true);
  }, []);

  const handleViewHistory = useCallback((job) => {
    setSelectedJob(job);
    setShowHistoryModal(true);
  }, []);

  const handleSort = useCallback((key) => {
    setSortBy(key);
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);

  const toggleTemplateFilter = useCallback((template) => {
    setFilterTemplates(prev => 
      prev.includes(template) 
        ? prev.filter(t => t !== template)
        : [...prev, template]
    );
  }, []);

  const handleLoadMore = useCallback(() => {
    setDisplayCount(prev => Math.min(prev + 20, filteredJobs.length));
  }, [filteredJobs.length]);

  const handleJobSubmit = useCallback(async (jobData) => {
    try {
      const token = localStorage.getItem('token');
      const isEdit = !!editJob;
      const url = isEdit 
        ? getBackendApiUrl(`/api/admin/scheduler/jobs/${editJob._id}`)
        : getBackendApiUrl('/api/admin/scheduler/jobs');
      
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(jobData)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to ${isEdit ? 'update' : 'create'} job: ${response.status}`);
      }

      toast.success(`Job ${isEdit ? 'updated' : 'created'} successfully`);
      setShowCreateModal(false);
      setEditJob(null);
      refresh();
    } catch (err) {
      console.error('Error submitting job:', err);
      toast.error(err.message || 'Failed to submit job');
    }
  }, [editJob, refresh, toast]);

  // Format dates
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }, []);

  // Get status badge
  const getStatusBadge = useCallback((status) => {
    const badges = {
      running: { color: 'blue', icon: '▶️', text: 'Running' },
      completed: { color: 'green', icon: '✅', text: 'Completed' },
      failed: { color: 'red', icon: '❌', text: 'Failed' },
      cancelled: { color: 'gray', icon: '⏹️', text: 'Cancelled' },
      pending: { color: 'yellow', icon: '⏳', text: 'Pending' }
    };

    const badge = badges[status] || badges.pending;
    return (
      <span className={`status-${badge.color}`}>
        {badge.icon} {badge.text}
      </span>
    );
  }, []);

  // Render component
  return (
    <DynamicSchedulerErrorBoundary>
      <div className="dynamic-scheduler">
        <div className="scheduler-header">
          <div className="header-left">
            <h1>⚙️ Dynamic Scheduler</h1>
            <p>Manage and monitor scheduled jobs</p>
          </div>
          <div className="header-right">
            <button onClick={handleCreateJob} className="btn btn-primary">
              ➕ Create Job
            </button>
            <button onClick={refresh} className="btn btn-secondary" disabled={loading}>
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Scheduler Status */}
        {status && (
          <div className="scheduler-status">
            <div className="status-card">
              <h3>Scheduler Status</h3>
              <div className="status-details">
                <div className="status-item">
                  <span className="label">Status:</span>
                  <span className={`value ${status.is_running ? 'running' : 'stopped'}`}>
                    {status.is_running ? '🟢 Running' : '🔴 Stopped'}
                  </span>
                </div>
                <div className="status-item">
                  <span className="label">Active Jobs:</span>
                  <span className="value">{status.active_jobs || 0}</span>
                </div>
                <div className="status-item">
                  <span className="label">Last Check:</span>
                  <span className="value">{formatDate(status.last_check)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="scheduler-filters">
          <div className="filter-row">
            <input
              type="text"
              placeholder="Search jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />

            <div className="multi-select-dropdown">
              <button
                className="multi-select-button"
                onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              >
                Templates ({filterTemplates.length}) ▼
              </button>
              
              {showTemplateDropdown && (
                <div className="dropdown-menu">
                  {templateOptions.map(option => (
                    <label key={option.value} className="dropdown-item">
                      <input
                        type="checkbox"
                        checked={option.selected}
                        onChange={() => toggleTemplateFilter(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <select
              value={filterEnabled}
              onChange={(e) => setFilterEnabled(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Jobs</option>
              <option value="enabled">Enabled</option>
              <option value="disabled">Disabled</option>
            </select>

            <div className="sort-controls">
              <select
                value={sortBy}
                onChange={(e) => handleSort(e.target.value)}
                className="sort-select"
              >
                <option value="name">Name</option>
                <option value="template_type">Template</option>
                <option value="enabled">Status</option>
                <option value="createdAt">Created</option>
                <option value="lastRunAt">Last Run</option>
                <option value="nextRunAt">Next Run</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="sort-direction"
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading scheduler data...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={refresh} className="btn btn-primary">Retry</button>
          </div>
        )}

        {/* Jobs List */}
        {!loading && !error && (
          <>
            {displayedJobs.length === 0 ? (
              <div className="empty-state">
                <p>No jobs found matching your filters.</p>
                <button onClick={() => {
                  setFilterTemplates([]);
                  setFilterEnabled('all');
                  setSearchTerm('');
                }} className="btn btn-primary">
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="jobs-list">
                {displayedJobs.map(job => (
                  <div key={job.id} className="job-card">
                    <div className="job-header">
                      <h3>{job.name}</h3>
                      <div className="job-actions">
                        <button
                          onClick={() => handleEditJob(job)}
                          className="btn btn-sm btn-primary"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleViewHistory(job)}
                          className="btn btn-sm btn-info"
                        >
                          📊 History
                        </button>
                      </div>
                    </div>
                    
                    <div className="job-details">
                      <div className="job-info">
                        <span className="info-item">
                          <strong>Template:</strong> {job.template_type}
                        </span>
                        <span className="info-item">
                          <strong>Status:</strong> {job.enabled ? '🟢 Enabled' : '🔴 Disabled'}
                        </span>
                        <span className="info-item">
                          <strong>Last Run:</strong> {formatDate(job.lastRunAt)}
                        </span>
                        <span className="info-item">
                          <strong>Next Run:</strong> {formatDate(job.nextRunAt)}
                        </span>
                      </div>
                      
                      {job.description && (
                        <div className="job-description">
                          <p>{job.description}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Load More */}
                {displayedJobs.length < filteredJobs.length && (
                  <div className="load-more">
                    <button onClick={handleLoadMore} className="btn btn-secondary">
                      Load More ({displayedJobs.length} of {filteredJobs.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Modals */}
        {showCreateModal && (
          <JobCreationModal
            templates={templates}
            onClose={() => {
              setShowCreateModal(false);
              setEditJob(null);
            }}
            onSubmit={handleJobSubmit}
            editJob={editJob}
          />
        )}

        {showHistoryModal && selectedJob && (
          <JobExecutionHistory
            job={selectedJob}
            onClose={() => {
              setShowHistoryModal(false);
              setSelectedJob(null);
            }}
          />
        )}
      </div>
    </DynamicSchedulerErrorBoundary>
  );
};

export default DynamicScheduler;
