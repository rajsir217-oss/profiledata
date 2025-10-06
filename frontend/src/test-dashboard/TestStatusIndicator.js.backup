import React from 'react';

const TestStatusIndicator = ({ status }) => {
  const getStatusText = () => {
    if (!status.is_running) {
      return 'No tests running';
    }

    if (status.running_tests.length === 0) {
      return 'Tests running...';
    }

    const testTypes = status.running_tests.map(t => t.test_type).join(', ');
    return `Running: ${testTypes}`;
  };

  const getStatusColor = () => {
    if (!status.is_running) {
      return '#4caf50'; // Green for idle
    }
    return '#ff9800'; // Orange for running
  };

  return (
    <div className="test-status-indicator">
      <div
        className={`status-dot ${status.is_running ? 'running' : 'idle'}`}
        style={{ backgroundColor: getStatusColor() }}
      />
      <span className="status-text">{getStatusText()}</span>
      {status.running_tests.length > 0 && (
        <div className="running-tests">
          {status.running_tests.map((test) => (
            <div key={test.test_id} className="running-test">
              <small>
                {test.test_type} - {new Date(test.start_time).toLocaleTimeString()}
              </small>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TestStatusIndicator;
