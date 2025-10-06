import React from 'react';

const TestSuiteCard = ({ testSuite, onRunTests, isRunning }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'passed':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      default:
        return '#2196f3';
    }
  };

  const formatLastRun = (lastRun) => {
    if (!lastRun) return 'Never run';
    return new Date(lastRun).toLocaleString();
  };

  return (
    <div className="test-suite-card">
      <div className="card-header">
        <h3>{testSuite.name}</h3>
        <div
          className="status-indicator"
          style={{ backgroundColor: getStatusColor(testSuite.last_status) }}
          title={`Last status: ${testSuite.last_status || 'Not run'}`}
        />
      </div>

      <div className="card-content">
        <p className="description">{testSuite.description}</p>

        <div className="card-details">
          <div className="detail-item">
            <span className="label">Type:</span>
            <span className="value">{testSuite.type}</span>
          </div>
          <div className="detail-item">
            <span className="label">Last Run:</span>
            <span className="value">{formatLastRun(testSuite.last_run)}</span>
          </div>
          <div className="detail-item">
            <span className="label">Last Status:</span>
            <span className="value" style={{ color: getStatusColor(testSuite.last_status) }}>
              {testSuite.last_status || 'Not run'}
            </span>
          </div>
        </div>
      </div>

      <div className="card-actions">
        <button
          className={`btn ${isRunning ? 'btn-disabled' : 'btn-primary'}`}
          onClick={() => onRunTests(testSuite.type)}
          disabled={isRunning}
        >
          {isRunning ? 'Running...' : 'Run Tests'}
        </button>
      </div>
    </div>
  );
};

export default TestSuiteCard;
