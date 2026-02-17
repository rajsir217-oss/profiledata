/**
 * Optimized JobExecutionHistory Component
 * 
 * Phase 1 Optimizations:
 * - Memoized filtering and sorting
 * - Debounced API calls
 * - Virtual scrolling support
 * - Shared keyboard shortcuts
 * - Error boundaries
 * - Performance monitoring
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { getBackendApiUrl } from '../utils/urlHelper';
import './JobExecutionHistory.css';
import DeleteButton from './DeleteButton';
import VirtualLogList from './VirtualLogList';
import useKeyboardShortcuts from '../hooks/useKeyboardShortcuts';
import useDebounce from '../hooks/useDebounce';
import usePerformanceMonitor from '../hooks/usePerformanceMonitor';

// Error Boundary Component
class JobExecutionHistoryErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('JobExecutionHistory Error:', error, errorInfo);
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

const JobExecutionHistory = ({ job, onClose }) => {
  const { recordRender } = usePerformanceMonitor('JobExecutionHistory');
  
  // State management
  const [executions, setExecutions] = useState([]);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [error, setError] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [useVirtualScroll, setUseVirtualScroll] = useState(false);

  // Debounced filter
  const debouncedFilter = useDebounce(filter, 300);

  // Performance tracking
  useEffect(() => {
    recordRender();
  }, [recordRender]);

  // Keyboard shortcuts
  const shortcuts = useMemo(() => [
    {
      keys: 'Escape',
      action: useCallback(() => {
        if (selectedExecution) {
          setSelectedExecution(null);
        } else {
          onClose();
        }
      }, [selectedExecution, onClose])
    },
    {
      keys: 'ArrowLeft',
      action: useCallback(() => {
        if (selectedExecution && executions.length > 0) {
          const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
          if (currentIndex > 0) {
            loadExecutionDetails(executions[currentIndex - 1]._id);
          }
        }
      }, [selectedExecution, executions])
    },
    {
      keys: 'ArrowRight',
      action: useCallback(() => {
        if (selectedExecution && executions.length > 0) {
          const currentIndex = executions.findIndex(e => e._id === selectedExecution._id);
          if (currentIndex < executions.length - 1) {
            loadExecutionDetails(executions[currentIndex + 1]._id);
          }
        }
      }, [selectedExecution, executions])
    },
    {
      keys: 'a',
      ctrl: true,
      action: useCallback(() => {
        if (selectAll) {
          setSelectedIds([]);
          setSelectAll(false);
        } else {
          setSelectedIds(executions.map(e => e._id));
          setSelectAll(true);
        }
      }, [selectAll, executions])
    }
  ], [onClose, selectedExecution, executions]);

  useKeyboardShortcuts(shortcuts);

  // Memoized load executions function
  const loadExecutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({ 
        limit: perPage,
        offset: (currentPage - 1) * perPage
      });
      if (debouncedFilter !== 'all') {
        params.append('status', debouncedFilter);
      }
      
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/jobs/${job._id}/executions?${params}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to load executions: ${response.status}`);
      }
      
      const data = await response.json();
      setExecutions(data.executions || []);
      setTotalCount(data.total || data.executions?.length || 0);
    } catch (err) {
      console.error('Error loading executions:', err);
      setError(err.message || 'Failed to load executions');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [job._id, debouncedFilter, currentPage, perPage]);

  // Load executions when dependencies change
  useEffect(() => {
    loadExecutions();
    setSelectedIds([]);
    setSelectAll(false);
  }, [loadExecutions]);

  // Reset selections when filter changes
  useEffect(() => {
    setSelectedIds([]);
    setSelectAll(false);
  }, [debouncedFilter]);

  // Memoized filtered executions
  const filteredExecutions = useMemo(() => {
    if (!executions.length) return [];
    
    if (debouncedFilter === 'all') {
      return executions;
    }
    
    return executions.filter(execution => execution.status === debouncedFilter);
  }, [executions, debouncedFilter]);

  // Memoized displayed executions
  const displayedExecutions = useMemo(() => {
    if (useVirtualScroll) {
      return filteredExecutions;
    }
    return filteredExecutions.slice(0, Math.min(currentPage * perPage, filteredExecutions.length));
  }, [filteredExecutions, currentPage, perPage, useVirtualScroll]);

  // Memoized execution details
  const executionDetails = useMemo(() => {
    if (!selectedExecution) return null;
    
    return {
      id: selectedExecution._id,
      status: selectedExecution.status,
      startTime: selectedExecution.startTime,
      endTime: selectedExecution.endTime,
      duration: selectedExecution.duration,
      result: selectedExecution.result,
      error: selectedExecution.error,
      triggeredBy: selectedExecution.triggered_by,
      logs: selectedExecution.logs || []
    };
  }, [selectedExecution]);

  // Event handlers
  const handleSelectAll = useCallback(() => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      setSelectedIds(displayedExecutions.map(e => e._id));
      setSelectAll(true);
    }
  }, [selectAll, displayedExecutions]);

  const handleSelectExecution = useCallback((executionId) => {
    if (selectedIds.includes(executionId)) {
      const newSelected = selectedIds.filter(id => id !== executionId);
      setSelectedIds(newSelected);
      setSelectAll(false);
    } else {
      setSelectedIds([...selectedIds, executionId]);
    }
  }, [selectedIds]);

  const loadExecutionDetails = useCallback(async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${executionId}`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const execution = await response.json();
        setSelectedExecution(execution);
      }
    } catch (err) {
      console.error('Error loading execution details:', err);
    }
  }, []);

  const handleDeleteExecutions = useCallback(async () => {
    if (selectedIds.length === 0) return;
    
    try {
      const token = localStorage.getItem('token');
      const deletePromises = selectedIds.map(id =>
        fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${id}`), {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        })
      );
      
      await Promise.all(deletePromises);
      setSelectedIds([]);
      setSelectAll(false);
      loadExecutions();
    } catch (err) {
      console.error('Error deleting executions:', err);
    }
  }, [selectedIds, loadExecutions]);

  const handleRetryExecution = useCallback(async (executionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(getBackendApiUrl(`/api/admin/scheduler/executions/${executionId}/retry`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        loadExecutions();
      }
    } catch (err) {
      console.error('Error retrying execution:', err);
    }
  }, [loadExecutions]);

  // Format functions
  const formatDate = useCallback((dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  }, []);

  const formatDuration = useCallback((startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const duration = end - start;
    
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}m`;
    }
  }, []);

  const getStatusBadge = useCallback((status) => {
    const badges = {
      running: { color: 'blue', icon: '▶️', text: 'Running' },
      completed: { color: 'green', icon: '✅', text: 'Completed' },
      failed: { color: 'red', icon: '❌', text: 'Failed' },
      cancelled: { color: 'gray', icon: '⏹️', text: 'Cancelled' },
      timeout: { color: 'orange', icon: '⏰', text: 'Timeout' }
    };

    const badge = badges[status] || badges.failed;
    return (
      <span className={`status-${badge.color}`}>
        {badge.icon} {badge.text}
      </span>
    );
  }, []);

  // Render execution item
  const renderExecutionItem = useCallback((execution, index) => (
    <div
      key={execution._id}
      className={`execution-item ${selectedIds.includes(execution._id) ? 'selected' : ''}`}
      onClick={() => setSelectedExecution(execution)}
    >
      <div className="execution-checkbox">
        <input
          type="checkbox"
          checked={selectedIds.includes(execution._id)}
          onChange={() => handleSelectExecution(execution._id)}
        />
      </div>
      
      <div className="execution-info">
        <div className="execution-header">
          <span className="execution-id">#{execution._id}</span>
          {getStatusBadge(execution.status)}
          <span className="execution-time">
            {formatDate(execution.startTime)}
          </span>
        </div>
        
        <div className="execution-details">
          <span className="duration">
            Duration: {formatDuration(execution.startTime, execution.endTime)}
          </span>
          <span className="triggered-by">
            By: {execution.triggered_by || 'system'}
          </span>
        </div>
        
        {execution.error && (
          <div className="execution-error">
            Error: {execution.error}
          </div>
        )}
      </div>
      
      <div className="execution-actions">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleRetryExecution(execution._id);
          }}
          className="btn btn-sm btn-primary"
          disabled={execution.status === 'running'}
        >
          🔄 Retry
        </button>
      </div>
    </div>
  ), [selectedIds, handleSelectExecution, handleRetryExecution, getStatusBadge, formatDate, formatDuration]);

  return (
    <JobExecutionHistoryErrorBoundary>
      <div className="job-execution-history">
        <div className="history-header">
          <h2>📊 Execution History</h2>
          <p>Job: {job.name}</p>
          <div className="header-actions">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="running">Running</option>
              <option value="cancelled">Cancelled</option>
              <option value="timeout">Timeout</option>
            </select>
            
            <button
              onClick={() => setUseVirtualScroll(!useVirtualScroll)}
              className={`btn ${useVirtualScroll ? 'btn-info' : 'btn-secondary'}`}
            >
              {useVirtualScroll ? '📱 Virtual Scroll' : '📄 Regular Scroll'}
            </button>
            
            <button onClick={onClose} className="btn btn-secondary">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading execution history...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <p>❌ {error}</p>
            <button onClick={loadExecutions} className="btn btn-primary">Retry</button>
          </div>
        )}

        {/* Execution List */}
        {!loading && !error && (
          <>
            {displayedExecutions.length === 0 ? (
              <div className="empty-state">
                <p>No execution history found.</p>
              </div>
            ) : (
              <>
                {/* Bulk Actions */}
                <div className="bulk-actions">
                  <label className="select-all">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                    />
                    Select All ({selectedIds.length})
                  </label>
                  
                  <button
                    onClick={handleDeleteExecutions}
                    className="btn btn-danger"
                    disabled={selectedIds.length === 0}
                  >
                    Delete Selected ({selectedIds.length})
                  </button>
                </div>

                {/* Virtual Scrolling or Regular List */}
                {useVirtualScroll && displayedExecutions.length > 50 ? (
                  <VirtualLogList
                    items={displayedExecutions}
                    itemHeight={120}
                    containerHeight={600}
                    renderItem={renderExecutionItem}
                  />
                ) : (
                  <div className="executions-list">
                    {displayedExecutions.map((execution, index) => (
                      renderExecutionItem(execution, index)
                    ))}
                  </div>
                )}

                {/* Pagination (for non-virtual scrolling) */}
                {!useVirtualScroll && displayedExecutions.length < filteredExecutions.length && (
                  <div className="pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="btn btn-secondary"
                    >
                      Previous
                    </button>
                    
                    <span className="page-info">
                      Page {currentPage} of {Math.ceil(filteredExecutions.length / perPage)}
                    </span>
                    
                    <button
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      disabled={currentPage * perPage >= filteredExecutions.length}
                      className="btn btn-secondary"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Execution Details Modal */}
        {selectedExecution && executionDetails && (
          <div className="execution-details-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Execution Details</h3>
                <button onClick={() => setSelectedExecution(null)} className="modal-close">✕</button>
              </div>
              
              <div className="modal-body">
                <div className="detail-section">
                  <h4>Basic Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>ID:</label>
                      <span>#{executionDetails.id}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <span>{getStatusBadge(executionDetails.status)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Start Time:</label>
                      <span>{formatDate(executionDetails.startTime)}</span>
                    </div>
                    <div className="detail-item">
                      <label>End Time:</label>
                      <span>{formatDate(executionDetails.endTime)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Duration:</label>
                      <span>{formatDuration(executionDetails.startTime, executionDetails.endTime)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Triggered By:</label>
                      <span>{executionDetails.triggeredBy}</span>
                    </div>
                  </div>
                </div>

                {executionDetails.result && (
                  <div className="detail-section">
                    <h4>Result</h4>
                    <pre className="result-output">
                      {JSON.stringify(executionDetails.result, null, 2)}
                    </pre>
                  </div>
                )}

                {executionDetails.error && (
                  <div className="detail-section">
                    <h4>Error</h4>
                    <div className="error-output">
                      {executionDetails.error}
                    </div>
                  </div>
                )}

                {executionDetails.logs && executionDetails.logs.length > 0 && (
                  <div className="detail-section">
                    <h4>Logs</h4>
                    <div className="logs-output">
                      {executionDetails.logs.map((log, index) => (
                        <div key={index} className="log-entry">
                          <span className="log-time">
                            {formatDate(log.timestamp)}
                          </span>
                          <span className="log-level">
                            {log.level}
                          </span>
                          <span className="log-message">
                            {log.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </JobExecutionHistoryErrorBoundary>
  );
};

export default JobExecutionHistory;
