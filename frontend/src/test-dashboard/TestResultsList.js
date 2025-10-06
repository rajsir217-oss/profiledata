import React, { useState } from 'react';

const TestResultsList = ({ testResults, onRefresh }) => {
  const [expandedResult, setExpandedResult] = useState(null);

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
        <button onClick={onRefresh} className="btn btn-secondary">
          Refresh
        </button>
      </div>

      <div className="results-grid">
        {resultsArray.map((result) => (
          <div key={result.id} className="result-card">
            <div className="result-header" onClick={() => toggleExpanded(result.id)}>
              <div className="result-info">
                <span className="result-type">{result.test_type}</span>
                <span className="result-timestamp">
                  {new Date(result.timestamp).toLocaleString()}
                </span>
              </div>

              <div className="result-status">
                <span
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(result.status) }}
                >
                  {getStatusIcon(result.status)} {result.status}
                </span>
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
