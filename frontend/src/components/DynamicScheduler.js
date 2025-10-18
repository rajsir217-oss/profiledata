import React, { useState, useEffect } from 'react';
import './DynamicScheduler.css';
import JobCreationModal from './JobCreationModal';
import JobExecutionHistory from './JobExecutionHistory';
import Toast from './Toast';

const DynamicScheduler = ({ currentUser }) => {
  const [jobs, setJobs] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [filterTemplate, setFilterTemplate] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [toast, setToast] = useState(null);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
    loadSchedulerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load jobs when filters change
  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterTemplate, filterEnabled, currentPage, refreshTrigger]);

  // Check if user is admin (must be after all hooks)
  if (currentUser !== 'admin') {
    return (
      <div className="dynamic-scheduler">
        <div className="access-denied">
          <h2>⛔ Access Denied</h2>
          <p>You need administrator privileges to access the Dynamic Scheduler.</p>
        </div>
      </div>
    );
  }

  const loadTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/scheduler/templates', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('Templates API error:', response.status, await response.text());
        return;
      }
      
      const data = await response.json();
      console.log('Templates loaded:', data);
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Error loading templates:', err);
    }
  };

  const loadSchedulerStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/scheduler/status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        console.error('Status API error:', response.status);
        return;
      }
      
      const data = await response.json();
      console.log('Status data:', data);
      setStatus(data);
    } catch (err) {
      console.error('Error loading status:', err);
    }
  };

  const loadJobs = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        page: currentPage,
        limit: 20
      });
      
      if (filterTemplate) {
        params.append('template_type', filterTemplate);
      }
      
      if (filterEnabled !== 'all') {
        params.append('enabled', filterEnabled === 'enabled');
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/jobs?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setJobs(data.jobs || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      setError('Failed to load jobs');
      console.error('Error loading jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateJob = async (jobData) => {
    try {
      // Clean up undefined values from parameters
      const cleanedData = {
        ...jobData,
        parameters: Object.fromEntries(
          Object.entries(jobData.parameters).filter(([_, v]) => v !== undefined && v !== null)
        )
      };
      
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:8000/api/admin/scheduler/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(cleanedData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create job');
      }
      setShowCreateModal(false);
      setRefreshTrigger(prev => prev + 1);
      loadSchedulerStatus();
    } catch (err) {
      console.error('Error creating job:', err);
      throw err;
    }
  };

  const handleToggleEnabled = async (jobId, currentEnabled) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/jobs/${jobId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      if (!response.ok) throw new Error('Failed to toggle job');
      setToast({ message: `Job ${!currentEnabled ? 'enabled' : 'disabled'} successfully`, type: 'success' });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Error toggling job:', err);
      setToast({ message: 'Failed to update job status', type: 'error' });
    }
  };

  const handleDeleteJob = async (jobId, jobName) => {
    if (!window.confirm(`Are you sure you want to delete the job "${jobName}"?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/jobs/${jobId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to delete job');
      setToast({ message: `Job "${jobName}" deleted successfully`, type: 'success' });
      setRefreshTrigger(prev => prev + 1);
      loadSchedulerStatus();
    } catch (err) {
      console.error('Error deleting job:', err);
      setToast({ message: 'Failed to delete job', type: 'error' });
    }
  };

  const handleRunJob = async (jobId, jobName) => {
    if (!window.confirm(`Manually run the job "${jobName}" now?`)) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/jobs/${jobId}/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to run job');
      setToast({ message: `Job "${jobName}" execution started`, type: 'success' });
      setRefreshTrigger(prev => prev + 1);
    } catch (err) {
      console.error('Error running job:', err);
      setToast({ message: 'Failed to start job execution', type: 'error' });
    }
  };

  const handleViewHistory = (job) => {
    setSelectedJob(job);
    setShowHistoryModal(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatSchedule = (schedule) => {
    if (!schedule) return 'Not scheduled';
    
    if (schedule.type === 'interval') {
      const hours = Math.floor(schedule.interval_seconds / 3600);
      const minutes = Math.floor((schedule.interval_seconds % 3600) / 60);
      if (hours > 0) {
        return `Every ${hours}h ${minutes}m`;
      }
      return `Every ${minutes}m`;
    } else if (schedule.type === 'cron') {
      return `Cron: ${schedule.expression}`;
    }
    
    return 'Unknown schedule';
  };

  const getTemplateIcon = (templateType) => {
    const template = templates.find(t => t.type === templateType);
    return template?.icon || '⚙️';
  };

  return (
    <div className="dynamic-scheduler">
      <div className="scheduler-header">
        <div className="header-content">
          <h1>🗓️ Dynamic Scheduler</h1>
          <p>Manage scheduled jobs and automation tasks</p>
        </div>
        <button 
          className="btn btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          ➕ Create New Job
        </button>
      </div>

      {/* Status Cards */}
      {status && status.jobs && status.scheduler && status.executions && (
        <div className="status-cards">
          <div className="status-card">
            <div className="status-icon">📊</div>
            <div className="status-info">
              <div className="status-value">{status.jobs.total || 0}</div>
              <div className="status-label">Total Jobs</div>
            </div>
          </div>
          <div className="status-card success">
            <div className="status-icon">✅</div>
            <div className="status-info">
              <div className="status-value">{status.jobs.enabled || 0}</div>
              <div className="status-label">Active Jobs</div>
            </div>
          </div>
          <div className="status-card">
            <div className="status-icon">📋</div>
            <div className="status-info">
              <div className="status-value">{status.scheduler.template_count || 0}</div>
              <div className="status-label">Templates</div>
            </div>
          </div>
          <div className="status-card">
            <div className="status-icon">📈</div>
            <div className="status-info">
              <div className="status-value">{status.executions.success_rate || 'N/A'}</div>
              <div className="status-label">Success Rate</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="scheduler-filters">
        <div className="filter-group">
          <label>Template Type:</label>
          <select 
            value={filterTemplate} 
            onChange={(e) => { setFilterTemplate(e.target.value); setCurrentPage(1); }}
          >
            <option value="">All Templates</option>
            {templates.map(t => (
              <option key={t.type} value={t.type}>
                {t.icon} {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <label>Status:</label>
          <select 
            value={filterEnabled} 
            onChange={(e) => { setFilterEnabled(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
          </select>
        </div>
        <button 
          className="btn btn-secondary"
          onClick={() => setRefreshTrigger(prev => prev + 1)}
        >
          🔄 Refresh
        </button>
      </div>

      {/* Jobs Table */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading jobs...</p>
        </div>
      ) : error ? (
        <div className="error-state">
          <p>❌ {error}</p>
          <button onClick={loadJobs}>Retry</button>
        </div>
      ) : jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h3>No jobs found</h3>
          <p>Create your first scheduled job to get started</p>
          <button 
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ Create Job
          </button>
        </div>
      ) : (
        <>
          <div className="jobs-table">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Job Name</th>
                  <th>Template</th>
                  <th>Schedule</th>
                  <th>Last Run</th>
                  <th>Next Run</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job._id}>
                    <td>
                      <span className={`status-badge ${job.enabled ? 'enabled' : 'disabled'}`}>
                        {job.enabled ? '✅ Enabled' : '⏸️ Disabled'}
                      </span>
                    </td>
                    <td>
                      <div className="job-name">
                        <strong>{job.name}</strong>
                        {job.description && <small>{job.description}</small>}
                      </div>
                    </td>
                    <td>
                      <span className="template-badge">
                        {getTemplateIcon(job.template_type)} {job.template_type}
                      </span>
                    </td>
                    <td>{formatSchedule(job.schedule)}</td>
                    <td>{formatDate(job.last_run_at)}</td>
                    <td>{formatDate(job.next_run_at)}</td>
                    <td>
                      <div className="job-actions">
                        <button 
                          className="btn-icon" 
                          title="Run Now"
                          onClick={() => handleRunJob(job._id, job.name)}
                        >
                          ▶️
                        </button>
                        <button 
                          className="btn-icon" 
                          title="View History"
                          onClick={() => handleViewHistory(job)}
                        >
                          📊
                        </button>
                        <button 
                          className="btn-icon" 
                          title={job.enabled ? 'Disable' : 'Enable'}
                          onClick={() => handleToggleEnabled(job._id, job.enabled)}
                        >
                          {job.enabled ? '⏸️' : '▶️'}
                        </button>
                        <button 
                          className="btn-icon danger" 
                          title="Delete"
                          onClick={() => handleDeleteJob(job._id, job.name)}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <button 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                ← Previous
              </button>
              <span>Page {currentPage} of {totalPages}</span>
              <button 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      {showCreateModal && (
        <JobCreationModal
          templates={templates}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateJob}
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

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default DynamicScheduler;
