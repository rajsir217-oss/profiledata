import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import './AdminSettings.css';

const AdminSettings = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Ticket Management Settings
  const [ticketDeleteDays, setTicketDeleteDays] = useState(30);
  const [savingTicketSettings, setSavingTicketSettings] = useState(false);
  const [ticketSettingsMessage, setTicketSettingsMessage] = useState({ type: '', text: '' });
  const [showTooltip, setShowTooltip] = useState(false);

  // Scheduler Jobs
  const [schedulerJobs, setSchedulerJobs] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [showJobModal, setShowJobModal] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [jobFormData, setJobFormData] = useState({
    name: '',
    interval_seconds: 3600,
    enabled: true
  });
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [selectedJobLogs, setSelectedJobLogs] = useState(null);
  const [jobLogs, setJobLogs] = useState([]);

  useEffect(() => {
    const username = localStorage.getItem('username');
    if (username !== 'admin') {
      navigate('/');
      return;
    }
    setCurrentUser(username);
    loadSettings();
  }, [navigate]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      // Load system settings
      const response = await api.get('/system-settings');
      console.log('📥 Loaded settings from API:', response.data);
      
      const days = response.data.ticket_delete_days;
      console.log('📅 Ticket delete days from API:', days, 'Type:', typeof days);
      
      // Use the value from API, default to 30 only if undefined/null
      setTicketDeleteDays(days !== undefined && days !== null ? days : 30);
      
      // Load scheduler jobs
      await loadSchedulerJobs();
    } catch (error) {
      console.error('Error loading settings:', error);
      // Set default on error
      setTicketDeleteDays(30);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTicketSettings = async () => {
    try {
      setSavingTicketSettings(true);
      setTicketSettingsMessage({ type: '', text: '' });

      await api.put('/system-settings', {
        ticket_delete_days: ticketDeleteDays
      });

      setTicketSettingsMessage({ type: 'success', text: '✅ Settings saved successfully!' });
      setTimeout(() => setTicketSettingsMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error saving ticket settings:', error);
      setTicketSettingsMessage({ type: 'error', text: '⚠️ Failed to save settings' });
    } finally {
      setSavingTicketSettings(false);
    }
  };

  const loadSchedulerJobs = async () => {
    try {
      setLoadingJobs(true);
      const response = await api.get('/scheduler-jobs');
      setSchedulerJobs(response.data.jobs || []);
    } catch (error) {
      console.error('Error loading scheduler jobs:', error);
    } finally {
      setLoadingJobs(false);
    }
  };

  const handleAddJob = () => {
    setEditingJob(null);
    setJobFormData({
      name: '',
      interval_seconds: 3600,
      enabled: true
    });
    setShowJobModal(true);
  };

  const handleEditJob = (job) => {
    setEditingJob(job);
    setJobFormData({
      name: job.name,
      interval_seconds: job.interval_seconds,
      enabled: job.enabled
    });
    setShowJobModal(true);
  };

  const handleSaveJob = async () => {
    try {
      if (editingJob) {
        await api.put(`/scheduler-jobs/${editingJob.name}`, jobFormData);
      } else {
        await api.post('/scheduler-jobs', jobFormData);
      }
      await loadSchedulerJobs();
      setShowJobModal(false);
    } catch (error) {
      console.error('Error saving job:', error);
      alert('Failed to save job: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDeleteJob = async (jobName) => {
    if (!window.confirm(`Are you sure you want to delete the job "${jobName}"?`)) {
      return;
    }
    try {
      await api.delete(`/scheduler-jobs/${jobName}`);
      await loadSchedulerJobs();
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleToggleJob = async (jobName, enabled) => {
    try {
      await api.patch(`/scheduler-jobs/${jobName}/toggle`, { enabled });
      await loadSchedulerJobs();
    } catch (error) {
      console.error('Error toggling job:', error);
    }
  };

  const handleRunJob = async (jobName) => {
    if (!window.confirm(`Run job "${jobName}" now?`)) {
      return;
    }
    try {
      const response = await api.post(`/scheduler-jobs/${jobName}/run`);
      alert(response.data.message || 'Job started successfully!');
      await loadSchedulerJobs();
    } catch (error) {
      console.error('Error running job:', error);
      alert('Failed to run job: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleViewLogs = async (jobName) => {
    setSelectedJobLogs(jobName);
    setShowLogsModal(true);
    try {
      const response = await api.get(`/scheduler-jobs/${jobName}/logs`);
      setJobLogs(response.data.logs || []);
    } catch (error) {
      console.error('Error loading job logs:', error);
      setJobLogs([{ 
        timestamp: new Date().toISOString(), 
        status: 'error', 
        message: 'Failed to load logs: ' + (error.response?.data?.detail || error.message)
      }]);
    }
  };

  if (loading) {
    return (
      <div className="admin-settings-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading admin settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-settings-page">
      <div className="admin-settings-header">
        <h1>🔧 System Settings</h1>
        <p>Global system configuration and management</p>
      </div>

      {/* Ticket Management Settings */}
      <div className="settings-section">
        <div className="section-header">
          <h2>🎫 Ticket Management</h2>
          <p className="section-description">Configure automatic cleanup for resolved support tickets</p>
        </div>

        {ticketSettingsMessage.text && (
          <div className={`alert alert-${ticketSettingsMessage.type}`}>
            {ticketSettingsMessage.text}
          </div>
        )}

        <div className="settings-card">
          <div className="form-group">
            <div className="label-with-tooltip">
              <label htmlFor="ticketDeleteDays">Auto-Delete Period</label>
              <div className="tooltip-wrapper">
                <span 
                  className="info-tooltip-icon" 
                  onClick={() => setShowTooltip(!showTooltip)}
                >
                  ℹ️
                </span>
                {showTooltip && (
                  <>
                    <div className="tooltip-backdrop" onClick={() => setShowTooltip(false)} />
                    <div className="tooltip-bubble">
                      <div className="tooltip-content">
                        <strong>How it works:</strong>
                        <ul>
                          <li>When a ticket is marked as <strong>resolved</strong> or <strong>closed</strong>, a deletion timestamp is set</li>
                          <li>A background job runs every hour to delete tickets past their scheduled deletion time</li>
                          <li>All attachments are permanently deleted from the filesystem</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <p className="help-text">
              Resolved/closed tickets and attachments will be automatically deleted after this period.
            </p>
            
            <div className="settings-control-row">
              <select
                id="ticketDeleteDays"
                value={ticketDeleteDays}
                onChange={(e) => setTicketDeleteDays(Number(e.target.value))}
                disabled={savingTicketSettings}
                className="form-control"
              >
                <option value={0}>Immediately (on resolve/close)</option>
                <option value={7}>7 days after resolved</option>
                <option value={14}>14 days after resolved</option>
                <option value={30}>30 days after resolved (Recommended)</option>
                <option value={60}>60 days after resolved</option>
                <option value={90}>90 days after resolved</option>
              </select>
              
              <button
                className="btn-save-settings"
                onClick={handleSaveTicketSettings}
                disabled={savingTicketSettings}
              >
                {savingTicketSettings ? '💾 Saving...' : '💾 Save Ticket Settings'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scheduler Jobs */}
      <div className="settings-section">
        <div className="section-header">
          <h2>⏰ Scheduler Jobs</h2>
          <p className="section-description">Manage background jobs and scheduled tasks</p>
        </div>

        {/* Info box showing available jobs */}
        <div className="info-box">
          <div className="info-icon">ℹ️</div>
          <div className="info-text">
            <strong>Available Scheduler Jobs</strong>
            <ul>
              <li><strong>data_cleanup</strong> - Removes old/expired data (runs every hour)</li>
              <li><strong>test_scheduler</strong> - Checks and runs scheduled tests (runs every minute)</li>
              <li><strong>auto_delete_resolved_tickets</strong> - Deletes old resolved support tickets (runs daily at 7pm UTC)</li>
            </ul>
            <p style={{marginTop: '10px', fontSize: '13px', color: '#1e40af'}}>
              💡 <em>These jobs are configured in the backend code. Adding new jobs requires code deployment.</em>
            </p>
          </div>
        </div>

        <button 
          className="btn-add-job" 
          onClick={handleAddJob}
          disabled={true}
          title="Adding custom jobs requires backend code deployment"
          style={{opacity: 0.5, cursor: 'not-allowed'}}
        >
          ➕ Add New Job (Disabled)
        </button>

        {loadingJobs ? (
          <div className="loading">Loading jobs...</div>
        ) : (
          <div className="jobs-table-container">
            {schedulerJobs.length === 0 ? (
              <p className="no-jobs">No scheduled jobs found</p>
            ) : (
              <table className="jobs-table">
                <thead>
                  <tr>
                    <th>Job Name</th>
                    <th>Interval</th>
                    <th>Last Run</th>
                    <th>Next Run</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulerJobs.map(job => (
                    <tr key={job.name}>
                      <td><strong>{job.name}</strong></td>
                      <td>{Math.floor(job.interval_seconds / 60)} minutes</td>
                      <td>{job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}</td>
                      <td>{job.next_run ? new Date(job.next_run).toLocaleString() : 'N/A'}</td>
                      <td>
                        <span className={`job-status ${job.enabled ? 'enabled' : 'disabled'}`}>
                          {job.enabled ? '✅ Enabled' : '⏸️ Disabled'}
                        </span>
                      </td>
                      <td className="job-actions">
                        <button
                          className="btn-icon"
                          onClick={() => handleViewLogs(job.name)}
                          title="View Logs"
                        >
                          📋
                        </button>
                        <button
                          className="btn-icon btn-success"
                          onClick={() => handleRunJob(job.name)}
                          title="Run Now"
                        >
                          ▶️
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleToggleJob(job.name, !job.enabled)}
                          title={job.enabled ? 'Disable' : 'Enable'}
                        >
                          {job.enabled ? '⏸️' : '⏯️'}
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleEditJob(job)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon btn-danger"
                          onClick={() => handleDeleteJob(job.name)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Job Modal */}
      {showJobModal && (
        <div className="modal-overlay" onClick={() => setShowJobModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">{editingJob ? '✏️ Edit Job' : '➕ Add New Job'}</h5>
              {/* <h3>{editingJob ? '✏️ Edit Job' : '➕ Add New Job'}</h3> */}
              <button 
                className="modal-close-btn" 
                onClick={() => setShowJobModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={(e) => { e.preventDefault(); handleSaveJob(); }}>
              <div className="form-group">
                <label htmlFor="job-name">Job Name</label>
                <input
                  id="job-name"
                  type="text"
                  value={jobFormData.name}
                  onChange={(e) => setJobFormData({...jobFormData, name: e.target.value})}
                  placeholder="e.g., cleanup_old_data"
                  disabled={!!editingJob}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="job-interval">Interval (seconds)</label>
                <input
                  id="job-interval"
                  type="number"
                  value={jobFormData.interval_seconds}
                  onChange={(e) => setJobFormData({...jobFormData, interval_seconds: Number(e.target.value)})}
                  min="60"
                  className="form-control"
                  required
                />
                <p className="help-text">Minimum: 60 seconds (1 minute)</p>
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={jobFormData.enabled}
                    onChange={(e) => setJobFormData({...jobFormData, enabled: e.target.checked})}
                  />
                  Enable this job
                </label>
              </div>
            </form>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowJobModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleSaveJob}>
                {editingJob ? '💾 Update Job' : '➕ Add Job'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Job Logs Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)}>
          <div className="modal-content logs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h5 className="modal-title">📋 Job Logs: {selectedJobLogs}</h5>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowLogsModal(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body logs-content">
              {jobLogs.length === 0 ? (
                <div className="no-logs">
                  <p>No logs available yet. This job hasn't run or logging is not enabled.</p>
                </div>
              ) : (
                <div className="logs-list">
                  {jobLogs.map((log, index) => (
                    <div key={index} className={`log-entry log-${log.status}`}>
                      <div className="log-header">
                        <span className="log-timestamp">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                        <span className={`log-status-badge ${log.status}`}>
                          {log.status === 'success' ? '✅ Success' : 
                           log.status === 'error' ? '❌ Error' : 
                           log.status === 'running' ? '⏳ Running' : '⚠️ Warning'}
                        </span>
                      </div>
                      <div className="log-message">
                        {log.message}
                      </div>
                      {log.details && (
                        <div className="log-details">
                          <pre>{JSON.stringify(log.details, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setShowLogsModal(false)}>
                Close
              </button>
              <button 
                type="button" 
                className="btn-primary" 
                onClick={() => handleViewLogs(selectedJobLogs)}
              >
                🔄 Refresh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
