import React, { useState, useEffect } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import './JobExecutionHistory.css';
import DeleteButton from './DeleteButton';

const JobExecutionHistory = ({ job, onClose }) => {
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadExecutions();
    setSelectedIds([]); // Reset selections when filter changes
    setSelectAll(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job._id, filter, currentPage, perPage]);

  // ESC key to close modal, Arrow keys to navigate executions
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        if (selectedExecution) {
          setSelectedExecution(null);
        } else {
          onClose();
        }
      }
      
      // Arrow key navigation in details view
      if (selectedExecution && executions.length > 0) {
        const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
        
        if (event.key === 'ArrowLeft' && currentIndex > 0) {
          event.preventDefault();
          loadExecutionDetails(executions[currentIndex - 1]._id);
        } else if (event.key === 'ArrowRight' && currentIndex < executions.length - 1) {
          event.preventDefault();
          loadExecutionDetails(executions[currentIndex + 1]._id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, selectedExecution, executions]);

  const loadExecutions = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({ 
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/jobs/${job._id}/executions?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setExecutions(data.executions || []);
      setTotalCount(data.total || data.executions?.length || 0);
    } catch (err) {
      console.error('Error loading executions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(executions.map(e => e._id));
      setSelectAll(true);
    }
  };

  const handleSelectExecution = (executionId) => {
    if (selectedIds.includes(executionId)) {
      const newSelected = selectedIds.filter(id => id !== executionId);
      setSelectedIds(newSelected);
      setSelectAll(false);
    } else {
      const newSelected = [...selectedIds, executionId];
      setSelectedIds(newSelected);
      setSelectAll(newSelected.length === executions.length);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const responses = await Promise.all(
        selectedIds.map(id =>
          fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${id}`), {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
        )
      );
      
      // Check if all deletes succeeded
      const failed = responses.filter(r => !r.ok);
      if (failed.length > 0) {
        throw new Error(`Failed to delete ${failed.length} execution(s)`);
      }
      
      setSelectedIds([]);
      setSelectAll(false);
      loadExecutions();
    } catch (err) {
      console.error('Error bulk deleting executions:', err);
      alert(`Failed to delete executions: ${err.message}`);
      // Still reload to show current state
      loadExecutions();
    }
  };

  const handleDeleteExecution = async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${executionId}`), {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
        throw new Error(error.detail || 'Failed to delete execution');
      }
      
      // Reload executions after delete
      loadExecutions();
    } catch (err) {
      console.error('Error deleting execution:', err);
      alert(`Failed to delete execution: ${err.message}`);
    }
  };

  const loadExecutionDetails = async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${executionId}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      console.log('📊 Execution details loaded:', data.execution);
      console.log('📊 Status field:', data.execution?.status);
      console.log('📊 All fields:', Object.keys(data.execution || {}));
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
      case 'running': return '▶️';
      case 'timeout': return '⏱️';
      case 'partial': return '⚠️';
      default: return '❓';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>📊 Execution History {totalCount > 0 && `(${totalCount})`}</h2>
            <p className="job-name">{job.name}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="history-filters">
          <label>Filter by status:</label>
          <select value={filter} onChange={(e) => {
            setFilter(e.target.value);
            setCurrentPage(1);
          }}>
            <option value="all">All</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="running">Running</option>
            <option value="timeout">Timeout</option>
          </select>
          <button className="btn-refresh" onClick={loadExecutions}>
            🔄 Refresh
          </button>
          {selectedIds.length > 0 && (
            <DeleteButton
              onDelete={handleBulkDelete}
              itemName={`${selectedIds.length} execution${selectedIds.length > 1 ? 's' : ''}`}
              size="medium"
              confirmText="Delete All?"
              className="btn-bulk-delete-action"
            />
          )}
        </div>

        <div className="history-content">
          {selectedExecution ? (
            <div className="execution-details">
              <div className="details-header">
                <div className="header-left">
                  <button 
                    className="btn-back"
                    onClick={() => setSelectedExecution(null)}
                  >
                    ← Back to List
                  </button>
                  <h3>Execution Details</h3>
                </div>
                
                {/* Navigation buttons */}
                <div className="execution-nav">
                  <span className="execution-nav-info">
                    {(() => {
                      const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
                      return currentIndex >= 0 ? `${currentIndex + 1} of ${executions.length}` : '';
                    })()}
                  </span>
                  <button 
                    className="btn-nav"
                    onClick={() => {
                      const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
                      if (currentIndex > 0) {
                        loadExecutionDetails(executions[currentIndex - 1]._id);
                      }
                    }}
                    disabled={(() => {
                      const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
                      return currentIndex <= 0;
                    })()}
                    title="Previous execution"
                  >
                    ‹ Prev
                  </button>
                  <button 
                    className="btn-nav"
                    onClick={() => {
                      const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
                      if (currentIndex < executions.length - 1) {
                        loadExecutionDetails(executions[currentIndex + 1]._id);
                      }
                    }}
                    disabled={(() => {
                      const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
                      return currentIndex >= executions.length - 1;
                    })()}
                    title="Next execution"
                  >
                    Next ›
                  </button>
                  <DeleteButton
                    onDelete={() => handleDeleteExecution(selectedExecution._id)}
                    itemName="execution"
                    size="small"
                    confirmMessage="Are you sure you want to delete this execution?"
                  />
                </div>
              </div>

              <div className="details-grid">
                <div className="detail-card">
                  <label>Job ID</label>
                  <span className="detail-value" style={{fontFamily: 'monospace', fontSize: '0.9em'}}>
                    {selectedExecution.job_id || 'N/A'}
                  </span>
                </div>
                
                <div className="detail-card">
                  <label>Status</label>
                  {/* <span className={`status-badge ${getStatusClass(selectedExecution.status || 'unknown')}`}> */}
                   <span>
                     {getStatusIcon(selectedExecution.status || 'unknown')} {selectedExecution.status || 'unknown'}
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
                      <th style={{ width: '40px' }}>
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={handleSelectAll}
                          title="Select All"
                        />
                      </th>
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
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(execution._id)}
                            onChange={() => handleSelectExecution(execution._id)}
                          />
                        </td>
                        <td>
                          {/* <span className={`status-badge ${getStatusClass(execution.status || 'unknown')}`}> */}
                            <span>
                              {getStatusIcon(execution.status || 'unknown')} {execution.status || 'unknown'}
                          </span>
                        </td>
                        <td>{formatDate(execution.started_at)}</td>
                        <td>{formatDuration(execution.duration_seconds)}</td>
                        <td>{execution.triggered_by}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn-view"
                              onClick={() => loadExecutionDetails(execution._id)}
                            >
                              👁️ View
                            </button>
                            <DeleteButton
                              onDelete={() => handleDeleteExecution(execution._id)}
                              itemName="execution"
                              size="small"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              
              {/* Pagination Controls */}
              {!loading && executions.length > 0 && (
                <div className="pagination-controls">
                  <div className="pagination-info">
                    Showing {Math.min((currentPage - 1) * perPage + 1, totalCount)}-{Math.min(currentPage * perPage, totalCount)} of {totalCount} executions
                  </div>
                  
                  <div className="pagination-buttons">
                    <button 
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      title="First page"
                    >
                      «
                    </button>
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      title="Previous page"
                    >
                      ‹
                    </button>
                    
                    {(() => {
                      const totalPages = Math.ceil(totalCount / perPage);
                      const pages = [];
                      let startPage = Math.max(1, currentPage - 2);
                      let endPage = Math.min(totalPages, currentPage + 2);
                      
                      if (startPage > 1) {
                        pages.push(
                          <button key={1} onClick={() => setCurrentPage(1)} className={currentPage === 1 ? 'active' : ''}>
                            1
                          </button>
                        );
                        if (startPage > 2) {
                          pages.push(<span key="dots1" className="pagination-dots">...</span>);
                        }
                      }
                      
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button 
                            key={i} 
                            onClick={() => setCurrentPage(i)}
                            className={currentPage === i ? 'active' : ''}
                          >
                            {i}
                          </button>
                        );
                      }
                      
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(<span key="dots2" className="pagination-dots">...</span>);
                        }
                        pages.push(
                          <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className={currentPage === totalPages ? 'active' : ''}>
                            {totalPages}
                          </button>
                        );
                      }
                      
                      return pages;
                    })()}
                    
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(Math.ceil(totalCount / perPage), p + 1))}
                      disabled={currentPage >= Math.ceil(totalCount / perPage)}
                      title="Next page"
                    >
                      ›
                    </button>
                    <button 
                      onClick={() => setCurrentPage(Math.ceil(totalCount / perPage))}
                      disabled={currentPage >= Math.ceil(totalCount / perPage)}
                      title="Last page"
                    >
                      »
                    </button>
                  </div>
                  
                  <select 
                    value={perPage} 
                    onChange={(e) => {
                      setPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="per-page-select"
                  >
                    <option value={10}>10 per page</option>
                    <option value={25}>25 per page</option>
                    <option value={50}>50 per page</option>
                    <option value={100}>100 per page</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobExecutionHistory;
