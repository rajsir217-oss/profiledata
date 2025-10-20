import React, { useState } from 'react';
import { deleteTestResult, clearAllTestResults } from './testApi';
import toastService from '../services/toastService';

const TestResultsList = ({ testResults, onRefresh, isAdmin = false }) => {
  const [expandedResult, setExpandedResult] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  const resultsArray = Object.values(testResults).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  const getStatusIcon = (status) => {
    switch (status) {
      case 'passed':
        return '✅';
      case 'failed':
        return '❌';
      case 'running':
        return '🔄';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'passed':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      case 'running':
        return '#ff9800';
      default:
        return '#2196f3';
    }
  };

  const formatDuration = (seconds) => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(1)}s`;
  };
  const toggleExpanded = (resultId) => {
    setExpandedResult(expandedResult === resultId ? null : resultId);
  };

  const handleDeleteResult = async (resultId) => {
    try {
      setDeletingId(resultId);
      await deleteTestResult(resultId);
      onRefresh();
      toastService.success('Test result deleted successfully');
    } catch (error) {
      console.error('Failed to delete test result:', error);
      toastService.error('Failed to delete test result');
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllResults = async () => {
    try {
      setClearingAll(true);
      await clearAllTestResults();
      onRefresh();
      toastService.success('All test results cleared successfully');
    } catch (error) {
      console.error('Failed to clear all results:', error);
      toastService.error('Failed to clear all results');
    } finally {
      setClearingAll(false);
    }
  };

  if (resultsArray.length === 0) {
    return (
      <div className="no-results">
        <p>No test results available</p>
        <button onClick={onRefresh} className="btn btn-secondary">
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className="test-results-list">
      <div className="results-header">
        <span>Total Results: {resultsArray.length}</span>
        <div className="header-actions">
          <button onClick={onRefresh} className="btn btn-secondary">
            Refresh
          </button>
          {isAdmin && (
            <button 
              onClick={handleClearAllResults} 
              className="btn btn-danger"
              disabled={clearingAll}
              title="Admin only: Clear all test results"
            >
              {clearingAll ? 'Clearing...' : 'Clear All Results'}
            </button>
          )}
        </div>
      </div>

      <div className="results-grid">
        {resultsArray.map((result) => (
          <div key={result.id} className="result-card">
            <div className="result-header" onClick={() => toggleExpanded(result.id)}>
              <div className="result-left">
                <div className="result-type">{result.test_type}</div>
                <div className="result-timestamp">
                  {new Date(result.timestamp).toLocaleString()}
                </div>
              </div>
              
              <div className="result-right">
                <span
                  className="result-status-badge"
                  style={{ backgroundColor: getStatusColor(result.status) }}
                >
                  {getStatusIcon(result.status)} {result.status}
                </span>
                {isAdmin && (
                  <button
                    className="btn btn-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteResult(result.id);
                    }}
                    disabled={deletingId === result.id}
                    title="Admin only: Delete this test result"
                  >
                    {deletingId === result.id ? '...' : '🗑️'}
                  </button>
                )}
              </div>
            </div>

            <div className="result-summary">
              <div className="test-stats">
                <span className="stat">
                  <span className="label">Total:</span>
                  <span className="value">{result.total_tests}</span>
                </span>
                <span className="stat passed">
                  <span className="label">Passed:</span>
                  <span className="value">{result.passed_tests}</span>
                </span>
                <span className="stat failed">
                  <span className="label">Failed:</span>
                  <span className="value">{result.failed_tests}</span>
                </span>
                <span className="stat">
                  <span className="label">Duration:</span>
                  <span className="value">{formatDuration(result.duration)}</span>
                </span>
              </div>
            </div>

            {expandedResult === result.id && (
              <div className="result-details">
                {result.output && (
                  <div className="output-section">
                    <h4>Test Output</h4>
                    <pre className="output-content">{result.output}</pre>
                  </div>
                )}

                {result.error && (
                  <div className="error-section">
                    <h4>Error Details</h4>
                    <pre className="error-content">{result.error}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TestResultsList;
