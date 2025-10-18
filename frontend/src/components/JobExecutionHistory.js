import React, { useState, useEffect } from 'react';
import './JobExecutionHistory.css';

const JobExecutionHistory = ({ job, onClose }) => {
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadExecutions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job._id, filter]);

  const loadExecutions = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ limit: 50 });
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/jobs/${job._id}/executions?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setExecutions(data.executions || []);
    } catch (err) {
      console.error('Error loading executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExecutionDetails = async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:8000/api/admin/scheduler/executions/${executionId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setSelectedExecution(data.execution);
    } catch (err) {
      console.error('Error loading execution details:', err);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const formatDuration = (seconds) => {
    if (!seconds) return 'N/A';
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'success': return '✅';
      case 'failed': return '❌';
      case 'running': return '⏳';
      case 'timeout': return '⏱️';
      case 'partial': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'success': return 'status-success';
      case 'failed': return 'status-failed';
      case 'running': return 'status-running';
      case 'timeout': return 'status-timeout';
      case 'partial': return 'status-partial';
      default: return '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>📊 Execution History</h2>
            <p className="job-name">{job.name}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="history-filters">
          <label>Filter by status:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="timeout">Timeout</option>
          </select>
          <button className="btn-refresh" onClick={loadExecutions}>
            🔄 Refresh
          </button>
        </div>

        <div className="history-content">
          {selectedExecution ? (
            <div className="execution-details">
              <div className="details-header">
                <button 
                  className="btn-back"
                  onClick={() => setSelectedExecution(null)}
                >
                  ← Back to List
                </button>
                <h3>Execution Details</h3>
              </div>

              <div className="details-grid">
                <div className="detail-card">
                  <label>Status</label>
                  <span className={`status-badge ${getStatusClass(selectedExecution.status)}`}>
                    {getStatusIcon(selectedExecution.status)} {selectedExecution.status}
                  </span>
                </div>
                <div className="detail-card">
                  <label>Started At</label>
                  <span>{formatDate(selectedExecution.started_at)}</span>
                </div>
                <div className="detail-card">
                  <label>Completed At</label>
                  <span>{formatDate(selectedExecution.completed_at)}</span>
                </div>
                <div className="detail-card">
                  <label>Duration</label>
                  <span>{formatDuration(selectedExecution.duration_seconds)}</span>
                </div>
                <div className="detail-card">
                  <label>Triggered By</label>
                  <span>{selectedExecution.triggered_by}</span>
                </div>
                <div className="detail-card">
                  <label>Execution Host</label>
                  <span>{selectedExecution.execution_host || 'N/A'}</span>
                </div>
              </div>

              {selectedExecution.result && (
                <div className="result-section">
                  <h4>Result</h4>
                  <div className="result-grid">
                    {selectedExecution.result.message && (
                      <div className="result-item">
                        <strong>Message:</strong> {selectedExecution.result.message}
                      </div>
                    )}
                    {selectedExecution.result.records_processed !== undefined && (
                      <div className="result-item">
                        <strong>Records Processed:</strong> {selectedExecution.result.records_processed}
                      </div>
                    )}
                    {selectedExecution.result.records_affected !== undefined && (
                      <div className="result-item">
                        <strong>Records Affected:</strong> {selectedExecution.result.records_affected}
                      </div>
                    )}
                    {selectedExecution.result.details && (
                      <div className="result-item">
                        <strong>Details:</strong>
                        <pre>{JSON.stringify(selectedExecution.result.details, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedExecution.error && (
                <div className="error-section">
                  <h4>❌ Error</h4>
                  <pre>{selectedExecution.error}</pre>
                </div>
              )}

              {selectedExecution.logs && selectedExecution.logs.length > 0 && (
                <div className="logs-section">
                  <h4>📝 Logs</h4>
                  <div className="logs-container">
                    {selectedExecution.logs.map((log, idx) => (
                      <div key={idx} className={`log-entry log-${log.level.toLowerCase()}`}>
                        <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="log-level">{log.level}</span>
                        <span className="log-message">{log.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="executions-list">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Loading executions...</p>
                </div>
              ) : executions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">📭</div>
                  <h3>No executions found</h3>
                  <p>This job hasn't run yet</p>
                </div>
              ) : (
                <table className="executions-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Started</th>
                      <th>Duration</th>
                      <th>Triggered By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {executions.map(execution => (
                      <tr key={execution._id}>
                        <td>
                          <span className={`status-badge ${getStatusClass(execution.status)}`}>
                            {getStatusIcon(execution.status)} {execution.status}
                          </span>
                        </td>
                        <td>{formatDate(execution.started_at)}</td>
                        <td>{formatDuration(execution.duration_seconds)}</td>
                        <td>{execution.triggered_by}</td>
                        <td>
                          <button
                            className="btn-view"
                            onClick={() => loadExecutionDetails(execution._id)}
                          >
                            👁️ View
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
      </div>
    </div>
  );
};

export default JobExecutionHistory;
